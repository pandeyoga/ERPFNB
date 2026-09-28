"""Seed demo rewards for the loyalty program."""
import asyncio
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

REWARDS = [
    {
        "name": "Free Dessert Pilihan",
        "description": "Nikmati satu dessert gratis dari menu signature kami. Berlaku untuk semua outlet FnB Group.",
        "points_required": 300,
        "category": "voucher",
        "image_url": "https://images.unsplash.com/photo-1761637604893-f049f46d2bcd?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 50,
    },
    {
        "name": "Diskon 20% Minuman",
        "description": "Dapatkan potongan 20% untuk semua jenis minuman. Berlaku hari ini juga, setelah ditukar.",
        "points_required": 200,
        "category": "voucher",
        "image_url": "https://images.unsplash.com/photo-1663152350760-8a660b378614?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 100,
    },
    {
        "name": "Free Upgrade Kopi",
        "description": "Upgrade minuman kopi Anda ke size Large secara gratis. Berlaku di semua outlet.",
        "points_required": 150,
        "category": "voucher",
        "image_url": "https://images.unsplash.com/photo-1599445176782-d5febfc1d7ae?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 200,
    },
    {
        "name": "Matcha Premium Cake Slice",
        "description": "Nikmati sepotong Matcha Cake premium kami yang lembut dan mewah. Stok terbatas!",
        "points_required": 500,
        "category": "voucher",
        "image_url": "https://images.unsplash.com/photo-1759324351433-c5a1063f8ac6?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 30,
    },
    {
        "name": "VIP Table Reservation",
        "description": "Reservasi meja VIP untuk 2 orang di outlet pilihan Anda. Termasuk complimentary welcome drink.",
        "points_required": 2000,
        "category": "experience",
        "image_url": "https://images.unsplash.com/photo-1763626080059-523898c7ffef?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 10,
    },
    {
        "name": "Chef's Table Experience",
        "description": "Exclusive dining experience bersama Chef kami. Untuk 2 orang. Pengalaman tak terlupakan!",
        "points_required": 5000,
        "category": "experience",
        "image_url": "https://images.unsplash.com/photo-1762087577613-978bf9066d39?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 5,
    },
    {
        "name": "FnB Group Loyalty Gift Box",
        "description": "Gift box eksklusif berisi merchandise pilihan FnB Group. Sempurna sebagai hadiah.",
        "points_required": 1500,
        "category": "merchandise",
        "image_url": "https://images.unsplash.com/photo-1760804876161-ba0337e998fe?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 20,
    },
    {
        "name": "FnB Group Premium Tumbler",
        "description": "Tumbler premium FnB Group 500ml dengan desain eksklusif. Anti-bocor, BPA-free.",
        "points_required": 1000,
        "category": "merchandise",
        "image_url": "https://images.unsplash.com/photo-1760804876166-aae5861ec7c1?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=600",
        "stock": 25,
    },
]


async def seed():
    from core.db import init_db, get_db, close_db
    await init_db()
    db = get_db()

    # Check if rewards already exist
    existing = await db.rewards.count_documents({})
    if existing > 0:
        print(f"⚠️  {existing} rewards already exist. Skipping...")
        print("   To re-seed, drop the rewards collection first.")
        await close_db()
        return

    now = datetime.now(timezone.utc)
    docs = []
    for r in REWARDS:
        reward_id = str(uuid.uuid4())
        docs.append({
            "id": reward_id,
            **r,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })

    await db.rewards.insert_many(docs)
    print(f"✅ Seeded {len(docs)} rewards:")
    for d in docs:
        print(f"   - [{d['category'].upper()}] {d['name']} — {d['points_required']} pts")

    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
