"""Resep (BOM) per menu & perhitungan HPP — dasar analisis food cost dan riset resep dengan Asisten AI.

Resep: {menu_item_id, yield_qty (porsi), lines: [{item_id, qty, unit, waste_pct, note}], instructions}. Biaya bahan =
harga beli terakhir dari GR (rata-rata tertimbang 90 hari bila ada; fallback penawaran termurah berlaku / katalog
vendor) per satuan item; satuan resep dikonversi (g→kg, ml→l). Satuan beda dimensi (pcs vs kg) tidak dikonversi →
ditandai agar dilengkapi (mis. berat per butir). Food cost % = HPP / harga jual (sebelum pajak).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db
from core.exceptions import NotFoundError, ValidationError
from services.ai_purchasing.units import dim_of

FOOD_COST_ALERT = 0.35


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def item_costs(item_ids: list[str]) -> dict[str, dict]:
    """→ {item_id: {cost, unit, source, date}} per satuan item."""
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=90)).date().isoformat()
    agg: dict[str, dict] = {}
    async for g in db.goods_receipts.find({"deleted_at": None, "lines.item_id": {"$in": item_ids}},
                                          {"_id": 0, "receive_date": 1, "lines": 1}).sort("receive_date", -1):
        for ln in g.get("lines") or []:
            iid = ln.get("item_id")
            if iid not in item_ids or not ln.get("unit_cost"):
                continue
            a = agg.setdefault(iid, {"qty": 0.0, "val": 0.0, "last": float(ln["unit_cost"]), "unit": ln.get("unit"),
                                     "date": g.get("receive_date")})
            if str(g.get("receive_date") or "") >= since:
                q = float(ln.get("qty_received") or ln.get("qty") or 0)
                a["qty"] += q
                a["val"] += q * float(ln["unit_cost"])
    out = {k: {"cost": round(v["val"] / v["qty"], 2) if v["qty"] else v["last"], "unit": v["unit"],
               "source": "GR rata-rata 90 hari" if v["qty"] else "GR terakhir", "date": v["date"]} for k, v in agg.items()}
    missing = [i for i in item_ids if i not in out]
    if missing:
        async for o in db.supplier_prices.find({"item_id": {"$in": missing}, "deleted_at": None}, {"_id": 0}).sort("price", 1):
            out.setdefault(o["item_id"], {"cost": float(o["price"]), "unit": o.get("unit"), "source": "penawaran supplier",
                                          "date": o.get("valid_from")})
        async for v in db.vendor_items.find({"item_id": {"$in": missing}, "current_price": {"$gt": 0}}, {"_id": 0}):
            out.setdefault(v["item_id"], {"cost": float(v["current_price"]), "unit": v.get("unit"), "source": "katalog vendor",
                                          "date": None})
    return out


async def cost_recipe(lines: list[dict], yield_qty: float, price: Optional[float]) -> dict:
    db = get_db()
    ids = [ln.get("item_id") for ln in lines if ln.get("item_id")]
    items = {i["id"]: i async for i in db.items.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "unit_default": 1})}
    costs = await item_costs(ids)
    out, total, issues = [], 0.0, []
    for ln in lines:
        it = items.get(ln.get("item_id"))
        qty = float(ln.get("qty") or 0)
        waste = float(ln.get("waste_pct") or 0) / 100
        row = {**ln, "item_name": (it or {}).get("name") or ln.get("item_name"), "biaya": None}
        if not it:
            issues.append(f"Bahan {ln.get('item_name') or ln.get('item_id')} belum ada di master item")
            out.append(row)
            continue
        c = costs.get(it["id"])
        if not c:
            issues.append(f"{it['name']}: belum ada harga beli/penawaran")
            out.append(row)
            continue
        cu, cf = dim_of(c.get("unit") or it.get("unit_default"))
        ru, rf = dim_of(ln.get("unit") or it.get("unit_default"))
        if cu != ru:
            issues.append(f"{it['name']}: satuan resep '{ln.get('unit')}' tidak bisa dikonversi ke satuan harga '{c.get('unit')}'")
            out.append(row)
            continue
        qty_in_cost_unit = qty * rf / cf
        line_cost = qty_in_cost_unit * c["cost"] * (1 + waste)
        total += line_cost
        row.update({"biaya": round(line_cost, 2), "harga_satuan": c["cost"], "satuan_harga": c.get("unit"), "sumber_harga": c["source"]})
        out.append(row)
    yq = float(yield_qty or 1) or 1
    hpp = round(total / yq, 2)
    fc = round(hpp / float(price), 4) if price else None
    return {"lines": out, "total_bahan": round(total, 2), "porsi": yq, "hpp_per_porsi": hpp, "harga_jual": price,
            "food_cost_pct": round(fc * 100, 1) if fc is not None else None, "margin_per_porsi": round(float(price) - hpp, 2) if price else None,
            "lengkap": not issues, "masalah": issues,
            "peringatan": (f"Food cost {fc * 100:.1f}% di atas {FOOD_COST_ALERT * 100:.0f}%" if fc and fc > FOOD_COST_ALERT else None)}


async def get_recipe(menu_item_id: str) -> dict:
    db = get_db()
    m = await db.menu_items.find_one({"id": menu_item_id, "deleted_at": None}, {"_id": 0})
    if not m:
        raise NotFoundError("Menu")
    r = await db.recipes.find_one({"menu_item_id": menu_item_id, "deleted_at": None}, {"_id": 0})
    cost = await cost_recipe((r or {}).get("lines") or [], (r or {}).get("yield_qty") or 1, m.get("price"))
    return {"menu": m, "recipe": r, "costing": cost}


async def save_recipe(menu_item_id: str, payload: dict, *, user: dict) -> dict:
    db = get_db()
    m = await db.menu_items.find_one({"id": menu_item_id, "deleted_at": None}, {"_id": 0, "id": 1, "name": 1})
    if not m:
        raise NotFoundError("Menu")
    lines = []
    for ln in payload.get("lines") or []:
        if not ln.get("item_id") or float(ln.get("qty") or 0) <= 0:
            raise ValidationError("Setiap bahan butuh item_id dan qty > 0")
        waste = float(ln.get("waste_pct") or 0)
        if not 0 <= waste < 100:
            raise ValidationError("waste_pct harus 0–99")
        lines.append({"item_id": ln["item_id"], "qty": float(ln["qty"]), "unit": (ln.get("unit") or "").strip() or None,
                      "waste_pct": waste, "note": (ln.get("note") or "")[:200]})
    if not lines:
        raise ValidationError("Resep minimal 1 bahan")
    yq = float(payload.get("yield_qty") or 1)
    if yq <= 0:
        raise ValidationError("yield_qty (porsi) harus > 0")
    cur = await db.recipes.find_one({"menu_item_id": menu_item_id, "deleted_at": None}, {"_id": 0})
    doc = {"menu_item_id": menu_item_id, "yield_qty": yq, "lines": lines, "instructions": (payload.get("instructions") or "")[:5000],
           "version": ((cur or {}).get("version") or 0) + 1, "updated_at": _now(), "updated_by": user["id"]}
    if cur:
        await db.recipe_versions.insert_one({**cur, "archived_at": _now()})
        await db.recipes.update_one({"id": cur["id"]}, {"$set": doc})
        rid = cur["id"]
    else:
        rid = str(uuid.uuid4())
        await db.recipes.insert_one({"id": rid, **doc, "created_at": _now(), "created_by": user["id"], "deleted_at": None})
    if "price" in payload and payload["price"] is not None:
        await db.menu_items.update_one({"id": menu_item_id}, {"$set": {"price": float(payload["price"])}})
    await audit_log(user_id=user["id"], entity_type="recipe", entity_id=rid, action="update" if cur else "create",
                    after={"menu": m["name"], "version": doc["version"], "lines": len(lines)})
    return await get_recipe(menu_item_id)


async def costing_overview(brand_id: Optional[str] = None) -> dict:
    db = get_db()
    q: dict = {"deleted_at": None}
    if brand_id:
        q["brand_id"] = brand_id
    menus = await db.menu_items.find(q, {"_id": 0}).sort("name", 1).to_list(3000)
    recipes = {r["menu_item_id"]: r async for r in db.recipes.find({"menu_item_id": {"$in": [m["id"] for m in menus]}, "deleted_at": None},
                                                                   {"_id": 0})}
    rows = []
    for m in menus:
        r = recipes.get(m["id"])
        c = await cost_recipe(r["lines"], r.get("yield_qty") or 1, m.get("price")) if r else None
        rows.append({"id": m["id"], "name": m["name"], "brand_id": m.get("brand_id"), "category": m.get("category"),
                     "bucket": m.get("bucket"), "price": m.get("price"), "needs_review": m.get("needs_review", False),
                     "aliases": len(m.get("aliases") or []), "has_recipe": bool(r),
                     "hpp": (c or {}).get("hpp_per_porsi"), "food_cost_pct": (c or {}).get("food_cost_pct"),
                     "lengkap": (c or {}).get("lengkap"), "peringatan": (c or {}).get("peringatan")})
    with_fc = [x for x in rows if x["food_cost_pct"] is not None]
    return {"rows": rows, "ringkasan": {"menu": len(rows), "dengan_resep": sum(1 for x in rows if x["has_recipe"]),
                                        "food_cost_rata2": round(sum(x["food_cost_pct"] for x in with_fc) / len(with_fc), 1) if with_fc else None,
                                        "di_atas_batas": sum(1 for x in with_fc if x["food_cost_pct"] > FOOD_COST_ALERT * 100),
                                        "perlu_ditinjau": sum(1 for x in rows if x["needs_review"])}}
