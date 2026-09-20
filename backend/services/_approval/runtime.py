"""Runtime: approve / reject + DB helpers for approval engine."""
import logging
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ForbiddenError, NotFoundError, ValidationError
from core.security import get_user_permissions

from services._approval.constants import (
    ENTITY_COLLECTIONS,
    ENTITY_STATUS_FIELD,
    _now,
)
from services._approval.evaluator import evaluate
from services._approval.notifications import (
    notify_creator,
    notify_pending_approvers,
)
from services._approval.permissions import (
    _user_has_any_perm,
    _user_matches_step,
)

logger = logging.getLogger("aurora.approval")


def _collection_for(entity_type: str) -> str:
    col = ENTITY_COLLECTIONS.get(entity_type)
    if not col:
        raise ValidationError(f"Tipe entity tidak didukung: {entity_type}")
    return col


async def _get_entity(entity_type: str, entity_id: str) -> dict:
    db = get_db()
    col = _collection_for(entity_type)
    doc = await db[col].find_one({"id": entity_id, "deleted_at": None})
    if not doc:
        raise NotFoundError(f"{entity_type} tidak ditemukan")
    return serialize(doc)


async def approve(
    entity_type: str, entity_id: str, *, user: dict, note: Optional[str] = None,
) -> dict:
    """Append a step approval; advance status to approved when all steps are done."""
    db = get_db()
    col = _collection_for(entity_type)
    entity = await _get_entity(entity_type, entity_id)

    # Status must be approvable: submitted | awaiting_approval | draft (for some)
    cur_status = entity.get(ENTITY_STATUS_FIELD.get(entity_type, "status"))
    if cur_status not in ("submitted", "awaiting_approval", "draft"):
        raise ValidationError(f"Status saat ini tidak dapat di-approve: {cur_status}")

    state = await evaluate(entity_type, entity)
    if state["is_rejected"]:
        raise ValidationError("Entity sudah ditolak")
    if state["is_complete"]:
        raise ValidationError("Approval sudah selesai")
    step_idx = state["current_step_idx"]
    if step_idx is None:
        raise ValidationError("Tidak ada step approval yang dibutuhkan")
    step = (state["steps"] or [])[step_idx]
    required = step.get("any_of_perms") or []
    mode = step.get("match_mode") or "permission"

    if not await _user_matches_step(user, step, entity_type=entity_type):
        if mode == "user":
            users_required = step.get("any_of_user_ids") or []
            msg = (f"Step '{step.get('label')}' hanya bisa di-approve oleh user spesifik "
                   f"({len(users_required)} user). Anda bukan salah satunya.")
        elif mode == "role":
            roles_required = step.get("any_of_role_ids") or []
            msg = (f"Step '{step.get('label')}' memerlukan role spesifik "
                   f"({len(roles_required)} role). Role Anda tidak match.")
        else:
            msg = (f"Anda tidak memiliki permission untuk step '{step.get('label')}'. "
                   f"Diperlukan salah satu: {', '.join(required) or '(tidak terdefinisi)'}")
        raise ForbiddenError(msg, code="APPROVAL_PERM_MISSING")

    chain = entity.get("approval_chain") or []
    user_perms = await get_user_permissions(user)
    if "*" in user_perms:
        matched = "*"
    elif mode == "user":
        matched = f"user:{user['id']}"
    elif mode == "role":
        user_roles = set(user.get("role_ids") or [])
        rids = step.get("any_of_role_ids") or []
        match_rid = next((r for r in rids if r in user_roles), None)
        matched = f"role:{match_rid}" if match_rid else "role"
    else:
        matched = next((p for p in required if p in user_perms), None)
    chain.append({
        "level": len(chain) + 1,
        "step_idx": step_idx,
        "step_label": step.get("label"),
        "action": "approved",
        "approver_id": user["id"],
        "approver_name": user.get("full_name"),
        "matched_perm": matched,
        "at": _now(),
        "note": note,
    })

    # Re-evaluate after appending
    new_state = await evaluate(entity_type, {**entity, "approval_chain": chain})
    final_status = "approved" if new_state["is_complete"] else "awaiting_approval"

    update = {
        "approval_chain": chain,
        ENTITY_STATUS_FIELD.get(entity_type, "status"): final_status,
        "updated_at": _now(),
    }
    if final_status == "approved":
        update["approved_at"] = _now()

    await db[col].update_one({"id": entity_id}, {"$set": update})
    await audit_log(
        user_id=user["id"], entity_type=entity_type, entity_id=entity_id,
        action="approve_step", reason=note,
    )

    after = await db[col].find_one({"id": entity_id})
    after_serialized = serialize(after)
    new_eval = await evaluate(entity_type, after_serialized)

    # ---- Notifications ----
    try:
        if new_state["is_complete"]:
            # Final approval → notify creator
            await notify_creator(entity_type, after_serialized, kind="approved", actor=user)
        else:
            # Intermediate → notify next-step approvers
            await notify_pending_approvers(entity_type, after_serialized, state=new_eval, triggered_by=user)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Approval notification dispatch failed: {e}")

    return {
        "entity": after_serialized,
        "state": new_eval,
        "completed": new_state["is_complete"],
    }


async def reject(
    entity_type: str, entity_id: str, *, user: dict, reason: str,
) -> dict:
    if not reason or not reason.strip():
        raise ValidationError("Alasan reject wajib")
    db = get_db()
    col = _collection_for(entity_type)
    entity = await _get_entity(entity_type, entity_id)

    cur_status = entity.get(ENTITY_STATUS_FIELD.get(entity_type, "status"))
    if cur_status not in ("submitted", "awaiting_approval", "draft"):
        raise ValidationError(f"Status saat ini tidak dapat di-reject: {cur_status}")

    state = await evaluate(entity_type, entity)
    step_idx = state["current_step_idx"] if state["current_step_idx"] is not None else 0
    steps = state["steps"] or []
    step = steps[step_idx] if 0 <= step_idx < len(steps) else {"label": "Reject", "any_of_perms": []}
    required = step.get("any_of_perms") or []
    if not await _user_has_any_perm(user, required, entity_type=entity_type):
        raise ForbiddenError(
            f"Anda tidak memiliki permission untuk reject di step '{step.get('label')}'. "
            f"Diperlukan salah satu: {', '.join(required) or '(tidak terdefinisi)'}",
            code="APPROVAL_PERM_MISSING",
        )

    chain = entity.get("approval_chain") or []
    chain.append({
        "level": len(chain) + 1,
        "step_idx": step_idx,
        "step_label": step.get("label"),
        "action": "rejected",
        "approver_id": user["id"],
        "approver_name": user.get("full_name"),
        "at": _now(),
        "note": reason,
    })

    update = {
        "approval_chain": chain,
        ENTITY_STATUS_FIELD.get(entity_type, "status"): "rejected",
        "rejected_reason": reason,
        "updated_at": _now(),
    }
    await db[col].update_one({"id": entity_id}, {"$set": update})
    await audit_log(
        user_id=user["id"], entity_type=entity_type, entity_id=entity_id,
        action="reject_step", reason=reason,
    )

    after = await db[col].find_one({"id": entity_id})
    after_serialized = serialize(after)

    # ---- Notification ----
    try:
        await notify_creator(entity_type, after_serialized, kind="rejected", actor=user, reason=reason)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Reject notification dispatch failed: {e}")

    return {
        "entity": after_serialized,
        "state": await evaluate(entity_type, after_serialized),
    }
