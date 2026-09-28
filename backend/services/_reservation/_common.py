"""Shared helpers for reservation_service subpackage."""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db

logger = logging.getLogger("aurora.reservation")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ────────────────────────────────────────────────
# Phone normalization
# ────────────────────────────────────────────────

def _normalize_phone(phone: str) -> str:
    return re.sub(r"[\s\-\(\)]", "", phone or "").strip()


def _phone_variants(phone: str) -> list[str]:
    variants = {phone}
    if phone.startswith("+62"):
        local = "0" + phone[3:]
        variants.add(local)
        variants.add(phone[1:])  # without +
    elif phone.startswith("62"):
        local = "0" + phone[2:]
        variants.add(local)
        variants.add("+" + phone)
    elif phone.startswith("08"):
        variants.add("62" + phone[1:])
        variants.add("+62" + phone[1:])
    return list(variants)


# ────────────────────────────────────────────────
# Member auto-create / link
# ────────────────────────────────────────────────

async def _get_or_create_member(
    customer_name: str,
    customer_phone: str,
    customer_email: Optional[str],
    source: str,
) -> tuple[str, bool]:
    """Return (member_id, created:bool). Creates CRM customer if not found."""
    db = get_db()
    normalized = _normalize_phone(customer_phone)
    variants = _phone_variants(normalized)

    # Try to find existing customer by phone
    existing = await db.customers.find_one({"phone": {"$in": variants}})
    if existing:
        return existing["id"], False

    # Try by email if provided
    if customer_email:
        existing = await db.customers.find_one({"email": customer_email.lower().strip()})
        if existing:
            return existing["id"], False

    # Create new member (CRM customer)
    now = _now()
    member_id = str(uuid.uuid4())
    name_parts = customer_name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    customer_doc = {
        "id": member_id,
        "email": customer_email.lower().strip() if customer_email else f"guest_{member_id[:8]}@reservation.fnbgroup.id",
        "full_name": customer_name.strip(),
        "first_name": first_name,
        "last_name": last_name,
        "phone": normalized if normalized else customer_phone,
        "date_of_birth": None,
        "gender": None,
        "hashed_password": None,
        "points": 0,
        "lifetime_points": 0,
        "tier": "Bronze",
        "tier_expires_at": None,
        "is_active": True,
        "is_verified": False,
        "registration_source": f"reservation_{source}",
        "registration_outlet": None,
        "notes": f"Auto-created from reservation ({source})",
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
    await db.customers.insert_one(customer_doc)
    logger.info("Auto-created member %s from reservation", member_id)
    return member_id, True


# ────────────────────────────────────────────────
# Notification stubs
# ────────────────────────────────────────────────

async def _notify_created(reservation: dict) -> None:
    """Stub: log notification intent. Ready for WA/email API when keys are configured."""
    db = get_db()
    log_entry = {
        "type": "reservation_created",
        "channel": "whatsapp",
        "recipient": reservation.get("customer_phone"),
        "reservation_id": reservation.get("id"),
        "sent_at": None,
        "status": "pending",
        "message": (
            f"Halo {reservation.get('customer_name')}, reservasi Anda di "
            f"{reservation.get('outlet_id')} pada {reservation.get('reservation_date')} "
            f"pukul {reservation.get('reservation_time')} untuk {reservation.get('pax')} orang "
            f"telah diterima. Status: menunggu konfirmasi."
        ),
        "created_at": _now(),
    }
    await db.notification_queue.insert_one(log_entry)
    logger.info("Reservation notification queued for %s", reservation.get("id"))
