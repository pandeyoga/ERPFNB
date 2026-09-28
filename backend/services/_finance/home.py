"""Finance home dashboard and sales validation queue."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from core.db import get_db, serialize


async def sales_validation_queue(
    *,
    period: Optional[str] = None,
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], dict]:
    """Queue of daily sales waiting for Finance validation."""
    db = get_db()
    q: dict = {"deleted_at": None}
    if period:
        q["sales_date"] = {"$gte": f"{period}-01", "$lte": f"{period}-31"}
    if outlet_id:
        q["outlet_id"] = outlet_id
    if status:
        q["status"] = status
    else:
        q["status"] = {"$in": ["submitted", "validated", "rejected"]}
    skip = (page - 1) * per_page
    items = await db.daily_sales.find(q).sort([("sales_date", 1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.daily_sales.count_documents(q)
    outlet_ids = list({d.get("outlet_id") for d in items if d.get("outlet_id")})
    outlet_names: dict[str, str] = {}
    async for o in db.outlets.find({"id": {"$in": outlet_ids}}):
        outlet_names[o["id"]] = o.get("name", o["id"])
    result = []
    for d in items:
        r = serialize(d)
        r["outlet_name"] = outlet_names.get(r.get("outlet_id"), r.get("outlet_id", ""))
        result.append(r)
    return result, {"page": page, "per_page": per_page, "total": total}


async def finance_home() -> dict:
    """Finance dashboard summary."""
    db = get_db()
    today = date.today().isoformat()
    period = today[:7]

    pending_sales = await db.daily_sales.count_documents({"deleted_at": None, "status": "submitted"})
    period_from_service_start = f"{period}-01"
    revenue_agg = await db.daily_sales.aggregate([
        {"$match": {"deleted_at": None, "status": "validated", "sales_date": {"$gte": period_from_service_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$grand_total"}}},
    ]).to_list(1)
    revenue_mtd = float(revenue_agg[0]["total"]) if revenue_agg else 0.0

    from services._finance.ap import ap_aging
    ap_data = await ap_aging()
    ap_overdue_total = float(ap_data.get("buckets", {}).get("d_90p", 0))

    today_period = await db.accounting_periods.find_one({"period": period})
    period_status = (today_period or {}).get("status", "open")

    outstanding_ar = 0.0
    async for inv in db.ar_invoices.find({"status": {"$nin": ["paid", "cancelled"]}, "deleted_at": None}):
        outstanding_ar += float(inv.get("outstanding", 0))

    return {
        "period": period,
        "pending_sales_validation": pending_sales,
        "revenue_mtd": round(revenue_mtd, 2),
        "ap_overdue_90p": round(ap_overdue_total, 2),
        "ar_outstanding": round(outstanding_ar, 2),
        "period_status": period_status,
        "ap_exposure": round(ap_data.get("grand_total", 0), 2),
    }
