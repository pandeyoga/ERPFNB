"""Escalation: scheduler hook to find overdue steps and notify escalation targets."""
from datetime import datetime, timezone

from core.db import get_db, serialize

from services._approval.constants import (
    ENTITY_COLLECTIONS,
    ENTITY_STATUS_FIELD,
)
from services._approval.evaluator import evaluate
from services._approval.notifications import (
    _doc_descriptor,
    _entity_link,
    _push_approval_notif,
    _resolve_eligible_approvers,
)


async def check_and_escalate() -> int:
    """Called by scheduler: find steps that exceeded deadline_hours, send escalation notifications.
    Returns number of escalations sent.
    """
    db = get_db()
    escalated = 0
    now = datetime.now(timezone.utc)

    for entity_type, collection in ENTITY_COLLECTIONS.items():
        status_field = ENTITY_STATUS_FIELD.get(entity_type, "status")
        q = {"deleted_at": None, status_field: {"$in": ["submitted", "awaiting_approval"]}}
        async for doc in db[collection].find(q):
            entity = serialize(doc)
            try:
                state = await evaluate(entity_type, entity)
            except Exception:
                continue
            if state.get("is_complete") or state.get("is_rejected"):
                continue
            step_idx = state.get("current_step_idx")
            if step_idx is None:
                continue
            steps = state.get("steps") or []
            if step_idx >= len(steps):
                continue
            step = steps[step_idx]
            deadline_hours = step.get("deadline_hours")
            if not deadline_hours:
                continue
            # Find when this step was started (when entity moved to awaiting_approval or submitted)
            chain = entity.get("approval_chain") or []
            last_action_time = entity.get("submitted_at") or entity.get("updated_at") or entity.get("created_at")
            if chain:
                last_action_time = chain[-1].get("at") or last_action_time
            if not last_action_time:
                continue
            try:
                last_dt = datetime.fromisoformat(last_action_time.replace("Z", "+00:00"))
                if last_dt.tzinfo is None:
                    from datetime import timezone as tz
                    last_dt = last_dt.replace(tzinfo=tz.utc)
                elapsed_hours = (now - last_dt).total_seconds() / 3600
            except Exception:
                continue
            if elapsed_hours < deadline_hours:
                continue
            # Escalate: notify escalate_to_perms OR step approvers again
            escalate_to = step.get("escalate_to_perms") or step.get("any_of_perms") or []
            if escalate_to:
                # Adapt the legacy list-of-perms call to the new step-based API
                approvers = await _resolve_eligible_approvers({"any_of_perms": escalate_to})
                link = _entity_link(entity_type, entity.get("id", ""))
                title = f"[ESKALASI] {_doc_descriptor(entity_type, entity)} — {step.get('label')}"
                body = f"Pending {elapsed_hours:.1f} jam, melebihi batas {deadline_hours} jam"
                for u in approvers:
                    await _push_approval_notif(
                        user_id=u["id"], type_="urgent", title=title, body=body,
                        entity_type=entity_type, entity_id=entity.get("id", ""), link=link,
                    )
                    escalated += 1
    return escalated
