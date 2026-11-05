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
