"""Impor Cerdas — target data selain penjualan & mutasi bank.

Target: master item, supplier, pelanggan AR, pembelian historis, hasil opname, saldo awal migrasi (GL / hutang / piutang /
stok) dan budget. Alurnya sama dengan penjualan: kolom dipetakan dari NAMA + ISI (mapping.py), nilai referensi
(toko, supplier, item, akun) dicocokkan otomatis dengan kemiripan nama/kode dan bisa dikoreksi (value_maps), pratinjau per
baris berstatus (baru / ubah / mirip / duplikat / galat) → commit lewat aturan layanan yang ada → rollback.

Opsi batch (options): opening_date (saldo awal; default akhir bulan lalu), post_gl (saldo awal → jurnal, default true),
purchase_mode ("riwayat" = simpan riwayat harga & analisis tanpa stok/GL | "posting" = buat GR sungguhan),
outlet_id (default toko bila file tanpa kolom toko), similar_action ("lewati" | "baru") untuk nama mirip.
"""
from __future__ import annotations

import re
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from core.db import get_db
from core.exceptions import ValidationError

from . import mapping as mp
from .parsing import clean_text, is_blank, parse_date, parse_number

PREVIEW = 200
PERMS = {"items": ("admin.master_data.manage",), "vendors": ("admin.master_data.manage",), "customers": ("finance.ar.create", "admin.master_data.manage"),
         "purchases": ("procurement.po.create", "procurement.gr.create"), "opname": ("inventory.opname.start",),
         "opening_gl": ("finance.journal_entry.create",), "opening_ap": ("finance.journal_entry.create",),
         "opening_ar": ("finance.journal_entry.create", "finance.ar.create"), "opening_stock": ("inventory.adjustment.create", "finance.journal_entry.create"),
         "budget": ("finance.budget.create",)}
