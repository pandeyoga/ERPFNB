"""/api/finance/payment-requests router — weekly payment approval workflow."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm
from services import payment_request_service

router = APIRouter(prefix="/api/finance/payment-requests", tags=["finance-payment-requests"])


@router.post("")
async def create_pr(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.payment_request.create")),
):
    """Create new Payment Request (draft)."""
    return ok_envelope(await payment_request_service.create_payment_request(payload, user=user))


@router.get("")
async def list_prs(
    status: Optional[str] = None,
    period_week: Optional[str] = None,
    brand_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("finance.payment_request.read")),
):
    """List Payment Requests with filters."""
    items, meta = await payment_request_service.list_payment_requests(
        status=status,
        period_week=period_week,
        brand_id=brand_id,
        outlet_id=outlet_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/{pr_id}")
async def get_pr(
    pr_id: str,
    user: dict = Depends(require_perm("finance.payment_request.read")),
):
    """Get PR detail."""
    return ok_envelope(await payment_request_service.get_payment_request(pr_id))


@router.post("/{pr_id}/submit")
async def submit_pr(
    pr_id: str,
    user: dict = Depends(require_perm("finance.payment_request.submit")),
):
    """Submit PR for approval."""
    return ok_envelope(await payment_request_service.submit_payment_request(pr_id, user=user))


@router.post("/{pr_id}/approve")
async def approve_pr(
    pr_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("finance.payment_request.approve")),
):
    """Approve PR."""
    return ok_envelope(await payment_request_service.approve_payment_request(
        pr_id, user=user, notes=payload.get("notes")
    ))


@router.post("/{pr_id}/reject")
async def reject_pr(
    pr_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.payment_request.approve")),
):
    """Reject PR."""
    reason = payload.get("reason", "").strip()
    return ok_envelope(await payment_request_service.reject_payment_request(
        pr_id, user=user, reason=reason
    ))


@router.post("/{pr_id}/mark-paid")
async def mark_paid(
    pr_id: str,
    user: dict = Depends(require_perm("finance.payment_request.mark_paid")),
):
    """Mark PR as paid after payment execution."""
    return ok_envelope(await payment_request_service.mark_payment_request_paid(pr_id, user=user))


@router.get("/helpers/open-ap")
async def get_open_ap(
    brand_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    user: dict = Depends(require_perm("finance.payment_request.read")),
):
    """Get list of open AP items untuk dipilih dalam PR."""
    return ok_envelope(await payment_request_service.get_open_ap_for_pr(
        brand_id=brand_id, outlet_id=outlet_id, vendor_id=vendor_id
    ))
