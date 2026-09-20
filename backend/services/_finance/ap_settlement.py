"""AP settlement — single write-path for 'a GR got paid' (goods_receipts + ap_ledgers)."""
from __future__ import annotations

from datetime import datetime, timezone


async def apply_gr_payment(db, *, gr_id: str, amount: float, payment_ref: str | None = None,
                           payment_id: str | None = None, payment_date: str | None = None) -> None:
    """Increase GR paid_amount and reduce the linked ap_ledgers balance atomically per doc."""
    now = datetime.now(timezone.utc).isoformat()
    amount = float(amount or 0)
    gr = await db.goods_receipts.find_one({"id": gr_id})
    if gr:
        paid_so_far = round(float(gr.get("paid_amount", 0) or 0) + amount, 2)
        gr_total = float(gr.get("grand_total", 0) or 0)
        gr_status = "paid" if paid_so_far >= gr_total - 0.5 else "partial"
        await db.goods_receipts.update_one({"id": gr_id}, {"$set": {
            "paid_amount": paid_so_far,
            "payment_status": gr_status,
            "paid_at": now if gr_status == "paid" else gr.get("paid_at"),
            "updated_at": now,
        }})

    ap = await db.ap_ledgers.find_one({"gr_id": gr_id, "deleted_at": None})
    if not ap:
        return
    new_balance = round(max(0.0, float(ap.get("balance", 0) or 0) - amount), 2)
    ap_status = "paid" if new_balance <= 0.5 else "partial"
    await db.ap_ledgers.update_one({"id": ap["id"]}, {
        "$set": {"balance": new_balance, "status": ap_status, "updated_at": now,
                 "paid_at": now if ap_status == "paid" else ap.get("paid_at")},
        "$push": {"payments": {"payment_id": payment_id, "amount": round(amount, 2),
                               "payment_ref": payment_ref, "payment_date": payment_date, "at": now}},
    })
