"""Idempotent migration: normalize fixed_assets to the canonical schema the
fixed_asset_service + FixedAssetList/Register frontend expect.

ROOT CAUSE (RC-2 field drift): assets were seeded with `acquisition_value`,
`acquisition_date`, `asset_number`, `depreciation_method`, `accumulated_depreciation`
but the service (calc/register) + FE read `purchase_cost`, `current_cost`,
`purchase_date`, `asset_code`, `dep_method`, `accumulated_dep`, `salvage_value`.
Effect: FixedAssetList "Total Cost" + asset register total_cost/total_accum_dep
showed Rp 0 (sums a non-existent field).

This migration mirrors the source fields into the canonical names (idempotent
$set; safe to re-run). It does NOT post any GL journal (live depreciation JE
posting is intentionally deferred — needs accumulated-dep + depreciation-expense
COA accounts which this chart lacks; that is an owner-level GL decision).
"""
import asyncio
import os

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:
    pass

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.db import init_db, close_db, get_db


def _f(v, default=0.0):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return default


async def normalize_fixed_assets() -> dict:
    db = get_db()
    assets = await db.fixed_assets.find({"deleted_at": None}).to_list(2000)
    updated = 0
    for a in assets:
        acq_val = _f(a.get("acquisition_value", a.get("purchase_cost", 0)))
        accum = _f(a.get("accumulated_depreciation", a.get("accumulated_dep", 0)))
        book = a.get("book_value")
        book = _f(book) if book is not None else round(acq_val - accum, 2)
        upd = {
            "asset_code": a.get("asset_code") or a.get("asset_number"),
            "purchase_cost": acq_val,
            "current_cost": _f(a.get("current_cost", acq_val)) or acq_val,
            "purchase_date": a.get("purchase_date") or a.get("acquisition_date"),
            "dep_method": a.get("dep_method") or a.get("depreciation_method") or "straight_line",
            "accumulated_dep": accum,
            "book_value": book,
            "salvage_value": _f(a.get("salvage_value", 0)),
        }
        # Only write if something actually differs (keeps it idempotent / no churn)
        if any(a.get(k) != v for k, v in upd.items()):
            await db.fixed_assets.update_one({"id": a["id"]}, {"$set": upd})
            updated += 1
    return {"total": len(assets), "normalized": updated}


async def main():
    await init_db()
    try:
        res = await normalize_fixed_assets()
        print(f"  ✓ Fixed assets normalized: {res['normalized']}/{res['total']} "
              f"(canonical fields: purchase_cost, current_cost, accumulated_dep, asset_code, dep_method)")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
