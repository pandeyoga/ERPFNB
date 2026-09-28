"""Phase 11B — /api/finance/cash router (Cash Position Dashboard backend)."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, File, Query, UploadFile

from core.exceptions import ok_envelope, ValidationError
from core.security import require_perm
from services import cash_position_service

router = APIRouter(prefix="/api/finance/cash", tags=["cash"])


@router.get("/accounts")
async def list_accounts(
    type: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    active: Optional[bool] = Query(True),
    user: dict = Depends(require_perm("finance.cash.read")),
):
    rows = await cash_position_service.list_accounts(
        account_type=type, outlet_id=outlet_id, brand_id=brand_id, active=active,
    )
    return ok_envelope(rows)


@router.get("/accounts/{account_id}")
async def get_account(account_id: str,
                       user: dict = Depends(require_perm("finance.cash.read"))):
    return ok_envelope(await cash_position_service.get_account(account_id))


@router.post("/accounts")
async def create_account(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.cash.update")),
):
    return ok_envelope(await cash_position_service.create_account(payload, user=user))


@router.patch("/accounts/{account_id}")
async def update_account(
    account_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.cash.update")),
):
    return ok_envelope(await cash_position_service.update_account(account_id, payload, user=user))


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    user: dict = Depends(require_perm("finance.cash.update")),
):
    return ok_envelope({"deleted": await cash_position_service.delete_account(account_id, user=user)})


@router.post("/accounts/{account_id}/balance")
async def update_balance(
    account_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.cash.update")),
):
    if "balance" not in payload:
        raise ValidationError("Field 'balance' wajib", field="balance")
    return ok_envelope(await cash_position_service.update_balance(
        account_id,
        balance=float(payload["balance"]),
        user=user,
        source=payload.get("source", "manual"),
        notes=payload.get("notes"),
        attachment_id=payload.get("attachment_id"),
        recorded_at=payload.get("recorded_at"),
    ))


@router.post("/accounts/{account_id}/reconcile")
async def reconcile_account(
    account_id: str,
    user: dict = Depends(require_perm("finance.cash.update")),
):
    return ok_envelope(await cash_position_service.reconcile_account(account_id, user=user))


@router.get("/accounts/{account_id}/history")
async def list_history(
    account_id: str,
    days: int = Query(30, ge=1, le=365),
    user: dict = Depends(require_perm("finance.cash.read")),
):
    return ok_envelope(await cash_position_service.list_history(account_id, days=days))


@router.get("/position")
async def position(
    outlet_id: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("finance.cash.read")),
):
    outlet_ids = outlet_id.split(",") if outlet_id else None
    brand_ids = brand_id.split(",") if brand_id else None
    return ok_envelope(await cash_position_service.compute_position(
        outlet_ids=outlet_ids, brand_ids=brand_ids,
    ))


@router.get("/position/projection")
async def position_projection(
    days: int = Query(30, ge=1, le=180),
    user: dict = Depends(require_perm("finance.cash.read")),
):
    return ok_envelope(await cash_position_service.project_position(days=days))


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    user: dict = Depends(require_perm("finance.cash.update")),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise ValidationError("File harus berformat .csv", field="file")
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise ValidationError("File terlalu besar (max 5MB)", field="file")
    return ok_envelope(await cash_position_service.bulk_update_via_csv(raw, user=user))
