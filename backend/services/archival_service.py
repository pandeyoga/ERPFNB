"""Data archival service (Phase 10).

Moves stale documents from active collections into *_archive collections,
then deletes them from the source. Supports a dry-run / stats mode.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.db import get_db

# Default retention windows (days). Override via env.
DEFAULTS = {
    "audit_log": int(os.environ.get("RETENTION_AUDIT_LOG_DAYS", "180")),
    "notifications": int(os.environ.get("RETENTION_NOTIFICATIONS_DAYS", "90")),
    "log_entries": int(os.environ.get("RETENTION_LOG_ENTRIES_DAYS", "30")),
    "scheduler_runs": int(os.environ.get("RETENTION_SCHEDULER_RUNS_DAYS", "60")),
    "ai_qa_sessions": int(os.environ.get("RETENTION_AI_QA_SESSIONS_DAYS", "30")),
    "ocr_receipt_cache": int(os.environ.get("RETENTION_OCR_CACHE_DAYS", "60")),
}

# Field used to determine "age" of a doc per collection.
AGE_FIELDS = {
    "audit_log": "timestamp",
    "notifications": "created_at",
    "log_entries": "ts",
    "scheduler_runs": "started_at",
    "ai_qa_sessions": "updated_at",
    "ocr_receipt_cache": "updated_at",
}


def _cutoff_iso(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def stats(retention_overrides: Optional[dict] = None) -> dict:
    """How many docs would be archived per collection (dry-run)."""
    db = get_db()
    overrides = retention_overrides or {}
    out: dict[str, dict] = {}
    for coll, default_days in DEFAULTS.items():
        days = int(overrides.get(coll, default_days))
        cutoff = _cutoff_iso(days)
        age_field = AGE_FIELDS.get(coll, "created_at")
        try:
            total = await db[coll].estimated_document_count()
        except Exception:  # noqa: BLE001
            total = -1
        try:
            eligible = await db[coll].count_documents({age_field: {"$lt": cutoff}})
        except Exception:  # noqa: BLE001
            eligible = -1
        try:
            archived_total = await db[f"{coll}_archive"].estimated_document_count()
        except Exception:  # noqa: BLE001
            archived_total = 0
        out[coll] = {
            "retention_days": days,
            "age_field": age_field,
            "cutoff": cutoff,
            "total": total,
            "eligible_for_archive": eligible,
            "already_archived": archived_total,
        }
    return out


async def run_archival(
    *,
    retention_overrides: Optional[dict] = None,
    batch_size: int = 1000,
    dry_run: bool = False,
) -> dict:
    """Archive stale docs.

    For each collection, find docs older than cutoff, copy into <coll>_archive,
    then delete from source. Stops per-collection at batch_size for safety.
    """
    db = get_db()
    overrides = retention_overrides or {}
    summary: dict[str, dict] = {}
    for coll, default_days in DEFAULTS.items():
        days = int(overrides.get(coll, default_days))
        age_field = AGE_FIELDS.get(coll, "created_at")
        cutoff = _cutoff_iso(days)
        q = {age_field: {"$lt": cutoff}}
        archived = 0
        deleted = 0
        if dry_run:
            try:
                archived = await db[coll].count_documents(q)
            except Exception:  # noqa: BLE001
                archived = -1
            summary[coll] = {"dry_run": True, "would_archive": archived,
                              "retention_days": days, "cutoff": cutoff}
            continue
        # Pull batch
        cur = db[coll].find(q).limit(batch_size)
        batch = [d async for d in cur]
        if not batch:
            summary[coll] = {"archived": 0, "deleted": 0,
                              "retention_days": days, "cutoff": cutoff}
            continue
        ids = [d.get("_id") for d in batch if d.get("_id") is not None]
        # Strip _id (Mongo will create new) before archive insert
        for d in batch:
            d.pop("_id", None)
        try:
            await db[f"{coll}_archive"].insert_many(batch, ordered=False)
            archived = len(batch)
        except Exception:  # noqa: BLE001
            archived = 0
        if archived and ids:
            res = await db[coll].delete_many({"_id": {"$in": ids}})
            deleted = res.deleted_count
        summary[coll] = {
            "archived": archived,
            "deleted": deleted,
            "retention_days": days,
            "cutoff": cutoff,
        }
    return {"summary": summary, "finished_at": datetime.now(timezone.utc).isoformat()}
