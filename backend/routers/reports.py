"""/api/reports — Phase 7B advanced reports.

Endpoints:
- GET  /api/reports/catalog                       — list of supported dims/metrics
- GET  /api/reports/vendor-scorecard              — multi-vendor ranked scorecard
- GET  /api/reports/vendor-scorecard/{vendor_id}  — single vendor detail
- POST /api/reports/builder/run                   — ad-hoc report run
- GET  /api/reports/pivot                         — 2D matrix
- GET  /api/reports/comparatives                  — MoM/YoY metric comparison
- CRUD /api/reports/saved                         — saved report definitions

Excel Exports (Phase 4.1):
- GET  /api/reports/sales/daily-sales.xlsx        — Daily Sales Summary Excel
- GET  /api/reports/outlet/performance.xlsx       — Outlet Performance Excel
- GET  /api/reports/outlet/fdo-history.xlsx       — FDO History Excel
"""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core.exceptions import ok_envelope
from core.security import current_user, require_any_perm
from core.validators import (
    validate_date_range,
    validate_id_list,
    validate_iso_date,
    validate_period,
)
from services import reports_service
from services.excel_export_service import workbook_to_bytes

router = APIRouter(prefix="/api/reports", tags=["reports"])

# A single permission gate for all reports — Finance / Procurement / Executive personas already
# carry one of these; reuse for simplicity.
_REPORT_READ_PERMS = (
    "finance.report.profit_loss",
    "executive.dashboard.read",
    "procurement.vendor.scorecard",
)


def _scope_brands(user: dict, requested: Optional[list[str]]) -> Optional[list[str]]:
    """Intersect requested brand_ids with user's allowed brand_ids.
    Super-admins ('*') get unrestricted access."""
    if "*" in (user.get("permissions") or []):
        return requested
    user_brand_ids = user.get("brand_ids") or []
    if not user_brand_ids:
        return []
    if requested:
        allowed = [b for b in requested if b in user_brand_ids]
        return allowed if allowed else user_brand_ids
    return user_brand_ids


def _scope_outlets(user: dict, requested: Optional[list[str]]) -> Optional[list[str]]:
    """Intersect requested outlet_ids with user's allowed outlet_ids."""
    if "*" in (user.get("permissions") or []):
        return requested
    user_outlet_ids = user.get("outlet_ids") or []
    if not user_outlet_ids:
        return []
    if requested:
        allowed = [o for o in requested if o in user_outlet_ids]
        return allowed if allowed else user_outlet_ids
    return user_outlet_ids


@router.get("/catalog")
async def catalog(user: dict = Depends(current_user)):
    """Return supported dims + metrics + comparatives. No special perm needed beyond auth."""
    return ok_envelope(reports_service.get_catalog())


