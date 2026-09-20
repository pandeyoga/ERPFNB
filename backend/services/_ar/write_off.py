"""AR Bad Debt Write-off service.

JE:
  Dr  6500 Beban Piutang Tak Tertagih  (bad debt expense)
  Cr  1201 Piutang Usaha               (reduce AR)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError

logger = logging.getLogger("aurora.ar.write_off")

_COA_AR = "1201"      # Piutang Usaha
_COA_BAD_DEBT = "6500"  # Beban Piutang Tak Tertagih


async def write_off_invoice(
    invoice_id: str,
    *,
    reason: str,
    write_off_date: str | None = None,
    user_id: str,
) -> dict:
    """Write off an overdue/unpaid AR invoice.

    Creates a JE: Dr Bad Debt Expense / Cr AR Receivable.
    Sets invoice status → 'written_off'.
    """
    db = get_db()

    invoice = await db.ar_invoices.find_one({"id": invoice_id, "deleted_at": None})
    if not invoice:
        raise NotFoundError("Invoice tidak ditemukan")

    current_status = invoice.get("status", "")
    if current_status in ("paid", "cancelled", "written_off"):
        raise ConflictError(f"Invoice dengan status '{current_status}' tidak dapat di-write off")

    outstanding = float(invoice.get("outstanding", 0) or 0)
    if outstanding <= 0:
        raise ValidationError("Invoice sudah lunas, tidak perlu di-write off")

    if not reason or not reason.strip():
        raise ValidationError("Alasan write-off wajib diisi")

    wo_date = write_off_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Post JE
    je = None
    try:
        from services import journal_service
        ar_coa = await db.chart_of_accounts.find_one({"code": _COA_AR, "deleted_at": None})
        bd_coa = await db.chart_of_accounts.find_one({"code": _COA_BAD_DEBT, "deleted_at": None})
        if ar_coa and bd_coa:
            je = await journal_service._post_journal(
                entry_date=wo_date,
                description=f"Write-off AR {invoice.get('invoice_no', invoice_id)} — {reason[:80]}",
                source_type="ar_write_off",
                source_id=invoice_id,
                lines=[
                    {
                        "coa_id": bd_coa["id"],
                        "dr": outstanding,
                        "cr": 0.0,
                        "memo": f"Bad debt write-off {invoice.get('invoice_no', '')}",
                    },
                    {
                        "coa_id": ar_coa["id"],
                        "dr": 0.0,
                        "cr": outstanding,
                        "memo": f"Clear AR {invoice.get('invoice_no', '')} (write-off)",
                    },
                ],
                user_id=user_id,
            )
        else:
            logger.warning("write_off: COA 1201 or 6500 not found — JE skipped")
    except Exception as e:
        logger.error("write_off JE failed: %s", e)

    now = datetime.now(timezone.utc).isoformat()
    await db.ar_invoices.update_one(
        {"id": invoice_id},
        {
            "$set": {
                "status": "written_off",
                "outstanding": 0.0,
                "write_off_date": wo_date,
                "write_off_reason": reason,
                "write_off_je_id": je["id"] if je else None,
                "write_off_by": user_id,
                "updated_at": now,
            }
        },
    )

    return {
        "invoice_id": invoice_id,
        "invoice_no": invoice.get("invoice_no", ""),
        "written_off_amount": outstanding,
        "write_off_date": wo_date,
        "je_id": je["id"] if je else None,
        "status": "written_off",
    }
