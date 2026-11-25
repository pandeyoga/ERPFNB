"""AI Auditor (rencana §7.8) — pemeriksaan pengendalian internal. Temuan disimpan sebagai anomaly_events (tipe baru) agar
memakai feed, triase (open → acknowledged/investigating → resolved/false_positive), notifikasi & layar Anomali yang ada;
diulang tiap hari tanpa duplikat (kunci: tipe + sumber).

Pemeriksaan (deterministik, bukti di `details`):
- duplicate_invoice      : invoice AP sama (vendor + no. invoice) atau vendor + nominal + tanggal sama
- duplicate_evidence     : file bukti identik (sha256) dipakai di dua dokumen berbeda
- split_purchase         : beberapa PO ke vendor sama dalam 3 hari, masing-masing < batas approval, jumlahnya ≥ batas
- maker_checker          : pembuat dokumen = penyetuju
- journal_off_hours      : jurnal manual dibuat di luar jam kerja (22:00–06:00 WIB) atau hari Minggu
- round_journal          : jurnal manual angka bulat besar tanpa bukti/referensi
- reversal_near_close    : reversal jurnal di 3 hari terakhir bulan
- benford_deviation      : sebaran digit pertama kas kecil per toko menyimpang (MAD > 0,015, n ≥ 50)
- amount_outlier         : transaksi kas kecil > rata-rata + 3σ per toko
- po_above_benchmark     : harga PO > acuan pasar + ambang Sourcing
"""
from __future__ import annotations

import logging
import math
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import mean, pstdev
from typing import Optional

from core.db import get_db

logger = logging.getLogger("aurora.ai_audit")
WIB = timezone(timedelta(hours=7))
TYPES = {
    "duplicate_invoice": "Invoice ganda", "duplicate_evidence": "Bukti dipakai dua kali",
    "split_purchase": "Pecah pembelian (di bawah batas approval)", "maker_checker": "Pembuat = penyetuju",
    "journal_off_hours": "Jurnal manual di luar jam kerja", "round_journal": "Jurnal angka bulat tanpa bukti",
    "reversal_near_close": "Reversal menjelang tutup buku", "benford_deviation": "Pola angka tidak wajar (Benford)",
    "amount_outlier": "Nominal menyimpang dari pola", "po_above_benchmark": "Harga PO di atas acuan pasar",
    "vendor_bank_changed": "Rekening supplier berubah lalu dibayar", "new_vendor_large_payment": "Supplier baru langsung dibayar besar",
    "invoice_mismatch": "Invoice/GR tidak sesuai PO", "opname_recurring_loss": "Selisih opname berulang",
    "sensitive_account_journal": "Jurnal manual ke akun sensitif",
}
NEW_VENDOR_LIMIT = 10_000_000
BANK_FIELDS = ("bank_account", "bank_account_number", "bank_account_no", "account_number", "bank_name", "rekening", "no_rekening",
               "bank_account_name", "account_name")
SENSITIVE = ("retained_earnings", "income_summary", "cash_on_hand", "bank_default", "inventory", "accounts_payable",
             "cards_receivable", "marketplace_receivable", "petty_cash", "salary_payable")
TRUSTED_SOURCES = ("bank_recon", "ocr", "accrual", "accrual_reversal")
SPLIT_LIMIT = 10_000_000


def _rp(v: float) -> str:
    return f"Rp {v:,.0f}".replace(",", ".")


def _wib(iso: Optional[str]) -> Optional[datetime]:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(WIB)


