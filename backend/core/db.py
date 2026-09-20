"""Mongo client + collection helpers."""
import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger("aurora.db")

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def init_db() -> None:
    global _client, _db
    # Optimized connection pool configuration (Tier 2.2)
    _client = AsyncIOMotorClient(
        settings.mongo_url,
        uuidRepresentation="standard",
        # Connection pool optimization
        maxPoolSize=50,          # Reduced from default 100 (current usage ~5-10)
        minPoolSize=10,          # Keep 10 warm connections ready
        maxIdleTimeMS=45000,     # Close idle connections after 45s
        waitQueueTimeoutMS=5000, # Fail fast if pool exhausted (5s timeout)
        # Connection behavior
        serverSelectionTimeoutMS=5000,  # 5s server selection timeout
        connectTimeoutMS=10000,  # 10s connection timeout
        socketTimeoutMS=30000,   # 30s socket timeout (matches FastAPI)
        # Retry behavior
        retryWrites=True,        # Retry write operations on transient errors
        retryReads=True,         # Retry read operations on transient errors
    )
    _db = _client[settings.db_name]
    await ensure_indexes()
    logger.info(f"DB ready: {settings.db_name} (optimized connection pool: min=10, max=50)")


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("DB not initialized; call init_db() in lifespan")
    return _db


async def db_ping() -> bool:
    try:
        await get_db().command("ping")
        return True
    except Exception as e:  # noqa: BLE001
        logger.error(f"DB ping failed: {e}")
        return False


