"""Effective-range overlap detection for business rules."""
from __future__ import annotations

from typing import Optional

from core.db import get_db, serialize


def _ranges_overlap(
    a_from: Optional[str],
    a_to: Optional[str],
    b_from: Optional[str],
    b_to: Optional[str],
) -> bool:
    """Treat None on a_from as -inf, None on a_to as +inf (same for b)."""
    a1 = a_from or "0000-01-01"
    a2 = a_to or "9999-12-31"
    b1 = b_from or "0000-01-01"
    b2 = b_to or "9999-12-31"
    return a1 <= b2 and b1 <= a2


async def detect_overlaps(
    *,
    rule_type: str,
    scope_type: str,
    scope_id: str,
    effective_from: Optional[str],
    effective_to: Optional[str],
    exclude_id: Optional[str] = None,
) -> list[dict]:
    """Return list of existing rules that overlap with the given range."""
    db = get_db()
    q: dict = {
        "deleted_at": None,
        "active": True,
        "rule_type": rule_type,
        "scope_type": scope_type,
        "scope_id": scope_id,
    }
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    docs = await db.business_rules.find(q).to_list(200)
    return [
        serialize(d)
        for d in docs
        if _ranges_overlap(effective_from, effective_to, d.get("effective_from"), d.get("effective_to"))
    ]
