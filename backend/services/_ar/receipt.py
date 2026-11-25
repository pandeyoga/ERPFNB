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
        from core.exceptions import NotFoundError
        raise NotFoundError("Invoice")

    amount = float(amount)
    if amount <= 0:
        from core.exceptions import ValidationError
        raise ValidationError("Amount harus lebih dari 0")

    outstanding = float(invoice.get("outstanding", 0))
    if amount > outstanding + 0.01:
        from core.exceptions import ValidationError
        raise ValidationError(f"Nominal ({amount:,.0f}) melebihi sisa tagihan ({outstanding:,.0f})", field="amount")

    receipt_date = receipt_date or _biz_today()

    if invoice.get("status") not in ("sent", "partial", "overdue"):
        from core.exceptions import ValidationError
        raise ValidationError(f"Invoice berstatus {invoice.get('status')} tidak bisa menerima pembayaran",
                              code="INVOICE_STATUS")

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

    # FIN-01: claim the amount on the invoice atomically BEFORE posting. Concurrent receipts
    # (double click, retry, bank feed) can no longer each read the same `outstanding` and post N JEs.
    from pymongo import ReturnDocument
    now = datetime.now(timezone.utc).isoformat()
    claimed = await db.ar_invoices.find_one_and_update(
        {"id": invoice_id, "deleted_at": None, "status": {"$in": ["sent", "partial", "overdue"]},
         "outstanding": {"$gte": round(amount - 0.01, 2)}},
        {"$inc": {"paid_amount": amount, "outstanding": -amount}, "$set": {"updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        from core.exceptions import ConflictError
        raise ConflictError("Saldo invoice berubah (pembayaran lain sedang/sudah diproses) — muat ulang data")

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
    try:
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
    except Exception:
        await db.ar_invoices.update_one({"id": invoice_id},
                                        {"$inc": {"paid_amount": -amount, "outstanding": amount}})
        raise
    receipt["je_id"] = je["id"]
    await db.ar_receipts.insert_one(receipt)

    new_outstanding = round(float(claimed.get("outstanding", 0)), 2)
    new_status = "paid" if new_outstanding <= 0.01 else "partial"
    await db.ar_invoices.update_one(
        {"id": invoice_id},
        {"$set": {"paid_amount": round(float(claimed.get("paid_amount", 0)), 2),
                  "outstanding": max(0.0, new_outstanding), "status": new_status, "updated_at": now},
         "$push": {"receipts": receipt["id"]}}
    )
    return serialize(receipt)
