"""Pagination helpers — Sprint B8.

Provides backward-compatible page/per_page alias untuk skip/limit params.
Semua existing frontend calls dengan skip/limit tetap berjalan.

Usage in router:
    from core.pagination import PaginationParams, paged
    
    @router.get("/items")
    async def list_items(pg: PaginationParams = Depends()):
        items = await db.items.find(q).skip(pg.skip).limit(pg.limit).to_list(pg.limit)
        return ok_envelope(items, meta=pg.meta(len(items)))
"""
from fastapi import Query


class PaginationParams:
    """Dual-mode pagination: pakai page/per_page ATAU skip/limit (backward compatible).
    
    Priority: jika `page` di-set, hitung skip dari page.
    Sinon: gunakan skip/limit langsung.
    """

    def __init__(
        self,
        page:     int | None = Query(None, ge=1,  description="Halaman (mulai dari 1). Alternatif skip."),
        per_page: int | None = Query(None, ge=1, le=500, description="Item per halaman. Alternatif limit."),
        skip:     int        = Query(0,    ge=0,  description="Item di-skip (backward compat)"),
        limit:    int        = Query(50,   ge=1, le=500, description="Jumlah item (backward compat)"),
    ):
        effective_limit = per_page or limit
        if page is not None:
            self.skip  = (page - 1) * effective_limit
            self.limit = effective_limit
            self.page  = page
        else:
            self.skip  = skip
            self.limit = effective_limit
            self.page  = (skip // effective_limit) + 1 if effective_limit else 1

    def meta(self, returned: int, total: int | None = None) -> dict:
        """Bangun meta dict untuk ok_envelope response."""
        m: dict = {
            "page":     self.page,
            "per_page": self.limit,
            "skip":     self.skip,
            "returned": returned,
        }
        if total is not None:
            m["total"]       = total
            m["total_pages"] = max(1, -(-total // self.limit))  # ceiling division
        return m
