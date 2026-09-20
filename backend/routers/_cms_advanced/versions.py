"""Content versioning endpoints (list / get / restore)."""
from fastapi import APIRouter, Depends, Query

from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError, ValidationError
from core.security import require_perm

from routers._cms_advanced._common import (
    CONTENT_COLLECTION_MAP, NOW,
    _serialize_doc, create_version_snapshot,
)

router = APIRouter()


@router.get("/{content_type}/{item_id}/versions")
async def list_versions(
    content_type: str,
    item_id: str,
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """List version history for a CMS item."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}. Valid: {list(CONTENT_COLLECTION_MAP.keys())}")
    db = get_db()
    versions = await db.content_versions.find(
        {"content_type": content_type, "item_id": item_id},
        {"_id": 0, "data": 0},
        sort=[("version_num", -1)],
        limit=limit,
    ).to_list(length=limit)
    return ok_envelope([_serialize_doc(v) for v in versions])


@router.get("/{content_type}/{item_id}/versions/{version_num}")
async def get_version_detail(
    content_type: str,
    item_id: str,
    version_num: int,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Get full snapshot data for a specific version."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}")
    db = get_db()
    version = await db.content_versions.find_one(
        {"content_type": content_type, "item_id": item_id, "version_num": version_num},
        {"_id": 0},
    )
    if not version:
        raise NotFoundError("Version tidak ditemukan")
    return ok_envelope(_serialize_doc(version))


@router.post("/{content_type}/{item_id}/versions/{version_num}/restore")
async def restore_version(
    content_type: str,
    item_id: str,
    version_num: int,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Restore a CMS item to a previous version snapshot."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}")
    db = get_db()
    collection_name = CONTENT_COLLECTION_MAP[content_type]
    version = await db.content_versions.find_one(
        {"content_type": content_type, "item_id": item_id, "version_num": version_num},
    )
    if not version:
        raise NotFoundError("Version tidak ditemukan")
    collection = getattr(db, collection_name)
    current = await collection.find_one({"id": item_id, "deleted_at": None})
    if not current:
        raise NotFoundError("Item tidak ditemukan")
    await create_version_snapshot(
        content_type=content_type, item_id=item_id,
        data={k: v for k, v in current.items() if k != "_id"},
        saved_by=user.get("email", "system"),
    )
    restore_data = {k: v for k, v in version["data"].items() if k not in ("_id", "id", "created_at")}
    restore_data["updated_at"] = NOW()
    await collection.update_one({"id": item_id}, {"$set": restore_data})
    return ok_envelope({"message": f"Restored to version {version_num}", "restored_version": version_num})
