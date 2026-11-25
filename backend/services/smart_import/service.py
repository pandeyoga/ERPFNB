"""Impor Cerdas — batch, pemetaan nilai, cek duplikasi 4 lapis, rekap harian, commit/rollback, resep per sumber.

Alur: create_batch (profil + pemetaan + pratinjau, belum menyimpan data) → update_batch (ubah pemetaan/opsi/nilai) →
commit (simpan transaksi detail + baris item + master menu otomatis, rekap ke Daily Sales DRAF lewat
outlet_service — semua validasi & izin tetap berlaku) → rollback (batalkan impor).

Cek duplikasi: (1) sidik jari file, (2) sidik jari transaksi (toko + no. struk + tanggal; tanpa nomor: jam + nominal +
item), (3) tanggal yang sudah punya Daily Sales → sama / ganti / gabung / konflik dengan bukti, (4) pesanan delivery
yang sama di dua sumber (POS + aplikasi) → kemungkinan ganda, tidak dihitung dua kali.
"""
from __future__ import annotations

import difflib
import hashlib
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

from core.db import get_db
from core.exceptions import ForbiddenError, NotFoundError, ValidationError
from core.security import scoped_outlet_ids
from core.audit import log as audit_log

from . import engine
from . import mapping as mp

PREVIEW_TX = 50
LOCKED = ("submitted", "validating", "validated")
DELIVERY = ("GoFood", "GrabFood", "ShopeeFood")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rp(v: Any) -> str:
    return f"{float(v or 0):,.0f}".replace(",", ".")


def _perms(user: dict) -> set[str]:
    return set(user.get("permissions") or [])


def _need(user: dict, *codes: str) -> None:
    p = _perms(user)
    if "*" not in p and not any(c in p for c in codes):
        raise ForbiddenError(f"Butuh izin: {' / '.join(codes)}")


async def _file_bytes(att_id: str, user: dict) -> tuple[bytes, dict]:
    from services import upload_service
    meta = await upload_service.get_attachment(att_id, user=user)
    return await upload_service.get_attachment_bytes(att_id, user=user), meta


# ---------------------------------------------------------------- pemetaan nilai

def _norm(s: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


async def _outlets(user: dict) -> list[dict]:
    scope = scoped_outlet_ids(user)
    q: dict = {"deleted_at": None}
    if scope is not None:
        q["id"] = {"$in": scope}
    return await get_db().outlets.find(q, {"_id": 0, "id": 1, "name": 1, "code": 1, "brand_id": 1}).to_list(500)


def match_outlet(raw: str, outlets: list[dict]) -> Optional[str]:
    r = _norm(raw)
    if not r:
        return None
    for o in outlets:
        if r in (_norm(o["name"]), _norm(o.get("code"))):
            return o["id"]
    contained = [o for o in outlets if _norm(o["name"]) and re.search(rf"(^|\s){re.escape(_norm(o['name']))}($|\s)", r)]
    if contained:
        return max(contained, key=lambda o: len(o["name"]))["id"]       # "The Lounge - Cihampelas" → The Lounge
    best = max(outlets, key=lambda o: difflib.SequenceMatcher(None, r, _norm(o["name"])).ratio(), default=None)
    if best and difflib.SequenceMatcher(None, r, _norm(best["name"])).ratio() >= 0.8:
        return best["id"]
    return None


async def _payment_methods() -> list[dict]:
    return await get_db().payment_methods.find({"deleted_at": None}, {"_id": 0, "id": 1, "code": 1, "name": 1, "type": 1}).to_list(200)


def match_payment(raw: str, methods: list[dict]) -> Optional[str]:
    r = _norm(raw)
    if not r:
        return None
    for m in methods:
        if r in (_norm(m.get("code")), _norm(m.get("name"))):
            return m["id"]
    plat = engine.canonical_channel(raw)
    if plat in DELIVERY:                       # GoFood/GrabFood/ShopeeFood → metode bayar marketplace platform itu
        for m in methods:
            if (m.get("type") == "marketplace" and plat.lower().replace("food", "") in
                    (_norm(m.get("name")) + " " + _norm(m.get("code"))).replace(" ", "")):
                return m["id"]
        return None
    kind = engine.payment_kind(raw)
    if not kind:
        return None
    same = [m for m in methods if (m.get("type") or "") == kind and _norm(m.get("code")) != "petty"]
    if not same:
        return None
    # "Transfer BCA" / "Kartu Debit BCA" → metode yang menyebut bank yang sama bila ada
    for m in same:
        bank = re.search(r"\b(bca|mandiri|bni|bri|cimb|permata|btn)\b", _norm(m.get("name")) + " " + _norm(m.get("code")))
        if bank and bank.group(1) in r:
            return m["id"]
    return same[0]["id"]


# ---------------------------------------------------------------- batch

def _fp_tx(outlet_id: str, tx: dict) -> str:
    if tx.get("receipt_no"):
        key = f"{outlet_id}|{tx['receipt_no']}|{tx['date']}"
    else:
        items = ",".join(sorted(f"{i['name']}x{i['qty']}" for i in tx.get("items") or []))
        key = f"{outlet_id}|{tx['date']}|{tx.get('time') or ''}|{tx.get('total')}|{items}|{tx.get('channel')}"
    return hashlib.sha1(key.encode()).hexdigest()


async def _load_recipe(signature: str, target: str) -> Optional[dict]:
    return await get_db().import_recipes.find_one({"signature": signature, "target": target, "deleted_at": None}, {"_id": 0})


async def create_batch(user: dict, *, attachment_id: str, target: Optional[str] = None, options: Optional[dict] = None,
                       use_ai: bool = True) -> dict:
    _need(user, "import.smart.use")
    data, meta = await _file_bytes(attachment_id, user)
    sha = hashlib.sha256(data).hexdigest()
    prof = engine.profile(data, meta.get("filename") or "file", target=target)
    recipe = await _load_recipe(prof["signature"], prof["target"])
    by = "kamus"
    if recipe:
        _apply_mapping(prof, recipe.get("mapping") or {}, by="resep")
        by = "resep"
    elif use_ai and (mp.missing_required(prof["target"], prof["mapping"]) or
                     sum(1 for m in prof["mapping"] if m["field"] and m["confidence"] < 0.7) >= 2 or
                     sum(1 for m in prof["mapping"] if not m["field"]) > len(prof["mapping"]) / 2):
        ai = await mp.ai_map(prof["target"], prof["table"].headers, prof["types"], prof["table"].rows[:20], prof["mapping"], user["id"])
        if ai:
            prof["mapping"] = [{k: v for k, v in m.items() if k != "_ai"} for m in ai]
            by = "ai"
    dup = await get_db().import_batches.find_one({"sha256": sha, "status": "committed", "user_id": {"$exists": True}},
                                                 {"_id": 0, "id": 1, "committed_at": 1, "filename": 1})
    batch = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "status": "draft", "target": prof["target"],
        "attachment_id": attachment_id, "filename": meta.get("filename"), "sha256": sha, "size": len(data),
        "sheet": prof["sheet"], "sheets": prof["sheets"], "header_row": prof["table"].header_row,
        "signature": prof["signature"], "source": (recipe or {}).get("source") or prof["source"], "mapping_by": by,
        "recipe_id": (recipe or {}).get("id"), "mapping": {str(i): m for i, m in enumerate(prof["mapping"])},
        "options": {**((recipe or {}).get("options") or {}), **(options or {})},
        "value_maps": (recipe or {}).get("value_maps") or {}, "duplicate_file_of": dup,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
    }
    await get_db().import_batches.insert_one(batch)
    return await view(batch["id"], user)


