"""Outlet-level drilldown."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db
from core.exceptions import NotFoundError
from services._exec_drilldown._common import _resolve_period, _period_to_range


async def outlet_drilldown(*, outlet_id: str, period: Optional[str] = None) -> dict:
    db = get_db()
    period = _resolve_period(period)
    period_start, next_start = _period_to_range(period)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    outlet = await db.outlets.find_one({"id": outlet_id, "deleted_at": None})
    if not outlet:
        raise NotFoundError(f"Outlet {outlet_id} tidak ditemukan")
    brand = None
    if outlet.get("brand_id"):
        brand = await db.brands.find_one({"id": outlet["brand_id"], "deleted_at": None})

    header = {"outlet_id": outlet["id"], "outlet_name": outlet.get("name", outlet["id"]), "outlet_code": outlet.get("code", ""), "brand_id": outlet.get("brand_id"), "brand_name": (brand or {}).get("name") if brand else None, "address": outlet.get("address"), "open_time": outlet.get("open_time"), "close_time": outlet.get("close_time")}

    # Daily ops
    today_sales_doc = await db.daily_sales.find_one({"outlet_id": outlet_id, "sales_date": today_str, "deleted_at": None})
    pc_balance = 0.0
    pc_pending = 0
    async for pc in db.petty_cash_transactions.find({"outlet_id": outlet_id, "deleted_at": None}).sort([("txn_date", -1)]).limit(200):
        if pc.get("status") == "draft":
            pc_pending += 1
        if "balance_after" in pc and pc.get("balance_after") is not None:
            pc_balance = float(pc.get("balance_after", 0))
            break
    opname_active = await db.opname_sessions.count_documents({"outlet_id": outlet_id, "status": "in_progress", "deleted_at": None})
    kdo_pending = await db.purchase_requests.count_documents({"outlet_id": outlet_id, "source": "kdo", "status": "draft", "deleted_at": None})
    bdo_pending = await db.purchase_requests.count_documents({"outlet_id": outlet_id, "source": "bdo", "status": "draft", "deleted_at": None})
    last_close = await db.daily_close_records.find_one({"outlet_id": outlet_id, "deleted_at": None}, sort=[("close_date", -1)])
    daily_ops = {"today_sales_status": (today_sales_doc or {}).get("status"), "today_grand_total": float((today_sales_doc or {}).get("grand_total", 0) or 0), "petty_cash_balance": pc_balance, "petty_cash_pending": pc_pending, "opname_active": opname_active, "kdo_pending": kdo_pending, "bdo_pending": bdo_pending, "last_close_date": (last_close or {}).get("close_date")}

    # P&L
    revenue = trx = days_count = service_total = tax_total = cogs = pc_expense = up_expense = 0.0
    async for ds in db.daily_sales.find({"outlet_id": outlet_id, "deleted_at": None, "status": "validated", "sales_date": {"$gte": period_start, "$lt": next_start}}):
        revenue += float(ds.get("grand_total", 0) or 0)
        trx += int(ds.get("transaction_count", 0) or 0)
        days_count += 1
        service_total += float(ds.get("service_charge", 0) or 0)
        tax_total += float(ds.get("tax_amount", 0) or 0)
    async for gr in db.goods_receipts.find({"outlet_id": outlet_id, "deleted_at": None, "receive_date": {"$gte": period_start, "$lt": next_start}}):
        cogs += float(gr.get("grand_total", 0) or 0)
    async for pc in db.petty_cash_transactions.find({"outlet_id": outlet_id, "deleted_at": None, "txn_date": {"$gte": period_start, "$lt": next_start}, "status": {"$in": ["approved", "posted", "submitted"]}}):
        if pc.get("type") in ("purchase", "expense") or pc.get("type") is None:
            pc_expense += float(pc.get("amount", 0) or 0)
    async for up in db.urgent_purchases.find({"outlet_id": outlet_id, "deleted_at": None, "purchase_date": {"$gte": period_start, "$lt": next_start}, "status": {"$in": ["approved", "posted"]}}):
        up_expense += float(up.get("total", 0) or 0)
    opex = pc_expense + up_expense
    gross_profit = revenue - cogs
    net = gross_profit - opex
    pl = {"revenue": round(revenue, 2), "cogs": round(cogs, 2), "gross_profit": round(gross_profit, 2), "gp_pct": round((gross_profit / revenue * 100) if revenue else 0, 2), "opex": round(opex, 2), "petty_cash_expense": round(pc_expense, 2), "urgent_purchase_expense": round(up_expense, 2), "service": round(service_total, 2), "tax": round(tax_total, 2), "net": round(net, 2), "net_margin_pct": round((net / revenue * 100) if revenue else 0, 2), "transaction_count": int(trx), "days_active": int(days_count), "avg_daily_sales": round((revenue / days_count) if days_count else 0, 2)}

    # Inventory
    from services import inventory_service
    val = await inventory_service.valuation(outlet_id=outlet_id)
    inv_value = float(val.get("total_value", 0) or 0)
    inv_count = int(val.get("item_count", 0) or 0)
    low_stock = 0
    try:
        balances, _ = await inventory_service.stock_balance(outlet_ids=[outlet_id], page=1, per_page=500)
        low_stock = len([b for b in balances if float(b.get("qty", 0) or 0) <= 0])
    except Exception:  # noqa: BLE001
        pass

    # Staff
    employee_count = await db.employees.count_documents({"outlet_id": outlet_id, "deleted_at": None})
    incentive_total = 0.0
    async for inc in db.incentives.find({"outlet_id": outlet_id, "period": period, "deleted_at": None}):
        incentive_total += float(inc.get("incentive_amount", 0) or 0)
    service_period = await db.service_charge_periods.find_one({"outlet_id": outlet_id, "period": period, "deleted_at": None})
    staff = {"employee_count": employee_count, "incentive_period_total": round(incentive_total, 2), "service_charge_distributed": round(float((service_period or {}).get("distributable_amount", 0) or 0), 2), "service_charge_status": (service_period or {}).get("status", "not_calculated")}

    # Sales trend (30d)
    today = datetime.now(timezone.utc).date()
    start_30 = today - timedelta(days=29)
    dates = [(start_30 + timedelta(days=i)).isoformat() for i in range(30)]
    series_map: dict[str, float] = {}
    async for ds in db.daily_sales.find({"outlet_id": outlet_id, "deleted_at": None, "status": "validated", "sales_date": {"$gte": start_30.isoformat(), "$lte": today.isoformat()}}):
        d = ds.get("sales_date")
        if d:
            series_map[d] = series_map.get(d, 0.0) + float(ds.get("grand_total", 0) or 0)
    trend_series = [{"date": d, "total": round(series_map.get(d, 0.0), 2)} for d in dates]

    return {"header": header, "period": period, "daily_ops": daily_ops, "pl": pl, "inventory": {"valuation": round(inv_value, 2), "item_count": inv_count, "low_stock_count": low_stock}, "staff": staff, "trend": trend_series}
