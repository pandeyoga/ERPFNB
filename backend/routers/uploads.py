"""/api/uploads router — Phase 8B file upload service."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse

from core.exceptions import ok_envelope
from core.security import current_user
from services import upload_service

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    category: Optional[str] = Form(None),
    source_type: Optional[str] = Form(None),
    source_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    user: dict = Depends(current_user),
):
    data = await file.read()
    saved = await upload_service.save_upload(
        file_bytes=data,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        user=user,
        category=category,
        source_type=source_type,
        source_id=source_id,
        description=description,
    )
    return ok_envelope(saved)


@router.get("/list")
async def list_uploads(
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(current_user),
):
    items, meta = await upload_service.list_attachments(
        source_type=source_type, source_id=source_id,
        category=category, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/{file_id}/meta")
async def get_meta(file_id: str, user: dict = Depends(current_user)):
    return ok_envelope(await upload_service.get_attachment(file_id, user=user))


@router.post("/{file_id}/link")
async def link(file_id: str, source_type: str = Form(...), source_id: str = Form(...),
               user: dict = Depends(current_user)):
    return ok_envelope(await upload_service.link_attachment(
        file_id, source_type=source_type, source_id=source_id, user=user,
    ))


@router.delete("/{file_id}")
async def delete_file(file_id: str, user: dict = Depends(current_user)):
    return ok_envelope(await upload_service.delete_attachment(file_id, user=user))


@router.get("/{file_id}")
async def serve_file(file_id: str, user: dict = Depends(current_user)):
    """Stream the file from disk with proper Content-Type.

    Auth gate is current_user; the file_id is a UUID (unguessable). For tighter
    scope checks, callers should reference attachments via meta endpoint and
    link them via source_type/source_id where applicable.
    """
    meta = await upload_service.get_attachment(file_id, user=user)
    path = await upload_service.get_attachment_path(file_id, user=user)
    return FileResponse(
        str(path),
        media_type=meta.get("content_type", "application/octet-stream"),
        filename=meta.get("filename"),
    )
