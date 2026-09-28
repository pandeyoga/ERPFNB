"""AR receipt (payment) recording."""
from __future__ import annotations

import logging
from core.clock import period_now as _biz_period, today_str as _biz_today  # SSOT-11: WIB business date
from datetime import datetime, timezone

from core.db import get_db, serialize
from models.ar import make_ar_receipt

logger = logging.getLogger("aurora.ar")


async def record_receipt(
    invoice_id: str,
    receipt_date: str | None = None,
    amount: float = 0,
    payment_method: str = "transfer",
    reference: str | None = None,
    bank_account_id: str | None = None,
    notes: str | None = None,
    *,
    user_id: str,
) -> dict:
    db = get_db()
    invoice = await db.ar_invoices.find_one({"id": invoice_id, "deleted_at": None})
    if not invoice:
        raise ValueError("Invoice not found")

    amount = float(amount)
    if amount <= 0:
        from core.exceptions import ValidationError
        raise ValidationError("Amount harus lebih dari 0")

    outstanding = float(invoice.get("outstanding", 0))
    if amount > outstanding + 0.01:
        raise ValueError(f"Amount ({amount}) exceeds outstanding ({outstanding})")

    receipt_date = receipt_date or _biz_today()

    if invoice.get("status") not in ("sent", "partial", "overdue"):
        raise ValueError(f"Invoice berstatus {invoice.get('status')} tidak bisa menerima pembayaran")

    from services import journal_service
    from services._ar.journal import resolve_ar_accounts
    ar_coa_id, _rev, _ppn = await resolve_ar_accounts()
    bank_coa_id = None
    if bank_account_id:
        ba = await db.bank_accounts.find_one({"id": bank_account_id, "deleted_at": None})
        bank_coa_id = ba and ba.get("gl_account_id")
    if not bank_coa_id:
        from services import gl_mapping
        bank_coa_id = await gl_mapping.resolve("bank_default")

    receipt = make_ar_receipt(
        invoice_id=invoice_id,
        receipt_date=receipt_date,
        amount=amount,
        payment_method=payment_method,
        reference=reference,
        bank_account_id=bank_account_id,
        je_id=None,
        notes=notes,
        created_by=user_id,
    )
    # P0-05: idempotency key = receipt id (event), not invoice id. JE failure aborts.
    je = await journal_service._post_journal(
        entry_date=receipt_date,
        description=f"Receipt {invoice['invoice_no']} from {invoice.get('customer_name', '')}",
        source_type="ar_receipt",
        source_id=receipt["id"],
        lines=[
            {"coa_id": bank_coa_id, "dr": amount, "cr": 0.0, "memo": f"Receipt {invoice['invoice_no']}"},
            {"coa_id": ar_coa_id, "dr": 0.0, "cr": amount, "memo": f"Clear AR {invoice['invoice_no']}"},
        ],
        user_id=user_id,
    )
    receipt["je_id"] = je["id"]
    await db.ar_receipts.insert_one(receipt)

    new_paid = round(float(invoice.get("paid_amount", 0)) + amount, 2)
    new_outstanding = round(float(invoice.get("total_amount", 0)) - new_paid, 2)
    new_status = "paid" if new_outstanding <= 0.01 else "partial"
    now = datetime.now(timezone.utc).isoformat()
    await db.ar_invoices.update_one(
        {"id": invoice_id},
        {"$set": {"paid_amount": new_paid, "outstanding": max(0, new_outstanding), "status": new_status, "updated_at": now},
         "$push": {"receipts": receipt["id"]}}
    )
    return serialize(receipt)
