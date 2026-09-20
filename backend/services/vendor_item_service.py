"""Vendor Item Service — manage vendor's actual item catalog.

Vendor Item = harga aktual yang dibayar ke vendor.
Auto-updated dari PO (saat create) dan GR (saat posting/receiving).
Beda dari Market List Reference Price yang adalah benchmark kuartalan.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import NotFoundError
from models.market_list import make_price_history

logger = logging.getLogger("aurora.vendor_item")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def upsert_vendor_item(
    vendor_id: str,
    item_id: str,
    unit: str,
    new_price: float,
    *,
    source: str,  # "po" | "gr" | "manual"
    source_doc_id: Optional[str] = None,
    source_doc_no: Optional[str] = None,
    date: Optional[str] = None,
    qty: float = 0,
    user_id: str = "system",
    notes: Optional[str] = None,
    skip_if_same_price: bool = True,
) -> dict:
    """Upsert vendor item record and write price history if price changed."""
    db = get_db()
    today = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    existing = await db.vendor_items.find_one({"vendor_id": vendor_id, "item_id": item_id, "unit": unit})

    if not existing:
        # First time this vendor-item-unit combo is seen
        doc = {
            "id": _new_id(),
            "vendor_id": vendor_id,
            "item_id": item_id,
            "unit": unit,
            "current_price": new_price,
            "min_order_qty": 0.0,
            "lead_time_days": 0,
            "is_preferred": False,
            "availability_status": "available",
            "unavailable_since": None,
            "unavailable_count": 0,
            "last_available_date": today,
            "last_po_date": today if source == "po" else None,
            "last_po_no": source_doc_no if source == "po" else None,
            "last_gr_date": today if source == "gr" else None,
            "last_gr_no": source_doc_no if source == "gr" else None,
            "total_po_qty": qty if source == "po" else 0.0,
            "total_gr_qty": qty if source == "gr" else 0.0,
            "notes": notes,
            "created_at": _now(),
            "updated_at": _now(),
            "created_by": user_id,
        }
        await db.vendor_items.insert_one(doc)
        # Write initial price history
        if new_price > 0:
            ph = make_price_history(
                vendor_item_id=doc["id"],
                vendor_id=vendor_id,
                item_id=item_id,
                unit=unit,
                old_price=0.0,
                new_price=new_price,
                effective_date=today,
                source=source,
                source_doc_id=source_doc_id,
                source_doc_no=source_doc_no,
                notes=f"Pertama kali tercatat dari {source.upper()} {source_doc_no or ''}",
                changed_by=user_id,
            )
            await db.vendor_item_price_history.insert_one(ph)
        logger.info(f"Created vendor_item {vendor_id}/{item_id} price={new_price} source={source}")
        return serialize(doc)

    # Existing record — update
    old_price = existing.get("current_price", 0.0)
    price_changed = abs(new_price - old_price) > 0.01

    updates: dict = {"updated_at": _now()}

    if source == "po":
        updates["last_po_date"] = today
        updates["last_po_no"] = source_doc_no
        updates["total_po_qty"] = float(existing.get("total_po_qty", 0)) + qty
    elif source == "gr":
        updates["last_gr_date"] = today
        updates["last_gr_no"] = source_doc_no
        updates["total_gr_qty"] = float(existing.get("total_gr_qty", 0)) + qty
        # GR is the most accurate price source — always update from GR
        if new_price > 0:
            updates["current_price"] = new_price
            updates["availability_status"] = "available"
            updates["last_available_date"] = today

    # For PO: only update price if item doesn't have a GR price yet
    if source == "po" and new_price > 0 and not existing.get("last_gr_date"):
        updates["current_price"] = new_price

    # Manual always updates price
    if source == "manual" and new_price > 0:
        updates["current_price"] = new_price

    await db.vendor_items.update_one({"id": existing["id"]}, {"$set": updates})

    # Write price history if price actually changed
    final_new_price = updates.get("current_price", old_price)
    if abs(final_new_price - old_price) > 0.01:
        ph = make_price_history(
            vendor_item_id=existing["id"],
            vendor_id=vendor_id,
            item_id=item_id,
            unit=unit,
            old_price=old_price,
            new_price=final_new_price,
            effective_date=today,
            source=source,
            source_doc_id=source_doc_id,
            source_doc_no=source_doc_no,
            notes=notes,
            changed_by=user_id,
        )
        await db.vendor_item_price_history.insert_one(ph)
        logger.info(f"Price history: {vendor_id}/{item_id} {old_price}→{final_new_price} ({source})")

    fresh = await db.vendor_items.find_one({"id": existing["id"]})
    return serialize(fresh)


def _new_id() -> str:
    import uuid
    return str(uuid.uuid4())


async def upsert_from_po(po_doc: dict, *, user_id: str = "system") -> None:
    """Hook: called after PO is created. Updates vendor_items for each PO line."""
    vendor_id = po_doc.get("vendor_id")
    if not vendor_id:
        return
    po_date = po_doc.get("order_date", _now()[:10])
    doc_no = po_doc.get("doc_no", "")
    doc_id = po_doc.get("id", "")
    for ln in po_doc.get("lines") or []:
        item_id = ln.get("item_id")
        if not item_id:
            continue
        unit = ln.get("unit", "pcs")
        unit_cost = float(ln.get("unit_cost", 0) or 0)
        qty = float(ln.get("qty", 0) or 0)
        try:
            await upsert_vendor_item(
                vendor_id=vendor_id,
                item_id=item_id,
                unit=unit,
                new_price=unit_cost,
                source="po",
                source_doc_id=doc_id,
                source_doc_no=doc_no,
                date=po_date,
                qty=qty,
                user_id=user_id,
            )
        except Exception as e:
            logger.warning(f"vendor_item upsert from PO failed for item {item_id}: {e}")


async def upsert_from_gr(gr_doc: dict, *, user_id: str = "system") -> None:
    """Hook: called after GR is posted. Updates vendor_items with ACTUAL received price."""
    vendor_id = gr_doc.get("vendor_id")
    if not vendor_id:
        return
    gr_date = gr_doc.get("receive_date", _now()[:10])
    doc_no = gr_doc.get("doc_no", "")
    doc_id = gr_doc.get("id", "")
    for ln in gr_doc.get("lines") or []:
        item_id = ln.get("item_id")
        if not item_id:
            continue
        unit = ln.get("unit", "pcs")
        unit_cost = float(ln.get("unit_cost", 0) or 0)
        qty_received = float(ln.get("qty_received", 0) or 0)
        try:
            await upsert_vendor_item(
                vendor_id=vendor_id,
                item_id=item_id,
                unit=unit,
                new_price=unit_cost,
                source="gr",
                source_doc_id=doc_id,
                source_doc_no=doc_no,
                date=gr_date,
                qty=qty_received,
                user_id=user_id,
            )
        except Exception as e:
            logger.warning(f"vendor_item upsert from GR failed for item {item_id}: {e}")


# =================== QUERIES ===================

async def get_vendor_catalog(
    vendor_id: str,
    *,
    page: int = 1,
    per_page: int = 50,
    search: Optional[str] = None,
) -> tuple[list[dict], dict]:
    """Get all items in vendor's catalog with enrichment."""
    db = get_db()
    q: dict = {"vendor_id": vendor_id}
    if search:
        # Search by item name requires a join — fetch item ids first
        item_docs = await db.items.find(
            {"name": {"$regex": search, "$options": "i"}, "deleted_at": None}
        ).to_list(200)
        item_ids = [d["id"] for d in item_docs]
        q["item_id"] = {"$in": item_ids}

    skip = (page - 1) * per_page
    docs = await db.vendor_items.find(q).sort([
        ("last_gr_date", -1), ("last_po_date", -1)
    ]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.vendor_items.count_documents(q)

    # Enrich with item details + market ref price
    item_ids = [d["item_id"] for d in docs]
    items = await db.items.find({"id": {"$in": item_ids}, "deleted_at": None}).to_list(per_page)
    item_map = {i["id"]: i for i in items}

    from services.market_list_service import get_ref_prices_bulk
    ref_prices = await get_ref_prices_bulk(item_ids)

    cat_ids = list({i.get("category_id") for i in items if i.get("category_id")})
    cats = await db.categories.find({"id": {"$in": cat_ids}}).to_list(100)
    cat_map = {c["id"]: c["name"] for c in cats}

    enriched = []
    for d in docs:
        item = item_map.get(d["item_id"], {})
        ref = ref_prices.get(d["item_id"])
        result = serialize(d)
        result["item_name"] = item.get("name", "")
        result["item_code"] = item.get("code", "")
        result["item_unit"] = item.get("unit_default", "")
        result["category_name"] = cat_map.get(item.get("category_id", ""), "")
        result["ref_price"] = ref["ref_price"] if ref else None
        result["ref_quarter_label"] = ref["quarter_label"] if ref else None
        # Deviation from market reference
        if ref and ref.get("ref_price") and d.get("current_price"):
            deviation = ((d["current_price"] - ref["ref_price"]) / ref["ref_price"]) * 100
            result["deviation_pct"] = round(deviation, 2)
        else:
            result["deviation_pct"] = None
        enriched.append(result)

    return enriched, {"page": page, "per_page": per_page, "total": total}


async def get_item_vendors(
    item_id: str,
    *,
    include_unavailable: bool = False,
) -> list[dict]:
    """Get all vendors that supply an item, sorted by price."""
    db = get_db()
    q: dict = {"item_id": item_id}
    if not include_unavailable:
        q["availability_status"] = {"$ne": "discontinued"}

    docs = await db.vendor_items.find(q).sort([("current_price", 1)]).to_list(50)

    vendor_ids = [d["vendor_id"] for d in docs]
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}, "deleted_at": None}).to_list(50)
    vendor_map = {v["id"]: v for v in vendors}

    from services.market_list_service import get_ref_price
    ref = await get_ref_price(item_id)
    ref_price_val = ref.get("ref_price") if ref else None

    result = []
    for d in docs:
        vendor = vendor_map.get(d["vendor_id"], {})
        enriched = serialize(d)
        enriched["vendor_name"] = vendor.get("name", "")
        enriched["vendor_code"] = vendor.get("code", "")
        enriched["vendor_phone"] = vendor.get("phone", "")
        enriched["ref_price"] = ref_price_val
        if ref_price_val and d.get("current_price"):
            enriched["deviation_pct"] = round(((d["current_price"] - ref_price_val) / ref_price_val) * 100, 2)
        else:
            enriched["deviation_pct"] = None
        result.append(enriched)

    return result


