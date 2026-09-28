"""seed_item_costs.py — E2: tambahkan unit_cost ke koleksi items.

Items tidak punya unit_cost (field kosong/None) sehingga inventory valuation
dan GL opening JE tidak bisa dihitung. Script ini menambahkan harga pokok
realistis per item berdasarkan kategori.

Idempotent: update hanya jika unit_cost belum diset atau = 0.
Run: cd /app/backend && python3 -m seed.seed_item_costs
"""
import asyncio
import os

try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

from core.db import init_db, close_db, get_db

# Harga pokok realistis (Rp) per item — bisa disesuaikan owner
UNIT_COSTS: dict[str, float] = {
    # Bahan Baku Dapur
    "Daging Sapi Has Dalam": 160_000,    # per kg
    "Ayam Fillet Dada": 45_000,          # per kg
    "Bawang Putih": 38_000,              # per kg
    "Susu UHT 1 Liter": 17_500,          # per liter
    "Telur Ayam Negeri": 32_000,         # per kg
    "Beras Premium": 16_000,             # per kg
    # Bahan Baku Bar
    "Kopi Arabica Bali": 120_000,        # per kg
    "Teh Hitam Premium": 28_000,         # per pack
    "Sirup Vanilla 1L": 85_000,          # per liter
    "Susu Full Cream": 22_000,           # per liter
    # Bahan Habis Pakai
    "Tisu Paseo 250 Ply": 20_000,        # per pcs
    "Sedotan Plastik Pack": 5_500,       # per pack
    "Sabun Cuci Sunlight": 12_000,       # per btl
}

# Harga pokok default per kategori (fallback jika nama tidak cocok)
CATEGORY_DEFAULT_COSTS: dict[str, float] = {
    "Bahan Baku Dapur": 35_000,
    "Bahan Baku Bar": 40_000,
    "Bahan Habis Pakai": 15_000,
}


async def main():
    await init_db()
    db = get_db()
    print("=" * 60)
    print("SEED ITEM COSTS (E2 — GL Inventory Opening)")
    print("=" * 60)

    # Build category name map
    cats: dict[str, str] = {}
    async for cat in db.categories.find({"deleted_at": None}):
        cats[cat["id"]] = cat.get("name", "")

    updated = 0
    skipped = 0
    async for item in db.items.find({"deleted_at": None}):
        existing_cost = float(item.get("unit_cost") or 0)
        if existing_cost > 0:
            skipped += 1
            continue

        name = item.get("name", "")
        cat_id = item.get("category_id", "")
        cat_name = cats.get(cat_id, "")

        # Cari di UNIT_COSTS by name (exact), lalu by category default
        cost = UNIT_COSTS.get(name)
        if cost is None:
            cost = CATEGORY_DEFAULT_COSTS.get(cat_name, 20_000)

        await db.items.update_one(
            {"id": item["id"]},
            {"$set": {"unit_cost": float(cost)}}
        )
        print(f"  + {name:<30} cat={cat_name:<20} unit_cost=Rp {cost:>10,.0f}")
        updated += 1

    print(f"  → {updated} item diperbarui, {skipped} dilewati (sudah ada cost).")
    print("Item costs seed complete.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
