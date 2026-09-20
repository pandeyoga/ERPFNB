"""Public Menu API - View E-Menu per brand (no auth required)."""
from fastapi import APIRouter, Query
from fastapi.responses import FileResponse
from typing import Optional, List
from pathlib import Path

from core.exceptions import ok_envelope, NotFoundError

router = APIRouter(prefix="/api/public/menu", tags=["public-menu"])


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
            if hasattr(v, "isoformat"):
                result[k] = v.isoformat()
            elif isinstance(v, dict) or isinstance(v, list):
                result[k] = _ser(v)
            else:
                result[k] = v
        return result
    return doc


# =================== MENU ITEMS (PUBLIC) ===================

@router.get("/brands/{brand_slug}/items")
async def get_brand_menu_items(
    brand_slug: str,
    category: Optional[str] = Query(None),
    dietary: Optional[List[str]] = Query(None),
    q: Optional[str] = Query(None),
    db=None,
):
    """Get menu items for a brand (public, no auth)."""
    if db is None:
        from core.db import get_db as _get_db
        db = _get_db()
    
    # Find brand by id or code in public_brands collection
    brand = await db.public_brands.find_one({
        "$or": [{"id": brand_slug}, {"code": brand_slug}, {"code": brand_slug.lower()}],
        "deleted_at": None,
    })
    if not brand:
        raise NotFoundError(f"Brand '{brand_slug}' not found")
    
    brand_id = brand["id"]
    
    # Build query
    query = {
        "brand_id": brand_id,
        "deleted_at": None,
        "is_available": True,  # Only show available items to public
    }
    
    if category:
        query["category"] = category
    
    if dietary:
        # Items must have ALL specified dietary tags
        query["dietary_tags"] = {"$all": dietary}
    
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    
    # Fetch items
    items = await db.brand_menu_items.find(query).sort([("sort_order", 1), ("category", 1), ("name", 1)]).to_list(200)
    
    return ok_envelope([_ser(i) for i in items])


@router.get("/brands/{brand_slug}/categories")
async def get_brand_menu_categories(
    brand_slug: str,
    db=None,
):
    """Get menu categories for a brand (public)."""
    if db is None:
        from core.db import get_db as _get_db
        db = _get_db()
    
    # Find brand by id or code in public_brands collection
    brand = await db.public_brands.find_one({
        "$or": [{"id": brand_slug}, {"code": brand_slug}, {"code": brand_slug.lower()}],
        "deleted_at": None,
    })
    if not brand:
        raise NotFoundError(f"Brand '{brand_slug}' not found")
    
    brand_id = brand["id"]
    
    # Fetch categories
    categories = await db.brand_menu_categories.find({
        "brand_id": brand_id,
        "deleted_at": None,
    }).sort("sort_order", 1).to_list(50)
    
    return ok_envelope([_ser(c) for c in categories])


@router.get("/brands/{brand_slug}/pdf")
async def get_brand_menu_pdf(
    brand_slug: str,
    db=None,
):
    """Get active PDF menu for a brand (public)."""
    if db is None:
        from core.db import get_db as _get_db
        db = _get_db()
    
    # Find brand by id or code in public_brands collection
    brand = await db.public_brands.find_one({
        "$or": [{"id": brand_slug}, {"code": brand_slug}, {"code": brand_slug.lower()}],
        "deleted_at": None,
    })
    if not brand:
        raise NotFoundError(f"Brand '{brand_slug}' not found")
    
    brand_id = brand["id"]
    
    # Fetch active PDF
    pdf = await db.brand_menu_pdfs.find_one({
        "brand_id": brand_id,
        "is_active": True,
    })
    
    if not pdf:
        return ok_envelope(None)
    
    return ok_envelope(_ser(pdf))


# =================== FILE SERVING ===================

@router.get("/uploads/menu_images/{filename}")
async def serve_menu_image(filename: str):
    """Serve uploaded menu image."""
    file_path = Path("/app/backend/uploads/menu_images") / filename
    if not file_path.exists():
        raise NotFoundError("Image not found")
    
    return FileResponse(file_path)


@router.get("/uploads/menu_pdfs/{filename}")
async def serve_menu_pdf(filename: str):
    """Serve uploaded menu PDF."""
    file_path = Path("/app/backend/uploads/menu_pdfs") / filename
    if not file_path.exists():
        raise NotFoundError("PDF not found")
    
    return FileResponse(file_path, media_type="application/pdf")
