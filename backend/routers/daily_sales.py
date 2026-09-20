"""
/api/outlet/daily-sales, /api/outlet/petty-cash, /api/outlet/urgent-purchases

Sprint A: Add all outlet operational CRUD endpoints that were missing from the API.
These complement the existing outlet.py (home, loyalty/lookup, vouchers).
"""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm
from services import outlet_service

router = APIRouter(prefix="/api/outlet", tags=["outlet-ops"])


# ─────────────────────────────────────────────────────────
# DAILY SALES
# ─────────────────────────────────────────────────────────

@router.get("/daily-sales")
async def list_daily_sales(
    outlet_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """List daily sales. Outlet staff only see their own outlet's records."""
    # Build outlet_ids scope
    outlet_ids = _resolve_outlet_ids(user, outlet_id)
    items, meta = await outlet_service.list_daily_sales(
        outlet_ids=outlet_ids if outlet_ids else None,
        date_from=date_from,
        date_to=date_to,
        status=status,
        page=page,
        per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/daily-sales/{id_}")
async def get_daily_sales(
    id_: str,
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """Get single daily sales record."""
    return ok_envelope(await outlet_service.get_daily_sales(id_))


@router.post("/daily-sales/draft")
async def upsert_daily_sales_draft(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """Create or update a DRAFT daily sales record (one per outlet+date).

    Idempotent: if a draft already exists for the same outlet+date, it is updated.
    """
    return ok_envelope(await outlet_service.upsert_daily_sales_draft(payload, user=user))


@router.post("/daily-sales/{id_}/submit")
async def submit_daily_sales(
    id_: str,
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """Submit daily sales for Finance validation."""
    return ok_envelope(await outlet_service.submit_daily_sales(id_, user=user))


@router.post("/daily-sales/{id_}/validate")
async def validate_daily_sales(
    id_: str,
    user: dict = Depends(require_perm("finance.sales.validate")),
):
    """Finance validates daily sales → creates journal entry + awards loyalty points."""
    return ok_envelope(await outlet_service.validate_daily_sales(id_, user=user))


@router.post("/daily-sales/{id_}/reject")
async def reject_daily_sales(
    id_: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("finance.sales.validate")),
):
    """Finance rejects daily sales with a reason."""
    reason = payload.get("reason", "")
    return ok_envelope(await outlet_service.reject_daily_sales(id_, user=user, reason=reason))


# ─────────────────────────────────────────────────────────
# PETTY CASH
# ─────────────────────────────────────────────────────────

@router.get("/petty-cash")
async def list_petty_cash(
    outlet_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """List petty cash transactions for the user's outlet scope."""
    outlet_ids = _resolve_outlet_ids(user, outlet_id)
    items, meta = await outlet_service.list_petty_cash(
        outlet_ids=outlet_ids if outlet_ids else None,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/petty-cash/balance")
async def petty_cash_balance(
    outlet_id: str = Query(..., description="Outlet ID to get balance for"),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """Get current petty cash balance for a specific outlet."""
    balance = await outlet_service.petty_cash_balance(outlet_id)
    return ok_envelope({"outlet_id": outlet_id, "balance": balance})


@router.post("/petty-cash")
async def add_petty_cash(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """Record a petty cash transaction (purchase / replenish / adjustment)."""
    return ok_envelope(await outlet_service.add_petty_cash(payload, user=user))


# ─────────────────────────────────────────────────────────
# URGENT PURCHASE
# ─────────────────────────────────────────────────────────

@router.get("/urgent-purchases")
async def list_urgent_purchases(
    outlet_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """List urgent purchases for the user's outlet scope."""
    outlet_ids = _resolve_outlet_ids(user, outlet_id)
    items, meta = await outlet_service.list_urgent_purchases(
        outlet_ids=outlet_ids if outlet_ids else None,
        status=status,
        page=page,
        per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/urgent-purchases")
async def create_urgent_purchase(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("outlet.daily_sales.read")),
):
    """Create a new urgent purchase request."""
    return ok_envelope(await outlet_service.create_urgent_purchase(payload, user=user))


@router.post("/urgent-purchases/{id_}/approve")
async def approve_urgent_purchase(
    id_: str,
    user: dict = Depends(require_perm("finance.ap.read")),
):
    """Approve urgent purchase → creates journal entry."""
    return ok_envelope(await outlet_service.approve_urgent_purchase(id_, user=user))


# ─────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────

def _resolve_outlet_ids(user: dict, outlet_id_filter: Optional[str]) -> list[str]:
    """Resolve the list of outlet IDs to query based on user scope and filter."""
    user_outlet_ids = user.get("outlet_ids", [])
    # Super-admins have "*" in permissions, can see all
    user_perms = set(user.get("permissions", []))
    is_superadmin = "*" in user_perms

    if is_superadmin:
        # If specific filter requested, use it; else empty list = no restriction
        if outlet_id_filter:
            return [outlet_id_filter]
        return []  # Will be handled: empty list = all outlets (no outlet_id filter in query)
    else:
        if outlet_id_filter and outlet_id_filter in user_outlet_ids:
            return [outlet_id_filter]
        return user_outlet_ids if user_outlet_ids else []
