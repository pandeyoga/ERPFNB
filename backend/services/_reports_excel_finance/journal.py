"""Reports Excel — Journal Ledger Excel.

Auto-extracted from former monolithic reports_excel_finance_service.py.
"""
from __future__ import annotations

import logging
from typing import Optional

from core.db import get_db


logger = logging.getLogger("aurora.reports")


async def generate_journal_ledger_excel(
    *,
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    coa_id: Optional[str] = None,
    outlet_ids: Optional[list[str]] = None,
    source_type: Optional[str] = None,
):
    """Generate Journal Ledger Excel report.
    
    Columns: Entry Date, Doc No, Source, Description, COA Code, COA Name, Dr, Cr, Outlet, Brand
    Features: Filter by period/COA/outlet/source, Grand totals
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
    
    # Build query for journal entries
    je_match: dict = {"deleted_at": None, "status": "posted"}
    if period_from or period_to:
        je_match["entry_date"] = {}
        if period_from:
            je_match["entry_date"]["$gte"] = period_from
        if period_to:
            je_match["entry_date"]["$lte"] = period_to
    if source_type:
        je_match["source_type"] = source_type
    
    # Load journal entries (sorted by date ascending)
    journals = []
    async for doc in db.journal_entries.find(je_match).sort([("entry_date", 1), ("created_at", 1)]).limit(5000):
        journals.append(doc)
    
    # Load COA lookup
    coa_map = {}
    async for c in db.chart_of_accounts.find({"deleted_at": None}):
        coa_map[c["id"]] = {
            "code": c.get("code", ""),
            "name": c.get("name", c["id"]),
            "type": c.get("type", ""),
        }
    
    # Load outlet & brand lookups
    outlet_map = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlet_map[o["id"]] = o.get("name", o["id"])
    
    brand_map = {}
    async for b in db.brands.find({"deleted_at": None}):
        brand_map[b["id"]] = b.get("name", b["id"])
    
    # Create workbook
    wb = create_workbook("Journal Ledger")
    ws = wb.active
    
    # Add header
    subtitle_parts = []
    subtitle_parts.append(f"Period: {format_date(period_from) if period_from else 'All'} - {format_date(period_to) if period_to else 'All'}")
    if coa_id and coa_id in coa_map:
        subtitle_parts.append(f"COA: {coa_map[coa_id]['code']} {coa_map[coa_id]['name']}")
    if source_type:
        subtitle_parts.append(f"Source: {source_type}")
    subtitle = " | ".join(subtitle_parts)
    
    current_row = add_report_header(
        ws,
        title="Journal Ledger Report",
        subtitle=subtitle,
    )
    
    # Table headers
    headers = ["Entry Date", "Doc No", "Source", "Description", "COA Code", "COA Name", "Dr", "Cr", "Outlet", "Brand"]
    current_row = write_table_headers(ws, headers, current_row)
    data_start_row = current_row
    
    # Data rows — flatten lines
    grand_dr = 0.0
    grand_cr = 0.0
    line_count = 0
    
    for je in journals:
        for line in je.get("lines", []):
            line_coa_id = line.get("coa_id")
            
            # Apply COA filter
            if coa_id and line_coa_id != coa_id:
                continue
            
            # Apply outlet filter
            line_outlet = line.get("dim_outlet")
            if outlet_ids and line_outlet not in outlet_ids:
                continue
            
            coa_info = coa_map.get(line_coa_id, {})
            coa_code = line.get("coa_code") or coa_info.get("code", "")
            coa_name = line.get("coa_name") or coa_info.get("name", "")
            
            outlet_name = outlet_map.get(line_outlet, "") if line_outlet else ""
            brand_name = brand_map.get(line.get("dim_brand"), "") if line.get("dim_brand") else ""
            
            dr_amt = float(line.get("dr", 0) or 0)
            cr_amt = float(line.get("cr", 0) or 0)
            
            row_data = [
                format_date(je.get("entry_date")),
                je.get("doc_no", ""),
                je.get("source_type", ""),
                line.get("memo") or je.get("description", ""),
                coa_code,
                coa_name,
                dr_amt,
                cr_amt,
                outlet_name,
                brand_name,
            ]
            write_data_row(ws, row_data, current_row, number_cols=[7, 8])
            
            grand_dr += dr_amt
            grand_cr += cr_amt
            line_count += 1
            current_row += 1
    
    # Total row
    if line_count > 0:
        total_row = ["", "", "", "", "", "TOTAL", grand_dr, grand_cr, "", ""]
        write_total_row(ws, total_row, current_row, number_cols=[7, 8])
    
    # Styling
    apply_currency_format(ws, 7, data_start_row, current_row, currency="Rp")
    apply_currency_format(ws, 8, data_start_row, current_row, currency="Rp")
    autosize_columns(ws)
    freeze_header_row(ws, header_row=data_start_row - 1)
    
    return wb
