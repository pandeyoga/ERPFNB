"""RFQ (Request for Quotation) Service — Sprint E Phase 2.

Workflow: Create RFQ → vendors submit quotes → compare side-by-side → accept best → PO draft.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional

from core.db import get_db, serialize

logger = logging.getLogger("aurora.rfq")

RFQ_STATUSES = ["draft", "sent", "quotes_received", "accepted", "cancelled"]


async def create_rfq(data: dict, user: dict) -> dict:
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    items = []
    for it in data.get("items", []):
        items.append({
            "line_no": it.get("line_no", 1),
            "item_id": it.get("item_id"),
            "item_name": it.get("item_name", ""),
            "qty": float(it.get("qty", 1)),
            "uom": it.get("uom", "pcs"),
            "description": it.get("description", ""),
            "est_unit_price": float(it.get("est_unit_price") or 0),
        })

    rfq = {
        "id": str(uuid.uuid4()),
        "rfq_no": await _next_rfq_no(),
        "title": data.get("title", f"RFQ {date.today().isoformat()}"),
        "outlet_id": data.get("outlet_id") or user.get("outlet_id"),
        "brand_id": data.get("brand_id"),
        "pr_ids": data.get("pr_ids", []),   # linked PR docs
        "items": items,
        "vendor_ids": data.get("vendor_ids", []),
        "deadline": data.get("deadline") or (date.today() + timedelta(days=7)).isoformat(),
        "notes": data.get("notes", ""),
        "status": "draft",
        "quotes": [],   # embedded: [{vendor_id, vendor_name, lines:[{item_id,unit_price,moq,lead_time}], total_est, notes, submitted_at}]
        "accepted_vendor_id": None,
        "po_id": None,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.rfqs.insert_one(rfq)
    return serialize(rfq)


async def _next_rfq_no() -> str:
    db = get_db()
    yr = date.today().strftime("%y")
    key = f"RFQ_SEQ_{yr}"
    res = await db.system_settings.find_one_and_update(
        {"key": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res.get("seq", 1) if res else 1
    return f"RFQ-{yr}-{str(seq).zfill(4)}"


async def list_rfqs(
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list, dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if outlet_id:
        q["outlet_id"] = outlet_id
    if search:
        q["$or"] = [
            {"rfq_no": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * per_page
    items = await db.rfqs.find(q).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.rfqs.count_documents(q)
    return [serialize(i) for i in items], {"page": page, "per_page": per_page, "total": total}


async def get_rfq(rfq_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.rfqs.find_one({"id": rfq_id})
    if not doc:
        return None
    rfq = serialize(doc)
    # B10 fix: batch-lookup vendor names (was N+1 find_one per vendor_id)
    vendor_ids = rfq.get("vendor_ids", [])
    vendors_raw = await db.vendors.find(
        {"id": {"$in": vendor_ids}},
        {"id": 1, "name": 1, "_id": 0}
    ).to_list(len(vendor_ids) + 1) if vendor_ids else []
    vendor_map: dict = {v["id"]: v["name"] for v in vendors_raw}
    rfq["vendor_map"] = vendor_map
    return rfq


async def update_rfq(rfq_id: str, data: dict) -> Optional[dict]:
    db = get_db()
    allowed = {"title", "items", "vendor_ids", "deadline", "notes", "status", "pr_ids", "outlet_id", "brand_id"}
    updates = {k: v for k, v in data.items() if k in allowed}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.rfqs.find_one_and_update(
        {"id": rfq_id},
        {"$set": updates},
        return_document=True,
    )
    return serialize(res) if res else None


async def upsert_quote(rfq_id: str, vendor_id: str, quote_data: dict) -> Optional[dict]:
    """Upsert a vendor's quote into the RFQ. Replaces existing quote for same vendor."""
    db = get_db()
    rfq = await db.rfqs.find_one({"id": rfq_id})
    if not rfq:
        return None

    vendor = await db.vendors.find_one({"id": vendor_id})
    vendor_name = (vendor or {}).get("name", vendor_id)

    lines = []
    for ln in quote_data.get("lines", []):
        lines.append({
            "item_id": ln.get("item_id"),
            "item_name": ln.get("item_name", ""),
            "unit_price": float(ln.get("unit_price") or 0),
            "moq": float(ln.get("moq") or 1),
            "lead_time_days": int(ln.get("lead_time_days") or 3),
            "validity_date": ln.get("validity_date"),
            "notes": ln.get("notes", ""),
        })

    total_est = sum(ln["unit_price"] * rfq_item.get("qty", 1)
                    for ln in lines
                    for rfq_item in rfq.get("items", [])
                    if rfq_item.get("item_id") == ln["item_id"])

    new_quote = {
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "lines": lines,
        "total_est": total_est,
        "notes": quote_data.get("notes", ""),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    # Remove existing quote for this vendor
    existing_quotes = [q for q in rfq.get("quotes", []) if q.get("vendor_id") != vendor_id]
    existing_quotes.append(new_quote)

    new_status = "quotes_received" if existing_quotes else rfq.get("status", "sent")
    await db.rfqs.update_one(
        {"id": rfq_id},
        {"$set": {"quotes": existing_quotes, "status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return serialize(await db.rfqs.find_one({"id": rfq_id}))


async def accept_quote(rfq_id: str, vendor_id: str, user: dict) -> Optional[dict]:
    """Accept a vendor quote → auto-generate PO draft."""
    db = get_db()
    rfq = await db.rfqs.find_one({"id": rfq_id})
    if not rfq:
        return None

    quote = next((q for q in rfq.get("quotes", []) if q.get("vendor_id") == vendor_id), None)
    if not quote:
        return None

    # Build PO doc
    from services.procurement_service import create_po
    po_lines = []
    rfq_item_map = {it["item_id"]: it for it in rfq.get("items", [])}
    for ln in quote.get("lines", []):
        rfq_item = rfq_item_map.get(ln["item_id"], {})
        if ln["unit_price"] > 0:
            po_lines.append({
                "item_id": ln["item_id"],
                "item_name": ln.get("item_name") or rfq_item.get("item_name", ""),
                "qty_ordered": rfq_item.get("qty", 1),
                "uom": rfq_item.get("uom", "pcs"),
                "unit_price": ln["unit_price"],
                "tax_rate": 0.12,
            })

    now = datetime.now(timezone.utc).isoformat()
    po_data = {
        "vendor_id": vendor_id,
        "outlet_id": rfq.get("outlet_id"),
        "brand_id": rfq.get("brand_id"),
        "pr_ids": rfq.get("pr_ids", []),
        "rfq_id": rfq_id,
        "lines": po_lines,
        "notes": f"Auto-created from RFQ {rfq.get('rfq_no')} — accepted vendor: {quote.get('vendor_name')}",
        "expected_delivery": (date.today() + timedelta(days=max(ln.get("lead_time_days", 3) for ln in quote.get("lines", [{"lead_time_days": 3}])))).isoformat(),
    }
    po = await create_po(po_data, user)

    # Mark RFQ accepted
    await db.rfqs.update_one(
        {"id": rfq_id},
        {"$set": {
            "status": "accepted",
            "accepted_vendor_id": vendor_id,
            "po_id": po.get("id"),
            "updated_at": now,
        }}
    )
    return {"rfq": serialize(await db.rfqs.find_one({"id": rfq_id})), "po": po}


async def get_compare_matrix(rfq_id: str) -> Optional[dict]:
    """Build comparison matrix: items × vendors → unit price, lead time."""
    rfq = await get_rfq(rfq_id)
    if not rfq:
        return None

    items = rfq.get("items", [])
    quotes = rfq.get("quotes", [])
    vendor_map = rfq.get("vendor_map", {})

    # Find cheapest vendor per item
    best: dict[str, dict] = {}
    for item in items:
        iid = item["item_id"]
        prices = [
            (q["vendor_id"], next((ln["unit_price"] for ln in q["lines"] if ln["item_id"] == iid), None))
            for q in quotes
        ]
        valid_prices = [(vid, p) for vid, p in prices if p is not None and p > 0]
        if valid_prices:
            best[iid] = min(valid_prices, key=lambda x: x[1])[0]  # vendor_id of cheapest

    matrix_items = []
    for item in items:
        iid = item["item_id"]
        row: dict = {
            "item_id": iid,
            "item_name": item["item_name"],
            "qty": item["qty"],
            "uom": item["uom"],
            "est_unit_price": item["est_unit_price"],
            "quotes": {},
        }
        for q in quotes:
            vid = q["vendor_id"]
            vname = q.get("vendor_name") or vendor_map.get(vid, vid)
            line = next((ln for ln in q["lines"] if ln["item_id"] == iid), None)
            row["quotes"][vid] = {
                "vendor_name": vname,
                "unit_price": line["unit_price"] if line else None,
                "moq": line["moq"] if line else None,
                "lead_time_days": line["lead_time_days"] if line else None,
                "is_cheapest": best.get(iid) == vid,
            }
        matrix_items.append(row)

    # Per-vendor totals
    vendor_totals = {}
    for q in quotes:
        vid = q["vendor_id"]
        vendor_totals[vid] = {
            "vendor_id": vid,
            "vendor_name": q.get("vendor_name") or vendor_map.get(vid, vid),
            "total_est": q.get("total_est", 0),
            "quoted_items": len([ln for ln in q["lines"] if ln["unit_price"] > 0]),
            "avg_lead_time": (
                sum(ln["lead_time_days"] for ln in q["lines"]) / max(len(q["lines"]), 1)
                if q["lines"] else 0
            ),
        }

    return {
        "rfq_id": rfq_id,
        "rfq_no": rfq.get("rfq_no"),
        "items": matrix_items,
        "vendors": list(vendor_totals.values()),
        "accepted_vendor_id": rfq.get("accepted_vendor_id"),
    }
