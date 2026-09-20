"""e-Bupot (PPh 23) Export router — Sprint E.

Endpoints:
  GET  /api/ebupot/preview   — preview rows for period
  POST /api/ebupot/export    — generate CSV export
  GET  /api/ebupot/exports   — list export history
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope, AuroraException
from core.security import require_perm
from services import ebupot_service as svc

router = APIRouter(prefix="/api/ebupot", tags=["ebupot"])


@router.get("/preview")
async def preview(
    period: str = Query(..., description="YYYY-MM"),
    user: dict = Depends(require_perm("tax.ebupot.read")),
):
    result = await svc.preview_ebupot(period)
    return ok_envelope(result)


@router.post("/export")
async def export(
    payload: dict,
    user: dict = Depends(require_perm("tax.ebupot.export")),
):
    period = payload.get("period")
    if not period:
        raise AuroraException('Period is required', code='MISSING_PERIOD', field='period')
    result = await svc.export_ebupot(period, user["id"])
    return ok_envelope(result)


@router.get("/exports")
async def list_exports(
    period: Optional[str] = Query(None),
    user: dict = Depends(require_perm("tax.ebupot.read")),
):
    items = await svc.list_ebupot_jobs(period)
    return ok_envelope(items)
