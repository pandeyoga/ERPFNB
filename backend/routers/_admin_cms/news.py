"""Admin CMS sub-router: News CRUD.

Auto-extracted from former monolithic admin_cms.py.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
import uuid
from datetime import datetime, timezone

from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError
from core.security import require_perm
from core.sanitizer import sanitize_html
from models.public_content import (
    CreateNewsRequest, UpdateNewsRequest,
)
from routers.cms_advanced import create_version_snapshot


router = APIRouter()


@router.get("/news")
async def admin_list_news(
    status: Optional[str] = Query(None),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: List all news articles."""
    db = get_db()
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    
    news = await db.public_news.find(query, {"_id": 0}).sort("date", -1).to_list(length=200)
    return ok_envelope(news)


@router.post("/news")
async def admin_create_news(
    payload: CreateNewsRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Create new news article."""
    db = get_db()
    
    news_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    doc = {
        "id": news_id,
        **payload.dict(),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    # A15 fix: SEC-010 — Sanitasi HTML konten sebelum simpan ke DB
    if doc.get("content"):
        doc["content"] = sanitize_html(doc["content"])
    
    await db.public_news.insert_one(doc)
    return ok_envelope({"id": news_id, "message": "News created successfully"})


@router.put("/news/{news_id}")
async def admin_update_news(
    news_id: str,
    payload: UpdateNewsRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Update news article."""
    db = get_db()
    
    news = await db.public_news.find_one({"id": news_id, "deleted_at": None})
    if not news:
        raise NotFoundError("News tidak ditemukan")
    
    # Create version snapshot before update
    await create_version_snapshot(
        content_type="news",
        item_id=news_id,
        data={k: v for k, v in news.items() if k != "_id"},
        saved_by=user.get("email", "system"),
    )
    
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        return ok_envelope({"message": "No changes"})
    
    # A15 fix: SEC-010 — Sanitasi HTML konten jika diupdate
    if update_data.get("content"):
        update_data["content"] = sanitize_html(update_data["content"])

    update_data["updated_at"] = datetime.now(timezone.utc)

    # If publish_at is future-dated → keep as scheduled draft
    if "publish_at" in update_data and "status" not in update_data:
        pub_at = update_data.get("publish_at")
        if pub_at and isinstance(pub_at, datetime) and pub_at > datetime.now(timezone.utc):
            update_data["status"] = "draft"
    
    await db.public_news.update_one(
        {"id": news_id},
        {"$set": update_data},
    )
    
    return ok_envelope({"message": "News updated successfully"})


@router.delete("/news/{news_id}")
async def admin_delete_news(
    news_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Soft delete news article."""
    db = get_db()
    
    news = await db.public_news.find_one({"id": news_id, "deleted_at": None})
    if not news:
        raise NotFoundError("News tidak ditemukan")
    
    await db.public_news.update_one(
        {"id": news_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}},
    )
    
    return ok_envelope({"message": "News deleted successfully"})


@router.post("/news/{news_id}/clone")
async def admin_clone_news(
    news_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Clone news article as new draft."""
    db = get_db()
    orig = await db.public_news.find_one({"id": news_id, "deleted_at": None})
    if not orig:
        raise NotFoundError("News tidak ditemukan")
    now = datetime.now(timezone.utc)
    new_id = str(uuid.uuid4())
    cloned = {k: v for k, v in orig.items() if k != "_id"}
    cloned.update({
        "id": new_id,
        "title": f"{orig.get('title', 'Article')} (Copy)",
        "status": "draft",
        "publish_at": None,
        "unpublish_at": None,
        "seo_slug": f"{orig.get('seo_slug', '')+'-copy' if orig.get('seo_slug') else ''}",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    })
    await db.public_news.insert_one(cloned)
    return ok_envelope({"id": new_id, "title": cloned["title"], "message": "Artikel berhasil di-clone sebagai Draft"})
