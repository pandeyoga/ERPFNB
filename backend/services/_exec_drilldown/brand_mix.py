"""Brand mix donut chart data."""
from __future__ import annotations

from typing import Optional

from core.db import get_db
from services._exec_drilldown._common import _resolve_period, _period_to_range


async def brand_mix(
    *,
    period: Optional[str] = None,
    brand_ids: Optional[list[str]] = None,
    outlet_ids: Optional[list[str]] = None,
) -> dict:
    """Revenue % per brand for the given period (validated daily sales)."""
    db = get_db()
    period = _resolve_period(period)
    period_start, next_start = _period_to_range(period)

    brands_by_id: dict[str, dict] = {}
    async for b in db.brands.find({"deleted_at": None}):
        brands_by_id[b["id"]] = {"id": b["id"], "name": b.get("name", b["id"]), "code": b.get("code", ""), "color": b.get("color")}
    outlets_by_id: dict[str, dict] = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlets_by_id[o["id"]] = {"id": o["id"], "name": o.get("name", o["id"]), "brand_id": o.get("brand_id")}

    match: dict = {"deleted_at": None, "status": "validated", "sales_date": {"$gte": period_start, "$lt": next_start}}
    if outlet_ids:
        match["outlet_id"] = {"$in": outlet_ids}
    if brand_ids:
        match["brand_id"] = {"$in": brand_ids}

    by_brand: dict[str, dict] = {}
    grand_total = 0.0
    async for ds in db.daily_sales.find(match):
        outlet = outlets_by_id.get(ds.get("outlet_id"))
        brand_id = (outlet or {}).get("brand_id") or ds.get("brand_id")
        if not brand_id:
            continue
        if brand_ids and brand_id not in brand_ids:
            continue
        amount = float(ds.get("grand_total", 0) or 0)
        if amount <= 0:
            continue
        b = brands_by_id.get(brand_id, {"id": brand_id, "name": brand_id, "code": ""})
        row = by_brand.setdefault(brand_id, {"brand_id": brand_id, "brand_name": b.get("name", brand_id), "code": b.get("code", ""), "color": b.get("color"), "total": 0.0, "trx": 0, "outlets": set()})
        row["total"] += amount
        row["trx"] += int(ds.get("transaction_count", 0) or 0)
        row["outlets"].add(ds.get("outlet_id"))
        grand_total += amount

    result_rows = []
    for r in sorted(by_brand.values(), key=lambda x: x["total"], reverse=True):
        result_rows.append({"brand_id": r["brand_id"], "brand_name": r["brand_name"], "code": r["code"], "color": r.get("color"), "total": round(r["total"], 2), "trx": r["trx"], "outlet_count": len(r["outlets"]), "share_pct": round((r["total"] / grand_total) * 100, 2) if grand_total else 0.0})
    return {"period": period, "grand_total": round(grand_total, 2), "rows": result_rows}
