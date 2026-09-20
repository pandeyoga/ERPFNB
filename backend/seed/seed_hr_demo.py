"""seed_hr_demo.py — HR demo data the core seeds previously skipped.

Fills two collections so HR Home KPIs + pages render REAL data:
  • employee_advances  (kasbon)        → /hr/advances, HR Home "Open Advances"
  • service_charge_periods             → /hr/service-charge, HR Home "service charge pending"

Design notes (follows ENGINEERING_GUARDRAILS canonical paths):
  • Advances use the SAME schema as services/_hr/advances.create_advance (incl. the
    amortization `schedule` built via _build_schedule). Mix of statuses so the
    dashboard, approval queue, and outstanding calc all have data.
  • Service charge is produced via the REAL calculate_service_charge() service (not a
    hand-rolled doc) so allocations/policy stay correct. It reads validated
    daily_sales.service_charge — we defensively backfill that field if missing.

Idempotent. Run: cd /app/backend && python3 -m seed.seed_hr_demo
"""
import asyncio
import random
import uuid
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

from core.db import init_db, close_db, get_db
from services._hr.advances import _build_schedule
from services.hr_constants import _period_now
from utils.number_series import next_doc_no


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _months_ago_date(n: int, day: int = 5) -> str:
    today = datetime.now(timezone.utc)
    y, m = today.year, today.month - n
    while m < 1:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}-{day:02d}"


# Status mix → how many of each to create (order independent)
ADVANCE_PLAN = (
    ["repaying"] * 6 + ["awaiting_approval"] * 3 + ["draft"] * 2 + ["settled"] * 1
)


async def seed_advances(db) -> int:
    print("Seeding Employee Advances (kasbon)…")
    await db.employee_advances.delete_many({})  # idempotent
    employees = await db.employees.find({"deleted_at": None, "status": "active"}).to_list(300)
    if not employees:
        print("  ! No active employees found — run seed_demo first. Skipping advances.")
        return 0
    random.shuffle(employees)

    count = 0
    for i, status in enumerate(ADVANCE_PLAN):
        if i >= len(employees):
            break
        emp = employees[i]
        principal = float(random.choice([1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000]))
        terms = random.choice([2, 3, 4, 6])

        # advance_date: older for repaying/settled so installments are due/paid.
        months_back = {"repaying": 2, "settled": 8, "awaiting_approval": 0, "draft": 0}[status]
        advance_date = _months_ago_date(months_back)
        monthly, schedule = _build_schedule(principal, terms, advance_date)

        approved_at = approved_by = disbursed_at = settled_at = None
        if status == "repaying":
            # Mark the first 1..(terms-1) installments paid → realistic outstanding.
            paid_n = random.randint(1, max(1, terms - 1))
            for k in range(paid_n):
                schedule[k]["paid"] = True
                schedule[k]["paid_at"] = _now()
            approved_at = _now()
            approved_by = "system-seed"
            disbursed_at = _now()
        elif status == "settled":
            for line in schedule:
                line["paid"] = True
                line["paid_at"] = _now()
            approved_at = disbursed_at = settled_at = _now()
            approved_by = "system-seed"

        doc_no = await next_doc_no("EA")
        doc = {
            "id": str(uuid.uuid4()),
            "doc_no": doc_no,
            "employee_id": emp["id"],
            "employee_name": emp.get("full_name"),
            "outlet_id": emp.get("outlet_id"),
            "advance_date": advance_date,
            "principal": principal,
            "terms_months": terms,
            "monthly_installment": monthly,
            "schedule": schedule,
            "status": status,
            "reason": random.choice([
                "Biaya pengobatan keluarga", "Renovasi rumah", "Biaya sekolah anak",
                "Keperluan mendesak", "Modal usaha sampingan",
            ]),
            "payment_method_id": None,
            "approved_by": approved_by,
            "approved_at": approved_at,
            "submitted_at": _now() if status in ("awaiting_approval", "repaying", "settled") else None,
            "disbursed_at": disbursed_at,
            "journal_entry_id": None,
            "settled_at": settled_at,
            "notes": None,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": "system-seed",
        }
        await db.employee_advances.insert_one(doc)
        count += 1

    print(f"  → {count} advances seeded "
          f"(repaying/awaiting_approval/draft/settled).")
    return count


async def backfill_daily_sales_service_charge(db) -> int:
    """Defensive: ensure validated daily_sales carry a service_charge (5% of revenue)
    so the canonical calculate_service_charge has something to distribute."""
    updated = 0
    q = {
        "deleted_at": None, "status": "validated",
        "$or": [{"service_charge": {"$in": [None, 0]}}, {"service_charge": {"$exists": False}}],
    }
    async for ds in db.daily_sales.find(q, {"id": 1, "grand_total": 1, "total_revenue": 1}):
        base = float(ds.get("grand_total") or ds.get("total_revenue") or 0)
        if base <= 0:
            continue
        sc = round(base * 0.05)
        await db.daily_sales.update_one({"id": ds["id"]}, {"$set": {"service_charge": sc}})
        updated += 1
    if updated:
        print(f"  → backfilled service_charge on {updated} validated daily_sales.")
    return updated


async def seed_service_charge(db) -> int:
    from services._hr import service_charge as sc_mod

    print("Seeding Service Charge periods (calculated from validated daily_sales)…")
    await backfill_daily_sales_service_charge(db)
    # Clear prior demo SC for current period to stay idempotent.
    period = _period_now()
    await db.service_charge_periods.delete_many({"period": period})

    sys_user = {"id": "system-seed", "outlet_ids": ["*"]}
    outlets = await db.outlets.find({"deleted_at": None}).to_list(100)
    count = 0
    for o in outlets:
        try:
            res = await sc_mod.calculate_service_charge(
                {"period": period, "outlet_id": o["id"]}, user=sys_user,
            )
            # Approve roughly half so the demo shows both "calculated" and "approved".
            if random.random() < 0.5 and res.get("id"):
                try:
                    await sc_mod.approve_service_charge(res["id"], user=sys_user)
                except Exception:
                    pass
            count += 1
        except Exception as e:  # noqa: BLE001
            print(f"  ! {o.get('code')}: {e}")
    print(f"  → {count} service charge periods for {period}.")
    return count


async def main():
    await init_db()
    db = get_db()
    print("=" * 60)
    print("HR DEMO SEED — advances + service charge")
    print("=" * 60)
    await seed_advances(db)
    await seed_service_charge(db)
    print("\nHR demo seed complete.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
