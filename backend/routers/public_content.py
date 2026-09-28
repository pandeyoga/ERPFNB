"""Sprint D — Public API (read-only, no auth) untuk Compro content.
Sprint I-L additions: analytics tracking, custom pages public endpoints.

Endpoints:
- GET /api/public/brands
- GET /api/public/brands/:id
- GET /api/public/outlets
- GET /api/public/news
- GET /api/public/news/:id
- GET /api/public/menu
- POST /api/public/analytics/track   (new Sprint K)
- GET  /api/public/pages             (new Sprint L)
- GET  /api/public/pages/:slug       (new Sprint L)
"""
from fastapi import APIRouter, Query, Body
from typing import Optional
from datetime import datetime, timezone
import uuid
from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError

router = APIRouter(prefix="/api/public", tags=["public"])

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def _schedule_filter() -> dict:
    """Build Mongo filter that excludes future-scheduled and already-expired content."""
    now = NOW()
    return {
        "$or": [
            {"publish_at": None},
            {"publish_at": {"$lte": now}},
        ],
        "$and": [
            {
                "$or": [
                    {"unpublish_at": None},
                    {"unpublish_at": {"$gt": now}},
                ]
            }
        ],
    }


def _ser(doc):
    """Serialize datetime objects to ISO strings."""
    if isinstance(doc, dict):
        return {k: _ser(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_ser(i) for i in doc]
    if hasattr(doc, "isoformat"):
        return doc.isoformat()
    return doc


# ============================================================================
# ANALYTICS TRACKING (no auth)
# ============================================================================

@router.post("/analytics/track")
async def track_page_view(payload: dict = Body(...)):
    """Track a page view event. Fire-and-forget, no auth needed."""
    try:
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
    except Exception:
        pass  # Tracking is best-effort
    return ok_envelope({"tracked": True})


# ============================================================================
# CUSTOM PAGES (Page Builder — public)
# ============================================================================

@router.get("/pages")
async def get_public_pages():
    """Get all published custom pages."""
    db = get_db()
    pages = await db.custom_pages.find(
        {"deleted_at": None, "status": "published"},
        {"_id": 0, "blocks": 0},  # exclude blocks from listing
    ).sort("updated_at", -1).to_list(length=100)
    return ok_envelope([_ser(p) for p in pages])


@router.get("/pages/{slug}")
async def get_public_page(slug: str):
    """Get a published custom page by slug."""
    db = get_db()
    page = await db.custom_pages.find_one(
        {"slug": slug, "deleted_at": None, "status": "published"},
        {"_id": 0},
    )
    if not page:
        raise NotFoundError("Halaman tidak ditemukan atau belum dipublish")
    return ok_envelope(_ser(page))


# ============================================================================
# ORIGINAL BRAND/OUTLET/NEWS/MENU ENDPOINTS
# ============================================================================

@router.get("/brands")
async def get_brands(status: str = Query("published")):
    """Get all published brands."""
    db = get_db()
    brands = await db.public_brands.find(
        {"deleted_at": None, "status": status, **_schedule_filter()},
        {"_id": 0},
    ).sort("name", 1).to_list(length=100)
    return ok_envelope(brands)


@router.get("/brands/{brand_id}")
async def get_brand_detail(brand_id: str):
    """Get single brand detail (by id or code)."""
    db = get_db()
    brand = await db.public_brands.find_one(
        {"$or": [{"id": brand_id}, {"code": brand_id}], "deleted_at": None, "status": "published", **_schedule_filter()},
        {"_id": 0},
    )
    if not brand:
        raise NotFoundError("Brand tidak ditemukan atau belum published")
    return ok_envelope(_ser(brand))


@router.get("/outlets")
async def get_outlets(
    status: str = Query("published"),
    brand_id: Optional[str] = Query(None),
):
    """Get all published outlets (supports brand_id or brand_code)."""
    db = get_db()
    query = {"deleted_at": None, "status": status, **_schedule_filter()}
    if brand_id:
        # Support both brand_id (UUID) and brand_code
        query["$or"] = [{"brand_id": brand_id}, {"brand_code": brand_id}]
    outlets = await db.public_outlets.find(query, {"_id": 0}).sort("name", 1).to_list(length=200)
    # Fallback: if no CMS outlets published, return operational outlets
    if not outlets:
        op_query: dict = {"deleted_at": None}
        if brand_id:
            op_query["$or"] = [{"brand_id": brand_id}, {"brand_code": brand_id}]
        operational = await db.outlets.find(op_query, {"_id": 0}).sort("name", 1).to_list(length=200)
        # Map to simplified format for public display
        outlets = [
            {
                "id": o["id"],
                "name": o.get("name", ""),
                "address": o.get("address", ""),
                "brand_id": o.get("brand_id", ""),
                "phone": o.get("phone", ""),
                "status": "published",
            }
            for o in operational
        ]
    return ok_envelope(outlets)


@router.get("/news")
async def get_news(
    status: str = Query("published"),
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Get published news."""
    db = get_db()
    query = {"deleted_at": None, "status": status, **_schedule_filter()}
    if category:
        query["category"] = category
    news = await db.public_news.find(query, {"_id": 0}).sort("date", -1).limit(limit).to_list(length=limit)
    return ok_envelope(news)


@router.get("/news/{news_id}")
async def get_news_detail(news_id: str):
    """Get single news article."""
    db = get_db()
    news = await db.public_news.find_one(
        {"id": news_id, "deleted_at": None, "status": "published", **_schedule_filter()},
        {"_id": 0},
    )
    if not news:
        news = await db.public_news.find_one(
            {"seo_slug": news_id, "deleted_at": None, "status": "published", **_schedule_filter()},
            {"_id": 0},
        )
    if not news:
        raise NotFoundError("Artikel tidak ditemukan atau belum published")
    return ok_envelope(_ser(news))


@router.get("/menu")
async def get_menu_items(
    brand_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: str = Query("published"),
    available: Optional[bool] = Query(None),
):
    """Get menu items."""
    db = get_db()
    query = {"deleted_at": None, "status": status, **_schedule_filter()}
    if brand_id:
        query["brand_id"] = brand_id
    if category:
        query["category"] = category
    if available is not None:
        query["available"] = available
    menu_items = await db.public_menu_items.find(query, {"_id": 0}).sort(
        [("brand_name", 1), ("category", 1), ("name", 1)]
    ).to_list(length=500)
    return ok_envelope(menu_items)


# ─── Instagram Posts (public) ─────────────────────────────────────────────────
@router.get("/brands/{brand_id}/instagram")
async def get_brand_instagram(
    brand_id: str,
    limit: int = Query(12, ge=1, le=50),
):
    """Get Instagram posts for a brand (by brand id OR code)."""
    db = get_db()
    # Try by id first, then by code
    query = {"$or": [{"brand_id": brand_id}, {"brand_code": brand_id}], "active": True}
    posts = await db.brand_instagram_posts.find(query, {"_id": 0}).sort(
        [("is_pinned", -1), ("posted_at", -1)]
    ).limit(limit).to_list(length=limit)
    return ok_envelope([_ser(p) for p in posts])


@router.get("/instagram/all")
async def get_all_instagram(limit: int = Query(24, ge=1, le=100)):
    """Get latest IG posts across all brands (for home feed)."""
    db = get_db()
    posts = await db.brand_instagram_posts.find(
        {"active": True}, {"_id": 0}
    ).sort([("is_pinned", -1), ("posted_at", -1)]).limit(limit).to_list(length=limit)
    return ok_envelope([_ser(p) for p in posts])


@router.get("/jobs")
async def get_public_jobs(
    department: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Get active job listings (public, no auth required)."""
    db = get_db()
    query: dict = {"is_active": True}
    if department and department != "All":
        query["department"] = department
    if job_type:
        query["job_type"] = job_type
    cursor = db.job_listings.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    jobs = await cursor.to_list(length=limit)
    # Serialize datetime fields
    result = []
    for j in jobs:
        for f in ("created_at", "updated_at"):
            if f in j and hasattr(j[f], "isoformat"):
                j[f] = j[f].isoformat()
        result.append(j)
    return ok_envelope(result)


@router.post("/jobs/apply")
async def apply_for_job(payload: dict = Body(...)):
    """Submit a job application (public, no auth required)."""
    from services import job_application_service
    
    try:
        application = await job_application_service.create_application(payload)
        return ok_envelope({
            "message": "Lamaran berhasil dikirim! Tim HR kami akan menghubungi Anda.",
            "id": application["id"]
        })
    except ValueError as e:
        from core.exceptions import ValidationError
        raise ValidationError(str(e))

