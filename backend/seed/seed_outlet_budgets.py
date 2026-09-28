"""Seed sample outlet operational budgets (current + previous week + month).

Idempotent: clears any existing outlet_budgets, then seeds for all active outlets.
Values are realistic placeholders inspired by F&B industry COGS ratios but DO NOT
use forecasting (per requirement: manual only).

Run: python -m seed.seed_outlet_budgets
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from models.outlet_budget import (  # noqa: E402
    iso_week_key, month_key, week_range, month_range,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed():
    db = get_db()
    print("Clearing existing outlet_budgets and increase_requests…")
    await db.outlet_budgets.delete_many({})
    await db.budget_increase_requests.delete_many({})

    # Find first executive user as 'set_by'
    exec_user = await db.users.find_one({
        "$or": [{"permissions": "*"}, {"permissions": "executive.dashboard.read"}],
        "deleted_at": None,
    })
    exec_id = exec_user["id"] if exec_user else "system"

    today = datetime.now(timezone.utc).date()
    # Current week (Mon–Sun) and current month
    w_start, w_end = week_range(today)
    m_start, m_end = month_range(today)
    # Previous week + month
    pw_anchor = w_start - timedelta(days=1)
    pw_start, pw_end = week_range(pw_anchor)
    pm_anchor = m_start - timedelta(days=1)
    pm_start, pm_end = month_range(pm_anchor)

    outlets = await db.outlets.find({"deleted_at": None, "is_active": {"$ne": False}}).to_list(None)
    if not outlets:
        print("⚠️  No outlets found — run seed_demo first.")
        return
    print(f"Seeding budgets for {len(outlets)} outlets across 4 periods (weekly+monthly current+prev)…")

    # Realistic ranges per period (in IDR millions)
    monthly_kdo_range = (60_000_000, 110_000_000)
    monthly_fdo_range = (3_000_000, 8_000_000)
    monthly_bdo_range = (15_000_000, 40_000_000)

    def _scale_for_brand(brand_code: str | None) -> float:
        # Adjust scale by brand (The Bakery premium gets higher; The Bistro lower)
        if not brand_code:
            return 1.0
        bc = brand_code.lower()
        if "bak" in bc:
            return 1.4
        if "alt" in bc:
            return 1.2
        if "cal" in bc:
            return 0.7
        if "sol" in bc:
            return 0.85
        return 1.0

    inserted = 0
    for idx, ol in enumerate(outlets):
        # Get brand info
        brand = await db.brands.find_one({"id": ol.get("brand_id")}, {"code": 1}) if ol.get("brand_id") else None
        bcode = (brand or {}).get("code")
        scale = _scale_for_brand(bcode)
        # Deterministic per outlet (idx-based variation)
        base_kdo = (monthly_kdo_range[0] + (monthly_kdo_range[1] - monthly_kdo_range[0]) * ((idx % 5) / 4))
        base_fdo = (monthly_fdo_range[0] + (monthly_fdo_range[1] - monthly_fdo_range[0]) * ((idx % 5) / 4))
        base_bdo = (monthly_bdo_range[0] + (monthly_bdo_range[1] - monthly_bdo_range[0]) * ((idx % 5) / 4))
        m_kdo = round(base_kdo * scale, -3)
        m_fdo = round(base_fdo * scale, -3)
        m_bdo = round(base_bdo * scale, -3)
        # Weekly = ~1/4.33 of monthly
        w_kdo = round(m_kdo / 4.33, -3)
        w_fdo = round(m_fdo / 4.33, -3)
        w_bdo = round(m_bdo / 4.33, -3)

        for spec in [
            ("monthly", month_key(today), m_start, m_end, m_kdo, m_fdo, m_bdo, "Budget bulan berjalan"),
            ("monthly", month_key(pm_anchor), pm_start, pm_end, m_kdo, m_fdo, m_bdo, "Budget bulan lalu"),
            ("weekly", iso_week_key(today), w_start, w_end, w_kdo, w_fdo, w_bdo, "Budget minggu berjalan"),
            ("weekly", iso_week_key(pw_anchor), pw_start, pw_end, w_kdo, w_fdo, w_bdo, "Budget minggu lalu"),
        ]:
            ptype, pkey, pstart, pend, k, f, b, note = spec
            doc = {
                "id": str(uuid.uuid4()),
                "outlet_id": ol["id"],
                "brand_id": ol.get("brand_id"),
                "period_type": ptype,
                "period_key": pkey,
                "period_start": pstart.strftime("%Y-%m-%d"),
                "period_end": pend.strftime("%Y-%m-%d"),
                "kdo_budget": float(k),
                "fdo_budget": float(f),
                "bdo_budget": float(b),
                "total_budget": float(k + f + b),
                "alert_threshold_pct": 80.0,
                "notes": note,
                "set_by": exec_id,
                "status": "active",
                "created_at": _now(),
                "updated_at": _now(),
                "deleted_at": None,
            }
            await db.outlet_budgets.insert_one(doc)
            inserted += 1

    print(f"✅ Seeded {inserted} outlet_budgets ({len(outlets)} outlets × 4 periods).")

    # Sample increase requests — 1 pending, 1 approved, 1 rejected
    if outlets:
        ol0 = outlets[0]
        m_doc = await db.outlet_budgets.find_one({
            "outlet_id": ol0["id"], "period_type": "monthly", "period_key": month_key(today),
        })
        if m_doc:
            sample_requests = [
                {
                    "id": str(uuid.uuid4()),
                    "outlet_id": ol0["id"], "brand_id": ol0.get("brand_id"),
                    "budget_id": m_doc["id"], "bucket": "kdo",
                    "requested_amount": 5_000_000.0,
                    "reason": "Promo musiman, demand sayur dan daging meningkat 25% — perlu tambahan untuk procurement bahan dapur.",
                    "related_pr_id": None, "related_pr_amount": None,
                    "status": "pending",
                    "requested_by": exec_id,
                    "requested_at": _now(),
                    "decided_by": None, "decided_at": None,
                    "decision_note": None, "approved_amount": None,
                    "created_at": _now(), "updated_at": _now(),
                    "deleted_at": None,
                },
            ]
            for r in sample_requests:
                await db.budget_increase_requests.insert_one(r)
            print(f"✅ Seeded {len(sample_requests)} sample increase request(s).")

    total = await db.outlet_budgets.count_documents({"deleted_at": None})
    print(f"\n  Total active outlet_budgets in DB: {total}")


async def main():
    await init_db()
    try:
        await seed()
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
