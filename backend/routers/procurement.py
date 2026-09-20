"""/api/procurement router."""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import Response

from core.exceptions import ok_envelope
from core.security import current_user, require_perm
from services import (
    po_pdf_service,
    procurement_service,
    procurement_workboard_service,
    vendor_comparison_service,
)

router = APIRouter(prefix="/api/procurement", tags=["procurement"])


# Purchase Requests
@router.get("/prs")
async def list_prs(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.pr.read")),
):
    # Outlet managers see only own outlets; procurement+ see all
    from core.security import get_user_permissions
    user_perms = await get_user_permissions(user)
    outlet_ids = None
    if "*" not in user_perms and "procurement.pr.approve" not in user_perms:
        outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    elif outlet_id:
        outlet_ids = [outlet_id]
    items, meta = await procurement_service.list_prs(
        outlet_ids=outlet_ids, status=status, source=source,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/prs/export/xlsx")
async def export_prs_xlsx(
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    source: Optional[str] = None,
    user: dict = Depends(require_perm("procurement.pr.read")),
):
    """Export PR list as Excel (.xlsx)."""
    from fastapi.responses import Response
    from services.excel_reports_service import generate_pr_xlsx
    file_bytes = await generate_pr_xlsx(status=status, outlet_id=outlet_id, source=source)
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=purchase_requests.xlsx"},
    )


@router.post("/prs")
async def create_pr(payload: dict = Body(...),
                    user: dict = Depends(require_perm("procurement.pr.create"))):
    return ok_envelope(await procurement_service.create_pr(payload, user=user))


@router.post("/prs/{id_}/approve")
async def approve_pr(id_: str, payload: dict = Body(default={}),
                      user: dict = Depends(current_user)):
    # Permission enforced by approval engine (multi-tier)
    return ok_envelope(await procurement_service.approve_pr(
        id_, user=user, note=payload.get("note")))


@router.post("/prs/{id_}/reject")
async def reject_pr(id_: str, payload: dict = Body(...),
                     user: dict = Depends(current_user)):
    # Permission enforced by approval engine
    return ok_envelope(await procurement_service.reject_pr(
        id_, user=user, reason=payload.get("reason", "")))


@router.get("/prs/{id_}/approval-state")
async def pr_approval_state(id_: str,
                             user: dict = Depends(current_user)):
    return ok_envelope(await procurement_service.get_pr_approval_state(id_))


@router.get("/prs/{id_}")
async def get_pr(id_: str, user: dict = Depends(require_perm("procurement.pr.read"))):
    """Get single PR by id."""
    from core.exceptions import AuroraException
    doc = await procurement_service.get_pr_by_id(id_)
    if not doc:
        raise AuroraException("PR tidak ditemukan", status_code=404)
    return ok_envelope(doc)


# Purchase Orders
@router.get("/pos")
async def list_pos(
    status: Optional[str] = None, vendor_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.po.create")),
):
    # Enforce outlet scope for non-admin users
    from core.security import get_user_permissions
    user_perms = await get_user_permissions(user)
    if "*" not in user_perms and "procurement.po.approve" not in user_perms:
        # Restricted user: use their outlet scope, optionally narrowed to one outlet
        user_outlets = user.get("outlet_ids", [])
        if outlet_id and outlet_id in user_outlets:
            pass  # User can filter to their specific outlet
        elif outlet_id and outlet_id not in user_outlets:
            outlet_id = None  # Ignore unauthorized outlet filter
        elif not outlet_id and user_outlets:
            # If user has single outlet, auto-filter to it
            outlet_id = user_outlets[0] if len(user_outlets) == 1 else None
    items, meta = await procurement_service.list_pos(
        status=status, vendor_id=vendor_id, outlet_id=outlet_id,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/pos/export/xlsx")
async def export_pos_xlsx(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    user: dict = Depends(require_perm("procurement.po.create")),
):
    """Export PO list as Excel (.xlsx) — delegates to reports_excel_procurement_service."""
    from io import BytesIO
    from fastapi.responses import Response
    from services.reports_excel_service import generate_po_summary_excel
    result = await generate_po_summary_excel(
        status=status,
        vendor_ids=[vendor_id] if vendor_id else None,
    )
    # generate_po_summary_excel may return Workbook or bytes
    if isinstance(result, bytes):
        file_bytes = result
    else:
        buf = BytesIO()
        result.save(buf)
        file_bytes = buf.getvalue()
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=purchase_orders.xlsx"},
    )


