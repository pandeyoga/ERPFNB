"""/api/finance router — JE, manual journal, reversal, TB, P&L, BS, Cashflow, AP aging, validation queue, periods."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.db import get_db, serialize
from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import balance_sheet_service, cashflow_service, finance_service
from services._period import (
    list_periods as svc_list_periods,
    get_period as svc_get_period,
    closing_checks as svc_closing_checks,
    preview_tax_settlement as svc_preview_tax_settlement,
    close_period as svc_close_period,
    lock_period as svc_lock_period,
    reopen_period as svc_reopen_period,
    is_period_locked as svc_is_period_locked
)

router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("/home")
async def home(user: dict = Depends(require_perm("finance.journal_entry.read"))):
    return ok_envelope(await finance_service.finance_home())


# ---------------- JOURNAL ENTRIES ----------------
@router.get("/journals")
async def list_je(
    period: Optional[str] = None,
    source_type: Optional[str] = None,
    coa_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    items, meta = await finance_service.list_journals(
        period=period, source_type=source_type, coa_id=coa_id, dim_outlet=dim_outlet,
        date_from=date_from, date_to=date_to, status=status, search=search,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/journals/{je_id}")
async def get_je(je_id: str, user: dict = Depends(require_perm("finance.journal_entry.read"))):
    return ok_envelope(await finance_service.get_journal(je_id))


@router.post("/journals/manual")
async def post_manual(payload: dict = Body(...),
                       user: dict = Depends(require_perm("finance.journal_entry.create"))):
    return ok_envelope(await finance_service.post_manual_journal(payload, user=user))


@router.post("/journals/{je_id}/reverse")
async def reverse_je(je_id: str, payload: dict = Body(...),
                       user: dict = Depends(require_perm("finance.journal_entry.reverse"))):
    return ok_envelope(await finance_service.reverse_journal(
        je_id, user=user, reason=payload.get("reason", "")))


# ---------------- REPORTS ----------------
@router.get("/trial-balance")
async def trial_balance(
    period: str,
    dim_outlet: Optional[str] = None,
    user: dict = Depends(require_perm("finance.report.profit_loss")),
):
    return ok_envelope(await finance_service.trial_balance(
        period=period, dim_outlet=dim_outlet))


@router.get("/profit-loss")
async def profit_loss(
    period: str,
    dim_outlet: Optional[str] = None,
    compare_prev: bool = True,
    user: dict = Depends(require_perm("finance.report.profit_loss")),
):
    return ok_envelope(await finance_service.profit_loss(
        period=period, dim_outlet=dim_outlet, compare_prev=compare_prev))


@router.get("/ap-aging")
async def ap_aging(
    as_of: Optional[str] = None,
    user: dict = Depends(require_perm("finance.ap.read")),
):
    return ok_envelope(await finance_service.ap_aging(as_of=as_of))


@router.get("/ap-aging/export/xlsx")
async def ap_aging_export_xlsx(
    as_of: Optional[str] = None,
    user: dict = Depends(require_perm("finance.ap.read")),
):
    """Export AP Aging as Excel (.xlsx) — delegates to reports_excel_finance_service."""
    from fastapi.responses import Response
    from services.reports_excel_service import generate_ap_aging_excel
    from services.excel_export_service import workbook_to_bytes
    workbook = await generate_ap_aging_excel(as_of_date=as_of)
    file_bytes = workbook_to_bytes(workbook)
    fname = f"ap_aging_{as_of or 'today'}.xlsx"
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


# ---------------- AP LEDGER LIST ----------------
@router.get("/ap-ledger")
async def ap_ledger_list(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    user: dict = Depends(require_perm("finance.ap.read")),
):
    """List AP ledger entries (Kontra Bon) with filtering by status / vendor."""
    from core.db import get_db
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if vendor_id:
        q["vendor_id"] = vendor_id
    total = await db.ap_ledgers.count_documents(q)
    skip = (page - 1) * per_page
    items = await db.ap_ledgers.find(q, {"_id": 0}).sort("invoice_date", -1).skip(skip).limit(per_page).to_list(per_page)
    return ok_envelope(items, {"page": page, "per_page": per_page, "total": total})


@router.get("/ap-invoices")
async def ap_invoices_alias(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    user: dict = Depends(require_perm("finance.ap.read")),
):
    """Alias for /ap-ledger — List AP invoices for compatibility."""
    from core.db import get_db
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if vendor_id:
        q["vendor_id"] = vendor_id
    total = await db.ap_ledgers.count_documents(q)
    skip = (page - 1) * per_page
    items = await db.ap_ledgers.find(q, {"_id": 0}).sort("invoice_date", -1).skip(skip).limit(per_page).to_list(per_page)
    return ok_envelope(items, {"page": page, "per_page": per_page, "total": total})


# ---------------- ALIASES (for legacy/UI compatibility) ----------------
@router.get("/journal-entries")
async def list_journal_entries_alias(
    period: Optional[str] = None,
    source_type: Optional[str] = None,
    coa_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    """Alias for /journals — for compatibility with documentation/UI naming."""
    items, meta = await finance_service.list_journals(
        period=period, source_type=source_type, coa_id=coa_id,
        dim_outlet=dim_outlet, date_from=date_from, date_to=date_to,
        status=status, search=search, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/chart-of-accounts")
async def chart_of_accounts_alias(
    type: Optional[str] = None,
    is_postable: Optional[bool] = None,
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    """Alias for /api/master/chart-of-accounts — for finance-module convenience."""
    from core.db import get_db
    db = get_db()
    q: dict = {"deleted_at": None, "active": True}
    if type:
        q["type"] = type
    if is_postable is not None:
        q["is_postable"] = is_postable
    rows = await db.chart_of_accounts.find(q, {"_id": 0}).sort("code", 1).to_list(500)
    return ok_envelope(rows)


@router.get("/item-pricing")
async def item_pricing_alias(
    item_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    """Alias for /api/inventory/items/pricing/list — Phase 2 multi-period pricing."""
    from core.db import get_db
    db = get_db()
    q: dict = {}
    if item_id:
        q["item_id"] = item_id
    if is_active is not None:
        q["is_active"] = is_active
    total = await db.item_pricings.count_documents(q)
    skip = (page - 1) * per_page
    rows = await db.item_pricings.find(q, {"_id": 0}).sort("effective_from", -1).skip(skip).limit(per_page).to_list(per_page)
    return ok_envelope(rows, {"page": page, "per_page": per_page, "total": total})


# ---------------- BALANCE SHEET / CASHFLOW ----------------
@router.get("/balance-sheet")
async def balance_sheet(
    as_of: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    user: dict = Depends(require_perm("finance.report.balance_sheet")),
):
    return ok_envelope(await balance_sheet_service.balance_sheet(
        as_of=as_of, dim_outlet=dim_outlet,
    ))


@router.get("/cashflow")
async def cashflow(
    period: str,
    dim_outlet: Optional[str] = None,
    user: dict = Depends(require_perm("finance.report.cashflow")),
):
    return ok_envelope(await cashflow_service.cashflow(
        period=period, dim_outlet=dim_outlet,
    ))


# ---------------- VALIDATION QUEUE ----------------
@router.get("/validation-queue")
async def validation_queue(
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("finance.sales.validate")),
):
    items, meta = await finance_service.sales_validation_queue(page=page, per_page=per_page)
    return ok_envelope(items, meta)


# ---------------- ACCOUNTING PERIODS ----------------
@router.get("/periods")
async def list_periods_endpoint(
    year: Optional[int] = None,
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    items = await svc_list_periods(year=year)
    return ok_envelope(items)


@router.get("/periods/{period}")
async def get_period_endpoint(
    period: str,
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    return ok_envelope(await svc_get_period(period))


@router.get("/periods/{period}/closing-checks")
async def closing_checks(
    period: str,
    user: dict = Depends(require_perm("finance.period.close_step")),
):
    return ok_envelope(await svc_closing_checks(period))


@router.get("/periods/{period}/tax-settlement/preview")
async def preview_tax_settlement(
    period: str,
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    """Preview what tax settlement JE WOULD be created — for pre-close display in wizard."""
    return ok_envelope(await svc_preview_tax_settlement(period))


@router.get("/periods/{period}/tax-settlement")
async def get_tax_settlement(
    period: str,
    user: dict = Depends(require_perm("finance.journal_entry.read")),
):
    """Get tax settlement JE for the period (if exists)."""
    db = get_db()
    reference_key = f"tax_settlement_{period}"
    je = await db.journal_entries.find_one({
        "reference_key": reference_key,
        "deleted_at": None,
    })
    if je:
        return ok_envelope(serialize(je))
    return ok_envelope(None)


@router.post("/periods/{period}/close")
async def close_period(
    period: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("finance.period.close_step")),
):
    return ok_envelope(await svc_close_period(
        period, user=user, reason=payload.get("reason"),
    ))


@router.post("/periods/{period}/lock")
async def lock_period(
    period: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("finance.period.lock")),
):
    return ok_envelope(await svc_lock_period(
        period, user=user, reason=payload.get("reason"),
    ))


@router.post("/periods/{period}/unlock")
async def unlock_period(
    period: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.period.unlock")),
):
    return ok_envelope(await svc_reopen_period(
        period, user=user, reason=payload.get("reason", ""),
    ))


# Phase 3 — quick lock-check endpoint (no permission required beyond auth)
@router.get("/periods/{period}/lock-status")
async def period_lock_status(
    period: str,
    user: dict = Depends(current_user),
):
    """Lightweight status check for UI banners: locked/closed/open + reason.

    Available to any authenticated user so frontend forms (Daily Sales, GR, JE,
    Payment) can show a guard banner before submit. Falls back to
    {open, locked:false, closed:false} if period doesn't exist.
    """
    return ok_envelope(await svc_is_period_locked(period))