async def get_price_history(
    vendor_id: str,
    item_id: str,
    *,
    unit: Optional[str] = None,
    limit: int = 20,
) -> list[dict]:
    """Get price change history for a vendor-item pair."""
    db = get_db()
    q: dict = {"vendor_id": vendor_id, "item_id": item_id}
    if unit:
        q["unit"] = unit
    docs = await db.vendor_item_price_history.find(q).sort(
        [("effective_date", -1), ("created_at", -1)]
    ).limit(limit).to_list(limit)
    return [serialize(d) for d in docs]


async def mark_unavailable(vendor_id: str, item_id: str, *, user: dict) -> dict:
    """Mark item as unavailable from a vendor."""
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await db.vendor_items.find_one_and_update(
        {"vendor_id": vendor_id, "item_id": item_id},
        {"$set": {
            "availability_status": "unavailable",
            "unavailable_since": today,
            "updated_at": _now(),
        }, "$inc": {"unavailable_count": 1}},
        return_document=True,
    )
    if not result:
        raise NotFoundError("Vendor item tidak ditemukan")
    return serialize(result)


async def mark_available(vendor_id: str, item_id: str, *, user: dict) -> dict:
    """Mark item as available again from a vendor."""
    db = get_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await db.vendor_items.find_one_and_update(
        {"vendor_id": vendor_id, "item_id": item_id},
        {"$set": {
            "availability_status": "available",
            "last_available_date": today,
            "unavailable_since": None,
            "updated_at": _now(),
        }},
        return_document=True,
    )
    if not result:
        raise NotFoundError("Vendor item tidak ditemukan")
    return serialize(result)


