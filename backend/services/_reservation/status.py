"""Reservation status transitions, reschedule and deposit management."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from core.db import get_db
from models.reservation import DEPOSIT_STATUSES
from services._reservation._common import _now, logger
from services._reservation.crud import get_reservation


async def update_status(
    reservation_id: str,
    new_status: str,
    *,
    user_id: str,
    reason: Optional[str] = None,
) -> Optional[dict]:
    """Transition reservation status."""
    db = get_db()
    allowed_transitions = {
        "pending":      ["confirmed", "waitlist", "cancelled"],
        "waitlist":     ["confirmed", "pending", "cancelled"],
        "confirmed":    ["completed", "no_show", "cancelled"],
        "rescheduled":  ["confirmed", "cancelled"],
        "cancelled":    [],
        "completed":    [],
        "no_show":      [],
    }
    doc = await db.reservations.find_one({"id": reservation_id, "deleted_at": None})
    if not doc:
        return None
    current = doc.get("status", "pending")
    if new_status not in allowed_transitions.get(current, []):
        from core.exceptions import ValidationError
        raise ValidationError(
            f"Tidak dapat mengubah status dari '{current}' ke '{new_status}'"
        )

    # Cancellation deadline policy
    if new_status == "cancelled" and current in ["pending", "confirmed"]:
        reservation_date_str = doc.get("reservation_date")
        reservation_time_str = doc.get("reservation_time")
        if reservation_date_str and reservation_time_str:
            from datetime import date, time
            res_date = date.fromisoformat(reservation_date_str)
            res_time_parts = reservation_time_str.split(":")
            res_time = time(int(res_time_parts[0]), int(res_time_parts[1]))
            reservation_datetime = datetime.combine(res_date, res_time)
            outlet_id = doc.get("outlet_id")
            settings = await db.system_configs.find_one({
                "type": "reservation_settings",
                "outlet_id": outlet_id
            })
            cancellation_hours = settings.get("cancellation_deadline_hours", 2) if settings else 2
            now_dt = datetime.now()
            deadline = reservation_datetime - timedelta(hours=cancellation_hours)
            if now_dt > deadline:
                from core.exceptions import ValidationError
                hours_left = (reservation_datetime - now_dt).total_seconds() / 3600
                if hours_left < 0:
                    raise ValidationError(
                        "Tidak dapat membatalkan: Reservasi sudah lewat. "
                        "Silakan hubungi outlet untuk refund/reschedule."
                    )
                else:
                    raise ValidationError(
                        f"Deadline pembatalan terlewat: Harus membatalkan minimal {cancellation_hours} jam sebelum reservasi. "
                        f"Tersisa {hours_left:.1f} jam. Silakan hubungi outlet langsung untuk pembatalan darurat."
                    )

    now = _now()
    updates: dict = {"status": new_status, "updated_at": now, "updated_by": user_id}
    if new_status == "confirmed":
        updates["confirmed_at"] = now
        updates["confirmed_by"] = user_id
    elif new_status == "waitlist":
        updates["waitlisted_at"] = now
    elif new_status == "rescheduled":
        updates["rescheduled_at"] = now
        updates["rescheduled_by"] = user_id
        if reason:
            updates["reschedule_reason"] = reason
    elif new_status == "cancelled":
        updates["cancelled_at"] = now
        updates["cancelled_by"] = user_id
        if reason:
            updates["cancellation_reason"] = reason
        if doc.get("deposit_status") == "paid":
            updates["deposit_status"] = "refunded"
    elif new_status == "completed":
        updates["completed_at"] = now
    elif new_status == "no_show":
        if doc.get("deposit_status") == "paid":
            updates["deposit_status"] = "forfeited"
    await db.reservations.update_one({"id": reservation_id}, {"$set": updates})
    return await get_reservation(reservation_id)


async def reschedule_reservation(
    reservation_id: str,
    new_date: str,
    new_time: str,
    *,
    user_id: str,
    reason: Optional[str] = None,
) -> Optional[dict]:
    """Move reservation to new date/time and set status=rescheduled."""
    db = get_db()
    doc = await db.reservations.find_one({"id": reservation_id, "deleted_at": None})
    if not doc:
        return None
    current_status = doc.get("status", "pending")
    reschedulable = ["pending", "confirmed", "waitlist", "rescheduled"]
    if current_status not in reschedulable:
        from core.exceptions import ValidationError
        raise ValidationError(
            f"Reservasi dengan status '{current_status}' tidak dapat dijadwalkan ulang."
        )
    now = _now()
    history_entry = {
        "old_date": doc.get("reservation_date"),
        "old_time": doc.get("reservation_time"),
        "new_date": new_date,
        "new_time": new_time,
        "reason": reason,
        "changed_at": now,
        "changed_by": user_id,
    }
    existing_history = doc.get("reschedule_history", []) or []
    await db.reservations.update_one(
        {"id": reservation_id},
        {"$set": {
            "reservation_date": new_date,
            "reservation_time": new_time,
            "status": "rescheduled",
            "rescheduled_at": now,
            "rescheduled_by": user_id,
            "reschedule_reason": reason,
            "reschedule_history": existing_history + [history_entry],
            "updated_at": now,
            "updated_by": user_id,
        }},
    )
    return await get_reservation(reservation_id)


async def update_deposit(
    reservation_id: str,
    *,
    user_id: str,
    deposit_status: str,
    deposit_amount: Optional[float] = None,
    dp_payment_method: Optional[str] = None,
    dp_reference: Optional[str] = None,
    dp_deadline: Optional[str] = None,
) -> Optional[dict]:
    """Update deposit/DP payment status and details."""
    db = get_db()
    doc = await db.reservations.find_one({"id": reservation_id, "deleted_at": None})
    if not doc:
        return None
    if deposit_status not in DEPOSIT_STATUSES:
        from core.exceptions import ValidationError
        raise ValidationError(f"Status deposit tidak valid: {deposit_status}")
    now = _now()
    updates: dict = {
        "deposit_status": deposit_status,
        "updated_at": now,
        "updated_by": user_id,
    }
    if deposit_amount is not None:
        updates["deposit_amount"] = deposit_amount
    if dp_payment_method is not None:
        updates["dp_payment_method"] = dp_payment_method
    if dp_reference is not None:
        updates["dp_reference"] = dp_reference
    if dp_deadline is not None:
        updates["dp_deadline"] = dp_deadline
    if deposit_status == "paid":
        updates["dp_paid_at"] = now
    await db.reservations.update_one({"id": reservation_id}, {"$set": updates})
    return await get_reservation(reservation_id)


async def send_confirmation(
    reservation_id: str,
    channel: str = "whatsapp",
) -> dict:
    """Stub: mark notification as to be sent."""
    db = get_db()
    res = await get_reservation(reservation_id)
    if not res:
        return {"success": False, "message": "Reservation not found"}
    log_entry = {
        "type": "reservation_confirmed",
        "channel": channel,
        "recipient": res.get("customer_phone"),
        "reservation_id": reservation_id,
        "sent_at": None,
        "status": "pending",
        "message": (
            f"Halo {res.get('customer_name')}, reservasi Anda DIKONFIRMASI! "
            f"Tanggal: {res.get('reservation_date')} pukul {res.get('reservation_time')} "
            f"untuk {res.get('pax')} orang. Kami tunggu kedatangan Anda."
        ),
        "created_at": _now(),
    }
    await db.notification_queue.insert_one(log_entry)
    return {"success": True, "message": f"Konfirmasi dijadwalkan via {channel}"}
