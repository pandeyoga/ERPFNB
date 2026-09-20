"""reports_excel_inventory_service — Excel export functions."""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional
from core.db import get_db
from core.exceptions import ValidationError
logger = logging.getLogger("aurora.reports")

def _now():
    return datetime.now(timezone.utc).isoformat()

def _parse_date(s, *, fallback_today=False):
    if not s:
        return datetime.now(timezone.utc) if fallback_today else None
    try:
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as e:
        raise ValidationError(f"Invalid date format: {s}") from e

async def generate_stock_balance_excel(
    *,
    outlet_ids: Optional[list[str]] = None,
    category_ids: Optional[list[str]] = None,
    as_of_date: Optional[str] = None,
):
    """Generate Stock Balance Excel report.
    
    Columns: Item, Category, Outlet, Unit, Current Qty, Unit Cost, Total Value
    Features: Subtotals per outlet/category, Grand total
    """
    from services.excel_export_service import (
        create_workbook,
        add_report_header,
        write_table_headers,
        write_data_row,
        write_total_row,
        autosize_columns,
        freeze_header_row,
        apply_currency_format,
        format_date,
    )
    
    db = get_db()
    
    # Use aggregation to compute current stock per item/outlet
    # (aggregate all inventory_movements up to as_of_date)
    match_filter: dict = {}
    if as_of_date:
        match_filter["movement_date"] = {"$lte": as_of_date}
    if outlet_ids:
        match_filter["outlet_id"] = {"$in": outlet_ids}
    
    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": {"item_id": "$item_id", "outlet_id": "$outlet_id", "unit": "$unit"},
                "qty": {"$sum": "$qty_change"},
            }
        },
        {"$match": {"qty": {"$ne": 0}}},  # Only non-zero balances
    ]
    
    balances = []
    async for doc in db.inventory_movements.aggregate(pipeline):
        balances.append(doc)
    
    # Load lookups
    item_map = {}
    async for it in db.items.find({"deleted_at": None}):
        item_map[it["id"]] = {
            "name": it.get("name", it["id"]),
            "code": it.get("code", ""),
            "category_id": it.get("category_id"),
            "unit_cost": float(it.get("cost", 0) or 0),
        }
    
    outlet_map = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlet_map[o["id"]] = o.get("name", o["id"])
    
    category_map = {}
    async for c in db.categories.find({"deleted_at": None}):
        category_map[c["id"]] = c.get("name", c["id"])
    
    # Filter by category if needed
    if category_ids:
        balances = [
            b for b in balances
            if item_map.get(b["_id"]["item_id"], {}).get("category_id") in category_ids
        ]
    
    # Create workbook
    wb = create_workbook("Stock Balance")
    ws = wb.active
    
    # Add header
    subtitle = f"As of: {format_date(as_of_date) if as_of_date else 'Current'}"
    current_row = add_report_header(
        ws,
        title="Stock Balance Report",
        subtitle=subtitle,
    )
    
    # Table headers
    headers = ["Item Code", "Item Name", "Category", "Outlet", "Unit", "Qty", "Unit Cost", "Total Value"]
    current_row = write_table_headers(ws, headers, current_row)
    data_start_row = current_row
    
    # Data rows
    grand_qty = 0.0
    grand_value = 0.0
    
    for bal in sorted(balances, key=lambda x: (x["_id"]["outlet_id"], x["_id"]["item_id"])):
        item_id = bal["_id"]["item_id"]
        outlet_id = bal["_id"]["outlet_id"]
        unit = bal["_id"]["unit"]
        qty = float(bal["qty"])
        
        item = item_map.get(item_id, {})
        item_name = item.get("name", item_id)
        item_code = item.get("code", "")
        category_name = category_map.get(item.get("category_id"), "")
        outlet_name = outlet_map.get(outlet_id, outlet_id or "")
        unit_cost = item.get("unit_cost", 0)
        total_value = qty * unit_cost
        
        row_data = [
            item_code,
            item_name,
            category_name,
            outlet_name,
            unit,
            qty,
            unit_cost,
            total_value,
        ]
        write_data_row(ws, row_data, current_row, number_cols=[6, 7, 8])
        
        grand_qty += qty
        grand_value += total_value
        current_row += 1
    
    # Total row
    if balances:
        total_row = ["", "", "", "", "TOTAL", grand_qty, "", grand_value]
        write_total_row(ws, total_row, current_row, number_cols=[6, 7, 8])
    
    # Styling
    apply_currency_format(ws, 7, data_start_row, current_row, currency="Rp")
    apply_currency_format(ws, 8, data_start_row, current_row, currency="Rp")
    autosize_columns(ws)
    freeze_header_row(ws, header_row=data_start_row - 1)
    
    return wb


