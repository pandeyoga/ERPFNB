"""Phase 9D demo seed — creates a few sample PRs so vendor-recommend PR-mode is testable.

Idempotent: clears prior `seed_9d` PRs before re-inserting.

Run: cd /app/backend && python -m seed.seed_phase9d_demo
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from core.db import init_db, get_db, close_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed():
    print("=" * 60)
    print("Phase 9D demo seed — sample PRs")
    print("=" * 60)
    await init_db()
    db = get_db()

    # Find or create reasonable PR data
    items = await db.items.find({"deleted_at": None, "active": True}).limit(20).to_list(20)
    outlets = await db.outlets.find({"deleted_at": None, "active": True}).to_list(20)
    brands = await db.brands.find({"deleted_at": None, "active": True}).to_list(20)
    users = await db.users.find({"deleted_at": None}, {"id": 1, "email": 1}).to_list(20)
    procurement_user = next(
        (u for u in users if u.get("email") == "procurement@fnbgroup.id"), None,
    ) or users[0]

    if not items or not outlets:
        print("❌ Items / outlets not seeded — run seed_demo first.")
        await close_db()
        return

    # Clear prior 9D PRs
    deleted = await db.purchase_requests.delete_many({"source": "seed_9d"})
    print(f"  Cleared {deleted.deleted_count} prior 9D PRs")

    # Find next PR doc no
    last_pr = await db.purchase_requests.find_one(sort=[("doc_no", -1)])
    base_n = 1
    if last_pr:
        try:
            base_n = int(str(last_pr.get("doc_no", "")).split("-")[-1]) + 1
        except Exception:  # noqa: BLE001
            pass

    today = datetime.now(timezone.utc).date()
    sample_prs: list[dict] = []
    SAMPLES = [
        {"items": ["Beras Premium", "Telur Ayam Negeri", "Minyak Goreng Premium"]},
        {"items": ["Ayam Fillet Dada", "Daging Sapi Has Dalam", "Cumi Beku"]},
        {"items": ["Cabe Merah Keriting", "Bawang Merah", "Bawang Putih"]},
        {"items": ["Susu UHT 1L", "Gula Pasir", "Tepung Terigu"]},
        {"items": ["Kopi Espresso Bean", "Teh Hitam Premium", "Susu UHT 1L"]},
    ]

    item_by_name = {it.get("name"): it for it in items}

    for i, sample in enumerate(SAMPLES):
        outlet = outlets[i % len(outlets)]
        brand = brands[i % max(len(brands), 1)] if brands else None
        request_date = (today - timedelta(days=random.randint(1, 14))).isoformat()
        needed_by = (today + timedelta(days=random.randint(2, 7))).isoformat()
        status = random.choice(["draft", "approved", "consolidated", "submitted"])

        lines = []
        for nm in sample["items"]:
            it = item_by_name.get(nm)
            if not it:
                continue
            qty = random.choice([5, 10, 15, 20, 25, 50])
            est = float(random.choice([15000, 25000, 35000, 50000, 75000]))
            lines.append({
                "item_id": it["id"],
                "item_name": it.get("name"),
                "qty": qty,
                "unit": it.get("unit_default") or "pcs",
                "est_cost": est,
                "subtotal": qty * est,
                "notes": "",
            })
        if not lines:
            continue

        pr_id = str(uuid.uuid4())
        sample_prs.append({
            "id": pr_id,
            "doc_no": f"PR-DEMO-9D-{base_n + i:03d}",
            "outlet_id": outlet["id"],
            "brand_id": (brand or {}).get("id"),
            "request_date": request_date,
            "needed_by": needed_by,
            "source": "seed_9d",  # marker
            "status": status,
            "lines": lines,
            "total": sum(ln.get("subtotal", 0) for ln in lines),
            "notes": f"Demo PR untuk Phase 9D vendor recommendation (#{i + 1})",
            "requested_by": procurement_user["id"],
            "created_at": _now(),
            "updated_at": _now(),
            "deleted_at": None,
        })

    if sample_prs:
        await db.purchase_requests.insert_many(sample_prs)

    print(f"  Created {len(sample_prs)} demo PRs")
    print()
    total = await db.purchase_requests.count_documents({"deleted_at": None})
    print(f"  Total PRs in DB: {total}")
    print("=" * 60)
    print("Phase 9D PR seed complete.")
    print("=" * 60)
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
