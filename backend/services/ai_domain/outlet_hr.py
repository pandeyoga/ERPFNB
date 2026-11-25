"""Agen Outlet & HR.

Outlet — **briefing harian per toko**: penjualan kemarin vs rata-rata hari yang sama 4 minggu terakhir, status Daily
Sales (belum disubmit/divalidasi), kas kecil menunggu & saldo, pembelian mendesak menunggu, stok di bawah par,
reservasi hari ini, anomali terbuka → urut "perlu perhatian".

HR — **labor cost %** per toko (payroll bruto + BPJS perusahaan ÷ penjualan validated) dan **cakupan cuti**: hari di mana
banyak karyawan satu toko cuti bersamaan, cuti menunggu persetujuan.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import mean
from typing import Optional

from core.db import get_db
from core.security import scoped_outlet_ids

WIB = timezone(timedelta(hours=7))


def _today() -> date:
    return datetime.now(WIB).date()


def _rp(v: float) -> str:
    return f"Rp {v:,.0f}".replace(",", ".")


async def _outlets(user: dict, outlet_id: Optional[str] = None) -> dict[str, str]:
    ids = scoped_outlet_ids(user)
    q: dict = {"deleted_at": None}
    if outlet_id:
        if ids is not None and outlet_id not in ids:
            from core.exceptions import ForbiddenError
            raise ForbiddenError("Toko di luar akses Anda")
        q["id"] = outlet_id
    elif ids is not None:
        q["id"] = {"$in": ids}
    return {o["id"]: o["name"] async for o in get_db().outlets.find(q, {"_id": 0, "id": 1, "name": 1})}


async def outlet_briefing(user: dict, *, outlet_id: Optional[str] = None, on: Optional[str] = None) -> dict:
    db = get_db()
    day = date.fromisoformat(on) if on else _today() - timedelta(days=1)
    outlets = await _outlets(user, outlet_id)
    ids = list(outlets)
    same = [(day - timedelta(days=7 * k)).isoformat() for k in range(1, 5)]
    sales: dict[tuple, dict] = {}
    async for ds in db.daily_sales.find({"outlet_id": {"$in": ids}, "deleted_at": None, "sales_date": {"$in": [day.isoformat(), *same]}},
                                        {"_id": 0, "outlet_id": 1, "sales_date": 1, "status": 1, "grand_total": 1, "transaction_count": 1}):
        sales[(ds["outlet_id"], ds["sales_date"])] = ds
    today = _today().isoformat()
    pc_pending = defaultdict(int)
    async for t in db.petty_cash_transactions.find({"outlet_id": {"$in": ids}, "deleted_at": None, "status": {"$in": ["pending", "submitted"]}},
                                                   {"_id": 0, "outlet_id": 1}):
        pc_pending[t["outlet_id"]] += 1
    up_pending = defaultdict(int)
    async for t in db.urgent_purchases.find({"outlet_id": {"$in": ids}, "deleted_at": None, "status": {"$in": ["pending", "submitted"]}},
                                            {"_id": 0, "outlet_id": 1}):
        up_pending[t["outlet_id"]] += 1
    resv = defaultdict(lambda: [0, 0])
    async for r in db.reservations.find({"outlet_id": {"$in": ids}, "reservation_date": today, "deleted_at": None,
                                         "status": {"$nin": ["cancelled", "no_show"]}}, {"_id": 0, "outlet_id": 1, "pax": 1}):
        resv[r["outlet_id"]][0] += 1
        resv[r["outlet_id"]][1] += int(r.get("pax") or 0)
    anom = defaultdict(int)
    async for a in db.anomaly_events.find({"outlet_id": {"$in": ids}, "status": {"$in": ["open", "investigating"]}, "deleted_at": None},
                                          {"_id": 0, "outlet_id": 1}):
        anom[a["outlet_id"]] += 1
    low = defaultdict(int)
    try:
        from services import inventory_matrix_service
        ls = await inventory_matrix_service.low_stock(outlet_ids=ids)
        for it in ls.get("items") or []:
            low[it["outlet_id"]] += 1
    except Exception:  # noqa: BLE001
        pass
    rows = []
    for oid, name in outlets.items():
        cur = sales.get((oid, day.isoformat()))
        base = [float(sales[(oid, d)]["grand_total"] or 0) for d in same if (oid, d) in sales and sales[(oid, d)].get("status") != "draft"]
        avg = mean(base) if base else None
        rev = float((cur or {}).get("grand_total") or 0)
        chg = round((rev - avg) / avg * 100, 1) if avg and cur else None
        notes, score = [], 0
        if not cur:
            notes.append("Daily Sales kemarin belum diinput")
            score += 3
        elif cur.get("status") in ("draft",):
            notes.append("Daily Sales kemarin masih draft")
            score += 2
        elif cur.get("status") != "validated":
            notes.append(f"Daily Sales menunggu validasi ({cur.get('status')})")
            score += 1
        if chg is not None and chg <= -20:
            notes.append(f"penjualan {chg}% vs rata-rata {day:%A} 4 minggu")
            score += 2
        for n, label, w in ((pc_pending[oid], "kas kecil menunggu persetujuan", 1), (up_pending[oid], "pembelian mendesak menunggu", 1),
                            (low[oid], "item di bawah par", 1), (anom[oid], "anomali terbuka", 2)):
            if n:
                notes.append(f"{n} {label}")
                score += w
        rows.append({"toko": name, "outlet_id": oid, "penjualan": rev if cur else None, "rata2_hari_sama": round(avg, 0) if avg else None,
                     "perubahan_pct": chg, "transaksi": (cur or {}).get("transaction_count"),
                     "rata2_per_transaksi": round(rev / cur["transaction_count"], 0) if cur and cur.get("transaction_count") else None,
                     "reservasi_hari_ini": resv[oid][0], "pax_hari_ini": resv[oid][1], "perhatian": notes, "skor": score})
    rows.sort(key=lambda r: (-r["skor"], -(r["penjualan"] or 0)))
    return {"tanggal": day.isoformat(), "rows": rows,
            "ringkasan": {"toko": len(rows), "perlu_perhatian": sum(1 for r in rows if r["skor"] >= 2),
                          "total_penjualan": round(sum(r["penjualan"] or 0 for r in rows), 0)}}


async def labor_cost(user: dict, *, period: Optional[str] = None, alert_pct: float = 30.0) -> dict:
    db = get_db()
    period = period or (_today().replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    outlets = await _outlets(user)
    pay: dict[Optional[str], float] = defaultdict(float)
    heads: dict[Optional[str], int] = defaultdict(int)
    async for pc in db.payroll_cycles.find({"period": period, "deleted_at": None, "status": {"$nin": ["cancelled", "draft"]}}, {"_id": 0}):
        emps = pc.get("employees") or []
        if emps and any(e.get("outlet_id") for e in emps):
            for e in emps:
                pay[e.get("outlet_id") or pc.get("outlet_id")] += float(e.get("gross") or e.get("total_gross") or 0) + float(e.get("bpjs_employer") or 0)
                heads[e.get("outlet_id") or pc.get("outlet_id")] += 1
        else:
            pay[pc.get("outlet_id")] += float(pc.get("total_gross") or 0) + float(pc.get("total_bpjs_employer") or 0)
            heads[pc.get("outlet_id")] += len(emps)
    rev: dict[str, float] = defaultdict(float)
    async for ds in db.daily_sales.find({"sales_date": {"$regex": f"^{period}"}, "status": "validated", "deleted_at": None},
                                        {"_id": 0, "outlet_id": 1, "grand_total": 1}):
        rev[ds["outlet_id"]] += float(ds.get("grand_total") or 0)
    rows = []
    for oid in set(pay) | set(rev):
        if oid is not None and oid not in outlets:
            continue
        p, r = round(pay.get(oid, 0.0), 0), round(rev.get(oid, 0.0), 0)
        pct = round(p / r * 100, 1) if r else None
        rows.append({"toko": outlets.get(oid, "(kantor pusat / tanpa toko)"), "outlet_id": oid, "biaya_tenaga_kerja": p, "penjualan": r,
                     "labor_cost_pct": pct, "karyawan": heads.get(oid, 0),
                     "status": "tinggi" if pct is not None and pct > alert_pct else "wajar" if pct is not None else "tanpa_penjualan"})
    rows.sort(key=lambda x: -(x["labor_cost_pct"] or 0))
    tp, tr = sum(r["biaya_tenaga_kerja"] for r in rows), sum(r["penjualan"] for r in rows)
    return {"period": period, "rows": rows, "ringkasan": {"biaya_tenaga_kerja": tp, "penjualan": tr,
                                                          "labor_cost_pct": round(tp / tr * 100, 1) if tr else None, "batas_pct": alert_pct}}


async def leave_coverage(user: dict, *, start: Optional[str] = None, end: Optional[str] = None, max_share: float = 0.3) -> dict:
    db = get_db()
    s = date.fromisoformat(start) if start else _today()
    e = date.fromisoformat(end) if end else s + timedelta(days=13)
    outlets = await _outlets(user)
    heads = defaultdict(int)
    names = {}
    async for emp in db.employees.find({"deleted_at": None, "status": {"$in": ["active", None]}}, {"_id": 0, "id": 1, "outlet_id": 1, "full_name": 1}):
        heads[emp.get("outlet_id")] += 1
        names[emp["id"]] = emp.get("full_name")
    off: dict[tuple, list] = defaultdict(list)
    pending = []
    async for lv in db.leave_requests.find({"deleted_at": None, "status": {"$in": ["approved", "pending", "submitted"]},
                                            "start_date": {"$lte": e.isoformat()}, "end_date": {"$gte": s.isoformat()}}, {"_id": 0}):
        if lv.get("outlet_id") and lv["outlet_id"] not in outlets:
            continue
        if lv.get("status") != "approved":
            pending.append({"no": lv.get("doc_no"), "karyawan": names.get(lv.get("employee_id")), "toko": outlets.get(lv.get("outlet_id")),
                            "mulai": lv.get("start_date"), "selesai": lv.get("end_date"), "jenis": lv.get("leave_type")})
        d0 = max(s, date.fromisoformat(lv["start_date"][:10]))
        d1 = min(e, date.fromisoformat(lv["end_date"][:10]))
        while d0 <= d1:
            off[(lv.get("outlet_id"), d0.isoformat())].append(names.get(lv.get("employee_id")) or lv.get("employee_id"))
            d0 += timedelta(days=1)
    rows = []
    for (oid, d), who in sorted(off.items(), key=lambda x: (x[0][1], str(x[0][0]))):
        h = heads.get(oid) or 0
        share = len(who) / h if h else None
        rows.append({"tanggal": d, "toko": outlets.get(oid, "-"), "outlet_id": oid, "cuti": len(who), "karyawan": h,
                     "persen": round(share * 100, 0) if share is not None else None, "nama": ", ".join(str(w) for w in who[:6]),
                     "status": "kurang_orang" if share is not None and share > max_share else "aman"})
    return {"periode": [s.isoformat(), e.isoformat()], "rows": rows, "menunggu_persetujuan": pending,
            "ringkasan": {"hari_kurang_orang": sum(1 for r in rows if r["status"] == "kurang_orang"), "cuti_menunggu": len(pending)}}
