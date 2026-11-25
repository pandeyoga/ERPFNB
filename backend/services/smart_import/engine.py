"""Mesin Impor Cerdas: profil file → pemetaan → ekstraksi baris ternormalisasi (penjualan / mutasi bank).

Tidak menyentuh database (murni & mudah diuji). Penyimpanan, cek duplikasi terhadap data yang ada, rekap harian, dan
commit/rollback ada di `service.py`.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from core.exceptions import ValidationError

from . import mapping as mp
from .parsing import (clean_text, dc_sign, infer_date_order, infer_decimal, is_blank, parse_date, parse_datetime,
                      parse_number, parse_time)
from .reader import Table, build_table, column_type, find_header, read_sheets

# Channel standar (nama yang dipakai rekap harian) ← variasi yang sering muncul di file
CHANNELS = {
    "Dine-in": ["dine in", "dinein", "dine-in", "makan di tempat", "makan ditempat", "eat in", "di tempat", "dine"],
    "Take-Away": ["take away", "takeaway", "take-away", "takeout", "take out", "bungkus", "bawa pulang", "pickup",
                  "pick up", "to go", "togo", "ambil sendiri"],
    "Delivery": ["delivery", "antar", "kirim", "diantar", "pesan antar", "delivery order", "online"],
    "GoFood": ["gofood", "go food", "go-food", "gojek", "gobiz"],
    "GrabFood": ["grabfood", "grab food", "grab"],
    "ShopeeFood": ["shopeefood", "shopee food", "shopee"],
}
# Petunjuk metode bayar → tipe payment_methods (cash/qris/card/transfer)
PAYMENT_HINTS = [
    ("cash", ["cash", "tunai", "kas", "uang tunai"]),
    ("qris", ["qris", "qr", "gopay", "ovo", "dana", "shopeepay", "linkaja", "e-wallet", "ewallet", "dompet digital", "astrapay", "sakuku"]),
    ("card", ["debit", "kredit", "credit", "card", "kartu", "edc", "visa", "mastercard", "master card", "amex", "jcb", "flazz", "bca card"]),
    ("transfer", ["transfer", "trf", "bank transfer", "virtual account", "va ", "tf "]),
]
VOID_RE = re.compile(r"void|batal|cancel|dibatalkan|refund|retur|gagal|failed|rejected|ditolak", re.I)
BEVERAGE_RE = re.compile(r"minum|drink|beverage|bev\b|kopi|coffee|tea\b|teh|jus|juice|latte|espresso|americano|cappuccino|"
                         r"susu|milk|soda|\bes\b|ice[ds]?\b|smoothie|mocktail|cocktail|beer|bir\b|wine|air mineral|mineral water|"
                         r"water|lemonade|matcha|chocolate|coklat|frappe|boba|thai tea", re.I)


def canonical_channel(raw: Any) -> Optional[str]:
    s = mp.normalize(raw)
    if not s:
        return None
    for name, alts in CHANNELS.items():
        if s == mp.normalize(name) or any(re.search(rf"(^|\s){re.escape(a)}($|\s)", s) for a in alts):
            return name
    return clean_text(raw)[:40].title()


def payment_kind(raw: Any) -> Optional[str]:
    s = " " + mp.normalize(raw) + " "
    for kind, words in PAYMENT_HINTS:
        if any(f" {w.strip()} " in s or s.strip().startswith(w.strip()) for w in words):
            return kind
    return None


def bucket_of(item: str, category: str) -> str:
    text = f"{category} {item}"
    if re.search(r"makan|food|main|appetizer|dessert|snack|roti|bread|pastry|cake|kue", category or "", re.I):
        return "food"
    return "beverage" if BEVERAGE_RE.search(text) else "food"


# ---------------------------------------------------------------- profil

def _wide_fields(headers: list[str], types: list[str], used: set[int]) -> dict[int, str]:
    """Format lebar (rekap manual): kolom angka bernama channel/metode bayar → channel:<Nama> / pay:<nama mentah>."""
    out = {}
    for i, h in enumerate(headers):
        if i in used or types[i] != "number":
            continue
        n = mp.normalize(h)
        ch = next((name for name, alts in CHANNELS.items() if n == mp.normalize(name) or n in [mp.normalize(a) for a in alts]), None)
        if ch:
            out[i] = f"channel:{ch}"
            continue
        if payment_kind(h) and len(n) <= 24:
            out[i] = f"pay:{clean_text(h)}"
    return out


def profile(data: bytes, filename: str, *, target: Optional[str] = None, sheet: Optional[str] = None,
            header_row: Optional[int] = None) -> dict:
    sheets = [s for s in read_sheets(data, filename) if any(any(not is_blank(c) for c in r) for r in s.rows[:200])]
    if not sheets:
        raise ValidationError("Tidak ada tabel berisi data di file ini")
    known = mp.known_headers()
    candidates = []
    for sh in sheets:
        if sheet and sh.name != sheet:
            continue
        hr = (header_row - 1) if header_row else find_header(sh.rows, known, mp.normalize)
        tbl = build_table(sh, hr)
        if not tbl.rows:
            continue
        types = [column_type([r[i] for r in tbl.rows[:500]]) for i in range(len(tbl.headers))]
        tgt = target or mp.detect_target(tbl.headers, types, tbl.rows[:50])
        mapping = mp.auto_map(tgt, tbl.headers, types, tbl.rows[:50])
        score = sum(m["confidence"] for m in mapping if m["field"]) + min(len(tbl.rows), 500) / 500
        candidates.append((score, tbl, types, tgt, mapping))
    if not candidates:
        raise ValidationError("Header tabel tidak ditemukan" + (f" di sheet {sheet}" if sheet else ""))
    candidates.sort(key=lambda c: -c[0])
    _, tbl, types, tgt, mapping = candidates[0]
    if tgt == "sales":
        used = {i for i, m in enumerate(mapping) if m["field"]}
        for i, f in _wide_fields(tbl.headers, types, used).items():
            mapping[i] = {"field": f, "confidence": 0.8, "by": "kamus"}
    return {"table": tbl, "types": types, "target": tgt, "mapping": mapping,
            "sheets": [s.name for s in sheets], "sheet": tbl.sheet,
            "source": mp.detect_source(filename, tbl.headers, tbl.meta),
            "signature": mp.signature(tbl.headers)}


def column_view(prof: dict) -> list[dict]:
    tbl: Table = prof["table"]
    out = []
    for i, h in enumerate(tbl.headers):
        sample = [clean_text(r[i])[:40] for r in tbl.rows[:400] if i < len(r) and not is_blank(r[i])][:4]
        out.append({"index": i, "name": h, "type": prof["types"][i], "sample": sample, **prof["mapping"][i]})
    return out


def field_options(target: str) -> list[dict]:
    opts = [{"value": f, "label": lbl} for f, (lbl, _, _) in mp.TARGETS[target].items()]
    if target == "sales":
        opts += [{"value": f"channel:{c}", "label": f"Nominal channel {c}"} for c in CHANNELS]
    return opts


# ---------------------------------------------------------------- ekstraksi

def _year_hint(meta: dict) -> Optional[int]:
    m = re.search(r"(20\d{2})", " ".join(str(v) for v in meta.values()))
    return int(m.group(1)) if m else None


def _meta_outlet(meta: dict) -> Optional[str]:
    for k, v in meta.items():
        if re.search(r"outlet|toko|cabang|store|branch|lokasi", str(k), re.I) and v:
            return str(v)
    return None


def extract(prof: dict, *, options: Optional[dict] = None) -> dict:
    tbl: Table = prof["table"]
    opts = options or {}
    fields: dict[str, int] = {}
    wide: dict[int, str] = {}
    for i, m in enumerate(prof["mapping"]):
        f = m.get("field")
        if not f:
            continue
        if ":" in f:
            wide[i] = f
        else:
            fields[f] = i
    col = lambda f: [r[fields[f]] if fields[f] < len(r) else None for r in tbl.rows] if f in fields else None  # noqa: E731
    yh = opts.get("year_hint") or _year_hint(tbl.meta) or date.today().year
    date_vals = col("date") or []
    order = opts.get("date_order") or infer_date_order(date_vals[:500])
    num_cols = [i for i, t in enumerate(prof["types"]) if t == "number"]
    decimal = opts.get("decimal") or infer_decimal([r[i] for r in tbl.rows[:500] for i in num_cols if i < len(r)])
    if prof["target"] in mp.RECORD_TARGETS:
        from . import records
        return records.extract(prof, fields, order, yh, decimal, opts)
    if prof["target"] == "bank":
        return _extract_bank(tbl, fields, order, yh, decimal, opts)
    return _extract_sales(prof, tbl, fields, wide, order, yh, decimal, opts)


def _num(r, fields, f, decimal):
    i = fields.get(f)
    return parse_number(r[i], decimal) if i is not None and i < len(r) else None


def _txt(r, fields, f):
    i = fields.get(f)
    return clean_text(r[i]) if i is not None and i < len(r) else ""


def _extract_sales(prof, tbl, fields, wide, order, yh, decimal, opts) -> dict:
    issues: list[dict] = []
    cutoff = int(opts.get("cutoff_hour", 4))        # transaksi sebelum jam ini dihitung ke hari bisnis sebelumnya
    default_channel = opts.get("channel") or (prof.get("source") if prof.get("source") in ("GoFood", "GrabFood", "ShopeeFood") else None)
    meta_outlet = _meta_outlet(tbl.meta)
    has_items = "item_name" in fields
    receipts: dict[str, dict] = {}
    seq = 0
    bad_dates = 0
    for ri, r in enumerate(tbl.rows):
        src_row = tbl.source_rows[ri] if ri < len(tbl.source_rows) else ri + 1
        di = fields.get("date")
        d, t = (parse_datetime(r[di], order, yh) if di is not None and di < len(r) else (None, None))
        if fields.get("time") is not None:
            t = parse_time(r[fields["time"]]) or t
        if d is None:
            bad_dates += 1
            if bad_dates <= 5:
                issues.append({"level": "error", "row": src_row, "pesan": f"Tanggal tidak terbaca: {clean_text(r[di]) if di is not None and di < len(r) else '(kosong)'}"})
            continue
        bdate = d - timedelta(days=1) if (t and int(t[:2]) < cutoff) else d
        rno = _txt(r, fields, "receipt_no")
        status = _txt(r, fields, "status")
        if not rno:
            seq += 1
            rno = f"~{d.isoformat()}#{seq}" if not has_items else f"~{d.isoformat()}T{t or ''}#{_txt(r, fields, 'cashier')}"
        key = f"{_txt(r, fields, 'outlet') or meta_outlet or ''}|{rno}|{d.isoformat() if rno.startswith('~') else ''}"
        rec = receipts.get(key)
        if rec is None:
            rec = receipts[key] = {
                "receipt_no": None if rno.startswith("~") else rno, "outlet_raw": _txt(r, fields, "outlet") or meta_outlet or "",
                "date": d.isoformat(), "time": t, "business_date": bdate.isoformat(),
                "channel_raw": _txt(r, fields, "channel"), "payment_raw": _txt(r, fields, "payment_method"),
                "status": status, "void": bool(status and VOID_RE.search(status)),
                "customer": _txt(r, fields, "customer") or None, "cashier": _txt(r, fields, "cashier") or None,
                "items": [], "rows": [], "wide_channels": defaultdict(float), "wide_payments": defaultdict(float),
                "_sum": defaultdict(float), "_hdr": {}, "_tot": [],
            }
        rec["rows"].append(src_row)
        if status and VOID_RE.search(status):
            rec["void"] = True
        for f in ("gross", "discount", "net", "service_charge", "tax", "total", "refund", "commission", "payout"):
            v = _num(r, fields, f, decimal)
            if v is None:
                continue
            if has_items and f in ("gross", "discount", "net"):
                rec["_sum"][f] += v                      # baris item → jumlahkan
            elif has_items and f == "total":
                rec["_hdr"].setdefault("total", v)        # total struk diulang per baris … atau total per baris item
                rec["_tot"].append(v)
            elif has_items:
                rec["_hdr"].setdefault(f, v)              # nilai tingkat struk yang diulang per baris
            else:
                rec["_sum"][f] += v
        for i, w in wide.items():
            v = parse_number(r[i], decimal) if i < len(r) else None
            if not v:
                continue
            kind, _, name = w.partition(":")
            (rec["wide_channels"] if kind == "channel" else rec["wide_payments"])[name] += v
        if has_items:
            name = _txt(r, fields, "item_name")
            if name:
                qty = _num(r, fields, "item_qty", decimal) or 1
                price = _num(r, fields, "item_price", decimal)
                line_total = _num(r, fields, "item_total", decimal)
                net = _num(r, fields, "net", decimal)
                gross = _num(r, fields, "gross", decimal)
                tot = _num(r, fields, "total", decimal)
                amount = next((x for x in (net, line_total, gross, tot) if x is not None), (price or 0) * qty)
                rec["items"].append({"name": name, "variant": _txt(r, fields, "variant") or None, "qty": qty,
                                     "price": price if price is not None else (round(amount / qty, 2) if qty else None),
                                     "amount": amount, "category": _txt(r, fields, "category") or None})
        if "trx_count" in fields:
            rec["_sum"]["trx_count"] += _num(r, fields, "trx_count", decimal) or 0

    # Aplikasi delivery: kolom "Pendapatan Bersih"/"Net Sales" sering = dana diterima SETELAH komisi (payout), bukan
    # penjualan bersih. Bila nilainya ≈ kotor − promo − komisi untuk mayoritas baris → perlakukan sebagai payout.
    payout_like = False
    if not has_items and {"net", "commission"} <= fields.keys() and "payout" not in fields:
        checks = [(rec["_sum"].get("net"), rec["_sum"].get("gross"), rec["_sum"].get("discount") or 0, rec["_sum"].get("commission") or 0)
                  for rec in receipts.values()]
        checks = [c for c in checks if c[0] and c[1] and c[3]]
        if checks and sum(1 for n, g, dsc, com in checks if abs(n - (g - dsc - com)) <= max(1.0, 0.01 * g)) >= 0.8 * len(checks):
            payout_like = True
            for rec in receipts.values():
                rec["_sum"]["payout"] = rec["_sum"].pop("net", 0.0)
            issues.append({"level": "info", "row": None, "pesan": "Kolom penjualan bersih berisi dana setelah komisi — dicatat sebagai payout; "
                                                                  "penjualan = harga kotor − promo merchant"})
    # Kolom "Total" di file per item: bila nilainya berbeda-beda dalam satu struk, itu total per baris → dijumlahkan
    line_totals = has_items and "item_total" not in fields and any(len(set(rec["_tot"])) > 1 for rec in receipts.values())
    txs = []
    for rec in receipts.values():
        s, h, tots = rec.pop("_sum"), rec.pop("_hdr"), rec.pop("_tot")
        if line_totals and tots:
            h["total"] = sum(tots)
            if "net" not in s and "gross" not in s:
                s["net"] = sum(tots) - (h.get("service_charge") or 0) - (h.get("tax") or 0)
        trx_count = int(s.pop("trx_count")) if "trx_count" in s else None
        vals = {f: (s[f] if f in s else h.get(f)) for f in ("gross", "discount", "net", "service_charge", "tax", "total",
                                                            "refund", "commission", "payout")}
        if has_items and vals["net"] is None and rec["items"]:
            vals["net"] = sum(it["amount"] for it in rec["items"])
        wc, wpay = dict(rec.pop("wide_channels")), dict(rec.pop("wide_payments"))
        if wc and vals["net"] is None and vals["gross"] is None:
            vals["net"] = sum(wc.values())
        if vals["net"] is None and vals["gross"] is not None:
            vals["net"] = vals["gross"] - (vals["discount"] or 0)
        if vals["gross"] is None and vals["net"] is not None:
            vals["gross"] = vals["net"] + (vals["discount"] or 0)
        if vals["net"] is None and vals["total"] is not None:
            vals["net"] = vals["total"] - (vals["service_charge"] or 0) - (vals["tax"] or 0)
            vals["gross"] = vals["gross"] if vals["gross"] is not None else vals["net"] + (vals["discount"] or 0)
        if vals["net"] is None and vals["payout"] is not None:
            vals["net"] = vals["payout"] + (vals["commission"] or 0)
            vals["gross"] = vals["gross"] if vals["gross"] is not None else vals["net"] + (vals["discount"] or 0)
        if vals["total"] is None and vals["net"] is not None:
            vals["total"] = vals["net"] + (vals["service_charge"] or 0) + (vals["tax"] or 0)
        if vals["refund"]:
            vals["net"] = (vals["net"] or 0) - abs(vals["refund"])
            vals["total"] = (vals["total"] or 0) - abs(vals["refund"])
        channel = canonical_channel(rec["channel_raw"]) or (None if wc else default_channel)
        if wc and not channel:
            channel = "(rekap per channel)"
        tx = {**rec, **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in vals.items()}, "trx_count": trx_count,
              "channel": channel or "Dine-in", "channel_assumed": not (rec["channel_raw"] or default_channel or wc),
              "wide_channels": wc, "wide_payments": wpay}
        if tx["net"] is None:
            issues.append({"level": "error", "row": rec["rows"][0], "pesan": "Nominal tidak terbaca (tidak ada kolom total/net/gross)"})
            continue
        if (tx["total"] or 0) < 0 and not tx["void"]:
            issues.append({"level": "warning", "row": rec["rows"][0], "pesan": f"Nominal negatif ({tx['total']}) — dianggap refund"})
        txs.append(tx)
    if bad_dates > 5:
        issues.append({"level": "error", "row": None, "pesan": f"{bad_dates} baris tanpa tanggal terbaca"})
    # transaksi "di masa depan" (jam/tanggal setelah sekarang, WIB) → hampir pasti tanggal/zona waktu file salah
    now = datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None)
    future = [t for t in txs if not t["void"] and datetime.fromisoformat(f"{t['date']}T{t.get('time') or '00:00:00'}") > now]
    if future:
        issues.append({"level": "warning", "row": future[0]["rows"][0],
                       "pesan": f"{len(future)} transaksi tercatat setelah waktu sekarang ({future[0]['date']} {future[0].get('time') or ''}) "
                                "— cek tanggal/zona waktu file"})
    # konsistensi: total ≈ net + service charge + pajak (selisih = kolom diskon/biaya yang belum dipetakan)
    if "total" in fields and ({"net", "gross"} & fields.keys()):
        off = [t for t in txs if not t["void"] and t.get("total") is not None and t.get("net") is not None and
               abs(t["total"] - (t["net"] + (t.get("service_charge") or 0) + (t.get("tax") or 0))) > max(1.0, 0.005 * abs(t["total"]))]
        if off:
            issues.append({"level": "warning", "row": off[0]["rows"][0],
                           "pesan": f"{len(off)} transaksi: total ≠ net + service charge + pajak — cek kolom diskon/biaya yang "
                                    "belum dipetakan"})
    if txs and all(t["channel_assumed"] for t in txs):
        issues.append({"level": "info", "row": None, "pesan": "Tidak ada kolom channel — semua dianggap Dine-in (ubah di Opsi bila perlu)"})
    return {"target": "sales", "transactions": txs, "issues": issues, "date_order": order, "decimal": decimal,
            "has_items": has_items, "payout_like": payout_like}


def _extract_bank(tbl, fields, order, yh, decimal, opts) -> dict:
    issues: list[dict] = []
    rows = []
    pending = 0
    # tahun dari periode kop ("01/11/2026 - 30/11/2026") untuk tanggal tanpa tahun
    for ri, r in enumerate(tbl.rows):
        src_row = tbl.source_rows[ri] if ri < len(tbl.source_rows) else ri + 1
        raw_date = r[fields["date"]] if "date" in fields and fields["date"] < len(r) else None
        if clean_text(raw_date).upper().startswith("PEND"):
            pending += 1
            continue
        d = parse_date(raw_date, order, yh)
        if d is None:
            if len(issues) < 5:
                issues.append({"level": "error", "row": src_row, "pesan": f"Tanggal tidak terbaca: {clean_text(raw_date)}"})
            continue
        amount = None
        if "debit" in fields or "credit" in fields:
            db = abs(_num(r, fields, "debit", decimal) or 0)
            cr = abs(_num(r, fields, "credit", decimal) or 0)
            amount = cr - db
        if (amount in (None, 0)) and "amount" in fields:
            amt = _num(r, fields, "amount", decimal)
            if amt is not None:
                sign = None
                if "dc_flag" in fields:
                    sign = dc_sign(r[fields["dc_flag"]] if fields["dc_flag"] < len(r) else None)
                raw_amt = clean_text(r[fields["amount"]]) if fields["amount"] < len(r) else ""
                sign = sign or dc_sign(raw_amt)
                amount = abs(amt) * sign if sign else amt
        if not amount:
            continue
        desc = " ".join(x for x in (_txt(r, fields, "description"), _txt(r, fields, "description2")) if x)
        rows.append({"date": d.isoformat(), "description": desc[:300], "amount": round(amount, 2),
                     "balance": _num(r, fields, "balance", decimal), "reference": _txt(r, fields, "reference") or None,
                     "branch": _txt(r, fields, "branch") or None, "row": src_row})
    if pending:
        issues.append({"level": "info", "row": None, "pesan": f"{pending} transaksi PEND (belum dibukukan bank) dilewati"})
    return {"target": "bank", "rows": rows, "issues": issues, "date_order": order, "decimal": decimal}


def summarize_sales(txs: list[dict]) -> dict:
    valid = [t for t in txs if not t["void"]]
    return {"transaksi": len(valid), "void": len(txs) - len(valid),
            "total": round(sum(t["total"] or 0 for t in valid), 2), "net": round(sum(t["net"] or 0 for t in valid), 2),
            "tanggal": sorted({t["business_date"] for t in valid})[:1] + sorted({t["business_date"] for t in valid})[-1:],
            "outlet": dict(Counter(t["outlet_raw"] for t in valid)), "channel": dict(Counter(t["channel"] for t in valid)),
            "payment": dict(Counter(t["payment_raw"] or "(kosong)" for t in valid))}


def summarize_bank(rows: list[dict]) -> dict:
    return {"baris": len(rows), "masuk": round(sum(r["amount"] for r in rows if r["amount"] > 0), 2),
            "keluar": round(-sum(r["amount"] for r in rows if r["amount"] < 0), 2),
            "tanggal": [min(r["date"] for r in rows), max(r["date"] for r in rows)] if rows else []}


def _datetime_now() -> datetime:
    return datetime.now()