@router.post("/pos")
async def create_po(payload: dict = Body(...),
                    user: dict = Depends(require_perm("procurement.po.create"))):
    return ok_envelope(await procurement_service.create_po(payload, user=user))


@router.post("/pos/{id_}/submit")
async def submit_po(id_: str, user: dict = Depends(require_perm("procurement.po.create"))):
    return ok_envelope(await procurement_service.submit_po_for_approval(id_, user=user))


@router.post("/pos/{id_}/approve")
async def approve_po(id_: str, payload: dict = Body(default={}),
                      user: dict = Depends(current_user)):
    # Permission enforced by approval engine
    return ok_envelope(await procurement_service.approve_po(
        id_, user=user, note=payload.get("note")))


@router.post("/pos/{id_}/reject")
async def reject_po(id_: str, payload: dict = Body(...),
                     user: dict = Depends(current_user)):
    # Permission enforced by approval engine
    return ok_envelope(await procurement_service.reject_po(
        id_, user=user, reason=payload.get("reason", "")))


@router.get("/pos/{id_}/approval-state")
async def po_approval_state(id_: str,
                             user: dict = Depends(current_user)):
    return ok_envelope(await procurement_service.get_po_approval_state(id_))


@router.get("/pos/{id_}")
async def get_po(id_: str, user: dict = Depends(require_perm("procurement.po.create"))):
    """Get single PO by id."""
    from core.exceptions import AuroraException
    doc = await procurement_service.get_po_by_id(id_)
    if not doc:
        raise AuroraException("PO tidak ditemukan", status_code=404)
    return ok_envelope(doc)


@router.post("/pos/{id_}/send")
async def send_po(id_: str, user: dict = Depends(require_perm("procurement.po.send"))):
    return ok_envelope(await procurement_service.send_po(id_, user=user))


@router.post("/pos/{id_}/cancel")
async def cancel_po(id_: str, payload: dict = Body(...),
                     user: dict = Depends(require_perm("procurement.po.cancel"))):
    return ok_envelope(await procurement_service.cancel_po(
        id_, user=user, reason=payload.get("reason", "")))


# Goods Receipts
@router.get("/grs")
async def list_grs(
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.gr.create")),
):
    # Enforce outlet scope for non-admin users
    from core.security import get_user_permissions
    user_perms = await get_user_permissions(user)
    if "*" not in user_perms and "procurement.gr.post" not in user_perms:
        user_outlets = user.get("outlet_ids", [])
        if outlet_id and outlet_id in user_outlets:
            pass
        elif outlet_id and outlet_id not in user_outlets:
            outlet_id = None
        elif not outlet_id and user_outlets:
            outlet_id = user_outlets[0] if len(user_outlets) == 1 else None
    items, meta = await procurement_service.list_grs(
        status=status, outlet_id=outlet_id, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/grs")
async def post_gr(payload: dict = Body(...),
                   user: dict = Depends(require_perm("procurement.gr.post"))):
    return ok_envelope(await procurement_service.post_gr(payload, user=user))


# =================== PHASE 9B - VENDOR COMPARISON ===================

@router.get("/vendor-comparison")
async def vendor_comparison(
    item_ids: str = Query(..., description="Comma-separated item IDs"),
    days: int = Query(180, ge=1, le=730),
    top_vendors_per_item: int = Query(5, ge=1, le=20),
    user: dict = Depends(require_perm("procurement.vendor.read")),
):
    """Side-by-side vendor pricing for a set of items, sourced from posted GRs."""
    ids = [s.strip() for s in item_ids.split(",") if s.strip()]
    return ok_envelope(await vendor_comparison_service.compare(
        ids, days=days, top_vendors_per_item=top_vendors_per_item,
    ))


@router.get("/vendors/{vendor_id}/scorecard")
async def vendor_scorecard(
    vendor_id: str,
    days: int = Query(180, ge=1, le=730),
    user: dict = Depends(require_perm("procurement.vendor.read")),
):
    """Vendor performance scorecard (lead time, on-time%, defect rate, price stability)."""
    return ok_envelope(await vendor_comparison_service.vendor_scorecard(
        vendor_id, days=days,
    ))


# =================== PHASE 9B - KANBAN WORKBOARD ===================

@router.get("/workboard")
async def workboard(
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    days: int = Query(60, ge=1, le=365),
    limit_per_column: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("procurement.pr.read")),
):
    """Kanban-style aggregated workboard. Returns columns + cards (PR + PO)."""
    from core.security import get_user_permissions
    user_perms = await get_user_permissions(user)
    outlet_ids: Optional[list[str]] = None
    if "*" not in user_perms and "procurement.pr.approve" not in user_perms:
        outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    elif outlet_id:
        outlet_ids = [outlet_id]
    return ok_envelope(await procurement_workboard_service.get_workboard(
        outlet_ids=outlet_ids, vendor_id=vendor_id, days=days,
        limit_per_column=limit_per_column,
    ))


