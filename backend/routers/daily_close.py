"""/api/outlet/daily-close router."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import daily_close_service

router = APIRouter(prefix="/api/outlet/daily-close", tags=["daily-close"])


@router.get("/status")
async def status(
    outlet_id: str = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    deposit_slip_attachment_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("outlet.daily_close.execute")),
):
    return ok_envelope(await daily_close_service.get_status(
        outlet_id, date, user=user,
        deposit_slip_attachment_id=deposit_slip_attachment_id,
    ))


@router.get("")
async def list_records(
    outlet_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.daily_close.execute")),
):
    outlet_ids = [outlet_id] if outlet_id else (user.get("outlet_ids") or [])
    items, meta = await daily_close_service.list_records(
        outlet_ids=outlet_ids, date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/submit")
async def submit(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("outlet.daily_close.execute")),
):
    return ok_envelope(await daily_close_service.submit(
        outlet_id=payload.get("outlet_id"),
        date_str=payload.get("date") or payload.get("close_date"),
        deposit_slip_attachment_id=payload.get("deposit_slip_attachment_id"),
        notes=payload.get("notes"),
        user=user,
    ))


@router.get("/{record_id}")
async def detail(record_id: str,
                 user: dict = Depends(require_perm("outlet.daily_close.execute"))):
    return ok_envelope(await daily_close_service.get_record(record_id))


@router.post("/{record_id}/reopen")
async def reopen(record_id: str, payload: dict = Body(...),
                 user: dict = Depends(current_user)):
    return ok_envelope(await daily_close_service.reopen(
        record_id, reason=payload.get("reason", ""), user=user,
    ))
