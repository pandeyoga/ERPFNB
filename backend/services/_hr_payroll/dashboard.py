"""HR Dashboard summary."""
from __future__ import annotations

from core.db import get_db
from services.hr_constants import _period_now


async def hr_dashboard() -> dict:
    db = get_db()
    period = _period_now()
    active_emp = await db.employees.count_documents({"deleted_at": None, "status": "active"})
    # "Open advances" = advances still in-flight (being approved OR being repaid).
    # This stays consistent with the "Tindakan Tertunda" card which also surfaces
    # pending (draft/awaiting) kasbon — previously only `repaying` was counted, so
    # a single draft kasbon made the KPI read 0 while the pending card showed 1.
    open_advances = await db.employee_advances.count_documents(
        {"deleted_at": None, "status": {"$in": ["awaiting_approval", "repaying"]}})
    pending_adv = await db.employee_advances.count_documents(
        {"deleted_at": None, "status": {"$in": ["draft", "awaiting_approval"]}})
    advances = await db.employee_advances.find(
        {"deleted_at": None, "status": {"$in": ["awaiting_approval", "repaying"]}}).to_list(1000)
    outstanding = 0.0
    for a in advances:
        sched = a.get("schedule") or []
        if sched:
            # Sum unpaid scheduled installments (true remaining principal).
            for line in sched:
                if not line.get("paid"):
                    outstanding += float(line.get("amount", 0) or 0)
        else:
            # No schedule yet (e.g. awaiting approval) → full principal is outstanding.
            outstanding += float(a.get("principal", 0) or 0)
    sc_pending = await db.service_charge_periods.count_documents({"deleted_at": None, "period": period, "status": {"$in": ["calculated", "approved"]}})
    issued_unredeemed = await db.vouchers.count_documents({"deleted_at": None, "status": "issued"})
    voucher_liab_cursor = db.vouchers.aggregate([{"$match": {"deleted_at": None, "status": "issued"}}, {"$group": {"_id": None, "total": {"$sum": "$value"}}}])
    res = await voucher_liab_cursor.to_list(1)
    voucher_liability = float(res[0]["total"]) if res else 0.0
    cursor = db.lb_fund_ledger.aggregate([{"$match": {"deleted_at": None}}, {"$group": {"_id": None, "balance": {"$sum": {"$cond": [{"$eq": ["$direction", "in"]}, "$amount", {"$multiply": ["$amount", -1]}]}}}}])
    res2 = await cursor.to_list(1)
    lb_balance = float(res2[0]["balance"]) if res2 else 0.0
    inc_pending = await db.incentive_runs.count_documents({"deleted_at": None, "period": period, "status": {"$in": ["calculated", "approved"]}})
    return {
        "period": period, "active_employees": active_emp, "open_advances": open_advances,
        "pending_advance_approval": pending_adv, "advance_outstanding": round(outstanding, 2),
        "service_charge_pending": sc_pending, "incentive_pending": inc_pending,
        "voucher_unredeemed_count": issued_unredeemed, "voucher_liability": round(voucher_liability, 2),
        "lb_fund_balance": round(lb_balance, 2),
    }
