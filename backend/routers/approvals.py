"""/api/approvals router — cross-portal "My Approvals" queue + counts."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.db import get_db, serialize
from core.exceptions import ok_envelope
from core.security import current_user, get_user_permissions
from services import approval_service

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


# Map entity_type → (collection, status filter, doc-no link key)
ENTITY_QUERY_PROFILES = {
    "purchase_request": {
        "collection": "purchase_requests",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "status",
        "amount_label": "Total Estimasi",
        "describe": lambda d: d.get("doc_no") or (d.get("id", "")[:8]),
        "link": lambda d: f"/procurement/prs/{d.get('id')}",
        "secondary": "outlet_id",
    },
    "purchase_order": {
        "collection": "purchase_orders",
        "statuses": ["awaiting_approval"],
        "status_field": "status",
        "amount_label": "Grand Total",
        "describe": lambda d: d.get("doc_no") or (d.get("id", "")[:8]),
        "link": lambda d: f"/procurement/pos/{d.get('id')}",
        "secondary": "vendor_id",
    },
    "stock_adjustment": {
        "collection": "adjustments",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "status",
        "amount_label": "Total Value",
        "describe": lambda d: d.get("doc_no") or (d.get("id", "")[:8]),
        "link": lambda d: f"/inventory/adjustments/{d.get('id')}",
        "secondary": "outlet_id",
    },
    "employee_advance": {
        "collection": "employee_advances",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "status",
        "amount_label": "Principal",
        "describe": lambda d: d.get("doc_no") or f"Kasbon {d.get('employee_name','?')}",
        "link": lambda d: f"/hr/advances/{d.get('id')}",
        "secondary": "employee_id",
    },
    "payment_request": {
        "collection": "payment_requests",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "status",
        "amount_label": "Amount",
        "describe": lambda d: d.get("doc_no") or d.get("title") or (d.get("id", "")[:8]),
        "link": lambda d: f"/finance/payment-requests/{d.get('id')}",
        "secondary": "outlet_id",
    },
    "budget": {
        "collection": "budgets",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "approval_status",
        "amount_label": "Total Anggaran",
        "describe": lambda d: d.get("name") or (d.get("id", "")[:8]),
        "link": lambda _d: "/finance/budget/manage",
        "secondary": "outlet_id",
    },
    "leave_request": {
        "collection": "leave_requests",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "status",
        "amount_label": "Hari",
        "describe": lambda d: d.get("doc_no") or f"Cuti {d.get('employee_name', d.get('employee_id','?'))[:16]} ({d.get('leave_type','')})",
        "link": lambda d: f"/hr/leaves/{d.get('id')}",
        "secondary": "employee_id",
    },
    "stock_transfer": {
        "collection": "stock_transfers",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "status",
        "amount_label": "Total Value",
        "describe": lambda d: d.get("doc_no") or (d.get("id", "")[:8]),
        "link": lambda d: f"/inventory/transfers/{d.get('id')}",
        "secondary": "outlet_id",
    },
    "ar_invoice": {
        "collection": "ar_invoices",
        "statuses": ["submitted", "awaiting_approval"],
        "status_field": "status",
        "amount_label": "Total Invoice",
        "describe": lambda d: d.get("invoice_no") or (d.get("id", "")[:8]),
        "link": lambda d: f"/finance/ar-invoices/{d.get('id')}",
        "secondary": "customer_name",
    },
}


async def _build_queue_for_user(
    user: dict,
    *,
    entity_types: list[str] | None = None,
    min_amount: float | None = None,
    outlet_only: bool = False,
) -> list[dict]:
    """For each requested entity type, find pending items and filter to those
    where the current step required perms intersect the user's perms.

    Optional filters:
      - entity_types: only include these entity types (default = all).
      - min_amount: only include items where amount >= min_amount.
      - outlet_only: if True, restrict to items belonging to user's outlet_ids.
    """
    db = get_db()
    user_perms = await get_user_permissions(user)
    is_super = "*" in user_perms
    user_outlets = list(user.get("outlet_ids") or [])

    types = entity_types or list(ENTITY_QUERY_PROFILES.keys())
    out: list[dict] = []
    for et in types:
        profile = ENTITY_QUERY_PROFILES.get(et)
        if not profile:
            continue
        col = profile["collection"]
        sf = profile.get("status_field", "status")
        q = {"deleted_at": None, sf: {"$in": profile["statuses"]}}
        async for d in db[col].find(q, {"_id": 0}).sort("created_at", -1).limit(500):
            entity = serialize(d)
            try:
                state = await approval_service.evaluate(et, entity)
            except Exception:  # noqa: BLE001
                continue
            if state.get("is_complete") or state.get("is_rejected"):
                continue
            step_idx = state.get("current_step_idx")
            steps = state.get("steps") or []
            if step_idx is None or step_idx >= len(steps):
                continue
            step = steps[step_idx]
            required = step.get("any_of_perms") or []
            # If no workflow at all, fall back to default per-entity perm map
            if not state.get("has_workflow"):
                required = _default_required_perms(et)
            eligible = is_super or any(p in user_perms for p in required) or not required
            if not eligible:
                continue

            # Compute amount once for filter + payload
            entity_amount = float(state.get("amount") or _legacy_amount(et, entity) or 0)

            # Optional: amount tier filter (e.g. Executive only sees high-tier)
            if min_amount is not None and entity_amount < float(min_amount):
                continue

            # Optional: outlet scope filter (Outlet portal restriction)
            if outlet_only and user_outlets:
                ent_outlet = entity.get("outlet_id")
                if ent_outlet and ent_outlet not in user_outlets:
                    continue

            # Deadline computation
            deadline_hours = step.get("deadline_hours")
            hours_until_deadline = None
            is_overdue = False
            if deadline_hours:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                ref_time = entity.get("submitted_at") or entity.get("created_at")
                chain = entity.get("approval_chain") or []
                if chain:
                    ref_time = chain[-1].get("at") or ref_time
                try:
                    ref_dt = datetime.fromisoformat(ref_time.replace("Z", "+00:00"))
                    if ref_dt.tzinfo is None:
                        ref_dt = ref_dt.replace(tzinfo=timezone.utc)
                    elapsed = (now - ref_dt).total_seconds() / 3600
                    hours_until_deadline = round(deadline_hours - elapsed, 2)
                    is_overdue = hours_until_deadline < 0
                except Exception:
                    pass

            out.append({
                "entity_type": et,
                "entity_id": entity.get("id"),
                "title": profile["describe"](entity),
                "doc_no": entity.get("doc_no"),
                "label": _ENTITY_LABEL.get(et, et),
                "link": profile["link"](entity),
                "amount": entity_amount or None,
                "days_count": entity.get("days_count"),
                "amount_label": profile["amount_label"],
                "tier_label": (state.get("tier") or {}).get("label"),
                "current_step_idx": step_idx,
                "current_step_label": step.get("label") or f"Step {step_idx + 1}",
                "status": entity.get(profile.get("status_field", "status")),
                "outlet_id": entity.get("outlet_id"),
                "secondary_id": entity.get(profile["secondary"]),
                "created_at": entity.get("created_at"),
                "submitted_at": entity.get("submitted_at"),
                "created_by_name": entity.get("created_by_name") or entity.get("employee_name") or entity.get("customer_name"),
                "executed_steps": state.get("executed_steps") or [],
                "is_legacy": not state.get("has_workflow"),
                "deadline_hours": deadline_hours,
                "hours_until_deadline": hours_until_deadline,
                "is_overdue": is_overdue,
            })
    out.sort(key=lambda x: (x.get("submitted_at") or x.get("created_at") or ""), reverse=True)
    return out


_ENTITY_LABEL = {
    "purchase_request":  "Purchase Request",
    "purchase_order":    "Purchase Order",
    "stock_adjustment":  "Stock Adjustment",
    "employee_advance":  "Employee Advance",
    "payment_request":   "Payment Request",
    "budget":            "Budget",
    "leave_request":     "Leave Request",
    "stock_transfer":    "Stock Transfer",
    "ar_invoice":        "AR Invoice",
}


def _default_required_perms(entity_type: str) -> list[str]:
    return {
        "purchase_request": ["procurement.pr.approve"],
        "purchase_order":   ["procurement.po.approve", "procurement.po.send"],
        "stock_adjustment": ["inventory.adjustment.approve"],
        "employee_advance": ["hr.advance.approve"],
        "payment_request":  ["finance.payment.approve"],
        "budget":           ["finance.budget.update"],
        "leave_request":    ["hr.leave.approve"],
        "stock_transfer":   ["inventory.adjustment.approve"],
        "ar_invoice":       ["finance.ar.send"],
    }.get(entity_type, [])


def _legacy_amount(entity_type: str, entity: dict) -> float:
    if entity_type == "purchase_request":
        return sum(
            float(ln.get("qty", 0) or 0) * float(ln.get("est_cost", 0) or 0)
            for ln in (entity.get("lines") or [])
        )
    if entity_type == "purchase_order":
        return float(entity.get("grand_total", 0) or 0)
    if entity_type == "stock_adjustment":
        return abs(float(entity.get("total_value", 0) or 0))
    if entity_type == "employee_advance":
        return float(entity.get("principal", 0) or 0)
    return 0.0


@router.get("/queue")
async def my_queue(
    entity_type: Optional[str] = Query(default=None),
    entity_types: Optional[str] = Query(default=None, description="CSV of entity types"),
    min_amount: Optional[float] = Query(default=None, ge=0),
    outlet_only: bool = Query(default=False),
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(current_user),
):
    if entity_types:
        types = [s.strip() for s in entity_types.split(",") if s.strip()]
    elif entity_type:
        types = [entity_type]
    else:
        types = None
    items = await _build_queue_for_user(
        user,
        entity_types=types,
        min_amount=min_amount,
        outlet_only=outlet_only,
    )
    total = len(items)
    skip = (page - 1) * per_page
    return ok_envelope(items[skip:skip + per_page], {
        "page": page, "per_page": per_page, "total": total,
    })



@router.get("/pending")
async def pending_approvals_alias(
    entity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(current_user),
):
    """Alias for /queue — backward compatibility."""
    return await my_queue(entity_type, None, None, False, page, per_page, user)


@router.get("/counts")
async def my_counts(
    entity_types: Optional[str] = Query(default=None, description="CSV of entity types"),
    min_amount: Optional[float] = Query(default=None, ge=0),
    outlet_only: bool = Query(default=False),
    user: dict = Depends(current_user),
):
    types = None
    if entity_types:
        types = [s.strip() for s in entity_types.split(",") if s.strip()]
    items = await _build_queue_for_user(
        user,
        entity_types=types,
        min_amount=min_amount,
        outlet_only=outlet_only,
    )
    counts: dict[str, int] = {k: 0 for k in ENTITY_QUERY_PROFILES.keys()}
    for x in items:
        counts[x["entity_type"]] = counts.get(x["entity_type"], 0) + 1
    return ok_envelope({
        "total": len(items),
        "by_entity": counts,
    })


@router.post("/quick-action")
async def quick_action(payload: dict = Body(...),
                        user: dict = Depends(current_user)):
    """Phase 11F \u2014 unified one-click approve/reject for any approval entity.

    Body: { entity_type, entity_id, action: 'approve'|'reject', note?, reason? }
    """
    from core.exceptions import ValidationError
    et = payload.get("entity_type")
    eid = payload.get("entity_id")
    action = payload.get("action")
    if et not in ENTITY_QUERY_PROFILES:
        raise ValidationError(f"entity_type tidak dikenal: {et}", field="entity_type")
    if not eid:
        raise ValidationError("entity_id wajib", field="entity_id")
    if action not in ("approve", "reject"):
        raise ValidationError("action harus 'approve' atau 'reject'", field="action")

    if et == "purchase_request":
        from services import procurement_service
        if action == "approve":
            res = await procurement_service.approve_pr(eid, user=user, note=payload.get("note"))
        else:
            res = await procurement_service.reject_pr(eid, user=user, reason=payload.get("reason", ""))
    elif et == "purchase_order":
        from services import procurement_service
        if action == "approve":
            res = await procurement_service.approve_po(eid, user=user, note=payload.get("note"))
        else:
            res = await procurement_service.reject_po(eid, user=user, reason=payload.get("reason", ""))
    elif et == "stock_adjustment":
        from services import inventory_service
        if action == "approve":
            res = await inventory_service.approve_adjustment(eid, user=user, note=payload.get("note"))
        else:
            res = await inventory_service.reject_adjustment(eid, user=user, reason=payload.get("reason", ""))
    elif et == "employee_advance":
        from services import hr_service
        if action == "approve":
            res = await hr_service.approve_advance(eid, user=user, note=payload.get("note"))
        else:
            res = await hr_service.reject_advance(eid, user=user, reason=payload.get("reason", ""))
    elif et == "payment_request":
        if action == "approve":
            res = await approval_service.approve("payment_request", eid, user=user, note=payload.get("note"))
        else:
            res = await approval_service.reject("payment_request", eid, user=user, reason=payload.get("reason", ""))
    elif et == "budget":
        from services import budget_service
        if action == "approve":
            res = await budget_service.approve_budget(eid, user_id=user["id"])
        else:
            res = await budget_service.reject_budget(eid, payload.get("reason", "Ditolak"), user_id=user["id"])
    elif et == "leave_request":
        if action == "approve":
            res = await approval_service.approve("leave_request", eid, user=user, note=payload.get("note"))
        else:
            res = await approval_service.reject("leave_request", eid, user=user, reason=payload.get("reason", ""))
    elif et in ("stock_transfer", "ar_invoice"):
        if action == "approve":
            res = await approval_service.approve(et, eid, user=user, note=payload.get("note"))
        else:
            res = await approval_service.reject(et, eid, user=user, reason=payload.get("reason", ""))
    else:
        raise ValidationError(f"Quick action belum support {et}", field="entity_type")
    return ok_envelope({"action": action, "entity_type": et, "entity_id": eid, "result": res})


# ─────────────────────────────────────────────────────────────
# DELEGATION MANAGEMENT
# ─────────────────────────────────────────────────────────────

@router.get("/delegations")
async def list_my_delegations(
    role: str = Query("delegator", regex="^(delegator|delegate)$"),
    user: dict = Depends(current_user),
):
    """List my outgoing (delegator) or incoming (delegate) delegations."""
    if role == "delegator":
        items = await approval_service.list_delegations(delegator_id=user["id"])
    else:
        items = await approval_service.list_delegations(delegate_id=user["id"])
    return ok_envelope(items)


@router.post("/delegations")
async def create_delegation(
    payload: dict = Body(...),
    user: dict = Depends(current_user),
):
    doc = await approval_service.create_delegation(payload, user_id=user["id"])
    return ok_envelope(doc)


@router.delete("/delegations/{delegation_id}")
async def revoke_delegation(delegation_id: str, user: dict = Depends(current_user)):
    await approval_service.revoke_delegation(delegation_id, user_id=user["id"])
    return ok_envelope({"revoked": True})


@router.get("/entity-types")
async def entity_types(_: dict = Depends(current_user)):
    """Return all configurable entity types."""
    return ok_envelope([
        {"value": k, "label": v}
        for k, v in approval_service.ENTITY_LABELS.items()
    ])
