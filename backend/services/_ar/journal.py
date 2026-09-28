"""AR journal entry posting helpers."""
from __future__ import annotations

import logging
from typing import Optional

from core.db import get_db

logger = logging.getLogger("aurora.ar")


async def resolve_ar_accounts() -> tuple[str, str, str]:
    """SSOT-14: AR accounts via gl_mapping (ar_receivable/ar_revenue), legacy COA codes as fallback."""
    from services import gl_mapping
    m = await gl_mapping.get_mapping()
    db = get_db()

    async def by_code(*codes):
        for c in codes:
            d = await db.chart_of_accounts.find_one({"code": c, "deleted_at": None})
            if d:
                return d["id"]
        return None

    ar = m.get("ar_receivable") or await by_code("1201")
    rev = m.get("ar_revenue") or await by_code("4101", "4000", "4001") or m.get("revenue_other")
    ppn = m.get("output_vat")
    if not ar or not rev:
        from core.exceptions import ValidationError
        raise ValidationError("GL mapping AR belum lengkap (ar_receivable / ar_revenue)")
    return ar, rev, ppn


async def _post_ar_je(invoice: dict, *, user_id: str) -> Optional[dict]:
    """Post AR opening JE: Dr AR Receivable, Cr Revenue + Cr PPN Keluaran. Failure raises (A6)."""
    ar_id, rev_id, ppn_id = await resolve_ar_accounts()
    lines = [
        {"coa_id": ar_id, "dr": invoice["total_amount"], "cr": 0.0, "memo": f"AR {invoice['invoice_no']}"},
        {"coa_id": rev_id, "dr": 0.0, "cr": invoice["subtotal"], "memo": invoice.get("customer_name")},
    ]
    if invoice.get("tax_amount", 0) > 0:
        lines.append({"coa_id": ppn_id, "dr": 0.0, "cr": invoice["tax_amount"], "memo": "PPN Keluaran"})
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
