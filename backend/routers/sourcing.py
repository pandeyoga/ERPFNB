"""Sourcing API — harga acuan (periode & wilayah), penawaran supplier, analisis per item & global.

Izin (core/perms_catalog.py, modul "Sourcing"):
  procurement.sourcing.read      lihat analisis, acuan, penawaran
  procurement.market_list.manage tetapkan harga acuan
  procurement.price_list.manage  kelola penawaran supplier (termasuk impor)
  procurement.sourcing.settings  ubah pengaturan periode & ambang peringatan
"""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm, resolve_outlet_filter
from services import sourcing_service as svc

router = APIRouter(prefix="/api/sourcing", tags=["sourcing"])
READ = "procurement.sourcing.read"


def _outlets(user: dict) -> Optional[list[str]]:
    # Pengguna terbatas (mis. area manager) hanya melihat riwayat GR toko miliknya.
    return resolve_outlet_filter(user)


@router.get("/settings")
async def get_settings(user: dict = Depends(require_perm(READ))):
    s = await svc.get_settings()
    return ok_envelope({**s, "period_types": [{"value": k, "label": v} for k, v in svc.PERIOD_LABELS.items()]})


@router.put("/settings")
async def update_settings(payload: dict = Body(...), user: dict = Depends(require_perm("procurement.sourcing.settings"))):
    return ok_envelope(await svc.update_settings(payload, user=user))


@router.get("/periods")
async def list_periods(period_type: Optional[str] = None, limit: int = Query(24, ge=1, le=200),
                       user: dict = Depends(require_perm(READ))):
    return ok_envelope(await svc.list_periods(period_type, limit))


@router.get("/overview")
async def overview(region_id: Optional[str] = None, category_id: Optional[str] = None, search: Optional[str] = None,
                   flag: Optional[str] = None, user: dict = Depends(require_perm(READ))):
    return ok_envelope(await svc.overview(region_id=region_id, category_id=category_id, search=search, flag=flag,
                                          outlet_ids=_outlets(user)))


@router.get("/items/{item_id}")
async def item_detail(item_id: str, region_id: Optional[str] = None, user: dict = Depends(require_perm(READ))):
    return ok_envelope(await svc.item_detail(item_id, region_id=region_id, outlet_ids=_outlets(user)))


# ---------- Harga acuan ----------
@router.get("/benchmarks/worksheet")
async def worksheet(period_type: str = Query(...), on: Optional[str] = None, region_id: Optional[str] = None,
                    category_id: Optional[str] = None, user: dict = Depends(require_perm(READ))):
    return ok_envelope(await svc.benchmark_worksheet(period_type=period_type, on=on, region_id=region_id,
                                                     category_id=category_id))


@router.post("/benchmarks")
async def set_benchmark(payload: dict = Body(...), user: dict = Depends(require_perm("procurement.market_list.manage"))):
    return ok_envelope(await svc.set_benchmark(
        item_id=payload.get("item_id"), unit=payload.get("unit"), price=float(payload.get("price") or 0),
        region_id=payload.get("region_id") or None, period_type=payload.get("period_type"), on=payload.get("on"),
        period_id=payload.get("period_id"), source=payload.get("source") or "manual",
        source_note=payload.get("source_note"), user=user))


@router.post("/benchmarks/bulk")
async def bulk_benchmarks(payload: dict = Body(...), user: dict = Depends(require_perm("procurement.market_list.manage"))):
    return ok_envelope(await svc.bulk_set_benchmarks(payload.get("rows") or [], user=user))


# ---------- Penawaran supplier ----------
@router.get("/offers")
async def list_offers(vendor_id: Optional[str] = None, item_id: Optional[str] = None, region_id: Optional[str] = None,
                      status: Optional[str] = None, search: Optional[str] = None,
                      page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
                      user: dict = Depends(require_perm(READ))):
    items, meta = await svc.list_offers(vendor_id=vendor_id, item_id=item_id, region_id=region_id, status=status,
                                        search=search, page=page, per_page=per_page)
    return ok_envelope(items, meta)


@router.post("/offers")
async def create_offer(payload: dict = Body(...), user: dict = Depends(require_perm("procurement.price_list.manage"))):
    return ok_envelope(await svc.upsert_offer(payload, user=user))


@router.put("/offers/{offer_id}")
async def update_offer(offer_id: str, payload: dict = Body(...),
                       user: dict = Depends(require_perm("procurement.price_list.manage"))):
    return ok_envelope(await svc.upsert_offer(payload, user=user, offer_id=offer_id))


@router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, user: dict = Depends(require_perm("procurement.price_list.manage"))):
    return ok_envelope(await svc.delete_offer(offer_id, user=user))


@router.post("/offers/bulk")
async def bulk_offers(payload: dict = Body(...), user: dict = Depends(require_perm("procurement.price_list.manage"))):
    return ok_envelope(await svc.bulk_upsert_offers(payload.get("rows") or [], user=user))
