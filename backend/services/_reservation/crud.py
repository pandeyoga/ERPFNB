"""Reservation CRUD operations."""
from __future__ import annotations

from typing import Optional

from core.db import get_db, serialize
from models.reservation import make_reservation_doc
from services._reservation._common import (
    _now, _normalize_phone, _phone_variants,
    _get_or_create_member, _notify_created, logger,
)


async def create_reservation(
    payload: dict,
    *,
    created_by: Optional[str] = None,
    auto_link_member: bool = True,
) -> dict:
    """Create a new reservation. Auto-creates CRM member if phone not found."""
    db = get_db()

    phone = _normalize_phone(payload.get("customer_phone", ""))
    outlet_id = payload.get("outlet_id", "")
    reservation_date = payload.get("reservation_date", "")
    reservation_time = payload.get("reservation_time", "")

    # Duplicate prevention
    if phone and outlet_id and reservation_date and reservation_time:
        phone_variants = _phone_variants(phone)
        existing_reservation = await db.reservations.find_one({
            "customer_phone": {"$in": phone_variants},
            "outlet_id": outlet_id,
            "reservation_date": reservation_date,
            "reservation_time": reservation_time,
            "status": {"$in": ["pending", "confirmed"]},
            "deleted_at": None
        })
        if existing_reservation:
            from core.exceptions import ValidationError
            raise ValidationError(
                f"Duplicate reservation: Customer sudah memiliki reservasi pada {reservation_date} pukul {reservation_time} "
                f"(ID: {existing_reservation['id'][:8]}). Silakan pilih waktu lain atau hubungi outlet untuk reschedule.",
                field="reservation_time"
            )

    # Capacity validation
    outlet = await db.outlets.find_one({"id": outlet_id})
    if outlet:
        settings = await db.system_configs.find_one({
            "type": "reservation_settings",
            "outlet_id": outlet_id
        })
        max_pax = settings.get("max_pax") if settings else 100
        reservations_at_slot = await db.reservations.find({
            "outlet_id": outlet_id,
            "reservation_date": reservation_date,
            "reservation_time": reservation_time,
            "status": {"$in": ["pending", "confirmed"]},
            "deleted_at": None
        }).to_list(100)
        total_pax = sum(r.get("pax", 0) for r in reservations_at_slot)
        requested_pax = int(payload.get("pax", 2))
        if total_pax + requested_pax > max_pax:
            from core.exceptions import ValidationError
            raise ValidationError(
                f"Kapasitas penuh: Outlet hanya bisa menampung {max_pax} tamu pada waktu ini. "
                f"Saat ini sudah ada {total_pax} tamu terdaftar. "
                f"Silakan pilih waktu lain atau hubungi outlet untuk waitlist.",
                field="reservation_time"
            )

    # Auto-link or create member
    member_id = payload.get("member_id")
    member_created = False
    if auto_link_member:
        member_id, member_created = await _get_or_create_member(
            customer_name=payload.get("customer_name", ""),
            customer_phone=phone,
            customer_email=payload.get("customer_email"),
            source=payload.get("source", "website"),
        )

    # Resolve outlet/brand
    brand_id = payload.get("brand_id")
    if outlet_id and not brand_id:
        outlet = await db.outlets.find_one({"id": outlet_id})
        if outlet:
            brand_id = outlet.get("brand_id")

    doc = make_reservation_doc(
        outlet_id=outlet_id,
        brand_id=brand_id,
        reservation_date=payload.get("reservation_date", ""),
        reservation_time=payload.get("reservation_time", ""),
        pax=int(payload.get("pax", 2)),
        customer_name=payload.get("customer_name", ""),
        customer_phone=phone,
        customer_email=payload.get("customer_email"),
        area_preference=payload.get("area_preference"),
        table_preference=payload.get("table_preference"),
        special_requests=payload.get("special_requests"),
        deposit_amount=float(payload.get("deposit_amount", 0)),
        deposit_status=payload.get("deposit_status", "none"),
        dp_deadline=payload.get("dp_deadline"),
        dp_payment_method=payload.get("dp_payment_method"),
        dp_reference=payload.get("dp_reference"),
        notes=payload.get("notes"),
        source=payload.get("source", "website"),
        member_id=member_id,
        created_by=created_by,
    )

    await db.reservations.insert_one(doc)
    result = serialize(doc)
    result["member_created"] = member_created
    await _notify_created(result)
    return result


async def list_reservations(
    *,
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    source: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_id:
        q["outlet_id"] = outlet_id
    if status:
        q["status"] = status
    if date_from:
        q["reservation_date"] = q.get("reservation_date", {})
        q["reservation_date"]["$gte"] = date_from
    if date_to:
        q.setdefault("reservation_date", {})
        q["reservation_date"]["$lte"] = date_to
    if source:
        q["source"] = source
    if search:
        q["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * per_page
    items = await db.reservations.find(q).sort(
        [("reservation_date", 1), ("reservation_time", 1)]
    ).skip(skip).limit(per_page).to_list(per_page)
    total = await db.reservations.count_documents(q)
    return [serialize(i) for i in items], {"page": page, "per_page": per_page, "total": total}


async def get_reservation(reservation_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.reservations.find_one({"id": reservation_id, "deleted_at": None})
    if not doc:
        return None
    result = serialize(doc)
    outlet = await db.outlets.find_one({"id": doc.get("outlet_id")})
    result["outlet_name"] = outlet.get("name") if outlet else None
    return result


async def update_reservation(reservation_id: str, payload: dict, *, user_id: str) -> Optional[dict]:
    db = get_db()
    updatable_fields = [
        "reservation_date", "reservation_time", "pax",
        "customer_name", "customer_phone", "customer_email",
        "area_preference", "table_preference", "special_requests",
        "deposit_amount", "deposit_status", "notes", "outlet_notes",
    ]
    updates = {k: v for k, v in payload.items() if k in updatable_fields}
    if not updates:
        return await get_reservation(reservation_id)
    updates["updated_at"] = _now()
    updates["updated_by"] = user_id
    await db.reservations.update_one({"id": reservation_id}, {"$set": updates})
    return await get_reservation(reservation_id)


async def delete_reservation(reservation_id: str, *, user_id: str) -> bool:
    db = get_db()
    await db.reservations.update_one(
        {"id": reservation_id},
        {"$set": {"deleted_at": _now(), "updated_by": user_id}},
    )
    return True