# -------- Vendor Scorecard --------
@router.get("/vendor-scorecard")
async def vendor_scorecard_list(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    top: int = Query(20, ge=1, le=200),
    user: dict = Depends(require_any_perm("procurement.vendor.scorecard", *_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.vendor_scorecard(
        vendor_id=None, date_from=date_from, date_to=date_to, top=top,
    ))


@router.get("/vendor-scorecard/{vendor_id}")
async def vendor_scorecard_detail(
    vendor_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_any_perm("procurement.vendor.scorecard", *_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.vendor_scorecard(
        vendor_id=vendor_id, date_from=date_from, date_to=date_to, top=1,
    ))


# -------- Report Builder --------
@router.post("/builder/run")
async def builder_run(
    payload: dict = Body(...),
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.report_builder(
        dimensions=payload.get("dimensions", []),
        metrics=payload.get("metrics", []),
        period_from=payload.get("period_from"),
        period_to=payload.get("period_to"),
        outlet_ids=_scope_outlets(user, payload.get("outlet_ids")),
        brand_ids=_scope_brands(user, payload.get("brand_ids")),
        vendor_ids=payload.get("vendor_ids"),
        category_ids=payload.get("category_ids"),
        sort_by=payload.get("sort_by"),
        sort_dir=payload.get("sort_dir", "desc"),
        limit=int(payload.get("limit", 100)),
    ))


# -------- Pivot --------
@router.get("/pivot")
async def pivot(
    dim_x: str,
    dim_y: str,
    metric: str,
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    return ok_envelope(await reports_service.pivot_matrix(
        dim_x=dim_x, dim_y=dim_y, metric=metric,
        period_from=period_from, period_to=period_to,
    ))


# -------- Comparatives --------
@router.get("/comparatives")
async def comparatives(
    metric: str,
    period: str,
    compare_to: str = "mom",
    outlet_ids: Optional[str] = None,
    brand_ids: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    o_ids = [s for s in outlet_ids.split(",") if s] if outlet_ids else None
    b_ids = [s for s in brand_ids.split(",") if s] if brand_ids else None
    return ok_envelope(await reports_service.comparatives(
        metric=metric, period=period, compare_to=compare_to,
        outlet_ids=_scope_outlets(user, o_ids), brand_ids=_scope_brands(user, b_ids),
    ))


# -------- Saved Reports CRUD --------
@router.get("/saved")
async def list_saved(user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.list_saved_reports(user_id=user["id"]))


@router.get("/saved/{saved_id}")
async def get_saved(saved_id: str,
                     user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.get_saved(saved_id, user_id=user["id"]))


@router.post("/saved")
async def save_report(payload: dict = Body(...),
                       user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.save_report(
        user_id=user["id"],
        name=payload.get("name", ""),
        description=payload.get("description"),
        config=payload.get("config", {}),
        saved_id=payload.get("id"),
        public=bool(payload.get("public", False)),
    ))


@router.patch("/saved/{saved_id}")
async def update_saved(saved_id: str, payload: dict = Body(...),
                        user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.save_report(
        user_id=user["id"],
        name=payload.get("name", ""),
        description=payload.get("description"),
        config=payload.get("config", {}),
        saved_id=saved_id,
        public=bool(payload.get("public", False)),
    ))


@router.delete("/saved/{saved_id}")
async def delete_saved(saved_id: str,
                        user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS))):
    return ok_envelope(await reports_service.delete_saved(saved_id, user_id=user["id"]))


# ============================================================
# EXCEL EXPORTS (Phase 4.1 — Sales & Outlet Reports)
# ============================================================

@router.get("/sales/daily-sales.xlsx")
async def daily_sales_excel(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    outlet_ids: Optional[str] = None,
    brand_ids: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Daily Sales Summary Excel report."""
    o_ids = [s.strip() for s in outlet_ids.split(",") if s.strip()] if outlet_ids else None
    b_ids = [s.strip() for s in brand_ids.split(",") if s.strip()] if brand_ids else None
    
    wb = await reports_service.generate_daily_sales_excel(
        date_from=date_from,
        date_to=date_to,
        outlet_ids=_scope_outlets(user, o_ids),
        brand_ids=_scope_brands(user, b_ids),
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"daily_sales_{date_from or 'all'}_{date_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/outlet/performance.xlsx")
async def outlet_performance_excel(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    outlet_ids: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Outlet Performance Excel report."""
    o_ids = [s.strip() for s in outlet_ids.split(",") if s.strip()] if outlet_ids else None
    
    wb = await reports_service.generate_outlet_performance_excel(
        date_from=date_from,
        date_to=date_to,
        outlet_ids=o_ids,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"outlet_performance_{date_from or 'all'}_{date_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/outlet/fdo-history.xlsx")
async def fdo_history_excel(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    outlet_ids: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate FDO History Excel report."""
    o_ids = [s.strip() for s in outlet_ids.split(",") if s.strip()] if outlet_ids else None
    
    wb = await reports_service.generate_fdo_history_excel(
        date_from=date_from,
        date_to=date_to,
        outlet_ids=o_ids,
        status=status,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"fdo_history_{date_from or 'all'}_{date_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# ============================================================
# INVENTORY REPORTS (Phase 4.2)
# ============================================================

@router.get("/inventory/stock-balance.xlsx")
async def stock_balance_excel(
    outlet_ids: Optional[str] = None,
    category_ids: Optional[str] = None,
    as_of_date: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Stock Balance Excel report."""
    o_ids = [s.strip() for s in outlet_ids.split(",") if s.strip()] if outlet_ids else None
    c_ids = [s.strip() for s in category_ids.split(",") if s.strip()] if category_ids else None
    
    wb = await reports_service.generate_stock_balance_excel(
        outlet_ids=o_ids,
        category_ids=c_ids,
        as_of_date=as_of_date,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"stock_balance_{as_of_date or 'current'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/inventory/stock-movement.xlsx")
async def stock_movement_excel(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    outlet_ids: Optional[str] = None,
    movement_type: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Stock Movement Excel report."""
    o_ids = [s.strip() for s in outlet_ids.split(",") if s.strip()] if outlet_ids else None
    
    wb = await reports_service.generate_stock_movement_excel(
        date_from=date_from,
        date_to=date_to,
        outlet_ids=o_ids,
        movement_type=movement_type,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"stock_movement_{date_from or 'all'}_{date_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/inventory/valuation.xlsx", deprecated=True)
async def inventory_valuation_excel(
    outlet_ids: Optional[str] = None,
    category_ids: Optional[str] = None,
    as_of_date: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """[DEPRECATED] Generate Inventory Valuation Excel report.

    DEPRECATED: use GET /api/reports/inventory-valuation/excel (the path the
    frontend Reports portal uses). Kept for backward compatibility."""
    o_ids = [s.strip() for s in outlet_ids.split(",") if s.strip()] if outlet_ids else None
    c_ids = [s.strip() for s in category_ids.split(",") if s.strip()] if category_ids else None
    
    wb = await reports_service.generate_inventory_valuation_excel(
        outlet_ids=o_ids,
        category_ids=c_ids,
        as_of_date=as_of_date,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"inventory_valuation_{as_of_date or 'current'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# ============================================================
# PROCUREMENT REPORTS (Phase 4.3)
# ============================================================

@router.get("/procurement/po-summary.xlsx")
async def po_summary_excel(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    vendor_ids: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate PO Summary Excel report."""
    v_ids = [s.strip() for s in vendor_ids.split(",") if s.strip()] if vendor_ids else None
    
    wb = await reports_service.generate_po_summary_excel(
        date_from=date_from,
        date_to=date_to,
        vendor_ids=v_ids,
        status=status,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"po_summary_{date_from or 'all'}_{date_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/procurement/gr-summary.xlsx")
async def gr_summary_excel(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    vendor_ids: Optional[str] = None,
    po_ids: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate GR Summary Excel report."""
    v_ids = [s.strip() for s in vendor_ids.split(",") if s.strip()] if vendor_ids else None
    p_ids = [s.strip() for s in po_ids.split(",") if s.strip()] if po_ids else None
    
    wb = await reports_service.generate_gr_summary_excel(
        date_from=date_from,
        date_to=date_to,
        vendor_ids=v_ids,
        po_ids=p_ids,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"gr_summary_{date_from or 'all'}_{date_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/procurement/vendor-performance.xlsx")
async def vendor_performance_excel(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    vendor_ids: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Vendor Performance Excel report."""
    v_ids = [s.strip() for s in vendor_ids.split(",") if s.strip()] if vendor_ids else None
    
    wb = await reports_service.generate_vendor_performance_excel(
        date_from=date_from,
        date_to=date_to,
        vendor_ids=v_ids,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"vendor_performance_{date_from or 'all'}_{date_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# ============================================================
# FINANCE REPORTS (Phase 4.4)
# ============================================================

@router.get("/finance/journal-ledger.xlsx")
async def journal_ledger_excel(
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    coa_id: Optional[str] = None,
    outlet_ids: Optional[str] = None,
    source_type: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Journal Ledger Excel report."""
    pf, pt = validate_date_range(period_from, period_to)
    o_ids = validate_id_list(outlet_ids, field="outlet_ids")
    
    wb = await reports_service.generate_journal_ledger_excel(
        period_from=pf,
        period_to=pt,
        coa_id=coa_id,
        outlet_ids=o_ids,
        source_type=source_type,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"journal_ledger_{pf or 'all'}_{pt or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/finance/trial-balance.xlsx")
async def trial_balance_excel(
    period: str = Query(..., description="Period in YYYY-MM format"),
    dim_outlet: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Trial Balance Excel report for given period."""
    period = validate_period(period, field="period", required=True)
    
    wb = await reports_service.generate_trial_balance_excel(
        period=period,
        dim_outlet=dim_outlet,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"trial_balance_{period}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/finance/ap-aging.xlsx")
async def ap_aging_excel(
    as_of_date: Optional[str] = None,
    vendor_ids: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate AP Aging Excel report."""
    as_of_date = validate_iso_date(as_of_date, field="as_of_date")
    v_ids = validate_id_list(vendor_ids, field="vendor_ids")
    
    wb = await reports_service.generate_ap_aging_excel(
        as_of_date=as_of_date,
        vendor_ids=v_ids,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"ap_aging_{as_of_date or 'current'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# ============================================================
# PHASE 4.5 — REPORT BUILDER EXCEL EXPORT
# ============================================================

class _BuilderXlsxRequest(BaseModel):
    dimensions: list[str]
    metrics: list[str]
    period_from: Optional[str] = None
    period_to: Optional[str] = None
    outlet_ids: Optional[list[str]] = None
    brand_ids: Optional[list[str]] = None
    vendor_ids: Optional[list[str]] = None
    category_ids: Optional[list[str]] = None
    sort_by: Optional[str] = None
    sort_dir: str = "desc"
    limit: int = Field(1000, ge=1, le=5000)
    title: Optional[str] = None


@router.post("/builder/run.xlsx")
async def report_builder_excel(
    payload: _BuilderXlsxRequest,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Excel export for Report Builder (Phase 4.5)."""
    wb = await reports_service.generate_report_builder_excel(
        dimensions=payload.dimensions,
        metrics=payload.metrics,
        period_from=payload.period_from,
        period_to=payload.period_to,
        outlet_ids=payload.outlet_ids,
        brand_ids=payload.brand_ids,
        vendor_ids=payload.vendor_ids,
        category_ids=payload.category_ids,
        sort_by=payload.sort_by,
        sort_dir=payload.sort_dir,
        limit=payload.limit,
        title=payload.title,
    )
    
    file_bytes = workbook_to_bytes(wb)
    safe_title = (payload.title or "report-builder").replace(" ", "_").replace("/", "_")[:60]
    filename = f"{safe_title}_{payload.period_from or 'all'}_{payload.period_to or 'all'}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# PHASE 2 ITEM 3 — CUSTOM P&L FNB GROUP FORMAT
# ============================================================

@router.get("/finance/pl-group.xlsx")
async def pl_group_excel(
    period_from: str = Query(..., description="YYYY-MM"),
    period_to: str = Query(..., description="YYYY-MM"),
    dim_outlet: Optional[str] = None,
    user: dict = Depends(require_any_perm(*_REPORT_READ_PERMS)),
):
    """Generate Custom Profit & Loss in FnB Group format (multi-month layout)."""
    wb = await reports_service.generate_pl_group_excel(
        period_from=period_from,
        period_to=period_to,
        dim_outlet=dim_outlet,
    )
    
    file_bytes = workbook_to_bytes(wb)
    filename = f"profit_loss_group_{period_from}_to_{period_to}.xlsx"
    
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
