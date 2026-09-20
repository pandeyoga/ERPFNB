"""AR journal entry posting helpers."""
from __future__ import annotations

import logging
from typing import Optional

from core.db import get_db

logger = logging.getLogger("aurora.ar")


async def _post_ar_je(invoice: dict, *, user_id: str) -> Optional[dict]:
    """Post AR opening JE: Dr AR Receivable, Cr Revenue + Cr PPN Payable."""
    try:
        db = get_db()
        ar_coa = await db.chart_of_accounts.find_one({"code": "1201", "deleted_at": None})
        # Revenue account: prefer 4101, fall back to the canonical revenue codes that
        # actually exist in this chart of accounts (4000 "Pendapatan" / 4001 Revenue - Food).
        rev_coa = None
        for rev_code in ("4101", "4000", "4001"):
            rev_coa = await db.chart_of_accounts.find_one({"code": rev_code, "deleted_at": None})
            if rev_coa:
                break
        if not ar_coa or not rev_coa:
            logger.warning("AR JE skipped: missing CoA (ar=%s rev=%s)", bool(ar_coa), bool(rev_coa))
            return None
        lines = [
            {"coa_id": ar_coa["id"], "dr": invoice["total_amount"], "cr": 0.0, "memo": f"AR {invoice['invoice_no']}"},
            {"coa_id": rev_coa["id"], "dr": 0.0, "cr": invoice["subtotal"], "memo": invoice.get("customer_name")},
        ]
        if invoice.get("tax_amount", 0) > 0:
            ppn_coa = await db.chart_of_accounts.find_one({"code": "2110", "deleted_at": None})
            if ppn_coa:
                lines.append({"coa_id": ppn_coa["id"], "dr": 0.0, "cr": invoice["tax_amount"], "memo": "PPN Keluaran"})
        from services import journal_service
        je = await journal_service._post_journal(
            entry_date=invoice["invoice_date"],
            description=f"AR Invoice {invoice['invoice_no']}",
            source_type="ar_invoice",
            source_id=invoice["id"],
            lines=lines,
            user_id=user_id,
        )
        await get_db().ar_invoices.update_one({"id": invoice["id"]}, {"$set": {"je_id": je["id"]}})
        return je
    except Exception as e:
        logger.warning("AR JE failed: %s", e)
        return None
