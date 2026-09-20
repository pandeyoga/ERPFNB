"""Budget vs Actual router — v0.3.5 Enhanced.

Endpoints:
  GET  /api/budget/budgets                  — list budgets (multi-scope, approval filters)
  POST /api/budget/budgets                  — create budget
  GET  /api/budget/budgets/{budget_id}      — get budget detail
  PUT  /api/budget/budgets/{budget_id}      — update budget
  DELETE /api/budget/budgets/{budget_id}    — delete budget
  POST /api/budget/budgets/{budget_id}/submit   — submit for approval
  POST /api/budget/budgets/{budget_id}/approve  — approve budget (Executive)
  POST /api/budget/budgets/{budget_id}/reject   — reject budget (Executive)
  POST /api/budget/budgets/{budget_id}/lock     — lock budget (Executive)
  POST /api/budget/budgets/{budget_id}/unlock   — unlock budget (Admin)
  GET  /api/budget/vs-actual                — budget vs actual report (multi-scope)
  GET  /api/budget/vs-actual-multi-outlet   — budget vs actual per outlet
  GET  /api/budget/categories               — list budget categories
  POST /api/budget/import-csv               — import budget from CSV
  POST /api/budget/import-excel             — import budget from Excel
  GET  /api/budget/template-excel           — download Excel template
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File

from core.exceptions import ok_envelope, AuroraException
from core.security import current_user, require_perm
from services import budget_service
from models.budget import BUDGET_CATEGORIES

router = APIRouter(prefix="/api/budget", tags=["budget"])


@router.get("/categories")
async def get_budget_categories(user: dict = Depends(current_user)):
    """Return budget category definitions."""
    return ok_envelope({"categories": BUDGET_CATEGORIES})


@router.get("/budgets")
async def list_budgets(
    period: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    scope: Optional[str] = Query(None, description="outlet | brand | group"),
    approval_status: Optional[str] = Query(None, description="draft | submitted | approved | locked | rejected"),
    period_type: Optional[str] = Query(None, description="monthly | quarterly | annual | annual_monthly"),
    year: Optional[str] = Query(None, description="YYYY for year filter"),
    user: dict = Depends(require_perm("finance.budget.read")),
):
    """List budgets with optional filters (multi-scope support)."""
    items = await budget_service.list_budgets(
        period=period,
        outlet_id=outlet_id,
        brand_id=brand_id,
        scope=scope,
        approval_status=approval_status,
        period_type=period_type,
        year=year,
    )
    return ok_envelope({"items": items})


@router.post("/budgets")
async def create_budget(
    payload: dict,
    user: dict = Depends(require_perm("finance.budget.create")),
):
    """Create new budget with multi-scope support.
    
    Payload:
      name, period (YYYY-MM or YYYY-QN or YYYY), period_type (monthly|quarterly|annual|annual_monthly),
      scope (outlet|brand|group), outlet_id (optional), brand_id (optional),
      lines: [{coa_id, amount, category (optional), monthly_amounts (optional for annual_monthly)}], notes
    """
    budget = await budget_service.create_budget(payload, user_id=user["id"])
    return ok_envelope(budget)


@router.get("/budgets/{budget_id}")
async def get_budget(
    budget_id: str,
    user: dict = Depends(require_perm("finance.budget.read")),
):
    """Get budget detail."""
    budget = await budget_service.get_budget(budget_id)
    if not budget:
        raise AuroraException('Budget not found', code='BUDGET_NOT_FOUND', field='budget_id')
    return ok_envelope(budget)


@router.put("/budgets/{budget_id}")
async def update_budget(
    budget_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.budget.update")),
):
    """Update budget lines."""
    budget = await budget_service.update_budget(budget_id, payload, user_id=user["id"])
    if not budget:
        raise AuroraException('Budget not found', code='BUDGET_NOT_FOUND', field='budget_id')
    return ok_envelope(budget)


@router.delete("/budgets/{budget_id}")
async def delete_budget(
    budget_id: str,
    user: dict = Depends(require_perm("finance.budget.delete")),
):
    """Archive budget."""
    await budget_service.delete_budget(budget_id, user_id=user["id"])
    return ok_envelope({"message": "Budget deleted"})


# ─────────────────────────────────────────────────────────────
# Approval workflow endpoints
# ─────────────────────────────────────────────────────────────

@router.post("/budgets/{budget_id}/submit")
async def submit_budget(
    budget_id: str,
    user: dict = Depends(require_perm("finance.budget.create")),
):
    """Submit budget for approval (Draft → Submitted)."""
    try:
        budget = await budget_service.submit_for_approval(budget_id, user_id=user["id"])
        return ok_envelope(budget)
    except ValueError as e:
        raise AuroraException(str(e), code='BUDGET_SUBMIT_ERROR', field='budget_id')


@router.post("/budgets/{budget_id}/approve")
async def approve_budget(
    budget_id: str,
    user: dict = Depends(require_perm("executive.budget.approve")),
):
    """Approve budget (Submitted → Approved). Executive role required."""
    try:
        budget = await budget_service.approve_budget(budget_id, user_id=user["id"])
        return ok_envelope(budget)
    except ValueError as e:
        raise AuroraException(str(e), code='BUDGET_APPROVE_ERROR', field='budget_id')


@router.post("/budgets/{budget_id}/reject")
async def reject_budget(
    budget_id: str,
    payload: dict,
    user: dict = Depends(require_perm("executive.budget.approve")),
):
    """Reject budget (Submitted → Draft). Executive role required.
    
    Payload:
      reason: str (rejection reason)
    """
    reason = payload.get("reason", "No reason provided")
    try:
        budget = await budget_service.reject_budget(budget_id, reason, user_id=user["id"])
        return ok_envelope(budget)
    except ValueError as e:
        raise AuroraException(str(e), code='BUDGET_REJECT_ERROR', field='budget_id')


@router.post("/budgets/{budget_id}/lock")
async def lock_budget(
    budget_id: str,
    user: dict = Depends(require_perm("executive.budget.approve")),
):
    """Lock budget (Approved → Locked). Executive role required."""
    try:
        budget = await budget_service.lock_budget(budget_id, user_id=user["id"])
        return ok_envelope(budget)
    except ValueError as e:
        raise AuroraException(str(e), code='BUDGET_LOCK_ERROR', field='budget_id')


@router.post("/budgets/{budget_id}/unlock")
async def unlock_budget(
    budget_id: str,
    user: dict = Depends(require_perm("admin")),
):
    """Unlock budget (Locked → Approved). Admin only."""
    budget = await budget_service.unlock_budget(budget_id, user_id=user["id"])
    return ok_envelope(budget)


@router.get("/vs-actual")
async def budget_vs_actual(
    period: str = Query(..., description="YYYY-MM"),
    outlet_id: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    scope: str = Query("outlet", description="outlet | brand | group"),
    level: str = Query("both", description="coa | category | both"),
    user: dict = Depends(require_perm("finance.budget.read")),
):
    """Budget vs Actual report with multi-scope support.
    
    Returns:
      - coa_level: [{coa_id, coa_code, coa_name, budget, actual, variance, variance_pct, achievement, flag}]
      - category_rollup: [{category, name, budget, actual, variance, variance_pct, achievement, flag, derived?}]
      - total_budget, total_actual, total_variance
    """
    result = await budget_service.vs_actual(
        period,
        outlet_id=outlet_id,
        brand_id=brand_id,
        scope=scope,
        level=level,
    )
    return ok_envelope(result)


@router.get("/vs-actual-multi-outlet")
async def budget_vs_actual_multi_outlet(
    period: str = Query(..., description="YYYY-MM"),
    brand_id: Optional[str] = Query(None, description="Filter by brand (optional)"),
    user: dict = Depends(require_perm("finance.budget.read")),
):
    """Budget vs Actual comparison across multiple outlets.
    
    Returns:
      - outlets: [{outlet_id, outlet_name, brand_id, total_budget, total_actual, total_variance, achievement_pct, has_budget, category_rollup}]
    """
    result = await budget_service.vs_actual_multi_outlet(period, brand_id=brand_id)
    return ok_envelope(result)


@router.post("/import-csv", deprecated=True)
async def import_budget_csv(
    file: UploadFile = File(...),
    period: str = Query(...),
    outlet_id: Optional[str] = Query(None),
    scope: str = Query("outlet", description="outlet | brand | group"),
    user: dict = Depends(require_perm("finance.budget.create")),
):
    """[DEPRECATED] Import budget from CSV file.

    DEPRECATED: prefer POST /api/budget/import-excel (richer format, validation).
    Kept for backward compatibility; not used by the current frontend.

    CSV format:
      coa_code, amount, category (optional)
    """
    content = await file.read()
    result = await budget_service.import_csv(
        csv_content=content.decode("utf-8"),
        period=period,
        outlet_id=outlet_id,
        scope=scope,
        user_id=user["id"],
    )
    return ok_envelope(result)



@router.post("/import-excel")
async def import_budget_excel(
    file: UploadFile = File(...),
    period: str = Query(..., description="YYYY-MM or YYYY"),
    outlet_id: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    scope: str = Query("outlet", description="outlet | brand | group"),
    user: dict = Depends(require_perm("finance.budget.create")),
):
    """Import budget from Excel (.xlsx) file.

    Excel format (row 1 = header):
      Simple: coa_code | coa_name | amount | category (optional)
      Monthly: coa_code | coa_name | jan | feb | ... | dec | total | category
    """
    content = await file.read()
    result = await budget_service.import_excel(
        file_bytes=content,
        period=period,
        outlet_id=outlet_id,
        brand_id=brand_id,
        scope=scope,
        user_id=user["id"],
    )
    return ok_envelope(result)


@router.get("/template-excel")
async def download_budget_template(
    period_type: str = Query("simple", description="simple | monthly"),
    user: dict = Depends(require_perm("finance.budget.create")),
):
    """Download Budget Excel import template.
    
    period_type:
      - simple: Single amount column
      - monthly: 12 monthly columns (jan-dec) + total
    """
    from fastapi.responses import Response
    
    template_bytes = await budget_service.generate_template_excel(period_type=period_type)
    filename = f"budget_template_{period_type}.xlsx"
    
    return Response(
        content=template_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
