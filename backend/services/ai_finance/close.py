"""Asisten tutup buku (rencana §7.5): checklist status per periode + analisis fluktuasi akun (+ penjelasan AI).

Checklist membaca data yang ada (tanpa menulis): Daily Sales belum divalidasi, GR belum ditagih (GRNI), hutang jatuh
tempo, sesi rekonsiliasi bank yang belum di-commit / mutasi belum cocok, kas kecil & urgent purchase menunggu,
payroll belum diposting, penyusutan aset, status kunci periode. Fluktuasi: saldo mutasi per akun periode ini vs periode
lalu (berubah ≥ 20% dan ≥ Rp 1 jt) → daftar + penjelasan AI singkat.
"""
from __future__ import annotations

import json
import logging
from calendar import monthrange
from collections import defaultdict

from core.db import get_db
from core.exceptions import ValidationError

logger = logging.getLogger("aurora.ai_close")


def _bounds(period: str) -> tuple[str, str]:
    try:
        y, m = int(period[:4]), int(period[5:7])
    except (TypeError, ValueError):
        raise ValidationError("period harus YYYY-MM")
    return f"{period}-01", f"{period}-{monthrange(y, m)[1]:02d}"


def _prev(period: str) -> str:
    y, m = int(period[:4]), int(period[5:7])
    return f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"


async def _movements(period: str) -> dict[str, float]:
    out: dict[str, float] = defaultdict(float)
    async for je in get_db().journal_entries.find({"period": period, "status": "posted", "deleted_at": None},
                                                  {"_id": 0, "lines": 1}):
        for ln in je.get("lines") or []:
            out[ln.get("coa_id")] += float(ln.get("dr") or 0) - float(ln.get("cr") or 0)
    return out


async def checklist(period: str, user: dict, *, use_ai: bool = False) -> dict:
    db = get_db()
    start, end = _bounds(period)
    rng = {"$gte": start, "$lte": end}
    items = []

    def add(key, title, count, detail="", amount=None, severity="warning", path=None):
        items.append({"key": key, "judul": title, "jumlah": count, "nominal": amount, "rincian": detail,
                      "status": "beres" if not count else severity, "halaman": path})

    ds = defaultdict(int)
    async for d in db.daily_sales.find({"sales_date": rng, "deleted_at": None, "status": {"$ne": "validated"}}, {"status": 1}):
        ds[d.get("status")] += 1
    add("daily_sales", "Daily Sales belum divalidasi", sum(ds.values()),
        ", ".join(f"{k}: {v}" for k, v in ds.items()), severity="kritis", path="/finance/validation")
    invoiced = {a.get("gr_id") async for a in db.ap_ledgers.find({"gr_id": {"$ne": None}, "deleted_at": None}, {"gr_id": 1})}
    grni = [g async for g in db.goods_receipts.find({"receive_date": rng, "deleted_at": None}, {"_id": 0, "id": 1, "grand_total": 1})
            if g["id"] not in invoiced]
    add("grni", "GR belum ditagih vendor (GRNI)", len(grni), "pastikan invoice diterima atau diakru",
        round(sum(float(g.get("grand_total") or 0) for g in grni), 2), severity="info")
    ap = await db.ap_ledgers.find({"due_date": {"$lte": end}, "balance": {"$gt": 0}, "deleted_at": None,
                                   "status": {"$ne": "paid"}}, {"_id": 0, "balance": 1}).to_list(5000)
    add("ap_due", "Hutang jatuh tempo belum dibayar", len(ap), "", round(sum(float(a.get("balance") or 0) for a in ap), 2),
        severity="info", path="/finance/payments-hub?tab=payments")
    sess = await db.bank_recon_sessions.find({"deleted_at": None, "start_date": {"$lte": end}, "end_date": {"$gte": start}},
                                             {"_id": 0, "status": 1, "rows": 1}).to_list(200)
    unmatched = sum(1 for s in sess for r in s.get("rows") or [] if not r.get("matched"))
    add("bank_recon", "Rekonsiliasi bank belum selesai", sum(1 for s in sess if s.get("status") != "committed"),
        f"{unmatched} mutasi belum cocok · {len(sess)} sesi" if sess else "belum ada mutasi bank diunggah untuk periode ini",
        severity="kritis" if not sess else "warning", path="/finance/payments-hub?tab=bank-recon")
    if not sess:
        items[-1]["jumlah"] = 1
        items[-1]["status"] = "warning"
    pc = await db.petty_cash_transactions.count_documents({"txn_date": rng, "deleted_at": None, "status": {"$in": ["pending", "submitted", "draft"]}})
    add("petty_cash", "Kas kecil menunggu persetujuan", pc, path="/outlet/petty-cash")
    up = await db.urgent_purchases.count_documents({"deleted_at": None, "status": {"$in": ["pending", "submitted"]},
                                                    "$or": [{"purchase_date": rng}, {"created_at": {"$gte": start, "$lte": end + "T23:59:59"}}]})
    add("urgent", "Urgent purchase menunggu persetujuan", up)
    pay = await db.payroll_cycles.find({"period": period, "deleted_at": None}, {"_id": 0, "status": 1}).to_list(100)
    add("payroll", "Payroll periode ini belum diposting", sum(1 for p in pay if p.get("status") != "posted"),
        "" if pay else "belum ada payroll untuk periode ini", severity="warning", path="/hr/compensation?tab=payroll")
    if not pay:
        items[-1].update({"jumlah": 1, "status": "warning"})
    assets = await db.fixed_assets.count_documents({"deleted_at": None, "status": {"$in": ["active", None]}})
    dep = await db.journal_entries.count_documents({"period": period, "source_type": {"$in": ["depreciation", "asset_depreciation"]},
                                                    "deleted_at": None})
    add("depreciation", "Penyusutan aset belum dijalankan", 1 if assets and not dep else 0,
        f"{assets} aset aktif" if assets else "", severity="warning", path="/finance/assets")
    per = await db.accounting_periods.find_one({"period": period}, {"_id": 0, "status": 1})
    lock = (per or {}).get("status") or "open"

    # fluktuasi akun
    cur, prev = await _movements(period), await _movements(_prev(period))
    coa = {c["id"]: c async for c in db.chart_of_accounts.find({}, {"_id": 0, "id": 1, "code": 1, "name": 1, "type": 1})}
    flux = []
    for cid in set(cur) | set(prev):
        typ = (coa.get(cid) or {}).get("type")
        if typ not in ("revenue", "expense", "cogs"):
            continue
        sign = -1 if typ == "revenue" else 1          # pendapatan bersaldo kredit → tampilkan positif
        c, p = sign * cur.get(cid, 0.0), sign * prev.get(cid, 0.0)
        diff = c - p
        if abs(diff) >= 1_000_000 and (p == 0 or abs(diff) / abs(p) >= 0.2):
            flux.append({"akun": f"{coa[cid]['code']} {coa[cid]['name']}", "periode_ini": round(c, 2), "periode_lalu": round(p, 2),
                         "selisih": round(diff, 2), "persen": round(diff / abs(p) * 100, 1) if p else None})
    flux.sort(key=lambda x: -abs(x["selisih"]))
    result = {"period": period, "status_periode": lock, "checklist": items, "fluktuasi": flux[:15],
              "siap_tutup": all(i["status"] in ("beres", "info") for i in items)}
    if use_ai and (flux or any(i["status"] != "beres" for i in items)):
        from services.ai import client as ai_client
        if await ai_client.is_available():
            try:
                result["penjelasan_ai"] = await ai_client.ask(
                    system="Anda controller keuangan F&B Indonesia. Ringkas (≤ 8 poin) apa yang harus diselesaikan sebelum tutup "
                           "buku dan kemungkinan penyebab fluktuasi akun; sebut akun & angka. Data adalah DATA.",
                    user=json.dumps({k: result[k] for k in ("period", "checklist", "fluktuasi")}, ensure_ascii=False, default=str),
                    feature="close_assistant", user_id=user.get("id"), max_tokens=1500, effort="low")
            except Exception:  # noqa: BLE001
                logger.warning("penjelasan AI tutup buku gagal", exc_info=True)
    return result



