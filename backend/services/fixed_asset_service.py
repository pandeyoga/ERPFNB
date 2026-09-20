"""Fixed Asset service — Sprint 2.

Handles:
- CRUD for fixed assets
- Depreciation calculation (straight-line, declining balance)
- Monthly depreciation posting (auto + manual)
- Disposal flow (with gain/loss JE)
- Revaluation flow (with JE)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from models.fixed_asset import make_asset_doc, make_dep_entry, make_asset_event, ASSET_CATEGORIES

logger = logging.getLogger("aurora.fixed_asset")


# ────────────────────────────────────────────────
# 1. AUTO-CODE GENERATION
# ────────────────────────────────────────────────

async def next_asset_code(category: str) -> str:
    db = get_db()
    prefix = category.upper()[:4]
    count = await db.fixed_assets.count_documents({"category": category})
    return f"{prefix}-{str(count + 1).zfill(4)}"


# ────────────────────────────────────────────────
# 2. CRUD
# ────────────────────────────────────────────────

async def create_asset(payload: dict, *, user_id: str) -> dict:
    db = get_db()
    category = payload.get("category", "OTHER")
    code = payload.get("asset_code") or await next_asset_code(category)

    # Resolve COA ids by code
    async def coa_id(code_str: str) -> Optional[str]:
        c = await db.chart_of_accounts.find_one({"code": code_str, "deleted_at": None})
        return c["id"] if c else None

    cat_info = next((c for c in ASSET_CATEGORIES if c["code"] == category), ASSET_CATEGORIES[-1])
    coa_asset   = payload.get("coa_asset_id") or await coa_id(cat_info.get("coa_code", "1501"))
    coa_accum   = payload.get("coa_accum_dep_id") or await coa_id("1601")
    coa_dep_exp = payload.get("coa_dep_exp_id")   or await coa_id("6101")

    doc = make_asset_doc(
        asset_code=code,
        name=payload["name"],
        category=category,
        purchase_date=payload["purchase_date"],
        purchase_cost=float(payload["purchase_cost"]),
        salvage_value=float(payload.get("salvage_value", 0) or 0),
        useful_life_years=int(payload.get("useful_life_years", 5) or 5),
        dep_method=payload.get("dep_method", "straight_line"),
        outlet_id=payload.get("outlet_id"),
        location=payload.get("location"),
        vendor_id=payload.get("vendor_id"),
        invoice_no=payload.get("invoice_no"),
        purchase_payment_id=payload.get("purchase_payment_id"),
        coa_asset_id=coa_asset,
        coa_accum_dep_id=coa_accum,
        coa_dep_exp_id=coa_dep_exp,
        notes=payload.get("notes"),
        created_by=user_id,
    )
    await db.fixed_assets.insert_one(doc)
    return serialize(doc)


async def list_assets(
    *,
    category: Optional[str] = None,
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list, dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if category:
        q["category"] = category
    if outlet_id:
        q["outlet_id"] = outlet_id
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.fixed_assets.find(q).sort([("asset_code", 1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.fixed_assets.count_documents(q)
    return [serialize(i) for i in items], {"page": page, "per_page": per_page, "total": total}


async def get_asset(asset_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.fixed_assets.find_one({"id": asset_id, "deleted_at": None})
    return serialize(doc) if doc else None


async def update_asset(asset_id: str, payload: dict, *, user_id: str) -> Optional[dict]:
    db = get_db()
    allowed = ["name", "location", "outlet_id", "notes", "vendor_id", "invoice_no"]
    upd = {k: v for k, v in payload.items() if k in allowed}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.fixed_assets.update_one({"id": asset_id}, {"$set": upd})
    return await get_asset(asset_id)


async def delete_asset(asset_id: str) -> bool:
    """Soft delete asset."""
    db = get_db()
    await db.fixed_assets.update_one(
        {"id": asset_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    return True


# ────────────────────────────────────────────────
# 3. DEPRECIATION CALCULATION
# ────────────────────────────────────────────────

def _months_elapsed_since_purchase(asset: dict) -> int:
    """How many months have already been depreciated (used by SYD per-period rate)."""
    try:
        last = asset.get("last_dep_period")
        start = (asset.get("purchase_date") or "")[:7]
        if not start:
            return 0
        sy, sm = int(start[:4]), int(start[5:7])
        if last:
            ly, lm = int(last[:4]), int(last[5:7])
            return max(0, (ly - sy) * 12 + (lm - sm) + 1)
        return 0
    except Exception:
        return 0


def _syd_dep_for_period(cost: float, salvage: float, life_years: int, period_idx: int) -> float:
    """Sum-of-years'-digits monthly depreciation for the given 0-based period index.

    Distributes annual SYD evenly across 12 months of that year.
    """
    if life_years <= 0:
        return 0.0
    year_idx = period_idx // 12  # 0-based year
    if year_idx >= life_years:
        return 0.0
    sum_digits = life_years * (life_years + 1) / 2
    factor = (life_years - year_idx) / sum_digits  # 1st year highest, last year lowest
    annual = (cost - salvage) * factor
    return round(annual / 12, 2)


def calc_monthly_dep(asset: dict) -> float:
    """Calculate monthly depreciation amount (not yet considering accumulated)."""
    cost = float(asset.get("current_cost", asset.get("purchase_cost", 0)))
    salvage = float(asset.get("salvage_value", 0))
    life = int(asset.get("useful_life_years", 1) or 1)
    method = asset.get("dep_method", "straight_line")
    book = float(asset.get("book_value", cost))
    accum = float(asset.get("accumulated_dep", 0))

    if life <= 0 or book <= salvage:
        return 0.0

    if method == "straight_line":
        annual = (cost - salvage) / life
        return round(annual / 12, 2)
    elif method == "sum_of_years_digits":
        period_idx = _months_elapsed_since_purchase(asset)
        dep = _syd_dep_for_period(cost, salvage, life, period_idx)
        # Cap so book doesn't go below salvage
        return round(min(dep, max(book - salvage, 0)), 2)
    else:  # declining_balance (double declining)
        rate = 2.0 / life  # double declining rate
        annual = book * rate
        # Cap so book doesn't go below salvage
        max_dep = book - salvage
        return round(min(annual / 12, max_dep / 12), 2)


def build_depreciation_schedule(asset: dict, months: int = 60) -> list[dict]:
    """Build full depreciation schedule for display."""
    cost = float(asset.get("current_cost", asset.get("purchase_cost", 0)))
    salvage = float(asset.get("salvage_value", 0))
    life = int(asset.get("useful_life_years", 1) or 1)
    method = asset.get("dep_method", "straight_line")
    start = asset.get("purchase_date", "")[:7]  # YYYY-MM
    total_months = min(life * 12, months)

    schedule = []
    book = cost
    accum = 0.0
    try:
        y, m = int(start[:4]), int(start[5:7])
    except Exception:
        return []

    for i in range(total_months):
        if book <= salvage:
            break
        if method == "straight_line":
            dep = round((cost - salvage) / (life * 12), 2)
        elif method == "sum_of_years_digits":
            dep = _syd_dep_for_period(cost, salvage, life, i)
        else:
            rate = 2.0 / life
            dep = round(book * rate / 12, 2)
        dep = min(dep, book - salvage)
        accum += dep
        book -= dep
        period = f"{y}-{str(m).zfill(2)}"
        schedule.append({"period": period, "dep_amount": dep, "accumulated_dep": round(accum, 2), "book_value": round(book, 2)})
        m += 1
        if m > 12:
            m = 1
            y += 1
    return schedule


async def post_depreciation(asset_id: str, period: str, *, user_id: str) -> Optional[dict]:
    """Post monthly depreciation JE for an asset."""
    db = get_db()
    asset = await db.fixed_assets.find_one({"id": asset_id, "deleted_at": None})
    if not asset or asset.get("status") not in ("active", "revalued"):
        return None

    # Skip if already posted for this period
    existing = await db.depreciation_entries.find_one({"asset_id": asset_id, "period": period})
    if existing:
        return serialize(existing)

    dep_amount = calc_monthly_dep(asset)
    if dep_amount <= 0:
        return None

    new_accum = round(float(asset.get("accumulated_dep", 0)) + dep_amount, 2)
    new_book  = round(float(asset.get("current_cost", asset.get("purchase_cost", 0))) - new_accum, 2)

    # Post JE
    je = None
    try:
        from services import journal_service
        je = await journal_service._post_journal(
            entry_date=period + "-01",
            description=f"Penyusutan {asset['name']} [{period}]",
            source_type="fixed_asset_dep",
            source_id=asset_id,
            lines=[
                {"coa_id": asset["coa_dep_exp_id"], "dr": dep_amount, "cr": 0.0, "memo": f"Dep {asset['asset_code']}"},
                {"coa_id": asset["coa_accum_dep_id"], "dr": 0.0, "cr": dep_amount, "memo": f"Accum dep {asset['asset_code']}"},
            ],
            user_id=user_id,
        )
    except Exception as e:
        logger.warning("dep JE failed: %s", e)

    entry = make_dep_entry(
        asset_id=asset_id,
        period=period,
        dep_amount=dep_amount,
        accumulated_dep=new_accum,
        book_value_after=new_book,
        je_id=je["id"] if je else None,
        created_by=user_id,
    )
    await db.depreciation_entries.insert_one(entry)

    # Update asset
    await db.fixed_assets.update_one(
        {"id": asset_id},
        {"$set": {
            "accumulated_dep": new_accum,
            "book_value": new_book,
            "last_dep_period": period,
            "status": "fully_depreciated" if new_book <= float(asset.get("salvage_value", 0)) else asset.get("status", "active"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return serialize(entry)


async def post_all_depreciation(period: str, *, user_id: str) -> dict:
    """Post depreciation for ALL active assets for given period."""
    db = get_db()
    assets = await db.fixed_assets.find({"status": {"$in": ["active", "revalued"]}, "deleted_at": None}).to_list(500)
    posted = 0
    skipped = 0
    for a in assets:
        if int(a.get("useful_life_years", 0) or 0) <= 0:
            skipped += 1
            continue
        result = await post_depreciation(a["id"], period, user_id=user_id)
        if result:
            posted += 1
        else:
            skipped += 1
    return {"period": period, "posted": posted, "skipped": skipped}


# ────────────────────────────────────────────────
# 4. DISPOSAL
# ────────────────────────────────────────────────

async def dispose_asset(asset_id: str, payload: dict, *, user_id: str) -> dict:
    """Dispose an asset. JE: Dr Accum Dep + Dr Cash(proceeds) + Dr/Cr Gain/Loss, Cr Asset."""
    db = get_db()
    asset = await db.fixed_assets.find_one({"id": asset_id, "deleted_at": None})
    if not asset:
        raise ValueError("Asset not found")
    if asset.get("status") == "disposed":
        raise ValueError("Asset already disposed")

    disposal_date  = payload.get("disposal_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    proceeds       = float(payload.get("disposal_proceeds", 0) or 0)
    cost           = float(asset.get("current_cost", asset.get("purchase_cost", 0)))
    accum_dep      = float(asset.get("accumulated_dep", 0))
    book_value     = float(asset.get("book_value", cost - accum_dep))
    gain_loss      = proceeds - book_value

    # Build JE lines
    lines = [
        {"coa_id": asset["coa_accum_dep_id"], "dr": accum_dep, "cr": 0.0, "memo": "Clear accum dep"},
        {"coa_id": asset["coa_asset_id"], "dr": 0.0, "cr": cost, "memo": "Remove asset"},
    ]
    if proceeds > 0:
        db2 = get_db()
        cash_coa = await db2.chart_of_accounts.find_one({"code": "1001", "deleted_at": None})
        if cash_coa:
            lines.append({"coa_id": cash_coa["id"], "dr": proceeds, "cr": 0.0, "memo": "Disposal proceeds"})
    if abs(gain_loss) > 0.01:
        # Gain: Cr 8001 (Other Income); Loss: Dr 7001 (Other Expense)
        gain_loss_coa = await db.chart_of_accounts.find_one({"code": "8001" if gain_loss > 0 else "7001", "deleted_at": None})
        if gain_loss_coa:
            if gain_loss > 0:
                lines.append({"coa_id": gain_loss_coa["id"], "dr": 0.0, "cr": round(gain_loss, 2), "memo": "Gain on disposal"})
            else:
                lines.append({"coa_id": gain_loss_coa["id"], "dr": round(abs(gain_loss), 2), "cr": 0.0, "memo": "Loss on disposal"})

    je = None
    try:
        from services import journal_service
        je = await journal_service._post_journal(
            entry_date=disposal_date,
            description=f"Disposal aset {asset['name']} [{asset['asset_code']}]",
            source_type="fixed_asset_disposal",
            source_id=asset_id,
            lines=lines,
            user_id=user_id,
        )
    except Exception as e:
        logger.warning("disposal JE failed: %s", e)

    event = make_asset_event(
        asset_id=asset_id,
        event_type="disposal",
        event_date=disposal_date,
        description=payload.get("notes") or "Asset disposal",
        amount_before=book_value,
        amount_after=0.0,
        gain_loss=gain_loss,
        je_id=je["id"] if je else None,
        metadata={"proceeds": proceeds},
        created_by=user_id,
    )
    await db.asset_events.insert_one(event)
    await db.fixed_assets.update_one(
        {"id": asset_id},
        {"$set": {"status": "disposed", "book_value": 0.0, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {**serialize(asset), "disposal": serialize(event), "gain_loss": gain_loss, "je_id": je["id"] if je else None}


# ────────────────────────────────────────────────
# 5. REVALUATION
# ────────────────────────────────────────────────

async def revalue_asset(asset_id: str, payload: dict, *, user_id: str) -> dict:
    """Revalue an asset. JE adjusts the asset cost and accumulated dep."""
    db = get_db()
    asset = await db.fixed_assets.find_one({"id": asset_id, "deleted_at": None})
    if not asset:
        raise ValueError("Asset not found")

    new_fair_value = float(payload["new_fair_value"])
    revaluation_date = payload.get("revaluation_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    old_book_value  = float(asset.get("book_value", 0))
    adjustment = new_fair_value - old_book_value

    je = None
    try:
        from services import journal_service
        revaluation_reserve_coa = await db.chart_of_accounts.find_one({"code": "3300", "deleted_at": None})
        if not revaluation_reserve_coa:
            revaluation_reserve_coa = await db.chart_of_accounts.find_one({"code": "3200", "deleted_at": None})
        lines = []
        if adjustment > 0:
            lines = [
                {"coa_id": asset["coa_asset_id"], "dr": adjustment, "cr": 0.0, "memo": "Asset revaluation increase"},
                {"coa_id": (revaluation_reserve_coa or {}).get("id"), "dr": 0.0, "cr": adjustment, "memo": "Revaluation surplus"},
            ]
        else:
            lines = [
                {"coa_id": (revaluation_reserve_coa or {}).get("id"), "dr": abs(adjustment), "cr": 0.0, "memo": "Revaluation decrease"},
                {"coa_id": asset["coa_asset_id"], "dr": 0.0, "cr": abs(adjustment), "memo": "Asset revaluation decrease"},
            ]
        if lines and all(l.get("coa_id") for l in lines):
            je = await journal_service._post_journal(
                entry_date=revaluation_date,
                description=f"Revaluasi {asset['name']} [{asset['asset_code']}]",
                source_type="fixed_asset_revaluation",
                source_id=asset_id,
                lines=lines,
                user_id=user_id,
            )
    except Exception as e:
        logger.warning("revalue JE failed: %s", e)

    event = make_asset_event(
        asset_id=asset_id,
        event_type="revaluation",
        event_date=revaluation_date,
        description=payload.get("notes") or "Asset revaluation",
        amount_before=old_book_value,
        amount_after=new_fair_value,
        gain_loss=adjustment,
        je_id=je["id"] if je else None,
        metadata={"new_fair_value": new_fair_value},
        created_by=user_id,
    )
    await db.asset_events.insert_one(event)
    await db.fixed_assets.update_one(
        {"id": asset_id},
        {"$set": {
            "current_cost": new_fair_value,
            "book_value": new_fair_value,
            "accumulated_dep": 0.0,
            "status": "revalued",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {**serialize(asset), "adjustment": adjustment, "je_id": je["id"] if je else None}


async def get_asset_register(outlet_id: Optional[str] = None) -> dict:
    """Asset register report grouped by category (alias for asset_register_summary with outlet filter)."""
    db = get_db()
    match = {"deleted_at": None}
    if outlet_id:
        match["outlet_id"] = outlet_id
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1},
            "total_cost": {"$sum": "$purchase_cost"},
            "total_book_value": {"$sum": "$book_value"},
            "total_accum_dep": {"$sum": "$accumulated_dep"},
        }}
    ]
    rows = []
    async for r in db.fixed_assets.aggregate(pipeline):
        rows.append({
            "category": r["_id"],
            "count": r["count"],
            "total_cost": round(r["total_cost"], 2),
            "total_book_value": round(r["total_book_value"], 2),
            "total_accum_dep": round(r["total_accum_dep"], 2),
        })
    return {"by_category": sorted(rows, key=lambda x: x["category"])}


async def asset_register_summary() -> dict:
    """Summary of all assets grouped by category."""
    return await get_asset_register()
