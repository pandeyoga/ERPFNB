"""Reservation router.

Public endpoints (no auth):
  POST /api/public/reservations         — create from website

Outlet staff endpoints (auth required):
  GET  /api/reservations                — list reservations
  POST /api/reservations                — create (staff-managed)
  GET  /api/reservations/{id}           — get detail
  PUT  /api/reservations/{id}           — update
  DELETE /api/reservations/{id}         — soft delete
  POST /api/reservations/{id}/status    — transition status
  POST /api/reservations/{id}/notify    — send notification stub

Reports:
  GET  /api/reservations/reports/executive   — exec summary
  GET  /api/reservations/reports/deposits    — finance deposit summary

Admin settings:
  GET  /api/reservations/settings            — get outlet reservation settings
  PUT  /api/reservations/settings/{outlet_id}— update outlet settings
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope, AuroraException
from core.security import current_user, require_any_perm
from services import _reservation as reservation_service

router = APIRouter(tags=["reservations"])


# ────────────────────────────────────────────────
# PUBLIC — no auth
# ────────────────────────────────────────────────

@router.post("/api/public/reservations")
async def create_public_reservation(payload: dict):
    """Public endpoint for website/WA reservation forms."""
    required = ["outlet_id", "reservation_date", "reservation_time", "pax", "customer_name", "customer_phone"]
    for f in required:
        if not payload.get(f):
            raise AuroraException(f"Field '{f}' diperlukan", code="VALIDATION_ERROR", field=f)

    if int(payload.get("pax", 0)) < 1:
        raise AuroraException("Jumlah tamu minimal 1", code="VALIDATION_ERROR", field="pax")

    payload["source"] = payload.get("source", "website")
    result = await reservation_service.create_reservation(payload, created_by=None, auto_link_member=True)
    return ok_envelope({
        "reservation_id": result["id"],
        "status": result["status"],
        "member_created": result.get("member_created", False),
        "member_id": result.get("member_id"),
        "message": "Reservasi Anda berhasil dikirim! Tim kami akan segera mengkonfirmasi.",
    })


# ────────────────────────────────────────────────
# OUTLET STAFF
# ────────────────────────────────────────────────

@router.get("/api/reservations")
async def list_reservations(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_any_perm("reservations.read", "outlet.manager", "reservations.manage")),
):
    items, meta = await reservation_service.list_reservations(
        outlet_id=outlet_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        source=source,
        page=page,
        per_page=per_page,
    )
    return ok_envelope({"items": items, "meta": meta})


@router.post("/api/reservations")
async def create_reservation(
    payload: dict,
    user: dict = Depends(require_any_perm("reservations.create", "outlet.manager", "reservations.manage")),
):
    payload["source"] = payload.get("source", "phone")
    result = await reservation_service.create_reservation(payload, created_by=user["id"], auto_link_member=True)
    return ok_envelope(result)


@router.get("/api/reservations/reports/executive")
async def reservation_executive_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    user: dict = Depends(require_any_perm("executive.view", "reservations.read", "reservations.reports")),
):
    result = await reservation_service.executive_summary(
        date_from=date_from,
        date_to=date_to,
        outlet_id=outlet_id,
    )
    return ok_envelope(result)


@router.get("/api/reservations/reports/deposits")
async def reservation_deposit_summary(
    period: Optional[str] = Query(None, description="YYYY-MM"),
    outlet_id: Optional[str] = Query(None),
    user: dict = Depends(require_any_perm("finance.view", "reservations.read", "reservations.reports")),
):
    result = await reservation_service.finance_deposit_summary(
        period=period,
        outlet_id=outlet_id,
    )
    return ok_envelope(result)


# ────────────────────────────────────────────────
# SETTINGS (outlet-level reservation config)
# Must be before {reservation_id} route
# ────────────────────────────────────────────────

@router.get("/api/reservations/settings")
async def get_reservation_settings(
    outlet_id: Optional[str] = Query(None),
    user: dict = Depends(current_user),
):
    from core.db import get_db, serialize
    db = get_db()
    q = {"type": "reservation_settings"}
    if outlet_id:
        q["outlet_id"] = outlet_id
    items = await db.system_configs.find(q, {"id": 1, "key": 1, "value": 1, "group": 1, "description": 1, "_id": 0}).to_list(20)
    return ok_envelope({"items": [serialize(i) for i in items]})


@router.put("/api/reservations/settings/{outlet_id}")
async def update_reservation_settings(
    outlet_id: str,
    payload: dict,
    user: dict = Depends(require_any_perm("admin.settings", "reservations.manage")),
):
    from core.db import get_db, serialize
    db = get_db()
    now = reservation_service._now()
    await db.system_configs.update_one(
        {"type": "reservation_settings", "outlet_id": outlet_id},
        {"$set": {
            "type": "reservation_settings",
            "outlet_id": outlet_id,
            "time_slots": payload.get("time_slots", []),
            "area_options": payload.get("area_options", []),
            "deposit_required": payload.get("deposit_required", False),
            "deposit_amount": payload.get("deposit_amount", 0),
            "max_pax": payload.get("max_pax", 20),
            "advance_days": payload.get("advance_days", 30),
            "notes_template": payload.get("notes_template", ""),
            "updated_at": now,
            "updated_by": user["id"],
        }},
        upsert=True,
    )
    doc = await db.system_configs.find_one({"type": "reservation_settings", "outlet_id": outlet_id})
    return ok_envelope(serialize(doc) if doc else {})


@router.get("/api/reservations/{reservation_id}")
async def get_reservation(
    reservation_id: str,
    user: dict = Depends(require_any_perm("reservations.read", "outlet.manager", "reservations.manage")),
):
    result = await reservation_service.get_reservation(reservation_id)
    if not result:
        raise AuroraException("Reservasi tidak ditemukan", code="NOT_FOUND", field="reservation_id")
    return ok_envelope(result)


@router.put("/api/reservations/{reservation_id}")
async def update_reservation(
    reservation_id: str,
    payload: dict,
    user: dict = Depends(require_any_perm("reservations.manage", "outlet.manager")),
):
    result = await reservation_service.update_reservation(reservation_id, payload, user_id=user["id"])
    if not result:
        raise AuroraException("Reservasi tidak ditemukan", code="NOT_FOUND", field="reservation_id")
    return ok_envelope(result)


@router.delete("/api/reservations/{reservation_id}")
async def delete_reservation(
    reservation_id: str,
    user: dict = Depends(require_any_perm("reservations.manage", "outlet.manager")),
):
    await reservation_service.delete_reservation(reservation_id, user_id=user["id"])
    return ok_envelope({"message": "Reservasi berhasil dihapus"})


@router.post("/api/reservations/{reservation_id}/status")
async def update_reservation_status(
    reservation_id: str,
    payload: dict,
    user: dict = Depends(require_any_perm("reservations.manage", "outlet.manager")),
):
    new_status = payload.get("status")
    reason = payload.get("reason")
    if not new_status:
        raise AuroraException("Field 'status' diperlukan", code="VALIDATION_ERROR", field="status")
    from core.exceptions import ValidationError
    try:
        result = await reservation_service.update_status(
            reservation_id, new_status, user_id=user["id"], reason=reason
        )
    except ValidationError as e:
        raise AuroraException(str(e), code="VALIDATION_ERROR", field="status")
    if not result:
        raise AuroraException("Reservasi tidak ditemukan", code="NOT_FOUND", field="reservation_id")
    return ok_envelope(result)


@router.post("/api/reservations/{reservation_id}/notify")
async def send_notification(
    reservation_id: str,
    payload: dict,
    user: dict = Depends(require_any_perm("reservations.manage", "outlet.manager")),
):
    channel = payload.get("channel", "whatsapp")
    result = await reservation_service.send_confirmation(reservation_id, channel=channel)
    return ok_envelope(result)


@router.post("/api/reservations/{reservation_id}/reschedule")
async def reschedule_reservation(
    reservation_id: str,
    payload: dict,
    user: dict = Depends(require_any_perm("reservations.manage", "outlet.manager")),
):
    """Reschedule reservation to a new date/time."""
    new_date = payload.get("new_date")
    new_time = payload.get("new_time")
    reason = payload.get("reason")
    if not new_date or not new_time:
        raise AuroraException("Field 'new_date' dan 'new_time' diperlukan", code="VALIDATION_ERROR", field="new_date")
    from core.exceptions import ValidationError
    try:
        result = await reservation_service.reschedule_reservation(
            reservation_id, new_date, new_time, user_id=user["id"], reason=reason
        )
    except ValidationError as e:
        raise AuroraException(str(e), code="VALIDATION_ERROR", field="status")
    if not result:
        raise AuroraException("Reservasi tidak ditemukan", code="NOT_FOUND", field="reservation_id")
    return ok_envelope(result)


@router.patch("/api/reservations/{reservation_id}/deposit")
async def update_deposit(
    reservation_id: str,
    payload: dict,
    user: dict = Depends(require_any_perm("reservations.manage", "outlet.manager")),
):
    """Update deposit / DP status and payment details."""
    deposit_status = payload.get("deposit_status")
    if not deposit_status:
        raise AuroraException("Field 'deposit_status' diperlukan", code="VALIDATION_ERROR", field="deposit_status")
    from core.exceptions import ValidationError
    try:
        result = await reservation_service.update_deposit(
            reservation_id,
            user_id=user["id"],
            deposit_status=deposit_status,
            deposit_amount=payload.get("deposit_amount"),
            dp_payment_method=payload.get("dp_payment_method"),
            dp_reference=payload.get("dp_reference"),
            dp_deadline=payload.get("dp_deadline"),
        )
    except ValidationError as e:
        raise AuroraException(str(e), code="VALIDATION_ERROR", field="deposit_status")
    if not result:
        raise AuroraException("Reservasi tidak ditemukan", code="NOT_FOUND", field="reservation_id")
    return ok_envelope(result)
