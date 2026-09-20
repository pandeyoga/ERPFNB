"""Item Pricing Service — manage historical pricing untuk items.

Support untuk:
- Add new price (auto-close previous active price)
- Get price history
- Get current active price
- Calculate variance
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError
from models.item_pricing import item_pricing_doc

logger = logging.getLogger("aurora.item_pricing")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def add_item_price(
    *,
    item_id: str,
    unit: str,
    price: float,
    effective_from: str,
    vendor_id: Optional[str] = None,
    notes: Optional[str] = None,
    user: dict,
) -> dict:
    """Add new price untuk item. Auto-close previous active price jika ada."""
    db = get_db()
    
    # Validate item exists
    item = await db.items.find_one({"id": item_id, "deleted_at": None})
    if not item:
        raise NotFoundError("Item tidak ditemukan")
    
    # Validate vendor if provided
    if vendor_id:
        vendor = await db.vendors.find_one({"id": vendor_id, "deleted_at": None})
        if not vendor:
            raise NotFoundError("Vendor tidak ditemukan")
    
    # Validate price
    if price <= 0:
        raise ValidationError("Price harus > 0")
    
    # Validate effective_from
    try:
        datetime.fromisoformat(effective_from)
    except (ValueError, TypeError):
        raise ValidationError("effective_from harus format YYYY-MM-DD")
    
    # Get previous active price untuk calculate variance
    previous_active = await db.item_pricings.find_one({
        "item_id": item_id,
        "vendor_id": vendor_id,
        "unit": unit,
        "is_active": True,
        "$or": [
            {"effective_to": None},
            {"effective_to": {"$gte": effective_from}}
        ]
    }, sort=[("effective_from", -1)])
    
    previous_price = None
    if previous_active:
        previous_price = previous_active.get("price")
        
        # Close previous active price (set effective_to to day before new price)
        await db.item_pricings.update_one(
            {"id": previous_active["id"]},
            {"$set": {
                "is_active": False,
                "effective_to": effective_from,  # Ends the day new price starts
                "updated_at": _now(),
            }}
        )
        logger.info(f"Closed previous pricing {previous_active['id']} for item {item_id}")
    
    # Create new pricing
    doc = item_pricing_doc(
        item_id=item_id,
        vendor_id=vendor_id,
        unit=unit,
        price=price,
        effective_from=effective_from,
        effective_to=None,  # Open-ended, will be closed when next price added
        is_active=True,
        notes=notes,
        previous_price=previous_price,
        created_by=user["id"],
    )
    
    await db.item_pricings.insert_one(doc)
    logger.info(f"Added new pricing for item {item_id}: {price} (variance: {doc.get('variance')}%)")
    
    # Update item's current price field for convenience
    await db.items.update_one(
        {"id": item_id},
        {"$set": {
            "price": price,
            "updated_at": _now(),
        }}
    )
    
    return serialize(doc)


async def get_item_price_history(
    item_id: str,
    *,
    vendor_id: Optional[str] = None,
    unit: Optional[str] = None,
) -> list[dict]:
    """Get price history untuk item."""
    db = get_db()
    
    q = {"item_id": item_id}
    if vendor_id:
        q["vendor_id"] = vendor_id
    if unit:
        q["unit"] = unit
    
    cursor = db.item_pricings.find(q).sort([("effective_from", -1)])
    pricings = await cursor.to_list(100)
    
    return [serialize(p) for p in pricings]


async def get_current_item_price(
    item_id: str,
    *,
    vendor_id: Optional[str] = None,
    unit: Optional[str] = None,
    as_of: Optional[str] = None,
) -> Optional[dict]:
    """Get current active price untuk item pada tanggal tertentu."""
    db = get_db()
    
    if not as_of:
        as_of = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    q = {
        "item_id": item_id,
        "effective_from": {"$lte": as_of},
        "$or": [
            {"effective_to": None},
            {"effective_to": {"$gte": as_of}}
        ]
    }
    
    if vendor_id:
        q["vendor_id"] = vendor_id
    if unit:
        q["unit"] = unit
    
    pricing = await db.item_pricings.find_one(q, sort=[("effective_from", -1)])
    
    return serialize(pricing) if pricing else None


async def get_items_with_current_prices(
    *,
    category_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    as_of: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict], dict]:
    """Get items dengan current prices untuk list view (Market List)."""
    db = get_db()
    
    if not as_of:
        as_of = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Query items
    item_q = {"deleted_at": None, "active": True}
    if category_id:
        item_q["category_id"] = category_id
    
    skip = (page - 1) * per_page
    cursor = db.items.find(item_q).sort([("name", 1)])
    items = await cursor.skip(skip).limit(per_page).to_list(per_page)
    total = await db.items.count_documents(item_q)
    
    # For each item, get current price
    item_ids = [item["id"] for item in items]
    
    # Get all current pricings
    pricing_q = {
        "item_id": {"$in": item_ids},
        "effective_from": {"$lte": as_of},
        "$or": [
            {"effective_to": None},
            {"effective_to": {"$gte": as_of}}
        ]
    }
    if vendor_id:
        pricing_q["vendor_id"] = vendor_id
    
    pricings_cursor = db.item_pricings.find(pricing_q)
    all_pricings = await pricings_cursor.to_list(1000)
    
    # Group by item_id (take latest effective_from)
    pricing_map = {}
    for p in all_pricings:
        item_id = p["item_id"]
        if item_id not in pricing_map or p["effective_from"] > pricing_map[item_id]["effective_from"]:
            pricing_map[item_id] = p
    
    # Enrich items
    enriched = []
    for item in items:
        item_dict = serialize(item)
        pricing = pricing_map.get(item["id"])
        
        if pricing:
            item_dict["current_pricing"] = {
                "price": pricing["price"],
                "effective_from": pricing["effective_from"],
                "effective_to": pricing.get("effective_to"),
                "variance": pricing.get("variance"),
                "previous_price": pricing.get("previous_price"),
                "vendor_id": pricing.get("vendor_id"),
            }
        else:
            item_dict["current_pricing"] = {
                "price": item.get("price", 0),  # Fallback to item.price
                "effective_from": None,
                "effective_to": None,
                "variance": None,
                "previous_price": None,
                "vendor_id": None,
            }
        
        enriched.append(item_dict)
    
    return enriched, {"page": page, "per_page": per_page, "total": total}
