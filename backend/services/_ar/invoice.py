"""AR Invoice CRUD (create, list, get, update, send)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.constants import PPN_DEFAULT_RATE
from core.db import get_db, serialize
from models.ar import make_ar_invoice
from services._ar.journal import _post_ar_je

logger = logging.getLogger("aurora.ar")


async def _next_invoice_no() -> str:
    db = get_db()
    year = datetime.now(timezone.utc).year
    key = f"AR_INV_SEQ_{year}"
    result = await db.system_settings.find_one_and_update(
        {"key": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = result.get("seq", 1) if result else 1
    return f"INV-{year}-{str(seq).zfill(5)}"


async def create_invoice(payload: dict, *, user_id: str) -> dict:
    from core.exceptions import ValidationError
    db = get_db()
    if not payload.get("lines"):
        raise ValidationError("Minimal 1 line item diperlukan")
    invoice_no = payload.get("invoice_no") or await _next_invoice_no()
    invoice_date = payload.get("invoice_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    period = invoice_date[:7]

    lines = []
    subtotal = 0.0
    for ln in payload.get("lines", []):
        qty = float(ln.get("qty", 1))
        unit_price = float(ln.get("unit_price", 0))
        discount = float(ln.get("discount", 0))
        dpp = qty * unit_price - discount
        ppn_rate = float(ln.get("ppn_rate", PPN_DEFAULT_RATE)) if ln.get("include_ppn") else 0
        ppn = round(dpp * ppn_rate, 2)
        subtotal += dpp
        lines.append({
            "description": ln.get("description", ""),
            "qty": qty,
            "unit_price": unit_price,
            "discount": discount,
            "dpp": round(dpp, 2),
            "ppn_rate": ppn_rate,
            "ppn": ppn,
        })

    tax_amount = sum(ln["ppn"] for ln in lines)
    total = subtotal + tax_amount

    customer_id = payload.get("customer_id")
    customer_name = payload.get("customer_name", "")
    if customer_id and not customer_name:
        cust = await db.ar_customers.find_one({"id": customer_id})
        customer_name = (cust or {}).get("name", "")

    credit_days = int(payload.get("credit_terms_days", 30) or 30)
    try:
        inv_dt = datetime.strptime(invoice_date, "%Y-%m-%d")
        due_date = (inv_dt + timedelta(days=credit_days)).strftime("%Y-%m-%d")
    except Exception:
        due_date = invoice_date

    doc = make_ar_invoice(
        invoice_no=invoice_no,
        customer_id=customer_id,
        customer_name=customer_name,
        customer_npwp=payload.get("customer_npwp"),
        customer_address=payload.get("customer_address"),
        channel=payload.get("channel", "b2b"),
        invoice_date=invoice_date,
        due_date=payload.get("due_date") or due_date,
        lines=lines,
        subtotal=round(subtotal, 2),
        tax_amount=round(tax_amount, 2),
        total_amount=round(total, 2),
        outlet_id=payload.get("outlet_id"),
        period=period,
        notes=payload.get("notes"),
        created_by=user_id,
    )
    await db.ar_invoices.insert_one(doc)
    if payload.get("auto_post"):
        await _post_ar_je(doc, user_id=user_id)
    return serialize(doc)


async def list_invoices(
    *,
    period: Optional[str] = None,
    status: Optional[str] = None,
    channel: Optional[str] = None,
    customer_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list, dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if period:
        q["period"] = period
    if status:
        q["status"] = status
    if channel:
        q["channel"] = channel
    if customer_id:
        q["customer_id"] = customer_id
    skip = (page - 1) * per_page
    items = await db.ar_invoices.find(q).sort([("invoice_date", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.ar_invoices.count_documents(q)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = []
    for inv in items:
        d = serialize(inv)
        if d["status"] not in ("paid", "cancelled") and d.get("due_date", today) < today:
            d["status"] = "overdue"
        result.append(d)
    return result, {"page": page, "per_page": per_page, "total": total}


async def get_invoice(invoice_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.ar_invoices.find_one({"id": invoice_id, "deleted_at": None})
    if not doc:
        return None
    d = serialize(doc)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if d["status"] not in ("paid", "cancelled") and d.get("due_date", today) < today:
        d["status"] = "overdue"
    return d


async def mark_sent(invoice_id: str, *, user_id: str) -> dict:
    db = get_db()
    doc = await db.ar_invoices.find_one({"id": invoice_id})
    if not doc:
        raise ValueError("Invoice not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.ar_invoices.update_one({"id": invoice_id}, {"$set": {"status": "sent", "sent_at": now, "updated_at": now}})
    fresh = await db.ar_invoices.find_one({"id": invoice_id})
    if fresh and not fresh.get("je_id"):
        await _post_ar_je(fresh, user_id=user_id)
    return await get_invoice(invoice_id)


async def update_invoice(invoice_id: str, payload: dict, *, user_id: str) -> Optional[dict]:
    """Update draft invoice fields.

    Recomputes derived totals when `lines` change, and `period` when
    `invoice_date` changes, so the stored invoice stays internally consistent
    (RC-7: avoid subtotal/tax/total drift). Draft-only.
    """
    db = get_db()
    invoice = await db.ar_invoices.find_one({"id": invoice_id, "deleted_at": None})
    if not invoice:
        return None
    if invoice.get("status") not in ("draft",):
        raise ValueError("Hanya invoice berstatus draft yang bisa diedit")

    allowed = ["customer_name", "customer_npwp", "customer_address", "channel",
               "invoice_date", "due_date", "lines", "notes", "outlet_id"]
    upd = {k: v for k, v in payload.items() if k in allowed}

    # Recompute line-derived amounts + totals when lines are edited
    if "lines" in upd:
        from core.exceptions import ValidationError
        raw_lines = upd.get("lines") or []
        if not raw_lines:
            raise ValidationError("Minimal 1 line item diperlukan")
        lines = []
        subtotal = 0.0
        for ln in raw_lines:
            qty = float(ln.get("qty", 1))
            unit_price = float(ln.get("unit_price", 0))
            discount = float(ln.get("discount", 0))
            dpp = qty * unit_price - discount
            ppn_rate = float(ln.get("ppn_rate", PPN_DEFAULT_RATE)) if ln.get("include_ppn") else 0
            ppn = round(dpp * ppn_rate, 2)
            subtotal += dpp
            lines.append({
                "description": ln.get("description", ""),
                "qty": qty,
                "unit_price": unit_price,
                "discount": discount,
                "dpp": round(dpp, 2),
                "ppn_rate": ppn_rate,
                "ppn": ppn,
            })
        tax_amount = sum(ln["ppn"] for ln in lines)
        total = round(subtotal + tax_amount, 2)
        paid = float(invoice.get("paid_amount", 0) or 0)
        upd["lines"] = lines
        upd["subtotal"] = round(subtotal, 2)
        upd["tax_amount"] = round(tax_amount, 2)
        upd["total_amount"] = total
        upd["outstanding"] = round(total - paid, 2)

    # Keep period in sync with invoice_date
    if upd.get("invoice_date"):
        upd["period"] = str(upd["invoice_date"])[:7]

    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.ar_invoices.update_one({"id": invoice_id}, {"$set": upd})
    return await get_invoice(invoice_id)


async def send_invoice(invoice_id: str, *, user_id: str) -> Optional[dict]:
    """Mark invoice as sent (alias for mark_sent)."""
    return await mark_sent(invoice_id, user_id=user_id)