def _apply_mapping(prof: dict, mapping: dict, by: str) -> None:
    """mapping: {nama_kolom_atau_index: field|None}."""
    headers = prof["table"].headers
    for k, f in mapping.items():
        idx = int(k) if str(k).isdigit() and int(k) < len(headers) else (headers.index(k) if k in headers else None)
        if idx is None:
            continue
        if f:
            for m in prof["mapping"]:
                if m.get("field") == f:
                    m.update({"field": None, "confidence": 0.0, "by": None})
        prof["mapping"][idx] = {"field": f or None, "confidence": 1.0 if f else 0.0, "by": by}


async def _get(batch_id: str, user: dict) -> dict:
    b = await get_db().import_batches.find_one({"id": batch_id, "deleted_at": None}, {"_id": 0})
    if not b or (b["user_id"] != user["id"] and "*" not in _perms(user)):
        raise NotFoundError("Batch impor")
    return b


async def _materialize(b: dict, user: dict) -> tuple[dict, dict]:
    data, meta = await _file_bytes(b["attachment_id"], user)
    prof = engine.profile(data, b.get("filename") or "file", target=b["target"], sheet=b.get("sheet"),
                          header_row=b.get("header_row"))
    prof["mapping"] = [b["mapping"].get(str(i), {"field": None, "confidence": 0, "by": None}) for i in range(len(prof["table"].headers))]
    prof["source"] = b.get("source")
    ex = engine.extract(prof, options=b.get("options") or {})
    return prof, ex


async def update_batch(batch_id: str, user: dict, *, mapping: Optional[dict] = None, options: Optional[dict] = None,
                       value_maps: Optional[dict] = None, sheet: Optional[str] = None, header_row: Optional[int] = None,
                       target: Optional[str] = None, source: Optional[str] = None) -> dict:
    b = await _get(batch_id, user)
    if b["status"] != "draft":
        raise ValidationError("Batch sudah diimpor/dibatalkan — buat batch baru")
    upd: dict = {"updated_at": _now()}
    if sheet or header_row or target:
        data, meta = await _file_bytes(b["attachment_id"], user)
        prof = engine.profile(data, b.get("filename") or "file", target=target or b["target"], sheet=sheet or b.get("sheet"),
                              header_row=header_row)
        upd.update({"sheet": prof["sheet"], "header_row": prof["table"].header_row, "target": prof["target"],
                    "signature": prof["signature"], "mapping": {str(i): m for i, m in enumerate(prof["mapping"])}})
        b.update(upd)
    if mapping:
        data, meta = await _file_bytes(b["attachment_id"], user)
        prof = engine.profile(data, b.get("filename") or "file", target=b["target"], sheet=b.get("sheet"), header_row=b.get("header_row"))
        prof["mapping"] = [b["mapping"].get(str(i), {"field": None, "confidence": 0, "by": None}) for i in range(len(prof["table"].headers))]
        _apply_mapping(prof, mapping, by="pengguna")
        upd["mapping"] = {str(i): m for i, m in enumerate(prof["mapping"])}
    if options is not None:
        upd["options"] = {**(b.get("options") or {}), **options}
    if value_maps:
        vm = b.get("value_maps") or {}
        for kind, pairs in value_maps.items():
            vm[kind] = {**(vm.get(kind) or {}), **(pairs or {})}
        upd["value_maps"] = vm
    if source is not None:
        upd["source"] = source or None
    await get_db().import_batches.update_one({"id": batch_id}, {"$set": upd})
    return await view(batch_id, user)


