"""Admin CMS sub-router: brand Instagram posts CRUD.

Auto-extracted from former monolithic admin_cms.py.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from core.db import get_db
from core.exceptions import ok_envelope
from core.security import require_perm

from routers._admin_cms._common import _ser

router = APIRouter()


class IGPostCreate(BaseModel):
    post_url: str
    image_url: str
    thumbnail_url: Optional[str] = None
    caption: str
    likes: int = 0
    comments: int = 0
    post_type: str = "photo"  # photo / video / reel / carousel
    is_pinned: bool = False
    posted_at: Optional[str] = None


class IGPostUpdate(BaseModel):
    caption: Optional[str] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    post_type: Optional[str] = None
    is_pinned: Optional[bool] = None
    active: Optional[bool] = None
    posted_at: Optional[str] = None


@router.get("/brands/{brand_id}/instagram")
async def get_brand_ig_posts(
    brand_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Get all IG posts for a brand (admin view, includes inactive)."""
    db = get_db()
    query = {"$or": [{"brand_id": brand_id}, {"brand_code": brand_id}]}
    posts = await db.brand_instagram_posts.find(query, {"_id": 0}).sort(
        [("is_pinned", -1), ("posted_at", -1)]
    ).to_list(1000)
    return ok_envelope([_ser(p) for p in posts])


@router.post("/brands/{brand_id}/instagram")
async def add_ig_post(
    brand_id: str,
    payload: IGPostCreate,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Add a new IG post for a brand."""
    db = get_db()
    # Verify brand exists
    brand = await db.public_brands.find_one({"$or": [{"id": brand_id}, {"code": brand_id}]})
    if not brand:
        raise HTTPException(404, "Brand not found")

    now = datetime.now(timezone.utc)
    post = {
        "id": str(uuid.uuid4()),
        "brand_id": brand["id"],
        "brand_code": brand["code"],
        "thumbnail_url": payload.thumbnail_url or payload.image_url,
        "posted_at": payload.posted_at or now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "active": True,
        **payload.dict(exclude={"thumbnail_url", "posted_at"}),
    }
    post["thumbnail_url"] = payload.thumbnail_url or payload.image_url
    await db.brand_instagram_posts.insert_one(post)
    post.pop("_id", None)
    return ok_envelope(_ser(post))


@router.put("/brands/{brand_id}/instagram/{post_id}")
async def update_ig_post(
    brand_id: str,
    post_id: str,
    payload: IGPostUpdate,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Update an IG post."""
    db = get_db()
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.brand_instagram_posts.find_one_and_update(
        {"id": post_id},
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(404, "IG post not found")
    return ok_envelope(_ser(result))


@router.delete("/brands/{brand_id}/instagram/{post_id}")
async def delete_ig_post(
    brand_id: str,
    post_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Delete an IG post."""
    db = get_db()
    result = await db.brand_instagram_posts.find_one_and_update(
        {"id": post_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(404, "IG post not found")
    return ok_envelope({"success": True, "id": post_id})


@router.patch("/brands/{brand_id}/instagram/{post_id}/pin")
async def toggle_pin_ig_post(
    brand_id: str,
    post_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Toggle pin status of an IG post."""
    db = get_db()
    post = await db.brand_instagram_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(404, "IG post not found")
    new_pinned = not post.get("is_pinned", False)
    result = await db.brand_instagram_posts.find_one_and_update(
        {"id": post_id},
        {"$set": {"is_pinned": new_pinned, "updated_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
        projection={"_id": 0},
    )
    return ok_envelope(_ser(result))
