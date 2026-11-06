"""Sourcing — satu tempat untuk harga yang dipakai keputusan beli.

Analisis & desain: docs/audit/MARKET_PRICE_SOURCING_ANALYSIS_2026-11-05.md.

Tiga jenis harga, satu lookup:
  benchmark (harga acuan pasar) : `market_list_prices` — item × satuan × wilayah × periode (`price_periods`)
  offer (penawaran / kontrak)   : `supplier_prices`    — supplier × item × satuan × wilayah, berlaku dari–sampai
  actual (harga diterima)       : baris `goods_receipts` (riwayat)

Periode acuan bisa dipilih: weekly | monthly | quarterly. Default di pengaturan, boleh di-override per kategori
(mis. bahan segar mingguan, bahan kering bulanan). Wilayah: master `regions`, toko → `outlets.region_id`;
`region_id = None` = berlaku semua wilayah (dipakai bila wilayah toko tidak punya harga sendiri).

Satuan dibandingkan apa adanya (dinormalisasi huruf kecil). Harga dengan satuan berbeda tidak pernah dibandingkan
(dulu acuan per item tanpa satuan → deviasi salah).
"""
from __future__ import annotations

import logging
import statistics
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional

from core.clock import today_local
from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError

logger = logging.getLogger("aurora.sourcing")

PERIOD_TYPES = ("weekly", "monthly", "quarterly")
PERIOD_LABELS = {"weekly": "Mingguan", "monthly": "Bulanan", "quarterly": "Kuartalan"}
OFFER_SOURCES = ("rfq", "contract", "manual", "import")
BENCHMARK_SOURCES = ("survey", "offers_median", "manual", "import", "previous")
_MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