async def generate_stock_movement_excel(
    *,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    outlet_ids: Optional[list[str]] = None,
    movement_type: Optional[str] = None,
):
    """Generate Stock Movement Excel report.
    
    Columns: Date, Doc No, Type, Item, Outlet, Unit, Qty Change, Remarks
    Features: Movement type filter (IN/OUT/ADJ)
    """
    from services.excel_export_service import (
        create_workbook,
        add_report_header,
        write_table_headers,
        write_data_row,
        autosize_columns,
        freeze_header_row,
        format_date,
    )
    
    db = get_db()
    
    # Build query
    match_filter: dict = {}
    if date_from or date_to:
        match_filter["movement_date"] = {}
        if date_from:
            match_filter["movement_date"]["$gte"] = date_from
        if date_to:
            match_filter["movement_date"]["$lte"] = date_to
    if outlet_ids:
        match_filter["outlet_id"] = {"$in": outlet_ids}
    if movement_type:
        match_filter["movement_type"] = movement_type
    
    # Load movements
    movements = []
    async for doc in db.inventory_movements.find(match_filter).sort([("movement_date", -1), ("created_at", -1)]).limit(500):
        movements.append(doc)
    
    # Load lookups
    item_map = {}
    async for it in db.items.find({"deleted_at": None}):
        item_map[it["id"]] = it.get("name", it["id"])
    
    outlet_map = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlet_map[o["id"]] = o.get("name", o["id"])
    
    # Create workbook
    wb = create_workbook("Stock Movement")
    ws = wb.active
    
    # Add header
    subtitle = f"Period: {format_date(date_from) if date_from else 'All'} - {format_date(date_to) if date_to else 'All'}"
    current_row = add_report_header(
        ws,
        title="Stock Movement Report",
        subtitle=subtitle,
    )
    
    # Table headers
    headers = ["Date", "Doc No", "Type", "Item", "Outlet", "Unit", "Qty Change", "Remarks"]
    current_row = write_table_headers(ws, headers, current_row)
    data_start_row = current_row
    
    # Data rows
    for mov in movements:
        item_name = item_map.get(mov.get("item_id"), mov.get("item_id") or "")
        outlet_name = outlet_map.get(mov.get("outlet_id"), mov.get("outlet_id") or "")
        qty_change = float(mov.get("qty_change", 0) or 0)
        
        row_data = [
            format_date(mov.get("movement_date")),
            mov.get("doc_no", ""),
            mov.get("movement_type", ""),
            item_name,
            outlet_name,
            mov.get("unit", ""),
            qty_change,
            mov.get("remarks", ""),
        ]
        write_data_row(ws, row_data, current_row, number_cols=[7])
        current_row += 1
    
    # Styling
    autosize_columns(ws)
    freeze_header_row(ws, header_row=data_start_row - 1)
    
    return wb


async def generate_inventory_valuation_excel(
    *,
    outlet_ids: Optional[list[str]] = None,
    category_ids: Optional[list[str]] = None,
    as_of_date: Optional[str] = None,
):
    """Generate Inventory Valuation Excel report (grouped by category).
    
    Columns: Category, Total Qty, Avg Unit Cost, Total Value
    Features: Category grouping, outlet breakdown optional
    """
    from services.excel_export_service import (
        create_workbook,
        add_report_header,
        write_table_headers,
        write_data_row,
        write_total_row,
        autosize_columns,
        freeze_header_row,
        apply_currency_format,
        format_date,
    )
    
    db = get_db()
    
    # Similar aggregation as stock balance
    match_filter: dict = {}
    if as_of_date:
        match_filter["movement_date"] = {"$lte": as_of_date}
    if outlet_ids:
        match_filter["outlet_id"] = {"$in": outlet_ids}
    
    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": {"item_id": "$item_id", "outlet_id": "$outlet_id"},
                "qty": {"$sum": "$qty_change"},
            }
        },
        {"$match": {"qty": {"$ne": 0}}},
    ]
    
    balances = []
    async for doc in db.inventory_movements.aggregate(pipeline):
        balances.append(doc)
    
    # Load lookups
    item_map = {}
    async for it in db.items.find({"deleted_at": None}):
        item_map[it["id"]] = {
            "name": it.get("name", it["id"]),
            "category_id": it.get("category_id"),
            "unit_cost": float(it.get("cost", 0) or 0),
        }
    
    category_map = {}
    async for c in db.categories.find({"deleted_at": None}):
        category_map[c["id"]] = c.get("name", c["id"])
    
    # Group by category
    category_totals = {}
    for bal in balances:
        item_id = bal["_id"]["item_id"]
        qty = float(bal["qty"])
        item = item_map.get(item_id, {})
        cat_id = item.get("category_id")
        
        if category_ids and cat_id not in category_ids:
            continue
        
        unit_cost = item.get("unit_cost", 0)
        value = qty * unit_cost
        
        if cat_id not in category_totals:
            category_totals[cat_id] = {"qty": 0, "value": 0, "items_count": 0}
        
        category_totals[cat_id]["qty"] += qty
        category_totals[cat_id]["value"] += value
        category_totals[cat_id]["items_count"] += 1
    
    # Create workbook
    wb = create_workbook("Inventory Valuation")
    ws = wb.active
    
    # Add header
    subtitle = f"As of: {format_date(as_of_date) if as_of_date else 'Current'}"
    current_row = add_report_header(
        ws,
        title="Inventory Valuation Report",
        subtitle=subtitle,
    )
    
    # Table headers
    headers = ["Category", "Items Count", "Total Qty", "Total Value"]
    current_row = write_table_headers(ws, headers, current_row)
    data_start_row = current_row
    
    # Data rows
    grand_qty = 0.0
    grand_value = 0.0
    
    for cat_id, totals in sorted(category_totals.items(), key=lambda x: category_map.get(x[0], "")):
        category_name = category_map.get(cat_id, cat_id or "(No Category)")
        
        row_data = [
            category_name,
            totals["items_count"],
            totals["qty"],
            totals["value"],
        ]
        write_data_row(ws, row_data, current_row, number_cols=[2, 3, 4])
        
        grand_qty += totals["qty"]
        grand_value += totals["value"]
        current_row += 1
    
    # Total row
    if category_totals:
        total_row = ["TOTAL", "", grand_qty, grand_value]
        write_total_row(ws, total_row, current_row, number_cols=[3, 4])
    
    # Styling
    apply_currency_format(ws, 4, data_start_row, current_row, currency="Rp")
    autosize_columns(ws)
    freeze_header_row(ws, header_row=data_start_row - 1)
    
    return wb



# ============================================================
# 9. PROCUREMENT REPORTS (Phase 4.3)
# ============================================================

