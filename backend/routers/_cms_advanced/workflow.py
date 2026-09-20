"""Approval workflow endpoints (submit / approve / reject / pending / history)."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.db import get_db
from core.exceptions import ok_envelope, NotFoundError, ValidationError
from core.security import require_perm

from routers._cms_advanced._common import (
    CONTENT_COLLECTION_MAP, NOW,
    _serialize_doc, _append_workflow_history,
)

router = APIRouter()


@router.get("/pending-reviews")
async def list_pending_reviews(
    content_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """List all CMS items awaiting review across all content types."""
    db = get_db()
    results = []

    types_to_check = [content_type] if content_type else list(CONTENT_COLLECTION_MAP.keys())
    for ct in types_to_check:
        coll_name = CONTENT_COLLECTION_MAP.get(ct)
        if not coll_name:
            continue
        coll = getattr(db, coll_name)
        docs = await coll.find(
            {"deleted_at": None, "workflow_status": "pending_review"},
            {"_id": 0},
        ).sort("updated_at", 1).to_list(length=100)
        for doc in docs:
            doc["_content_type"] = ct
            results.append(_serialize_doc(doc))

    total = len(results)
    start = (page - 1) * page_size
    paginated = results[start:start + page_size]
    return ok_envelope({"items": paginated, "total": total, "page": page, "page_size": page_size})


@router.post("/{content_type}/{item_id}/submit-for-review")
async def submit_for_review(
    content_type: str,
    item_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Submit a CMS item for review (changes workflow_status to pending_review)."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}")
    db = get_db()
    coll = getattr(db, CONTENT_COLLECTION_MAP[content_type])
    item = await coll.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Item tidak ditemukan")

    old_status = item.get("workflow_status", "draft")
    if old_status == "pending_review":
        raise ValidationError("Item sudah dalam antrian review")

    actor = user.get("email", "unknown")
    await coll.update_one(
        {"id": item_id},
        {"$set": {"workflow_status": "pending_review", "submitted_by": actor, "submitted_at": NOW(), "updated_at": NOW()}},
    )
    await _append_workflow_history(db, content_type, item_id, old_status, "pending_review", actor, "Submitted for review")
    return ok_envelope({"workflow_status": "pending_review", "message": "Berhasil dikirim untuk review"})


@router.post("/{content_type}/{item_id}/approve")
async def approve_content(
    content_type: str,
    item_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Approve a CMS item and publish it."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}")
    db = get_db()
    coll = getattr(db, CONTENT_COLLECTION_MAP[content_type])
    item = await coll.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Item tidak ditemukan")

    old_status = item.get("workflow_status", "draft")
    actor = user.get("email", "unknown")
    comment = payload.get("comment", "Approved")

    await coll.update_one(
        {"id": item_id},
        {"$set": {
            "workflow_status": "published",
            "status": "published",
            "reviewed_by": actor,
            "reviewed_at": NOW(),
            "review_comment": comment,
            "published_by": actor,
            "updated_at": NOW(),
        }},
    )
    await _append_workflow_history(db, content_type, item_id, old_status, "published", actor, comment or "Approved and published")
    return ok_envelope({"workflow_status": "published", "status": "published", "message": "Konten disetujui dan dipublish"})


@router.post("/{content_type}/{item_id}/reject")
async def reject_content(
    content_type: str,
    item_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Reject a CMS item with a comment. Returns to draft state."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}")
    db = get_db()
    coll = getattr(db, CONTENT_COLLECTION_MAP[content_type])
    item = await coll.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Item tidak ditemukan")

    old_status = item.get("workflow_status", "pending_review")
    actor = user.get("email", "unknown")
    comment = payload.get("comment", "Rejected")

    await coll.update_one(
        {"id": item_id},
        {"$set": {
            "workflow_status": "rejected",
            "reviewed_by": actor,
            "reviewed_at": NOW(),
            "review_comment": comment,
            "updated_at": NOW(),
        }},
    )
    await _append_workflow_history(db, content_type, item_id, old_status, "rejected", actor, comment)
    return ok_envelope({"workflow_status": "rejected", "message": "Konten ditolak"})


@router.get("/{content_type}/{item_id}/workflow-history")
async def get_workflow_history(
    content_type: str,
    item_id: str,
    user: dict = Depends(require_perm("admin", "cms")),
):
    """Get workflow history for a CMS item."""
    if content_type not in CONTENT_COLLECTION_MAP:
        raise ValidationError(f"Invalid content type: {content_type}")
    db = get_db()
    docs = await db.cms_workflow_history.find(
        {"content_type": content_type, "item_id": item_id},
        {"_id": 0},
        sort=[("created_at", -1)],
    ).to_list(length=50)
    return ok_envelope([_serialize_doc(d) for d in docs])
