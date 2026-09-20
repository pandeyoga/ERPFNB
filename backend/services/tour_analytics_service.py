"""Tour Analytics Service.

Tracks tour interactions (start/step/complete/skip/close) for analytics.
Events are stored in `tour_analytics_events` collection.
Provides aggregated summary via MongoDB aggregation pipeline.
"""
from datetime import datetime, timezone, timedelta
import uuid

from core.db import get_db, serialize


VALID_EVENT_TYPES = {
    "tour_started",
    "tour_step_viewed",
    "tour_completed",
    "tour_skipped",
    "tour_closed",
    "tour_suggested_shown",
    "tour_suggested_accepted",
    "tour_suggested_dismissed",
}


async def record_events(*, user_id: str, events: list[dict]) -> int:
    """Bulk insert tour analytics events.

    Args:
        user_id: ID of the user emitting events
        events: List of event dicts with keys:
            - type: event type (must be in VALID_EVENT_TYPES)
            - tour_id: tour identifier
            - tour_version: numeric version of tour at event time
            - step_index: optional step index (for step_viewed/skipped/closed)
            - total_steps: optional total steps in tour
            - duration_ms: optional duration since tour_started
            - path: optional pathname where event happened
            - meta: optional extra context dict

    Returns:
        Number of events inserted.
    """
    if not events:
        return 0

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for ev in events:
        et = ev.get("type")
        if et not in VALID_EVENT_TYPES:
            continue  # Skip invalid types silently
        tour_id = ev.get("tour_id") or ""
        if not tour_id:
            continue

        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": et,
            "tour_id": tour_id,
            "tour_version": int(ev.get("tour_version") or 1),
            "step_index": ev.get("step_index"),
            "total_steps": ev.get("total_steps"),
            "duration_ms": ev.get("duration_ms"),
            "path": ev.get("path"),
            "meta": ev.get("meta") or {},
            "client_ts": ev.get("client_ts"),  # client-emitted timestamp
            "created_at": now,
        }
        docs.append(doc)

    if docs:
        await db.tour_analytics_events.insert_many(docs)

    return len(docs)


async def summary(*, days: int = 30) -> dict:
    """Aggregated summary of tour analytics across all tours.

    Computes per-tour stats:
        - starts: # tour_started events
        - completes: # tour_completed events
        - skips: # tour_skipped events
        - closes: # tour_closed events
        - completion_rate: completes / starts (0 if no starts)
        - skip_rate: skips / starts
        - unique_users: # distinct users who started
        - avg_duration_ms: avg duration for completed tours
    """
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff.isoformat()}}},
        {
            "$group": {
                "_id": {"tour_id": "$tour_id", "type": "$type"},
                "count": {"$sum": 1},
                "users": {"$addToSet": "$user_id"},
                "avg_duration": {"$avg": "$duration_ms"},
            }
        },
    ]

    raw = await db.tour_analytics_events.aggregate(pipeline).to_list(5000)

    # Reorganize by tour_id
    per_tour: dict[str, dict] = {}
    for row in raw:
        tid = row["_id"]["tour_id"]
        ev_type = row["_id"]["type"]
        if tid not in per_tour:
            per_tour[tid] = {
                "tour_id": tid,
                "starts": 0,
                "completes": 0,
                "skips": 0,
                "closes": 0,
                "step_views": 0,
                "suggested_shown": 0,
                "suggested_accepted": 0,
                "suggested_dismissed": 0,
                "unique_users": set(),
                "avg_duration_ms": None,
            }
        item = per_tour[tid]
        c = row["count"]
        if ev_type == "tour_started":
            item["starts"] = c
            item["unique_users"].update(row.get("users", []))
        elif ev_type == "tour_completed":
            item["completes"] = c
            if row.get("avg_duration"):
                item["avg_duration_ms"] = round(row["avg_duration"])
        elif ev_type == "tour_skipped":
            item["skips"] = c
        elif ev_type == "tour_closed":
            item["closes"] = c
        elif ev_type == "tour_step_viewed":
            item["step_views"] = c
        elif ev_type == "tour_suggested_shown":
            item["suggested_shown"] = c
        elif ev_type == "tour_suggested_accepted":
            item["suggested_accepted"] = c
        elif ev_type == "tour_suggested_dismissed":
            item["suggested_dismissed"] = c

    # Finalize
    items: list[dict] = []
    for tid, item in per_tour.items():
        starts = item["starts"]
        completes = item["completes"]
        skips = item["skips"]
        item["unique_users"] = len(item["unique_users"])
        item["completion_rate"] = round(completes / starts, 3) if starts > 0 else 0.0
        item["skip_rate"] = round(skips / starts, 3) if starts > 0 else 0.0
        items.append(item)

    items.sort(key=lambda x: x["starts"], reverse=True)

    # Global summary
    total_starts = sum(x["starts"] for x in items)
    total_completes = sum(x["completes"] for x in items)
    total_skips = sum(x["skips"] for x in items)
    total_users = len({u for r in raw for u in r.get("users", [])})

    return {
        "period_days": days,
        "tours": items,
        "totals": {
            "total_starts": total_starts,
            "total_completes": total_completes,
            "total_skips": total_skips,
            "completion_rate": round(total_completes / total_starts, 3) if total_starts > 0 else 0.0,
            "skip_rate": round(total_skips / total_starts, 3) if total_starts > 0 else 0.0,
            "unique_users": total_users,
        },
    }


