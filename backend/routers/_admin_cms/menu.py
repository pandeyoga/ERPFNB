"""Admin CMS sub-router: Menu Items CRUD.

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
    CreateMenuItemRequest, UpdateMenuItemRequest,
)


router = APIRouter()


@router.get("/menu")
async def admin_list_menu_items(
    brand_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: List all menu items."""
    db = get_db()
    query = {"deleted_at": None}
    if brand_id:
        query["brand_id"] = brand_id
    if status:
        query["status"] = status
    
    menu_items = await db.public_menu_items.find(query, {"_id": 0}).sort([("brand_name", 1), ("category", 1), ("name", 1)]).to_list(length=500)
    return ok_envelope(menu_items)


@router.post("/menu")
async def admin_create_menu_item(
    payload: CreateMenuItemRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Create new menu item."""
    db = get_db()
    
    # Get brand name
    brand = await db.public_brands.find_one({"id": payload.brand_id, "deleted_at": None})
    if not brand:
        raise ValidationError("Brand tidak ditemukan")
    
    menu_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    doc = {
        "id": menu_id,
        "brand_name": brand["name"],
        **payload.dict(),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    
    await db.public_menu_items.insert_one(doc)
    return ok_envelope({"id": menu_id, "message": "Menu item created successfully"})


@router.put("/menu/{menu_id}")
async def admin_update_menu_item(
    menu_id: str,
    payload: UpdateMenuItemRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Update menu item."""
    db = get_db()
    
    menu_item = await db.public_menu_items.find_one({"id": menu_id, "deleted_at": None})
    if not menu_item:
        raise NotFoundError("Menu item tidak ditemukan")
    
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        return ok_envelope({"message": "No changes"})
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.public_menu_items.update_one(
        {"id": menu_id},
        {"$set": update_data},
    )
    
    return ok_envelope({"message": "Menu item updated successfully"})


@router.delete("/menu/{menu_id}")
async def admin_delete_menu_item(
    menu_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Soft delete menu item."""
    db = get_db()
    
    menu_item = await db.public_menu_items.find_one({"id": menu_id, "deleted_at": None})
    if not menu_item:
        raise NotFoundError("Menu item tidak ditemukan")
    
    await db.public_menu_items.update_one(
        {"id": menu_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}},
    )
    
    return ok_envelope({"message": "Menu item deleted successfully"})


@router.post("/menu/{menu_id}/clone")
async def admin_clone_menu_item(
    menu_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Clone menu item as new draft."""
    db = get_db()
    orig = await db.public_menu_items.find_one({"id": menu_id, "deleted_at": None})
    if not orig:
        raise NotFoundError("Menu item tidak ditemukan")
    now = datetime.now(timezone.utc)
    new_id = str(uuid.uuid4())
    cloned = {k: v for k, v in orig.items() if k != "_id"}
    cloned.update({
        "id": new_id,
        "name": f"{orig.get('name', 'Item')} (Copy)",
        "code": f"{orig.get('code', 'item')}-copy-{new_id[:8]}",
        "status": "draft",
        "publish_at": None,
        "unpublish_at": None,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    })
    await db.public_menu_items.insert_one(cloned)
    return ok_envelope({"id": new_id, "name": cloned["name"], "message": "Menu item berhasil di-clone sebagai Draft"})