async def _resolve(b: dict, ex: dict, user: dict, *, exclude_batch: Optional[str] = None) -> dict:
    """Pemetaan nilai (toko, metode bayar) + cek duplikasi + rekap per toko/hari. Tidak menulis apa pun."""
    db = get_db()
    opts = b.get("options") or {}
    vm = b.get("value_maps") or {}
    outlets = await _outlets(user)
    methods = await _payment_methods()
    out_map: dict[str, Optional[str]] = {}
    pay_map: dict[str, Optional[str]] = {}
    issues = list(ex["issues"])
    txs = ex["transactions"]
    for raw in sorted({t["outlet_raw"] for t in txs}):
        if raw:
            out_map[raw] = (vm.get("outlet") or {}).get(raw) or match_outlet(raw, outlets)
        else:   # file tanpa kolom/kop toko → toko dari opsi (atau konteks TopNav saat membuat batch)
            out_map[raw] = (vm.get("outlet") or {}).get("") or opts.get("outlet_id")
    # Pesanan aplikasi delivery tanpa kolom bayar → dibayar lewat platform (piutang marketplace, cair sebagai payout)
    for t in txs:
        if not t["payment_raw"] and t["channel"] in DELIVERY and not t["wide_payments"]:
            t["payment_raw"] = t["channel"]
    raws_pay = {t["payment_raw"] for t in txs if t["payment_raw"]} | {k for t in txs for k in t["wide_payments"]}
    auto_new = []
    for raw in sorted(raws_pay):
        pay_map[raw] = (vm.get("payment") or {}).get(raw) or match_payment(raw, methods)
        plat = engine.canonical_channel(raw)
        if not pay_map[raw] and plat in DELIVERY:
            pay_map[raw] = f"auto:{plat}"          # dibuat saat impor: metode bayar tipe marketplace
            auto_new.append(plat)
    if auto_new:
        issues.append({"level": "info", "row": None, "pesan": f"Metode bayar {', '.join(sorted(set(auto_new)))} (tipe marketplace → "
                                                              "Piutang Marketplace) akan dibuat otomatis saat impor"})
    allowed = {o["id"] for o in outlets}
    unmapped_out = [r or "(tanpa kolom toko)" for r, v in out_map.items() if not v or v not in allowed]
    if unmapped_out:
        issues.append({"level": "error", "row": None, "pesan": f"Toko belum dipetakan / di luar akses Anda: {', '.join(unmapped_out[:6])}"})
    unmapped_pay = [r for r, v in pay_map.items() if not v]
    if unmapped_pay:
        issues.append({"level": "warning", "row": None, "pesan": f"Metode bayar belum dipetakan (tidak masuk rincian pembayaran): {', '.join(unmapped_pay[:8])}"})

    # format lebar: nominal per kolom channel / metode bayar → rincian per transaksi (disimpan & dipakai rekap)
    for t in txs:
        t["channel_split"] = dict(t.get("wide_channels") or {})
        split: dict[str, float] = defaultdict(float)
        for raw, amt in (t.get("wide_payments") or {}).items():
            if pay_map.get(raw):
                split[pay_map[raw]] += amt
        t["payment_split"] = dict(split)

    # lapis 2 & 4: transaksi yang sudah ada
    by_fp: dict[str, dict] = {}
    for t in txs:
        oid = out_map.get(t["outlet_raw"])
        t["outlet_id"] = oid if oid in allowed else None
        t["payment_method_id"] = pay_map.get(t["payment_raw"]) if t["payment_raw"] else None
        t["fingerprint"] = _fp_tx(t["outlet_id"] or "", t) if t["outlet_id"] else None
        t["dup"] = None
        if t["fingerprint"]:
            if t["fingerprint"] in by_fp:
                t["dup"] = "baris ganda di file"
            by_fp.setdefault(t["fingerprint"], t)
    fps = [f for f in by_fp if f]
    own = {"batch_id": {"$ne": exclude_batch}} if exclude_batch else {}
    existing = {r["fingerprint"]: r async for r in db.sales_transactions.find(
        {"fingerprint": {"$in": fps}, "deleted_at": None, **own}, {"_id": 0, "fingerprint": 1, "batch_id": 1, "source": 1})} if fps else {}
    for t in txs:
        if t["fingerprint"] in existing and not t["dup"]:
            t["dup"] = "sudah diimpor"
    deliveries = [t for t in txs if not t["dup"] and t["channel"] in DELIVERY and t["outlet_id"]]
    if deliveries:
        days = {(t["outlet_id"], t["business_date"]) for t in deliveries}
        others = await db.sales_transactions.find(
            {"$or": [{"outlet_id": o, "business_date": d} for o, d in days], "deleted_at": None,
             "source": {"$ne": b.get("source")}, "channel": {"$in": list(DELIVERY)}, **own},
            {"_id": 0, "outlet_id": 1, "business_date": 1, "time": 1, "total": 1, "net": 1, "receipt_no": 1, "source": 1, "channel": 1}).to_list(20000)
        for t in deliveries:
            for o in others:
                if o["outlet_id"] != t["outlet_id"] or o["business_date"] != t["business_date"] or o["channel"] != t["channel"]:
                    continue
                same_ref = t.get("receipt_no") and o.get("receipt_no") and _norm(t["receipt_no"]) in _norm(o["receipt_no"])
                close = abs(_minutes(o.get("time")) - _minutes(t.get("time"))) <= 20 if o.get("time") and t.get("time") else False
                amt = abs((o.get("net") or 0) - (t.get("net") or 0)) <= max(1.0, 0.01 * abs(t.get("net") or 0))
                if same_ref or (close and amt):
                    t["dup"] = f"kemungkinan ganda dengan {o.get('source') or 'sumber lain'} {o.get('receipt_no') or ''}".strip()
                    break

    # rekap per toko/hari + lapis 3 (Daily Sales yang sudah ada)
    groups: dict[tuple, list] = defaultdict(list)
    for t in txs:
        if t["outlet_id"] and not t["void"]:
            groups[(t["outlet_id"], t["business_date"])].append(t)
    days = []
    for (oid, d), items in sorted(groups.items(), key=lambda x: (x[0][1], x[0][0])):
        fresh = [t for t in items if not t["dup"]]
        ds = await db.daily_sales.find_one({"outlet_id": oid, "sales_date": d, "deleted_at": None}, {"_id": 0})
        recap = build_recap(fresh, opts)
        verdict, reason = _classify(ds, recap, fresh)
        act = (opts.get("day_actions") or {}).get(f"{oid}|{d}") or {"baru": "create", "sama": "skip", "ganti": "replace",
                                                                     "gabung": "merge", "konflik": "skip", "terkunci": "skip",
                                                                     "kosong": "skip"}[verdict]
        days.append({"outlet_id": oid, "outlet": next((o["name"] for o in outlets if o["id"] == oid), oid), "date": d,
                     "transaksi": len(fresh), "duplikat": len(items) - len(fresh), "net": recap["net"],
                     "grand_total": recap["grand_total"], "bayar": recap["paid"], "verdict": verdict, "alasan": reason,
                     "action": act, "existing": ({"id": ds["id"], "status": ds["status"], "grand_total": ds.get("grand_total"),
                                                  "import_managed": bool(ds.get("import_managed"))} if ds else None)})
        if recap["paid"] and abs(recap["paid"] - recap["grand_total"]) > max(1000, 0.01 * recap["grand_total"]):
            issues.append({"level": "warning", "row": None, "pesan": f"{d} {days[-1]['outlet']}: total pembayaran {_rp(recap['paid'])} ≠ "
                                                                     f"grand total {_rp(recap['grand_total'])}"})
    dup_count = sum(1 for t in txs if t["dup"])
    if dup_count:
        issues.append({"level": "info", "row": None, "pesan": f"{dup_count} transaksi duplikat/kemungkinan ganda tidak akan dihitung"})
    return {"out_map": out_map, "pay_map": pay_map, "days": days, "issues": issues, "outlets": outlets, "methods": methods}


