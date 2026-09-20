"""Sprint B — Compound Index Migration Script.

Tambah missing compound indexes yang teridentifikasi di FORENSIC_08_PERFORMANCE_ANALYSIS.
Jalankan sekali: python3 seed/patch_indexes_sprint_b_perf.py

Idempotent: jika index sudah ada, pymongo skip tanpa error.
"""
import asyncio
import os
import sys

import motor.motor_asyncio

# Load env
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
except ImportError:
    pass

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "aurora_fnb")


# ─── Index Definitions ─────────────────────────────────────────────────────────
# Format: (collection_name, index_spec, options_dict)
# ASCENDING = 1, DESCENDING = -1

INDEXES_TO_CREATE = [
    # FORENSIC_08 §2.4 — missing compound indexes

    # item_price_history: N+1 fix for ai_service price suggest loop
    ("item_price_history",   [("item_id", 1), ("vendor_id", 1), ("valid_from", -1)],  {}),
    ("item_price_history",   [("item_id", 1), ("valid_from", -1)],                    {}),

    # loyalty_transactions: customer history page
    ("loyalty_transactions", [("customer_id", 1), ("created_at", -1), ("deleted_at", 1)], {}),
    ("loyalty_transactions", [("customer_id", 1), ("transaction_type", 1)],               {}),

    # reward_redemptions: customer rewards tab
    ("reward_redemptions",   [("customer_id", 1), ("status", 1), ("created_at", -1)], {}),
    ("reward_redemptions",   [("reward_id", 1), ("status", 1)],                       {}),

    # audit_logs: audit trail filters by entity
    ("audit_logs",           [("entity_type", 1), ("entity_id", 1), ("created_at", -1)], {}),
    ("audit_logs",           [("user_id", 1), ("created_at", -1)],                        {}),

    # notifications: unread badge count (already has user_id_1_read_at_1_created_at_-1)
    # Additional for type filtering
    ("notifications",        [("user_id", 1), ("type", 1), ("created_at", -1)], {}),

    # journal_entries: Finance period-close queries (partial indexes might exist already)
    ("journal_entries",      [("period", 1), ("status", 1), ("deleted_at", 1)], {}),
    ("journal_entries",      [("outlet_id", 1), ("period", 1), ("status", 1)],  {}),

    # ap_invoices: Finance AP aging
    ("ap_invoices",          [("status", 1), ("due_date", 1), ("deleted_at", 1)],  {}),
    ("ap_invoices",          [("vendor_id", 1), ("status", 1), ("due_date", 1)],   {}),

    # ar_invoices: similar
    ("ar_invoices",          [("status", 1), ("due_date", 1), ("deleted_at", 1)],  {}),

    # employee_advances: HR payroll N+1 fix lookup
    ("employee_advances",    [("employee_id", 1), ("status", 1), ("deleted_at", 1)], {}),

    # salary_masters: HR payroll N+1 fix
    ("salary_masters",       [("employee_id", 1), ("deleted_at", 1)],                {}),

    # market_list_prices: outlet_budget N+1 fix
    ("market_list_prices",   [("item_id", 1), ("deleted_at", 1), ("created_at", -1)], {}),
    ("market_list_prices",   [("item_id", 1), ("unit", 1), ("deleted_at", 1)],         {}),

    # purchase_orders: anomaly_service N+1 fix
    ("purchase_orders",      [("id", 1), ("deleted_at", 1)],                          {"sparse": True}),

    # refresh_tokens: auth sweep + rotation lookup (already has jti_1 unique without sparse)
    # ("refresh_tokens",       [("jti", 1)],                                             {"unique": True, "sparse": True}),
    ("refresh_tokens",       [("user_id", 1), ("revoked_at", 1)],                      {}),

    # digest_subscriptions: owner_digest N+1 fix
    ("digest_subscriptions", [("user_id", 1), ("enabled", 1), ("deleted_at", 1)],     {}),

    # anomaly_events: anomaly feed combined
    ("anomaly_events",       [("event_type", 1), ("severity", 1), ("created_at", -1)], {}),

    # cash_accounts: cash position dashboard
    ("cash_accounts",        [("outlet_id", 1), ("type", 1), ("deleted_at", 1)],       {}),
]


async def run() -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    created = 0
    skipped = 0
    errors   = 0

    for coll_name, spec, opts in INDEXES_TO_CREATE:
        try:
            coll = db[coll_name]
            await coll.create_index(spec, background=True, **opts)
            print(f"  ✅  {coll_name}: {spec}")
            created += 1
        except Exception as e:
            if "already exists" in str(e).lower() or "index already exists" in str(e).lower():
                print(f"  ↔  {coll_name}: {spec} (already exists, skipped)")
                skipped += 1
            else:
                print(f"  ❌  {coll_name}: {spec} → {e}")
                errors += 1

    print(f"\n📊 Index migration complete: {created} created, {skipped} skipped, {errors} errors")
    client.close()


if __name__ == "__main__":
    print("🚀 Sprint B — Compound Index Migration")
    print(f"   DB: {DB_NAME} @ {MONGO_URL[:40]}")
    print(f"   Indexes to process: {len(INDEXES_TO_CREATE)}\n")
    asyncio.run(run())
