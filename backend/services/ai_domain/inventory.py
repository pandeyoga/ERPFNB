"""Agen Inventory: pemakaian bahan teoretis vs aktual, analisis waste, saran transfer antar toko.

- **Teoretis** = Σ (qty menu terjual per toko, dari detail penjualan Impor Cerdas) × resep (dikonversi ke satuan item,
  termasuk susut). **Aktual** = stok awal + masuk (GR, transfer masuk) − stok akhir bila ada opname di awal & akhir
  periode; bila tidak, = pemakaian tercatat (mutasi keluar: penjualan, produksi, waste, penyesuaian minus).
  Selisih > 5% → periksa porsi, resep, pencatatan, atau kebocoran.
- **Waste**: mutasi `wastage` per item/toko — nilai, % terhadap pembelian, item terboros.
- **Saran transfer**: toko yang stoknya jauh di atas par → toko yang di bawah par untuk item yang sama (lebih murah &
  cepat daripada beli baru). Dibuat lewat POST /api/inventory/transfers (persetujuan).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from core.db import get_db
from core.security import scoped_outlet_ids

WIB = timezone(timedelta(hours=7))
OUT_TYPES = ("sale", "consumption", "production_out", "wastage")


def _today() -> date:
    return datetime.now(WIB).date()


def _rp(v: float) -> str:
    return f"Rp {v:,.0f}".replace(",", ".")


async def _outlet_filter(user: dict, outlet_id: Optional[str]) -> Optional[list[str]]:
    ids = scoped_outlet_ids(user)
    if outlet_id:
        if ids is not None and outlet_id not in ids:
            from core.exceptions import ForbiddenError
            raise ForbiddenError("Toko di luar akses Anda")
        return [outlet_id]
    return ids


async def usage_variance(user: dict, *, outlet_id: Optional[str] = None, start: Optional[str] = None,
                         end: Optional[str] = None, threshold_pct: float = 5.0) -> dict:
    from services.ai_purchasing.units import dim_of
    db = get_db()
    end = end or (_today() - timedelta(days=1)).isoformat()
    start = start or (date.fromisoformat(end) - timedelta(days=29)).isoformat()
    outs = await _outlet_filter(user, outlet_id)
    oq = {"outlet_id": {"$in": outs}} if outs is not None else {}
    # 1) penjualan per menu per toko
    sold: dict[tuple, float] = defaultdict(float)
    async for ln in db.sales_lines.find({"deleted_at": None, "business_date": {"$gte": start, "$lte": end}, "void": {"$ne": True}, **oq},
                                        {"_id": 0, "outlet_id": 1, "menu_item_id": 1, "qty": 1}):
        if ln.get("menu_item_id"):
            sold[(ln["outlet_id"], ln["menu_item_id"])] += float(ln.get("qty") or 0)
    recipes = {r["menu_item_id"]: r async for r in db.recipes.find({"menu_item_id": {"$in": list({k[1] for k in sold})}, "deleted_at": None},
                                                                   {"_id": 0})}
    items = {i["id"]: i async for i in db.items.find({"deleted_at": None}, {"_id": 0, "id": 1, "name": 1, "unit_default": 1})}
    theo: dict[tuple, float] = defaultdict(float)
    no_recipe = sorted({mid for (_, mid) in sold if mid not in recipes})
    for (oid, mid), qty in sold.items():
        r = recipes.get(mid)
        if not r:
            continue
        yq = float(r.get("yield_qty") or 1) or 1
        for ln in r.get("lines") or []:
            it = items.get(ln.get("item_id"))
            if not it:
                continue
            ru, rf = dim_of(ln.get("unit") or it.get("unit_default"))
            iu, if_ = dim_of(it.get("unit_default"))
            if ru != iu:
                continue
            per = float(ln.get("qty") or 0) * rf / if_ * (1 + float(ln.get("waste_pct") or 0) / 100) / yq
            theo[(oid, it["id"])] += per * qty
    # 2) aktual: dari opname awal/akhir bila ada, selain itu mutasi keluar tercatat
    actual: dict[tuple, float] = defaultdict(float)
    cost: dict[tuple, float] = {}
    async for m in db.inventory_movements.find({"deleted_at": None, "movement_date": {"$gte": start, "$lte": end},
                                                "movement_type": {"$in": list(OUT_TYPES) + ["adjustment"]}, **oq},
                                               {"_id": 0, "outlet_id": 1, "item_id": 1, "qty": 1, "unit_cost": 1, "movement_type": 1}):
        q = float(m.get("qty") or 0)
        if q < 0:
            actual[(m["outlet_id"], m["item_id"])] += -q
        if m.get("unit_cost"):
            cost[(m["outlet_id"], m["item_id"])] = float(m["unit_cost"])
    method = "mutasi keluar tercatat"
    ops = {}
    async for s in db.opname_sessions.find({"deleted_at": None, "status": {"$in": ["approved", "posted", "completed", "submitted"]},
                                            "opname_date": {"$gte": (date.fromisoformat(start) - timedelta(days=3)).isoformat(),
                                                            "$lte": (date.fromisoformat(end) + timedelta(days=3)).isoformat()}, **oq},
                                           {"_id": 0}).sort("opname_date", 1):
        ops.setdefault(s["outlet_id"], []).append(s)
    for oid, ss in ops.items():
        if len(ss) < 2:
            continue
        first, last = ss[0], ss[-1]
        method = "opname awal & akhir + penerimaan"
        open_q = {ln["item_id"]: float(ln.get("counted_qty") or 0) for ln in first.get("lines") or []}
        close_q = {ln["item_id"]: float(ln.get("counted_qty") or 0) for ln in last.get("lines") or []}
        ins: dict[str, float] = defaultdict(float)
        async for m in db.inventory_movements.find({"deleted_at": None, "outlet_id": oid, "movement_date": {"$gt": first["opname_date"], "$lte": last["opname_date"]},
                                                    "qty": {"$gt": 0}, "movement_type": {"$in": ["purchase_receive", "transfer_in", "production_in"]}},
                                                   {"_id": 0, "item_id": 1, "qty": 1}):
            ins[m["item_id"]] += float(m["qty"])
        for iid in set(open_q) | set(close_q):
            actual[(oid, iid)] = max(0.0, open_q.get(iid, 0) + ins.get(iid, 0) - close_q.get(iid, 0))
    outlets = {o["id"]: o["name"] async for o in db.outlets.find({}, {"_id": 0, "id": 1, "name": 1})}
    rows = []
    for key in set(theo) | {k for k in actual if k in theo or not sold}:
        t, a = round(theo.get(key, 0.0), 3), round(actual.get(key, 0.0), 3)
        if not t and not a:
            continue
        it = items.get(key[1], {})
        diff = round(a - t, 3)
        pct = round(diff / t * 100, 1) if t else None
        uc = cost.get(key, 0.0)
        status = "wajar" if t and abs(pct or 0) <= threshold_pct else ("lebih_boros" if diff > 0 else "lebih_hemat") if t else "tanpa_resep"
        rows.append({"toko": outlets.get(key[0]), "outlet_id": key[0], "item": it.get("name") or key[1], "item_id": key[1],
                     "satuan": it.get("unit_default"), "teoretis": t, "aktual": a, "selisih": diff, "selisih_pct": pct,
                     "nilai_selisih": round(diff * uc, 0), "status": status})
    rows.sort(key=lambda r: -abs(r["nilai_selisih"] or 0))
    return {"periode": [start, end], "metode_aktual": method, "rows": rows[:500],
            "ringkasan": {"item": len(rows), "lebih_boros": sum(1 for r in rows if r["status"] == "lebih_boros"),
                          "nilai_lebih_boros": round(sum(r["nilai_selisih"] for r in rows if r["status"] == "lebih_boros"), 0),
                          "menu_terjual": len({k[1] for k in sold}), "menu_tanpa_resep": len(no_recipe)},
            "catatan": ("Teoretis butuh detail penjualan per menu (Impor Cerdas) & resep (Menu & Resep)." if not sold else
                        f"{len(no_recipe)} menu terjual belum punya resep — lengkapi agar perhitungan akurat." if no_recipe else "")}


async def waste(user: dict, *, days: int = 30, outlet_id: Optional[str] = None) -> dict:
    db = get_db()
    since = (_today() - timedelta(days=days)).isoformat()
    outs = await _outlet_filter(user, outlet_id)
    oq = {"outlet_id": {"$in": outs}} if outs is not None else {}
    w: dict[tuple, dict] = defaultdict(lambda: {"qty": 0.0, "nilai": 0.0, "kali": 0})
    buy: dict[str, float] = defaultdict(float)
    async for m in db.inventory_movements.find({"deleted_at": None, "movement_date": {"$gte": since},
                                                "movement_type": {"$in": ["wastage", "purchase_receive"]}, **oq}, {"_id": 0}):
        val = abs(float(m.get("total_value") or (float(m.get("qty") or 0) * float(m.get("unit_cost") or 0))))
        if m["movement_type"] == "purchase_receive":
            buy[m["outlet_id"]] += val
            continue
        x = w[(m["outlet_id"], m["item_id"])]
        x["qty"] += abs(float(m.get("qty") or 0))
        x["nilai"] += val
        x["kali"] += 1
    items = {i["id"]: i.get("name") async for i in db.items.find({"id": {"$in": list({k[1] for k in w})}}, {"_id": 0, "id": 1, "name": 1})}
    outlets = {o["id"]: o["name"] async for o in db.outlets.find({}, {"_id": 0, "id": 1, "name": 1})}
    rows = sorted(({"toko": outlets.get(o), "outlet_id": o, "item": items.get(i) or i, "item_id": i, "qty": round(v["qty"], 3),
                    "nilai": round(v["nilai"], 0), "kali": v["kali"]} for (o, i), v in w.items()), key=lambda r: -r["nilai"])
    per_toko = defaultdict(float)
    for r in rows:
        per_toko[r["outlet_id"]] += r["nilai"]
    return {"hari": days, "rows": rows[:300],
            "per_toko": [{"toko": outlets.get(o), "nilai_waste": round(v, 0), "pembelian": round(buy.get(o, 0), 0),
                          "persen_dari_pembelian": round(v / buy[o] * 100, 1) if buy.get(o) else None}
                         for o, v in sorted(per_toko.items(), key=lambda x: -x[1])],
            "ringkasan": {"total_waste": round(sum(per_toko.values()), 0), "total_pembelian": round(sum(buy.values()), 0)}}


async def transfer_suggestions(user: dict, *, excess_factor: float = 2.0) -> dict:
    from services import inventory_matrix_service
    outs = scoped_outlet_ids(user)
    mx = await inventory_matrix_service.stock_balance_matrix(outlet_ids=outs, include_zero=True)
    names = {o["id"]: o.get("name") for o in mx.get("outlets") or []}
    sugg = []
    for row in mx.get("rows") or []:
        cells = [c for c in row["cells"] if c.get("par_level")]
        short = sorted((c for c in cells if c["qty"] < c["par_level"]), key=lambda c: c["qty"] - c["par_level"])
        extra = sorted((c for c in cells if c["qty"] > excess_factor * c["par_level"]), key=lambda c: -(c["qty"] - c["par_level"]))
        for s in short:
            need = round(s["par_level"] - s["qty"], 3)
            for e in extra:
                spare = round(e["qty"] - excess_factor * e["par_level"] * 0.5 - e["par_level"], 3)
                if spare <= 0 or need <= 0:
                    continue
                qty = round(min(need, spare), 3)
                sugg.append({"item": row["item_name"], "item_id": row["item_id"], "satuan": row.get("unit"), "dari": names.get(e["outlet_id"]),
                             "from_outlet_id": e["outlet_id"], "ke": names.get(s["outlet_id"]), "to_outlet_id": s["outlet_id"], "qty": qty,
                             "nilai": round(qty * (e.get("last_unit_cost") or 0), 0),
                             "alasan": f"{names.get(s['outlet_id'])} {s['qty']:g}/{s['par_level']:g} (par); {names.get(e['outlet_id'])} {e['qty']:g}/{e['par_level']:g}"})
                e["qty"] -= qty
                need -= qty
    by_pair: dict[tuple, dict] = {}
    for x in sugg:
        k = (x["from_outlet_id"], x["to_outlet_id"])
        b = by_pair.setdefault(k, {"from_outlet_id": k[0], "to_outlet_id": k[1], "transfer_date": _today().isoformat(),
                                   "notes": "Saran transfer Asisten AI: stok berlebih → toko di bawah par", "lines": []})
        b["lines"].append({"item_id": x["item_id"], "qty": x["qty"]})
    return {"rows": sugg, "draf_transfer": list(by_pair.values()),
            "ringkasan": {"saran": len(sugg), "nilai": round(sum(x["nilai"] for x in sugg), 0)},
            "catatan": "Usulkan tiap draf_transfer lewat POST /api/inventory/transfers (persetujuan)."}