async def _dup_invoices(since: str) -> list[dict]:
    db = get_db()
    rows = await db.ap_ledgers.find({"deleted_at": None, "invoice_date": {"$gte": since}},
                                    {"_id": 0, "id": 1, "vendor_id": 1, "invoice_no": 1, "amount": 1, "invoice_date": 1, "outlet_id": 1}).to_list(20000)
    out, by_no, by_amt = [], defaultdict(list), defaultdict(list)
    for r in rows:
        if r.get("invoice_no"):
            by_no[(r["vendor_id"], re.sub(r"[^a-z0-9]", "", str(r["invoice_no"]).lower()))].append(r)
        by_amt[(r["vendor_id"], float(r.get("amount") or 0), r.get("invoice_date"))].append(r)
    seen = set()
    for groups, why in ((by_no, "nomor invoice sama"), (by_amt, "vendor, nominal & tanggal sama")):
        for _, g in groups.items():
            if len(g) < 2:
                continue
            ids = tuple(sorted(x["id"] for x in g))
            if ids in seen:
                continue
            seen.add(ids)
            out.append({"type": "duplicate_invoice", "source_type": "ap_ledger", "source_id": ids[1], "vendor_id": g[0]["vendor_id"],
                        "outlet_id": g[0].get("outlet_id"), "severity": "severe",
                        "title": f"Invoice ganda: {g[0].get('invoice_no') or ''} ({why})",
                        "description": f"{len(g)} invoice AP dengan {why}, total {_rp(sum(float(x.get('amount') or 0) for x in g))}.",
                        "details": {"ap_ids": list(ids), "invoice_no": g[0].get("invoice_no"), "amount": g[0].get("amount")},
                        "recommended_action": "Cocokkan dengan dokumen asli; batalkan salah satu sebelum dibayar."})
    return out


async def _dup_evidence() -> list[dict]:
    db = get_db()
    groups = defaultdict(list)
    async for a in db.attachments.find({"deleted_at": None, "sha256": {"$ne": None}, "source_id": {"$ne": None}},
                                       {"_id": 0, "id": 1, "sha256": 1, "source_type": 1, "source_id": 1, "filename": 1}):
        groups[a["sha256"]].append(a)
    out = []
    for h, g in groups.items():
        srcs = {(a.get("source_type"), a.get("source_id")) for a in g}
        if len(srcs) < 2:
            continue
        out.append({"type": "duplicate_evidence", "source_type": "attachment", "source_id": h[:32], "severity": "severe",
                    "title": f"File bukti yang sama dipakai di {len(srcs)} dokumen",
                    "description": "Foto/berkas identik dilampirkan pada: " + ", ".join(f"{t}:{(i or '')[:8]}" for t, i in sorted(srcs)),
                    "details": {"attachments": [a["id"] for a in g], "sources": [list(s) for s in srcs]},
                    "recommended_action": "Pastikan biaya tidak diklaim dua kali; minta bukti asli."})
    return out


async def _split_purchases(since: str, limit: float) -> list[dict]:
    db = get_db()
    pos = await db.purchase_orders.find({"deleted_at": None, "order_date": {"$gte": since}, "status": {"$nin": ["cancelled", "rejected", "draft"]}},
                                        {"_id": 0, "id": 1, "doc_no": 1, "vendor_id": 1, "outlet_id": 1, "order_date": 1, "grand_total": 1}).to_list(20000)
    by_v = defaultdict(list)
    for p in pos:
        if float(p.get("grand_total") or 0) < limit:
            by_v[(p["vendor_id"], p.get("outlet_id"))].append(p)
    out = []
    for (vid, oid), g in by_v.items():
        g.sort(key=lambda p: p["order_date"])
        for i, p in enumerate(g):
            win = [q for q in g[i:] if date.fromisoformat(q["order_date"][:10]) - date.fromisoformat(p["order_date"][:10]) <= timedelta(days=3)]
            tot = sum(float(q.get("grand_total") or 0) for q in win)
            if len(win) >= 2 and tot >= limit:
                out.append({"type": "split_purchase", "source_type": "purchase_order", "source_id": win[0]["id"], "vendor_id": vid,
                            "outlet_id": oid, "severity": "severe" if tot >= 2 * limit else "mild",
                            "title": f"{len(win)} PO ke vendor sama dalam 3 hari, total {_rp(tot)}",
                            "description": f"Masing-masing di bawah batas approval {_rp(limit)}: " + ", ".join(q.get("doc_no") or q["id"][:8] for q in win),
                            "details": {"po_ids": [q["id"] for q in win], "total": tot, "limit": limit},
                            "recommended_action": "Tanyakan alasan pemecahan; gabungkan & ajukan approval sesuai batas."})
                break
    return out


