"""Delegation management for approval engine."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import ForbiddenError, NotFoundError, ValidationError
from core.security import get_user_permissions

from services._approval.constants import _now


async def create_delegation(payload: dict, *, user_id: str) -> dict:
    """Create an approval delegation from current user to another user."""
    db = get_db()
    delegate_id = payload.get("delegate_id")
    if not delegate_id:
        raise ValidationError("delegate_id wajib", field="delegate_id")
    if delegate_id == user_id:
        raise ValidationError("Tidak dapat mendelegasikan ke diri sendiri")
    delegatee = await db.users.find_one({"id": delegate_id, "status": "active", "deleted_at": None})
    if not delegatee:
        raise ValidationError("User tujuan delegasi tidak ditemukan")

    # Deactivate old delegations for same delegator → same delegate
    await db.approval_delegations.update_many(
        {"delegator_id": user_id, "delegate_id": delegate_id, "active": True, "deleted_at": None},
        {"$set": {"active": False, "updated_at": _now()}},
    )
    doc = {
        "id": str(uuid.uuid4()),
        "delegator_id": user_id,
        "delegate_id": delegate_id,
        "delegate_name": delegatee.get("full_name", ""),
        "entity_types": payload.get("entity_types") or [],  # Empty = all entity types
        "reason": payload.get("reason") or "",
        "from_date": payload.get("from_date"),
        "to_date": payload.get("to_date"),
        "active": True,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user_id,
    }
    await db.approval_delegations.insert_one(doc)
    return serialize(doc)


async def list_delegations(*, delegator_id: Optional[str] = None, delegate_id: Optional[str] = None) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None, "active": True}
    if delegator_id:
        q["delegator_id"] = delegator_id
    if delegate_id:
        q["delegate_id"] = delegate_id
    items = await db.approval_delegations.find(q).sort("created_at", -1).to_list(200)
    return [serialize(d) for d in items]


async def revoke_delegation(delegation_id: str, *, user_id: str) -> None:
    db = get_db()
    deleg = await db.approval_delegations.find_one({"id": delegation_id, "deleted_at": None})
    if not deleg:
        raise NotFoundError("Delegation")
    if deleg.get("delegator_id") != user_id:
        raise ForbiddenError("Hanya pembuat delegasi yang dapat mencabut")
    await db.approval_delegations.update_one(
        {"id": delegation_id},
        {"$set": {"active": False, "deleted_at": _now(), "updated_at": _now()}},
    )


async def _check_delegation(user_id: str, any_of_perms: list[str],
                             entity_type: Optional[str] = None) -> bool:
    """Return True if user has an active delegation from someone eligible for any_of_perms."""
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    q: dict = {
        "delegate_id": user_id, "active": True, "deleted_at": None,
    }
    delegations = await db.approval_delegations.find(q).to_list(50)
    # B8 fix: batch-lookup delegator users (was N+1 find_one per delegation)
    delegator_ids = list({deleg["delegator_id"] for deleg in delegations if deleg.get("delegator_id")})
    delegators_raw = await db.users.find(
        {"id": {"$in": delegator_ids}, "deleted_at": None},
    ).to_list(len(delegator_ids) + 1) if delegator_ids else []
    delegators_map = {u["id"]: u for u in delegators_raw}

    for deleg in delegations:
        # Check date range
        fd = deleg.get("from_date")
        td = deleg.get("to_date")
        if fd and today < fd:
            continue
        if td and today > td:
            continue
        # Check entity_type scope
        et_scope = deleg.get("entity_types") or []
        if et_scope and entity_type and entity_type not in et_scope:
            continue
        # Check delegator's perms (B8 fix: use pre-loaded map)
        delegator = delegators_map.get(deleg["delegator_id"])
        if not delegator:
            continue
        delegator_perms = await get_user_permissions(delegator)
        if "*" in delegator_perms or any(p in delegator_perms for p in any_of_perms):
            return True
    return False
