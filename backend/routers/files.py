"""Serve public assets stored in object storage (CMS/menu/loyalty images & PDFs)."""
from fastapi import APIRouter
from fastapi.responses import Response

from core.db import get_db
from core.exceptions import NotFoundError
from core.object_storage import PUBLIC_PREFIX, get_object

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{path:path}")
async def serve_public_file(path: str):
    if not path.startswith(PUBLIC_PREFIX):
        raise NotFoundError("File")
    rec = await get_db().files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise NotFoundError("File")
    data, ct = await get_object(path)
    return Response(content=data, media_type=rec.get("content_type") or ct,
                    headers={"Cache-Control": "public, max-age=86400"})