def _minutes(t: Optional[str]) -> int:
    if not t:
        return 0
    h, m = t.split(":")[:2]
    return int(h) * 60 + int(m)


def build_recap(txs: list[dict], opts: dict) -> dict:
    """Transaksi satu toko/hari → payload Daily Sales (channel, pembayaran, bucket food/beverage, SC, pajak)."""
    ch: dict[str, dict] = defaultdict(lambda: {"gross": 0.0, "discount": 0.0, "net": 0.0})
    pay: dict[str, float] = defaultdict(float)
    buckets: dict[str, float] = defaultdict(float)
    sc = tax = net = 0.0
    count = 0
    for t in txs:
        split_ch = t.get("channel_split") or {}
        if split_ch:
            for name, amt in split_ch.items():
                ch[name]["gross"] += amt
                ch[name]["net"] += amt
        else:
            c = ch[t["channel"]]
            c["gross"] += t.get("gross") or 0
            c["discount"] += t.get("discount") or 0
            c["net"] += t.get("net") or 0
        for pid, amt in (t.get("payment_split") or {}).items():
            pay[pid] += amt
        if t.get("payment_method_id"):
            pay[t["payment_method_id"]] += t.get("total") or 0
        tnet = t.get("net") or 0
        net += tnet
        sc += t.get("service_charge") or 0
        tax += t.get("tax") or 0
        count += int(t["trx_count"]) if t.get("trx_count") else 1
        items = t.get("items") or []
        base = sum(abs(i["amount"] or 0) for i in items)
        if items and base:
            for i in items:
                buckets[engine.bucket_of(i["name"], i.get("category") or "")] += tnet * abs(i["amount"] or 0) / base
        else:
            buckets[opts.get("default_bucket") or "food"] += tnet
    gt = round(net + sc + tax, 2)
    return {"net": round(net, 2), "grand_total": gt, "paid": round(sum(pay.values()), 2), "transaction_count": count,
            "channels": [{"channel": k, "gross": round(v["gross"], 2), "discount": round(v["discount"], 2), "net": round(v["net"], 2)}
                         for k, v in ch.items()],
            "payment_breakdown": [{"payment_method_id": k, "amount": round(v, 2)} for k, v in pay.items() if v],
            "revenue_buckets": [{"bucket": k, "amount": round(v, 2)} for k, v in buckets.items() if v],
            "service_charge": round(sc, 2), "tax_amount": round(tax, 2)}


def _classify(ds: Optional[dict], recap: dict, fresh: list[dict]) -> tuple[str, str]:
    if not fresh:
        return "kosong", "Semua transaksi hari ini sudah ada (duplikat)"
    if not ds:
        return "baru", "Belum ada Daily Sales tanggal ini"
    same = abs((ds.get("grand_total") or 0) - recap["grand_total"]) <= max(1.0, 0.001 * recap["grand_total"])
    if ds.get("status") in LOCKED:
        return ("sama", "Sudah ada & sudah disubmit/divalidasi dengan total yang sama") if same else \
            ("terkunci", f"Daily Sales sudah {ds['status']} (total {_rp(ds.get('grand_total'))}) — tidak diubah; "
                         "tolak/buka dulu bila perlu diganti")
    if ds.get("import_managed"):
        return "gabung", "Draf dari impor sebelumnya — dihitung ulang dari semua transaksi tersimpan + file ini"
    old_ch = {c.get("channel") for c in ds.get("channels") or [] if (c.get("net") or c.get("gross"))}
    new_ch = {c["channel"] for c in recap["channels"] if c["net"] or c["gross"]}
    if same:
        return "sama", f"Draf manual dengan total sama ({_rp(ds.get('grand_total'))})"
    if old_ch and new_ch and not (old_ch & new_ch):
        return "gabung", f"Draf manual berisi channel lain ({', '.join(sorted(old_ch))}) — file ini melengkapi ({', '.join(sorted(new_ch))})"
    if (ds.get("grand_total") or 0) < recap["grand_total"] and old_ch <= new_ch:
        return "ganti", f"File ini lebih lengkap ({_rp(recap['grand_total'])} vs draf {_rp(ds.get('grand_total'))})"
    return "konflik", f"Draf manual {_rp(ds.get('grand_total'))} vs file {_rp(recap['grand_total'])} — pilih ganti/gabung/lewati"


