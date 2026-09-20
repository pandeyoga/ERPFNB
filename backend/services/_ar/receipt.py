"""AR receipt (payment) recording."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.db import get_db, serialize
from models.ar import make_ar_receipt
from services._ar.journal import _post_ar_je
from services._ar.invoice import get_invoice

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

    receipt_date = receipt_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    je = None
    try:
        from services import journal_service
        db2 = get_db()
        ar_coa = await db2.chart_of_accounts.find_one({"code": "1201", "deleted_at": None})
        bank_coa = await db2.chart_of_accounts.find_one({"code": "1111", "deleted_at": None})
        if not bank_coa:
            bank_coa = await db2.chart_of_accounts.find_one({"code": "1001", "deleted_at": None})
        if ar_coa and bank_coa:
            je = await journal_service._post_journal(
                entry_date=receipt_date,
                description=f"Receipt {invoice['invoice_no']} from {invoice.get('customer_name', '')}",
                source_type="ar_receipt",
                source_id=invoice_id,
                lines=[
                    {"coa_id": bank_coa["id"], "dr": amount, "cr": 0.0, "memo": f"Receipt {invoice['invoice_no']}"},
                    {"coa_id": ar_coa["id"], "dr": 0.0, "cr": amount, "memo": f"Clear AR {invoice['invoice_no']}"},
                ],
                user_id=user_id,
            )
    except Exception as e:
        logger.warning("receipt JE failed: %s", e)

    receipt = make_ar_receipt(
        invoice_id=invoice_id,
        receipt_date=receipt_date,
        amount=amount,
        payment_method=payment_method,
        reference=reference,
        bank_account_id=bank_account_id,
        je_id=je["id"] if je else None,
        notes=notes,
        created_by=user_id,
    )
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
