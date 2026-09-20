"""Admin CMS sub-router: Brands CRUD.

Auto-extracted from former monolithic admin_cms.py.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
import uuid
from datetime import datetime, timezone

from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError, ValidationError
from core.security import require_perm
from models.public_content import (
    CreateBrandRequest, UpdateBrandRequest,
)
from routers.cms_advanced import create_version_snapshot


router = APIRouter()


@router.get("/brands")
async def admin_list_brands(
    status: Optional[str] = Query(None),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: List all brands (including drafts)."""
    db = get_db()
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    
    brands = await db.public_brands.find(query, {"_id": 0}).sort("name", 1).to_list(length=100)
    return ok_envelope(brands)


@router.post("/brands")
async def admin_create_brand(
    payload: CreateBrandRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Create new brand."""
    db = get_db()
    
    # Check code uniqueness
    existing = await db.public_brands.find_one({"code": payload.code, "deleted_at": None})
    if existing:
        raise ValidationError(f"Brand code '{payload.code}' sudah digunakan")
    
    brand_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    doc = {
        "id": brand_id,
        **payload.dict(),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    
    await db.public_brands.insert_one(doc)
    return ok_envelope({"id": brand_id, "message": "Brand created successfully"})


@router.put("/brands/{brand_id}")
async def admin_update_brand(
    brand_id: str,
    payload: UpdateBrandRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Update brand."""
    db = get_db()
    
    brand = await db.public_brands.find_one({"id": brand_id, "deleted_at": None})
    if not brand:
        raise NotFoundError("Brand tidak ditemukan")
    
    # Create version snapshot before update
    await create_version_snapshot(
        content_type="brand",
        item_id=brand_id,
        data={k: v for k, v in brand.items() if k != "_id"},
        saved_by=user.get("email", "system"),
    )
    
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        return ok_envelope({"message": "No changes"})
    
    update_data["updated_at"] = datetime.now(timezone.utc)

    # If publish_at is future-dated and status not explicitly set → keep as "scheduled" draft
    if "publish_at" in update_data and "status" not in update_data:
        pub_at = update_data.get("publish_at")
        if pub_at and isinstance(pub_at, datetime) and pub_at > datetime.now(timezone.utc):
            update_data["status"] = "draft"
    
    await db.public_brands.update_one(
        {"id": brand_id},
        {"$set": update_data},
    )
    
    return ok_envelope({"message": "Brand updated successfully"})


@router.delete("/brands/{brand_id}")
async def admin_delete_brand(
    brand_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Soft delete brand."""
    db = get_db()
    
    brand = await db.public_brands.find_one({"id": brand_id, "deleted_at": None})
    if not brand:
        raise NotFoundError("Brand tidak ditemukan")
    
    await db.public_brands.update_one(
        {"id": brand_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}},
    )
    
    return ok_envelope({"message": "Brand deleted successfully"})


@router.post("/brands/{brand_id}/clone")
async def admin_clone_brand(
    brand_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Clone a brand as a new draft (copy all fields, reset status/schedule)."""
    db = get_db()
    orig = await db.public_brands.find_one({"id": brand_id, "deleted_at": None})
    if not orig:
        raise NotFoundError("Brand tidak ditemukan")

    now = datetime.now(timezone.utc)
    new_id = str(uuid.uuid4())
    cloned = {k: v for k, v in orig.items() if k != "_id"}
    cloned.update({
        "id": new_id,
        "name": f"{orig.get('name', 'Brand')} (Copy)",
        "code": f"{orig.get('code', 'brand')}-copy-{new_id[:8]}",
        "status": "draft",
        "publish_at": None,
        "unpublish_at": None,
        "seo_slug": f"{orig.get('seo_slug', '')+'-copy' if orig.get('seo_slug') else ''}",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    })
    await db.public_brands.insert_one(cloned)
    return ok_envelope({"id": new_id, "name": cloned["name"], "message": "Brand berhasil di-clone sebagai Draft"})
