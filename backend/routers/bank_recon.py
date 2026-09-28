"""/api/finance/bank-recon router."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Form, UploadFile

from core.exceptions import ok_envelope, ValidationError
from core.security import require_perm
from services import bank_recon_service

router = APIRouter(prefix="/api/finance/bank-recon", tags=["finance-bank-recon"])


@router.get("/sessions")
async def list_sessions(user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    return ok_envelope(await bank_recon_service.list_sessions())


@router.get("/sessions/{session_id}")
async def get_session(session_id: str,
                      user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    return ok_envelope(await bank_recon_service.get_session(session_id))


@router.post("/upload")
async def upload_statement(
    bank_account_id: str = Form(...),
    file: UploadFile = File(...),
    date_tol_days: Optional[int] = Form(3),
    amount_tol: Optional[float] = Form(1000),
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    if not file.filename or not file.filename.lower().endswith((".csv", ".txt")):
        raise ValidationError("Hanya file CSV yang didukung")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise ValidationError("File terlalu besar (max 10MB)")
    result = await bank_recon_service.upload_statement(
        bank_account_id=bank_account_id, filename=file.filename,
        content=content, user=user,
        date_tol_days=int(date_tol_days or 3),
        amount_tol=float(amount_tol or 1000),
    )
    return ok_envelope(result)


@router.post("/sessions/{session_id}/auto-match")
async def auto_match(session_id: str,
                     user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    return ok_envelope(await bank_recon_service.auto_match(session_id, user=user))


@router.get("/sessions/{session_id}/rows/{row_id}/candidates")
async def row_candidates(
    session_id: str, row_id: str,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    return ok_envelope(await bank_recon_service.get_match_candidates(session_id, row_id))


@router.post("/sessions/{session_id}/rows/{row_id}/match")
async def manual_match(
    session_id: str, row_id: str, payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    return ok_envelope(await bank_recon_service.set_manual_match(
        session_id, row_id,
        target_type=payload.get("target_type", ""),
        target_id=payload.get("target_id", ""),
        user=user,
    ))


@router.post("/sessions/{session_id}/rows/{row_id}/unmatch")
async def unmatch(session_id: str, row_id: str,
                  user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    return ok_envelope(await bank_recon_service.unmatch_row(session_id, row_id, user=user))


@router.post("/sessions/{session_id}/commit")
async def commit_session(
    session_id: str,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    return ok_envelope(await bank_recon_service.commit_session(session_id, user=user))


@router.post("/sessions/{session_id}/reverse-commit")
async def reverse_commit(
    session_id: str,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    """Reverse a committed session back to pending.

    Clears reconciled_at on all payment_requests and journal_entries that were
    reconciled by this session. Match data on rows is preserved.
    """
    return ok_envelope(await bank_recon_service.reverse_commit(session_id, user=user))


@router.get("/sessions/{session_id}/history")
async def get_session_history(
    session_id: str,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    """Return audit timeline for a session — sorted oldest-first."""
    return ok_envelope(await bank_recon_service.get_session_history(session_id))


# ─── Sprint F v2 endpoints ───────────────────────────────────────────────────

@router.get("/sessions/{session_id}/summary")
async def session_summary(
    session_id: str,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    """Reconciliation summary stats."""
    return ok_envelope(await bank_recon_service.get_summary(session_id))


@router.post("/sessions/{session_id}/rows/{row_id}/exception")
async def mark_exception(
    session_id: str,
    row_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    """Mark a row as exceptional (unreconcilable)."""
    note = payload.get("note", "")
    return ok_envelope(await bank_recon_service.mark_exception(session_id, row_id, note, user=user))


@router.post("/sessions/{session_id}/bulk-auto-accept")
async def bulk_auto_accept(
    session_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    """Bulk-accept all rows whose best match meets min_score threshold."""
    min_score = float(payload.get("min_score", 0.75))
    result = await bank_recon_service.bulk_auto_accept(session_id, min_score, user=user)
    return ok_envelope(result)


@router.get("/sessions/{session_id}/export-csv")
async def export_csv(
    session_id: str,
    user: dict = Depends(require_perm("finance.bank_reconciliation")),
):
    """Export session rows as CSV download."""
    from fastapi.responses import StreamingResponse
    session = await bank_recon_service.get_session(session_id)
    csv_content = bank_recon_service.export_session_csv(session)
    filename = f"bank_recon_{session_id[:8]}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

