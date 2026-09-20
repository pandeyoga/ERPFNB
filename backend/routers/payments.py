"""/api/finance/payments router — PAY workflow endpoints."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import approval_service, payment_service

router = APIRouter(prefix="/api/finance/payments", tags=["finance-payments"])


@router.get("/kpi")
async def kpi(user: dict = Depends(require_perm("finance.ap.read"))):
    return ok_envelope(await payment_service.payments_kpi())


@router.get("/unpaid-grs")
async def unpaid_grs(user: dict = Depends(require_perm("finance.ap.read"))):
    return ok_envelope(await payment_service.list_unpaid_grs())


@router.get("")
async def list_payments(
    status: Optional[str] = None,
    payee_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("finance.ap.read")),
):
    items, meta = await payment_service.list_payments(
        status=status, payee_type=payee_type,
        date_from=date_from, date_to=date_to, search=search,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/{pay_id}")
async def get_payment(pay_id: str, user: dict = Depends(require_perm("finance.ap.read"))):
    return ok_envelope(await payment_service.get_payment(pay_id))


@router.post("")
async def create_payment(payload: dict = Body(...),
                        user: dict = Depends(require_perm("finance.payment.create"))):
    return ok_envelope(await payment_service.create_payment(payload, user=user))


@router.patch("/{pay_id}")
async def update_payment(pay_id: str, payload: dict = Body(...),
                         user: dict = Depends(require_perm("finance.payment.create"))):
    return ok_envelope(await payment_service.update_payment(pay_id, payload, user=user))


@router.post("/{pay_id}/submit")
async def submit_payment(pay_id: str,
                          user: dict = Depends(require_perm("finance.payment.create"))):
    return ok_envelope(await payment_service.submit_payment(pay_id, user=user))


@router.post("/{pay_id}/approve")
async def approve_payment(pay_id: str, payload: dict = Body(default={}),
                           user: dict = Depends(current_user)):
    return ok_envelope(await approval_service.approve(
        "payment_request", pay_id, user=user, note=payload.get("note"),
    ))


@router.post("/{pay_id}/reject")
async def reject_payment(pay_id: str, payload: dict = Body(...),
                          user: dict = Depends(current_user)):
    return ok_envelope(await approval_service.reject(
        "payment_request", pay_id, user=user, reason=payload.get("reason", ""),
    ))


@router.post("/{pay_id}/mark-paid")
async def mark_paid(pay_id: str, payload: dict = Body(default={}),
                     user: dict = Depends(require_perm("finance.payment.mark_paid"))):
    return ok_envelope(await payment_service.mark_paid(pay_id, payload, user=user))


@router.post("/{pay_id}/cancel")
async def cancel_payment(pay_id: str, payload: dict = Body(...),
                          user: dict = Depends(require_perm("finance.payment.create"))):
    return ok_envelope(await payment_service.cancel_payment(
        pay_id, user=user, reason=payload.get("reason", ""),
    ))
