"""Admin CMS - Menu Management API
Endpoints untuk manage brand E-Menu items, categories, dan PDF uploads.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form

from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError, ValidationError
from core.security import require_perm
from models.menu import (
    CreateMenuItemRequest,
    UpdateMenuItemRequest,
    CreateMenuCategoryRequest,
    UpdateMenuCategoryRequest,
)

router = APIRouter(prefix="/api/admin/cms/menu", tags=["admin-cms-menu"])

# Upload configuration
UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MENU_IMAGES_DIR = UPLOAD_DIR / "menu_images"
MENU_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
MENU_PDFS_DIR = UPLOAD_DIR / "menu_pdfs"
MENU_PDFS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_PDF_TYPE = {"application/pdf"}
MAX_IMAGE_SIZE_MB = 5
MAX_PDF_SIZE_MB = 10
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024


def _ser(doc):
    """Serialize MongoDB doc."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [_ser(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if k == "_id":
                continue
            if isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, dict) or isinstance(v, list):
                result[k] = _ser(v)
            else:
                result[k] = v
        return result
    return doc


# =================== IMAGE UPLOAD ===================

@router.post("/upload-image")
async def upload_menu_image(
    file: UploadFile = File(...),
    user: dict = Depends(require_perm("admin.cms.write")),
):
    """Upload menu item image."""
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}")
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(f"File too large. Maximum size: {MAX_IMAGE_SIZE_MB}MB")
    
    # Generate unique filename
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4()}{ext}"
    file_path = MENU_IMAGES_DIR / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return URL (served via public_menu router)
    image_url = f"/api/public/menu/uploads/menu_images/{filename}"
    
    return ok_envelope({"url": image_url, "filename": filename})


# =================== PDF UPLOAD ===================

@router.post("/upload-pdf")
async def upload_menu_pdf(
    brand_id: str = Form(...),
    file: UploadFile = File(...),
    version: Optional[str] = Form(None),
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Upload brand menu PDF."""
    # Validate file type
    if file.content_type not in ALLOWED_PDF_TYPE:
        raise ValidationError("Invalid file type. Must be PDF.")
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_PDF_SIZE_BYTES:
        raise ValidationError(f"File too large. Maximum size: {MAX_PDF_SIZE_MB}MB")
    
    # Generate unique filename
    filename = f"{brand_id}_{uuid.uuid4()}.pdf"
    file_path = MENU_PDFS_DIR / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Save PDF metadata to database
    pdf_url = f"/api/public/menu/uploads/menu_pdfs/{filename}"
    
    # Deactivate old PDFs for this brand
    await db.brand_menu_pdfs.update_many(
        {"brand_id": brand_id},
        {"$set": {"is_active": False}}
    )
    
    # Create new PDF record
    pdf_doc = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "pdf_url": pdf_url,
        "filename": filename,
        "version": version or datetime.now(timezone.utc).strftime("%Y-%m"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.get("id"),
    }
    
    await db.brand_menu_pdfs.insert_one(pdf_doc)
    
    return ok_envelope(_ser(pdf_doc))


# =================== PDF LIST ===================

@router.get("/pdfs")
async def list_menu_pdfs(
    brand_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("admin.cms.read")),
    db=Depends(get_db),
):
    """List all PDFs (optionally filtered by brand)."""
    query = {}
    if brand_id:
        query["brand_id"] = brand_id
    pdfs = await db.brand_menu_pdfs.find(query).sort("created_at", -1).to_list(100)
    return ok_envelope([_ser(p) for p in pdfs])


@router.delete("/pdfs/{pdf_id}")
async def delete_menu_pdf(
    pdf_id: str,
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Delete a menu PDF."""
    pdf = await db.brand_menu_pdfs.find_one({"id": pdf_id})
    if not pdf:
        raise NotFoundError("PDF not found")
    await db.brand_menu_pdfs.delete_one({"id": pdf_id})
    return ok_envelope({"deleted": True, "id": pdf_id})


# =================== MENU CATEGORIES ===================

@router.get("/categories")
async def list_menu_categories(
    brand_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("admin.cms.read")),
    db=Depends(get_db),
):
    """List menu categories."""
    query = {"deleted_at": None}
    if brand_id:
        query["brand_id"] = brand_id
    
    categories = await db.brand_menu_categories.find(query).sort("sort_order", 1).to_list(100)
    return ok_envelope([_ser(c) for c in categories])