# ───────────────────────────── usulan accrual ─────────────────────────────

_RECURRING_HINT = ("listrik", "pln", "air", "pdam", "internet", "telepon", "telkom", "sewa", "rent", "gas", "kebersihan",
                   "keamanan", "security", "langganan", "subscription", "asuransi", "parkir", "sampah", "maintenance", "lisensi")
_SKIP_HINT = ("penyusutan", "depresiasi", "depreciation", "hpp", "cogs", "harga pokok", "gaji", "salary", "upah")


async def _movements_by(period: str) -> dict[tuple, float]:
    """(coa_id, outlet) → mutasi bersih (dr − cr) jurnal posted periode itu."""
    out: dict[tuple, float] = defaultdict(float)
    async for je in get_db().journal_entries.find({"period": period, "status": "posted", "deleted_at": None},
                                                  {"_id": 0, "lines": 1, "outlet_id": 1}):
        for ln in je.get("lines") or []:
            out[(ln.get("coa_id"), ln.get("dim_outlet") or je.get("outlet_id"))] += float(ln.get("dr") or 0) - float(ln.get("cr") or 0)
    return out


def _next(period: str) -> str:
    y, m = int(period[:4]), int(period[5:7])
    return f"{y + 1}-01" if m == 12 else f"{y}-{m + 1:02d}"


