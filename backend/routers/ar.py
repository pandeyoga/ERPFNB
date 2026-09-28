"""AR Ledger router — Sprint 2.

Endpoints:
  # Customers
  GET    /api/ar/customers                      — list AR customers
  POST   /api/ar/customers                      — create customer
  GET    /api/ar/customers/{customer_id}        — get customer detail
  PUT    /api/ar/customers/{customer_id}        — update customer
  
  # Invoices
  GET    /api/ar/invoices                       — list invoices
  POST   /api/ar/invoices                       — create invoice
  GET    /api/ar/invoices/{invoice_id}          — get invoice detail
  PUT    /api/ar/invoices/{invoice_id}          — update invoice (draft only)
  POST   /api/ar/invoices/{invoice_id}/send     — mark invoice as sent
  POST   /api/ar/invoices/{invoice_id}/pdf      — generate PDF
  POST   /api/ar/invoices/{invoice_id}/remind   — send reminder (MOCK for Sprint 2)
  
  # Receipts
  POST   /api/ar/invoices/{invoice_id}/receipt  — record receipt (payment)
  
  # Reports
  GET    /api/ar/aging                          — AR aging report
  GET    /api/ar/reconciliation                 — AR reconciliation
  GET    /api/ar/channels                       — list AR channels
"""
from typing import Optional
import logging

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from core.exceptions import ok_envelope, AuroraException
from core.security import current_user, require_perm
from services import _ar as ar_service
from models.ar import AR_CHANNELS

router = APIRouter(prefix="/api/ar", tags=["ar_ledger"])
logger = logging.getLogger("aurora.ar_router")


# ────────────────────────────────────────────────
# CUSTOMERS
# ────────────────────────────────────────────────

@router.get("/channels")
async def get_ar_channels(user: dict = Depends(current_user)):
    """Return AR channel definitions."""
    return ok_envelope({"channels": AR_CHANNELS})


@router.get("/customers")
async def list_customers(user: dict = Depends(require_perm("finance.ar.read"))):
    """List AR customers."""
    items = await ar_service.list_customers()
    return ok_envelope({"items": items})


@router.post("/customers")
async def create_customer(
    payload: dict,
    user: dict = Depends(require_perm("finance.ar.create")),
):
    """Create AR customer.
    
    Payload:
      name, channel, npwp, address, contact_person, phone, email, credit_terms_days, notes
    """
    customer = await ar_service.create_customer(payload, user_id=user["id"])
    return ok_envelope(customer)


@router.get("/customers/{customer_id}")
async def get_customer(
    customer_id: str,
    user: dict = Depends(require_perm("finance.ar.read")),
):
    """Get customer detail with outstanding invoices summary."""
    from core.db import get_db, serialize
    db = get_db()
    cust = await db.ar_customers.find_one({"id": customer_id})
    if not cust:
        raise AuroraException('Customer not found', code='CUSTOMER_NOT_FOUND', field='customer_id')
    
    # Get outstanding invoices
    invoices = await db.ar_invoices.find({
        "customer_id": customer_id,
        "status": {"$in": ["sent", "partial", "overdue"]},
        "deleted_at": None,
    }).sort("invoice_date", -1).to_list(100)
    
    return ok_envelope({
        "customer": serialize(cust),
        "outstanding_invoices": [serialize(i) for i in invoices],
    })


@router.put("/customers/{customer_id}")
async def update_customer(
    customer_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.ar.update")),
):
    """Update customer."""
    customer = await ar_service.update_customer(customer_id, payload, user_id=user["id"])
    if not customer:
        raise AuroraException('Customer not found', code='CUSTOMER_NOT_FOUND', field='customer_id')
    return ok_envelope(customer)


# ────────────────────────────────────────────────
# INVOICES
# ────────────────────────────────────────────────

@router.get("/invoices")
async def list_invoices(
    customer_id: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("finance.ar.read")),
):
    """List AR invoices."""
    items, meta = await ar_service.list_invoices(
        customer_id=customer_id,
        period=period,
        status=status,
        page=page,
        per_page=per_page,
    )
    return ok_envelope({"items": items, "meta": meta})


@router.post("/invoices")
async def create_invoice(
    payload: dict,
    user: dict = Depends(require_perm("finance.ar.create")),
):
    """Create AR invoice.
    
    Payload:
      customer_id, customer_name, customer_npwp, customer_address, channel,
      invoice_date, due_date, credit_terms_days,
      lines: [{description, qty, unit_price, discount, include_ppn, ppn_rate}],
      outlet_id, notes, auto_post (bool)
    """
    invoice = await ar_service.create_invoice(payload, user_id=user["id"])
    return ok_envelope(invoice)


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    user: dict = Depends(require_perm("finance.ar.read")),
):
    """Get invoice detail."""
    invoice = await ar_service.get_invoice(invoice_id)
    if not invoice:
        raise AuroraException('Invoice not found', code='INVOICE_NOT_FOUND', field='invoice_id')
    return ok_envelope(invoice)


@router.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.ar.update")),
):
    """Update invoice (draft only)."""
    try:
        invoice = await ar_service.update_invoice(invoice_id, payload, user_id=user["id"])
    except ValueError as e:
        raise AuroraException(str(e), code='INVALID_STATUS', field='status')
    if not invoice:
        raise AuroraException('Invoice not found', code='INVOICE_NOT_FOUND', field='invoice_id')
    return ok_envelope(invoice)