async def view(batch_id: str, user: dict) -> dict:
    b = await _get(batch_id, user)
    try:
        prof, ex = await _materialize(b, user)
    except ValidationError as e:
        return {**b, "error": str(e)}
    cols = engine.column_view(prof)
    res: dict[str, Any] = {**b, "columns": cols, "field_options": engine.field_options(b["target"]),
                           "meta": prof["table"].meta, "dropped": prof["table"].dropped, "rows_in_file": len(prof["table"].rows),
                           "missing": mp.missing_required(b["target"], prof["mapping"]), "detected": {
                               "date_order": ex.get("date_order"), "decimal": ex.get("decimal")}}
    if b["target"] == "bank":
        dup = await _bank_dups(b, ex["rows"])
        res.update({"summary": engine.summarize_bank(ex["rows"]), "issues": ex["issues"] + dup["issues"],
                    "preview": ex["rows"][:PREVIEW_TX], "duplicates": dup["count"]})
        return res
    r = await _resolve(b, ex, user, exclude_batch=b["id"] if b["status"] != "draft" else None)
    if b["status"] != "draft":       # tampilkan keputusan saat impor, bukan hitung ulang terhadap data yang kini sudah ada
        done = {(d["outlet_id"], d["date"]): d for d in (b.get("result") or {}).get("days") or []}
        for d in r["days"]:
            st = done.get((d["outlet_id"], d["date"]))
            if st:
                d.update({"verdict": st.get("verdict", d["verdict"]), "action": st.get("action", d["action"]),
                          "alasan": f"{st.get('status')}" + (f" — {st['alasan']}" if st.get("alasan") else "") +
                                    (f" — {st['error']}" if st.get("error") else "")})
    res.update({
        "summary": engine.summarize_sales(ex["transactions"]), "issues": r["issues"], "days": r["days"],
        "value_maps_resolved": {
            "outlet": [{"raw": k, "id": v, "label": next((o["name"] for o in r["outlets"] if o["id"] == v), None)} for k, v in r["out_map"].items()],
            "payment": [{"raw": k, "id": v, "label": next((m["name"] for m in r["methods"] if m["id"] == v), None)} for k, v in r["pay_map"].items()]},
        "choices": {"outlet": [{"value": o["id"], "label": o["name"]} for o in r["outlets"]],
                    "payment": [{"value": m["id"], "label": f"{m['name']} ({m.get('code')})"} for m in r["methods"]]},
        "preview": [_tx_public(t) for t in ex["transactions"][:PREVIEW_TX]],
    })
    return res


def _tx_public(t: dict) -> dict:
    keys = ("receipt_no", "outlet_raw", "date", "time", "business_date", "channel", "payment_raw", "gross", "discount", "net",
            "service_charge", "tax", "total", "commission", "payout", "void", "dup", "rows")
    out = {k: t.get(k) for k in keys}
    out["items"] = len(t.get("items") or [])
    return out


# ---------------------------------------------------------------- commit / rollback

async def commit(batch_id: str, user: dict, *, save_recipe: bool = True, recipe_name: Optional[str] = None) -> dict:
    b = await _get(batch_id, user)
    if b["status"] != "draft":
        raise ValidationError("Batch sudah diimpor/dibatalkan")
    if b.get("duplicate_file_of") and not (b.get("options") or {}).get("allow_duplicate_file"):
        raise ValidationError(f"File yang sama sudah diimpor (batch {b['duplicate_file_of']['id'][:8]}) — "
                              "set opsi allow_duplicate_file bila memang ingin mengimpor lagi")
    db = get_db()
    claimed = await db.import_batches.find_one_and_update({"id": batch_id, "status": "draft"},
                                                          {"$set": {"status": "committing", "updated_at": _now()}})
    if not claimed:
        raise ValidationError("Batch sedang/sudah diproses")
    try:
        prof, ex = await _materialize(b, user)
        miss = mp.missing_required(b["target"], prof["mapping"])
        if miss:
            raise ValidationError(f"Kolom wajib belum dipetakan: {', '.join(miss)}")
        if b["target"] == "bank":
            result = await _commit_bank(b, ex, user)
        else:
            result = await _commit_sales(b, ex, user)
    except Exception:
        await db.import_batches.update_one({"id": batch_id}, {"$set": {"status": "draft", "updated_at": _now()}})
        raise
    await db.import_batches.update_one({"id": batch_id}, {"$set": {"status": "committed", "result": result,
                                                                    "committed_at": _now(), "updated_at": _now()}})
    if save_recipe:
        await _save_recipe(b, prof, user, recipe_name)
    await audit_log(user_id=user["id"], entity_type="import_batch", entity_id=batch_id, action="commit",
                    after={"target": b["target"], "filename": b.get("filename"), **{k: v for k, v in result.items() if not isinstance(v, list)}})
    return {**await _get(batch_id, user), "result": result}