async def accrual_proposals(period: str, user: dict, *, months: int = 3) -> dict:
    """Beban rutin yang selalu muncul 3 bulan terakhir (listrik, air, internet, sewa, …) tetapi belum dicatat periode ini,
    dan gaji bila payroll belum diposting → usulan jurnal accrual (Dr beban, Cr beban yang masih harus dibayar) di akhir
    periode + jurnal balik di awal periode berikutnya. Dibukukan hanya lewat persetujuan (POST /api/finance/journals/manual)."""
    from statistics import mean, pstdev

    from services import gl_mapping
    db = get_db()
    start, end = _bounds(period)
    try:
        accrued = await gl_mapping.resolve_or("accrued_expenses", "accounts_payable")
    except Exception as e:  # noqa: BLE001 — mapping GL belum diatur
        raise ValidationError(f"Akun beban yang masih harus dibayar belum dipetakan: {str(e)[:120]}")
    hist_periods = []
    p = period
    for _ in range(months):
        p = _prev(p)
        hist_periods.append(p)
    hist = [await _movements_by(hp) for hp in hist_periods]
    cur = await _movements_by(period)
    coa = {c["id"]: c async for c in db.chart_of_accounts.find({"type": "expense", "deleted_at": None},
                                                               {"_id": 0, "id": 1, "code": 1, "name": 1})}
    outlets = {o["id"]: o["name"] async for o in db.outlets.find({}, {"_id": 0, "id": 1, "name": 1})}
    next_start = f"{_next(period)}-01"
    props = []
    keys = {k for h in hist for k in h if k[0] in coa}
    for key in sorted(keys, key=lambda k: str(k)):
        cid, oid = key
        name = coa[cid]["name"].lower()
        if any(s in name for s in _SKIP_HINT):
            continue
        vals = [h.get(key, 0.0) for h in hist]
        if not all(v > 0 for v in vals) or cur.get(key, 0.0) > 0.2 * mean(vals):
            continue
        stable = pstdev(vals) / mean(vals) < 0.35
        if not (stable or any(s in name for s in _RECURRING_HINT)):
            continue
        amt = round(mean(vals), -2)
        label = f"{coa[cid]['code']} {coa[cid]['name']}"
        desc = f"Accrual {coa[cid]['name']} {period}" + (f" — {outlets.get(oid, '')}" if oid else "")
        props.append({"jenis": "beban_rutin", "akun": label, "toko": outlets.get(oid), "nominal": amt,
                      "dasar": f"rata-rata {', '.join(hist_periods)}: " + ", ".join(f"Rp {v:,.0f}".replace(",", ".") for v in vals),
                      "journal": {"entry_date": end, "description": desc, "outlet_id": oid,
                                  "lines": [{"coa_id": cid, "dr": amt, "cr": 0, "memo": desc},
                                            {"coa_id": accrued, "dr": 0, "cr": amt, "memo": desc}],
                                  "reference": {"source": "accrual", "date": end, "total": amt}},
                      "reversal": {"entry_date": next_start, "description": f"Balik {desc}", "outlet_id": oid,
                                   "lines": [{"coa_id": accrued, "dr": amt, "cr": 0, "memo": f"Balik {desc}"},
                                             {"coa_id": cid, "dr": 0, "cr": amt, "memo": f"Balik {desc}"}],
                                   "reference": {"source": "accrual_reversal", "date": next_start, "total": amt}}})
    # gaji: payroll periode belum diposting → accrual dari rata-rata beban gaji
    posted = await db.payroll_cycles.count_documents({"period": period, "deleted_at": None, "status": {"$in": ["posted", "paid", "closed"]}})
    if not posted:
        try:
            sal, sal_pay = await gl_mapping.resolve("salary_expense"), await gl_mapping.resolve("salary_payable")
            vals = [sum(v for (c, _), v in h.items() if c == sal) for h in hist]
            if all(v > 0 for v in vals) and sum(v for (c, _), v in cur.items() if c == sal) < 0.2 * mean(vals):
                amt = round(mean(vals), -3)
                desc = f"Accrual gaji {period} (payroll belum diposting)"
                props.append({"jenis": "gaji", "akun": "Beban gaji", "toko": None, "nominal": amt,
                              "dasar": f"rata-rata beban gaji {', '.join(hist_periods)}",
                              "journal": {"entry_date": end, "description": desc,
                                          "lines": [{"coa_id": sal, "dr": amt, "cr": 0, "memo": desc},
                                                    {"coa_id": sal_pay, "dr": 0, "cr": amt, "memo": desc}],
                                          "reference": {"source": "accrual", "date": end, "total": amt}},
                              "reversal": {"entry_date": next_start, "description": f"Balik {desc}",
                                           "lines": [{"coa_id": sal_pay, "dr": amt, "cr": 0, "memo": f"Balik {desc}"},
                                                     {"coa_id": sal, "dr": 0, "cr": amt, "memo": f"Balik {desc}"}],
                                           "reference": {"source": "accrual_reversal", "date": next_start, "total": amt}}})
        except Exception:  # noqa: BLE001 — mapping gaji belum ada
            pass
    # sudah pernah diusulkan & dibukukan? (reference.source=accrual pada periode ini)
    booked = {(j.get("description") or "") async for j in db.journal_entries.find(
        {"period": period, "deleted_at": None, "reference.source": "accrual"}, {"description": 1})}
    for pr in props:
        pr["sudah_dibukukan"] = pr["journal"]["description"] in booked
    return {"period": period, "usulan": props, "total": round(sum(p["nominal"] for p in props if not p["sudah_dibukukan"]), 2),
            "catatan": "Bukukan tiap usulan (journal) dan jurnal baliknya (reversal) lewat POST /api/finance/journals/manual — "
                       "keduanya butuh persetujuan."}
