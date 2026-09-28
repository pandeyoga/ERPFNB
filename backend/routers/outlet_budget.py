"""Outlet Operational Budget router — KDO/FDO/BDO cost control.

Endpoints:
  GET    /api/outlet-budget/budgets            — list (executive view, multi-outlet)
  POST   /api/outlet-budget/budgets            — set single budget
  POST   /api/outlet-budget/budgets/bulk       — bulk set (matrix save)
  GET    /api/outlet-budget/budgets/{id}       — single detail
  DELETE /api/outlet-budget/budgets/{id}       — archive

  GET    /api/outlet-budget/my-current         — outlet manager view (current week+month)
  GET    /api/outlet-budget/by-outlet/{outlet_id}/current  — explicit outlet lookup
  POST   /api/outlet-budget/precheck-pr         — dry-run PR against budget

  POST   /api/outlet-budget/increase-requests          — outlet submits
  GET    /api/outlet-budget/increase-requests          — list (filter by status)
  POST   /api/outlet-budget/increase-requests/{id}/approve
  POST   /api/outlet-budget/increase-requests/{id}/reject

  GET    /api/outlet-budget/monitor/overview   — executive dashboard aggregation
  GET    /api/outlet-budget/monitor/heatmap    — outlet x period matrix
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from models.outlet_budget import (
    OutletBudgetCreate, OutletBudgetBulkSet,
    BudgetIncreaseRequestCreate, BudgetIncreaseDecision,
)
from services import outlet_budget_service as svc

router = APIRouter(prefix="/api/outlet-budget", tags=["outlet-budget"])


# ============================================================================
# Executive endpoints — SET budgets
# ============================================================================


@router.get("/budgets")
async def list_budgets(
    period_type: Optional[str] = Query(None, description="weekly|monthly|custom"),
    period_key: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("outlet_budget.read")),
):
    outlet_ids = [outlet_id] if outlet_id else None
    items = await svc.list_budgets(
        period_type=period_type, period_key=period_key,
        brand_id=brand_id, outlet_ids=outlet_ids,
    )
    return ok_envelope({"items": items, "total": len(items)})


@router.post("/budgets")
async def create_budget(
    payload: OutletBudgetCreate,
    user: dict = Depends(require_perm("outlet_budget.set")),
):
    doc = await svc.set_budget(payload.dict(), user=user)
    return ok_envelope(doc)


@router.post("/budgets/bulk")
async def bulk_set_budgets(
    payload: OutletBudgetBulkSet,
    user: dict = Depends(require_perm("outlet_budget.set")),
):
    res = await svc.bulk_set(payload.dict(), user=user)
    return ok_envelope(res)


@router.get("/budgets/{budget_id}")
async def get_budget(
    budget_id: str,
    user: dict = Depends(require_perm("outlet_budget.read")),
):
    doc = await svc.get_budget(budget_id)
    return ok_envelope(doc)


@router.delete("/budgets/{budget_id}")
async def delete_budget(
    budget_id: str,
    user: dict = Depends(require_perm("outlet_budget.set")),
):
    res = await svc.delete_budget(budget_id, user=user)
    return ok_envelope(res)


# ============================================================================
# Outlet endpoints — VIEW current budgets
# ============================================================================


@router.get("/my-current")
async def my_current_budgets(user: dict = Depends(current_user)):
    """Return current weekly + monthly budget for the user's primary outlet.

    If user has multiple outlets, returns array of per-outlet budgets.
    """
    outlet_ids = user.get("outlet_ids") or []
    if not outlet_ids:
        return ok_envelope({"items": []})
    db = svc.get_db() if hasattr(svc, "get_db") else None
    items = []
    # Lookup outlet names for friendlier UI
    from core.db import get_db as _get_db
    db = _get_db()
    outlet_docs = await db.outlets.find({"id": {"$in": outlet_ids}, "deleted_at": None}).to_list(len(outlet_ids) + 1)
    name_map = {o["id"]: o.get("name") for o in outlet_docs}
    for oid in outlet_ids:
        cur = await svc.current_periods_for_outlet(oid)
        items.append({"outlet_id": oid, "outlet_name": name_map.get(oid), **cur})
    return ok_envelope({"items": items})


@router.get("/by-outlet/{outlet_id}/current")
async def current_by_outlet(
    outlet_id: str,
    user: dict = Depends(require_perm("outlet_budget.read")),
):
    cur = await svc.current_periods_for_outlet(outlet_id)
    return ok_envelope({"outlet_id": outlet_id, **cur})


@router.post("/precheck-pr")
async def precheck_pr(
    payload: dict,
    user: dict = Depends(current_user),
):
    """Dry-run a PR payload against budget without creating it.

    Body: { outlet_id, source: kdo|fdo|bdo, lines: [{qty, unit_cost}], request_date? }
    """
    res = await svc.check_pr_against_budget(payload)
    return ok_envelope(res)


# ============================================================================
# Budget Increase Requests
# ============================================================================


@router.post("/increase-requests")
async def submit_increase_request(
    payload: BudgetIncreaseRequestCreate,
    user: dict = Depends(require_perm("outlet_budget.request_increase")),
):
    doc = await svc.create_increase_request(payload.dict(), user=user)
    return ok_envelope(doc)


@router.get("/increase-requests")
async def list_increase_requests(
    status: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    user: dict = Depends(current_user),
):
    # If outlet user (no .approve_increase), limit to their outlets
    perms = set(user.get("permissions") or [])
    if "*" not in perms and "outlet_budget.approve_increase" not in perms:
        outlet_ids = user.get("outlet_ids") or []
        if not outlet_ids:
            return ok_envelope({"items": []})
        items = await svc.list_increase_requests(status=status, outlet_ids=outlet_ids)
    else:
        outlet_ids = [outlet_id] if outlet_id else None
        items = await svc.list_increase_requests(status=status, outlet_ids=outlet_ids)
    return ok_envelope({"items": items, "total": len(items)})


@router.post("/increase-requests/{req_id}/approve")
async def approve_increase(
    req_id: str,
    payload: BudgetIncreaseDecision,
    user: dict = Depends(require_perm("outlet_budget.approve_increase")),
):
    doc = await svc.approve_increase_request(
        req_id, user=user,
        approved_amount=payload.approved_amount, note=payload.note,
    )
    return ok_envelope(doc)


@router.post("/increase-requests/{req_id}/reject")
async def reject_increase(
    req_id: str,
    payload: BudgetIncreaseDecision,
    user: dict = Depends(require_perm("outlet_budget.approve_increase")),
):
    doc = await svc.reject_increase_request(req_id, user=user, note=payload.note)
    return ok_envelope(doc)


# ============================================================================
# Monitoring (Executive Dashboard)
# ============================================================================


@router.get("/monitor/overview")
async def monitor_overview(
    period_type: str = Query(..., regex="^(weekly|monthly|custom)$"),
    period_key: str = Query(...),
    brand_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("outlet_budget.monitor")),
):
    res = await svc.monitor_overview(
        period_type=period_type, period_key=period_key, brand_id=brand_id,
    )
    return ok_envelope(res)


@router.get("/monitor/heatmap")
async def monitor_heatmap(
    period_type: str = Query(...),
    period_keys: str = Query(..., description="comma-separated period keys"),
    outlet_ids: Optional[str] = Query(None, description="comma-separated outlet IDs"),
    user: dict = Depends(require_perm("outlet_budget.monitor")),
):
    keys = [k.strip() for k in period_keys.split(",") if k.strip()]
    oids = [o.strip() for o in outlet_ids.split(",")] if outlet_ids else None
    res = await svc.heatmap(period_type=period_type, period_keys=keys, outlet_ids=oids)
    return ok_envelope(res)
