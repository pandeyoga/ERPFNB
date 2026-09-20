#!/usr/bin/env python3
"""D1 backfill — post historical (seeded) AP subledger to the GL as an opening balance.

The demo seeded `ap_ledgers` (vendor invoices) directly WITHOUT posting the corresponding
journal entries, so the Balance Sheet showed liabilities = 0 despite real AP outstanding.

This one-off, idempotent script posts a single opening-balance JE:
    Dr Retained Earnings   (total outstanding)
    Cr Accounts Payable    (total outstanding)
so GL AP control == AP subledger and the Balance Sheet reflects the liability.

Run: python /app/scripts/backfill_ap_opening.py
"""
import asyncio
import sys

sys.path.insert(0, "/app/backend")

# Load backend env BEFORE core.config is imported, otherwise settings.db_name
# falls back to the default and this script silently targets an empty database.
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

REFERENCE_KEY = "ap_opening_balance_backfill"


async def main():
    from core.db import get_db, init_db
    await init_db()
    db = get_db()

    existing = await db.journal_entries.find_one({"reference_key": REFERENCE_KEY, "deleted_at": None})
    if existing:
        print(f"✅ Already backfilled: {existing.get('doc_no')} (idempotent, nothing to do)")
        return

    rows = await db.ap_ledgers.find(
        {"status": {"$in": ["open", "partial", "overdue"]}, "deleted_at": None},
        {"balance": 1},
    ).to_list(5000)
    total = round(sum(float(r.get("balance", 0) or 0) for r in rows), 2)
    if total < 1:
        print("No outstanding AP to backfill.")
        return

    from services import gl_mapping
    ap_coa = await gl_mapping.resolve("accounts_payable")
    re_coa = await gl_mapping.resolve("retained_earnings")

    from services._journal._common import _post_journal
    lines = [
        {"coa_id": re_coa, "dr": total, "cr": 0, "memo": "Opening balance — AP historis (backfill D1)"},
        {"coa_id": ap_coa, "dr": 0, "cr": total, "memo": "Opening balance — Accounts Payable (backfill D1)"},
    ]
    je = await _post_journal(
        entry_date="2026-06-01",
        description="Opening Balance — AP subledger backfill (D1 forensic audit)",
        source_type="ap_opening",
        source_id="backfill",
        lines=lines,
        user_id="system-backfill",
    )
    await db.journal_entries.update_one({"id": je["id"]}, {"$set": {"reference_key": REFERENCE_KEY}})
    print(f"✅ Posted AP opening JE {je.get('doc_no')} for Rp {total:,.0f} "
          f"(Dr Retained Earnings / Cr Accounts Payable) across {len(rows)} ledgers.")


asyncio.run(main())
