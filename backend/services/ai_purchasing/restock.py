"""Restock otomatis (rencana §7.6): stok di bawah par → draf PR per toko + saran PO per supplier (penawaran termurah
yang berlaku, satuan sebanding; bila tidak ada → supplier & harga terakhir). Tidak menulis; agen mengusulkan PR/PO."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from core.security import enforce_outlet_scope, scoped_outlet_ids

from .units import dim_of

WIB = timezone(timedelta(hours=7))


async def suggest(user: dict, *, outlet_id: Optional[str] = None, lead_days: int = 2) -> dict:
    from services import inventory_matrix_service, sourcing_service
    from core.db import get_db
    if outlet_id:
        enforce_outlet_scope(user, outlet_id)
    outs = [outlet_id] if outlet_id else scoped_outlet_ids(user)
    low = await inventory_matrix_service.low_stock(outlet_ids=outs)
    rows = [r for r in low.get("items") or [] if (r.get("suggested_reorder") or 0) > 0]
    today = datetime.now(WIB).date()
    vnames = {v["id"]: v["name"] async for v in get_db().vendors.find({}, {"id": 1, "name": 1})}
    prs: dict[str, dict] = {}
    pos: dict[tuple, dict] = {}
    offers_cache: dict[Optional[str], list] = {}
    for r in rows:
        oid = r["outlet_id"]
        region = await sourcing_service.region_of_outlet(oid)
        if region not in offers_cache:
            offers_cache[region] = await sourcing_service.active_offers([x["item_id"] for x in rows], region, today)
        cands = [o for o in offers_cache[region] if o["item_id"] == r["item_id"] and dim_of(o.get("unit"))[0] == dim_of(r.get("unit"))[0]]
        best = min(cands, key=lambda o: o["price"], default=None)
        vendor_id = (best or {}).get("vendor_id") or r.get("last_vendor_id")
        price = (best or {}).get("price") or r.get("last_unit_cost")
        why = (f"penawaran termurah {vnames.get(vendor_id, '')} Rp {price:,.0f}".replace(",", ".") if best
               else (f"supplier terakhir {r.get('last_vendor_name') or '-'}" if vendor_id else "belum ada supplier"))
        pr = prs.setdefault(oid, {"outlet_id": oid, "outlet": r.get("outlet_name"), "request_date": today.isoformat(),
                                  "needed_by": (today + timedelta(days=lead_days)).isoformat(),
                                  "notes": "Restock otomatis (Asisten AI): stok di bawah par level", "lines": []})
        pr["lines"].append({"item_id": r["item_id"], "item_name": r["item_name"], "qty": r["suggested_reorder"], "unit": r.get("unit"),
                            "estimated_price": price or 0,
                            "notes": f"stok {r['qty']:g} / par {r['par_level']:g} ({r.get('severity')}); {why}"[:200]})
        if vendor_id:
            po = pos.setdefault((oid, vendor_id), {"outlet_id": oid, "outlet": r.get("outlet_name"), "vendor_id": vendor_id,
                                                   "vendor": vnames.get(vendor_id), "lines": [], "estimasi_total": 0.0})
            po["lines"].append({"item_id": r["item_id"], "item_name": r["item_name"], "qty": r["suggested_reorder"],
                                "unit": r.get("unit"), "unit_cost": price or 0})
            po["estimasi_total"] += (price or 0) * r["suggested_reorder"]
    return {"ringkasan": {"item_di_bawah_par": len(rows), "toko": len(prs), "supplier": len({k[1] for k in pos}),
                          "estimasi_total": round(sum(p["estimasi_total"] for p in pos.values()), 0)},
            "pr_drafts": list(prs.values()), "po_suggestions": list(pos.values()),
            "catatan": "Usulkan PR per toko (POST /api/procurement/prs, body = pr_drafts[i] tanpa 'outlet') — PO dibuat setelah PR "
                       "disetujui; vendor & harga saran ada di po_suggestions."}

