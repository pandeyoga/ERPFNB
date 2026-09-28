"""/api/inventory/items/{item_id}/pricing router — price versioning/history."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm
from services import item_pricing_service

router = APIRouter(prefix="/api/inventory/items", tags=["inventory-pricing"])


@router.post("/{item_id}/pricing")
async def add_item_price(
    item_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("inventory.item.update")),
):
    """Add new price untuk item (auto-close previous active price)."""
    return ok_envelope(await item_pricing_service.add_item_price(
        item_id=item_id,
        unit=payload.get("unit"),
        price=float(payload.get("price")),
        effective_from=payload.get("effective_from"),
        vendor_id=payload.get("vendor_id"),
        notes=payload.get("notes"),
        user=user,
    ))


@router.get("/{item_id}/pricing")
async def get_item_price_history(
    item_id: str,
    vendor_id: Optional[str] = None,
    unit: Optional[str] = None,
    user: dict = Depends(require_perm("inventory.item.read")),
):
    """Get price history untuk item."""
    return ok_envelope(await item_pricing_service.get_item_price_history(
        item_id=item_id,
        vendor_id=vendor_id,
        unit=unit,
    ))


@router.get("/{item_id}/pricing/current")
async def get_current_price(
    item_id: str,
    vendor_id: Optional[str] = None,
    unit: Optional[str] = None,
    as_of: Optional[str] = None,
    user: dict = Depends(require_perm("inventory.item.read")),
):
    """Get current active price untuk item."""
    return ok_envelope(await item_pricing_service.get_current_item_price(
        item_id=item_id,
        vendor_id=vendor_id,
        unit=unit,
        as_of=as_of,
    ))


@router.get("/pricing/list")
async def get_items_with_prices(
    category_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    as_of: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("inventory.item.read")),
):
    """Get items dengan current prices (Market List view)."""
    items, meta = await item_pricing_service.get_items_with_current_prices(
        category_id=category_id,
        vendor_id=vendor_id,
        as_of=as_of,
        page=page,
        per_page=per_page,
    )
    return ok_envelope(items, meta)
