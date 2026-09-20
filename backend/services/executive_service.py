"""Executive services: KPI dashboards, drill-down, sales trend."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db
from services import executive_service as _self_module  # noqa: F401  # for self ref
from services import inventory_service
from services.cache_service import cache_or_compute

logger = logging.getLogger("aurora.executive")


async def executive_home():
    """Executive dashboard home - quick summary."""
    # Return aggregated KPIs for home dashboard
    kpi_data = await kpis(period=None, brand_ids=None, outlet_ids=None)
    
    return {
        "summary": kpi_data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "quick_stats": {
            "total_revenue": kpi_data.get('sales_mtd', 0),
            "ap_exposure": kpi_data.get('ap_exposure', 0),
            "inventory_value": kpi_data.get('inventory_value', 0),
        }
    }


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@cache_or_compute("exec_kpis", ttl_sec=60)
async def kpis(
    *,
    period: Optional[str] = None,
    brand_ids: Optional[list[str]] = None,
    outlet_ids: Optional[list[str]] = None,
) -> dict:
    """Top-level executive KPIs:
    - sales MTD / WTD (validated daily sales grand_total)
    - inventory_value (latest valuation)
    - ap_exposure (sum unpaid GR)
    - opname_pending (in_progress sessions)
    - submitted_validations
    - top outlets by sales MTD

    Phase 9A: optional brand_ids / outlet_ids filters.
    """
    db = get_db()
    today = datetime.now(timezone.utc).date()
    period = period or today.strftime("%Y-%m")
    period_start = f"{period}-01"
    next_period = _next_period(period)
    next_start = f"{next_period}-01"

    # Resolve effective outlet filter (brand_ids → expand to outlet_ids)
    effective_outlets: Optional[list[str]] = None
    if brand_ids:
        outlet_ids_from_brand = []
        async for o in db.outlets.find({"brand_id": {"$in": brand_ids}, "deleted_at": None}):
            outlet_ids_from_brand.append(o["id"])
        if outlet_ids:
            effective_outlets = [o for o in outlet_ids if o in outlet_ids_from_brand]
        else:
            effective_outlets = outlet_ids_from_brand
    elif outlet_ids:
        effective_outlets = outlet_ids

    # Sales MTD (validated)
    sales_match: dict = {
        "deleted_at": None,
        "status": "validated",
        "sales_date": {"$gte": period_start, "$lt": next_start},
    }
    if effective_outlets is not None:
        sales_match["outlet_id"] = {"$in": effective_outlets}

    pipeline = [
        {"$match": sales_match},
        {"$group": {
            "_id": "$outlet_id",
            "total": {"$sum": {"$ifNull": ["$grand_total", 0]}},
            "trx": {"$sum": {"$ifNull": ["$transaction_count", 0]}},
            "days": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]
    by_outlet: list[dict] = []
    async for d in db.daily_sales.aggregate(pipeline):
        by_outlet.append({
            "outlet_id": d["_id"],
            "total": round(d["total"], 2),
            "trx": d["trx"], "days": d["days"],
        })
    sales_mtd = sum(r["total"] for r in by_outlet)

    # Sales WTD (Mon–today)
    weekday = today.weekday()  # 0=Mon
    week_start = (today - timedelta(days=weekday)).isoformat()
    week_end = today.isoformat()
    wtd_total = 0.0
    wtd_match: dict = {
        "deleted_at": None, "status": "validated",
        "sales_date": {"$gte": week_start, "$lte": week_end},
    }
    if effective_outlets is not None:
        wtd_match["outlet_id"] = {"$in": effective_outlets}
    async for d in db.daily_sales.aggregate([
        {"$match": wtd_match},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$grand_total", 0]}}}},
    ]):
        wtd_total = float(d["total"])

    # Today
    today_total = 0.0
    today_match: dict = {
        "deleted_at": None, "status": "validated",
        "sales_date": today.isoformat(),
    }
    if effective_outlets is not None:
        today_match["outlet_id"] = {"$in": effective_outlets}
    async for d in db.daily_sales.aggregate([
        {"$match": today_match},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$grand_total", 0]}}}},
    ]):
        today_total = float(d["total"])

    # Inventory value (use shared inventory_service.valuation for correctness)
    if effective_outlets is not None and len(effective_outlets) == 1:
        val = await inventory_service.valuation(outlet_id=effective_outlets[0])
    else:
        val = await inventory_service.valuation()
    inv_value = float(val.get("total_value", 0))
    inv_count = int(val.get("item_count", 0))

    # AP exposure
    gr_filter: dict = {"deleted_at": None}
    if effective_outlets is not None:
        gr_filter["outlet_id"] = {"$in": effective_outlets}
    grs = await db.goods_receipts.find(gr_filter).to_list(10000)
    ap_total = sum(float(g.get("grand_total", 0)) for g in grs
                   if not g.get("paid_at") and g.get("payment_status") != "paid")

    # Pending sales validation
    pv_filter: dict = {"deleted_at": None, "status": "submitted"}
    if effective_outlets is not None:
        pv_filter["outlet_id"] = {"$in": effective_outlets}

    # Opname pending
    op_filter: dict = {"deleted_at": None, "status": "in_progress"}
    if effective_outlets is not None:
        op_filter["outlet_id"] = {"$in": effective_outlets}

    # B13 fix: asyncio.gather for independent count queries (was sequential)
    import asyncio as _aio
    pending_validations, opname_pending = await _aio.gather(
        db.daily_sales.count_documents(pv_filter),
        db.opname_sessions.count_documents(op_filter),
    )

    # Outlet name resolve — batch from DB (already 1 query, improve projection)
    outlets_by_id = {}
    async for o in db.outlets.find({}, {"id": 1, "name": 1, "_id": 0}):
        outlets_by_id[o["id"]] = o.get("name", o["id"])
    for r in by_outlet:
        r["outlet_name"] = outlets_by_id.get(r["outlet_id"], r["outlet_id"])

    return {
        "period": period,
        "today_iso": today.isoformat(),
        "week_start": week_start,
        "sales_today": round(today_total, 2),
        "sales_wtd": round(wtd_total, 2),
        "sales_mtd": round(sales_mtd, 2),
        "top_outlets": by_outlet[:5],
        "inventory_value": round(inv_value, 2),
        "inventory_item_count": inv_count,
        "ap_exposure": round(ap_total, 2),
        "pending_validations": pending_validations,
        "opname_pending": opname_pending,
    }


@cache_or_compute("exec_sales_trend", ttl_sec=60)
async def sales_trend(
    *,
    days: int = 30,
    dim_outlet: Optional[str] = None,
    brand_ids: Optional[list[str]] = None,
    outlet_ids: Optional[list[str]] = None,
) -> dict:
    """Daily sales trend, last `days` days. Returns {dates:[], totals:[]}.

    Phase 9A: optional brand_ids / outlet_ids multi-select filters.
    """
    db = get_db()
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    match: dict = {
        "deleted_at": None,
        "status": "validated",
        "sales_date": {"$gte": start.isoformat(), "$lte": today.isoformat()},
    }
    # Resolve filters: dim_outlet (legacy single) > outlet_ids > brand_ids
    if dim_outlet:
        match["outlet_id"] = dim_outlet
    elif outlet_ids:
        match["outlet_id"] = {"$in": outlet_ids}
    elif brand_ids:
        # Expand brands to outlets
        outlet_ids_from_brand = []
        async for o in db.outlets.find({"brand_id": {"$in": brand_ids}, "deleted_at": None}):
            outlet_ids_from_brand.append(o["id"])
        if outlet_ids_from_brand:
            match["outlet_id"] = {"$in": outlet_ids_from_brand}
        else:
            # No outlet for these brands → empty
            return {
                "days": days,
                "start": start.isoformat(),
                "end": today.isoformat(),
                "series": [{"date": (start + timedelta(days=i)).isoformat(), "total": 0.0, "trx": 0}
                           for i in range(days)],
                "total": 0.0,
                "avg_daily": 0.0,
            }
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$sales_date",
            "total": {"$sum": {"$ifNull": ["$grand_total", 0]}},
            "trx": {"$sum": {"$ifNull": ["$transaction_count", 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    by_date = {}
    async for d in db.daily_sales.aggregate(pipeline):
        by_date[d["_id"]] = {"total": round(float(d["total"]), 2), "trx": int(d["trx"] or 0)}
    series = []
    cursor_date = start
    while cursor_date <= today:
        iso = cursor_date.isoformat()
        rec = by_date.get(iso, {"total": 0.0, "trx": 0})
        series.append({"date": iso, "total": rec["total"], "trx": rec["trx"]})
        cursor_date += timedelta(days=1)
    total = sum(s["total"] for s in series)
    avg = total / len(series) if series else 0
    return {
        "days": days,
        "start": start.isoformat(),
        "end": today.isoformat(),
        "series": series,
        "total": round(total, 2),
        "avg_daily": round(avg, 2),
    }


def _next_period(period: str) -> str:
    y, m = [int(x) for x in period.split("-")]
    m += 1
    if m > 12:
        m = 1
        y += 1
    return f"{y:04d}-{m:02d}"


@cache_or_compute("exec_sales_heatmap", ttl_sec=300)
async def sales_heatmap(
    *,
    period: Optional[str] = None,
    brand_ids: Optional[list[str]] = None,
    outlet_ids: Optional[list[str]] = None,
    metric: str = "revenue",
) -> dict:
    """Phase 4B: Generate sales heatmap (day-of-week × week matrix).
    
    Returns:
        {
            "period": "2024-05",
            "metric": "revenue",
            "weeks": ["Week 1", "Week 2", ...],
            "matrix": [
                {"day": "Mon", "values": [100000, 200000, ...]},
                {"day": "Tue", "values": [...]},
                ...
            ],
            "min": 0,
            "max": 500000,
        }
    """
    db = get_db()
    today = datetime.now(timezone.utc).date()
    period = period or today.strftime("%Y-%m")
    period_start = f"{period}-01"
    next_period = _next_period(period)
    next_start = f"{next_period}-01"

    # Resolve effective outlet filter
    effective_outlets: Optional[list[str]] = None
    if brand_ids:
        outlet_ids_from_brand = []
        async for o in db.outlets.find({"brand_id": {"$in": brand_ids}, "deleted_at": None}):
            outlet_ids_from_brand.append(o["id"])
        if outlet_ids:
            effective_outlets = [o for o in outlet_ids if o in outlet_ids_from_brand]
        else:
            effective_outlets = outlet_ids_from_brand
    elif outlet_ids:
        effective_outlets = outlet_ids

    # Build match query
    sales_match: dict = {
        "deleted_at": None,
        "status": "validated",
        "sales_date": {"$gte": period_start, "$lt": next_start},
    }
    if effective_outlets is not None:
        sales_match["outlet_id"] = {"$in": effective_outlets}

    # Aggregate by date
    pipeline = [
        {"$match": sales_match},
        {
            "$group": {
                "_id": "$sales_date",
                "revenue": {"$sum": {"$ifNull": ["$grand_total", 0]}},
                "trx": {"$sum": {"$ifNull": ["$transaction_count", 0]}},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    daily_data = {}
    async for d in db.daily_sales.aggregate(pipeline):
        date_str = d["_id"]
        daily_data[date_str] = {
            "revenue": round(d["revenue"], 2),
            "trx": d["trx"],
        }

    # Build matrix: day-of-week (rows) × week (columns)
    start_date = datetime.strptime(period_start, "%Y-%m-%d").date()
    end_date = datetime.strptime(next_start, "%Y-%m-%d").date() - timedelta(days=1)

    # Determine week boundaries (start from first Monday of period or before)
    current = start_date
    while current.weekday() != 0:  # 0 = Monday
        current -= timedelta(days=1)

    # Build weeks
    weeks = []
    week_start = current
    while week_start <= end_date:
        week_end = week_start + timedelta(days=6)
        weeks.append({
            "start": week_start.isoformat(),
            "end": week_end.isoformat(),
            "label": f"W{len(weeks) + 1}",
        })
        week_start = week_end + timedelta(days=1)

    # Build matrix (7 days × N weeks)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    matrix = []
    min_val = float("inf")
    max_val = 0

    for day_idx in range(7):
        row = {"day": day_names[day_idx], "values": []}
        for week in weeks:
            week_start_date = datetime.fromisoformat(week["start"]).date()
            target_date = week_start_date + timedelta(days=day_idx)
            date_str = target_date.isoformat()
            
            # Only include if within actual period
            if start_date <= target_date <= end_date:
                value = daily_data.get(date_str, {}).get(metric, 0)
                row["values"].append({
                    "date": date_str,
                    "value": value,
                    "revenue": daily_data.get(date_str, {}).get("revenue", 0),
                    "trx": daily_data.get(date_str, {}).get("trx", 0),
                })
                if value > 0:
                    min_val = min(min_val, value)
                    max_val = max(max_val, value)
            else:
                row["values"].append(None)
        matrix.append(row)

    if min_val == float("inf"):
        min_val = 0

    return {
        "period": period,
        "metric": metric,
        "weeks": [w["label"] for w in weeks],
        "matrix": matrix,
        "min": min_val,
        "max": max_val,
    }
