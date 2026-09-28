"""Brand-level drilldown."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db
from core.exceptions import NotFoundError
from services._exec_drilldown._common import _resolve_period, _period_to_range


async def brand_drilldown(*, brand_id: str, period: Optional[str] = None) -> dict:
    db = get_db()
    period = _resolve_period(period)
    period_start, next_start = _period_to_range(period)

    brand = await db.brands.find_one({"id": brand_id, "deleted_at": None})
    if not brand:
        raise NotFoundError(f"Brand {brand_id} tidak ditemukan")
    brand_info = {"id": brand["id"], "name": brand.get("name", brand["id"]), "code": brand.get("code", ""), "color": brand.get("color"), "logo_url": brand.get("logo_url")}

    outlet_docs: list[dict] = []
    async for o in db.outlets.find({"brand_id": brand_id, "deleted_at": None}):
        outlet_docs.append(o)
    outlets_by_id = {o["id"]: o for o in outlet_docs}
    outlet_ids = list(outlets_by_id.keys())

    if not outlet_ids:
        return {"brand": brand_info, "period": period, "kpis": {"revenue_mtd": 0, "trx": 0, "outlet_count": 0, "active_outlets": 0, "cogs": 0, "gp_pct": 0, "net": 0}, "outlets": [], "cost_structure": {"revenue": 0, "cogs": 0, "opex": 0, "service": 0, "tax": 0, "net": 0}, "trends": {"dates": [], "series": []}}

    by_outlet: dict[str, dict] = {}
    revenue_mtd = trx_total = service_total = tax_total = 0.0
    async for ds in db.daily_sales.find({"deleted_at": None, "status": "validated", "outlet_id": {"$in": outlet_ids}, "sales_date": {"$gte": period_start, "$lt": next_start}}):
        oid = ds.get("outlet_id")
        amount = float(ds.get("grand_total", 0) or 0)
        if amount <= 0:
            continue
        revenue_mtd += amount
        trx_total += int(ds.get("transaction_count", 0) or 0)
        service_total += float(ds.get("service_charge", 0) or 0)
        tax_total += float(ds.get("tax_amount", 0) or 0)
        row = by_outlet.setdefault(oid, {"outlet_id": oid, "outlet_name": outlets_by_id[oid].get("name", oid), "code": outlets_by_id[oid].get("code", ""), "total": 0.0, "trx": 0, "days": 0})
        row["total"] += amount
        row["trx"] += int(ds.get("transaction_count", 0) or 0)
        row["days"] += 1

    outlets_list = [{**r, "total": round(r["total"], 2), "share_pct": round((r["total"] / revenue_mtd) * 100, 2) if revenue_mtd else 0.0} for r in sorted(by_outlet.values(), key=lambda x: x["total"], reverse=True)]

    cogs_total = opex_total = 0.0
    async for gr in db.goods_receipts.find({"deleted_at": None, "outlet_id": {"$in": outlet_ids}, "receive_date": {"$gte": period_start, "$lt": next_start}}):
        cogs_total += float(gr.get("grand_total", 0) or 0)
    async for pc in db.petty_cash_transactions.find({"deleted_at": None, "outlet_id": {"$in": outlet_ids}, "txn_date": {"$gte": period_start, "$lt": next_start}, "status": {"$in": ["approved", "posted", "submitted"]}}):
        if pc.get("type") in ("purchase", "expense") or pc.get("type") is None:
            opex_total += float(pc.get("amount", 0) or 0)
    async for up in db.urgent_purchases.find({"deleted_at": None, "outlet_id": {"$in": outlet_ids}, "purchase_date": {"$gte": period_start, "$lt": next_start}, "status": {"$in": ["approved", "posted"]}}):
        opex_total += float(up.get("total", 0) or 0)

    net = revenue_mtd - cogs_total - opex_total
    gp_pct = ((revenue_mtd - cogs_total) / revenue_mtd * 100) if revenue_mtd else 0

    today = datetime.now(timezone.utc).date()
    start_30 = today - timedelta(days=29)
    dates = [(start_30 + timedelta(days=i)).isoformat() for i in range(30)]
    series_by_outlet: dict[str, dict[str, float]] = {}
    async for ds in db.daily_sales.find({"deleted_at": None, "status": "validated", "outlet_id": {"$in": outlet_ids}, "sales_date": {"$gte": start_30.isoformat(), "$lte": today.isoformat()}}):
        oid = ds.get("outlet_id")
        d = ds.get("sales_date")
        if oid and d:
            bucket = series_by_outlet.setdefault(oid, {})
            bucket[d] = bucket.get(d, 0.0) + float(ds.get("grand_total", 0) or 0)

    trend_series = [{"outlet_id": o["id"], "outlet_name": o.get("name", o["id"]), "daily": [round(series_by_outlet.get(o["id"], {}).get(d, 0.0), 2) for d in dates], "total": round(sum(series_by_outlet.get(o["id"], {}).values()), 2)} for o in outlet_docs]

    return {
        "brand": brand_info, "period": period,
        "kpis": {"revenue_mtd": round(revenue_mtd, 2), "trx": trx_total, "outlet_count": len(outlet_docs), "active_outlets": len([o for o in by_outlet.values() if o["total"] > 0]), "cogs": round(cogs_total, 2), "gp_pct": round(gp_pct, 2), "net": round(net, 2)},
        "outlets": outlets_list, "cost_structure": {"revenue": round(revenue_mtd, 2), "cogs": round(cogs_total, 2), "opex": round(opex_total, 2), "service": round(service_total, 2), "tax": round(tax_total, 2), "net": round(net, 2)},
        "trends": {"dates": dates, "series": trend_series},
    }
