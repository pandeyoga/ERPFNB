"""Scheduler job implementations."""
from __future__ import annotations

import logging

logger = logging.getLogger("aurora.scheduler")


async def _notify_ops(text: str) -> None:
    """DUP-02: telegram_service.send_message needs a chat_id — ops alerts go to TELEGRAM_OPS_CHAT_ID.
    Without it the alert is only logged (previously every alert died on a swallowed TypeError)."""
    import os
    chat_id = os.environ.get("TELEGRAM_OPS_CHAT_ID")
    if not chat_id:
        logger.info("ops alert (no TELEGRAM_OPS_CHAT_ID): %s", text.replace("\n", " | "))
        return
    from services import telegram_service
    await telegram_service.send_message(chat_id, text)


async def job_anomaly_scan() -> None:
    from services._anomaly.batch import scan_all
    result = await scan_all()
    logger.info("anomaly_scan: %s", result)


async def job_low_stock_digest() -> None:
    from services import inventory_matrix_service
    res = await inventory_matrix_service.low_stock()
    low = res.get("items", []) if isinstance(res, dict) else list(res or [])
    logger.info("low_stock_digest: %d items", len(low))
    if not low:
        return
    try:
        lines = [f"⚠️ {item.get('item_name', item.get('item_id', ''))} @ {item.get('outlet_name', '')}: "
                 f"stok {item.get('qty', 0)}" for item in low[:20]]
        msg = f"📦 *Low Stock Digest* ({len(low)} items)\n" + "\n".join(lines)
        await _notify_ops(msg)
    except Exception as e:  # noqa: BLE001
        logger.warning("low_stock_digest telegram failed: %s", e)


async def job_ar_aging_alert() -> None:
    from services._ar import ar_aging
    aging = await ar_aging()
    overdue_90 = float(aging.get("buckets", {}).get("over_90", 0))
    if overdue_90 <= 0:
        return
    try:
        await _notify_ops(f"🚨 *AR Aging Alert*\nAR >90 hari: Rp {overdue_90:,.0f}")
    except Exception as e:  # noqa: BLE001
        logger.warning("ar_aging_alert telegram failed: %s", e)


async def job_sales_reminder() -> None:
    from core.db import get_db
    from datetime import timedelta
    from core.clock import today_local
    db = get_db()
    yesterday = (today_local() - timedelta(days=1)).isoformat()  # business date (WIB), not UTC
    outlets = await db.outlets.find({"deleted_at": None, "active": {"$ne": False}}).to_list(50)
    missing_outlets = []
    for o in outlets:
        has_sales = await db.daily_sales.find_one({"outlet_id": o["id"], "sales_date": yesterday, "deleted_at": None})
        if not has_sales:
            missing_outlets.append(o.get("name", o["id"]))
    if not missing_outlets:
        return
    try:
        outlets_str = ", ".join(missing_outlets)
        await _notify_ops(f"⏰ *Sales Reminder*\nBelum ada daily sales untuk {yesterday}:\n{outlets_str}")
    except Exception as e:  # noqa: BLE001
        logger.warning("sales_reminder telegram failed: %s", e)


async def job_payroll_due_reminder() -> None:
    from core.db import get_db
    from core.clock import today_local as _today
    db = get_db()
    today_day = _today().day
    if today_day not in (20, 25):
        return
    period = _today().strftime("%Y-%m")
    existing = await db.payroll_cycles.count_documents({"period": period, "deleted_at": None})
    if existing > 0:
        return
    try:
        await _notify_ops(f"💰 *Payroll Reminder*\nPayroll untuk {period} belum dibuat. Tanggal hari ini: {today_day}.")
    except Exception as e:  # noqa: BLE001
        logger.warning("payroll_due_reminder telegram failed: %s", e)


async def job_period_close_reminder() -> None:
    from datetime import timedelta
    from core.clock import today_local
    today = today_local()
    if today.day not in range(27, 32) and today.day not in (1, 2, 3):
        return
    try:
        from services._period import is_period_locked
        today_dt = today
        if today_dt.day <= 3:
            last_month = today_dt.replace(day=1) - timedelta(days=1)
            period = last_month.strftime("%Y-%m")
        else:
            period = today_dt.strftime("%Y-%m")
        info = await is_period_locked(period)
        if info.get("status") == "open":
            await _notify_ops(f"📅 *Period Close Reminder*\nPeriod {period} masih OPEN. Jangan lupa close setelah semua data diinput.")
    except Exception as e:  # noqa: BLE001
        logger.warning("period_close_reminder telegram failed: %s", e)


async def job_voucher_expiry_check() -> None:
    from core.db import get_db
    from core.clock import today_str
    db = get_db()
    today = today_str()
    expiring_soon = await db.vouchers.find({"deleted_at": None, "status": "issued", "expire_date": {"$lte": today, "$gte": today[:7] + "-01"}}).to_list(50)
    if not expiring_soon:
        return
    try:
        await _notify_ops(f"🎫 *Voucher Expiry Alert*\n{len(expiring_soon)} voucher segera kadaluarsa.")
    except Exception as e:  # noqa: BLE001
        logger.warning("voucher_expiry_check telegram failed: %s", e)


async def job_service_charge_reminder() -> None:
    from core.db import get_db
    from core.clock import period_now
    db = get_db()
    period = period_now()
    pending = await db.service_charge_periods.count_documents({"deleted_at": None, "period": period, "status": {"$in": ["calculated", "approved"]}})
    if pending <= 0:
        return
    try:
        await _notify_ops(f"💼 *Service Charge Reminder*\n{pending} service charge {period} menunggu distribusi.")
    except Exception as e:  # noqa: BLE001
        logger.warning("service_charge_reminder telegram failed: %s", e)


async def job_flush_logs() -> None:
    """Persist buffered in-memory application logs into the log_entries collection."""
    from core.logging_config import get_db_sink
    written = await get_db_sink().flush_to_db()
    if written:
        logger.info("flush_logs: persisted %d log entries", written)


async def job_owner_digest() -> None:
    """CTL-04: daily owner digest (Telegram) for all active subscribers."""
    from services.owner_digest_service import send_digest_to_all_subscribers
    result = await send_digest_to_all_subscribers()
    logger.info("owner_digest: %s", result)


async def job_report_schedules() -> None:
    """CTL-05: run user-defined report schedules that are due this minute (WIB)."""
    from services.report_schedule_service import run_due_schedules
    await run_due_schedules()


async def job_cms_schedule_publish() -> dict:
    """DUP-01: publish CMS drafts whose publish_at has passed and retract items past unpublish_at."""
    from datetime import datetime, timezone
    from core.db import get_db
    db = get_db()
    now = datetime.now(timezone.utc)
    out: dict = {}
    for col in ("public_brands", "public_news", "public_menu_items", "public_outlets", "public_pages"):
        pub = await db[col].update_many(
            {"status": "draft", "publish_at": {"$ne": None, "$lte": now}, "deleted_at": None},
            {"$set": {"status": "published", "updated_at": now}})
        unpub = await db[col].update_many(
            {"status": "published", "unpublish_at": {"$ne": None, "$lte": now}, "deleted_at": None},
            {"$set": {"status": "draft", "updated_at": now}})
        out[col] = {"published": pub.modified_count, "unpublished": unpub.modified_count}
    logger.info("cms_schedule_publish: %s", out)
    return out