async def _maker_checker(since: str) -> list[dict]:
    db = get_db()
    out = []
    specs = [("purchase_orders", "purchase_order", ("created_by",), "order_date"),
             ("purchase_requests", "purchase_request", ("requester_user_id", "created_by"), "request_date"),
             ("payment_requests", "payment_request", ("created_by", "requested_by"), "created_at"),
             ("employee_advances", "employee_advance", ("created_by",), "advance_date"),
             ("journal_entries", "journal_entry", ("created_by",), "entry_date")]
    for coll, stype, makers, dfield in specs:
        async for d in db[coll].find({"deleted_at": None, dfield: {"$gte": since}},
                                     {"_id": 0, "id": 1, "doc_no": 1, "approved_by": 1, "approval_chain": 1, "outlet_id": 1, **{m: 1 for m in makers}}):
            maker = next((d.get(m) for m in makers if d.get(m)), None)
            approvers = {d.get("approved_by")} | {s.get("approved_by") or s.get("user_id") for s in d.get("approval_chain") or []
                                                  if isinstance(s, dict) and (s.get("status") in ("approved", None))}
            approvers.discard(None)
            if maker and maker in approvers:
                out.append({"type": "maker_checker", "source_type": stype, "source_id": d["id"], "outlet_id": d.get("outlet_id"),
                            "severity": "mild", "title": f"{d.get('doc_no') or stype}: dibuat & disetujui orang yang sama",
                            "description": "Pemisahan tugas tidak terpenuhi.", "details": {"user_id": maker},
                            "recommended_action": "Atur matriks approval agar penyetuju berbeda dari pembuat."})
    return out


