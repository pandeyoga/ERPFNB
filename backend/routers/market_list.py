"""Market List router — quarterly reference price management + vendor catalog."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import Response
from core.exceptions import ok_envelope, ValidationError as AuroraException
from core.security import require_perm
from services import market_list_service, vendor_item_service

router = APIRouter(prefix="/api/market-list", tags=["market-list"])


# =================== QUARTERS ===================

@router.get("/quarters")
async def list_quarters(
    year: Optional[int] = None,
    user: dict = Depends(require_perm("inventory.view")),
):
    return ok_envelope(await market_list_service.list_quarters(year=year))


@router.get("/quarters/active")
async def get_active_quarter(user: dict = Depends(require_perm("inventory.view"))):
    return ok_envelope(await market_list_service.get_active_quarter())


@router.post("/quarters")
async def create_quarter(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("procurement.market_list.manage")),
):
    return ok_envelope(await market_list_service.create_quarter(
        year=int(payload["year"]),
        quarter=int(payload["quarter"]),
        user=user,
    ))


@router.post("/quarters/{quarter_id}/activate")
async def activate_quarter(
    quarter_id: str,
    user: dict = Depends(require_perm("procurement.market_list.manage")),
):
    return ok_envelope(await market_list_service.activate_quarter(quarter_id, user=user))


# =================== MARKET LIST ITEMS ===================

@router.get("/items")
async def get_market_list(
    quarter_id: Optional[str] = None,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    ml_status: Optional[str] = None,
    brand: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("inventory.view")),
):
    items, meta = await market_list_service.get_market_list(
        quarter_id=quarter_id,
        category_id=category_id,
        search=search,
        ml_status=ml_status,
        brand=brand,
        page=page,
        per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/items/{item_id}/prices")
async def get_item_prices(
    item_id: str,
    user: dict = Depends(require_perm("inventory.view")),
):
    """Get all quarterly reference prices for a specific item."""
    return ok_envelope(await market_list_service.get_all_quarter_prices_for_item(item_id))


@router.get("/items/{item_id}/ref-price")
async def get_item_ref_price(
    item_id: str,
    quarter_id: Optional[str] = None,
    user: dict = Depends(require_perm("inventory.view")),
):
    return ok_envelope(await market_list_service.get_ref_price(item_id, quarter_id=quarter_id))


@router.get("/items/{item_id}/vendors")
async def get_item_vendors(
    item_id: str,
    include_unavailable: bool = False,
    user: dict = Depends(require_perm("inventory.view")),
):
    """Get all vendors that supply this item with their actual prices."""
    return ok_envelope(await vendor_item_service.get_item_vendors(
        item_id,
        include_unavailable=include_unavailable,
    ))


@router.post("/items/{item_id}/approve")
async def approve_pending_item(
    item_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("procurement.market_list.manage")),
):
    """Approve a pending_review item: assign category + optionally set ref price."""
    return ok_envelope(await market_list_service.approve_pending_item(
        item_id=item_id,
        category_id=payload["category_id"],
        ref_price=float(payload.get("ref_price", 0) or 0) or None,
        user=user,
    ))



# PRIORITY 3: Bulk approve pending items
@router.post("/items/bulk-approve")
async def bulk_approve_pending_items(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("procurement.market_list.manage")),
):
    """Bulk approve multiple pending items at once.
    Payload: {
      "approvals": [
        {"item_id": "...", "category_id": "...", "ref_price": 50000},
        {"item_id": "...", "category_id": "...", "ref_price": 25000}
      ]
    }
    """
    approvals = payload.get("approvals", [])
    if not approvals:
        raise AuroraException("No items to approve", code="VALIDATION_ERROR")
    
    results = {"success": [], "failed": []}
    
    for approval in approvals:
        item_id = approval.get("item_id")
        try:
            result = await market_list_service.approve_pending_item(
                item_id=item_id,
                category_id=approval.get("category_id"),
                ref_price=float(approval.get("ref_price", 0) or 0) or None,
                user=user,
            )
            results["success"].append({"item_id": item_id, "name": result.get("name")})
        except Exception as e:
            results["failed"].append({"item_id": item_id, "error": str(e)})
    
    return ok_envelope({
        "total": len(approvals),
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "results": results
    })


# =================== PRICES ===================

@router.post("/prices")
async def set_ref_price(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("procurement.market_list.manage")),
):
    return ok_envelope(await market_list_service.set_ref_price(
        quarter_id=payload["quarter_id"],
        item_id=payload["item_id"],
        unit=payload.get("unit", "pcs"),
        ref_price=float(payload["ref_price"]),
        notes=payload.get("notes"),
        user=user,
    ))


@router.post("/prices/bulk")
async def bulk_set_ref_prices(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("procurement.market_list.manage")),
):
    return ok_envelope(await market_list_service.bulk_set_ref_prices(
        quarter_id=payload["quarter_id"],
        prices=payload.get("prices", []),
        user=user,
    ))


@router.get("/ref-prices/bulk")
async def get_ref_prices_bulk(
    item_ids: str = Query(..., description="Comma-separated item IDs"),
    quarter_id: Optional[str] = None,
    user: dict = Depends(require_perm("inventory.view")),
):
    ids = [i.strip() for i in item_ids.split(",") if i.strip()]
    return ok_envelope(await market_list_service.get_ref_prices_bulk(ids, quarter_id=quarter_id))


# =================== EXPORT ===================

@router.get("/export.xlsx")
async def export_excel(
    year: int = Query(...),
    user: dict = Depends(require_perm("inventory.view")),
):
    data = await market_list_service.export_market_list_excel(year)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=market_list_{year}.xlsx"},
    )


# =================== PRICE INTELLIGENCE ===================

@router.get("/intelligence")
async def price_intelligence(
    quarter_id: Optional[str] = None,
    category_id: Optional[str] = None,
    top_n: int = Query(20, ge=5, le=100),
    user: dict = Depends(require_perm("inventory.view")),
):
    return ok_envelope(await vendor_item_service.get_price_intelligence(
        quarter_id=quarter_id,
        category_id=category_id,
        top_n=top_n,
    ))
