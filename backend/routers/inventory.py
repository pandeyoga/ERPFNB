"""/api/inventory router."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm, get_user_permissions
from services import inventory_service, inventory_matrix_service

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/balance")
async def stock_balance(
    outlet_id: Optional[str] = None, item_id: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    items, meta = await inventory_service.stock_balance(
        outlet_id=outlet_id, item_id=item_id, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/movements")
async def list_mov(
    outlet_id: Optional[str] = None, item_id: Optional[str] = None,
    movement_type: Optional[str] = None, date_from: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("inventory.movement.read")),
):
    user_perms = await get_user_permissions(user)
    outlet_ids = None
    if "*" not in user_perms:
        outlet_ids = [outlet_id] if outlet_id else user.get("outlet_ids", [])
    elif outlet_id:
        outlet_ids = [outlet_id]
    items, meta = await inventory_service.list_movements(
        outlet_ids=outlet_ids, item_id=item_id, movement_type=movement_type,
        date_from=date_from, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/valuation")
async def get_valuation(outlet_id: Optional[str] = None,
                         user: dict = Depends(require_perm("inventory.valuation.read"))):
    return ok_envelope(await inventory_service.valuation(outlet_id=outlet_id))


# Transfer
@router.get("/transfers")
async def list_t(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    user_perms = await get_user_permissions(user)
    if "*" not in user_perms:
        # Restricted user: use their scope, optionally narrowed to one outlet
        raw = user.get("outlet_ids", [])
        outlet_ids = [outlet_id] if (outlet_id and outlet_id in raw) else raw
    elif outlet_id:
        outlet_ids = [outlet_id]
    else:
        outlet_ids = None
    items, meta = await inventory_service.list_transfers(
        outlet_ids=outlet_ids, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/transfers/{id_}")
async def get_t(id_: str, user: dict = Depends(require_perm("inventory.balance.read"))):
    return ok_envelope(await inventory_service.get_transfer(id_))


@router.post("/transfers")
async def create_t(payload: dict = Body(...),
                    user: dict = Depends(require_perm("inventory.transfer.create"))):
    return ok_envelope(await inventory_service.create_transfer(payload, user=user))


@router.post("/transfers/{id_}/send")
async def send_t(id_: str, user: dict = Depends(require_perm("inventory.transfer.send"))):
    return ok_envelope(await inventory_service.send_transfer(id_, user=user))


@router.post("/transfers/{id_}/receive")
async def receive_t(id_: str, user: dict = Depends(require_perm("inventory.transfer.receive"))):
    return ok_envelope(await inventory_service.receive_transfer(id_, user=user))


# Adjustment
@router.get("/adjustments")
async def list_a(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("inventory.movement.read")),
):
    user_perms = await get_user_permissions(user)
    if "*" not in user_perms:
        raw = user.get("outlet_ids", [])
        outlet_ids = [outlet_id] if (outlet_id and outlet_id in raw) else raw
    elif outlet_id:
        outlet_ids = [outlet_id]
    else:
        outlet_ids = None
    items, meta = await inventory_service.list_adjustments(
        outlet_ids=outlet_ids, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/adjustments")
async def create_a(payload: dict = Body(...),
                    user: dict = Depends(require_perm("inventory.adjustment.create"))):
    return ok_envelope(await inventory_service.create_adjustment(payload, user=user))


@router.post("/adjustments/{id_}/approve")
async def approve_a(id_: str, payload: dict = Body(default={}),
                     user: dict = Depends(current_user)):
    # Permission enforced by approval engine (multi-tier) — fall back to legacy check if no workflow
    return ok_envelope(await inventory_service.approve_adjustment(
        id_, user=user, note=payload.get("note")))


@router.post("/adjustments/{id_}/reject")
async def reject_a(id_: str, payload: dict = Body(...),
                    user: dict = Depends(current_user)):
    return ok_envelope(await inventory_service.reject_adjustment(
        id_, user=user, reason=payload.get("reason", "")))


@router.get("/adjustments/{id_}/approval-state")
async def adjustment_approval_state(id_: str, user: dict = Depends(current_user)):
    return ok_envelope(await inventory_service.get_adjustment_approval_state(id_))


# Opname
@router.get("/opname")
async def list_o(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    user_perms = await get_user_permissions(user)
    if "*" not in user_perms:
        raw = user.get("outlet_ids", [])
        outlet_ids = [outlet_id] if (outlet_id and outlet_id in raw) else raw
    elif outlet_id:
        outlet_ids = [outlet_id]
    else:
        outlet_ids = None
    items, meta = await inventory_service.list_opname(
        outlet_ids=outlet_ids, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/opname/start")
async def start_o(payload: dict = Body(...),
                   user: dict = Depends(require_perm("outlet.opname.execute"))):
    return ok_envelope(await inventory_service.start_opname(payload, user=user))


@router.patch("/opname/{id_}/lines")
async def update_o_lines(id_: str, payload: dict = Body(...),
                          user: dict = Depends(require_perm("outlet.opname.execute"))):
    return ok_envelope(await inventory_service.update_opname_lines(
        id_, payload.get("lines", []), user=user))


@router.post("/opname/{id_}/submit")
async def submit_o(id_: str,
                    user: dict = Depends(require_perm("inventory.opname.submit"))):
    return ok_envelope(await inventory_service.submit_opname(id_, user=user))


# =================== PHASE 9C - MATRIX + LOW STOCK ===================

def _csv(val: Optional[str]) -> Optional[list[str]]:
    if not val:
        return None
    parts = [p.strip() for p in val.split(",") if p.strip()]
    return parts or None


@router.get("/balance-matrix")
async def balance_matrix(
    outlet_ids: Optional[str] = Query(None, description="Comma-separated outlet ids; defaults to all"),
    category_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    include_zero: bool = Query(True),
    days_for_par: int = Query(30, ge=7, le=180),
    par_buffer_days: int = Query(7, ge=1, le=30),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    """Pivot view of stock balance: rows=items × cols=outlets.

    Returns par level + below_par flag per cell so the UI can heatmap-color it.
    """
    user_perms = await get_user_permissions(user)
    o_ids = _csv(outlet_ids)
    if "*" not in user_perms:
        # restrict to user's outlet scope
        scope = user.get("outlet_ids", []) or []
        if scope:
            o_ids = [o for o in (o_ids or scope) if o in scope] or scope

    return ok_envelope(await inventory_matrix_service.stock_balance_matrix(
        outlet_ids=o_ids, category_id=category_id, search=search,
        include_zero=include_zero, days_for_par=days_for_par,
        par_buffer_days=par_buffer_days,
    ))


@router.get("/movements/cell")
async def movements_cell(
    item_id: str = Query(..., description="Item id"),
    outlet_id: str = Query(..., description="Outlet id"),
    limit: int = Query(30, ge=1, le=200),
    user: dict = Depends(require_perm("inventory.movement.read")),
):
    """Last N movements for a single (item, outlet) cell — used for matrix drilldown."""
    user_perms = await get_user_permissions(user)
    if "*" not in user_perms:
        scope = user.get("outlet_ids", []) or []
        if scope and outlet_id not in scope:
            from core.exceptions import ForbiddenError
            raise ForbiddenError("Outlet outside your scope")
    return ok_envelope(await inventory_matrix_service.movements_by_cell(
        item_id=item_id, outlet_id=outlet_id, limit=limit,
    ))


@router.get("/low-stock")
async def low_stock(
    outlet_ids: Optional[str] = Query(None, description="Comma-separated outlet ids"),
    include_zero: bool = Query(True),
    include_negative: bool = Query(True),
    days_for_par: int = Query(30, ge=7, le=180),
    par_buffer_days: int = Query(7, ge=1, le=30),
    limit: int = Query(200, ge=1, le=500),
    user: dict = Depends(require_perm("inventory.balance.read")),
):
    """Items below par level — used for Inventory Home widget + Low Stock page."""
    user_perms = await get_user_permissions(user)
    o_ids = _csv(outlet_ids)
    if "*" not in user_perms:
        scope = user.get("outlet_ids", []) or []
        if scope:
            o_ids = [o for o in (o_ids or scope) if o in scope] or scope

    return ok_envelope(await inventory_matrix_service.low_stock(
        outlet_ids=o_ids, include_zero=include_zero,
        include_negative=include_negative,
        days_for_par=days_for_par, par_buffer_days=par_buffer_days,
        limit=limit,
    ))
