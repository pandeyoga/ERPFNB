"""
Seed script: CRM / Loyalty demo data
Creates 250 customers + ~3,500 transactions spanning 15 months.
Realistic Indonesian F&B loyalty behaviour across all tiers and segments.

Run: python3 seed/seed_crm_demo.py
"""
import asyncio
import uuid
import random
from datetime import datetime, timezone, timedelta
import motor.motor_asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from passlib.context import CryptContext

# RC-1/RC-8 fix: load backend/.env so this standalone seed writes to the
# canonical DB (test_database) instead of the wrong hardcoded default.
load_dotenv(Path(__file__).parent.parent / ".env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

NOW = datetime.now(timezone.utc)

BRAND_IDS = ["brand-the-coffeeshop", "brand-taiko", "brand-tango", "brand-bensu"]
OUTLET_IDS = [f"outlet-{i}" for i in range(1, 13)]
FIRST_NAMES = ["Budi", "Dewi", "Rizky", "Siti", "Ahmad", "Rina", "Fajar", "Maya",
               "Yoga", "Putri", "Hendra", "Lestari", "Dimas", "Nadia", "Bagas", "Ayu",
               "Firman", "Intan", "Wahyu", "Citra", "Arif", "Sari", "Eko", "Vina",
               "Reza", "Nurul", "Ivan", "Dian", "Taufik", "Lia", "Hendri", "Ratna",
               "Agus", "Fitri", "Yusuf", "Melisa", "Andi", "Wulan", "Joko", "Sinta",
               "Kevin", "Annisa", "Galih", "Ira", "Prasetyo", "Bella", "Haris", "Tiara"]
LAST_NAMES = ["Santoso", "Wijaya", "Kusuma", "Pratama", "Suharto", "Rahayu", "Nugraha",
              "Saputra", "Hidayat", "Permata", "Wibowo", "Lestari", "Purnama", "Suryadi",
              "Handoko", "Setiawan", "Sulistyo", "Wicaksono", "Firmansyah", "Oktaviani"]


def rand_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def rand_email(name: str, idx: int):
    clean = name.lower().replace(" ", ".").replace("'", "")
    return f"{clean}.{idx}@example.com"


def rand_phone():
    return f"08{random.randint(10,99)}{random.randint(10000000,99999999)}"


def rand_dob():
    year = random.randint(1975, 2002)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year}-{month:02d}-{day:02d}"


def tier_from_points(pts: int) -> str:
    if pts >= 5000:
        return "gold"
    if pts >= 1000:
        return "silver"
    return "bronze"


def make_customer(idx: int, created_at: datetime, segment: str) -> dict:
    name = rand_name()
    customer_id = str(uuid.uuid4())
    return {
        "id": customer_id,
        "email": rand_email(name, idx),
        "full_name": name,
        "phone": rand_phone(),
        "date_of_birth": rand_dob(),
        "gender": random.choice(["male", "female"]),
        "hashed_password": pwd_context.hash("Customer@1234"),
        "email_verified": random.random() > 0.2,
        "is_active": segment != "churned" or random.random() > 0.5,
        "loyalty_tier": "bronze",          # will update after seeding transactions
        "total_points": 0,
        "lifetime_points": 0,
        "total_spend": 0.0,
        "visit_count": 0,
        "last_transaction_at": None,
        "segment": segment,                # for analytics
        "created_at": created_at,
        "updated_at": created_at,
    }


def make_transaction(customer_id: str, amount: float, created_at: datetime, brand_id: str, outlet_id: str) -> dict:
    # More generous point rate for demo: Rp 1,000 = 1 point (not 10,000)
    points = max(1, int(amount / 1_000))
    return {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "transaction_type": "earn",
        "points": points,
        "amount": amount,
        "description": f"Purchase at {brand_id.replace('brand-', '').title()} Cafe",
        "reference_type": "purchase",
        "reference_id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "outlet_id": outlet_id,
        "created_at": created_at,
        "created_by": "system_seed",
    }


SEGMENTS = {
    # segment: (weight, created_age_months, visit_pattern)
    # visit_pattern: list of (months_ago_start, months_ago_end, visits_per_month_min, visits_per_month_max)
    "new":        (0.12, (0, 1),    [(0, 1, 1, 3)]),
    "active":     (0.38, (1, 14),   [(0, 12, 1, 5)]),
    "occasional": (0.20, (2, 15),   [(0, 12, 0, 2), (1, 3, 1, 2)]),  # sparse visits
    "at_risk":    (0.18, (3, 15),   [(3, 12, 1, 4), (0, 3, 0, 0)]),  # no recent visits
    "churned":    (0.12, (6, 18),   [(6, 18, 1, 3), (0, 6, 0, 0)]),  # stopped visiting
}