async def _journals(since: str) -> list[dict]:
    db = get_db()
    out = []
    async for j in db.journal_entries.find({"deleted_at": None, "entry_date": {"$gte": since},
                                            "source_type": {"$in": ["manual", "reversal"]}},
                                           {"_id": 0, "id": 1, "doc_no": 1, "source_type": 1, "created_at": 1, "entry_date": 1,
                                            "total_dr": 1, "attachment_ids": 1, "reference": 1, "description": 1, "outlet_id": 1}):
        t = _wib(j.get("created_at"))
        amt = float(j.get("total_dr") or 0)
        if j["source_type"] == "manual" and t and (t.hour >= 22 or t.hour < 6 or t.weekday() == 6):
            out.append({"type": "journal_off_hours", "source_type": "journal_entry", "source_id": j["id"], "outlet_id": j.get("outlet_id"),
                        "severity": "mild", "title": f"Jurnal manual {j.get('doc_no')} dibuat {t:%a %d %b %H:%M} WIB",
                        "description": f"{j.get('description') or ''} · {_rp(amt)}", "details": {"created_at": j.get("created_at")},
                        "recommended_action": "Pastikan jurnal ini sah & didukung dokumen."})
        if j["source_type"] == "manual" and amt >= 5_000_000 and amt % 1_000_000 == 0 and not j.get("attachment_ids") and not j.get("reference"):
            out.append({"type": "round_journal", "source_type": "journal_entry", "source_id": j["id"], "outlet_id": j.get("outlet_id"),
                        "severity": "mild", "title": f"Jurnal manual {j.get('doc_no')} {_rp(amt)} angka bulat tanpa bukti",
                        "description": j.get("description") or "", "details": {"amount": amt},
                        "recommended_action": "Lampirkan dokumen pendukung atau koreksi."})
        if j["source_type"] == "reversal":
            d = date.fromisoformat(j["entry_date"][:10])
            last = (d.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            if (last - d).days <= 2:
                out.append({"type": "reversal_near_close", "source_type": "journal_entry", "source_id": j["id"],
                            "outlet_id": j.get("outlet_id"), "severity": "mild",
                            "title": f"Reversal {j.get('doc_no')} pada {d.isoformat()} (menjelang tutup buku)",
                            "description": j.get("description") or "", "details": {"amount": amt},
                            "recommended_action": "Tinjau alasan reversal & dampaknya ke laporan bulan ini."})
    return out


BENFORD = {d: math.log10(1 + 1 / d) for d in range(1, 10)}


async def _petty_patterns(since: str) -> list[dict]:
    db = get_db()
    by_o = defaultdict(list)
    async for p in db.petty_cash_transactions.find({"deleted_at": None, "txn_date": {"$gte": since}, "type": "purchase"},
                                                   {"_id": 0, "id": 1, "doc_no": 1, "outlet_id": 1, "amount": 1, "description": 1}):
        if float(p.get("amount") or 0) > 0:
            by_o[p.get("outlet_id")].append(p)
    out = []
    for oid, rows in by_o.items():
        amts = [float(r["amount"]) for r in rows]
        if len(amts) >= 50:
            first = [int(str(int(a))[0]) for a in amts if a >= 1]
            n = len(first)
            mad = sum(abs(first.count(dg) / n - BENFORD[dg]) for dg in range(1, 10)) / 9
            if mad > 0.015:
                out.append({"type": "benford_deviation", "source_type": "outlet_petty_cash", "source_id": f"{oid}:{since[:7]}",
                            "outlet_id": oid, "severity": "severe" if mad > 0.022 else "mild",
                            "title": f"Pola digit pertama kas kecil menyimpang (MAD {mad:.3f}, n={n})",
                            "description": "Distribusi angka tidak mengikuti pola alami (hukum Benford) — indikasi angka dikarang/dibulatkan.",
                            "details": {"mad": round(mad, 4), "n": n,
                                        "observed": {dg: round(first.count(dg) / n, 3) for dg in range(1, 10)}},
                            "recommended_action": "Uji petik struk kas kecil toko ini."})
        if len(amts) >= 12:
            mu, sd = mean(amts), pstdev(amts)
            for r in rows:
                if sd and float(r["amount"]) > mu + 3 * sd:
                    out.append({"type": "amount_outlier", "source_type": "petty_cash", "source_id": r["id"], "outlet_id": oid,
                                "severity": "mild", "title": f"Kas kecil {r.get('doc_no')} {_rp(float(r['amount']))} jauh di atas pola toko",
                                "description": f"Rata-rata {_rp(mu)}, simpangan {_rp(sd)}. {r.get('description') or ''}",
                                "details": {"amount": r["amount"], "mean": round(mu, 0), "std": round(sd, 0)},
                                "recommended_action": "Periksa struk & persetujuan transaksi ini."})
    return out


async def _po_prices(since: str) -> list[dict]:
    from services import sourcing_service
    db = get_db()
    out = []
    async for po in db.purchase_orders.find({"deleted_at": None, "order_date": {"$gte": since}, "status": {"$nin": ["cancelled", "rejected"]}},
                                            {"_id": 0, "id": 1, "doc_no": 1, "vendor_id": 1, "outlet_id": 1, "lines": 1}).limit(500):
        try:
            chk = await sourcing_service.price_check([{"item_id": ln.get("item_id"), "unit": ln.get("unit"), "unit_cost": ln.get("unit_cost")}
                                                      for ln in po.get("lines") or []], outlet_id=po.get("outlet_id"), vendor_id=po.get("vendor_id"))
        except Exception:  # noqa: BLE001
            continue
        bad = [(ln, c) for ln, c in zip(po.get("lines") or [], chk.get("lines") or []) if c and "above_benchmark" in c.get("flags", [])]
        if bad:
            worst = max(c["vs_benchmark_pct"] or 0 for _, c in bad)
            out.append({"type": "po_above_benchmark", "source_type": "purchase_order", "source_id": po["id"], "vendor_id": po.get("vendor_id"),
                        "outlet_id": po.get("outlet_id"), "severity": "severe" if worst >= 2 * chk["alert_pct"] else "mild",
                        "title": f"{po.get('doc_no')}: {len(bad)} item di atas acuan pasar (maks. +{worst:.0f}%)",
                        "description": ", ".join(f"{ln.get('item_name')} +{c['vs_benchmark_pct']:.0f}%" for ln, c in bad[:5]),
                        "details": {"items": [{"item_id": ln.get("item_id"), "unit_cost": ln.get("unit_cost"),
                                               "benchmark": (c.get("benchmark") or {}).get("price")} for ln, c in bad]},
                        "recommended_action": "Negosiasi ulang atau dokumentasikan alasan harga."})
    return out


async def _vendor_payments(since: str) -> list[dict]:
    """Pembayaran ke supplier: pembayaran di hutang (AP) + Payments (payment_requests) berstatus paid."""
    db = get_db()
    out = []
    async for a in db.ap_ledgers.find({"deleted_at": None, "payments.0": {"$exists": True}}, {"_id": 0, "vendor_id": 1, "payments": 1, "outlet_id": 1}):
        for p in a.get("payments") or []:
            d = str(p.get("date") or p.get("paid_at") or "")[:10]
            if d >= since:
                out.append({"vendor_id": a["vendor_id"], "amount": float(p.get("amount") or 0), "date": d, "ref": p.get("ref"),
                            "outlet_id": a.get("outlet_id")})
    async for p in db.payment_requests.find({"deleted_at": None, "status": "paid", "payee_type": "vendor"},
                                            {"_id": 0, "payee_id": 1, "amount": 1, "paid_at": 1, "payment_date": 1, "doc_no": 1, "outlet_id": 1}):
        d = str(p.get("payment_date") or p.get("paid_at") or "")[:10]
        if d >= since and p.get("payee_id"):
            out.append({"vendor_id": p["payee_id"], "amount": float(p.get("amount") or 0), "date": d, "ref": p.get("doc_no"),
                        "outlet_id": p.get("outlet_id")})
    return out


async def _vendor_risk(since: str) -> list[dict]:
    """Rekening supplier diubah lalu dibayar ≤ 30 hari (pola penipuan klasik), dan supplier baru (≤ 30 hari) langsung dibayar besar."""
    db = get_db()
    pays = await _vendor_payments(since)
    if not pays:
        return []
    by_v = defaultdict(list)
    for p in pays:
        by_v[p["vendor_id"]].append(p)
    vendors = {v["id"]: v async for v in db.vendors.find({"id": {"$in": list(by_v)}}, {"_id": 0, "id": 1, "name": 1, "created_at": 1})}
    out = []
    async for log in db.audit_log.find({"entity_type": {"$in": ["vendors", "vendor"]}, "entity_id": {"$in": list(by_v)},
                                        "action": {"$in": ["update", "patch"]}}, {"_id": 0}):
        before, after = log.get("before") or {}, log.get("after") or {}
        changed = [f for f in BANK_FIELDS if f in after and str(after.get(f) or "") != str(before.get(f) or "")]
        if not changed:
            continue
        cdate = str(log.get("timestamp") or "")[:10]
        hits = [p for p in by_v[log["entity_id"]] if cdate <= p["date"] <= (datetime.fromisoformat(cdate) + timedelta(days=30)).date().isoformat()] if cdate else []
        if hits:
            tot = sum(p["amount"] for p in hits)
            out.append({"type": "vendor_bank_changed", "source_type": "vendor", "source_id": f"{log['entity_id']}:{cdate}",
                        "vendor_id": log["entity_id"], "severity": "severe", "amount": tot,
                        "title": f"Rekening {vendors.get(log['entity_id'], {}).get('name', 'supplier')} diubah {cdate}, lalu dibayar {_rp(tot)}",
                        "description": f"Field berubah: {', '.join(changed)}; {len(hits)} pembayaran ≤ 30 hari setelahnya.",
                        "details": {"changed_by": log.get("user_id"), "fields": changed, "payments": hits[:10]},
                        "recommended_action": "Konfirmasi perubahan rekening langsung ke supplier lewat kontak lama sebelum pembayaran berikutnya."})
    for vid, ps in by_v.items():
        v = vendors.get(vid) or {}
        created = str(v.get("created_at") or "")[:10]
        if not created or created < since:
            continue
        early = [p for p in ps if p["date"] <= (datetime.fromisoformat(created) + timedelta(days=30)).date().isoformat()]
        tot = sum(p["amount"] for p in early)
        if tot >= NEW_VENDOR_LIMIT:
            out.append({"type": "new_vendor_large_payment", "source_type": "vendor", "source_id": vid, "vendor_id": vid,
                        "severity": "severe" if tot >= 5 * NEW_VENDOR_LIMIT else "mild", "amount": tot,
                        "title": f"Supplier baru {v.get('name')} (dibuat {created}) dibayar {_rp(tot)} dalam 30 hari",
                        "description": f"{len(early)} pembayaran; verifikasi legalitas, NPWP & rekening atas nama perusahaan.",
                        "details": {"payments": early[:10]}, "recommended_action": "Pastikan due diligence supplier & approval pembayaran sudah sesuai."})
    return out


async def _invoice_mismatch(since: str) -> list[dict]:
    from services.ai_finance import reconcile
    days = max(1, (datetime.now(WIB).date() - datetime.fromisoformat(since).date()).days)
    res = await reconcile.three_way({"id": "ai_auditor"}, days=days)
    out = []
    for r in res["rows"]:
        if r["status"] != "selisih" or not r.get("gr_id"):
            continue
        k = r["keterangan"]
        if not any(w in k for w in ("harga GR", "diterima", "≠ nilai GR", "tidak ada di PO")):
            continue
        out.append({"type": "invoice_mismatch", "source_type": "goods_receipt", "source_id": r["gr_id"],
                    "severity": "severe" if "≠ nilai GR" in k or "harga GR" in k else "mild", "amount": r.get("nilai_gr"),
                    "title": f"{r['gr']} ({r.get('vendor') or '-'}) tidak sesuai PO {r.get('po') or ''}".strip(), "description": k,
                    "recommended_action": "Cek dokumen penerimaan & invoice; minta nota kredit bila harga/qty melebihi PO."})
    return out


async def _opname_recurring(since: str) -> list[dict]:
    db = get_db()
    start = (datetime.now(WIB).date() - timedelta(days=120)).isoformat()
    losses = defaultdict(list)
    async for sess in db.opname_sessions.find({"deleted_at": None, "opname_date": {"$gte": start},
                                               "status": {"$in": ["submitted", "approved", "posted", "completed"]}}, {"_id": 0}):
        for ln in sess.get("lines") or []:
            vv = float(ln.get("variance_value") or 0)
            if vv < 0:
                losses[(sess.get("outlet_id"), ln.get("item_id"))].append({"doc": sess.get("doc_no"), "date": sess.get("opname_date"),
                                                                          "qty": ln.get("variance"), "value": vv, "item": ln.get("item_name")})
    out = []
    for (oid, iid), ls in losses.items():
        tot = -sum(x["value"] for x in ls)
        if len({x["doc"] for x in ls}) >= 2 and tot >= 100_000:
            out.append({"type": "opname_recurring_loss", "source_type": "item", "source_id": f"{oid}:{iid}", "outlet_id": oid,
                        "severity": "severe" if tot >= 1_000_000 or len(ls) >= 3 else "mild", "amount": tot,
                        "title": f"{ls[0].get('item') or iid}: kurang di {len(ls)} opname berturut ({_rp(tot)})",
                        "description": "; ".join(f"{x['date']} {x['qty']}" for x in ls[:6]),
                        "recommended_action": "Telusuri resep/porsi, penerimaan, penyimpanan & akses gudang untuk item ini."})
    return out


async def _sensitive_journals(since: str) -> list[dict]:
    from services import gl_mapping
    db = get_db()
    m = await gl_mapping.get_mapping()
    sens: dict[str, str] = {}
    for k in SENSITIVE:
        v = m.get(k)
        for cid in ([v] if isinstance(v, str) else list((v or {}).values()) if isinstance(v, dict) else []):
            if isinstance(cid, str):
                sens[cid] = k
    for k, v in m.items():                       # pemetaan per toko: inventory.<outlet_id>
        if "." in k and k.split(".")[0] in SENSITIVE and isinstance(v, str):
            sens[v] = k.split(".")[0]
    if not sens:
        return []
    groups: dict[tuple, list] = defaultdict(list)
    async for je in db.journal_entries.find({"deleted_at": None, "status": "posted", "entry_date": {"$gte": since},
                                             "source_type": {"$in": [None, "manual"]}}, {"_id": 0}):
        if (je.get("reference") or {}).get("source") in TRUSTED_SOURCES:
            continue
        for ln in je.get("lines") or []:
            if ln.get("coa_id") in sens:
                amt = max(float(ln.get("dr") or 0), float(ln.get("cr") or 0))
                groups[(sens[ln["coa_id"]], ln.get("dim_outlet") or je.get("outlet_id"), str(je.get("entry_date"))[:7])].append(
                    {"id": je["id"], "doc_no": je.get("doc_no"), "date": je.get("entry_date"), "amount": amt,
                     "desc": (je.get("description") or "")[:80]})
    out = []
    for (acct, oid, month), js in groups.items():
        tot = sum(x["amount"] for x in js)
        top = sorted(js, key=lambda x: -x["amount"])
        out.append({"type": "sensitive_account_journal", "source_type": "journal_group", "source_id": f"{acct}:{oid}:{month}",
                    "outlet_id": oid, "severity": "severe" if top[0]["amount"] >= 50_000_000 or len(js) >= 20 else "mild", "amount": tot,
                    "title": f"{len(js)} jurnal manual ke akun {acct} ({month}) · {_rp(tot)}",
                    "description": "; ".join(f"{x['doc_no'] or x['id'][:8]} {_rp(x['amount'])} {x['desc']}" for x in top[:5]),
                    "details": {"journals": [x["id"] for x in top[:50]]},
                    "recommended_action": "Pastikan ada dokumen pendukung & persetujuan; akun kas/bank/persediaan/hutang biasanya diisi "
                                          "otomatis oleh transaksi — jurnal manual rutin ke akun ini tanda proses yang belum otomatis."})
    return out


CHECKS = {"duplicate_invoice": _dup_invoices, "duplicate_evidence": _dup_evidence, "split_purchase": _split_purchases,
          "maker_checker": _maker_checker, "journals": _journals, "petty": _petty_patterns, "po_prices": _po_prices,
          "vendor_risk": _vendor_risk, "invoice_mismatch": _invoice_mismatch, "opname_recurring": _opname_recurring,
          "sensitive_journals": _sensitive_journals}


async def run(*, days: int = 60, user_id: Optional[str] = None, split_limit: float = SPLIT_LIMIT,
              only: Optional[list[str]] = None) -> dict:
    """Jalankan semua pemeriksaan untuk `days` terakhir → upsert ke anomaly_events. Aman diulang (tanpa duplikat)."""
    from services._anomaly.storage_notif import upsert_event
    since = (datetime.now(WIB).date() - timedelta(days=days)).isoformat()
    found, errors = [], {}
    for name, fn in CHECKS.items():
        if only and name not in only:
            continue
        try:
            res = await (fn(since, split_limit) if name == "split_purchase" else fn() if name == "duplicate_evidence" else fn(since))
            found.extend(res)
        except Exception as e:  # noqa: BLE001 — satu pemeriksaan gagal tidak menghentikan yang lain
            logger.exception("auditor check %s gagal", name)
            errors[name] = str(e)[:200]
    today = datetime.now(WIB).date().isoformat()
    for f in found:
        await upsert_event({**f, "period": today[:7], "scan_date": today, "source": "ai_auditor"}, user_id=user_id)
    by = defaultdict(int)
    for f in found:
        by[f["type"]] += 1
    return {"temuan": len(found), "per_jenis": {TYPES.get(k, k): v for k, v in by.items()}, "errors": errors, "sejak": since}
