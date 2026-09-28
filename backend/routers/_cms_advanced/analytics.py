"""Analytics tracking + admin overview/popular endpoints."""
import uuid
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.db import get_db
from core.exceptions import ok_envelope
from core.security import require_perm

from routers._cms_advanced._common import (
    CONTENT_COLLECTION_MAP, NOW,
)

router = APIRouter()


@router.post("/analytics/track")
async def track_page_view_admin(payload: dict = Body(...)):
    """Track a page view event. No auth required — lightweight fire-and-forget."""
    content_type = payload.get("content_type", "unknown")
    content_id = payload.get("content_id", "unknown")
    today = NOW().date().isoformat()
    db = get_db()
    await db.content_analytics_daily.update_one(
        {"content_type": content_type, "content_id": content_id, "date": today},
        {"$inc": {"views": 1}, "$setOnInsert": {
            "id": str(uuid.uuid4()),
            "content_type": content_type,
            "content_id": content_id,
            "date": today,
        }},
        upsert=True,
    )
    return ok_envelope({"tracked": True})


@router.get("/analytics/overview")
async def analytics_overview(
    days: int = Query(30, ge=7, le=365),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Analytics overview: total views, daily trend, top content."""
    db = get_db()
    since = (NOW() - timedelta(days=days)).date().isoformat()

    # Daily trend aggregation
    pipeline = [
        {"$match": {"date": {"$gte": since}}},
        {"$group": {"_id": "$date", "views": {"$sum": "$views"}}},
        {"$sort": {"_id": 1}},
    ]
    daily = await db.content_analytics_daily.aggregate(pipeline).to_list(length=400)
    daily_trend = [{"date": d["_id"], "views": d["views"]} for d in daily]

    # Total views
    total_views_all = sum(d["views"] for d in daily)
    since_7 = (NOW() - timedelta(days=7)).date().isoformat()
    total_views_7d = sum(d["views"] for d in daily if d["_id"] >= since_7)

    # By content type
    by_type_pipeline = [
        {"$match": {"date": {"$gte": since}}},
        {"$group": {"_id": "$content_type", "views": {"$sum": "$views"}}},
        {"$sort": {"views": -1}},
    ]
    by_type = await db.content_analytics_daily.aggregate(by_type_pipeline).to_list(length=20)
    by_type_map = {b["_id"]: b["views"] for b in by_type}

    return ok_envelope({
        "total_views": total_views_all,
        "views_7d": total_views_7d,
        "daily_trend": daily_trend,
        "by_type": by_type_map,
        "period_days": days,
    })


@router.get("/analytics/popular")
async def analytics_popular(
    days: int = Query(30, ge=1, le=365),
    content_type: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Top content by page views."""
    db = get_db()
    since = (NOW() - timedelta(days=days)).date().isoformat()
    match = {"date": {"$gte": since}}
    if content_type:
        match["content_type"] = content_type

    pipeline = [
        {"$match": match},
        {"$group": {"_id": {"content_type": "$content_type", "content_id": "$content_id"}, "views": {"$sum": "$views"}}},
        {"$sort": {"views": -1}},
        {"$limit": limit},
    ]
    results = await db.content_analytics_daily.aggregate(pipeline).to_list(length=limit)

    # Enrich with content titles
    enriched = []
    for r in results:
        ct = r["_id"]["content_type"]
        cid = r["_id"]["content_id"]
        coll = CONTENT_COLLECTION_MAP.get(ct)
        title = cid
        if coll:
            doc = await getattr(db, coll).find_one({"id": cid}, {"name": 1, "title": 1, "_id": 0})
            if doc:
                title = doc.get("name") or doc.get("title") or cid
        enriched.append({"content_type": ct, "content_id": cid, "title": title, "views": r["views"]})

    return ok_envelope(enriched)
