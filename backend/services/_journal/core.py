"""_journal/core.py — core journal operations (reverse)."""
from datetime import datetime, timezone

from core.db import get_db
from core.exceptions import ValidationError
from services._journal._common import _post_journal


async def reverse_journal(je_id: str, *, user_id: str, reason: str) -> dict:
    db = get_db()
    orig = await db.journal_entries.find_one({"id": je_id, "deleted_at": None})
    if not orig:
        raise ValidationError("Journal entry tidak ditemukan")
    if orig["status"] != "posted":
        raise ValidationError("Hanya JE posted yang dapat direverse")
    # Generate reversal
    reversed_lines = [
        {**ln, "dr": ln.get("cr", 0), "cr": ln.get("dr", 0)} for ln in orig["lines"]
    ]
    rev = await _post_journal(
        entry_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        description=f"Reversal of {orig['doc_no']}: {reason}",
        source_type="reversal",
        source_id=orig["id"],
        lines=reversed_lines,
        user_id=user_id,
    )
    await db.journal_entries.update_one(
        {"id": je_id}, {"$set": {"status": "reversed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.journal_entries.update_one(
        {"id": rev["id"]}, {"$set": {"reversal_of": je_id}}
    )
    return rev
