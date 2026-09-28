"""Bulk operations endpoint (publish/unpublish/delete by ids)."""
from fastapi import APIRouter, Body, Depends

from core.db import get_db
from core.exceptions import ok_envelope, ValidationError
from core.security import require_perm

from routers._cms_advanced._common import CONTENT_COLLECTION_MAP, NOW

router = APIRouter()


@router.post("/{content_type}/bulk-action")
async def bulk_action(
    content_type: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Bulk publish/unpublish/delete CMS items."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}")
    action = payload.get("action")  # "publish" | "unpublish" | "delete"
    ids = payload.get("ids", [])
    if not action or not ids:
        raise ValidationError("action and ids required")
    if action not in ("publish", "unpublish", "delete"):
        raise ValidationError("action must be publish/unpublish/delete")

    db = get_db()
    coll = getattr(db, CONTENT_COLLECTION_MAP[content_type])
    results = {"success": [], "failed": []}

    for item_id in ids:
        try:
            if action == "publish":
                await coll.update_one(
                    {"id": item_id, "deleted_at": None},
                    {"$set": {"status": "published", "workflow_status": "published", "updated_at": NOW()}},
                )
            elif action == "unpublish":
                await coll.update_one(
                    {"id": item_id, "deleted_at": None},
                    {"$set": {"status": "draft", "workflow_status": "draft", "updated_at": NOW()}},
                )
            elif action == "delete":
                await coll.update_one(
                    {"id": item_id, "deleted_at": None},
                    {"$set": {"deleted_at": NOW()}},
                )
            results["success"].append(item_id)
        except Exception as e:
            results["failed"].append({"id": item_id, "error": str(e)})

    return ok_envelope(results)
