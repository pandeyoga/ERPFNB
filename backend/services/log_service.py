"""Read-only log query service for the Operations UI (Phase 10)."""
from typing import Optional

from core.db import get_db, serialize


async def list_recent(
    *,
    limit: int = 100,
    level: Optional[str] = None,
    request_id: Optional[str] = None,
    route_contains: Optional[str] = None,
    user_id: Optional[str] = None,
    since_iso: Optional[str] = None,
    page: Optional[int] = None,
    per_page: Optional[int] = None,
) -> list[dict] | dict:
    """List recent log entries.
    
    Backwards-compatible: if `page` is None, returns plain list (legacy).
    If `page` is set, returns {items, total, page, per_page, total_pages}.
    """
    db = get_db()
    q: dict = {}
    if level:
        q["level"] = level.upper()
    if request_id:
        q["request_id"] = request_id
    if route_contains:
        q["route"] = {"$regex": route_contains, "$options": "i"}
    if user_id:
        q["user_id"] = user_id
    if since_iso:
        q["ts"] = {"$gte": since_iso}
    
    if page is None:
        cur = db.log_entries.find(q).sort("ts", -1).limit(min(500, max(1, limit)))
        return [serialize(d) async for d in cur]
    
    page = max(1, page)
    per_page = min(500, max(1, per_page or 50))
    skip = (page - 1) * per_page
    
    total = await db.log_entries.count_documents(q)
    cur = db.log_entries.find(q).sort("ts", -1).skip(skip).limit(per_page)
    items = [serialize(d) async for d in cur]
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


async def stats() -> dict:
    db = get_db()
    total = await db.log_entries.estimated_document_count()
    # Per-level counts (last 1k for cheapness)
    pipe = [
        {"$sort": {"ts": -1}},
        {"$limit": 1000},
        {"$group": {"_id": "$level", "n": {"$sum": 1}}},
    ]
    by_level = {}
    async for r in db.log_entries.aggregate(pipe):
        by_level[r["_id"] or "-"] = r["n"]
    return {"total": total, "recent_by_level": by_level}