async def _commit_sales(b: dict, ex: dict, user: dict) -> dict:
    _need(user, "outlet.daily_sales.create", "outlet.daily_sales.update")
    from services import outlet_service
    db = get_db()
    r = await _resolve(b, ex, user)
    # simpan detail hanya untuk hari yang diimpor (buat/ganti/gabung) atau yang totalnya sama dengan Daily Sales resmi —
    # hari terkunci/konflik/dilewati tidak menambah detail yang bertentangan dengan angka resmi
    keep_days = {(d["outlet_id"], d["date"]) for d in r["days"] if d["action"] != "skip" or d["verdict"] == "sama"}
    all_ok = [t for t in ex["transactions"] if t.get("outlet_id") and not t["dup"]]
    txs = [t for t in all_ok if (t["outlet_id"], t["business_date"]) in keep_days]
    skipped_days_tx = len(all_ok) - len(txs)
    auto = {v for v in r["pay_map"].values() if v and str(v).startswith("auto:")}
    created: dict[str, str] = {}
    for key in auto:
        plat = key.split(":", 1)[1]
        code = re.sub(r"[^A-Z0-9]", "", plat.upper())[:12]
        ex_m = await db.payment_methods.find_one({"code": code, "deleted_at": None}, {"_id": 0, "id": 1})
        if ex_m:
            created[key] = ex_m["id"]
            continue
        pid = str(uuid.uuid4())
        await db.payment_methods.insert_one({"id": pid, "code": code, "name": plat, "type": "marketplace", "active": True,
                                             "created_at": _now(), "created_by": user["id"], "deleted_at": None,
                                             "notes": "Dibuat otomatis oleh Impor Cerdas (piutang marketplace)"})
        await audit_log(user_id=user["id"], entity_type="payment_method", entity_id=pid, action="create",
                        after={"code": code, "name": plat, "type": "marketplace", "via": "smart_import"})
        created[key] = pid
    for t in txs:
        if t.get("payment_method_id") in created:
            t["payment_method_id"] = created[t["payment_method_id"]]
        if t.get("payment_split"):
            t["payment_split"] = {created.get(k, k): v for k, v in t["payment_split"].items()}
    brand_of = {o["id"]: o.get("brand_id") for o in r["outlets"]}
    menu_cache: dict[tuple, str] = {}
    now = _now()
    tx_docs, line_docs = [], []
    for t in txs:
        tid = str(uuid.uuid4())
        tx_docs.append({
            "id": tid, "batch_id": b["id"], "fingerprint": t["fingerprint"], "source": b.get("source") or "impor",
            "outlet_id": t["outlet_id"], "brand_id": brand_of.get(t["outlet_id"]), "date": t["date"], "time": t.get("time"),
            "business_date": t["business_date"], "receipt_no": t.get("receipt_no"), "channel": t["channel"],
            "payment_raw": t.get("payment_raw") or None, "payment_method_id": t.get("payment_method_id"),
            **{k: t.get(k) for k in ("gross", "discount", "net", "service_charge", "tax", "total", "refund", "commission", "payout")},
            "void": t["void"], "status_raw": t.get("status") or None, "customer": t.get("customer"), "cashier": t.get("cashier"),
            "trx_count": t.get("trx_count"), "item_count": len(t.get("items") or []),
            "channel_split": t.get("channel_split") or None, "payment_split": t.get("payment_split") or None,
            "created_at": now, "created_by": user["id"], "deleted_at": None})
        for it in t.get("items") or []:
            mid = await _menu_item(menu_cache, brand_of.get(t["outlet_id"]), it, b.get("source"), user)
            line_docs.append({"id": str(uuid.uuid4()), "transaction_id": tid, "batch_id": b["id"], "outlet_id": t["outlet_id"],
                              "brand_id": brand_of.get(t["outlet_id"]), "business_date": t["business_date"],
                              "channel": t["channel"], "menu_item_id": mid, "name": it["name"], "variant": it.get("variant"),
                              "category": it.get("category"), "bucket": engine.bucket_of(it["name"], it.get("category") or ""),
                              "qty": it["qty"], "price": it.get("price"), "amount": it["amount"], "void": t["void"],
                              "created_at": now, "deleted_at": None})
    if tx_docs:
        await db.sales_transactions.insert_many(tx_docs)
    if line_docs:
        await db.sales_lines.insert_many(line_docs)
    days_out = []
    for day in r["days"]:
        res = {"outlet_id": day["outlet_id"], "date": day["date"], "verdict": day["verdict"], "action": day["action"]}
        try:
            res.update(await _apply_day(b, day, user, outlet_service))
        except Exception as e:  # noqa: BLE001 — satu hari gagal tidak membatalkan hari lain
            res.update({"status": "gagal", "error": str(e)[:300]})
        days_out.append(res)
    return {"transactions": len(tx_docs), "lines": len(line_docs), "skipped_duplicates": sum(1 for t in ex["transactions"] if t["dup"]),
            "skipped_day_transactions": skipped_days_tx,
            "void": sum(1 for t in txs if t["void"]), "menu_items_created": sum(1 for v in menu_cache.values() if v.startswith("new:")),
            "days": days_out}


async def _menu_item(cache: dict, brand_id: Optional[str], it: dict, source: Optional[str], user: dict) -> Optional[str]:
    """Cocokkan nama item ke master menu (nama/alias per brand); belum ada → buat otomatis (perlu ditinjau)."""
    key = (brand_id, _norm(it["name"]))
    if key in cache:
        return cache[key].removeprefix("new:")
    db = get_db()
    doc = await db.menu_items.find_one({"brand_id": brand_id, "deleted_at": None,
                                        "$or": [{"name_norm": key[1]}, {"aliases.name_norm": key[1]}]}, {"_id": 0, "id": 1})
    if doc:
        cache[key] = doc["id"]
        return doc["id"]
    mid = str(uuid.uuid4())
    await db.menu_items.insert_one({
        "id": mid, "brand_id": brand_id, "name": it["name"], "name_norm": key[1], "category": it.get("category"),
        "bucket": engine.bucket_of(it["name"], it.get("category") or ""), "price": it.get("price"), "active": True,
        "aliases": [{"source": source or "impor", "name": it["name"], "name_norm": key[1]}], "origin": "import",
        "needs_review": True, "created_at": _now(), "created_by": user["id"], "deleted_at": None})
    cache[key] = f"new:{mid}"
    return mid