DEFAULT_SETTINGS = {
    "default_period_type": "monthly",
    "category_period_types": {},     # {category_id: period_type}
    "alert_pct": 10.0,               # harga aktual/penawaran > acuan + x% → ditandai
    "min_quotes": 3,                 # jumlah penawaran minimal per item (praktik 3 penawaran)
    "expiring_days": 7,              # penawaran yang habis ≤ x hari ditandai
    "analysis_days": 90,             # jendela riwayat GR untuk analisis
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _u(unit: Optional[str]) -> str:
    return (unit or "").strip().lower()


def _d(s) -> Optional[date]:
    if not s:
        return None
    if isinstance(s, date):
        return s if not isinstance(s, datetime) else s.date()
    try:
        return date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


def _pct(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or not b:
        return None
    return round((a - b) / b * 100, 2)


# =================== SETTINGS ===================

async def get_settings() -> dict:
    db = get_db()
    doc = await db.system_settings.find_one({"key": "sourcing"})
    val = (doc or {}).get("value") or {}
    return {**DEFAULT_SETTINGS, **val}


async def update_settings(patch: dict, *, user: dict) -> dict:
    cur = await get_settings()
    out = dict(cur)
    if "default_period_type" in patch:
        if patch["default_period_type"] not in PERIOD_TYPES:
            raise ValidationError(f"Periode harus salah satu dari {PERIOD_TYPES}", field="default_period_type")
        out["default_period_type"] = patch["default_period_type"]
    if "category_period_types" in patch:
        cats = patch["category_period_types"] or {}
        bad = [v for v in cats.values() if v not in PERIOD_TYPES]
        if bad:
            raise ValidationError(f"Periode kategori tidak valid: {bad}", field="category_period_types")
        out["category_period_types"] = {k: v for k, v in cats.items() if v}
    for key, lo, hi in (("alert_pct", 0, 100), ("min_quotes", 1, 10), ("expiring_days", 0, 90), ("analysis_days", 7, 365)):
        if key in patch and patch[key] is not None:
            v = float(patch[key])
            if not lo <= v <= hi:
                raise ValidationError(f"{key} harus {lo}–{hi}", field=key)
            out[key] = int(v) if key in ("min_quotes", "expiring_days", "analysis_days") else v
    db = get_db()
    await db.system_settings.update_one(
        {"key": "sourcing"},
        {"$set": {"key": "sourcing", "value": {k: out[k] for k in DEFAULT_SETTINGS}, "updated_at": _now(),
                  "updated_by": user["id"]}},
        upsert=True,
    )
    return out


async def period_type_for_category(category_id: Optional[str], settings: Optional[dict] = None) -> str:
    s = settings or await get_settings()
    return (s.get("category_period_types") or {}).get(category_id or "") or s["default_period_type"]


# =================== PERIODS ===================

def period_bounds(period_type: str, on: date) -> tuple[str, str, date, date]:
    """(key, label, start, end) periode yang memuat tanggal `on`."""
    if period_type == "weekly":
        start = on - timedelta(days=on.weekday())
        end = start + timedelta(days=6)
        iso = start.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}", f"Minggu {iso[1]} · {start.day} {_MONTHS_ID[start.month - 1]} {start.year}", start, end
    if period_type == "monthly":
        start = on.replace(day=1)
        nxt = (start + timedelta(days=32)).replace(day=1)
        return f"{on.year}-{on.month:02d}", f"{_MONTHS_ID[on.month - 1]} {on.year}", start, nxt - timedelta(days=1)
    if period_type == "quarterly":
        q = (on.month - 1) // 3 + 1
        start = date(on.year, 3 * (q - 1) + 1, 1)
        nxt = date(on.year + (q == 4), 1 if q == 4 else 3 * q + 1, 1)
        return f"{on.year}-Q{q}", f"Q{q}-{on.year}", start, nxt - timedelta(days=1)
    raise ValidationError(f"Periode harus salah satu dari {PERIOD_TYPES}", field="period_type")


async def ensure_period(period_type: str, on: date) -> dict:
    """Periode bertipe `period_type` yang memuat `on` (dibuat bila belum ada). Idempoten per (tipe, kunci)."""
    key, label, start, end = period_bounds(period_type, on)
    db = get_db()
    doc = await db.price_periods.find_one({"period_type": period_type, "key": key})
    if doc:
        return serialize(doc)
    doc = {"id": str(uuid.uuid4()), "period_type": period_type, "key": key, "label": label,
           "start_date": start.isoformat(), "end_date": end.isoformat(), "status": "open",
           "created_at": _now()}
    try:
        await db.price_periods.insert_one(doc)
    except Exception:  # noqa: BLE001 — race with a concurrent insert of the same (type, key)
        doc = await db.price_periods.find_one({"period_type": period_type, "key": key})
    return serialize(doc)


async def previous_period(period: dict) -> Optional[dict]:
    db = get_db()
    doc = await db.price_periods.find_one(
        {"period_type": period["period_type"], "start_date": {"$lt": period["start_date"]}},
        sort=[("start_date", -1)])
    return serialize(doc) if doc else None


async def list_periods(period_type: Optional[str] = None, limit: int = 24) -> list[dict]:
    db = get_db()
    q = {"period_type": period_type} if period_type else {}
    docs = await db.price_periods.find(q).sort([("start_date", -1)]).limit(limit).to_list(limit)
    return [serialize(d) for d in docs]


async def migrate_legacy_quarters() -> int:
    """Kuartal Market List lama → price_periods (id sama) & harga acuan diberi period_id. Idempoten."""
    db = get_db()
    n = 0
    async for q in db.market_list_quarters.find({}):
        start = _d(q.get("effective_from"))
        if not start:
            continue
        key, label, s, e = period_bounds("quarterly", start)
        if not await db.price_periods.find_one({"id": q["id"]}):
            if await db.price_periods.find_one({"period_type": "quarterly", "key": key}):
                continue
            await db.price_periods.insert_one({
                "id": q["id"], "period_type": "quarterly", "key": key, "label": label,
                "start_date": s.isoformat(), "end_date": e.isoformat(),
                "status": "closed" if q.get("status") == "closed" else "open", "created_at": q.get("created_at") or _now(),
            })
            n += 1
    res = await db.market_list_prices.update_many(
        {"period_id": {"$exists": False}, "quarter_id": {"$exists": True}},
        [{"$set": {"period_id": "$quarter_id", "period_type": "quarterly", "region_id": None}}],
    )
    res2 = await db.market_list_prices.update_many(
        {"unit_norm": {"$exists": False}}, [{"$set": {"unit_norm": {"$toLower": {"$trim": {"input": {"$ifNull": ["$unit", ""]}}}}}}])
    n += res2.modified_count
    return n + res.modified_count


async def ensure_indexes() -> None:
    db = get_db()
    await db.price_periods.create_index([("period_type", 1), ("key", 1)], unique=True)
    await db.price_periods.create_index([("period_type", 1), ("start_date", -1)])
    await db.market_list_prices.create_index([("item_id", 1), ("unit_norm", 1), ("region_id", 1), ("period_id", 1)])
    await db.supplier_prices.create_index([("item_id", 1), ("deleted_at", 1), ("valid_from", 1)])
    await db.supplier_prices.create_index([("vendor_id", 1), ("deleted_at", 1)])
    await db.goods_receipts.create_index([("receive_date", -1)])


# =================== REGIONS ===================

async def region_map() -> dict[str, dict]:
    db = get_db()
    return {r["id"]: serialize(r) async for r in db.regions.find({"deleted_at": None})}


async def outlet_region_map() -> dict[str, Optional[str]]:
    db = get_db()
    return {o["id"]: o.get("region_id") async for o in db.outlets.find({"deleted_at": None}, {"id": 1, "region_id": 1})}


async def region_of_outlet(outlet_id: Optional[str]) -> Optional[str]:
    if not outlet_id:
        return None
    db = get_db()
    o = await db.outlets.find_one({"id": outlet_id}, {"region_id": 1})
    return (o or {}).get("region_id")


# =================== BENCHMARK (HARGA ACUAN) ===================

async def set_benchmark(*, item_id: str, unit: str, price: float, region_id: Optional[str] = None,
                        period_type: Optional[str] = None, on: Optional[str] = None, period_id: Optional[str] = None,
                        source: str = "manual", source_note: Optional[str] = None, user: dict) -> dict:
    db = get_db()
    if price is None or float(price) <= 0:
        raise ValidationError("Harga acuan harus lebih besar dari 0", field="price")
    if source not in BENCHMARK_SOURCES:
        raise ValidationError(f"Sumber harus salah satu dari {BENCHMARK_SOURCES}", field="source")
    item = await db.items.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Item tidak ditemukan")
    if region_id and not await db.regions.find_one({"id": region_id, "deleted_at": None}):
        raise NotFoundError("Wilayah tidak ditemukan")
    unit = (unit or item.get("unit_default") or "").strip()
    if not unit:
        raise ValidationError("Satuan wajib", field="unit")
    if period_id:
        period = await db.price_periods.find_one({"id": period_id})
        if not period:
            raise NotFoundError("Periode tidak ditemukan")
        period = serialize(period)
    else:
        ptype = period_type or await period_type_for_category(item.get("category_id"))
        period = await ensure_period(ptype, _d(on) or today_local())
    if period.get("status") == "closed":
        raise ValidationError(f"Periode {period['label']} sudah ditutup", field="period_id")

    prev_p = await previous_period(period)
    prev = await db.market_list_prices.find_one({"period_id": prev_p["id"], "item_id": item_id, "unit_norm": _u(unit),
                                                 "region_id": region_id}) if prev_p else None
    prev_price = (prev or {}).get("ref_price")
    flt = {"period_id": period["id"], "item_id": item_id, "unit_norm": _u(unit), "region_id": region_id}
    now = _now()
    patch = {
        **flt, "unit": unit, "ref_price": round(float(price), 2), "period_type": period["period_type"],
        "period_label": period["label"], "quarter_label": period["label"],  # quarter_label: kompatibel UI lama
        "previous_ref_price": prev_price, "variance_pct": _pct(float(price), prev_price),
        "source": source, "source_note": source_note, "updated_at": now, "updated_by": user["id"],
    }
    existing = await db.market_list_prices.find_one(flt)
    if existing:
        await db.market_list_prices.update_one({"id": existing["id"]}, {"$set": patch})
        doc = await db.market_list_prices.find_one({"id": existing["id"]})
    else:
        doc = {"id": str(uuid.uuid4()), **patch, "created_at": now, "created_by": user["id"]}
        await db.market_list_prices.insert_one(doc)
    return serialize(doc)


async def bulk_set_benchmarks(rows: list[dict], *, user: dict) -> dict:
    ok, errors = 0, []
    for i, r in enumerate(rows or []):
        try:
            await set_benchmark(item_id=r.get("item_id"), unit=r.get("unit"), price=float(r.get("price") or 0),
                                region_id=r.get("region_id") or None, period_type=r.get("period_type"),
                                on=r.get("on"), period_id=r.get("period_id"), source=r.get("source") or "manual",
                                source_note=r.get("source_note"), user=user)
            ok += 1
        except Exception as e:  # noqa: BLE001 — per-baris; laporkan semua yang gagal
            errors.append({"row": i + 1, "item_id": r.get("item_id"), "error": getattr(e, "message", str(e))})
    return {"ok": ok, "errors": errors}


async def benchmark_for(item: dict, unit: Optional[str], region_id: Optional[str], on: Optional[date] = None,
                        settings: Optional[dict] = None) -> Optional[dict]:
    """Harga acuan berlaku: periode item (tipe kategori) yang memuat `on`, wilayah toko dulu lalu semua wilayah.
    Bila periode berjalan belum diisi → acuan periode terakhir sebelumnya (`stale: true`)."""
    db = get_db()
    on = on or today_local()
    unit_n = _u(unit or item.get("unit_default"))
    ptype = await period_type_for_category(item.get("category_id"), settings)
    regions = [region_id, None] if region_id else [None]
    key = period_bounds(ptype, on)[0]
    period = await db.price_periods.find_one({"period_type": ptype, "key": key})
    for rid in regions:
        q = {"item_id": item["id"], "unit_norm": unit_n, "region_id": rid, "period_type": ptype}
        if period:
            doc = await db.market_list_prices.find_one({**q, "period_id": period["id"]})
            if doc:
                return {**serialize(doc), "stale": False}
    for rid in regions:
        q = {"item_id": item["id"], "unit_norm": unit_n, "region_id": rid, "period_type": ptype}
        docs = await db.market_list_prices.find(q).to_list(200)
        ids = [d["period_id"] for d in docs]
        if not ids:
            continue
        periods = {p["id"]: p async for p in db.price_periods.find({"id": {"$in": ids}, "start_date": {"$lte": on.isoformat()}})}
        docs = [d for d in docs if d["period_id"] in periods]
        if docs:
            best = max(docs, key=lambda d: periods[d["period_id"]]["start_date"])
            return {**serialize(best), "stale": True}
    return None


async def benchmark_history(item_id: str, unit: str, region_id: Optional[str], limit: int = 12) -> list[dict]:
    db = get_db()
    docs = await db.market_list_prices.find({"item_id": item_id, "unit_norm": _u(unit),
                                             "region_id": {"$in": [region_id, None] if region_id else [None]}}).to_list(500)
    pids = list({d["period_id"] for d in docs})
    periods = {p["id"]: p async for p in db.price_periods.find({"id": {"$in": pids}})}
    rows = []
    for d in docs:
        p = periods.get(d["period_id"])
        if p:
            rows.append({"period_id": p["id"], "label": p["label"], "start_date": p["start_date"], "period_type": p["period_type"],
                         "region_id": d.get("region_id"), "price": d["ref_price"], "source": d.get("source")})
    rows.sort(key=lambda r: (r["start_date"], r["region_id"] is not None))
    return rows[-limit * 2:]


# =================== OFFERS (PENAWARAN SUPPLIER) ===================

def _offer_status(doc: dict, today: date) -> str:
    vf, vt = _d(doc.get("valid_from")), _d(doc.get("valid_to"))
    if vf and vf > today:
        return "upcoming"
    if vt and vt < today:
        return "expired"
    return "valid"


async def upsert_offer(payload: dict, *, user: dict, offer_id: Optional[str] = None) -> dict:
    db = get_db()
    vendor = await db.vendors.find_one({"id": payload.get("vendor_id"), "deleted_at": None})
    if not vendor:
        raise NotFoundError("Supplier tidak ditemukan")
    item = await db.items.find_one({"id": payload.get("item_id"), "deleted_at": None})
    if not item:
        raise NotFoundError("Item tidak ditemukan")
    price = float(payload.get("price") or 0)
    if price <= 0:
        raise ValidationError("Harga penawaran harus lebih besar dari 0", field="price")
    unit = (payload.get("unit") or item.get("unit_default") or "").strip()
    if not unit:
        raise ValidationError("Satuan wajib", field="unit")
    vf = _d(payload.get("valid_from")) or today_local()
    vt = _d(payload.get("valid_to"))
    if vt and vt < vf:
        raise ValidationError("Berlaku sampai harus setelah berlaku dari", field="valid_to")
    region_id = payload.get("region_id") or None
    if region_id and not await db.regions.find_one({"id": region_id, "deleted_at": None}):
        raise NotFoundError("Wilayah tidak ditemukan")
    source = payload.get("source") or "manual"
    if source not in OFFER_SOURCES:
        raise ValidationError(f"Sumber harus salah satu dari {OFFER_SOURCES}", field="source")
    moq = float(payload.get("min_order_qty") or 0)
    lead = int(payload.get("lead_time_days") or 0)
    if moq < 0 or lead < 0:
        raise ValidationError("MOQ / lead time tidak boleh negatif")
    now = _now()
    fields = {
        "vendor_id": vendor["id"], "item_id": item["id"], "unit": unit, "unit_norm": _u(unit), "price": round(price, 2),
        "min_order_qty": moq, "lead_time_days": lead, "valid_from": vf.isoformat(),
        "valid_to": vt.isoformat() if vt else None, "region_id": region_id, "source": source,
        "source_ref": payload.get("source_ref"), "notes": payload.get("notes"), "updated_at": now, "updated_by": user["id"],
    }
    if offer_id:
        cur = await db.supplier_prices.find_one({"id": offer_id, "deleted_at": None})
        if not cur:
            raise NotFoundError("Penawaran tidak ditemukan")
        await db.supplier_prices.update_one({"id": offer_id}, {"$set": fields})
        doc = await db.supplier_prices.find_one({"id": offer_id})
    else:
        doc = {"id": str(uuid.uuid4()), **fields, "created_at": now, "created_by": user["id"], "deleted_at": None}
        await db.supplier_prices.insert_one(doc)
    return await _enrich_offer(serialize(doc))


async def delete_offer(offer_id: str, *, user: dict) -> dict:
    db = get_db()
    res = await db.supplier_prices.update_one({"id": offer_id, "deleted_at": None},
                                              {"$set": {"deleted_at": _now(), "updated_by": user["id"]}})
    if not res.matched_count:
        raise NotFoundError("Penawaran tidak ditemukan")
    return {"id": offer_id, "deleted": True}


async def bulk_upsert_offers(rows: list[dict], *, user: dict) -> dict:
    ok, errors = 0, []
    for i, r in enumerate(rows or []):
        try:
            await upsert_offer({**r, "source": r.get("source") or "import"}, user=user)
            ok += 1
        except Exception as e:  # noqa: BLE001
            errors.append({"row": i + 1, "item_id": r.get("item_id"), "vendor_id": r.get("vendor_id"),
                           "error": getattr(e, "message", str(e))})
    return {"ok": ok, "errors": errors}


async def _enrich_offer(doc: dict, *, vendors: Optional[dict] = None, items: Optional[dict] = None,
                        regions: Optional[dict] = None) -> dict:
    db = get_db()
    v = (vendors or {}).get(doc["vendor_id"]) if vendors is not None else await db.vendors.find_one({"id": doc["vendor_id"]})
    it = (items or {}).get(doc["item_id"]) if items is not None else await db.items.find_one({"id": doc["item_id"]})
    rg = (regions or {}).get(doc.get("region_id")) if regions is not None else (
        await db.regions.find_one({"id": doc["region_id"]}) if doc.get("region_id") else None)
    doc["vendor_name"] = (v or {}).get("name") or "(supplier tidak ditemukan)"
    doc["item_name"] = (it or {}).get("name") or "(item tidak ditemukan)"
    doc["region_name"] = (rg or {}).get("name") if doc.get("region_id") else "Semua wilayah"
    doc["status"] = _offer_status(doc, today_local())
    return doc


async def list_offers(*, vendor_id: Optional[str] = None, item_id: Optional[str] = None, region_id: Optional[str] = None,
                      status: Optional[str] = None, search: Optional[str] = None,
                      page: int = 1, per_page: int = 50) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if vendor_id:
        q["vendor_id"] = vendor_id
    if item_id:
        q["item_id"] = item_id
    if region_id:
        q["region_id"] = {"$in": [region_id, None]}
    today = today_local().isoformat()
    if status == "valid":
        q["valid_from"] = {"$lte": today}
        q["$or"] = [{"valid_to": None}, {"valid_to": {"$gte": today}}]
    elif status == "expired":
        q["valid_to"] = {"$lt": today}
    elif status == "upcoming":
        q["valid_from"] = {"$gt": today}
    if search:
        import re
        rx = {"$regex": re.escape(search), "$options": "i"}
        ids = [i["id"] async for i in db.items.find({"$or": [{"name": rx}, {"code": rx}]}, {"id": 1})]
        vids = [v["id"] async for v in db.vendors.find({"name": rx}, {"id": 1})]
        q["$and"] = [{"$or": [{"item_id": {"$in": ids}}, {"vendor_id": {"$in": vids}}]}]
    total = await db.supplier_prices.count_documents(q)
    docs = await db.supplier_prices.find(q).sort([("valid_from", -1), ("price", 1)]).skip((page - 1) * per_page) \
        .limit(per_page).to_list(per_page)
    vendors = {v["id"]: v async for v in db.vendors.find({"id": {"$in": list({d["vendor_id"] for d in docs})}})}
    items = {i["id"]: i async for i in db.items.find({"id": {"$in": list({d["item_id"] for d in docs})}})}
    regions = await region_map()
    out = [await _enrich_offer(serialize(d), vendors=vendors, items=items, regions=regions) for d in docs]
    return out, {"page": page, "per_page": per_page, "total": total}


async def active_offers(item_ids: Iterable[str], region_id: Optional[str] = None, on: Optional[date] = None) -> list[dict]:
    """Penawaran berlaku pada `on` untuk item-item ini (wilayah sendiri + semua wilayah)."""
    db = get_db()
    on_s = (on or today_local()).isoformat()
    q: dict = {"item_id": {"$in": list(item_ids)}, "deleted_at": None, "valid_from": {"$lte": on_s},
               "$or": [{"valid_to": None}, {"valid_to": {"$gte": on_s}}]}
    if region_id:  # tanpa wilayah = semua penawaran
        q["region_id"] = {"$in": [region_id, None]}
    return [serialize(d) for d in await db.supplier_prices.find(q).to_list(5000)]


async def offers_from_rfq_quote(rfq: dict, quote: dict, *, user: dict) -> int:
    """Setiap penawaran RFQ yang masuk = penawaran supplier berlaku (sumber `rfq`). Satu baris per item; diganti
    bila supplier yang sama menawar ulang di RFQ yang sama."""
    db = get_db()
    units = {it.get("item_id"): it.get("uom") or it.get("unit") for it in rfq.get("items", [])}
    region_id = await region_of_outlet(rfq.get("outlet_id"))
    n = 0
    for ln in quote.get("lines", []):
        if not ln.get("item_id") or float(ln.get("unit_price") or 0) <= 0:
            continue
        await db.supplier_prices.update_many(
            {"source": "rfq", "source_ref": rfq.get("rfq_no"), "vendor_id": quote["vendor_id"], "item_id": ln["item_id"],
             "deleted_at": None}, {"$set": {"deleted_at": _now()}})
        try:
            await upsert_offer({
                "vendor_id": quote["vendor_id"], "item_id": ln["item_id"], "unit": units.get(ln["item_id"]),
                "price": ln["unit_price"], "min_order_qty": ln.get("moq") or 0, "lead_time_days": ln.get("lead_time_days") or 0,
                "valid_from": today_local().isoformat(), "valid_to": ln.get("validity_date") or None,
                "region_id": region_id, "source": "rfq", "source_ref": rfq.get("rfq_no"), "notes": ln.get("notes"),
            }, user=user)
            n += 1
        except Exception as e:  # noqa: BLE001 — RFQ tetap tersimpan walau satu baris tidak valid
            logger.warning("rfq→supplier_prices gagal %s/%s: %s", rfq.get("rfq_no"), ln.get("item_id"), e)
    return n


# =================== ACTUAL (HARGA DITERIMA DARI GR) ===================

async def _gr_lines(item_ids: Optional[list[str]], since: date, outlet_ids: Optional[list[str]] = None) -> list[dict]:
    """Baris GR (posted) sejak `since` + metrik pengiriman dari PO-nya."""
    db = get_db()
    q: dict = {"deleted_at": None, "receive_date": {"$gte": since.isoformat()}, "status": {"$nin": ["cancelled", "void", "draft"]}}
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    grs = await db.goods_receipts.find(q, {"_id": 0}).to_list(20000)
    po_ids = list({g.get("po_id") for g in grs if g.get("po_id")})
    pos = {p["id"]: p async for p in db.purchase_orders.find({"id": {"$in": po_ids}},
                                                           {"_id": 0, "id": 1, "expected_delivery_date": 1, "order_date": 1})}
    want = set(item_ids) if item_ids is not None else None
    out = []
    for g in grs:
        po = pos.get(g.get("po_id")) or {}
        exp, rec, ordered = _d(po.get("expected_delivery_date")), _d(g.get("receive_date")), _d(po.get("order_date"))
        for ln in g.get("lines") or []:
            iid = ln.get("item_id")
            if not iid or (want is not None and iid not in want):
                continue
            out.append({
                "item_id": iid, "vendor_id": g.get("vendor_id"), "outlet_id": g.get("outlet_id"), "date": g.get("receive_date"),
                "doc_no": g.get("doc_no"), "unit_norm": _u(ln.get("unit")), "unit": ln.get("unit"),
                "price": float(ln.get("unit_cost") or 0), "qty_received": float(ln.get("qty_received") or 0),
                "qty_ordered": float(ln.get("qty_ordered") or ln.get("qty_received") or 0),
                "qty_rejected": float(ln.get("qty_rejected") or 0),
                "on_time": (rec <= exp) if (rec and exp) else None,
                "lead_days": (rec - ordered).days if (rec and ordered) else None,
            })
    return out


def _supplier_stats(lines: list[dict]) -> dict:
    lines = sorted(lines, key=lambda x: x["date"] or "")
    qo = sum(x["qty_ordered"] for x in lines)
    qr = sum(x["qty_received"] for x in lines)
    rej = sum(x["qty_rejected"] for x in lines)
    ot = [x["on_time"] for x in lines if x["on_time"] is not None]
    lead = [x["lead_days"] for x in lines if x["lead_days"] is not None]
    prices = [x["price"] for x in lines if x["price"] > 0]
    last = lines[-1] if lines else None
    return {
        "purchases": len({x["doc_no"] for x in lines}),
        "qty": round(qr, 3),
        "spend": round(sum(x["price"] * x["qty_received"] for x in lines), 2),
        "last_price": last["price"] if last else None, "last_date": last["date"] if last else None,
        "avg_price": round(sum(x["price"] * x["qty_received"] for x in lines) / qr, 2) if qr else None,
        "min_price": min(prices) if prices else None, "max_price": max(prices) if prices else None,
        "fill_rate_pct": round(min(qr, qo) / qo * 100, 1) if qo else None,
        "reject_rate_pct": round(rej / (qr + rej) * 100, 1) if (qr + rej) else None,
        "on_time_pct": round(sum(ot) / len(ot) * 100, 1) if ot else None,
        "avg_lead_days": round(statistics.mean(lead), 1) if lead else None,
    }


def _score_basis(price: Optional[float], best: Optional[float], st: dict) -> list[str]:
    basis = []
    if price and best:
        basis.append("harga")
    if st.get("fill_rate_pct") is not None:
        basis.append("kelengkapan")
    if st.get("on_time_pct") is not None:
        basis.append("tepat waktu")
    if st.get("reject_rate_pct") is not None:
        basis.append("kualitas")
    return basis


def supplier_score(*, price: Optional[float], best_price: Optional[float], fill_rate: Optional[float],
                   on_time: Optional[float], reject_rate: Optional[float]) -> Optional[float]:
    """Skor 0–100: Harga 40 · Kelengkapan 25 · Ketepatan 20 · Kualitas 15. Komponen tanpa data tidak dihitung dan
    bobotnya dibagi ulang (dulu komponen kosong = 0 sehingga vendor tanpa data on-time maksimal 60)."""
    parts = []
    if price and best_price:
        parts.append((max(0.0, 100 - (price - best_price) / best_price * 100 * 2), 40))  # tiap 1% di atas termurah = −2
    if fill_rate is not None:
        parts.append((fill_rate, 25))
    if on_time is not None:
        parts.append((on_time, 20))
    if reject_rate is not None:
        parts.append((max(0.0, 100 - reject_rate * 5), 15))
    if not parts:
        return None
    w = sum(p[1] for p in parts)
    return round(sum(v * wt for v, wt in parts) / w, 1)


# =================== OVERVIEW (TABEL GLOBAL) ===================

async def overview(*, region_id: Optional[str] = None, category_id: Optional[str] = None, search: Optional[str] = None,
                   flag: Optional[str] = None, outlet_ids: Optional[list[str]] = None) -> dict:
    """Satu baris per item: acuan, penawaran terbaik, harga aktual terakhir, jumlah supplier, potensi hemat, penanda."""
    import re
    db = get_db()
    s = await get_settings()
    today = today_local()
    iq: dict = {"deleted_at": None, "ml_status": {"$ne": "pending_review"}}
    if category_id:
        iq["category_id"] = category_id
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        iq["$or"] = [{"name": rx}, {"code": rx}]
    items = await db.items.find(iq, {"_id": 0}).sort([("name", 1)]).to_list(2000)
    ids = [i["id"] for i in items]
    cats = {c["id"]: c.get("name") async for c in db.categories.find({}, {"id": 1, "name": 1})}
    vendors = {v["id"]: v.get("name") async for v in db.vendors.find({}, {"id": 1, "name": 1})}

    if region_id and outlet_ids is None:
        omap = await outlet_region_map()
        outlet_ids = [o for o, r in omap.items() if r == region_id]
    lines = await _gr_lines(ids, today - timedelta(days=s["analysis_days"]), outlet_ids)
    by_item: dict[str, list] = {}
    for ln in lines:
        by_item.setdefault(ln["item_id"], []).append(ln)
    offers = await active_offers(ids, region_id, today)
    off_by_item: dict[str, list] = {}
    for o in offers:
        off_by_item.setdefault(o["item_id"], []).append(o)
    avail = {(d["vendor_id"], d["item_id"]): d.get("availability_status")
             async for d in db.vendor_items.find({}, {"vendor_id": 1, "item_id": 1, "availability_status": 1})}

    rows = []
    for it in items:
        unit_n = _u(it.get("unit_default"))
        bm = await benchmark_for(it, it.get("unit_default"), region_id, today, s)
        bm_price = (bm or {}).get("ref_price")
        its = [x for x in by_item.get(it["id"], []) if x["unit_norm"] == unit_n and x["price"] > 0]
        offs = sorted([o for o in off_by_item.get(it["id"], []) if o["unit_norm"] == unit_n], key=lambda o: o["price"])
        best = offs[0] if offs else None
        last = max(its, key=lambda x: x["date"] or "") if its else None
        supplier_ids = {x["vendor_id"] for x in its} | {o["vendor_id"] for o in offs}
        supplier_ids = {v for v in supplier_ids if avail.get((v, it["id"])) not in ("unavailable", "discontinued")}
        spend = sum(x["price"] * x["qty_received"] for x in its)
        saving = sum(max(0.0, x["price"] - best["price"]) * x["qty_received"] for x in its) if best else 0.0
        expiring = [o for o in offs if o.get("valid_to") and _d(o["valid_to"]) <= today + timedelta(days=s["expiring_days"])]
        last_vs = _pct(last["price"], bm_price) if last else None
        flags = []
        if not bm:
            flags.append("no_benchmark")
        elif bm.get("stale"):
            flags.append("stale_benchmark")
        if last_vs is not None and last_vs > s["alert_pct"]:
            flags.append("above_benchmark")
        if len(supplier_ids) <= 1 and (its or offs):
            flags.append("single_source")
        if len({o["vendor_id"] for o in offs}) < s["min_quotes"]:
            flags.append("few_quotes")
        if expiring:
            flags.append("offer_expiring")
        if saving > 0:
            flags.append("saving")
        row = {
            "item_id": it["id"], "item_code": it.get("code"), "item_name": it.get("name"), "unit": it.get("unit_default"),
            "category_id": it.get("category_id"), "category_name": cats.get(it.get("category_id"), ""),
            "benchmark": bm_price, "benchmark_label": (bm or {}).get("period_label") or (bm or {}).get("quarter_label"),
            "benchmark_stale": bool((bm or {}).get("stale")), "benchmark_change_pct": (bm or {}).get("variance_pct"),
            "best_offer": best["price"] if best else None,
            "best_offer_vendor": vendors.get(best["vendor_id"]) if best else None,
            "best_offer_vendor_id": best["vendor_id"] if best else None,
            "best_offer_valid_to": best.get("valid_to") if best else None,
            "best_offer_vs_benchmark_pct": _pct(best["price"], bm_price) if best else None,
            "offers_count": len({o["vendor_id"] for o in offs}),
            "last_price": last["price"] if last else None, "last_vendor": vendors.get(last["vendor_id"]) if last else None,
            "last_date": last["date"] if last else None, "last_vs_benchmark_pct": last_vs,
            "suppliers_count": len(supplier_ids), "spend": round(spend, 2), "potential_saving": round(saving, 2),
            "flags": flags,
        }
        if flag and flag not in flags:
            continue
        rows.append(row)
    kpi = {
        "items": len(rows),
        "spend": round(sum(r["spend"] for r in rows), 2),
        "potential_saving": round(sum(r["potential_saving"] for r in rows), 2),
        "above_benchmark": sum("above_benchmark" in r["flags"] for r in rows),
        "single_source": sum("single_source" in r["flags"] for r in rows),
        "no_benchmark": sum("no_benchmark" in r["flags"] for r in rows),
        "few_quotes": sum("few_quotes" in r["flags"] for r in rows),
    }
    return {"rows": rows, "kpi": kpi, "settings": s, "analysis_days": s["analysis_days"], "as_of": today.isoformat()}


# =================== ITEM DETAIL ===================

async def item_detail(item_id: str, *, region_id: Optional[str] = None, outlet_ids: Optional[list[str]] = None) -> dict:
    db = get_db()
    item = await db.items.find_one({"id": item_id, "deleted_at": None}, {"_id": 0})
    if not item:
        raise NotFoundError("Item tidak ditemukan")
    s = await get_settings()
    today = today_local()
    unit = item.get("unit_default")
    unit_n = _u(unit)
    cat = await db.categories.find_one({"id": item.get("category_id")}, {"_id": 0, "name": 1})
    if region_id and outlet_ids is None:
        omap = await outlet_region_map()
        outlet_ids = [o for o, r in omap.items() if r == region_id]
    since = today - timedelta(days=max(s["analysis_days"], 180))
    lines = [x for x in await _gr_lines([item_id], since, outlet_ids) if x["price"] > 0]
    other_units = sorted({x["unit"] for x in lines if x["unit_norm"] != unit_n and x["unit"]})
    lines = [x for x in lines if x["unit_norm"] == unit_n]
    offers = [o for o in await active_offers([item_id], region_id, today) if o["unit_norm"] == unit_n]
    all_offers, _ = await list_offers(item_id=item_id, region_id=region_id, per_page=200)
    bm = await benchmark_for(item, unit, region_id, today, s)
    bm_price = (bm or {}).get("ref_price")
    history = await benchmark_history(item_id, unit, region_id)
    vendor_ids = {x["vendor_id"] for x in lines} | {o["vendor_id"] for o in offers}
    vendors = {v["id"]: v async for v in db.vendors.find({"id": {"$in": list(vendor_ids)}}, {"_id": 0})}
    avail = {d["vendor_id"]: d async for d in db.vendor_items.find({"item_id": item_id}, {"_id": 0})}
    best_offer = min((o["price"] for o in offers), default=None)
    cut = today - timedelta(days=s["analysis_days"])
    recent = [x for x in lines if (_d(x["date"]) or today) >= cut]
    best_actual = min((x["price"] for x in recent), default=None)
    ref_best = min([p for p in (best_offer, best_actual) if p], default=None)

    suppliers = []
    for vid in vendor_ids:
        mine = [x for x in recent if x["vendor_id"] == vid]
        st = _supplier_stats(mine)
        off = sorted([o for o in offers if o["vendor_id"] == vid], key=lambda o: o["price"])
        offer = off[0] if off else None
        price_for_score = offer["price"] if offer else st["last_price"]
        vi = avail.get(vid) or {}
        suppliers.append({
            "vendor_id": vid, "vendor_name": (vendors.get(vid) or {}).get("name") or "(supplier tidak ditemukan)",
            "offer_price": offer["price"] if offer else None, "offer_id": offer["id"] if offer else None,
            "offer_valid_to": offer.get("valid_to") if offer else None,
            "offer_moq": offer.get("min_order_qty") if offer else None,
            "offer_lead_days": offer.get("lead_time_days") if offer else None,
            "offer_source": offer.get("source") if offer else None,
            **st,
            "offer_vs_benchmark_pct": _pct(offer["price"], bm_price) if offer else None,
            "last_vs_benchmark_pct": _pct(st["last_price"], bm_price),
            "availability": vi.get("availability_status") or "available",
            "score": supplier_score(price=price_for_score, best_price=ref_best, fill_rate=st["fill_rate_pct"],
                                    on_time=st["on_time_pct"], reject_rate=st["reject_rate_pct"]),
            # komponen yang benar-benar dihitung (UI: "harga saja" bila belum ada riwayat kirim)
            "score_basis": _score_basis(price_for_score, ref_best, st),
        })
    suppliers.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0)))

    # Seri harga per minggu: acuan vs harga diterima per supplier (rata-rata tertimbang qty per minggu)
    series: dict[str, dict] = {}
    for x in lines:
        dd = _d(x["date"])
        if not dd:
            continue
        wk = (dd - timedelta(days=dd.weekday())).isoformat()
        row = series.setdefault(wk, {"week": wk})
        name = (vendors.get(x["vendor_id"]) or {}).get("name") or x["vendor_id"]
        acc = row.setdefault(f"_{name}", [0.0, 0.0])
        acc[0] += x["price"] * x["qty_received"]
        acc[1] += x["qty_received"]
    trend = []
    for wk in sorted(series):
        row = {"week": wk}
        for k, acc in series[wk].items():
            if k.startswith("_") and acc[1]:
                row[k[1:]] = round(acc[0] / acc[1], 2)
        hb = [h for h in history if h["start_date"] <= wk and (h["region_id"] == region_id or h["region_id"] is None)]
        if hb:
            row["Acuan"] = hb[-1]["price"]
        trend.append(row)

    total = _supplier_stats(recent)
    saving = sum(max(0.0, x["price"] - best_offer) * x["qty_received"] for x in recent) if best_offer else 0.0
    insights = []
    if not bm:
        insights.append({"tone": "warning", "text": "Belum ada harga acuan untuk item ini di periode berjalan."})
    elif bm.get("stale"):
        insights.append({"tone": "warning", "text": f"Harga acuan masih dari periode {bm.get('period_label')}; perbarui untuk periode berjalan."})
    if total["last_price"] and bm_price and _pct(total["last_price"], bm_price) > s["alert_pct"]:
        insights.append({"tone": "danger", "text": f"Harga terakhir {_pct(total['last_price'], bm_price)}% di atas acuan."})
    if best_offer and saving > 0:
        insights.append({"tone": "success", "text": f"Membeli di penawaran termurah menghemat Rp {saving:,.0f} dalam {s['analysis_days']} hari terakhir.".replace(",", ".")})
    if len([v for v in suppliers if v["availability"] == "available"]) <= 1:
        insights.append({"tone": "warning", "text": "Hanya 1 supplier aktif — cari supplier cadangan."})
    if len({o["vendor_id"] for o in offers}) < s["min_quotes"]:
        insights.append({"tone": "info", "text": f"Penawaran berlaku dari {len({o['vendor_id'] for o in offers})} supplier; target minimal {s['min_quotes']}."})
    if other_units:
        insights.append({"tone": "info", "text": f"Ada pembelian dalam satuan lain ({', '.join(other_units)}) yang tidak dibandingkan."})

    regions = await region_map()
    return {
        "item": {**item, "category_name": (cat or {}).get("name", "")},
        "period_type": await period_type_for_category(item.get("category_id"), s),
        "region_id": region_id, "region_name": (regions.get(region_id) or {}).get("name") if region_id else "Semua wilayah",
        "benchmark": bm, "benchmark_history": history,
        "summary": {**total, "best_offer": best_offer, "potential_saving": round(saving, 2),
                    "suppliers": len(suppliers), "offers": len({o["vendor_id"] for o in offers})},
        "suppliers": suppliers, "offers": all_offers, "trend": trend, "insights": insights,
        "settings": s, "analysis_days": s["analysis_days"],
    }