async def detail(*, tour_id: str, days: int = 30) -> dict:
    """Detailed analytics for a single tour, including per-step drop-off."""
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    base_match = {
        "tour_id": tour_id,
        "created_at": {"$gte": cutoff.isoformat()},
    }

    # Per-step viewing
    pipeline_steps = [
        {"$match": {**base_match, "type": "tour_step_viewed"}},
        {"$group": {"_id": "$step_index", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    step_rows = await db.tour_analytics_events.aggregate(pipeline_steps).to_list(5000)

    # Skip drop-off by step
    pipeline_skip = [
        {"$match": {**base_match, "type": "tour_skipped"}},
        {"$group": {"_id": "$step_index", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    skip_rows = await db.tour_analytics_events.aggregate(pipeline_skip).to_list(5000)

    # Aggregates
    starts = await db.tour_analytics_events.count_documents({**base_match, "type": "tour_started"})
    completes = await db.tour_analytics_events.count_documents({**base_match, "type": "tour_completed"})
    skips = await db.tour_analytics_events.count_documents({**base_match, "type": "tour_skipped"})
    closes = await db.tour_analytics_events.count_documents({**base_match, "type": "tour_closed"})

    # Recent events sample
    recent = await db.tour_analytics_events.find(base_match).sort("created_at", -1).limit(20).to_list(20)
    recent = [serialize(r) for r in recent]

    return {
        "tour_id": tour_id,
        "period_days": days,
        "starts": starts,
        "completes": completes,
        "skips": skips,
        "closes": closes,
        "completion_rate": round(completes / starts, 3) if starts > 0 else 0.0,
        "skip_rate": round(skips / starts, 3) if starts > 0 else 0.0,
        "step_views": [{"step": r["_id"], "count": r["count"]} for r in step_rows if r["_id"] is not None],
        "skip_dropoffs": [{"step": r["_id"], "count": r["count"]} for r in skip_rows if r["_id"] is not None],
        "recent_events": recent,
    }


async def ensure_indexes() -> None:
    """Create MongoDB indexes for tour_analytics_events collection."""
    db = get_db()
    await db.tour_analytics_events.create_index([("tour_id", 1), ("created_at", -1)])
    await db.tour_analytics_events.create_index([("user_id", 1), ("created_at", -1)])
    await db.tour_analytics_events.create_index([("type", 1), ("created_at", -1)])
