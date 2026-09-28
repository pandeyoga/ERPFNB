"""Phase 9C demo seed — backfills inventory_movements + sets par_levels.

This complements seed_phase7b_demo.py which creates POs/GRs but doesn't
populate inventory_movements (a pre-existing gap). For Phase 9C polish
(Stock Matrix + Low Stock Alert) to render meaningfully on demo data,
we need:
  - Receipt movements (positive qty) from each posted GR line
  - Issue/consumption movements (negative qty) seeded from daily_sales
    using a simple per-outlet usage profile so balances trend below par.
  - Reasonable `par_levels` set on items.

Run: cd /app/backend && python -m seed.seed_phase9c_demo

Idempotent: safe to re-run; it clears its own seeded movements first
(tagged with source_type="seed_9c") and then re-inserts.
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from core.db import init_db, get_db, close_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Deterministic per-item par defaults (qty to keep on hand per outlet)
DEFAULT_PARS: dict[str, float] = {
    # Common Indonesian F&B kitchen + bar staples
    "Beras Premium": 50.0,
    "Telur Ayam Negeri": 60.0,
    "Ayam Fillet Dada": 40.0,
    "Daging Sapi Has Dalam": 25.0,
    "Cumi Beku": 20.0,
    "Susu UHT 1L": 30.0,
    "Cabe Merah Keriting": 15.0,
    "Bawang Merah": 20.0,
    "Bawang Putih": 18.0,
    "Minyak Goreng Premium": 25.0,
    "Tepung Terigu": 30.0,
    "Gula Pasir": 25.0,
    "Teh Hitam Premium": 12.0,
    "Kopi Espresso Bean": 15.0,
    "Wagyu Striploin": 10.0,
}


async def seed():
    print("=" * 60)
    print("Phase 9C demo seed — inventory_movements backfill + par_levels")
    print("=" * 60)

    await init_db()
    db = get_db()

    items = await db.items.find({"deleted_at": None, "active": True}).to_list(500)
    outlets = await db.outlets.find({"deleted_at": None, "active": True}).to_list(50)
    grs = await db.goods_receipts.find({"deleted_at": None, "status": "posted"}).to_list(500)

    print(f"  Items: {len(items)}, Outlets: {len(outlets)}, GRs: {len(grs)}")

    # 1) Set par_levels on items
    par_set = 0
    for it in items:
        # For each item, set both a per-outlet par and a global default
        explicit_par_outlets = {}
        target_par = DEFAULT_PARS.get(it.get("name", ""), 10.0)
        for o in outlets:
            # Slight variance per outlet (90%..120%)
            jitter = random.uniform(0.9, 1.2)
            explicit_par_outlets[o["id"]] = round(target_par * jitter, 1)
        await db.items.update_one(
            {"id": it["id"]},
            {"$set": {
                "par_levels": explicit_par_outlets,
                "par_level": target_par,
                "updated_at": _now(),
            }},
        )
        par_set += 1
    print(f"  Set par_levels on {par_set} items")

    # 2) Clear prior Phase 9C seed movements
    deleted = await db.inventory_movements.delete_many({"source_type": "seed_9c"})
    print(f"  Cleared {deleted.deleted_count} prior 9C movements")

    # 3) Insert receipt movements from each GR line
    new_movements: list[dict] = []
    for gr in grs:
        outlet_id = gr.get("outlet_id")
        recv_date = gr.get("receive_date")
        for ln in gr.get("lines", []) or []:
            qty = float(ln.get("qty_received") or 0)
            unit_cost = float(ln.get("unit_cost") or 0)
            if qty <= 0:
                continue
            new_movements.append({
                "id": str(uuid.uuid4()),
                "created_at": _now(),
                "updated_at": _now(),
                "deleted_at": None,
                "movement_type": "receipt",
                "movement_date": recv_date,
                "item_id": ln.get("item_id"),
                "item_name": ln.get("item_name"),
                "outlet_id": outlet_id,
                "qty": qty,
                "unit": ln.get("unit"),
                "unit_cost": unit_cost,
                "total_cost": round(qty * unit_cost, 2),
                "source_type": "seed_9c",
                "source_id": gr.get("id"),
                "source_doc_no": gr.get("doc_no"),
                "note": "Seed 9C — backfilled from GR",
            })

    receipt_count = len(new_movements)
    print(f"  Generated {receipt_count} receipt movements from GRs")

    # 4) Generate consumption (issue) movements per outlet per item
    today = datetime.now(timezone.utc).date()
    days_back = 30
    issue_count = 0
    item_lookup = {it["id"]: it for it in items}
    # Group receipts by (item, outlet) for choosing realistic unit_cost
    cost_lookup: dict[tuple, float] = {}
    for mv in new_movements:
        cost_lookup[(mv["item_id"], mv["outlet_id"])] = mv["unit_cost"]

    for it in items:
        item_par = DEFAULT_PARS.get(it.get("name", ""), 10.0)
        # Daily usage average ~ par_level / 4 (so 4 days of stock would deplete to zero)
        daily_avg = max(item_par / 4.0, 0.5)
        for o in outlets:
            for d in range(days_back):
                day = (today - timedelta(days=d)).isoformat()
                # ~70% of days have outflow
                if random.random() > 0.7:
                    continue
                qty = round(random.uniform(daily_avg * 0.5, daily_avg * 1.5), 2)
                if qty <= 0:
                    continue
                unit_cost = cost_lookup.get((it["id"], o["id"]), 0.0)
                new_movements.append({
                    "id": str(uuid.uuid4()),
                    "created_at": _now(),
                    "updated_at": _now(),
                    "deleted_at": None,
                    "movement_type": "issue",
                    "movement_date": day,
                    "item_id": it["id"],
                    "item_name": it.get("name"),
                    "outlet_id": o["id"],
                    "qty": -qty,  # negative for outflow
                    "unit": it.get("unit_default"),
                    "unit_cost": unit_cost,
                    "total_cost": round(-qty * unit_cost, 2),
                    "source_type": "seed_9c",
                    "source_id": None,
                    "source_doc_no": None,
                    "note": "Seed 9C — consumption simulation",
                })
                issue_count += 1

    print(f"  Generated {issue_count} consumption movements")

    if new_movements:
        # Insert in batches
        BATCH = 500
        for i in range(0, len(new_movements), BATCH):
            await db.inventory_movements.insert_many(new_movements[i:i + BATCH])

    print()
    print("=" * 60)
    print("Phase 9C seed complete.")
    print("=" * 60)
    total = await db.inventory_movements.count_documents({})
    below_par_estimate = 0
    # Quick check: for each (item, outlet), compute net qty vs item.par_level
    for it in items[:30]:
        for o in outlets:
            cursor = db.inventory_movements.aggregate([
                {"$match": {"item_id": it["id"], "outlet_id": o["id"], "deleted_at": None}},
                {"$group": {"_id": None, "qty": {"$sum": "$qty"}}},
            ])
            async for r in cursor:
                par = (it.get("par_levels") or {}).get(o["id"]) or it.get("par_level") or 0
                if r.get("qty", 0) < par:
                    below_par_estimate += 1
    print(f"Movements total: {total}")
    print(f"Cells below par (sampled): {below_par_estimate}")
    print()
    print("Visit: /inventory/balance (toggle to Matrix view)")
    print("       /inventory/low-stock")
    print("=" * 60)
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