# =================== WORKSHEET (LEMBAR KERJA HARGA ACUAN) ===================

async def benchmark_worksheet(*, period_type: str, on: Optional[str] = None, region_id: Optional[str] = None,
                              category_id: Optional[str] = None) -> dict:
    """Item-item dengan tipe periode ini: acuan periode ini & sebelumnya, penawaran (min/median), harga terakhir."""
    db = get_db()
    s = await get_settings()
    period = await ensure_period(period_type, _d(on) or today_local())
    prev = await previous_period(period)
    iq: dict = {"deleted_at": None, "ml_status": {"$ne": "pending_review"}}
    if category_id:
        iq["category_id"] = category_id
    items = await db.items.find(iq, {"_id": 0}).sort([("name", 1)]).to_list(2000)
    items = [i for i in items if await period_type_for_category(i.get("category_id"), s) == period_type]
    ids = [i["id"] for i in items]
    cur = {(d["item_id"], d["unit_norm"]): d async for d in db.market_list_prices.find(
        {"period_id": period["id"], "item_id": {"$in": ids}, "region_id": region_id})}
    prv = {(d["item_id"], d["unit_norm"]): d async for d in db.market_list_prices.find(
        {"period_id": prev["id"], "item_id": {"$in": ids}, "region_id": region_id})} if prev else {}
    end = _d(period["end_date"])
    offers = await active_offers(ids, region_id, min(end, today_local()))
    lines = await _gr_lines(ids, today_local() - timedelta(days=s["analysis_days"]))
    cats = {c["id"]: c.get("name") async for c in db.categories.find({}, {"id": 1, "name": 1})}
    rows = []
    for it in items:
        u = _u(it.get("unit_default"))
        offs = sorted(o["price"] for o in offers if o["item_id"] == it["id"] and o["unit_norm"] == u)
        ls = sorted((x for x in lines if x["item_id"] == it["id"] and x["unit_norm"] == u and x["price"] > 0), key=lambda x: x["date"] or "")
        c, p = cur.get((it["id"], u)), prv.get((it["id"], u))
        rows.append({
            "item_id": it["id"], "item_code": it.get("code"), "item_name": it.get("name"), "unit": it.get("unit_default"),
            "category_name": cats.get(it.get("category_id"), ""),
            "price": (c or {}).get("ref_price"), "source": (c or {}).get("source"), "source_note": (c or {}).get("source_note"),
            "previous_price": (p or {}).get("ref_price"),
            "offers_min": offs[0] if offs else None, "offers_median": round(statistics.median(offs), 2) if offs else None,
            "offers_count": len(offs), "last_price": ls[-1]["price"] if ls else None,
        })
    return {"period": period, "previous_period": prev, "region_id": region_id, "rows": rows,
            "filled": sum(1 for r in rows if r["price"]), "total": len(rows)}
