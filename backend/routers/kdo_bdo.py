"""/api/outlet/kdo and /api/outlet/bdo router — Phase 8B.

These are thin wrappers over the procurement PR engine, scoped to outlet and
with fixed source.
"""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm
from services import kdo_bdo_service

router = APIRouter(prefix="/api/outlet", tags=["kdo-bdo"])


# ---------- KDO (Kitchen Daily Order) ----------

@router.get("/kdo")
async def list_kdo(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.kdo.create")),
):
    outlet_ids = [outlet_id] if outlet_id else (user.get("outlet_ids") or [])
    items, meta = await kdo_bdo_service.list_kdo_bdo(
        kind="kdo", outlet_ids=outlet_ids, status=status,
        date_from=date_from, date_to=date_to, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/kdo")
async def create_kdo(payload: dict = Body(...),
                     user: dict = Depends(require_perm("outlet.kdo.create"))):
    return ok_envelope(await kdo_bdo_service.create(payload, kind="kdo", user=user))


@router.get("/kdo/favorites")
async def kdo_favorites(
    outlet_id: str = Query(...),
    limit: int = Query(12, ge=1, le=50),
    user: dict = Depends(require_perm("outlet.kdo.create")),
):
    return ok_envelope(await kdo_bdo_service.favorites(
        outlet_id=outlet_id, kind="kdo", limit=limit,
    ))


# ---------- BDO (Bar Daily Order) ----------

@router.get("/bdo")
async def list_bdo(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.bdo.create")),
):
    outlet_ids = [outlet_id] if outlet_id else (user.get("outlet_ids") or [])
    items, meta = await kdo_bdo_service.list_kdo_bdo(
        kind="bdo", outlet_ids=outlet_ids, status=status,
        date_from=date_from, date_to=date_to, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/bdo")
async def create_bdo(payload: dict = Body(...),
                     user: dict = Depends(require_perm("outlet.bdo.create"))):
    return ok_envelope(await kdo_bdo_service.create(payload, kind="bdo", user=user))


@router.get("/bdo/favorites")
async def bdo_favorites(
    outlet_id: str = Query(...),
    limit: int = Query(12, ge=1, le=50),
    user: dict = Depends(require_perm("outlet.bdo.create")),
):
    return ok_envelope(await kdo_bdo_service.favorites(
        outlet_id=outlet_id, kind="bdo", limit=limit,
    ))


# ---------- FDO (Floor Daily Order) ----------

@router.get("/fdo")
async def list_fdo(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("outlet.fdo.create")),
):
    outlet_ids = [outlet_id] if outlet_id else (user.get("outlet_ids") or [])
    items, meta = await kdo_bdo_service.list_kdo_bdo(
        kind="fdo", outlet_ids=outlet_ids, status=status,
        date_from=date_from, date_to=date_to, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/fdo")
async def create_fdo(payload: dict = Body(...),
                     user: dict = Depends(require_perm("outlet.fdo.create"))):
    return ok_envelope(await kdo_bdo_service.create(payload, kind="fdo", user=user))


@router.get("/fdo/favorites")
async def fdo_favorites(
    outlet_id: str = Query(...),
    limit: int = Query(12, ge=1, le=50),
    user: dict = Depends(require_perm("outlet.fdo.create")),
):
    return ok_envelope(await kdo_bdo_service.favorites(
        outlet_id=outlet_id, kind="fdo", limit=limit,
    ))