@router.post("/invoices/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    user: dict = Depends(require_perm("finance.ar.send")),
):
    """Mark invoice as sent."""
    invoice = await ar_service.send_invoice(invoice_id, user_id=user["id"])
    if not invoice:
        raise AuroraException('Invoice not found', code='INVOICE_NOT_FOUND', field='invoice_id')
    return ok_envelope(invoice)


@router.post("/invoices/{invoice_id}/pdf")
async def generate_invoice_pdf(
    invoice_id: str,
    user: dict = Depends(require_perm("finance.ar.read")),
):
    """Generate invoice PDF and return file."""
    invoice = await ar_service.get_invoice(invoice_id)
    if not invoice:
        raise AuroraException('Invoice not found', code='INVOICE_NOT_FOUND', field='invoice_id')
    
    pdf_bytes = await ar_service.generate_invoice_pdf(invoice_id)
    
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice["invoice_no"]}.pdf"'
        },
    )


@router.post("/invoices/{invoice_id}/remind")
async def send_reminder(
    invoice_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.ar.send")),
):
    """Send payment reminder to customer.
    
    For Sprint 2: MOCKED (no actual Telegram/Email sent).
    Returns success log message.
    
    Payload:
      channel: "email" | "telegram" | "both"
    """
    invoice = await ar_service.get_invoice(invoice_id)
    if not invoice:
        raise AuroraException('Invoice not found', code='INVOICE_NOT_FOUND', field='invoice_id')
    
    channel = payload.get("channel", "email")
    result = await ar_service.send_reminder(invoice_id, channel=channel, user_id=user["id"])
    
    logger.info(
        "AR reminder sent (MOCKED)",
        extra={
            "invoice_id": invoice_id,
            "invoice_no": invoice["invoice_no"],
            "channel": channel,
            "user_id": user["id"],
        },
    )
    
    return ok_envelope(result)


@router.post("/invoices/{invoice_id}/receipt")
async def record_receipt(
    invoice_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.ar.receive")),
):
    """Record payment receipt for invoice.
    
    Payload:
      receipt_date, amount, payment_method, reference, bank_account_id, notes
    """
    invoice = await ar_service.get_invoice(invoice_id)
    if not invoice:
        raise AuroraException('Invoice not found', code='INVOICE_NOT_FOUND', field='invoice_id')
    
    receipt = await ar_service.record_receipt(
        invoice_id=invoice_id,
        receipt_date=payload.get("receipt_date"),
        amount=float(payload.get("amount", 0) or 0),
        payment_method=payload.get("payment_method", "bank_transfer"),
        reference=payload.get("reference"),
        bank_account_id=payload.get("bank_account_id"),
        notes=payload.get("notes"),
        user_id=user["id"],
    )
    
    return ok_envelope(receipt)


@router.post("/invoices/{invoice_id}/write-off")
async def write_off_invoice(
    invoice_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.ar.receive")),
):
    """Write off an uncollectible AR invoice.

    Creates JE: Dr 6500 Beban Piutang Tak Tertagih / Cr 1201 Piutang Usaha.
    Sets invoice status → 'written_off'.

    Payload: { reason: str, write_off_date?: YYYY-MM-DD }
    """
    from services._ar.write_off import write_off_invoice as _write_off
    result = await _write_off(
        invoice_id,
        reason=payload.get("reason", ""),
        write_off_date=payload.get("write_off_date"),
        user_id=user["id"],
    )
    return ok_envelope(result)


@router.get("/invoices/write-off/export/xlsx")
async def export_write_off_xlsx(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_perm("finance.ar.receive")),
):
    """Export AR write-off history as Excel (.xlsx)."""
    from fastapi.responses import Response
    from services.excel_reports_service import generate_ar_writeoff_xlsx
    file_bytes = await generate_ar_writeoff_xlsx(date_from=date_from, date_to=date_to)
    fname = f"ar_writeoff_{date_from or 'all'}.xlsx"
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


# ────────────────────────────────────────────────
# REPORTS
# ────────────────────────────────────────────────

@router.get("/aging")
async def ar_aging(
    as_of: Optional[str] = Query(None, description="YYYY-MM-DD"),
    customer_id: Optional[str] = Query(None),
    user: dict = Depends(require_perm("finance.ar.read")),
):
    """AR Aging report.
    
    Returns:
      - buckets: {current, 1-30, 31-60, 61-90, 90+}
      - by_customer: [{customer_id, customer_name, buckets, total_outstanding}]
    """
    result = await ar_service.aging_report(as_of=as_of, customer_id=customer_id)
    return ok_envelope(result)


@router.get("/reconciliation")
async def ar_reconciliation(
    period: str = Query(..., description="YYYY-MM"),
    user: dict = Depends(require_perm("finance.ar.read")),
):
    """AR Reconciliation report.
    
    Returns:
      - opening_balance
      - invoices_issued
      - receipts_received
      - closing_balance
    """
    result = await ar_service.reconciliation_report(period)
    return ok_envelope(result)
