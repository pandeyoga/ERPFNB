"""Konteks Brand per request (docs/audit/OUTLET_SCOPE_ANALYSIS_2026-10-29.md).

Frontend mengirim konteks global sebagai query `brand_id` (seluruh toko satu brand) atau `outlet_id` (satu toko).
`brand_scope` — dependency tingkat app — menerjemahkan `brand_id` menjadi daftar toko brand itu sekali per request.
`core.security.resolve_outlet_filter` memakainya, sehingga setiap endpoint yang sudah memotong data per outlet
otomatis juga bisa dipotong per brand tanpa parameter tambahan di endpoint itu.
"""
from __future__ import annotations

from contextvars import ContextVar

from fastapi import Request

from core.db import get_db

_brand_outlets: ContextVar[list[str] | None] = ContextVar("brand_outlets", default=None)


async def brand_outlet_ids(brand_id: str) -> list[str]:
    db = get_db()
    return [o["id"] async for o in db.outlets.find({"brand_id": brand_id, "deleted_at": None}, {"id": 1})]


async def brand_scope(request: Request) -> None:
    brand_id = request.query_params.get("brand_id")
    _brand_outlets.set(await brand_outlet_ids(brand_id) if brand_id else None)


def request_brand_outlets() -> list[str] | None:
    """Toko milik `brand_id` pada request ini; None = request tidak memakai konteks brand."""
    return _brand_outlets.get()


def narrow_to_brand(outlet_ids: list[str] | None) -> list[str] | None:
    """Daftar toko (None = semua) dipersempit ke konteks brand request ini; kosong → sentinel yang tak cocok apa pun."""
    brand = request_brand_outlets()
    if brand is None:
        return outlet_ids
    narrowed = brand if outlet_ids is None else [o for o in outlet_ids if o in brand]
    return narrowed or ["__none__"]


def outlet_condition(outlet_id: str | None):
    """Kondisi Mongo untuk field `outlet_id` dokumen, dalam konteks brand request ini. None = tanpa filter."""
    brand = request_brand_outlets()
    if outlet_id:
        return outlet_id if brand is None or outlet_id in brand else "__none__"
    return {"$in": brand} if brand is not None else None
