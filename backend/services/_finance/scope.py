"""Cakupan buku besar per Group / Brand / Toko / Pusat (docs/audit/OUTLET_SCOPE_ANALYSIS_2026-10-29.md).

Brand dan toko adalah dimensi baris jurnal (`lines[].dim_outlet`, `lines[].dim_brand`) di dalam satu buku Group.
Baris tanpa toko & brand adalah transaksi **pusat** (AR, payroll, payment run, …): ikut di konsolidasi, tidak ikut
saat dipotong ke brand/toko, dan bisa dilihat sendiri lewat `unallocated`.

SSOT-05: auto-JE membawa `lines[].dim_outlet`; manual JE membawa `outlet_id` di level header.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from core.db import get_db
from core.scope import brand_outlet_ids
from core.security import scoped_outlet_ids

_EMPTY = {"$in": [None, ""]}
_NEVER = {"$expr": {"$eq": [1, 0]}}


@dataclass(frozen=True)
class LedgerScope:
    outlet_ids: Optional[list[str]] = None  # None = semua toko
    brand_ids: list[str] = field(default_factory=list)  # baris tingkat brand (tanpa toko) yang ikut
    unallocated: bool = True  # baris pusat (tanpa toko & brand) ikut
    label: str = "group"  # group | brand | outlet | unallocated | mine

    @property
    def is_all(self) -> bool:
        return self.outlet_ids is None and self.unallocated

    def line_match(self) -> dict:
        """$match untuk baris jurnal setelah `$unwind: "$lines"`."""
        if self.is_all:
            return {}
        ors: list[dict] = []
        if self.outlet_ids:
            ors += [{"lines.dim_outlet": {"$in": self.outlet_ids}},
                    {"outlet_id": {"$in": self.outlet_ids}, "lines.dim_outlet": _EMPTY}]
        if self.brand_ids:
            ors.append({"lines.dim_brand": {"$in": self.brand_ids}, "lines.dim_outlet": _EMPTY, "outlet_id": _EMPTY})
        if self.unallocated:
            ors.append({"lines.dim_outlet": _EMPTY, "lines.dim_brand": _EMPTY, "outlet_id": _EMPTY})
        return {"$or": ors} if ors else _NEVER

    def entry_match(self) -> dict:
        """$match untuk dokumen jurnal: minimal satu baris dalam cakupan."""
        if self.is_all:
            return {}
        ors: list[dict] = []
        if self.outlet_ids:
            ors += [{"lines.dim_outlet": {"$in": self.outlet_ids}}, {"outlet_id": {"$in": self.outlet_ids}}]
        if self.brand_ids:
            ors.append({"outlet_id": _EMPTY,
                        "lines": {"$elemMatch": {"dim_brand": {"$in": self.brand_ids}, "dim_outlet": _EMPTY}}})
        if self.unallocated:
            ors.append({"outlet_id": _EMPTY, "lines": {"$elemMatch": {"dim_outlet": _EMPTY, "dim_brand": _EMPTY}}})
        return {"$or": ors} if ors else _NEVER

    def has_line(self, je: dict, ln: dict) -> bool:
        """Versi Python dari line_match (dipakai laporan yang mengiterasi jurnal)."""
        if self.is_all:
            return True
        outlet = ln.get("dim_outlet") or None
        if outlet:
            return bool(self.outlet_ids) and outlet in self.outlet_ids
        header_outlet = je.get("outlet_id") or None
        if header_outlet:
            return bool(self.outlet_ids) and header_outlet in self.outlet_ids
        brand = ln.get("dim_brand") or None
        if brand:
            return brand in self.brand_ids
        return self.unallocated


async def _active_outlets() -> list[dict]:
    return await get_db().outlets.find({"deleted_at": None}, {"id": 1, "brand_id": 1}).to_list(None)


def _fully_covered_brands(outlets: list[dict], outlet_ids: list[str]) -> list[str]:
    """Brand yang SEMUA tokonya ada di `outlet_ids` — baris tingkat brand-nya boleh ikut."""
    by_brand: dict[str, set[str]] = {}
    for o in outlets:
        if o.get("brand_id"):
            by_brand.setdefault(o["brand_id"], set()).add(o["id"])
    have = set(outlet_ids)
    return [b for b, ids in by_brand.items() if ids <= have]


async def ledger_scope(
    user: dict,
    *,
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    unallocated: bool = False,
) -> LedgerScope:
    """Terjemahkan konteks yang diminta + akses user menjadi LedgerScope.

    Toko di luar akses user tidak pernah ikut (permintaan di luar akses → cakupan kosong). User yang memegang
    semua toko setara tingkat Group. User terbatas tidak melihat transaksi pusat; baris tingkat brand hanya ikut
    bila user memegang semua toko brand itu.
    """
    allowed = scoped_outlet_ids(user)  # None = tidak dibatasi
    outlets = await _active_outlets() if allowed is not None else []
    if allowed is not None and {o["id"] for o in outlets} <= set(allowed):
        allowed = None

    if unallocated:
        return LedgerScope(outlet_ids=[], unallocated=allowed is None, label="unallocated")

    if outlet_id:
        ok = allowed is None or outlet_id in allowed
        if brand_id and outlet_id not in await brand_outlet_ids(brand_id):
            ok = False
        return LedgerScope(outlet_ids=[outlet_id] if ok else [], unallocated=False, label="outlet")

    if brand_id:
        brand_outlets = await brand_outlet_ids(brand_id)
        mine = brand_outlets if allowed is None else [o for o in brand_outlets if o in allowed]
        full = allowed is None or set(brand_outlets) <= set(allowed)
        return LedgerScope(outlet_ids=mine, brand_ids=[brand_id] if full else [], unallocated=False, label="brand")

    if allowed is None:
        return LedgerScope()
    return LedgerScope(outlet_ids=allowed, brand_ids=_fully_covered_brands(outlets, allowed),
                       unallocated=False, label="mine")


def coerce_scope(scope: Optional[LedgerScope], outlet_id: Optional[str] = None) -> LedgerScope:
    """Pemanggil lama (ekspor Excel, closing checks) masih mengirim satu `outlet_id`/`dim_outlet`."""
    if scope is not None:
        return scope
    return LedgerScope(outlet_ids=[outlet_id], unallocated=False, label="outlet") if outlet_id else LedgerScope()
