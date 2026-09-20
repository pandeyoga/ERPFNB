"""Saved report definitions (per-user CRUD)."""
import uuid
from typing import Any, Optional

from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError

from services._reports_analytics._common import _now


async def save_report(
    *, user_id: str, name: str, description: Optional[str] = None,
    config: dict[str, Any], saved_id: Optional[str] = None,
    public: bool = False,
) -> dict[str, Any]:
    if not name or not name.strip():
        raise ValidationError("Nama report wajib")
    if not config or not isinstance(config, dict):
        raise ValidationError("Config report wajib")
    db = get_db()
    if saved_id:
        existing = await db.saved_reports.find_one({"id": saved_id, "deleted_at": None})
        if not existing:
            raise NotFoundError("Saved report tidak ditemukan")
        if existing["owner_user_id"] != user_id:
            raise ValidationError("Hanya owner yang boleh edit report ini")
        await db.saved_reports.update_one(
            {"id": saved_id},
            {"$set": {
                "name": name.strip(),
                "description": (description or "").strip() or None,
                "config": config,
                "public": bool(public),
                "updated_at": _now(),
                "updated_by": user_id,
            }},
        )
        return await get_saved(saved_id, user_id=user_id)

    doc = {
        "id": str(uuid.uuid4()),
        "owner_user_id": user_id,
        "name": name.strip(),
        "description": (description or "").strip() or None,
        "config": config,
        "public": bool(public),
        "created_at": _now(), "updated_at": _now(),
        "created_by": user_id, "updated_by": user_id,
        "deleted_at": None,
    }
    await db.saved_reports.insert_one(doc)
    return serialize(doc)


async def list_saved_reports(*, user_id: str) -> list[dict]:
    db = get_db()
    q = {"deleted_at": None, "$or": [{"owner_user_id": user_id}, {"public": True}]}
    items = await db.saved_reports.find(q).sort([("updated_at", -1)]).to_list(500)
    return [serialize(d) for d in items]


async def get_saved(saved_id: str, *, user_id: str) -> dict:
    db = get_db()
    d = await db.saved_reports.find_one({"id": saved_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Saved report tidak ditemukan")
    if d.get("owner_user_id") != user_id and not d.get("public"):
        raise ValidationError("Tidak ada akses ke report ini")
    return serialize(d)


async def delete_saved(saved_id: str, *, user_id: str) -> dict:
    db = get_db()
    d = await db.saved_reports.find_one({"id": saved_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Saved report tidak ditemukan")
    if d.get("owner_user_id") != user_id:
        raise ValidationError("Hanya owner yang boleh hapus")
    await db.saved_reports.update_one(
        {"id": saved_id},
        {"$set": {"deleted_at": _now(), "updated_at": _now(), "updated_by": user_id}},
    )
    return {"id": saved_id, "deleted": True}
