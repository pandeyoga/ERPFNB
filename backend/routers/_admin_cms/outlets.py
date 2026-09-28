"""Admin CMS sub-router: Outlets CRUD.

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
    CreateOutletRequest, UpdateOutletRequest,
)


router = APIRouter()


@router.get("/outlets")
async def admin_list_outlets(
    status: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: List all outlets."""
    db = get_db()
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    if brand_id:
        query["brand_id"] = brand_id
    
    outlets = await db.public_outlets.find(query, {"_id": 0}).sort("name", 1).to_list(length=200)
    return ok_envelope(outlets)


@router.post("/outlets")
async def admin_create_outlet(
    payload: CreateOutletRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Create new outlet."""
    db = get_db()
    
    # Check code uniqueness
    existing = await db.public_outlets.find_one({"code": payload.code, "deleted_at": None})
    if existing:
        raise ValidationError(f"Outlet code '{payload.code}' sudah digunakan")
    
    # Get brand name
    brand = await db.public_brands.find_one({"id": payload.brand_id, "deleted_at": None})
    if not brand:
        raise ValidationError("Brand tidak ditemukan")
    
    outlet_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    doc = {
        "id": outlet_id,
        "brand_name": brand["name"],
        **payload.dict(),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    
    await db.public_outlets.insert_one(doc)
    return ok_envelope({"id": outlet_id, "message": "Outlet created successfully"})


@router.put("/outlets/{outlet_id}")
async def admin_update_outlet(
    outlet_id: str,
    payload: UpdateOutletRequest,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Update outlet."""
    db = get_db()
    
    outlet = await db.public_outlets.find_one({"id": outlet_id, "deleted_at": None})
    if not outlet:
        raise NotFoundError("Outlet tidak ditemukan")
    
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        return ok_envelope({"message": "No changes"})
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.public_outlets.update_one(
        {"id": outlet_id},
        {"$set": update_data},
    )
    
    return ok_envelope({"message": "Outlet updated successfully"})


@router.delete("/outlets/{outlet_id}")
async def admin_delete_outlet(
    outlet_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Soft delete outlet."""
    db = get_db()
    
    outlet = await db.public_outlets.find_one({"id": outlet_id, "deleted_at": None})
    if not outlet:
        raise NotFoundError("Outlet tidak ditemukan")
    
    await db.public_outlets.update_one(
        {"id": outlet_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}},
    )
    
    return ok_envelope({"message": "Outlet deleted successfully"})


@router.post("/outlets/{outlet_id}/clone")
async def admin_clone_outlet(
    outlet_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Admin: Clone outlet as new draft."""
    db = get_db()
    orig = await db.public_outlets.find_one({"id": outlet_id, "deleted_at": None})
    if not orig:
        raise NotFoundError("Outlet tidak ditemukan")
    now = datetime.now(timezone.utc)
    new_id = str(uuid.uuid4())
    cloned = {k: v for k, v in orig.items() if k != "_id"}
    cloned.update({
        "id": new_id,
        "name": f"{orig.get('name', 'Outlet')} (Copy)",
        "code": f"{orig.get('code', 'outlet')}-copy-{new_id[:8]}",
        "status": "draft",
        "publish_at": None,
        "unpublish_at": None,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    })
    await db.public_outlets.insert_one(cloned)
    return ok_envelope({"id": new_id, "name": cloned["name"], "message": "Outlet berhasil di-clone sebagai Draft"})