async def _apply_day(b: dict, day: dict, user: dict, outlet_service) -> dict:
    db = get_db()
    act = day["action"]
    if act == "skip":
        return {"status": "dilewati", "alasan": day["alasan"]}
    oid, d = day["outlet_id"], day["date"]
    existing = await db.daily_sales.find_one({"outlet_id": oid, "sales_date": d, "deleted_at": None}, {"_id": 0})
    if existing and existing.get("status") in LOCKED:
        return {"status": "dilewati", "alasan": f"Daily Sales sudah {existing['status']}"}
    # rekap dari SEMUA transaksi tersimpan untuk toko/hari ini (impor sebelumnya + file ini)
    rows = await db.sales_transactions.find({"outlet_id": oid, "business_date": d, "void": False, "deleted_at": None},
                                            {"_id": 0}).to_list(100000)
    await _attach_items(rows)
    recap = build_recap(rows, b.get("options") or {})
    if act == "merge" and existing and not existing.get("import_managed"):
        recap = _merge(existing, recap)
    payload = {"outlet_id": oid, "sales_date": d, **{k: recap[k] for k in ("channels", "payment_breakdown", "revenue_buckets",
                                                                            "service_charge", "tax_amount", "transaction_count")},
               "notes": f"Impor: {b.get('filename')} ({b.get('source') or 'file'})"}
    before = {k: existing.get(k) for k in ("channels", "payment_breakdown", "revenue_buckets", "service_charge", "tax_amount",
                                           "transaction_count", "notes", "import_managed")} if existing else None
    doc = await outlet_service.upsert_daily_sales_draft(payload, user=user)
    await db.daily_sales.update_one({"id": doc["id"]}, {"$set": {"import_managed": True}, "$addToSet": {"import_batch_ids": b["id"]}})
    return {"status": "diperbarui" if existing else "dibuat", "daily_sales_id": doc["id"], "grand_total": doc.get("grand_total"),
            "before": before}


async def _attach_items(rows: list[dict]) -> None:
    ids = [t["id"] for t in rows if t.get("item_count")]
    by_tx: dict[str, list] = defaultdict(list)
    if ids:
        async for ln in get_db().sales_lines.find({"transaction_id": {"$in": ids}, "deleted_at": None},
                                                  {"_id": 0, "transaction_id": 1, "name": 1, "category": 1, "amount": 1}):
            by_tx[ln["transaction_id"]].append(ln)
    for t in rows:
        t["items"] = by_tx.get(t["id"], [])


def _merge(existing: dict, recap: dict) -> dict:
    out = dict(recap)
    ch = {c["channel"]: dict(c) for c in existing.get("channels") or []}
    for c in recap["channels"]:
        cur = ch.setdefault(c["channel"], {"channel": c["channel"], "gross": 0, "discount": 0, "net": 0})
        for k in ("gross", "discount", "net"):
            cur[k] = round((cur.get(k) or 0) + c[k], 2)
    out["channels"] = list(ch.values())
    pay = defaultdict(float)
    for p in (existing.get("payment_breakdown") or []) + recap["payment_breakdown"]:
        if p.get("payment_method_id"):
            pay[p["payment_method_id"]] += float(p.get("amount") or 0)
    out["payment_breakdown"] = [{"payment_method_id": k, "amount": round(v, 2)} for k, v in pay.items()]
    bk = defaultdict(float)
    for x in (existing.get("revenue_buckets") or []) + recap["revenue_buckets"]:
        bk[x.get("bucket") or "other"] += float(x.get("amount") or 0)
    out["revenue_buckets"] = [{"bucket": k, "amount": round(v, 2)} for k, v in bk.items()]
    for k in ("service_charge", "tax_amount", "transaction_count"):
        out[k] = (existing.get(k) or 0) + recap[k]
    return out


async def rollback(batch_id: str, user: dict) -> dict:
    b = await _get(batch_id, user)
    if b["status"] != "committed":
        raise ValidationError("Hanya batch yang sudah diimpor yang bisa dibatalkan")
    db = get_db()
    now = _now()
    out: dict = {"days": []}
    if b["target"] == "bank":
        sid = (b.get("result") or {}).get("session_id")
        s = await db.bank_recon_sessions.find_one({"id": sid}) if sid else None
        if s and s.get("status") == "committed":
            raise ValidationError("Sesi rekonsiliasi sudah di-commit — batalkan commit rekonsiliasinya dulu")
        if s:
            await db.bank_recon_sessions.update_one({"id": sid}, {"$set": {"deleted_at": now}})
    else:
        from services import outlet_service
        await db.sales_transactions.update_many({"batch_id": batch_id, "deleted_at": None}, {"$set": {"deleted_at": now}})
        await db.sales_lines.update_many({"batch_id": batch_id, "deleted_at": None}, {"$set": {"deleted_at": now}})
        for day in (b.get("result") or {}).get("days") or []:
            if not day.get("daily_sales_id"):
                continue
            ds = await db.daily_sales.find_one({"id": day["daily_sales_id"], "deleted_at": None}, {"_id": 0})
            if not ds:
                continue
            if ds.get("status") in LOCKED:
                out["days"].append({**day, "rollback": f"tidak diubah — sudah {ds['status']}"})
                continue
            left = await db.sales_transactions.find({"outlet_id": ds["outlet_id"], "business_date": ds["sales_date"], "void": False,
                                                     "deleted_at": None}, {"_id": 0}).to_list(100000)
            if left:
                await _attach_items(left)
                recap = build_recap(left, b.get("options") or {})
                await outlet_service.upsert_daily_sales_draft({"outlet_id": ds["outlet_id"], "sales_date": ds["sales_date"],
                                                               **{k: recap[k] for k in ("channels", "payment_breakdown", "revenue_buckets",
                                                                                         "service_charge", "tax_amount", "transaction_count")}},
                                                              user=user)
                out["days"].append({**day, "rollback": "dihitung ulang dari transaksi tersisa"})
            elif day.get("before"):
                prev = day["before"]
                await outlet_service.upsert_daily_sales_draft({"outlet_id": ds["outlet_id"], "sales_date": ds["sales_date"],
                                                               **{k: prev.get(k) for k in ("channels", "payment_breakdown", "revenue_buckets",
                                                                                            "service_charge", "tax_amount", "transaction_count", "notes")
                                                                  if prev.get(k) is not None}}, user=user)
                await db.daily_sales.update_one({"id": ds["id"]}, {"$set": {"import_managed": bool(prev.get("import_managed"))}})
                out["days"].append({**day, "rollback": "dikembalikan ke isi sebelum impor"})
            else:
                await db.daily_sales.update_one({"id": ds["id"], "status": {"$in": ["draft", "rejected"]}}, {"$set": {"deleted_at": now}})
                out["days"].append({**day, "rollback": "draf dari impor dihapus"})
    await db.import_batches.update_one({"id": batch_id}, {"$set": {"status": "rolled_back", "rolled_back_at": now,
                                                                    "rollback": out, "updated_at": now}})
    await audit_log(user_id=user["id"], entity_type="import_batch", entity_id=batch_id, action="rollback", after=out)
    return {**await _get(batch_id, user)}


