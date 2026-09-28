"""seed_inventory_opening.py — D3 fix: opening stock so the inventory SUBLEDGER is coherent.

Problem (forensic D3): the demo seeds generate consumption movements (`issue`, `sale`,
`wastage`, `transfer_out`) WITHOUT any opening stock, so `stock_balance` (which simply
sums signed qty per item×outlet) goes negative for ~90% of items. The Outlet → Stock
Check page then shows negative quantities / negative inventory value.

This is a SEED-COHERENCE artifact (broken demo data), not real business state, so we add
a realistic OPENING movement per item×outlet sized off the item's `par_levels` (real
master data) and valued with the item's average historical unit cost. Final balance lands
at ~1.5–2.5× par level (a well-stocked outlet).

NOTE (intentionally NOT done here): the GL inventory account (1300–1303) is ~ -1.13B from
sales COGS postings. Bringing the GL to match requires REAL opening-stock valuations — an
owner decision (per forensic audit). We do not fabricate that financial figure; this script
only fixes the operational subledger view.

Idempotent. Run: cd /app/backend && python3 -m seed.seed_inventory_opening
"""
import asyncio
import random
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta

try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

from core.db import init_db, close_db, get_db

OPENING_REF = "OPENING-BAL"
OPENING_TYPE = "opening"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def main():
    await init_db()
    db = get_db()
    print("=" * 60)
    print("INVENTORY OPENING STOCK (D3 subledger coherence)")
    print("=" * 60)

    # 1. Idempotent reset of previous opening movements.
    await db.inventory_movements.delete_many({"movement_type": OPENING_TYPE, "ref_doc": OPENING_REF})

    # 2. Item master: par levels (per-outlet) + average historical unit cost.
    items = {it["id"]: it async for it in db.items.find({"deleted_at": None})}
    cost_acc = defaultdict(list)
    net = defaultdict(float)  # (item_id, outlet_id) -> net qty
    async for m in db.inventory_movements.find(
        {"deleted_at": None}, {"item_id": 1, "outlet_id": 1, "qty": 1, "unit_cost": 1},
    ):
        key = (m.get("item_id"), m.get("outlet_id"))
        net[key] += float(m.get("qty", 0) or 0)
        uc = float(m.get("unit_cost", 0) or 0)
        if uc > 0:
            cost_acc[m.get("item_id")].append(uc)

    avg_cost = {iid: round(sum(arr) / len(arr)) for iid, arr in cost_acc.items() if arr}

    # Gunakan unit_cost dari items collection jika tersedia (dari seed_item_costs.py)
    for item_id, item_doc in items.items():
        ic = float(item_doc.get("unit_cost") or 0)
        if ic > 0 and item_id not in avg_cost:
            avg_cost[item_id] = ic

    opening_date = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y-%m-%d")
    docs = []
    seq = 0
    for (item_id, outlet_id), net_qty in net.items():
        if not item_id or not outlet_id:
            continue
        it = items.get(item_id) or {}
        par_levels = it.get("par_levels") or {}
        par = float(par_levels.get(outlet_id) or it.get("par_level") or 20)
        # Target well-stocked level (1.5–2.5× par), then opening = target − existing net.
        target = round(par * random.uniform(1.6, 2.4))
        opening_qty = target - net_qty
        if opening_qty <= 0:
            # Already at/above target → small top-up so there is still an opening record.
            opening_qty = round(par * random.uniform(0.3, 0.6))
        opening_qty = max(1, round(opening_qty))
        unit_cost = avg_cost.get(item_id, 15_000)
        seq += 1
        docs.append({
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "item_id": item_id,
            "movement_type": OPENING_TYPE,
            "movement_date": opening_date,
            "qty": float(opening_qty),
            "unit_cost": float(unit_cost),
            "total_value": float(opening_qty) * float(unit_cost),
            "ref_doc": OPENING_REF,
            "notes": "Saldo awal persediaan (demo opening stock)",
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": "system-seed",
        })

    if docs:
        await db.inventory_movements.insert_many(docs)
    total_val = sum(d["total_value"] for d in docs)
    print(f"  → {len(docs)} opening-stock movements inserted "
          f"(total value Rp {total_val:,.0f}).")

    # Quick post-check: how many item×outlet balances remain <= 0?
    bal = defaultdict(float)
    async for m in db.inventory_movements.find({"deleted_at": None}, {"item_id": 1, "outlet_id": 1, "qty": 1}):
        bal[(m.get("item_id"), m.get("outlet_id"))] += float(m.get("qty", 0) or 0)
    neg = sum(1 for v in bal.values() if v <= 0)
    print(f"  → balances <= 0 after opening: {neg} / {len(bal)} pairs.")
    print("Inventory opening seed complete.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