@router.get("/workboard/transitions")
async def workboard_transitions(user: dict = Depends(current_user)):
    """Allowed kanban drag-and-drop transitions (UI uses this to know which moves are valid)."""
    return ok_envelope({"transitions": procurement_workboard_service.ALLOWED_TRANSITIONS})


# =================== PHASE 9B - PO PDF + EMAIL ===================

@router.get("/pos/{id_}/pdf")
async def download_po_pdf(id_: str,
                            user: dict = Depends(require_perm("procurement.po.create"))):
    """Generate + download PO as PDF (reportlab)."""
    pdf_bytes = await po_pdf_service.build_po_pdf(id_, user=user)
    # Filename
    db = (await __import_db()).get_db()
    po = await db.purchase_orders.find_one({"id": id_})
    fname = f"PO-{po.get('doc_no', id_[:8])}.pdf" if po else f"PO-{id_[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{fname}"',
            "Cache-Control": "no-cache",
        },
    )


async def __import_db():
    # Helper because we can't import at module level above due to ordering preference
    from core import db as _db
    return _db


def _build_po_email_html(po: dict, vendor: dict | None, message: str) -> str:
    """Build a friendly Indonesian-flavored HTML body for PO email."""
    doc_no = po.get("doc_no", po.get("id", "")[:8])
    grand = po.get("grand_total", 0)
    rp = f"Rp {int(round(float(grand))):,}".replace(",", ".") if grand else "Rp 0"
    vendor_name = (vendor or {}).get("name", "—")
    delivery = po.get("expected_delivery_date") or "—"
    user_msg = (message or "").strip()
    user_msg_html = f'<p style="white-space:pre-wrap;color:#374151;">{user_msg}</p>' if user_msg else ""
    return f"""<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;background:#f9fafb;margin:0;padding:24px;color:#111827;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;color:#ffffff;">
      <h1 style="margin:0;font-size:20px;letter-spacing:.2px;">Purchase Order — {doc_no}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:.9;">FnB Group · FnB Group</p>
    </div>
    <div style="padding:24px;">
      <p>Yth. {vendor_name},</p>
      <p>Terlampir Purchase Order kami dengan rincian sebagai berikut:</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">No. PO</td><td style="padding:6px 0;font-weight:600;">{doc_no}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Total</td><td style="padding:6px 0;font-weight:600;">{rp}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Tanggal Kirim</td><td style="padding:6px 0;">{delivery}</td></tr>
      </table>
      {user_msg_html}
      <p style="margin-top:18px;">Mohon konfirmasi penerimaan PO ini. Untuk pertanyaan, silakan balas email ini.</p>
      <p>Terima kasih,<br/><b>Tim Procurement</b><br/>FnB Group</p>
    </div>
    <div style="padding:14px 24px;background:#f3f4f6;color:#6b7280;font-size:12px;text-align:center;">
      Email ini dikirim otomatis oleh FnB Group ERP. Lampiran PDF berisi PO resmi.
    </div>
  </div>
</body></html>"""