AMOUNT_RANGES = {
    "bronze": (45_000, 175_000),
    "silver": (100_000, 300_000),
    "gold":   (200_000, 600_000),
}


def pick_segment() -> str:
    weights = {k: v[0] for k, v in SEGMENTS.items()}
    return random.choices(list(weights.keys()), weights=list(weights.values()), k=1)[0]


def gen_transactions_for_segment(customer_id: str, customer_created: datetime, segment: str) -> list:
    """Generate realistic transactions for a customer based on their segment."""
    txns = []
    _, _, visit_patterns = SEGMENTS[segment]

    for (start_m, end_m, vmin, vmax) in visit_patterns:
        for month_offset in range(start_m, end_m):
            visits = random.randint(vmin, vmax)
            if visits == 0:
                continue
            for _ in range(visits):
                # Random day within month
                days_ago = month_offset * 30 + random.randint(0, 29)
                tx_time = NOW - timedelta(days=days_ago)
                if tx_time < customer_created:
                    continue  # don't create transactions before signup
                brand = random.choice(BRAND_IDS)
                outlet = random.choice(OUTLET_IDS)
                tier_for_amount = random.choice(["bronze", "bronze", "silver", "gold"])
                low, high = AMOUNT_RANGES[tier_for_amount]
                amount = round(random.randint(low // 1000, high // 1000) * 1000, 0)
                txns.append(make_transaction(customer_id, float(amount), tx_time, brand, outlet))

    return txns


async def run():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Clear existing demo data idempotently. loyalty_transactions are demo-only
    # (seeded exclusively here); clearing all avoids orphan accumulation across
    # re-runs (customers get fresh UUIDs each run).
    await db.loyalty_transactions.delete_many({})
    deleted = (await db.customers.delete_many({"email": {"$regex": "@example.com$"}})).deleted_count
    print(f"Cleared {deleted} existing demo customers + all loyalty_transactions")

    all_customers = []
    all_transactions = []

    segment_list = []
    for seg, (weight, *_) in SEGMENTS.items():
        count = int(250 * weight)
        segment_list.extend([seg] * count)
    random.shuffle(segment_list)
    # Ensure exactly 250
    while len(segment_list) < 250:
        segment_list.append("active")
    segment_list = segment_list[:250]

    for idx, segment in enumerate(segment_list):
        _, (age_min, age_max), _ = SEGMENTS[segment]
        age_days = random.randint(age_min * 30, age_max * 30)
        created_at = NOW - timedelta(days=age_days)

        cust = make_customer(idx + 1, created_at, segment)
        txns = gen_transactions_for_segment(cust["id"], created_at, segment)

        # Compute derived stats
        total_pts = sum(t["points"] for t in txns)
        total_spend = sum(t["amount"] for t in txns)
        visit_count = len(txns)
        last_tx = max((t["created_at"] for t in txns), default=None) if txns else None

        cust["total_points"] = total_pts
        cust["lifetime_points"] = total_pts
        cust["total_spend"] = total_spend
        cust["visit_count"] = visit_count
        cust["last_transaction_at"] = last_tx
        cust["loyalty_tier"] = tier_from_points(total_pts)

        all_customers.append(cust)
        all_transactions.extend(txns)

    # Insert customers
    if all_customers:
        await db.customers.insert_many(all_customers)
    print(f"✅ Inserted {len(all_customers)} customers")

    # Insert transactions in batches
    BATCH = 500
    for i in range(0, len(all_transactions), BATCH):
        batch = all_transactions[i:i + BATCH]
        await db.loyalty_transactions.insert_many(batch)
    print(f"✅ Inserted {len(all_transactions)} transactions")

    # Segment summary
    seg_counts = {}
    for c in all_customers:
        seg = c["segment"]
        seg_counts[seg] = seg_counts.get(seg, 0) + 1
    print("\nCustomer segment breakdown:")
    for seg, cnt in seg_counts.items():
        print(f"  {seg:<12}: {cnt}")

    tier_counts = {}
    for c in all_customers:
        tier = c["loyalty_tier"]
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
    print("\nTier breakdown:")
    for tier, cnt in tier_counts.items():
        print(f"  {tier:<12}: {cnt}")

    print(f"\nTotal transactions: {len(all_transactions)}")
    print("✅ CRM demo seed complete!")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
