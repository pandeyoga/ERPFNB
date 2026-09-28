"""Vendor Items router — vendor item catalog management."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query
from core.exceptions import ok_envelope
from core.security import require_perm
from services import vendor_item_service

router = APIRouter(prefix="/api/vendor-items", tags=["vendor-items"])


@router.get("/vendor/{vendor_id}")
async def get_vendor_catalog(
    vendor_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    user: dict = Depends(require_perm("procurement.view")),
):
    """Get all items in a vendor's catalog with actual prices."""
    items, meta = await vendor_item_service.get_vendor_catalog(
        vendor_id,
        page=page,
        per_page=per_page,
        search=search,
    )
    return ok_envelope(items, meta)


@router.get("/item/{item_id}")
async def get_item_vendors(
    item_id: str,
    include_unavailable: bool = False,
    user: dict = Depends(require_perm("procurement.view")),
):
    """Get all vendors that supply this item."""
    return ok_envelope(await vendor_item_service.get_item_vendors(
        item_id,
        include_unavailable=include_unavailable,
    ))


@router.get("/history/{vendor_id}/{item_id}")
async def get_price_history(
    vendor_id: str,
    item_id: str,
    unit: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("procurement.view")),
):
    """Get price history for a vendor-item pair."""
    return ok_envelope(await vendor_item_service.get_price_history(
        vendor_id, item_id, unit=unit, limit=limit
    ))


@router.post("/vendor/{vendor_id}/item/{item_id}/unavailable")
async def mark_unavailable(
    vendor_id: str,
    item_id: str,
    user: dict = Depends(require_perm("procurement.view")),
):
    """Mark item as unavailable from this vendor."""
    return ok_envelope(await vendor_item_service.mark_unavailable(vendor_id, item_id, user=user))


@router.post("/vendor/{vendor_id}/item/{item_id}/available")
async def mark_available(
    vendor_id: str,
    item_id: str,
    user: dict = Depends(require_perm("procurement.view")),
):
    """Mark item as available again from this vendor."""
    return ok_envelope(await vendor_item_service.mark_available(vendor_id, item_id, user=user))


@router.post("/manual")
async def manual_upsert(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("procurement.market_list.manage")),
):
    """Manually add/update a vendor-item with price."""
    result = await vendor_item_service.upsert_vendor_item(
        vendor_id=payload["vendor_id"],
        item_id=payload["item_id"],
        unit=payload.get("unit", "pcs"),
        new_price=float(payload.get("current_price", 0)),
        source="manual",
        notes=payload.get("notes"),
        user_id=user["id"],
    )
    return ok_envelope(result)
