"""Scheduler job implementations."""
from __future__ import annotations

import logging

logger = logging.getLogger("aurora.scheduler")


async def job_anomaly_scan() -> None:
    from services.anomaly_service import run_scan
    result = await run_scan()
    logger.info("anomaly_scan: %s anomalies", len(result.get("anomalies", [])))


async def job_low_stock_digest() -> None:
    from services import inventory_service
    low = await inventory_service.low_stock_items(threshold=5)
    logger.info("low_stock_digest: %d items", len(low))
    if not low:
        return
    try:
        from services import telegram_service
        lines = [f"⚠️ {item.get('item_name', item.get('item_id', ''))}: stok {item.get('qty', 0)} (threshold 5)" for item in low[:20]]
        msg = f"📦 *Low Stock Digest* ({len(low)} items)\n" + "\n".join(lines)
        await telegram_service.send_message(msg)
    except Exception as e:  # noqa: BLE001
        logger.warning("low_stock_digest telegram failed: %s", e)


async def job_ar_aging_alert() -> None:
    from services._ar import ar_aging
    aging = await ar_aging()
    overdue_90 = float(aging.get("buckets", {}).get("over_90", 0))
    if overdue_90 <= 0:
        return
    try:
        from services import telegram_service
        await telegram_service.send_message(f"🚨 *AR Aging Alert*\nAR >90 hari: Rp {overdue_90:,.0f}")
    except Exception as e:  # noqa: BLE001
        logger.warning("ar_aging_alert telegram failed: %s", e)


async def job_sales_reminder() -> None:
    from core.db import get_db
    from datetime import date, timedelta
    db = get_db()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    outlets = await db.outlets.find({"deleted_at": None, "is_active": True}).to_list(50)
    missing_outlets = []
    for o in outlets:
        has_sales = await db.daily_sales.find_one({"outlet_id": o["id"], "sales_date": yesterday, "deleted_at": None})
        if not has_sales:
            missing_outlets.append(o.get("name", o["id"]))
    if not missing_outlets:
        return
    try:
        from services import telegram_service
        outlets_str = ", ".join(missing_outlets)
        await telegram_service.send_message(f"⏰ *Sales Reminder*\nBelum ada daily sales untuk {yesterday}:\n{outlets_str}")
    except Exception as e:  # noqa: BLE001
        logger.warning("sales_reminder telegram failed: %s", e)


async def job_payroll_due_reminder() -> None:
    from core.db import get_db
    from datetime import date
    db = get_db()
    today_day = date.today().day
    if today_day not in (20, 25):
        return
    from datetime import date as _date
    period = _date.today().strftime("%Y-%m")
    existing = await db.payroll_cycles.count_documents({"period": period, "deleted_at": None})
    if existing > 0:
        return
    try:
        from services import telegram_service
        await telegram_service.send_message(f"💰 *Payroll Reminder*\nPayroll untuk {period} belum dibuat. Tanggal hari ini: {date.today().day}.")
    except Exception as e:  # noqa: BLE001
        logger.warning("payroll_due_reminder telegram failed: %s", e)


async def job_period_close_reminder() -> None:
    from datetime import date, timedelta
    today = date.today()
    if today.day not in range(27, 32) and today.day not in (1, 2, 3):
        return
    try:
        from services._period import is_period_locked
        from datetime import date as _date
        today_dt = _date.today()
        if today_dt.day <= 3:
            last_month = today_dt.replace(day=1) - timedelta(days=1)
            period = last_month.strftime("%Y-%m")
        else:
            period = today_dt.strftime("%Y-%m")
        info = await is_period_locked(period)
        if info.get("status") == "open":
            from services import telegram_service
            await telegram_service.send_message(f"📅 *Period Close Reminder*\nPeriod {period} masih OPEN. Jangan lupa close setelah semua data diinput.")
    except Exception as e:  # noqa: BLE001
        logger.warning("period_close_reminder telegram failed: %s", e)


async def job_voucher_expiry_check() -> None:
    from core.db import get_db
    from datetime import date
    db = get_db()
    today = date.today().isoformat()
    expiring_soon = await db.vouchers.find({"deleted_at": None, "status": "issued", "expiry_date": {"$lte": today, "$gte": today[:7] + "-01"}}).to_list(50)
    if not expiring_soon:
        return
    try:
        from services import telegram_service
        await telegram_service.send_message(f"🎫 *Voucher Expiry Alert*\n{len(expiring_soon)} voucher segera kadaluarsa.")
    except Exception as e:  # noqa: BLE001
        logger.warning("voucher_expiry_check telegram failed: %s", e)


async def job_service_charge_reminder() -> None:
    from core.db import get_db
    from datetime import date
    db = get_db()
    period = date.today().strftime("%Y-%m")
    pending = await db.service_charge_periods.count_documents({"deleted_at": None, "period": period, "status": {"$in": ["calculated", "approved"]}})
    if pending <= 0:
        return
    try:
        from services import telegram_service
        await telegram_service.send_message(f"💼 *Service Charge Reminder*\n{pending} service charge {period} menunggu distribusi.")
    except Exception as e:  # noqa: BLE001
        logger.warning("service_charge_reminder telegram failed: %s", e)


async def job_flush_logs() -> None:
    """Persist buffered in-memory application logs into the log_entries collection."""
    from core.logging_config import get_db_sink
    written = await get_db_sink().flush_to_db()
    if written:
        logger.info("flush_logs: persisted %d log entries", written)