# ---------------------------------------------------------------- bank

def _bank_fp(account: str, r: dict) -> str:
    return hashlib.sha1(f"{account}|{r['date']}|{r['amount']}|{_norm(r['description'])[:80]}|{r.get('reference') or ''}".encode()).hexdigest()


async def _bank_dups(b: dict, rows: list[dict]) -> dict:
    acc = (b.get("options") or {}).get("bank_account_id")
    issues = []
    if not acc:
        issues.append({"level": "error", "row": None, "pesan": "Pilih rekening bank (opsi bank_account_id) sebelum impor"})
        return {"count": 0, "issues": issues}
    fps = {_bank_fp(acc, r) for r in rows}
    seen = set()
    async for s in get_db().bank_recon_sessions.find({"bank_account_id": acc, "deleted_at": None}, {"rows": 1}):
        for r in s.get("rows") or []:
            if r.get("fingerprint") in fps:
                seen.add(r["fingerprint"])
    if seen:
        issues.append({"level": "info", "row": None, "pesan": f"{len(seen)} baris mutasi sudah pernah diimpor — dilewati"})
    return {"count": len(seen), "issues": issues, "seen": seen}


async def _commit_bank(b: dict, ex: dict, user: dict) -> dict:
    _need(user, "finance.bank_reconciliation")
    from services._bank_recon.session import create_session_from_rows
    acc = (b.get("options") or {}).get("bank_account_id")
    if not acc:
        raise ValidationError("Pilih rekening bank (opsi bank_account_id)")
    dups = await _bank_dups(b, ex["rows"])
    rows = []
    for r in ex["rows"]:
        fp = _bank_fp(acc, r)
        if fp in dups.get("seen", set()):
            continue
        rows.append({"id": str(uuid.uuid4()), "date": r["date"], "description": r["description"], "amount": r["amount"],
                     "reference": r.get("reference"), "balance": r.get("balance"), "fingerprint": fp,
                     "matched": False, "match_type": None, "match_target_type": None, "match_target_id": None,
                     "match_target_doc_no": None, "match_confidence": None, "match_reason": None})
    if not rows:
        raise ValidationError("Semua baris mutasi sudah pernah diimpor")
    s = await create_session_from_rows(bank_account_id=acc, filename=b.get("filename") or "mutasi", rows=rows, user=user)
    return {"session_id": s["id"], "rows": len(rows), "skipped_duplicates": dups["count"]}


# ---------------------------------------------------------------- resep

async def _save_recipe(b: dict, prof: dict, user: dict, name: Optional[str]) -> None:
    db = get_db()
    mapping = {h: prof["mapping"][i].get("field") for i, h in enumerate(prof["table"].headers) if prof["mapping"][i].get("field")}
    keep_opts = {k: v for k, v in (b.get("options") or {}).items() if k in ("outlet_id", "channel", "date_order", "decimal",
                                                                             "cutoff_hour", "default_bucket", "bank_account_id")}
    doc = {"signature": b["signature"], "target": b["target"], "mapping": mapping, "options": keep_opts,
           "value_maps": b.get("value_maps") or {}, "source": b.get("source"), "updated_at": _now(), "updated_by": user["id"]}
    existing = await db.import_recipes.find_one({"signature": b["signature"], "target": b["target"], "deleted_at": None})
    if existing:
        await db.import_recipes.update_one({"id": existing["id"]}, {"$set": doc, "$inc": {"uses": 1}})
    else:
        await db.import_recipes.insert_one({"id": str(uuid.uuid4()), "name": name or f"{b.get('source') or 'Sumber'} — {b.get('filename')}",
                                            **doc, "uses": 1, "created_at": _now(), "created_by": user["id"], "deleted_at": None})


async def list_recipes(user: dict) -> list[dict]:
    _need(user, "import.smart.use")
    return await get_db().import_recipes.find({"deleted_at": None}, {"_id": 0}).sort("updated_at", -1).to_list(200)


async def delete_recipe(recipe_id: str, user: dict) -> None:
    _need(user, "import.smart.use")
    await get_db().import_recipes.update_one({"id": recipe_id}, {"$set": {"deleted_at": _now()}})


async def list_batches(user: dict, limit: int = 50) -> list[dict]:
    _need(user, "import.smart.use")
    q: dict = {"deleted_at": None}
    if "*" not in _perms(user):
        q["user_id"] = user["id"]
    return await get_db().import_batches.find(q, {"_id": 0, "mapping": 0}).sort("created_at", -1).limit(limit).to_list(limit)
