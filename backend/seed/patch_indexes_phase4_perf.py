"""Phase 4-Hardening: Apply MongoDB index optimization on existing DB.

Run this to migrate an existing deployment to the new index set without restart.
For fresh deployments, ensure_indexes() in core/db.py applies them automatically.

Usage:
    cd /app/backend
    python -m seed.patch_indexes_phase4_perf

What it does:
1. Drops legacy non-unique journal_entries(source_type, source_id) index
2. Lets ensure_indexes recreate it as UNIQUE PARTIAL
3. Adds 3-field daily_sales(outlet_id, status, sales_date) compound
4. Adds service_charge_runs and payroll_runs in-progress unique partial guards

Safe to run multiple times (idempotent).
"""
import asyncio
import sys

from core.db import ensure_indexes, init_db


async def main() -> int:
    print("=" * 60)
    print("Phase 4-Hardening: Index migration starting")
    print("=" * 60)
    
    await init_db()
    
    # Check for journal_entries duplicates BEFORE creating unique index
    from core.db import get_db
    db = get_db()
    
    print("\n[1/3] Checking for journal_entries duplicates...")
    pipe = [
        {"$match": {
            "source_type": {"$exists": True, "$type": "string"},
            "source_id": {"$exists": True, "$type": "string"},
            "deleted_at": None,
        }},
        {"$group": {"_id": {"st": "$source_type", "sid": "$source_id"}, "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}},
        {"$count": "dups"},
    ]
    has_dups = False
    async for r in db.journal_entries.aggregate(pipe):
        print(f"  ⚠️  Found {r['dups']} duplicate (source_type, source_id) pairs!")
        has_dups = True
    
    if not has_dups:
        print("  ✅ No duplicates — safe to create unique partial index")
    else:
        print("  ❌ Aborting: please dedupe first before creating unique index")
        return 1
    
    print("\n[2/3] Dropping legacy indexes (if exist)...")
    try:
        await db.journal_entries.drop_index("source_type_1_source_id_1")
        print("  ✅ Dropped legacy je(source_type, source_id) non-unique")
    except Exception as e:
        print(f"  ℹ️  Legacy index not present: {type(e).__name__}")
    
    print("\n[3/3] Running ensure_indexes() to apply new specs...")
    await ensure_indexes()
    
    # Verify
    print("\nVerification:")
    for col in ("journal_entries", "daily_sales", "service_charge_runs", "payroll_runs"):
        idx = await db[col].index_information()
        for name, info in idx.items():
            if info.get("partialFilterExpression") and info.get("unique"):
                print(f"  ✅ {col}.{name}: UNIQUE PARTIAL")
        if col == "daily_sales" and "ds_outlet_status_date" in idx:
            print(f"  ✅ {col}.ds_outlet_status_date: 3-field compound")
    
    print("\n" + "=" * 60)
    print("Migration complete.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
