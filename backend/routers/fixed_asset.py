"""Fixed Asset router — Sprint B (fixed router ordering, added per-asset depreciation).

Endpoints:
  GET    /api/assets/categories          — list asset categories
  GET    /api/assets/register            — asset register report
  POST   /api/assets/depreciation/post   — post depreciation for ALL assets
  GET    /api/assets                     — list assets
  POST   /api/assets                     — create asset
  GET    /api/assets/{asset_id}          — get asset detail
  PUT    /api/assets/{asset_id}          — update asset
  DELETE /api/assets/{asset_id}          — soft delete
  GET    /api/assets/{asset_id}/schedule — depreciation schedule
  POST   /api/assets/{asset_id}/depreciation/post — post dep for single asset
  POST   /api/assets/{asset_id}/dispose  — dispose asset
  POST   /api/assets/{asset_id}/revalue  — revalue asset

NOTE: Static paths (/categories, /register, /depreciation/post) MUST be defined
before dynamic paths (/{asset_id}) to avoid Starlette path shadowing.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope, AuroraException
from core.security import current_user, require_perm
from services import fixed_asset_service
from models.fixed_asset import ASSET_CATEGORIES, DEP_METHODS

router = APIRouter(prefix="/api/assets", tags=["fixed_assets"])


# ── Static routes (MUST be before /{asset_id}) ────────────────────────────────────────

@router.get("/categories")
async def get_asset_categories(user: dict = Depends(current_user)):
    """Return asset categories and depreciation methods."""
    return ok_envelope({
        "categories": ASSET_CATEGORIES,
        "dep_methods": DEP_METHODS,
    })


@router.get("/register")
async def get_asset_register(
    outlet_id: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    user: dict = Depends(require_perm("finance.asset.read")),
):
    """Asset register report grouped by outlet/location."""
    result = await fixed_asset_service.get_asset_register(outlet_id=outlet_id)
    return ok_envelope(result)


@router.post("/depreciation/post")
async def post_depreciation_all(
    payload: dict,
    user: dict = Depends(require_perm("finance.asset.depreciate")),
):
    """Post depreciation for ALL active depreciable assets for a given period.
    
    Payload:
      period: "YYYY-MM"
    """
    period = payload.get("period")
    if not period:
        raise AuroraException('Period is required', code='MISSING_PERIOD', field='period')
    result = await fixed_asset_service.post_all_depreciation(period, user_id=user["id"])
    return ok_envelope(result)


# ── Collection endpoints ───────────────────────────────────────────────────────────

@router.get("")
async def list_assets(
    category: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("finance.asset.read")),
):
    """List fixed assets with filters."""
    items, meta = await fixed_asset_service.list_assets(
        category=category,
        outlet_id=outlet_id,
        status=status,
        page=page,
        per_page=per_page,
    )
    return ok_envelope({"items": items, "meta": meta})


@router.post("")
async def create_asset(
    payload: dict,
    user: dict = Depends(require_perm("finance.asset.create")),
):
    """Create new fixed asset."""
    asset = await fixed_asset_service.create_asset(payload, user_id=user["id"])
    return ok_envelope(asset)


# ── Asset-level endpoints (dynamic — keep after static routes) ─────────────────────────

@router.get("/{asset_id}")
async def get_asset(
    asset_id: str,
    user: dict = Depends(require_perm("finance.asset.read")),
):
    """Get asset detail."""
    asset = await fixed_asset_service.get_asset(asset_id)
    if not asset:
        raise AuroraException('Asset not found', code='ASSET_NOT_FOUND', field='asset_id')
    return ok_envelope(asset)


@router.put("/{asset_id}")
async def update_asset(
    asset_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.asset.update")),
):
    """Update asset metadata (name, location, outlet, notes)."""
    asset = await fixed_asset_service.update_asset(asset_id, payload, user_id=user["id"])
    if not asset:
        raise AuroraException('Asset not found', code='ASSET_NOT_FOUND', field='asset_id')
    return ok_envelope(asset)


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: str,
    user: dict = Depends(require_perm("finance.asset.delete")),
):
    """Soft delete asset."""
    await fixed_asset_service.delete_asset(asset_id)
    return ok_envelope({"message": "Asset deleted"})


@router.get("/{asset_id}/schedule")
async def get_depreciation_schedule(
    asset_id: str,
    months: int = Query(60, ge=1, le=360),
    user: dict = Depends(require_perm("finance.asset.read")),
):
    """Get depreciation schedule for asset."""
    asset = await fixed_asset_service.get_asset(asset_id)
    if not asset:
        raise AuroraException('Asset not found', code='ASSET_NOT_FOUND', field='asset_id')
    schedule = fixed_asset_service.build_depreciation_schedule(asset, months)
    return ok_envelope({"asset_id": asset_id, "schedule": schedule})


@router.post("/{asset_id}/depreciation/post")
async def post_depreciation_single(
    asset_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.asset.depreciate")),
):
    """Post depreciation for a SINGLE asset for a given period (idempotent).
    
    Payload:
      period: "YYYY-MM"
    """
    period = payload.get("period")
    if not period:
        raise AuroraException('Period is required', code='MISSING_PERIOD', field='period')
    asset = await fixed_asset_service.get_asset(asset_id)
    if not asset:
        raise AuroraException('Asset not found', code='ASSET_NOT_FOUND', field='asset_id')
    result = await fixed_asset_service.post_depreciation(
        asset_id=asset_id,
        period=period,
        user_id=user["id"],
    )
    return ok_envelope(result)


@router.post("/{asset_id}/dispose")
async def dispose_asset(
    asset_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.asset.dispose")),
):
    """Dispose asset (calculate gain/loss, post JE).
    
    Payload:
      disposal_date: str (YYYY-MM-DD)
      disposal_proceeds (or disposal_amount): float (proceeds from sale, 0 if scrapped)
      notes: str
    """
    proceeds = float(
        payload.get("disposal_proceeds", payload.get("disposal_amount", 0)) or 0
    )
    result = await fixed_asset_service.dispose_asset(
        asset_id=asset_id,
        payload={
            "disposal_date": payload.get("disposal_date"),
            "disposal_proceeds": proceeds,
            "notes": payload.get("notes"),
        },
        user_id=user["id"],
    )
    return ok_envelope(result)


@router.post("/{asset_id}/revalue")
async def revalue_asset(
    asset_id: str,
    payload: dict,
    user: dict = Depends(require_perm("finance.asset.revalue")),
):
    """Revalue asset (post revaluation JE).
    
    Payload:
      revaluation_date: str (YYYY-MM-DD)
      new_fair_value (or new_cost): float
      notes: str
    """
    new_value = float(
        payload.get("new_fair_value", payload.get("new_cost", 0)) or 0
    )
    result = await fixed_asset_service.revalue_asset(
        asset_id=asset_id,
        payload={
            "revaluation_date": payload.get("revaluation_date"),
            "new_fair_value": new_value,
            "notes": payload.get("notes"),
        },
        user_id=user["id"],
    )
    return ok_envelope(result)
