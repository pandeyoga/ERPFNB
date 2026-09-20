"""AP Aging summary widget for Executive Portal."""
from __future__ import annotations

from typing import Optional


async def ap_aging_summary(*, as_of: Optional[str] = None, top_n: int = 5) -> dict:
    from services._finance.ap import ap_aging
    aging = await ap_aging(as_of=as_of)
    buckets = aging.get("buckets") or {}
    grand_total = float(aging.get("grand_total", 0) or 0)
    rows = aging.get("rows") or []
    top = sorted(rows, key=lambda r: r.get("total", 0), reverse=True)[:top_n]
    top_payload = [{"vendor_id": r["vendor_id"], "vendor_name": r["vendor_name"], "total": r["total"], "current": r.get("current", 0), "d_30": r.get("d_30", 0), "d_60": r.get("d_60", 0), "d_90": r.get("d_90", 0), "d_90p": r.get("d_90p", 0), "items": len(r.get("items", []))} for r in top]
    bucket_pct: dict[str, float] = {k: round((float(v) / grand_total) * 100, 2) if grand_total else 0.0 for k, v in buckets.items()}
    return {"as_of": aging.get("as_of"), "buckets": buckets, "bucket_pct": bucket_pct, "grand_total": grand_total, "vendor_count": len(rows), "top_vendors": top_payload}
