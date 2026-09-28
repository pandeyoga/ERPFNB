"""CRUD operations for outlet budgets: set/bulk_set/get/list/delete."""
import uuid
from typing import Optional

from services._outlet_budget._common import (
    _now, audit_log, get_db, serialize, NotFoundError, ValidationError,
)
from services._outlet_budget.actuals import compute_actuals, compute_pace


async def set_budget(payload: dict, *, user: dict) -> dict:
    """Create or update a single outlet+period budget.

    Idempotent on (outlet_id, period_type, period_key) — if exists, update in place.
    Supports two modes:
      - per_bucket: stores kdo_budget, fdo_budget, bdo_budget separately
      - combined:   stores a single combined_budget that covers all 3 sources
    """
    db = get_db()
    outlet_id = payload["outlet_id"]
    period_type = payload["period_type"]
    period_key = payload["period_key"]
    budget_mode = (payload.get("budget_mode") or "per_bucket").lower()
    if budget_mode not in ("per_bucket", "combined"):
        raise ValidationError("budget_mode harus 'per_bucket' atau 'combined'")

    # Resolve brand_id from outlet master if not provided
    brand_id = payload.get("brand_id")
    if not brand_id:
        ol = await db.outlets.find_one({"id": outlet_id, "deleted_at": None})
        if ol:
            brand_id = ol.get("brand_id")

    kdo = float(payload.get("kdo_budget", 0) or 0)
    fdo = float(payload.get("fdo_budget", 0) or 0)
    bdo = float(payload.get("bdo_budget", 0) or 0)
    combined = float(payload.get("combined_budget", 0) or 0)

    # Normalize totals based on mode:
    # - In combined mode, the per-bucket values are reset to 0 (single pool only).
    # - In per_bucket mode, combined_budget is reset to 0.
    if budget_mode == "combined":
        kdo = fdo = bdo = 0.0
        total = combined
    else:
        combined = 0.0
        total = kdo + fdo + bdo

    existing = await db.outlet_budgets.find_one({
        "outlet_id": outlet_id,
        "period_type": period_type,
        "period_key": period_key,
        "deleted_at": None,
    })
    if existing:
        await db.outlet_budgets.update_one(
            {"id": existing["id"]},
            {"$set": {
                "budget_mode": budget_mode,
                "kdo_budget": kdo,
                "fdo_budget": fdo,
                "bdo_budget": bdo,
                "combined_budget": combined,
                "total_budget": total,
                "alert_threshold_pct": float(payload.get("alert_threshold_pct", 80.0)),
                "notes": payload.get("notes"),
                "brand_id": brand_id,
                "period_start": payload["period_start"],
                "period_end": payload["period_end"],
                "updated_at": _now(),
                "set_by": user["id"],
            }},
        )
        doc = await db.outlet_budgets.find_one({"id": existing["id"]})
        await audit_log(user_id=user["id"], entity_type="outlet_budget",
                        entity_id=existing["id"], action="update")
        return serialize(doc)

    doc = {
        "id": str(uuid.uuid4()),
        "outlet_id": outlet_id,
        "brand_id": brand_id,
        "period_type": period_type,
        "period_key": period_key,
        "period_start": payload["period_start"],
        "period_end": payload["period_end"],
        "budget_mode": budget_mode,
        "kdo_budget": kdo,
        "fdo_budget": fdo,
        "bdo_budget": bdo,
        "combined_budget": combined,
        "total_budget": total,
        "alert_threshold_pct": float(payload.get("alert_threshold_pct", 80.0)),
        "notes": payload.get("notes"),
        "set_by": user["id"],
        "status": "active",
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
    }
    await db.outlet_budgets.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="outlet_budget",
                    entity_id=doc["id"], action="create")
    return serialize(doc)


async def bulk_set(payload: dict, *, user: dict) -> dict:
    """Set budget for many outlets at once.

    Each item can override `budget_mode`; otherwise the top-level mode applies.
    """
    items = payload.get("items", [])
    if not items:
        raise ValidationError("items kosong")
    top_mode = payload.get("budget_mode", "per_bucket")
    results = []
    for it in items:
        item_mode = it.get("budget_mode") or top_mode
        results.append(await set_budget({
            **it,
            "budget_mode": item_mode,
            "period_type": payload["period_type"],
            "period_key": payload["period_key"],
            "period_start": payload["period_start"],
            "period_end": payload["period_end"],
            "alert_threshold_pct": payload.get("alert_threshold_pct", 80.0),
        }, user=user))
    return {"count": len(results), "items": results}


async def get_budget(budget_id: str) -> dict:
    db = get_db()
    doc = await db.outlet_budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("OutletBudget")
    return serialize(doc)


async def list_budgets(
    *,
    period_type: Optional[str] = None,
    period_key: Optional[str] = None,
    outlet_ids: Optional[list[str]] = None,
    brand_id: Optional[str] = None,
    include_actuals: bool = True,
) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None, "status": "active"}
    if period_type:
        q["period_type"] = period_type
    if period_key:
        q["period_key"] = period_key
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    if brand_id:
        q["brand_id"] = brand_id
    docs = await db.outlet_budgets.find(q).sort([("outlet_id", 1)]).to_list(500)
    out = []
    for d in docs:
        sd = serialize(d)
        if include_actuals:
            actuals = await compute_actuals(d["outlet_id"], d["period_start"], d["period_end"])
            sd["actuals"] = actuals
            sd["pace"] = compute_pace(sd, actuals)
        out.append(sd)
    return out


async def delete_budget(budget_id: str, *, user: dict) -> dict:
    db = get_db()
    doc = await db.outlet_budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("OutletBudget")
    await db.outlet_budgets.update_one(
        {"id": budget_id}, {"$set": {"deleted_at": _now(), "status": "archived"}},
    )
    await audit_log(user_id=user["id"], entity_type="outlet_budget",
                    entity_id=budget_id, action="delete")
    return {"id": budget_id, "deleted": True}
