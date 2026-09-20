"""Admin CMS sub-router: image upload + schedule + jobs.

Auto-extracted from former monolithic admin_cms.py.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone
from pathlib import Path

from core.db import get_db
from core.exceptions import ok_envelope, ValidationError
from core.security import require_perm

from routers._admin_cms._common import (
    UPLOAD_DIR,
    ALLOWED_TYPES,
    MAX_SIZE_MB,
    MAX_SIZE_BYTES,
)

router = APIRouter()


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """
    Upload an image file for CMS content.
    
    Returns:
        {
            "url": "/uploads/filename.jpg",
            "filename": "original.jpg",
            "content_type": "image/jpeg",
            "size": 12345
        }
    """
    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise ValidationError(
            f"Invalid file type: {file.content_type}. "
            f"Allowed types: {', '.join(ALLOWED_TYPES)}"
        )
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Validate file size
    if file_size > MAX_SIZE_BYTES:
        raise ValidationError(
            f"File too large: {file_size / 1024 / 1024:.2f}MB. "
            f"Maximum allowed: {MAX_SIZE_MB}MB"
        )
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Return file info
    return ok_envelope({
        "url": f"/uploads/{unique_filename}",
        "filename": file.filename,
        "content_type": file.content_type,
        "size": file_size,
    })


@router.delete("/delete-image")
async def delete_image(
    filename: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """
    Delete an uploaded image file.
    
    Args:
        filename: Filename to delete (e.g., "abc-123.jpg")
    """
    # Security: ensure filename doesn't contain path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise ValidationError("Invalid filename")
    
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise ValidationError("File not found")
    
    try:
        file_path.unlink()
        return ok_envelope({"message": "File deleted successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@router.post("/schedule/trigger")
async def trigger_cms_schedule_publish(
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Manually trigger the CMS auto-publish/unpublish job (for testing / on-demand)."""
    from services.scheduler_service import job_cms_schedule_publish
    result = await job_cms_schedule_publish()
    return ok_envelope(result)


# ─── Sprint Compro-Next: Careers/Jobs CMS ─────────────────────────────────────
class JobListingCreate(BaseModel):
    title: str
    department: str
    location: str
    job_type: str = "Full-time"  # Full-time | Part-time | Contract | Internship
    description: str
    requirements: str = ""
    application_email: str = ""
    brand: str = ""
    is_active: bool = True


class JobListingUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    application_email: Optional[str] = None
    brand: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/jobs")
async def list_job_listings(
    department: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """List all job listings (admin view, includes inactive)."""
    db = get_db()
    query: dict = {}
    if department:
        query["department"] = department
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"department": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.job_listings.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    jobs = await cursor.to_list(length=limit)
    total = await db.job_listings.count_documents(query)
    return ok_envelope({"items": jobs, "total": total})


@router.post("/jobs", status_code=201)
async def create_job_listing(
    payload: JobListingCreate,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Create a new job listing."""
    db = get_db()
    now = datetime.now(timezone.utc)
    job = {
        "id": str(uuid.uuid4()),
        **payload.dict(),
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("id"),
    }
    await db.job_listings.insert_one(job)
    job.pop("_id", None)
    return ok_envelope(job)


@router.put("/jobs/{job_id}")
async def update_job_listing(
    job_id: str,
    payload: JobListingUpdate,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Update an existing job listing."""
    db = get_db()
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    if not update_data:
        existing = await db.job_listings.find_one({"id": job_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Job listing not found")
        return ok_envelope(existing)
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.job_listings.find_one_and_update(
        {"id": job_id},
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Job listing not found")
    return ok_envelope(result)


@router.delete("/jobs/{job_id}")
async def delete_job_listing(
    job_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Soft-delete (deactivate) a job listing."""
    db = get_db()
    result = await db.job_listings.find_one_and_update(
        {"id": job_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Job listing not found")
    return ok_envelope({"success": True, "id": job_id})
