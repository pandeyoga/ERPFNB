"""Budget approval workflow operations."""
from __future__ import annotations

from typing import Optional

from core.db import get_db, serialize as _ser

from services._budget._common import _now
from services._budget.crud import get_budget


async def submit_for_approval(budget_id: str, *, user_id: str) -> Optional[dict]:
    """Draft → Submitted. Wire to configurable approval engine."""
    db = get_db()
    doc = await db.budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        raise ValueError("Budget not found")
    if doc.get("approval_status") != "draft":
        raise ValueError(
            f"Hanya budget berstatus 'draft' yang bisa diajukan. Status saat ini: '{doc.get('approval_status')}'"
        )
    now = _now()
    await db.budgets.update_one(
        {"id": budget_id},
        {"$set": {
            "approval_status": "submitted",
            "submitted_at": now, "submitted_by": user_id,
            "approval_chain": [],
            "updated_at": now, "updated_by": user_id,
        }},
    )
    entity = await get_budget(budget_id)
    try:
        from services import approval_service as _appsvc
        user_doc = await db.users.find_one({"id": user_id})
        triggered_by = _ser(user_doc) if user_doc else {}
        await _appsvc.notify_pending_approvers("budget", entity, triggered_by=triggered_by)
    except Exception:
        pass
    return entity


async def approve_budget(budget_id: str, *, user_id: str) -> Optional[dict]:
    """Submitted/awaiting_approval → Approved via configurable approval engine."""
    db = get_db()
    doc = await db.budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        raise ValueError("Budget not found")
    if doc.get("approval_status") not in ("submitted", "awaiting_approval"):
        raise ValueError(f"Tidak dapat di-approve saat ini. Status: '{doc.get('approval_status')}'")
    user_doc = await db.users.find_one({"id": user_id})
    from services import approval_service as _appsvc
    user_obj = _ser(user_doc) if user_doc else {"id": user_id}
    await _appsvc.approve("budget", budget_id, user=user_obj)
    return await get_budget(budget_id)


async def reject_budget(budget_id: str, reason: str, *, user_id: str) -> Optional[dict]:
    """Submitted → Rejected via configurable approval engine."""
    db = get_db()
    doc = await db.budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        raise ValueError("Budget not found")
    if doc.get("approval_status") not in ("submitted", "awaiting_approval"):
        raise ValueError("Hanya budget berstatus 'submitted' yang bisa ditolak")
    user_doc = await db.users.find_one({"id": user_id})
    from services import approval_service as _appsvc
    user_obj = _ser(user_doc) if user_doc else {"id": user_id}
    await _appsvc.reject("budget", budget_id, user=user_obj, reason=reason)
    # Reset approval_status to draft so it can be edited+resubmitted
    await db.budgets.update_one(
        {"id": budget_id, "approval_status": "rejected"},
        {"$set": {"approval_status": "draft", "updated_at": _now()}},
    )
    return await get_budget(budget_id)


async def lock_budget(budget_id: str, *, user_id: str) -> Optional[dict]:
    """Approved → Locked. Executive role required."""
    db = get_db()
    doc = await db.budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        raise ValueError("Budget not found")
    if doc.get("approval_status") != "approved":
        raise ValueError("Hanya budget berstatus 'approved' yang bisa di-lock")
    await db.budgets.update_one(
        {"id": budget_id},
        {"$set": {
            "approval_status": "locked",
            "locked_at": _now(),
            "locked_by": user_id,
            "updated_at": _now(),
            "updated_by": user_id,
        }}
    )
    return await get_budget(budget_id)


async def unlock_budget(budget_id: str, *, user_id: str) -> Optional[dict]:
    """Locked → Approved. Admin only."""
    db = get_db()
    await db.budgets.update_one(
        {"id": budget_id},
        {"$set": {
            "approval_status": "approved",
            "locked_at": None,
            "locked_by": None,
            "updated_at": _now(),
            "updated_by": user_id,
        }}
    )
    return await get_budget(budget_id)
