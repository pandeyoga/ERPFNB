"""Notifications: resolve eligible approvers, push approval/creator notifs."""
import logging
from typing import Optional

from core.db import get_db

from services import notification_service
from services._approval.constants import (
    ENTITY_LABELS,
    ENTITY_LINK_BUILDERS,
)
from services._approval.evaluator import evaluate

logger = logging.getLogger("aurora.approval")


def _entity_label(entity_type: str) -> str:
    return ENTITY_LABELS.get(entity_type, entity_type.replace("_", " ").title())


def _entity_link(entity_type: str, entity_id: str) -> str:
    builder = ENTITY_LINK_BUILDERS.get(entity_type)
    return builder(entity_id) if builder else f"/{entity_type}/{entity_id}"


def _doc_descriptor(entity_type: str, entity: dict) -> str:
    """Short human-readable doc title for notifications."""
    doc_no = entity.get("doc_no")
    base = f"{_entity_label(entity_type)} {doc_no or entity.get('id', '')[:8]}"
    return base


async def _resolve_eligible_approvers(
    step: dict, *,
    outlet_id: Optional[str] = None,
) -> list[dict]:
    """Find active users eligible for the given step (any matching mode)."""
    db = get_db()
    mode = step.get("match_mode") or "permission"

    candidates: list[dict] = []

    if mode == "user":
        user_ids = step.get("any_of_user_ids") or []
        if not user_ids:
            return []
        async for u in db.users.find(
            {"id": {"$in": user_ids}, "deleted_at": None, "status": "active"},
            {"id": 1, "full_name": 1, "outlet_ids": 1},
        ):
            candidates.append(u)

    elif mode == "role":
        role_ids = step.get("any_of_role_ids") or []
        if not role_ids:
            return []
        async for u in db.users.find(
            {"role_ids": {"$in": role_ids}, "deleted_at": None, "status": "active"},
            {"id": 1, "full_name": 1, "outlet_ids": 1},
        ):
            candidates.append(u)

    else:
        # Legacy permission mode
        any_of_perms = step.get("any_of_perms") or []
        if not any_of_perms:
            return []
        # 1) roles that grant any of the required perms (or "*" superuser)
        role_query = {
            "$or": [
                {"permissions": {"$in": any_of_perms}},
                {"permissions": "*"},
            ],
        }
        role_ids = []
        async for r in db.roles.find(role_query, {"id": 1}):
            role_ids.append(r["id"])
        if not role_ids:
            return []
        # 2) active users with any of those roles
        async for u in db.users.find(
            {
                "deleted_at": None, "status": "active",
                "role_ids": {"$in": role_ids},
            },
            {"id": 1, "full_name": 1, "outlet_ids": 1},
        ):
            candidates.append(u)

    # Outlet scoping
    if outlet_id:
        scoped = [u for u in candidates if outlet_id in (u.get("outlet_ids") or [])]
        if scoped:
            return scoped
    return candidates


async def _push_approval_notif(*, user_id: str, type_: str, title: str, body: str | None,
                                entity_type: str, entity_id: str, link: str) -> None:
    try:
        await notification_service.push(
            user_id=user_id, type=type_, title=title, body=body,
            link=link, source_type=entity_type, source_id=entity_id,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Failed to push approval notification: {e}")


async def notify_pending_approvers(entity_type: str, entity: dict, *, state: dict | None = None,
                                    triggered_by: Optional[dict] = None) -> int:
    """Notify all eligible users for the current step that an item awaits their approval."""
    if not state:
        state = await evaluate(entity_type, entity)
    if not state.get("has_workflow") or state.get("is_complete") or state.get("is_rejected"):
        return 0
    step_idx = state.get("current_step_idx")
    if step_idx is None:
        return 0
    step = (state.get("steps") or [])[step_idx]
    outlet_id = entity.get("outlet_id")
    approvers = await _resolve_eligible_approvers(step, outlet_id=outlet_id)
    title = f"Approval needed: {_doc_descriptor(entity_type, entity)}"
    body_parts = [step.get("label") or f"Step {step_idx + 1}"]
    if state.get("amount"):
        body_parts.append(f"Rp {float(state['amount']):,.0f}".replace(",", "."))
    if triggered_by and triggered_by.get("full_name"):
        body_parts.append(f"oleh {triggered_by['full_name']}")
    body = " · ".join(body_parts)
    link = _entity_link(entity_type, entity.get("id"))
    sent = 0
    for u in approvers:
        # Don't notify the user that just acted
        if triggered_by and u.get("id") == triggered_by.get("id"):
            continue
        await _push_approval_notif(
            user_id=u["id"], type_="warn", title=title, body=body,
            entity_type=entity_type, entity_id=entity.get("id"), link=link,
        )
        sent += 1
    return sent


async def notify_creator(entity_type: str, entity: dict, *, kind: str,
                          actor: Optional[dict] = None, reason: Optional[str] = None) -> bool:
    """kind: 'approved' | 'rejected'. Notifies entity.created_by if any."""
    creator_id = entity.get("created_by")
    if not creator_id:
        return False
    if actor and actor.get("id") == creator_id:
        return False
    title_pref = "Approved" if kind == "approved" else "Rejected"
    title = f"{title_pref}: {_doc_descriptor(entity_type, entity)}"
    body = reason if kind == "rejected" else (
        f"Disetujui oleh {actor.get('full_name')}" if actor and actor.get("full_name") else "Approval selesai"
    )
    type_ = "done" if kind == "approved" else "urgent"
    link = _entity_link(entity_type, entity.get("id"))
    await _push_approval_notif(
        user_id=creator_id, type_=type_, title=title, body=body,
        entity_type=entity_type, entity_id=entity.get("id"), link=link,
    )
    return True