async def ensure_indexes() -> None:
    db = get_db()
    # Partial filter so soft-deleted docs don't trigger unique violation
    not_deleted = {"deleted_at": None}

    async def unique_partial(col_name: str, field: str):
        col = db[col_name]
        # Drop legacy non-partial index if exists, then create partial
        try:
            existing = await col.index_information()
            for name, info in existing.items():
                keys = info.get("key", [])
                if keys and len(keys) == 1 and keys[0][0] == field and info.get("unique"):
                    if "partialFilterExpression" not in info:
                        await col.drop_index(name)
                        break
        except Exception:  # noqa: BLE001
            pass
        await col.create_index(
            field, unique=True, partialFilterExpression=not_deleted, name=f"{field}_unique_partial",
        )

    # Users
    await unique_partial("users", "email")
    await db.users.create_index("id", unique=True)
    # Roles
    await unique_partial("roles", "code")
    await db.roles.create_index("id", unique=True)
    # Master collections (non-unique id index for fast lookup)
    for col in (
        "groups", "brands", "outlets", "items", "categories", "vendors",
        "employees", "chart_of_accounts", "tax_codes", "payment_methods",
        "bank_accounts", "number_series", "business_rules",
    ):
        await db[col].create_index("id", unique=True)
    # Code uniques (partial)
    for col, field in [
        ("brands", "code"), ("outlets", "code"), ("items", "code"),
        ("vendors", "code"), ("employees", "code"),
        ("chart_of_accounts", "code"), ("tax_codes", "code"),
        ("payment_methods", "code"), ("bank_accounts", "code"),
        ("number_series", "code"),
    ]:
        await unique_partial(col, field)
    # Audit, notifications
    await db.audit_log.create_index([("entity_type", 1), ("entity_id", 1), ("timestamp", -1)])
    await db.audit_log.create_index([("user_id", 1), ("timestamp", -1)])
    await db.notifications.create_index([("user_id", 1), ("read_at", 1), ("created_at", -1)])
    # Refresh tokens
    await db.refresh_tokens.create_index("jti", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)

    # Phase 7E hot-path indexes -------------------------------------------------
    # Outlet operations (date + status are dominant filters)
    await db.daily_sales.create_index([("outlet_id", 1), ("sales_date", -1)])
    await db.daily_sales.create_index([("status", 1), ("sales_date", -1)])
    await db.daily_sales.create_index([("brand_id", 1), ("sales_date", -1)])
    # Phase 4-Perf: 3-field compound for finance validation queue (outlet × status × date)
    await db.daily_sales.create_index(
        [("outlet_id", 1), ("status", 1), ("sales_date", -1)],
        name="ds_outlet_status_date",
    )
    await db.petty_cash.create_index([("outlet_id", 1), ("txn_date", -1)])
    await db.urgent_purchases.create_index([("outlet_id", 1), ("purchase_date", -1)])
    await db.urgent_purchases.create_index([("status", 1), ("purchase_date", -1)])
    # Procurement
    await db.purchase_requests.create_index([("status", 1), ("created_at", -1)])
    await db.purchase_requests.create_index([("outlet_id", 1), ("status", 1)])
    await db.purchase_orders.create_index([("status", 1), ("created_at", -1)])
    await db.purchase_orders.create_index([("vendor_id", 1), ("created_at", -1)])
    await db.goods_receipts.create_index([("po_id", 1), ("received_at", -1)])
    await db.goods_receipts.create_index([("outlet_id", 1), ("received_at", -1)])
    # Inventory
    # Inventory movements — canonical collection is `inventory_movements`
    await db.inventory_movements.create_index([("outlet_id", 1), ("item_id", 1), ("movement_date", -1)])
    await db.inventory_movements.create_index([("movement_date", -1)])
    await db.stock_transfers.create_index([("status", 1), ("created_at", -1)])
    await db.adjustments.create_index([("outlet_id", 1), ("created_at", -1)])
    await db.opname_sessions.create_index([("outlet_id", 1), ("status", 1), ("started_at", -1)])
    # Finance
    await db.journal_entries.create_index([("period", -1), ("posted_at", -1)])
    # Phase 4-Perf: idempotency hardening — unique partial on (source_type, source_id)
    # so duplicate auto-postings (e.g. on retries) fail at DB level instead of creating
    # phantom entries. Only enforces uniqueness on entries with both fields populated
    # (manual JEs typically have no source_id and are exempted).
    await db.journal_entries.create_index(
        [("source_type", 1), ("source_id", 1)],
        unique=True,
        partialFilterExpression={
            "source_type": {"$exists": True, "$type": "string"},
            "source_id": {"$exists": True, "$type": "string"},
            "deleted_at": None,
        },
        name="je_source_unique_partial",
    )
    await db.journal_entries.create_index([("outlet_id", 1), ("period", -1)])
    # AP ledger — canonical collection is `ap_ledgers` (journal lines are embedded in journal_entries)
    await db.ap_ledgers.create_index([("vendor_id", 1), ("status", 1)])
    await db.ap_ledgers.create_index([("due_date", 1), ("status", 1)])
    await db.payment_runs.create_index([("status", 1), ("created_at", -1)])
    # Periods — canonical collection is `accounting_periods`; unique on period prevents duplicates
    await db.accounting_periods.create_index([("period", 1)], unique=True)
    # HR
    await db.employee_advances.create_index([("employee_id", 1), ("status", 1)])
    await db.employee_advances.create_index([("status", 1), ("created_at", -1)])
    # Canonical collection is `service_charge_periods` (read by services/_hr/service_charge.py).
    # Indexes were previously built on the dead `service_charge_runs` collection — RC-1 drift.
    await db.service_charge_periods.create_index([("period", -1), ("status", 1)])
    # Phase 4-Perf: prevent concurrent in-progress runs per (period, outlet)
    await db.service_charge_periods.create_index(
        [("period", 1), ("outlet_id", 1)],
        unique=True,
        partialFilterExpression={"status": {"$in": ["in_progress", "draft"]}, "deleted_at": None},
        name="sc_period_outlet_inprogress_unique",
    )
    await db.incentive_runs.create_index([("period", -1), ("status", 1)])
    await db.payroll_runs.create_index([("period", -1)])
    # Phase 4-Perf: prevent concurrent in-progress payroll per (period, outlet)
    await db.payroll_runs.create_index(
        [("period", 1), ("outlet_id", 1)],
        unique=True,
        partialFilterExpression={"status": {"$in": ["in_progress", "draft"]}, "deleted_at": None},
        name="pr_period_outlet_inprogress_unique",
    )
    await db.vouchers.create_index([("employee_id", 1), ("status", 1)])
    await db.foc_logs.create_index([("outlet_id", 1), ("issued_at", -1)])
    # AI / forecast / anomaly (Phase 6, 7C, 7D)
    await db.forecast_snapshots.create_index([("entity_type", 1), ("entity_id", 1), ("period", -1)])
    # anomaly_events — indexes aligned with list_events() sort key (created_at)
    await db.anomaly_events.create_index([("status", 1), ("detected_at", -1)])
    await db.anomaly_events.create_index([("type", 1), ("severity", 1), ("detected_at", -1)])
    await db.anomaly_events.create_index([("outlet_id", 1), ("detected_at", -1)])
    # Additional indexes for list_events() sort + filter patterns
    await db.anomaly_events.create_index([("status", 1), ("created_at", -1)], name="ae_status_created")
    await db.anomaly_events.create_index([("type", 1), ("severity", 1), ("created_at", -1)], name="ae_type_sev_created")
    await db.anomaly_events.create_index([("outlet_id", 1), ("created_at", -1)], name="ae_outlet_created")
    await db.anomaly_events.create_index([("scan_date", -1), ("status", 1)], name="ae_scandate_status")
    await db.anomaly_events.create_index([("vendor_id", 1), ("created_at", -1)], name="ae_vendor_created")
    await db.ai_categorize_history.create_index([("description_hash", 1)])
    # Approvals
    await db.approval_steps.create_index([("entity_type", 1), ("entity_id", 1), ("step_no", 1)])
    await db.approval_steps.create_index([("approver_user_id", 1), ("status", 1)])
    # Reporting (built-in cache layer)
    await db.report_templates.create_index([("kind", 1), ("name", 1)])

    # Phase 8B \u2014 file uploads & daily close
    await db.attachments.create_index("id", unique=True)
    await db.attachments.create_index([("source_type", 1), ("source_id", 1)])
    await db.attachments.create_index([("category", 1), ("created_at", -1)])
    await db.attachments.create_index([("uploaded_by", 1), ("created_at", -1)])
    await db.daily_close_records.create_index("id", unique=True)
    await db.daily_close_records.create_index([("outlet_id", 1), ("close_date", -1)])
    await db.daily_close_records.create_index([("close_date", -1)])
    # KDO/BDO are stored as purchase_requests with source field; ensure index
    await db.purchase_requests.create_index([("source", 1), ("outlet_id", 1), ("request_date", -1)])

    # Phase 14 — Outlet Operational Budget (KDO/FDO/BDO cost control)
    await db.outlet_budgets.create_index("id", unique=True)
    await db.outlet_budgets.create_index(
        [("outlet_id", 1), ("period_type", 1), ("period_key", 1)],
        unique=True,
        partialFilterExpression={"deleted_at": None},
        name="ob_outlet_period_unique",
    )
    await db.outlet_budgets.create_index([("period_type", 1), ("period_key", 1)])
    await db.outlet_budgets.create_index([("outlet_id", 1), ("period_start", 1), ("period_end", 1)])
    await db.outlet_budgets.create_index([("brand_id", 1), ("period_type", 1), ("period_key", 1)])
    await db.budget_increase_requests.create_index("id", unique=True)
    await db.budget_increase_requests.create_index([("status", 1), ("requested_at", -1)])
    await db.budget_increase_requests.create_index([("outlet_id", 1), ("status", 1)])
    await db.budget_increase_requests.create_index([("budget_id", 1)])

    # Phase 8C — OCR receipt cache
    await db.ocr_receipt_cache.create_index("image_hash", unique=True)
    await db.ocr_receipt_cache.create_index([("updated_at", -1)])

    # Phase 11 — Cash Position (cash_accounts, snapshots) + Owner digest
    await db.cash_accounts.create_index("id", unique=True)
    await db.cash_accounts.create_index("code", unique=True, partialFilterExpression={"deleted_at": None})
    await db.cash_accounts.create_index([("type", 1), ("is_active", 1)])
    await db.cash_accounts.create_index([("outlet_id", 1), ("type", 1)])
    await db.cash_balance_snapshots.create_index("id", unique=True)
    await db.cash_balance_snapshots.create_index([("cash_account_id", 1), ("recorded_at", -1)])
    await db.cash_balance_snapshots.create_index([("recorded_at", -1)])
    await db.digest_subscriptions.create_index("id", unique=True)
    await db.digest_subscriptions.create_index([("user_id", 1), ("channel", 1)], unique=True, partialFilterExpression={"deleted_at": None})
    await db.digest_subscriptions.create_index([("enabled", 1), ("schedule_cron", 1)])
    await db.digest_logs.create_index([("user_id", 1), ("sent_at", -1)])
    await db.digest_logs.create_index([("sent_at", -1)])

    # Phase 10 — Productionization (logs, scheduler runs)
    await db.log_entries.create_index([("ts", -1)])
    await db.log_entries.create_index([("level", 1), ("ts", -1)])
    await db.log_entries.create_index([("request_id", 1)])
    await db.log_entries.create_index([("user_id", 1), ("ts", -1)])
    # TTL index — auto-prune raw logs after 30 days (archival service still copies first)
    await db.log_entries.create_index("ts_dt", expireAfterSeconds=60 * 60 * 24 * 30)
    await db.scheduler_runs.create_index([("started_at", -1)])
    await db.scheduler_runs.create_index([("job_id", 1), ("started_at", -1)])

    # Reservations — Booking Management
    await db.reservations.create_index("id", unique=True)
    await db.reservations.create_index([("outlet_id", 1), ("reservation_date", 1), ("status", 1)])
    await db.reservations.create_index([("customer_phone", 1)])
    await db.reservations.create_index([("member_id", 1)])
    await db.reservations.create_index([("reservation_date", 1), ("status", 1)])
    await db.reservations.create_index([("deleted_at", 1)])

    logger.info("Indexes ensured (with Phase 7E hot-path indexes)")


def serialize(doc: Any) -> Any:
    """Recursively strip Mongo's _id and convert datetime to ISO."""
    from datetime import datetime
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k == "_id":
                continue
            out[k] = serialize(v)
        return out
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc
