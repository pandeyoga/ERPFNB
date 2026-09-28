"""e-Faktur / Coretax Export router — Sprint 1b.

Endpoints:
  GET  /api/efaktur/company-tax-info       — company NPWP/PKP config
  GET  /api/efaktur/preview                — preview dataset (keluaran/masukan) by period
  POST /api/efaktur/export                 — create export job (CSV + XML)
  GET  /api/efaktur/exports                — list export job history
  GET  /api/efaktur/exports/{export_id}    — get export job detail with file content
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope, AuroraException
from core.security import current_user, require_perm
from core.db import serialize
from services import efaktur_service

router = APIRouter(prefix="/api/efaktur", tags=["efaktur"])


@router.get("/company-tax-info")
async def get_company_tax_info(user: dict = Depends(current_user)):
    """Return company tax identity (NPWP, PKP name, address)."""
    info = await efaktur_service.get_company_tax_info()
    return ok_envelope(info)


@router.get("/preview")
async def preview_dataset(
    period: str = Query(..., description="YYYY-MM"),
    job_type: str = Query("keluaran", description="keluaran | masukan | all"),
    user: dict = Depends(require_perm("tax.efaktur.read")),
):
    """Preview faktur dataset without generating files or incrementing sequences.
    
    Returns:
      - keluaran: [list of Faktur Keluaran]
      - masukan: [list of Faktur Masukan]
      - total_dpp, total_ppn, warning_count
    """
    result = await efaktur_service.preview_dataset(period, job_type)
    return ok_envelope(result)


@router.post("/export")
async def create_export_job(
    payload: dict,
    user: dict = Depends(require_perm("tax.efaktur.export")),
):
    """Create export job and generate CSV + XML files.
    
    Payload:
      { period: "YYYY-MM", job_type: "keluaran" | "masukan" | "all" }
    
    Returns:
      - job record with embedded file content (CSV/XML strings in 'files' dict)
    """
    period = payload.get("period")
    if not period:
        raise AuroraException('Period is required', code='MISSING_PERIOD', field='period')
    
    job_type = payload.get("job_type", "keluaran")
    result = await efaktur_service.create_export_job(
        period=period,
        job_type=job_type,
        user_id=user["id"],
    )
    return ok_envelope(result)


@router.get("/exports")
async def list_export_jobs(
    period: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("tax.efaktur.read")),
):
    """List export job history (without embedded file content)."""
    items, meta = await efaktur_service.list_export_jobs(period, page, per_page)
    return ok_envelope({"items": items, "meta": meta})


@router.get("/exports/{export_id}")
async def get_export_job(
    export_id: str,
    user: dict = Depends(require_perm("tax.efaktur.read")),
):
    """Get single export job detail.
    
    Note: In production, file content should be stored in object storage.
    For Sprint 1b, we regenerate files on-demand from stored job metadata.
    """
    from core.db import get_db
    db = get_db()
    job = await db.efaktur_export_jobs.find_one({"id": export_id})
    if not job:
        raise AuroraException('Export job not found', code='EXPORT_NOT_FOUND', field='export_id')
    
    # For now, return serialized job (files are stored as "<inline>" placeholder)
    # In production, replace with signed URLs to object storage
    return ok_envelope(serialize(job))
