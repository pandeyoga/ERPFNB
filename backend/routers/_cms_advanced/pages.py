"""Custom pages (Page Builder) CRUD."""
import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError, ValidationError
from core.security import require_perm

from routers._cms_advanced._common import NOW, _serialize_doc

router = APIRouter()


@router.get("/pages")
async def list_pages(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """List custom pages."""
    db = get_db()
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"slug": {"$regex": q, "$options": "i"}}]
    total = await db.custom_pages.count_documents(query)
    skip = (page - 1) * page_size
    items = await db.custom_pages.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(page_size).to_list(length=page_size)
    return ok_envelope({"items": [_serialize_doc(i) for i in items], "total": total, "page": page, "page_size": page_size})


@router.post("/pages")
async def create_page(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Create a custom page."""
    if not payload.get("title") or not payload.get("slug"):
        raise ValidationError("title and slug required")
    db = get_db()
    existing = await db.custom_pages.find_one({"slug": payload["slug"], "deleted_at": None})
    if existing:
        raise ValidationError(f"Slug '{payload['slug']}' sudah digunakan")

    now = NOW()
    page_id = str(uuid.uuid4())
    doc = {
        "id": page_id,
        "title": payload["title"],
        "slug": payload["slug"],
        "description": payload.get("description", ""),
        "status": payload.get("status", "draft"),
        "blocks": payload.get("blocks", []),
        "seo_title": payload.get("seo_title", ""),
        "seo_description": payload.get("seo_description", ""),
        "seo_og_image": payload.get("seo_og_image", ""),
        "publish_at": payload.get("publish_at"),
        "unpublish_at": payload.get("unpublish_at"),
        "created_by": user.get("email", "unknown"),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    await db.custom_pages.insert_one(doc)
    return ok_envelope(_serialize_doc({k: v for k, v in doc.items() if k != "_id"}))


@router.get("/pages/{page_id}")
async def get_page(
    page_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Get a single custom page by ID."""
    db = get_db()
    doc = await db.custom_pages.find_one({"id": page_id, "deleted_at": None}, {"_id": 0})
    if not doc:
        raise NotFoundError("Halaman tidak ditemukan")
    return ok_envelope(_serialize_doc(doc))


@router.put("/pages/{page_id}")
async def update_page(
    page_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Update a custom page."""
    db = get_db()
    doc = await db.custom_pages.find_one({"id": page_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Halaman tidak ditemukan")

    # Slug uniqueness check
    new_slug = payload.get("slug", doc["slug"])
    if new_slug != doc["slug"]:
        existing = await db.custom_pages.find_one({"slug": new_slug, "id": {"$ne": page_id}, "deleted_at": None})
        if existing:
            raise ValidationError(f"Slug '{new_slug}' sudah digunakan")

    allowed = {"title", "slug", "description", "status", "blocks", "seo_title", "seo_description", "seo_og_image", "publish_at", "unpublish_at"}
    update_data = {k: v for k, v in payload.items() if k in allowed}
    update_data["updated_at"] = NOW()
    await db.custom_pages.update_one({"id": page_id}, {"$set": update_data})
    updated = await db.custom_pages.find_one({"id": page_id}, {"_id": 0})
    return ok_envelope(_serialize_doc(updated))


@router.delete("/pages/{page_id}")
async def delete_page(
    page_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Soft delete a custom page."""
    db = get_db()
    doc = await db.custom_pages.find_one({"id": page_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Halaman tidak ditemukan")
    await db.custom_pages.update_one({"id": page_id}, {"$set": {"deleted_at": NOW()}})
    return ok_envelope({"message": "Halaman dihapus"})
