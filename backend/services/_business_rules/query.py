"""Read/list/timeline/resolve queries for business rules."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import NotFoundError

from services._business_rules.overlaps import _ranges_overlap


async def list_rules(
    *,
    rule_type: Optional[str] = None,
    scope_type: Optional[str] = None,
    scope_id: Optional[str] = None,
    active: Optional[bool] = None,
    effective_on: Optional[str] = None,
) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if rule_type:
        q["rule_type"] = rule_type
    if scope_type:
        q["scope_type"] = scope_type
    if scope_id:
        q["scope_id"] = scope_id
    if active is not None:
        q["active"] = bool(active)
    items = await db.business_rules.find(q).sort(
        [("scope_type", 1), ("scope_id", 1), ("rule_type", 1), ("version", -1)]
    ).to_list(500)
    out = [serialize(d) for d in items]
    if effective_on:
        out = [
            r
            for r in out
            if (not r.get("effective_from") or r["effective_from"] <= effective_on)
            and (not r.get("effective_to") or r["effective_to"] >= effective_on)
        ]
    return out


async def get_rule(rule_id: str) -> dict:
    db = get_db()
    doc = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Rule")
    return serialize(doc)


async def get_active_rule(
    *,
    rule_type: str,
    scope_type: str,
    scope_id: str,
    on_date: Optional[str] = None,
) -> Optional[dict]:
    """Return the currently effective rule for a (scope, rule_type), or None.
    Used by services that consume rules at runtime (e.g., service charge calc).
    """
    db = get_db()
    on_date = on_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    q: dict = {
        "deleted_at": None,
        "active": True,
        "rule_type": rule_type,
        "scope_type": scope_type,
        "scope_id": scope_id,
    }
    docs = await db.business_rules.find(q).sort([("version", -1)]).to_list(50)
    for d in docs:
        if (not d.get("effective_from") or d["effective_from"] <= on_date) and (
            not d.get("effective_to") or d["effective_to"] >= on_date
        ):
            return serialize(d)
    return None


async def resolve_rule(
    *,
    rule_type: str,
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    on_date: Optional[str] = None,
) -> Optional[dict]:
    """Walk scope hierarchy outlet → brand → group and return the active rule."""
    if outlet_id:
        r = await get_active_rule(
            rule_type=rule_type, scope_type="outlet", scope_id=outlet_id, on_date=on_date
        )
        if r:
            return r
    if brand_id:
        r = await get_active_rule(
            rule_type=rule_type, scope_type="brand", scope_id=brand_id, on_date=on_date
        )
        if r:
            return r
    # Group fallback (scope_id="*" by convention)
    r = await get_active_rule(
        rule_type=rule_type, scope_type="group", scope_id="*", on_date=on_date
    )
    return r


async def get_timeline(
    *,
    rule_type: Optional[str] = None,
    scope_type: Optional[str] = None,
    scope_id: Optional[str] = None,
) -> list[dict]:
    """Return all versions of rules grouped by (scope, rule_type) for timeline UI.
    Each entry is enriched with `overlaps_with: [rule_id, ...]` when active ranges collide.
    """
    rows = await list_rules(
        rule_type=rule_type, scope_type=scope_type, scope_id=scope_id
    )
    # Compute overlaps among active rows of same (scope_type, scope_id, rule_type)
    by_key: dict[tuple, list[dict]] = {}
    for r in rows:
        if not r.get("active"):
            continue
        key = (r["rule_type"], r.get("scope_type"), r.get("scope_id"))
        by_key.setdefault(key, []).append(r)

    overlaps_map: dict[str, list[str]] = {}
    for arr in by_key.values():
        for i, a in enumerate(arr):
            for j in range(i + 1, len(arr)):
                b = arr[j]
                if _ranges_overlap(
                    a.get("effective_from"),
                    a.get("effective_to"),
                    b.get("effective_from"),
                    b.get("effective_to"),
                ):
                    overlaps_map.setdefault(a["id"], []).append(b["id"])
                    overlaps_map.setdefault(b["id"], []).append(a["id"])
    for r in rows:
        r["overlaps_with"] = overlaps_map.get(r["id"], [])
    return rows
