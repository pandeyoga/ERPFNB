"""Shared constants and helper functions for cms_advanced sub-routers."""
import uuid
from datetime import datetime, timezone
from pathlib import Path

from core.db import get_db

# Upload dirs
UPLOAD_DIR = Path("/app/backend/uploads")
THUMBS_DIR = UPLOAD_DIR / "thumbs"
MEDIUM_DIR = UPLOAD_DIR / "medium"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
THUMBS_DIR.mkdir(parents=True, exist_ok=True)
MEDIUM_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 10 * 1024 * 1024

CONTENT_COLLECTION_MAP = {
    "brand": "public_brands",
    "news": "public_news",
    "outlet": "public_outlets",
    "menu": "public_menu_items",
}

WORKFLOW_STATUSES = ["draft", "pending_review", "approved", "rejected", "published"]


def NOW():
    return datetime.now(timezone.utc)


async def create_version_snapshot(content_type, item_id, data, saved_by):
    """Create a version snapshot of a CMS item before it is updated."""
    db = get_db()
    last = await db.content_versions.find_one(
        {"content_type": content_type, "item_id": item_id},
        sort=[("version_num", -1)],
    )
    version_num = (last["version_num"] + 1) if last else 1
    snapshot = {
        "id": str(uuid.uuid4()),
        "content_type": content_type,
        "item_id": item_id,
        "version_num": version_num,
        "data": data,
        "saved_at": NOW(),
        "saved_by": saved_by,
        "change_summary": f"v{version_num} saved by {saved_by}",
    }
    await db.content_versions.insert_one(snapshot)
    return version_num


async def _append_workflow_history(db, content_type, item_id, from_status, to_status, actor, comment=""):
    """Append an entry to cms_workflow_history."""
    await db.cms_workflow_history.insert_one({
        "id": str(uuid.uuid4()),
        "content_type": content_type,
        "item_id": item_id,
        "from_status": from_status,
        "to_status": to_status,
        "actor": actor,
        "comment": comment,
        "created_at": NOW(),
    })


def _serialize_doc(doc):
    """Recursively convert datetime objects to ISO strings."""
    if isinstance(doc, dict):
        return {k: _serialize_doc(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_serialize_doc(i) for i in doc]
    if hasattr(doc, "isoformat"):
        return doc.isoformat()
    return doc
