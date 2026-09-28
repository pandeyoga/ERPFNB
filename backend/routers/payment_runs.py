"""/api/finance/payment-runs router — Batch Payment Run endpoints."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm, require_any_perm
from services import payment_runs_service

router = APIRouter(prefix="/api/finance/payment-runs", tags=["finance-payment-runs"])

READ_PERM = "finance.ap.read"
WRITE_PERM = "finance.payment.create"
APPROVE_PERM = "finance.payment.approve"


@router.get("/kpi")
async def get_kpi(user: dict = Depends(require_perm(READ_PERM))):
    data = await payment_runs_service.kpi()
    return ok_envelope(data)


@router.get("")
async def list_runs(
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm(READ_PERM)),
):
    items, meta = await payment_runs_service.list_payment_runs(
        status=status, date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("")
async def create_run(
    payload: dict = Body(...),
    user: dict = Depends(require_perm(WRITE_PERM)),
):
    run = await payment_runs_service.create_payment_run(payload, user=user)
    return ok_envelope(run)


@router.get("/{run_id}")
async def get_run(
    run_id: str,
    user: dict = Depends(require_perm(READ_PERM)),
):
    run = await payment_runs_service.get_payment_run(run_id)
    return ok_envelope(run)


@router.patch("/{run_id}")
async def update_run(
    run_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm(WRITE_PERM)),
):
    run = await payment_runs_service.update_payment_run(run_id, payload, user=user)
    return ok_envelope(run)


@router.post("/{run_id}/confirm")
async def confirm_run(
    run_id: str,
    user: dict = Depends(require_any_perm(APPROVE_PERM, WRITE_PERM)),
):
    """Transition draft → confirmed."""
    run = await payment_runs_service.confirm_payment_run(run_id, user=user)
    return ok_envelope(run)


@router.post("/{run_id}/post")
async def post_run(
    run_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm(APPROVE_PERM)),
):
    """Execute: post batch JE + mark all PAYs paid. Requires finance.payment.approve."""
    run = await payment_runs_service.post_payment_run(run_id, payload, user=user)
    return ok_envelope(run)


@router.post("/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_any_perm(APPROVE_PERM, WRITE_PERM)),
):
    """Cancel a draft or confirmed run."""
    run = await payment_runs_service.cancel_payment_run(run_id, payload, user=user)
    return ok_envelope(run)
