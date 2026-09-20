"""RFQ (Request for Quotation) router — Sprint E.

Endpoints:
  GET  /api/rfq                           — list RFQs
  POST /api/rfq                           — create RFQ
  GET  /api/rfq/{rfq_id}                  — get detail
  PUT  /api/rfq/{rfq_id}                  — update
  POST /api/rfq/{rfq_id}/send             — mark as sent
  POST /api/rfq/{rfq_id}/quotes/{vid}     — upsert vendor quote
  DELETE /api/rfq/{rfq_id}/quotes/{vid}   — remove vendor quote
  GET  /api/rfq/{rfq_id}/compare          — get comparison matrix
  POST /api/rfq/{rfq_id}/accept/{vid}     — accept vendor -> create PO
  POST /api/rfq/{rfq_id}/cancel           — cancel RFQ
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope, AuroraException
from core.security import require_perm
from services import rfq_service as svc

router = APIRouter(prefix="/api/rfq", tags=["rfq"])


@router.get("")
async def list_rfqs(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.rfq.read")),
):
    outlet_id = None if user.get("role") in ("super_admin", "admin", "procurement_manager", "executive") else user.get("outlet_id")
    items, meta = await svc.list_rfqs(status=status, outlet_id=outlet_id, search=search, page=page, per_page=per_page)
    return ok_envelope({"items": items, "meta": meta})


@router.post("")
async def create_rfq(
    payload: dict,
    user: dict = Depends(require_perm("procurement.rfq.create")),
):
    rfq = await svc.create_rfq(payload, user)
    return ok_envelope(rfq)


@router.get("/{rfq_id}")
async def get_rfq(
    rfq_id: str,
    user: dict = Depends(require_perm("procurement.rfq.read")),
):
    rfq = await svc.get_rfq(rfq_id)
    if not rfq:
        raise AuroraException('RFQ not found', code='NOT_FOUND', field='rfq_id')
    return ok_envelope(rfq)


@router.put("/{rfq_id}")
async def update_rfq(
    rfq_id: str,
    payload: dict,
    user: dict = Depends(require_perm("procurement.rfq.create")),
):
    rfq = await svc.update_rfq(rfq_id, payload)
    if not rfq:
        raise AuroraException('RFQ not found', code='NOT_FOUND', field='rfq_id')
    return ok_envelope(rfq)


@router.post("/{rfq_id}/send")
async def send_rfq(
    rfq_id: str,
    user: dict = Depends(require_perm("procurement.rfq.create")),
):
    rfq = await svc.update_rfq(rfq_id, {"status": "sent"})
    if not rfq:
        raise AuroraException('RFQ not found', code='NOT_FOUND', field='rfq_id')
    return ok_envelope(rfq)


@router.post("/{rfq_id}/quotes/{vendor_id}")
async def upsert_quote(
    rfq_id: str,
    vendor_id: str,
    payload: dict,
    user: dict = Depends(require_perm("procurement.rfq.create")),
):
    rfq = await svc.upsert_quote(rfq_id, vendor_id, payload)
    if not rfq:
        raise AuroraException('RFQ not found', code='NOT_FOUND', field='rfq_id')
    return ok_envelope(rfq)


@router.get("/{rfq_id}/compare")
async def get_compare(
    rfq_id: str,
    user: dict = Depends(require_perm("procurement.rfq.read")),
):
    matrix = await svc.get_compare_matrix(rfq_id)
    if not matrix:
        raise AuroraException('RFQ not found', code='NOT_FOUND', field='rfq_id')
    return ok_envelope(matrix)


@router.post("/{rfq_id}/accept/{vendor_id}")
async def accept_quote(
    rfq_id: str,
    vendor_id: str,
    user: dict = Depends(require_perm("procurement.rfq.create")),
):
    result = await svc.accept_quote(rfq_id, vendor_id, user)
    if not result:
        raise AuroraException('RFQ or quote not found', code='NOT_FOUND', field='vendor_id')
    return ok_envelope(result)


@router.post("/{rfq_id}/cancel")
async def cancel_rfq(
    rfq_id: str,
    user: dict = Depends(require_perm("procurement.rfq.create")),
):
    rfq = await svc.update_rfq(rfq_id, {"status": "cancelled"})
    if not rfq:
        raise AuroraException('RFQ not found', code='NOT_FOUND', field='rfq_id')
    return ok_envelope(rfq)
