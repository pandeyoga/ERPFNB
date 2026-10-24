"""AP settlement — single write-path for 'a GR got paid' (goods_receipts + ap_ledgers)."""
from __future__ import annotations

from datetime import datetime, timezone

from core.exceptions import ValidationError


async def apply_gr_payment(db, *, gr_id: str, amount: float, payment_ref: str | None = None,
                           payment_id: str | None = None, payment_date: str | None = None) -> None:
    """FIN-07: idempotent per payment_id, atomic $inc, overpayment rejected (not clamped)."""
    now = datetime.now(timezone.utc).isoformat()
    amount = round(float(amount or 0), 2)
    if amount <= 0:
        return
    ap = await db.ap_ledgers.find_one({"gr_id": gr_id, "deleted_at": None})
    if ap:
        if payment_id and any(p.get("payment_id") == payment_id for p in ap.get("payments", [])):
            return  # already applied
        # Conditional update: only if balance covers the amount and this payment not yet applied
        res = await db.ap_ledgers.update_one(
            {"id": ap["id"], "balance": {"$gte": amount - 0.01}, "payments.payment_id": {"$ne": payment_id}},
            {"$inc": {"balance": -amount},
             "$set": {"updated_at": now},
             "$push": {"payments": {"payment_id": payment_id, "amount": amount,
                                    "payment_ref": payment_ref, "payment_date": payment_date, "at": now}}},
        )
        if res.modified_count == 0:
            fresh = await db.ap_ledgers.find_one({"id": ap["id"]})
            if payment_id and any(p.get("payment_id") == payment_id for p in (fresh or {}).get("payments", [])):
                return
            raise ValidationError(
                f"Pembayaran {amount} melebihi saldo AP {float((fresh or {}).get('balance', 0)):.2f}")
        fresh = await db.ap_ledgers.find_one({"id": ap["id"]})
        bal = round(float(fresh.get("balance", 0) or 0), 2)
        await db.ap_ledgers.update_one({"id": ap["id"]}, {"$set": {
            "balance": bal, "status": "paid" if bal <= 0.01 else "partial",
            "paid_at": now if bal <= 0.01 else fresh.get("paid_at")}})

    gr = await db.goods_receipts.find_one({"id": gr_id})
    if gr:
        await db.goods_receipts.update_one({"id": gr_id}, {"$inc": {"paid_amount": amount}, "$set": {"updated_at": now}})
        gr = await db.goods_receipts.find_one({"id": gr_id})
        paid = round(float(gr.get("paid_amount", 0) or 0), 2)
        status = "paid" if paid >= float(gr.get("grand_total", 0) or 0) - 0.01 else "partial"
        await db.goods_receipts.update_one({"id": gr_id}, {"$set": {
            "paid_amount": paid, "payment_status": status,
            "paid_at": now if status == "paid" else gr.get("paid_at")}})


async def revert_gr_payment(db, *, gr_id: str, amount: float, payment_id: str) -> None:
    """FIN-04: compensation for apply_gr_payment when the bank JE that should follow it fails."""
    now = datetime.now(timezone.utc).isoformat()
    amount = round(float(amount or 0), 2)
    res = await db.ap_ledgers.update_one(
        {"gr_id": gr_id, "deleted_at": None, "payments.payment_id": payment_id},
        {"$inc": {"balance": amount}, "$pull": {"payments": {"payment_id": payment_id}},
         "$set": {"updated_at": now}})
    if res.modified_count:
        ap = await db.ap_ledgers.find_one({"gr_id": gr_id, "deleted_at": None})
        bal = round(float((ap or {}).get("balance", 0) or 0), 2)
        await db.ap_ledgers.update_one({"gr_id": gr_id, "deleted_at": None}, {"$set": {
            "balance": bal, "status": "open" if not (ap or {}).get("payments") else "partial", "paid_at": None}})
        gr = await db.goods_receipts.find_one({"id": gr_id})
        if gr:
            paid = round(float(gr.get("paid_amount", 0) or 0) - amount, 2)
            await db.goods_receipts.update_one({"id": gr_id}, {"$set": {
                "paid_amount": max(paid, 0.0), "payment_status": "partial" if paid > 0.01 else "unpaid",
                "paid_at": None, "updated_at": now}})
