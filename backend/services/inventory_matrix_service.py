"""Inventory matrix & low-stock services (Phase 9C).

Adds:
  • stock_balance_matrix(outlet_ids, category_id, search) -> pivot of qty per item × outlet
  • movements_by_cell(item_id, outlet_id, limit) -> last N movements for a cell drilldown
  • low_stock(outlet_id, include_zero, days_for_par) -> items below par with suggested reorder qty
  • effective_par_for(item, outlet_id, days_for_par) -> computed default par if explicit not set

Par level resolution priority:
  1. item.par_levels[outlet_id]    (explicit per-outlet)
  2. item.par_level                (explicit global default)
  3. computed par                  (avg-daily-outflow × buffer_days)
  4. 0                              (no par → never below)
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.db import get_db


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _safe_float(v, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except Exception:  # noqa: BLE001
        return default


def resolve_par_level(item: dict, outlet_id: str, computed_par: float = 0.0) -> tuple[float, str]:
    """Pick the most specific par level for (item, outlet).

    Returns (par_level, source) where source ∈ {explicit_outlet, explicit_default, computed, none}.
    """
    par_levels = item.get("par_levels") or {}
    if isinstance(par_levels, dict):
        v = par_levels.get(outlet_id)
        if v is not None:
            return _safe_float(v), "explicit_outlet"
    v = item.get("par_level")
    if v is not None:
        return _safe_float(v), "explicit_default"
    if computed_par > 0:
        return computed_par, "computed"
    return 0.0, "none"


async def _compute_par_from_outflow(
    item_id: str, outlet_id: str, days: int = 30, buffer_days: int = 7,
) -> float:
    """Estimate par as (avg daily outflow over last `days`) × `buffer_days`.

    Outflow = absolute sum of negative-qty movements (issues, transfers out, opname-down).
    Returns 0 if no outflow history.
    """
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    pipeline = [
        {"$match": {
            "deleted_at": None,
            "item_id": item_id,
            "outlet_id": outlet_id,
            "qty": {"$lt": 0},
            "movement_date": {"$gte": cutoff},
        }},
        {"$group": {
            "_id": None,
            "total_outflow": {"$sum": "$qty"},
            "count": {"$sum": 1},
        }},
    ]
    async for r in db.inventory_movements.aggregate(pipeline):
        total = abs(_safe_float(r.get("total_outflow")))
        if total <= 0:
            return 0.0
        avg_daily = total / max(days, 1)
        return round(avg_daily * buffer_days, 2)
    return 0.0


# =================== STOCK BALANCE MATRIX ===================

async def stock_balance_matrix(
    *,
    outlet_ids: Optional[list[str]] = None,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    include_zero: bool = True,
    days_for_par: int = 30,
    par_buffer_days: int = 7,
) -> dict:
    """Pivot view: rows = items, cols = outlets.

    Returns:
      {
        "outlets": [{id, code, name}, ...],
        "rows": [{
          item_id, item_name, item_code, unit, category_id,
          cells: [{outlet_id, qty, par_level, par_source, below_par, zero, last_movement_at, last_unit_cost}],
          totals: {qty, item_value},
        }],
        "totals": {by_outlet: {outlet_id: {qty, value}}, grand_total_value},
      }
    """
    db = get_db()

    # 1) Resolve outlet list
    outlet_q: dict = {"deleted_at": None, "active": True}
    if outlet_ids:
        outlet_q["id"] = {"$in": outlet_ids}
    outlets = await db.outlets.find(outlet_q).sort("name", 1).to_list(100)
    outlet_lookup = [{"id": o["id"], "code": o.get("code", ""), "name": o.get("name", "")} for o in outlets]
    outlet_id_set = [o["id"] for o in outlet_lookup]

    if not outlet_id_set:
        return {"outlets": [], "rows": [], "totals": {"by_outlet": {}, "grand_total_value": 0.0}}

    # 2) Resolve item list (filtered by category/search)
    item_q: dict = {"deleted_at": None, "active": True}
    if category_id:
        item_q["category_id"] = category_id
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        item_q["$or"] = [{"name": rx}, {"code": rx}, {"sku": rx}, {"name_local": rx}]
    items = await db.items.find(item_q).sort("name", 1).limit(500).to_list(500)
    item_id_set = [it["id"] for it in items]

    if not item_id_set:
        return {"outlets": outlet_lookup, "rows": [], "totals": {"by_outlet": {}, "grand_total_value": 0.0}}

    # 3) Aggregate balance per (item, outlet) once
    pipeline = [
        {"$match": {
            "deleted_at": None,
            "item_id": {"$in": item_id_set},
            "outlet_id": {"$in": outlet_id_set},
        }},
        {"$group": {
            "_id": {"item_id": "$item_id", "outlet_id": "$outlet_id"},
            "qty": {"$sum": "$qty"},
            "total_value": {"$sum": "$total_cost"},
            "last_movement_at": {"$max": "$movement_date"},
            "last_unit_cost": {"$last": "$unit_cost"},
        }},
    ]
    bal_lookup: dict[tuple, dict] = {}
    async for r in db.inventory_movements.aggregate(pipeline):
        key = (r["_id"]["item_id"], r["_id"]["outlet_id"])
        bal_lookup[key] = {
            "qty": _safe_float(r.get("qty")),
            "total_value": _safe_float(r.get("total_value")),
            "last_movement_at": r.get("last_movement_at"),
            "last_unit_cost": _safe_float(r.get("last_unit_cost")),
        }

    # 4) Build rows
    rows = []
    by_outlet_totals: dict[str, dict[str, float]] = {oid: {"qty": 0.0, "value": 0.0} for oid in outlet_id_set}
    grand_total_value = 0.0

    for it in items:
        cells = []
        item_qty_total = 0.0
        item_value_total = 0.0

        for o in outlet_lookup:
            oid = o["id"]
            bal = bal_lookup.get((it["id"], oid))
            qty = _safe_float((bal or {}).get("qty"))
            value = _safe_float((bal or {}).get("total_value"))

            # Par resolution
            explicit_par, source = resolve_par_level(it, oid, computed_par=0.0)
            if source == "none":
                computed = await _compute_par_from_outflow(
                    it["id"], oid, days=days_for_par, buffer_days=par_buffer_days,
                )
                par_level, source = resolve_par_level(it, oid, computed_par=computed)
            else:
                par_level = explicit_par

            cells.append({
                "outlet_id": oid,
                "qty": round(qty, 3),
                "value": round(max(value, 0.0), 2),
                "par_level": round(par_level, 2),
                "par_source": source,
                "below_par": (par_level > 0 and qty < par_level),
                "zero": qty == 0,
                "negative": qty < 0,
                "last_movement_at": (bal or {}).get("last_movement_at"),
                "last_unit_cost": round(_safe_float((bal or {}).get("last_unit_cost")), 2),
            })

            item_qty_total += qty
            item_value_total += max(value, 0.0)
            by_outlet_totals[oid]["qty"] += qty
            by_outlet_totals[oid]["value"] += max(value, 0.0)
            grand_total_value += max(value, 0.0)

        if not include_zero and item_qty_total == 0 and not any(c["below_par"] for c in cells):
            continue

        rows.append({
            "item_id": it["id"],
            "item_name": it.get("name"),
            "item_code": it.get("code"),
            "unit": it.get("unit_default"),
            "category_id": it.get("category_id"),
            "cells": cells,
            "totals": {
                "qty": round(item_qty_total, 3),
                "value": round(item_value_total, 2),
            },
        })

    # Round totals
    for oid, tots in by_outlet_totals.items():
        tots["qty"] = round(tots["qty"], 3)
        tots["value"] = round(tots["value"], 2)

    return {
        "outlets": outlet_lookup,
        "rows": rows,
        "totals": {
            "by_outlet": by_outlet_totals,
            "grand_total_value": round(grand_total_value, 2),
        },
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


# =================== CELL MOVEMENT DRILLDOWN ===================

async def movements_by_cell(
    *, item_id: str, outlet_id: str, limit: int = 30,
) -> list[dict]:
    """Recent movements for a single (item, outlet) cell."""
    db = get_db()
    cursor = db.inventory_movements.find({
        "deleted_at": None,
        "item_id": item_id,
        "outlet_id": outlet_id,
    }).sort([("movement_date", -1), ("created_at", -1)]).limit(max(1, min(limit, 200)))
    out = []
    async for m in cursor:
        out.append({
            "id": m.get("id"),
            "movement_date": m.get("movement_date"),
            "movement_type": m.get("movement_type"),
            "qty": _safe_float(m.get("qty")),
            "unit": m.get("unit"),
            "unit_cost": _safe_float(m.get("unit_cost")),
            "total_cost": _safe_float(m.get("total_cost")),
            "source_type": m.get("source_type"),
            "source_id": m.get("source_id"),
            "source_doc_no": m.get("source_doc_no"),
            "note": m.get("note"),
            "created_at": m.get("created_at"),
        })
    return out


# =================== LOW STOCK ALERTS ===================

async def low_stock(
    *,
    outlet_ids: Optional[list[str]] = None,
    include_zero: bool = True,
    include_negative: bool = True,
    days_for_par: int = 30,
    par_buffer_days: int = 7,
    limit: int = 200,
) -> dict:
    """Items where balance < par_level for the given outlets.

    Returns:
      {
        outlets: [{id, name}, ...],
        items: [{
          item_id, item_name, item_code, unit, outlet_id, outlet_name,
          qty, par_level, par_source, deficit, suggested_reorder,
          last_vendor_id, last_vendor_name, last_unit_cost, last_purchase_date,
          severity: "critical" (zero/negative) | "low" (below par),
        }],
        total_below: int,
      }
    """
    db = get_db()
    matrix = await stock_balance_matrix(
        outlet_ids=outlet_ids,
        include_zero=True,
        days_for_par=days_for_par,
        par_buffer_days=par_buffer_days,
    )

    # Pull last vendor/cost per item from goods_receipts (1 batch)
    item_ids = [r["item_id"] for r in matrix["rows"]]
    vendor_lookup_ids: set[str] = set()
    last_gr_by_item: dict[str, dict] = {}
    if item_ids:
        try:
            gr_pipeline = [
                {"$match": {
                    "deleted_at": None,
                    "status": "posted",
                    "lines.item_id": {"$in": item_ids},
                }},
                {"$unwind": "$lines"},
                {"$match": {"lines.item_id": {"$in": item_ids}}},
                {"$sort": {"receive_date": -1, "created_at": -1}},
                {"$group": {
                    "_id": "$lines.item_id",
                    "vendor_id": {"$first": "$vendor_id"},
                    "unit_cost": {"$first": "$lines.unit_cost"},
                    "received_date": {"$first": "$receive_date"},
                }},
            ]
            async for r in db.goods_receipts.aggregate(gr_pipeline):
                last_gr_by_item[r["_id"]] = r
                if r.get("vendor_id"):
                    vendor_lookup_ids.add(r["vendor_id"])
        except Exception:  # noqa: BLE001
            pass

    vendor_name_by_id: dict[str, str] = {}
    if vendor_lookup_ids:
        async for v in db.vendors.find({"id": {"$in": list(vendor_lookup_ids)}}, {"id": 1, "name": 1}):
            vendor_name_by_id[v["id"]] = v.get("name", "")

    outlet_name_by_id = {o["id"]: o["name"] for o in matrix["outlets"]}

    items_below: list[dict] = []
    for row in matrix["rows"]:
        gr_hit = last_gr_by_item.get(row["item_id"])
        last_vendor_id = (gr_hit or {}).get("vendor_id")
        last_vendor_name = vendor_name_by_id.get(last_vendor_id) if last_vendor_id else None
        last_unit_cost = _safe_float((gr_hit or {}).get("unit_cost"))
        last_purchase_date = (gr_hit or {}).get("received_date")

        for cell in row["cells"]:
            qty = cell["qty"]
            par = cell["par_level"]
            zero = cell["zero"]
            negative = cell["negative"]
            below = cell["below_par"]
            critical = (zero or negative)

            if not (below or (include_zero and zero) or (include_negative and negative)):
                continue
            if par <= 0 and not (include_zero or include_negative):
                # nothing actionable
                continue

            deficit = max(par - qty, 0.0) if par > 0 else max(0 - qty, 0.0)
            suggested = max(deficit, 0.0)
            # If we know the last_unit_cost, round suggested to nearest 1 unit
            if suggested:
                suggested = round(suggested + 0.5)

            items_below.append({
                "item_id": row["item_id"],
                "item_name": row["item_name"],
                "item_code": row["item_code"],
                "unit": row["unit"],
                "outlet_id": cell["outlet_id"],
                "outlet_name": outlet_name_by_id.get(cell["outlet_id"], ""),
                "qty": qty,
                "par_level": par,
                "par_source": cell["par_source"],
                "deficit": round(deficit, 3),
                "suggested_reorder": int(suggested) if suggested else 0,
                "last_vendor_id": last_vendor_id,
                "last_vendor_name": last_vendor_name,
                "last_unit_cost": last_unit_cost,
                "last_purchase_date": last_purchase_date,
                "severity": "critical" if critical else "low",
                "below_par": below,
                "zero": zero,
                "negative": negative,
            })

    # Sort: critical first, then by deficit desc
    items_below.sort(key=lambda x: (
        0 if x["severity"] == "critical" else 1,
        -x["deficit"],
    ))

    return {
        "outlets": matrix["outlets"],
        "items": items_below[:limit],
        "total_below": len(items_below),
        "as_of": datetime.now(timezone.utc).isoformat(),
    }
