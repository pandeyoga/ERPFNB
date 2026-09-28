"""/api/anomalies router — Phase 7D Real-Time Anomaly Detection."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import NotFoundError, ok_envelope
from core.security import current_user, require_any_perm
from services import anomaly_service

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


# Users who can READ the feed: finance team + procurement team + executive + admin
READ_PERMS = [
    "anomaly.feed.read",
    "finance.sales.validate",
    "finance.report.profit_loss",
    "finance.report.cashflow",
    "executive.dashboard.read",
    "procurement.pr.approve",
    "procurement.po.approve",
]


TRIAGE_PERMS = [
    "anomaly.triage",
    "finance.sales.validate",
    "finance.report.profit_loss",
    "procurement.po.approve",
]


@router.get("")
async def list_anomalies(
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    items, meta = await anomaly_service.list_events(
        type=type, severity=severity, status=status,
        outlet_id=outlet_id, vendor_id=vendor_id,
        date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/summary")
async def anomaly_summary(
    days: int = Query(7, ge=1, le=90),
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    data = await anomaly_service.summary(days=days)
    return ok_envelope(data)


@router.get("/last-scan")
async def last_scan_info(user: dict = Depends(require_any_perm(*READ_PERMS))):
    """Return metadata about the last completed anomaly scan."""
    from core.db import get_db
    db = get_db()
    doc = await db.system_settings.find_one({"key": "last_anomaly_scan"})
    if not doc:
        return ok_envelope(None)
    return ok_envelope({
        "last_scan_at": doc.get("value"),
        "counts": doc.get("counts", {}),
        "updated_at": doc.get("updated_at"),
    })


@router.get("/types")
async def list_anomaly_types(user: dict = Depends(current_user)):
    """Catalog of anomaly types for frontend filter dropdowns."""
    return ok_envelope([
        {"value": t, "label": anomaly_service.ANOMALY_TYPE_LABELS.get(t, t)}
        for t in anomaly_service.ANOMALY_TYPES
    ])


@router.get("/thresholds/resolve")
async def resolve_thresholds_endpoint(
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    on_date: Optional[str] = None,
    user: dict = Depends(require_any_perm(*READ_PERMS, "admin.business_rules.manage")),
):
    """Resolve the currently-effective thresholds for a scope — debug/admin helper."""
    th = await anomaly_service.resolve_thresholds(
        outlet_id=outlet_id, brand_id=brand_id, on_date=on_date,
    )
    return ok_envelope(th)


@router.get("/thresholds")
async def list_threshold_rules(
    user: dict = Depends(require_any_perm("admin.business_rules.manage", "finance.report.profit_loss")),
):
    """List all anomaly_threshold_policy business rules (all scopes)."""
    from services import business_rules_service
    items = await business_rules_service.list_rules(
        rule_type="anomaly_threshold_policy",
    )
    return ok_envelope(items)


@router.post("/thresholds")
async def upsert_threshold_rule(
    payload: dict = Body(...),
    user: dict = Depends(require_any_perm("admin.business_rules.manage")),
):
    """Create or update an anomaly threshold override for a scope.

    Payload: {
        scope_type: "group" | "brand" | "outlet",
        scope_id: "*" | brand_id | outlet_id,
        rule_data: { sales_deviation?: {...}, vendor_price_spike?: {...}, ... },
        name?: str,
    }
    Updates an existing active rule if one exists for this scope, else creates new.
    """
    from services import business_rules_service
    from core.db import get_db
    db = get_db()
    scope_type = payload.get("scope_type", "group")
    scope_id = payload.get("scope_id", "*")
    rule_data = payload.get("rule_data", {})

    # Check if active rule exists for this scope
    existing = await db.business_rules.find_one({
        "rule_type": "anomaly_threshold_policy",
        "scope_type": scope_type,
        "scope_id": scope_id,
        "active": True,
        "deleted_at": None,
    })
    if existing:
        rule = await business_rules_service.update_rule(
            existing["id"],
            {"rule_data": rule_data, "name": payload.get("name")},
            user=user,
        )
    else:
        rule = await business_rules_service.create_rule(
            {
                "rule_type": "anomaly_threshold_policy",
                "scope_type": scope_type,
                "scope_id": scope_id,
                "rule_data": rule_data,
                "active": True,
                "name": payload.get("name") or f"Anomaly Threshold ({scope_type}/{scope_id})",
            },
            user=user,
        )
    return ok_envelope(rule)


@router.delete("/thresholds/{rule_id}")
async def delete_threshold_rule(
    rule_id: str,
    user: dict = Depends(require_any_perm("admin.business_rules.manage")),
):
    """Delete (soft-delete) a threshold override — reverts to default."""
    from services import business_rules_service
    await business_rules_service.delete_rule(rule_id, user=user)
    return ok_envelope({"deleted": rule_id})


@router.post("/scan")
async def manual_scan(
    payload: dict = Body(default={}),
    user: dict = Depends(require_any_perm(
        "anomaly.scan.trigger",
        "admin.business_rules.manage",
        "finance.sales.validate",
        "finance.report.profit_loss",
    )),
):
    """Trigger a full anomaly scan (admin/finance manager only).
    Body: { as_of_date?: "YYYY-MM-DD", days?: 7, period?: "YYYY-MM" }
    """
    res = await anomaly_service.scan_all(
        as_of_date=payload.get("as_of_date"),
        days=int(payload.get("days", 7)),
        period=payload.get("period"),
        user_id=user["id"],
    )
    # Don't dump all events in response (could be huge) — only return counts + scan meta
    return ok_envelope({
        "as_of_date": res["as_of_date"],
        "period": res["period"],
        "counts": res["counts"],
    })


@router.get("/{anomaly_id}")
async def get_anomaly(
    anomaly_id: str,
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    ev = await anomaly_service.get_event(anomaly_id)
    if not ev:
        raise NotFoundError("Anomaly event")
    return ok_envelope(ev)


@router.post("/{anomaly_id}/triage")
async def triage_anomaly(
    anomaly_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_any_perm(*TRIAGE_PERMS)),
):
    """Acknowledge / mark investigating / resolve / mark false-positive.
    Body: { 
        status: "acknowledged|investigating|resolved|false_positive", 
        note?: "...",
        assigned_to?: "user_id"  # Phase 5C.3
    }
    """
    ev = await anomaly_service.triage_event(
        anomaly_id,
        new_status=payload.get("status", "acknowledged"),
        note=payload.get("note"),
        assigned_to=payload.get("assigned_to"),  # Phase 5C.3
        user=user,
    )
    return ok_envelope(ev)




@router.get("/export/xlsx")
async def export_anomalies_xlsx(
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    """Export anomalies as Excel (.xlsx) file."""
    from fastapi.responses import Response
    from services.excel_reports_service import generate_anomaly_xlsx
    file_bytes = await generate_anomaly_xlsx(
        type=type, severity=severity, status=status,
        outlet_id=outlet_id, vendor_id=vendor_id,
        date_from=date_from, date_to=date_to,
    )
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=anomaly_feed.xlsx"},
    )


# Phase 5C.3: CSV Export endpoint
@router.get("/export/csv")
async def export_anomalies_csv(
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_any_perm(*READ_PERMS)),
):
    """Export anomalies as CSV file."""
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    rows = await anomaly_service.export_to_csv(
        type=type, severity=severity, status=status,
        outlet_id=outlet_id, vendor_id=vendor_id,
        date_from=date_from, date_to=date_to,
    )
    
    if not rows:
        return ok_envelope({"message": "No data to export"})
    
    # Generate CSV
    output = io.StringIO()
    fieldnames = rows[0].keys()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=anomalies_export.csv"}
    )
