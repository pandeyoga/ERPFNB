"""Budget CRUD operations."""
from __future__ import annotations

import asyncio as _aio
from typing import Optional

from core.db import get_db, serialize
from models.budget import make_budget_doc

from services._budget._common import _enrich_lines, _check_editable, _now


async def create_budget(payload: dict, *, user_id: str) -> dict:
    db = get_db()
    lines = await _enrich_lines(payload.get("lines", []))
    scope = payload.get("scope", "outlet")
    # Auto-detect scope from provided IDs
    if not payload.get("outlet_id") and not payload.get("brand_id"):
        scope = "group"
    elif not payload.get("outlet_id") and payload.get("brand_id"):
        scope = "brand"
    doc = make_budget_doc(
        name=payload.get("name") or f"Budget {payload.get('period')} - {scope.capitalize()}",
        period=payload["period"],
        period_type=payload.get("period_type", "monthly"),
        scope=scope,
        outlet_id=payload.get("outlet_id"),
        brand_id=payload.get("brand_id"),
        lines=lines,
        notes=payload.get("notes"),
        created_by=user_id,
    )
    await db.budgets.insert_one(doc)
    return serialize(doc)


async def list_budgets(
    period: Optional[str] = None,
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    scope: Optional[str] = None,
    approval_status: Optional[str] = None,
    period_type: Optional[str] = None,
    year: Optional[str] = None,
) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None, "status": "active"}
    if period:
        q["period"] = period
    if outlet_id:
        q["outlet_id"] = outlet_id
    if brand_id:
        q["brand_id"] = brand_id
    if scope:
        q["scope"] = scope
    if approval_status:
        q["approval_status"] = approval_status
    if period_type:
        q["period_type"] = period_type
    if year:
        # Filter by year prefix (works for YYYY, YYYY-MM, YYYY-QN)
        q["period"] = {"$regex": f"^{year}"}
    items = await db.budgets.find(q).sort([("period", -1), ("scope", 1)]).to_list(200)
    # B3 fix: batch lookup outlets+brands (was N+1 find_one per item)
    out_ids = list({i["outlet_id"] for i in items if i.get("outlet_id")})
    brd_ids = list({i["brand_id"] for i in items if i.get("brand_id")})
    outlets_list, brands_list = await _aio.gather(
        db.outlets.find({"id": {"$in": out_ids}}, {"id": 1, "name": 1, "_id": 0}).to_list(len(out_ids) + 1),
        db.brands.find({"id": {"$in": brd_ids}}, {"id": 1, "name": 1, "_id": 0}).to_list(len(brd_ids) + 1),
    ) if (out_ids or brd_ids) else ([], [])
    outlet_map = {o["id"]: o["name"] for o in outlets_list}
    brand_map = {b["id"]: b["name"] for b in brands_list}
    result = []
    for item in items:
        s = serialize(item)
        s["outlet_name"] = outlet_map.get(item.get("outlet_id"))
        s["brand_name"] = brand_map.get(item.get("brand_id"))
        result.append(s)
    return result


async def get_budget(budget_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        return None
    result = serialize(doc)
    if doc.get("outlet_id"):
        o = await db.outlets.find_one({"id": doc["outlet_id"]})
        result["outlet_name"] = o.get("name") if o else None
    if doc.get("brand_id"):
        b = await db.brands.find_one({"id": doc["brand_id"]})
        result["brand_name"] = b.get("name") if b else None
    return result


async def update_budget(budget_id: str, payload: dict, *, user_id: str) -> Optional[dict]:
    db = get_db()
    try:
        await _check_editable(budget_id)
    except PermissionError as e:
        raise ValueError(str(e))

    updates: dict = {"updated_at": _now(), "updated_by": user_id}
    if "name" in payload:
        updates["name"] = payload["name"]
    if "notes" in payload:
        updates["notes"] = payload["notes"]
    if "lines" in payload:
        updates["lines"] = await _enrich_lines(payload["lines"])
    if updates:
        await db.budgets.update_one({"id": budget_id}, {"$set": updates})
    return await get_budget(budget_id)


async def delete_budget(budget_id: str, *, user_id: str) -> bool:
    db = get_db()
    await db.budgets.update_one(
        {"id": budget_id},
        {"$set": {"status": "archived", "deleted_at": _now(), "updated_by": user_id}}
    )
    return True
