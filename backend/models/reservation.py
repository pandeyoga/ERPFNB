"""Reservation models."""
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Reservation statuses
RESERVATION_STATUSES = [
    "pending",      # Just submitted, awaiting confirmation
    "waitlist",     # Slot full — customer on waiting list
    "confirmed",    # Confirmed by outlet staff
    "rescheduled",  # Date/time changed, pending re-confirmation
    "cancelled",    # Cancelled by customer or staff
    "completed",    # Guest arrived and seated
    "no_show",      # Guest did not arrive
]

# DP / Downpayment payment methods
DP_PAYMENT_METHODS = [
    "cash",
    "transfer_bank",
    "qris",
    "ovo",
    "gopay",
    "dana",
    "shopeepay",
    "other",
]

# Reservation sources
RESERVATION_SOURCES = [
    "website",      # Booked from public website
    "whatsapp",     # Booked via WhatsApp
    "phone",        # Booked via phone call
    "walkin",       # Walk-in registration by staff
    "app",          # Booked via mobile app
]

# Deposit statuses
DEPOSIT_STATUSES = [
    "none",         # No deposit required
    "pending",      # Deposit requested but not yet paid
    "paid",         # Deposit paid
    "refunded",     # Deposit refunded (on cancellation)
    "forfeited",    # Deposit forfeited (no-show)
]


def make_reservation_doc(
    *,
    outlet_id: str,
    brand_id: Optional[str],
    reservation_date: str,          # YYYY-MM-DD
    reservation_time: str,          # HH:MM (24h)
    pax: int,
    customer_name: str,
    customer_phone: str,
    customer_email: Optional[str],
    area_preference: Optional[str],
    table_preference: Optional[str],
    special_requests: Optional[dict],  # {type: anniversary|birthday|dietary|other, notes}
    deposit_amount: float,
    deposit_status: str,
    dp_deadline: Optional[str],         # YYYY-MM-DD — deadline customer must pay DP
    dp_payment_method: Optional[str],   # cash, transfer_bank, qris, etc.
    dp_reference: Optional[str],        # transfer ref / transaction ID
    notes: Optional[str],
    source: str,
    member_id: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "outlet_id": outlet_id,
        "brand_id": brand_id,
        "reservation_date": reservation_date,
        "reservation_time": reservation_time,
        "pax": pax,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "area_preference": area_preference,
        "table_preference": table_preference,
        "special_requests": special_requests or {},
        "deposit_amount": deposit_amount,
        "deposit_status": deposit_status,
        "dp_deadline": dp_deadline,
        "dp_payment_method": dp_payment_method,
        "dp_reference": dp_reference,
        "dp_paid_at": None,
        "status": "pending",
        "notes": notes,
        "source": source,
        "member_id": member_id,
        "outlet_notes": None,         # Notes added by outlet staff
        "confirmed_at": None,
        "confirmed_by": None,
        "cancelled_at": None,
        "cancelled_by": None,
        "cancellation_reason": None,
        "completed_at": None,
        "rescheduled_at": None,
        "rescheduled_by": None,
        "reschedule_history": [],       # [{old_date, old_time, changed_at, changed_by}]
        "waitlisted_at": None,
        "notification_log": [],       # [{type, channel, sent_at, status}]
        "created_at": now,
        "updated_at": now,
        "updated_by": created_by,
        "created_by": created_by,
        "deleted_at": None,
    }