UNIT_ALIASES = {"gram": "g", "gr": "g", "grm": "g", "kilogram": "kg", "kilo": "kg", "liter": "l", "litre": "l", "lt": "l", "ltr": "l",
                "mililiter": "ml", "pieces": "pcs", "piece": "pcs", "pc": "pcs", "buah": "pcs", "bh": "pcs", "biji": "pcs", "butir": "pcs",
                "botol": "btl", "bottle": "btl", "kaleng": "klg", "bungkus": "pack", "pak": "pack", "pck": "pack", "karton": "dus", "box": "dus"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rp(v: float) -> str:
    return f"Rp {v:,.0f}".replace(",", ".")


def _unit(u: Any) -> Optional[str]:
    s = clean_text(u).lower().strip(". ")
    return UNIT_ALIASES.get(s, s) or None


def _key(s: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", clean_text(s).lower())


def _need(user: dict, target: str) -> None:
    perms = set(user.get("permissions") or [])
    if "*" in perms:
        return
    if not any(p in perms for p in PERMS[target]):
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Impor {mp.TARGET_LABELS[target]} butuh izin: {' / '.join(PERMS[target])}")


# ───────────────────────────── ekstraksi ─────────────────────────────

NUMERIC = {"cost", "min_stock", "qty", "unit_cost", "total", "counted_qty", "debit", "credit", "balance", "amount", "credit_limit",
           "payment_terms_days"}
DATES = {"date", "due_date"}


def extract(prof: dict, fields: dict[str, int], order: str, yh: int, decimal: str, opts: dict) -> dict:
    tbl = prof["table"]
    rows, issues = [], []
    for ri, r in enumerate(tbl.rows):
        if all(is_blank(c) for c in r):
            continue
        rec: dict[str, Any] = {"_row": tbl.header_row + 1 + ri + 1}
        for f, ci in fields.items():
            v = r[ci] if ci < len(r) else None
            if f in NUMERIC:
                rec[f] = parse_number(v, decimal=decimal) if not is_blank(v) else None
            elif f in DATES:
                d = parse_date(v, order=order, year_hint=yh) if not is_blank(v) else None
                rec[f] = d.isoformat() if isinstance(d, (date, datetime)) else None
            elif f == "period":
                d = parse_date(v, order=order, year_hint=yh) if not is_blank(v) else None
                m = re.search(r"(20\d{2})[-/.](\d{1,2})", clean_text(v))
                rec[f] = d.strftime("%Y-%m") if isinstance(d, (date, datetime)) else (f"{m.group(1)}-{int(m.group(2)):02d}" if m else None)
            else:
                rec[f] = clean_text(v) or None
        if len([k for k in rec if k != "_row" and rec[k] not in (None, "")]) == 0:
            continue
        rows.append(rec)
    if not rows:
        issues.append({"level": "error", "pesan": "Tidak ada baris data yang terbaca"})
    return {"records": rows, "issues": issues, "date_order": order, "decimal": decimal}


# ───────────────────────────── referensi ─────────────────────────────

class Refs:
    """Pencocokan nama/kode → id (dengan value_maps dari pengguna)."""

    def __init__(self, kind: str, docs: list[dict], name_key: str = "name", vm: Optional[dict] = None):
        from services.ai_steward.duplicates import compact, norm_name, similarity
        self.kind, self.docs, self.vm = kind, docs, vm or {}
        self._sim, self._norm, self._compact = similarity, norm_name, compact
        self.by_code = {_key(d.get("code")): d for d in docs if d.get("code")}
        self.by_name = {_key(d.get(name_key)): d for d in docs if d.get(name_key)}
        self.name_key = name_key
        ent = "vendors" if kind in ("vendor", "customer") else "items"     # buang PT/CV/UD untuk nama badan usaha
        self.normed = [(self._norm(d.get(name_key), ent), self._compact(d.get(name_key), ent), d) for d in docs if d.get(name_key)]
        self.ent = ent

    def match(self, name: Any = None, code: Any = None, threshold: float = 0.86) -> tuple[Optional[dict], float, str]:
        raw = clean_text(name or code)
        if raw in self.vm:
            v = self.vm[raw]
            d = next((x for x in self.docs if x["id"] == v), None)
            return (d, 1.0, "dipilih") if d else (None, 0.0, "baru" if v == "__new__" else "lewati" if v == "__skip__" else "")
        if code and _key(code) in self.by_code:
            return self.by_code[_key(code)], 1.0, "kode"
        if name and _key(name) in self.by_name:
            return self.by_name[_key(name)], 1.0, "nama"
        if not name:
            return None, 0.0, ""
        n, c = self._norm(name, self.ent), self._compact(name, self.ent)
        best, sc = None, 0.0
        toks = set(n.split())
        for nn, cc, d in self.normed:
            s = max(self._sim(n, nn), self._sim(c, cc))
            other = set(nn.split())
            if self.ent == "vendors" and len(toks) >= 2 and len(other) >= 2 and (toks <= other or other <= toks):
                s = max(s, 0.9)               # badan usaha: "Mitra Boga" ⊂ "Mitra Boga Nusantara" → kemungkinan sama
                                              # (item tidak: "Bawang Putih Kupas" ≠ "Bawang Putih")
            if s > sc:
                best, sc = d, s
        if best and sc >= 0.999:
            return best, sc, "nama"          # sama setelah dinormalisasi (mis. "CV Sumber Segar" = "Sumber Segar")
        return (best, sc, "mirip") if best and sc >= threshold else (None, sc, "")

    def candidates(self, name: Any, k: int = 5) -> list[dict]:
        n, c = self._norm(name, self.ent), self._compact(name, self.ent)
        sc = sorted(((max(self._sim(n, nn), self._sim(c, cc)), d) for nn, cc, d in self.normed), key=lambda x: -x[0])
        return [{"value": d["id"], "label": d.get(self.name_key) + (f" ({d['code']})" if d.get("code") else "")} for s, d in sc[:k] if s >= 0.5]


async def _refs(target: str, vm: dict) -> dict[str, Refs]:
    db = get_db()
    out = {}
    need = {"purchases": ("vendor", "item", "outlet"), "opname": ("item", "outlet"), "opening_ap": ("vendor", "outlet"),
            "opening_ar": ("customer", "outlet"), "opening_stock": ("item", "outlet"), "budget": ("account", "outlet"),
            "opening_gl": ("account",), "items": ("item", "category"), "vendors": ("vendor",), "customers": ("customer",)}[target]
    if "vendor" in need:
        out["vendor"] = Refs("vendor", await db.vendors.find({"deleted_at": None}, {"_id": 0}).to_list(20000), vm=vm.get("vendor"))
    if "item" in need:
        out["item"] = Refs("item", await db.items.find({"deleted_at": None}, {"_id": 0}).to_list(50000), vm=vm.get("item"))
    if "customer" in need:
        out["customer"] = Refs("customer", await db.ar_customers.find({"deleted_at": None}, {"_id": 0}).to_list(20000), vm=vm.get("customer"))
    if "outlet" in need:
        out["outlet"] = Refs("outlet", await db.outlets.find({"deleted_at": None}, {"_id": 0}).to_list(500), vm=vm.get("outlet"))
    if "category" in need:
        out["category"] = Refs("category", await db.categories.find({"deleted_at": None}, {"_id": 0}).to_list(2000), vm=vm.get("category"))
    if "account" in need:
        accts = await db.chart_of_accounts.find({"deleted_at": None}, {"_id": 0}).to_list(5000)
        out["account"] = Refs("account", accts, vm=vm.get("account"))
    return out


def _acct(refs: dict, r: dict) -> tuple[Optional[dict], str]:
    a, sc, how = refs["account"].match(r.get("account_name"), r.get("account_code"), threshold=0.9)
    if a and a.get("is_postable") is False:
        return None, f"akun {a.get('code')} adalah akun induk (tidak bisa diposting)"
    return a, "" if a else f"akun '{r.get('account_code') or ''} {r.get('account_name') or ''}' tidak dikenal"


# ───────────────────────────── pratinjau ─────────────────────────────

async def preview(b: dict, ex: dict, user: dict) -> dict:
    target = b["target"]
    opts = b.get("options") or {}
    refs = await _refs(target, b.get("value_maps") or {})
    rows = ex["records"]
    out, unresolved = [], defaultdict(dict)
    db = get_db()
    default_outlet = opts.get("outlet_id")

    def unres(kind, raw):
        if raw and kind in refs and raw not in unresolved[kind]:
            unresolved[kind][raw] = refs[kind].candidates(raw)

    if target in ("items", "vendors", "customers"):
        kind = {"items": "item", "vendors": "vendor", "customers": "customer"}[target]
        seen = set()
        for r in rows:
            name = r.get("name")
            st, msg, match = "baru", "", None
            if not name:
                st, msg = "galat", "nama kosong"
            else:
                d, sc, how = refs[kind].match(name, r.get("code"), threshold=0.9)
                if d and how in ("kode", "nama", "dipilih"):
                    st, match, msg = "ubah", d, f"sudah ada ({how}) — field yang diisi akan diperbarui"
                elif d and how == "mirip":
                    st, match, msg = "mirip", d, f"mirip '{d.get('name')}' ({sc:.0%}) — {'dilewati' if opts.get('similar_action', 'lewati') == 'lewati' else 'dibuat baru'}"
                    unres(kind, name)
                if _key(name) in seen:
                    st, msg = "duplikat", "nama sama dengan baris lain di file"
                seen.add(_key(name))
            if target == "vendors" and r.get("npwp") and st in ("baru", "mirip"):
                dupn = next((v for v in refs["vendor"].docs if re.sub(r"\D", "", str(v.get("npwp") or "")) == re.sub(r"\D", "", r["npwp"])), None)
                if dupn:
                    st, match, msg = "ubah", dupn, f"NPWP sama dengan {dupn.get('name')}"
            out.append({**r, "status": st, "keterangan": msg, "match_id": (match or {}).get("id"), "match_name": (match or {}).get("name")})
    elif target in ("purchases", "opname", "opening_stock"):
        for r in rows:
            issues = []
            it, sc, how = refs["item"].match(r.get("item"), r.get("code"))
            if not it:
                issues.append(f"item '{r.get('item') or r.get('code')}' belum ada di master")
                unres("item", r.get("item") or r.get("code"))
            oid = None
            if r.get("outlet"):
                o, _, _ = refs["outlet"].match(r["outlet"], threshold=0.7)
                oid = (o or {}).get("id")
                if not o:
                    issues.append(f"toko '{r['outlet']}' tidak dikenal")
                    unres("outlet", r["outlet"])
            oid = oid or default_outlet
            if not oid:
                issues.append("toko belum ditentukan (kolom toko / opsi outlet_id)")
            vid = None
            if target == "purchases":
                v, _, _ = refs["vendor"].match(r.get("vendor"))
                vid = (v or {}).get("id")
                if not v:
                    issues.append(f"supplier '{r.get('vendor')}' tidak dikenal")
                    unres("vendor", r.get("vendor"))
                if r.get("unit_cost") is None and r.get("total") is not None and r.get("qty"):
                    r["unit_cost"] = round(r["total"] / r["qty"], 2)
                if not r.get("qty") or r["qty"] <= 0:
                    issues.append("qty kosong/≤ 0")
            if target == "opname" and r.get("counted_qty") is None:
                issues.append("qty fisik kosong")
            if target == "opening_stock":
                if r.get("unit_cost") is None and r.get("total") is not None and r.get("qty"):
                    r["unit_cost"] = round(r["total"] / r["qty"], 2)
                if r.get("unit_cost") is None:
                    issues.append("harga pokok kosong (isi kolom harga atau nilai)")
            if it and r.get("unit") and it.get("unit_default") and _unit(r["unit"]) != _unit(it["unit_default"]):
                from services.ai_purchasing.units import dim_of
                if dim_of(_unit(r["unit"]))[0] != dim_of(it["unit_default"])[0]:
                    issues.append(f"satuan file '{r['unit']}' ≠ satuan item '{it['unit_default']}'")
            out.append({**r, "status": "galat" if issues else "siap", "keterangan": "; ".join(issues),
                        "item_id": (it or {}).get("id"), "item_name": (it or {}).get("name"), "outlet_id": oid, "vendor_id": vid,
                        "cocok_item": how})
        if target == "purchases":
            keys = {(r.get("vendor_id"), _key(r.get("invoice_no")), r.get("item_id")) for r in out if r.get("invoice_no")}
            if keys:
                async for h in db.purchase_history.find({"deleted_at": None, "invoice_key": {"$in": [k[1] for k in keys]}},
                                                        {"_id": 0, "vendor_id": 1, "invoice_key": 1, "item_id": 1}):
                    for r in out:
                        if (r.get("vendor_id"), _key(r.get("invoice_no")), r.get("item_id")) == (h["vendor_id"], h["invoice_key"], h["item_id"]):
                            r["status"], r["keterangan"] = "duplikat", "sudah pernah diimpor"
    elif target in ("opening_ap", "opening_ar"):
        kind = "vendor" if target == "opening_ap" else "customer"
        coll = db.ap_ledgers if target == "opening_ap" else db.ar_invoices
        for r in rows:
            issues = []
            p, _, _ = refs[kind].match(r.get(kind))
            if not p:
                issues.append(f"{'supplier' if kind == 'vendor' else 'pelanggan'} '{r.get(kind)}' tidak dikenal")
                unres(kind, r.get(kind))
            if not r.get("amount") or r["amount"] <= 0:
                issues.append("sisa ≤ 0")
            oid = None
            if r.get("outlet"):
                o, _, _ = refs["outlet"].match(r["outlet"], threshold=0.7)
                oid = (o or {}).get("id")
            st = "galat" if issues else "siap"
            if p and r.get("invoice_no") and not issues:
                q = {"invoice_no": r["invoice_no"], "deleted_at": None, ("vendor_id" if kind == "vendor" else "customer_id"): p["id"]}
                if await coll.find_one(q, {"_id": 1}):
                    st, issues = "duplikat", ["invoice sudah ada"]
            out.append({**r, "status": st, "keterangan": "; ".join(issues), "party_id": (p or {}).get("id"),
                        "party_name": (p or {}).get("name"), "outlet_id": oid or default_outlet})
    elif target in ("opening_gl", "budget"):
        for r in rows:
            a, err = _acct(refs, r)
            if not a:
                unres("account", r.get("account_code") or r.get("account_name"))
            amt_ok = (r.get("amount") if target == "budget" else (r.get("debit") or r.get("credit") or r.get("balance"))) not in (None, 0)
            issues = [e for e in [err, "" if amt_ok else "nominal kosong"] if e]
            oid = None
            if target == "budget" and r.get("outlet"):
                o, _, _ = refs["outlet"].match(r["outlet"], threshold=0.7)
                oid = (o or {}).get("id")
            if target == "budget" and not r.get("period") and not opts.get("period"):
                issues.append("periode kosong (kolom periode / opsi period)")
            out.append({**r, "status": "galat" if issues else "siap", "keterangan": "; ".join(issues), "coa_id": (a or {}).get("id"),
                        "coa_label": f"{a.get('code')} {a.get('name')}" if a else None, "coa_type": (a or {}).get("type"),
                        "outlet_id": oid or (default_outlet if target == "budget" else None)})
    counts = defaultdict(int)
    for r in out:
        counts[r["status"]] += 1
    summary = {"baris": len(out), **counts}
    if target == "opening_gl":
        dr = sum(float(r.get("debit") or 0) + max(float(r.get("balance") or 0), 0) for r in out if r["status"] == "siap")
        cr = sum(float(r.get("credit") or 0) + max(-float(r.get("balance") or 0), 0) for r in out if r["status"] == "siap")
        summary.update({"total_debit": round(dr, 2), "total_kredit": round(cr, 2), "selisih": round(dr - cr, 2)})
    elif target in ("opening_ap", "opening_ar", "purchases", "opening_stock", "budget"):
        k = {"purchases": "total", "opening_stock": "total"}.get(target, "amount")
        summary["total"] = round(sum(float(r.get(k) or (float(r.get("qty") or 0) * float(r.get("unit_cost") or 0))) for r in out
                                     if r["status"] == "siap"), 2)
    issues = list(ex.get("issues") or [])
    if target == "opening_gl" and abs(summary.get("selisih") or 0) > 1:
        issues.append({"level": "warning", "pesan": f"Neraca saldo tidak seimbang (selisih {_rp(summary['selisih'])}) — "
                                                      "selisih dibukukan ke Laba Ditahan bila diteruskan"})
    choices = {k: [{"value": d["id"], "label": (d.get("name") or d.get("full_name") or "") + (f" ({d['code']})" if d.get("code") else "")}
                   for d in refs[k].docs[:2000]] for k in unresolved if k in refs}
    return {"records_preview": out[:PREVIEW], "summary": summary, "issues": issues,
            "unresolved": {k: [{"raw": raw, "kandidat": c} for raw, c in v.items()] for k, v in unresolved.items()},
            "choices": choices, "target_label": mp.TARGET_LABELS.get(target, target)}


# ───────────────────────────── commit ─────────────────────────────

async def _code(coll, prefix: str) -> str:
    n = await get_db()[coll].count_documents({})
    while True:
        n += 1
        c = f"{prefix}-{n:04d}"
        if not await get_db()[coll].find_one({"code": c}, {"_id": 1}):
            return c


def _opening_date(opts: dict) -> str:
    if opts.get("opening_date"):
        return str(opts["opening_date"])[:10]
    return (date.today().replace(day=1) - timedelta(days=1)).isoformat()


async def commit(b: dict, ex: dict, user: dict) -> dict:
    target = b["target"]
    _need(user, target)
    rows = await _all_rows(b, ex, user)
    if not any(r["status"] in ("baru", "ubah", "siap") or (r["status"] == "mirip" and (b.get("options") or {}).get("similar_action") == "baru")
               for r in rows):
        raise ValidationError("Tidak ada baris yang siap diimpor — perbaiki pemetaan/nilai yang belum dikenali")
    fn = {"items": _commit_master, "vendors": _commit_master, "customers": _commit_master, "purchases": _commit_purchases,
          "opname": _commit_opname, "opening_gl": _commit_opening_gl, "opening_ap": _commit_opening_party,
          "opening_ar": _commit_opening_party, "opening_stock": _commit_opening_stock, "budget": _commit_budget}[target]
    res = await fn(b, rows, user)
    res["dilewati"] = sum(1 for r in rows if r["status"] in ("galat", "duplikat") or (r["status"] == "mirip" and (b.get("options") or {}).get("similar_action", "lewati") == "lewati"))
    return res


async def _all_rows(b: dict, ex: dict, user: dict) -> list[dict]:
    """Pratinjau dibatasi PREVIEW baris; untuk commit hitung semua baris (dipotong per PREVIEW)."""
    out = []
    recs = ex["records"]
    for i in range(0, len(recs), PREVIEW):
        out += (await preview(b, {**ex, "records": recs[i:i + PREVIEW]}, user))["records_preview"]
    return out


async def _commit_master(b: dict, rows: list[dict], user: dict) -> dict:
    db = get_db()
    target = b["target"]
    sim_new = (b.get("options") or {}).get("similar_action") == "baru"
    coll = {"items": "items", "vendors": "vendors", "customers": "ar_customers"}[target]
    prefix = {"items": "IT", "vendors": "V", "customers": "C"}[target]
    cats = {_key(c["name"]): c async for c in db.categories.find({"deleted_at": None}, {"_id": 0})} if target == "items" else {}
    created, updated, cat_new = [], [], []
    for r in rows:
        if r["status"] in ("galat", "duplikat") or (r["status"] == "mirip" and not sim_new):
            continue
        doc: dict[str, Any] = {}
        if target == "items":
            if r.get("category"):
                c = cats.get(_key(r["category"]))
                if not c:
                    c = {"id": str(uuid.uuid4()), "code": re.sub(r"[^A-Z0-9]+", "-", r["category"].upper())[:20], "name": r["category"],
                         "type": "item", "active": True, "created_at": _now(), "updated_at": _now(), "deleted_at": None}
                    await db.categories.insert_one(c)
                    cats[_key(r["category"])] = c
                    cat_new.append(c["id"])
                doc["category_id"] = c["id"]
            for f, k in (("unit", "unit_default"), ("cost", "std_cost"), ("min_stock", "min_stock")):
                if r.get(f) not in (None, ""):
                    doc[k] = _unit(r[f]) if f == "unit" else float(r[f])
        else:
            for f in ("contact_person", "phone", "email", "address", "city", "npwp", "bank_name", "bank_account_number"):
                if r.get(f):
                    doc[f] = str(r[f])
            if r.get("payment_terms_days") is not None:
                doc["credit_terms_days" if target == "customers" else "payment_terms_days"] = int(r["payment_terms_days"])
            if r.get("credit_limit") is not None:
                doc["credit_limit"] = float(r["credit_limit"])
        if r["status"] == "ubah" and r.get("match_id"):
            doc["updated_at"] = _now()
            await db[coll].update_one({"id": r["match_id"]}, {"$set": doc})
            updated.append(r["match_id"])
            continue
        doc.update({"id": str(uuid.uuid4()), "code": r.get("code") or await _code(coll, prefix), "name": r["name"], "active": True,
                    "is_active": True, "created_at": _now(), "updated_at": _now(), "deleted_at": None, "created_by": user["id"],
                    "source": "smart_import", "import_batch_id": b["id"]})
        if target == "customers":
            doc.setdefault("channel", "b2b")
            doc["total_outstanding"] = 0.0
        await db[coll].insert_one(doc)
        created.append(doc["id"])
    return {"dibuat": len(created), "diperbarui": len(updated), "created": {coll: created, "categories": cat_new}}


async def _commit_purchases(b: dict, rows: list[dict], user: dict) -> dict:
    db = get_db()
    mode = (b.get("options") or {}).get("purchase_mode") or "riwayat"
    ok = [r for r in rows if r["status"] == "siap"]
    if mode == "posting":
        perms = set(user.get("permissions") or [])
        if "*" not in perms and "procurement.gr.create" not in perms:
            from core.exceptions import ForbiddenError
            raise ForbiddenError("Mode posting butuh izin procurement.gr.create")
        from services import procurement_service
        groups: dict[tuple, list] = defaultdict(list)
        for r in ok:
            groups[(r["vendor_id"], r.get("invoice_no") or "", r.get("date"), r["outlet_id"])].append(r)
        grs, failed = [], []
        for (vid, inv, d, oid), ls in groups.items():
            payload = {"vendor_id": vid, "outlet_id": oid, "receive_date": d, "invoice_no": inv or None, "invoice_date": d,
                       "notes": f"Impor pembelian historis ({b.get('filename')})",
                       "lines": [{"item_id": r["item_id"], "item_name": r["item_name"], "qty_ordered": r["qty"], "qty_received": r["qty"],
                                  "unit": r.get("unit") or None, "unit_cost": r["unit_cost"]} for r in ls]}
            try:
                gr = await procurement_service.post_gr(payload, user=user)
                grs.append(gr["id"])
            except Exception as e:  # noqa: BLE001
                failed.append({"invoice": inv, "tanggal": d, "error": str(e)[:200]})
        return {"mode": mode, "gr_dibuat": len(grs), "gagal": failed, "created": {"goods_receipts": grs}}
    docs = [{"id": str(uuid.uuid4()), "batch_id": b["id"], "date": r["date"], "vendor_id": r["vendor_id"], "vendor_name": r.get("vendor"),
             "invoice_no": r.get("invoice_no"), "invoice_key": _key(r.get("invoice_no")), "outlet_id": r["outlet_id"], "item_id": r["item_id"],
             "item_name": r["item_name"], "qty": r["qty"], "unit": _unit(r.get("unit")), "unit_cost": r["unit_cost"],
             "total": round(r.get("total") or r["qty"] * r["unit_cost"], 2), "created_at": _now(), "created_by": user["id"], "deleted_at": None}
            for r in ok]
    if docs:
        await db.purchase_history.insert_many(docs)
    return {"mode": mode, "baris_riwayat": len(docs), "nilai": round(sum(d["total"] for d in docs), 2),
            "created": {"purchase_history": [d["id"] for d in docs]}}


async def _commit_opname(b: dict, rows: list[dict], user: dict) -> dict:
    from services import inventory_service
    ok = [r for r in rows if r["status"] == "siap"]
    by_o: dict[str, list] = defaultdict(list)
    for r in ok:
        by_o[r["outlet_id"]].append(r)
    sessions = []
    for oid, ls in by_o.items():
        sess = await inventory_service.start_opname({"outlet_id": oid, "notes": f"Impor hasil hitung ({b.get('filename')})"}, user=user)
        await inventory_service.update_opname_lines(sess["id"], [{"item_id": r["item_id"], "counted_qty": r["counted_qty"]} for r in ls], user=user)
        sessions.append({"id": sess["id"], "doc_no": sess.get("doc_no"), "outlet_id": oid, "item": len(ls)})
    return {"sesi_opname": sessions, "catatan": "Sesi opname berstatus berjalan — periksa & submit di Stock Opname.",
            "created": {"opname_sessions": [s["id"] for s in sessions]}}


async def _post(entry_date: str, desc: str, lines: list[dict], user: dict, outlet_id: Optional[str] = None) -> dict:
    from services import finance_service
    return await finance_service.post_manual_journal({"entry_date": entry_date, "description": desc[:200], "outlet_id": outlet_id,
                                                      "lines": lines, "reference": {"source": "opening_import"}}, user=user)


async def _commit_opening_gl(b: dict, rows: list[dict], user: dict) -> dict:
    from services import gl_mapping
    d = _opening_date(b.get("options") or {})
    ok = [r for r in rows if r["status"] == "siap"]
    by: dict[str, float] = defaultdict(float)
    for r in ok:
        by[r["coa_id"]] += float(r.get("debit") or 0) - float(r.get("credit") or 0) + float(r.get("balance") or 0)
    lines = [{"coa_id": c, "dr": round(v, 2) if v > 0 else 0, "cr": round(-v, 2) if v < 0 else 0, "memo": "Saldo awal migrasi"}
             for c, v in by.items() if abs(v) >= 0.01]
    diff = round(sum(ln["dr"] - ln["cr"] for ln in lines), 2)
    if abs(diff) >= 0.01:
        re_coa = await gl_mapping.resolve("retained_earnings")
        lines.append({"coa_id": re_coa, "dr": -diff if diff < 0 else 0, "cr": diff if diff > 0 else 0, "memo": "Selisih saldo awal → Laba Ditahan"})
    if not lines:
        raise ValidationError("Tidak ada saldo untuk dibukukan")
    je = await _post(d, f"Saldo awal migrasi per {d}", lines, user)
    return {"jurnal": je.get("doc_no"), "akun": len(by), "selisih_ke_laba_ditahan": diff, "created": {"journal_entries": [je["id"]]}}


async def _commit_opening_party(b: dict, rows: list[dict], user: dict) -> dict:
    from services import gl_mapping
    db = get_db()
    ap = b["target"] == "opening_ap"
    opts = b.get("options") or {}
    d = _opening_date(opts)
    ok = [r for r in rows if r["status"] == "siap"]
    ids = []
    for r in ok:
        inv_date = r.get("date") or d
        due = r.get("due_date") or inv_date
        amt = round(float(r["amount"]), 2)
        if ap:
            doc = {"id": str(uuid.uuid4()), "vendor_id": r["party_id"], "gr_id": None, "outlet_id": r.get("outlet_id"),
                   "invoice_no": r.get("invoice_no"), "invoice_date": inv_date, "period": inv_date[:7], "due_date": due, "amount": amt,
                   "balance": amt, "currency": "IDR", "status": "open", "payments": [], "description": "Saldo awal (impor)",
                   "opening": True, "import_batch_id": b["id"], "posted_at": _now(), "created_at": _now(), "updated_at": _now(),
                   "deleted_at": None, "created_by": user["id"]}
            await db.ap_ledgers.insert_one(doc)
        else:
            doc = {"id": str(uuid.uuid4()), "invoice_no": r.get("invoice_no") or f"OB-{uuid.uuid4().hex[:6].upper()}", "customer_id": r["party_id"],
                   "customer_name": r.get("party_name"), "channel": "b2b", "invoice_date": inv_date, "due_date": due, "period": inv_date[:7],
                   "lines": [{"description": "Saldo awal piutang", "qty": 1, "unit_price": amt, "discount": 0, "dpp": amt, "ppn_rate": 0, "ppn": 0}],
                   "subtotal": amt, "tax_amount": 0, "total_amount": amt, "paid_amount": 0.0, "outstanding": amt, "status": "sent",
                   "outlet_id": r.get("outlet_id"), "opening": True, "import_batch_id": b["id"], "receipts": [],
                   "created_at": _now(), "updated_at": _now(), "deleted_at": None, "created_by": user["id"]}
            await db.ar_invoices.insert_one(doc)
        ids.append(doc["id"])
    total = round(sum(float(r["amount"]) for r in ok), 2)
    jes = []
    if ok and opts.get("post_gl", True):
        re_coa = await gl_mapping.resolve("retained_earnings")
        ctl = await gl_mapping.resolve("accounts_payable") if ap else await gl_mapping.resolve_or("ar_receivable", "cards_receivable")
        lines = ([{"coa_id": re_coa, "dr": total, "cr": 0, "memo": "Saldo awal hutang"}, {"coa_id": ctl, "dr": 0, "cr": total, "memo": "Saldo awal hutang"}]
                 if ap else [{"coa_id": ctl, "dr": total, "cr": 0, "memo": "Saldo awal piutang"}, {"coa_id": re_coa, "dr": 0, "cr": total, "memo": "Saldo awal piutang"}])
        je = await _post(d, f"Saldo awal {'hutang' if ap else 'piutang'} per {d} ({len(ok)} invoice)", lines, user)
        jes.append(je["id"])
    return {"dokumen": len(ids), "total": total, "created": {("ap_ledgers" if ap else "ar_invoices"): ids, "journal_entries": jes}}


async def _commit_opening_stock(b: dict, rows: list[dict], user: dict) -> dict:
    from services import gl_mapping
    db = get_db()
    opts = b.get("options") or {}
    d = _opening_date(opts)
    ok = [r for r in rows if r["status"] == "siap"]
    movs = [{"id": str(uuid.uuid4()), "outlet_id": r["outlet_id"], "item_id": r["item_id"], "movement_type": "opening", "movement_date": d,
             "qty": float(r["qty"]), "unit_cost": float(r["unit_cost"]), "total_value": round(float(r["qty"]) * float(r["unit_cost"]), 2),
             "ref_doc": f"IMPOR {b.get('filename') or ''}"[:60], "notes": "Saldo awal stok (impor)", "import_batch_id": b["id"],
             "created_at": _now(), "updated_at": _now(), "created_by": user["id"], "updated_by": user["id"], "deleted_at": None} for r in ok]
    if movs:
        await db.inventory_movements.insert_many(movs)
    jes = []
    if movs and opts.get("post_gl", True):
        re_coa = await gl_mapping.resolve("retained_earnings")
        by_o: dict[str, float] = defaultdict(float)
        for m in movs:
            by_o[m["outlet_id"]] += m["total_value"]
        for oid, v in by_o.items():
            inv = await gl_mapping.resolve("inventory", scope_outlet_id=oid)
            je = await _post(d, f"Saldo awal persediaan per {d}", [
                {"coa_id": inv, "dr": round(v, 2), "cr": 0, "memo": "Saldo awal persediaan", "dim_outlet": oid},
                {"coa_id": re_coa, "dr": 0, "cr": round(v, 2), "memo": "Saldo awal persediaan", "dim_outlet": oid}], user, outlet_id=oid)
            jes.append(je["id"])
    return {"mutasi_saldo_awal": len(movs), "nilai": round(sum(m["total_value"] for m in movs), 2),
            "created": {"inventory_movements": [m["id"] for m in movs], "journal_entries": jes}}


async def _commit_budget(b: dict, rows: list[dict], user: dict) -> dict:
    from services._budget.crud import create_budget
    opts = b.get("options") or {}
    ok = [r for r in rows if r["status"] == "siap"]
    groups: dict[tuple, list] = defaultdict(list)
    for r in ok:
        groups[(r.get("period") or opts.get("period"), r.get("outlet_id"))].append(r)
    ids = []
    for (period, oid), ls in groups.items():
        bud = await create_budget({"name": f"Budget {period} (impor)", "period": period, "period_type": "monthly", "outlet_id": oid,
                                   "lines": [{"coa_id": r["coa_id"], "amount": float(r["amount"])} for r in ls],
                                   "notes": f"Impor dari {b.get('filename')}"}, user_id=user["id"])
        ids.append(bud["id"])
    return {"budget_dibuat": len(ids), "created": {"budgets": ids}}


# ───────────────────────────── rollback ─────────────────────────────

async def rollback(b: dict, user: dict) -> dict:
    from services._finance.journals import reverse_journal
    db = get_db()
    created = ((b.get("result") or {}).get("created")) or {}
    now = _now()
    out: dict[str, int] = {}
    for je_id in created.get("journal_entries") or []:
        try:
            await reverse_journal(je_id, user=user, reason=f"Batalkan impor {b['id'][:8]}")
            out["jurnal_dibalik"] = out.get("jurnal_dibalik", 0) + 1
        except Exception:  # noqa: BLE001
            out["jurnal_gagal_dibalik"] = out.get("jurnal_gagal_dibalik", 0) + 1
    for coll in ("items", "vendors", "ar_customers", "categories", "purchase_history", "budgets"):
        ids = created.get(coll) or []
        if ids:
            r = await db[coll].update_many({"id": {"$in": ids}, "deleted_at": None}, {"$set": {"deleted_at": now}})
            out[coll] = r.modified_count
    if created.get("ap_ledgers"):
        r = await db.ap_ledgers.update_many({"id": {"$in": created["ap_ledgers"]}, "payments": {"$size": 0}}, {"$set": {"deleted_at": now}})
        out["hutang"] = r.modified_count
    if created.get("ar_invoices"):
        r = await db.ar_invoices.update_many({"id": {"$in": created["ar_invoices"]}, "paid_amount": 0}, {"$set": {"deleted_at": now}})
        out["piutang"] = r.modified_count
    if created.get("inventory_movements"):
        r = await db.inventory_movements.update_many({"id": {"$in": created["inventory_movements"]}}, {"$set": {"deleted_at": now}})
        out["mutasi_stok"] = r.modified_count
    if created.get("opname_sessions"):
        r = await db.opname_sessions.update_many({"id": {"$in": created["opname_sessions"]}, "status": "in_progress"}, {"$set": {"deleted_at": now}})
        out["opname"] = r.modified_count
    if created.get("goods_receipts"):
        out["gr_tidak_dibatalkan"] = len(created["goods_receipts"])        # GR terposting dibatalkan lewat modul GR
    return out