@router.post("/pos/{id_}/email")
async def email_po(id_: str, payload: dict = Body(default={}),
                    user: dict = Depends(require_perm("procurement.po.send"))):
    """Send PO via real email (Resend) with PDF attachment.

    Behavior:
      - Generates the PO PDF via po_pdf_service.
      - Sends through Resend (services/email_service).
      - If RESEND_API_KEY is missing → falls back to MOCKED mode (still logs).
      - Persists the result on the PO doc as email_log[].
    """
    from core.audit import log as audit_log
    from core.db import get_db
    from core.exceptions import NotFoundError
    from services import notification_service, email_service, po_pdf_service
    from datetime import datetime, timezone

    db = get_db()
    po = await db.purchase_orders.find_one({"id": id_, "deleted_at": None})
    if not po:
        raise NotFoundError("PO")

    to_emails: list[str] = [e.strip() for e in (payload.get("to") or []) if isinstance(e, str) and e.strip()]
    subject = (payload.get("subject") or f"Purchase Order {po.get('doc_no', id_[:8])}").strip()
    message = payload.get("message", "") or ""

    # Vendor lookup (for fallback recipient + body context)
    vendor = None
    if po.get("vendor_id"):
        vendor = await db.vendors.find_one({"id": po["vendor_id"]})
    if not to_emails and vendor and vendor.get("email"):
        to_emails = [vendor["email"]]

    sent_at_iso = datetime.now(timezone.utc).isoformat()

    # Build PDF for attachment
    attachment_filename = f"PO-{po.get('doc_no', id_[:8])}.pdf"
    pdf_error: str | None = None
    pdf_bytes: bytes | None = None
    try:
        pdf_bytes = await po_pdf_service.build_po_pdf(id_, user=user)
    except Exception as e:  # noqa: BLE001
        pdf_error = str(e)[:300]

    # Build HTML body
    html_body = _build_po_email_html(po, vendor, message)
    text_body = (
        f"PO {po.get('doc_no','')} — Total Rp {int(round(float(po.get('grand_total',0)))):,}".replace(",", ".")
        + (f"\n\n{message.strip()}" if message and message.strip() else "")
    )

    # Send (or mock-fallback)
    attachments = []
    if pdf_bytes:
        attachments.append({
            "filename": attachment_filename,
            "content": pdf_bytes,
            "content_type": "application/pdf",
        })

    send_result = await email_service.send_email(
        to=to_emails,
        subject=subject,
        html=html_body,
        text=text_body,
        attachments=attachments,
    )

    # Log entry persisted on PO doc
    log_entry = {
        "to": to_emails,
        "subject": subject,
        "message": message,
        "sent_by": user["id"],
        "sent_at": sent_at_iso,
        "channel": "email",
        "status": send_result.get("status", "failed"),
        "provider": send_result.get("provider", "resend"),
        "provider_message_id": send_result.get("provider_message_id"),
        "error": send_result.get("error"),
        "pdf_attached": bool(pdf_bytes),
        "pdf_error": pdf_error,
    }
    await db.purchase_orders.update_one(
        {"id": id_},
        {"$push": {"email_log": log_entry},
         "$set": {"last_emailed_at": sent_at_iso, "updated_at": sent_at_iso}},
    )
    await audit_log(user_id=user["id"], entity_type="purchase_order",
                    entity_id=id_, action="email",
                    reason=f"to={','.join(to_emails)} status={log_entry['status']}")

    # Best-effort: notify procurement team users
    try:
        roles = await db.roles.find({"code": {"$in": ["PROCUREMENT_MGR", "PROC_MGR"]}}).to_list(20)
        role_ids = [r["id"] for r in roles]
        if role_ids:
            target_users = await db.users.find({"role_ids": {"$in": role_ids}}).to_list(50)
            for u in target_users:
                await notification_service.push(
                    user_id=u["id"], type="info",
                    title=f"PO {po.get('doc_no','')} emailed ({log_entry['status']})",
                    body=f"Sent to {', '.join(to_emails) or 'vendor'}",
                    link=f"/procurement/po/{id_}",
                    source_type="purchase_order", source_id=id_,
                )
    except Exception:  # noqa: BLE001
        pass

    return ok_envelope({
        "sent": log_entry["status"] in ("sent", "mocked"),
        "to": to_emails,
        "log": log_entry,
        "provider_real": email_service.is_real_provider_configured(),
    })
