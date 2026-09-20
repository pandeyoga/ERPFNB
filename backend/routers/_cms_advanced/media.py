"""Media library: list / upload / bulk-upload / update / delete."""
import asyncio
import io
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError, ValidationError
from core.security import require_perm

from routers._cms_advanced._common import (
    ALLOWED_TYPES, MAX_SIZE_BYTES, MEDIUM_DIR, NOW, THUMBS_DIR, UPLOAD_DIR,
    _serialize_doc,
)

router = APIRouter()


def _process_image_variants(content: bytes, stem: str):
    """Generate thumbnail + medium WebP variants with Pillow."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        variants = {}

        # Thumbnail — 300px wide, proportional height
        thumb = img.copy()
        thumb.thumbnail((300, 300))
        thumb_name = f"{stem}_thumb.webp"
        thumb_path = THUMBS_DIR / thumb_name
        thumb.save(thumb_path, "WEBP", quality=80)
        variants["thumbnail"] = {"url": f"/uploads/thumbs/{thumb_name}", "width": thumb.width, "height": thumb.height}

        # Medium — 800px wide, proportional
        med = img.copy()
        med.thumbnail((800, 800))
        med_name = f"{stem}_medium.webp"
        med_path = MEDIUM_DIR / med_name
        med.save(med_path, "WEBP", quality=85)
        variants["medium"] = {"url": f"/uploads/medium/{med_name}", "width": med.width, "height": med.height}

        # Original dimensions
        variants["original"] = {"width": img.width, "height": img.height}

        return ok_envelope(variants)
    except Exception as e:
        from core.exceptions import error_envelope
        return JSONResponse(status_code=500, content=error_envelope("PROCESSING_ERROR", str(e)))


@router.get("/media")
async def list_media(
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """List media library items."""
    db = get_db()
    query = {"deleted_at": None}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"alt_text": {"$regex": search, "$options": "i"}},
            {"original_filename": {"$regex": search, "$options": "i"}},
        ]
    if tag:
        query["tags"] = {"$in": [tag]}
    skip = (page - 1) * page_size
    total = await db.media_library.count_documents(query)
    items = await db.media_library.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(page_size).to_list(length=page_size)
    return ok_envelope({"items": [_serialize_doc(i) for i in items], "total": total, "page": page, "page_size": page_size})


@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Upload image to media library with WebP variant generation."""
    if file.content_type not in ALLOWED_TYPES:
        raise ValidationError(f"Invalid file type: {file.content_type}. Allowed: {', '.join(ALLOWED_TYPES)}")

    content = await file.read()
    file_size = len(content)
    if file_size > MAX_SIZE_BYTES:
        raise ValidationError(f"File too large: {file_size / 1024 / 1024:.2f}MB. Max: 10MB")

    stem = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    unique_filename = f"{stem}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename

    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Generate image variants in background
    loop = asyncio.get_event_loop()
    variants = await loop.run_in_executor(None, _process_image_variants, content, stem)

    now = NOW()
    media_id = str(uuid.uuid4())
    doc = {
        "id": media_id,
        "filename": unique_filename,
        "original_filename": file.filename,
        "url": f"/uploads/{unique_filename}",
        "url_thumbnail": variants.get("thumbnail", {}).get("url"),
        "url_medium": variants.get("medium", {}).get("url"),
        "width": variants.get("original", {}).get("width"),
        "height": variants.get("original", {}).get("height"),
        "variants": variants,
        "alt_text": Path(file.filename).stem,
        "title": Path(file.filename).stem,
        "file_size": file_size,
        "content_type": file.content_type,
        "tags": [],
        "uploaded_by": user.get("email", "unknown"),
        "created_at": now,
        "deleted_at": None,
    }
    db = get_db()
    await db.media_library.insert_one(doc)

    return ok_envelope({
        "id": media_id,
        "url": doc["url"],
        "url_thumbnail": doc["url_thumbnail"],
        "url_medium": doc["url_medium"],
        "filename": unique_filename,
        "original_filename": file.filename,
        "file_size": file_size,
        "variants": variants,
    })


@router.post("/media/bulk")
async def upload_media_bulk(
    files: List[UploadFile] = File(...),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Bulk upload multiple images to media library."""
    results = []
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            results.append({"filename": file.filename, "error": "Invalid file type"})
            continue
        content = await file.read()
        if len(content) > MAX_SIZE_BYTES:
            results.append({"filename": file.filename, "error": "File too large"})
            continue
        stem = str(uuid.uuid4())
        ext = Path(file.filename).suffix
        fname = f"{stem}{ext}"
        fpath = UPLOAD_DIR / fname
        with open(fpath, "wb") as f:
            f.write(content)
        loop = asyncio.get_event_loop()
        variants = await loop.run_in_executor(None, _process_image_variants, content, stem)
        now = NOW()
        media_id = str(uuid.uuid4())
        doc = {
            "id": media_id, "filename": fname, "original_filename": file.filename,
            "url": f"/uploads/{fname}",
            "url_thumbnail": variants.get("thumbnail", {}).get("url"),
            "url_medium": variants.get("medium", {}).get("url"),
            "variants": variants,
            "alt_text": Path(file.filename).stem, "title": Path(file.filename).stem,
            "file_size": len(content), "content_type": file.content_type,
            "tags": [], "uploaded_by": user.get("email", "unknown"),
            "created_at": now, "deleted_at": None,
        }
        db = get_db()
        await db.media_library.insert_one(doc)
        results.append({"id": media_id, "filename": fname, "original_filename": file.filename, "url": doc["url"]})
    return ok_envelope({"uploaded": len([r for r in results if "error" not in r]), "results": results})


@router.put("/media/{media_id}")
async def update_media_metadata(
    media_id: str,
    payload: dict,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Update media metadata."""
    db = get_db()
    item = await db.media_library.find_one({"id": media_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Media tidak ditemukan")
    allowed = {"title", "alt_text", "tags"}
    update_data = {k: v for k, v in payload.items() if k in allowed}
    if update_data:
        await db.media_library.update_one({"id": media_id}, {"$set": update_data})
    return ok_envelope({"message": "Media updated"})


@router.delete("/media/{media_id}")
async def delete_media(
    media_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Soft delete media library item."""
    db = get_db()
    item = await db.media_library.find_one({"id": media_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Media tidak ditemukan")
    await db.media_library.update_one({"id": media_id}, {"$set": {"deleted_at": NOW()}})
    return ok_envelope({"message": "Media deleted"})