async def get_price_intelligence(
    *,
    quarter_id: Optional[str] = None,
    category_id: Optional[str] = None,
    top_n: int = 20,
) -> dict:
    """Get price intelligence: deviations, trends, single-source risks."""
    db = get_db()

    from services.market_list_service import get_active_quarter, get_ref_prices_bulk
    active_q = await get_active_quarter()
    target_q_id = quarter_id or (active_q["id"] if active_q else None)

    # Get all vendor items with price deviations
    vi_docs = await db.vendor_items.find({"availability_status": {"$ne": "discontinued"}}).to_list(5000)

    item_ids = list({d["item_id"] for d in vi_docs})
    ref_prices = await get_ref_prices_bulk(item_ids, quarter_id=target_q_id)

    items = await db.items.find({"id": {"$in": item_ids}, "deleted_at": None}).to_list(len(item_ids))
    item_map = {i["id"]: i for i in items}

    cat_ids = list({i.get("category_id") for i in items if i.get("category_id")})
    if category_id:
        # Filter to specific category
        item_ids = [i["id"] for i in items if i.get("category_id") == category_id]
        vi_docs = [d for d in vi_docs if d["item_id"] in item_ids]

    cats = await db.categories.find({"id": {"$in": cat_ids}}).to_list(100)
    cat_map = {c["id"]: c["name"] for c in cats}

    vendors = await db.vendors.find({"active": True}).to_list(500)
    vendor_map = {v["id"]: v["name"] for v in vendors}

    # Compute deviations
    deviations = []
    item_vendor_count: dict[str, int] = {}
    for d in vi_docs:
        iid = d["item_id"]
        item_vendor_count[iid] = item_vendor_count.get(iid, 0) + 1
        ref = ref_prices.get(iid)
        if ref and ref.get("ref_price") and d.get("current_price") and d["current_price"] > 0:
            dev = ((d["current_price"] - ref["ref_price"]) / ref["ref_price"]) * 100
            item = item_map.get(iid, {})
            deviations.append({
                "item_id": iid,
                "item_name": item.get("name", ""),
                "category_name": cat_map.get(item.get("category_id", ""), ""),
                "vendor_id": d["vendor_id"],
                "vendor_name": vendor_map.get(d["vendor_id"], ""),
                "actual_price": d["current_price"],
                "ref_price": ref["ref_price"],
                "deviation_pct": round(dev, 2),
                "unit": d.get("unit", ""),
                "availability_status": d.get("availability_status", "available"),
            })

    # Sort by absolute deviation
    deviations.sort(key=lambda x: abs(x["deviation_pct"]), reverse=True)
    top_deviations = deviations[:top_n]

    # Single source risk
    single_source_items = []
    for iid, count in item_vendor_count.items():
        if count == 1:
            item = item_map.get(iid, {})
            single_source_items.append({
                "item_id": iid,
                "item_name": item.get("name", ""),
                "category_name": cat_map.get(item.get("category_id", ""), ""),
                "vendor_count": 1,
            })

    # Recent price increases
    recent_increases = [d for d in deviations if d["deviation_pct"] > 10]
    recent_decreases = [d for d in deviations if d["deviation_pct"] < -10]

    return {
        "top_deviations": top_deviations,
        "single_source_risk": single_source_items[:20],
        "price_above_reference": len(recent_increases),
        "price_below_reference": len(recent_decreases),
        "total_items_tracked": len(item_vendor_count),
        "quarter_label": active_q["label"] if active_q else None,
    }