@router.post("/categories")
async def create_menu_category(
    payload: CreateMenuCategoryRequest,
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Create menu category."""
    doc = {
        "id": str(uuid.uuid4()),
        "brand_id": payload.brand_id,
        "name": payload.name,
        "description": payload.description,
        "sort_order": payload.sort_order,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.get("id"),
        "deleted_at": None,
    }
    
    await db.brand_menu_categories.insert_one(doc)
    return ok_envelope(_ser(doc))


@router.put("/categories/{category_id}")
async def update_menu_category(
    category_id: str,
    payload: UpdateMenuCategoryRequest,
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Update menu category."""
    category = await db.brand_menu_categories.find_one({"id": category_id, "deleted_at": None})
    if not category:
        raise NotFoundError("Category not found")
    
    updates = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        updates["updated_by"] = user.get("id")
        await db.brand_menu_categories.update_one(
            {"id": category_id},
            {"$set": updates}
        )
    
    updated = await db.brand_menu_categories.find_one({"id": category_id})
    return ok_envelope(_ser(updated))


@router.delete("/categories/{category_id}")
async def delete_menu_category(
    category_id: str,
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Soft delete menu category."""
    category = await db.brand_menu_categories.find_one({"id": category_id, "deleted_at": None})
    if not category:
        raise NotFoundError("Category not found")
    
    await db.brand_menu_categories.update_one(
        {"id": category_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "deleted_by": user.get("id")}}
    )
    
    return ok_envelope({"deleted": True, "id": category_id})


# =================== MENU ITEMS ===================

@router.get("/items")
async def list_menu_items(
    brand_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: dict = Depends(require_perm("admin.cms.read")),
    db=Depends(get_db),
):
    """List menu items with filters."""
    query = {"deleted_at": None}
    if brand_id:
        query["brand_id"] = brand_id
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    
    skip = (page - 1) * per_page
    items = await db.brand_menu_items.find(query).sort([("sort_order", 1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.brand_menu_items.count_documents(query)
    
    return ok_envelope([_ser(i) for i in items], {"page": page, "per_page": per_page, "total": total})


@router.get("/items/{item_id}")
async def get_menu_item(
    item_id: str,
    user: dict = Depends(require_perm("admin.cms.read")),
    db=Depends(get_db),
):
    """Get menu item by ID."""
    item = await db.brand_menu_items.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Menu item not found")
    
    return ok_envelope(_ser(item))


@router.post("/items")
async def create_menu_item(
    payload: CreateMenuItemRequest,
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Create menu item."""
    doc = {
        "id": str(uuid.uuid4()),
        "brand_id": payload.brand_id,
        "name": payload.name,
        "description": payload.description,
        "price": payload.price,
        "category": payload.category,
        "dietary_tags": payload.dietary_tags or [],
        "image_url": payload.image_url,
        "is_featured": payload.is_featured,
        "is_available": payload.is_available,
        "sort_order": payload.sort_order,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.get("id"),
        "deleted_at": None,
    }
    
    await db.brand_menu_items.insert_one(doc)
    return ok_envelope(_ser(doc))


@router.put("/items/{item_id}")
async def update_menu_item(
    item_id: str,
    payload: UpdateMenuItemRequest,
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Update menu item."""
    item = await db.brand_menu_items.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Menu item not found")
    
    updates = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        updates["updated_by"] = user.get("id")
        await db.brand_menu_items.update_one(
            {"id": item_id},
            {"$set": updates}
        )
    
    updated = await db.brand_menu_items.find_one({"id": item_id})
    return ok_envelope(_ser(updated))


@router.delete("/items/{item_id}")
async def delete_menu_item(
    item_id: str,
    user: dict = Depends(require_perm("admin.cms.write")),
    db=Depends(get_db),
):
    """Soft delete menu item."""
    item = await db.brand_menu_items.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Menu item not found")
    
    await db.brand_menu_items.update_one(
        {"id": item_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "deleted_by": user.get("id")}}
    )
    
    return ok_envelope({"deleted": True, "id": item_id})
