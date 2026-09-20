"""Public file serving from Emergent Object Storage (images/PDFs used by CMS, menu, loyalty)."""
import requests
from fastapi import APIRouter, Response

from core.exceptions import NotFoundError
from core.object_storage import APP_NAME, get_object

router = APIRouter(prefix="/api/files", tags=["files"])

_PUBLIC_PREFIXES = (f"{APP_NAME}/public/",)


@router.get("/{path:path}")
async def serve_public_file(path: str):
    """Serve public assets (menu images/PDFs, CMS media, reward images)."""
    if ".." in path or not path.startswith(_PUBLIC_PREFIXES):
        raise NotFoundError("File")
    try:
        data, content_type = await get_object(path)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            raise NotFoundError("File")
        raise
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"})
