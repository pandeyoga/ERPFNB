"""AR Ledger models — Sprint 2.

Covers:
- ARCustomer: customer master (B2B channel, GoFood, GrabFood, etc.)
- ARInvoice: invoice to customer
- ARInvoiceLine: invoice line items
- ARReceipt: payment received against invoice
"""
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


AR_CHANNELS = [
    {"code": "b2b",        "name": "B2B / Catering"},
    {"code": "gofood",     "name": "GoFood"},
    {"code": "grabfood",   "name": "GrabFood"},
    {"code": "shopee",     "name": "ShopeeFood"},
    {"code": "gojek",      "name": "GoJek / GoPay"},
    {"code": "bank_payout","name": "Bank Payout Aggregator"},
    {"code": "other",      "name": "Lainnya"},
]

INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "overdue", "cancelled"]


def make_ar_invoice(
    *,
    invoice_no: str,
    customer_id: Optional[str],
    customer_name: str,
    customer_npwp: Optional[str],
    customer_address: Optional[str],
    channel: str,
    invoice_date: str,          # YYYY-MM-DD
    due_date: str,              # YYYY-MM-DD
    lines: list,                # [{description, qty, unit_price, discount, dpp, ppn}]
    subtotal: float,
    tax_amount: float,
    total_amount: float,
    outlet_id: Optional[str],
    period: str,                # YYYY-MM
    notes: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "invoice_no": invoice_no,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_npwp": customer_npwp,
        "customer_address": customer_address,
        "channel": channel,
        "invoice_date": invoice_date,
        "due_date": due_date,
        "lines": lines,
        "subtotal": round(subtotal, 2),
        "tax_amount": round(tax_amount, 2),
        "total_amount": round(total_amount, 2),
        "paid_amount": 0.0,
        "outstanding": round(total_amount, 2),
        "outlet_id": outlet_id,
        "period": period,
        "status": "draft",
        "pdf_url": None,
        "pdf_generated_at": None,
        "sent_at": None,
        "reminders_sent": 0,
        "last_reminder_at": None,
        "notes": notes,
        "je_id": None,
        "receipts": [],
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": created_by,
    }


def make_ar_receipt(
    *,
    invoice_id: str,
    receipt_date: str,          # YYYY-MM-DD
    amount: float,
    payment_method: str,
    reference: Optional[str],
    bank_account_id: Optional[str],
    je_id: Optional[str],
    notes: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "invoice_id": invoice_id,
        "receipt_date": receipt_date,
        "amount": round(amount, 2),
        "payment_method": payment_method,
        "reference": reference,
        "bank_account_id": bank_account_id,
        "je_id": je_id,
        "notes": notes,
        "created_at": now,
        "created_by": created_by,
    }


def make_ar_customer(
    *,
    name: str,
    channel: str,
    npwp: Optional[str],
    address: Optional[str],
    contact_person: Optional[str],
    phone: Optional[str],
    email: Optional[str],
    credit_terms_days: int,
    notes: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "channel": channel,
        "npwp": npwp,
        "address": address,
        "contact_person": contact_person,
        "phone": phone,
        "email": email,
        "credit_terms_days": credit_terms_days or 30,
        "total_outstanding": 0.0,
        "notes": notes,
        "is_active": True,
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": created_by,
    }
