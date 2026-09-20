"""/api/finance/payment-run-templates router."""
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm, require_any_perm
from services import payment_run_templates_service

router = APIRouter(prefix="/api/finance/payment-run-templates", tags=["finance-payment-run-templates"])

READ_PERM = "finance.ap.read"
WRITE_PERM = "finance.payment.create"
APPROVE_PERM = "finance.payment.approve"


@router.get("")
async def list_templates(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm(READ_PERM)),
):
    items, meta = await payment_run_templates_service.list_templates(page=page, per_page=per_page)
    return ok_envelope(items, meta)


@router.post("")
async def create_template(
    payload: dict = Body(...),
    user: dict = Depends(require_perm(WRITE_PERM)),
):
    tmpl = await payment_run_templates_service.create_template(payload, user=user)
    return ok_envelope(tmpl)


@router.get("/{tmpl_id}")
async def get_template(tmpl_id: str, user: dict = Depends(require_perm(READ_PERM))):
    tmpl = await payment_run_templates_service.get_template(tmpl_id)
    return ok_envelope(tmpl)


@router.patch("/{tmpl_id}")
async def update_template(
    tmpl_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm(WRITE_PERM)),
):
    tmpl = await payment_run_templates_service.update_template(tmpl_id, payload, user=user)
    return ok_envelope(tmpl)


@router.delete("/{tmpl_id}")
async def delete_template(
    tmpl_id: str,
    user: dict = Depends(require_any_perm(APPROVE_PERM, WRITE_PERM)),
):
    await payment_run_templates_service.delete_template(tmpl_id, user=user)
    return ok_envelope({"deleted": tmpl_id})


@router.post("/{tmpl_id}/apply")
async def apply_template(
    tmpl_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_any_perm(APPROVE_PERM, WRITE_PERM)),
):
    """Apply template: creates Payment Requests + draft Payment Run."""
    result = await payment_run_templates_service.apply_template(tmpl_id, payload, user=user)
    return ok_envelope(result)
