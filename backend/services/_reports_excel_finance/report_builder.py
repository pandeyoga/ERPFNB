"""Reports Excel — Report Builder Excel.

Auto-extracted from former monolithic reports_excel_finance_service.py.
"""
from __future__ import annotations

import logging
from typing import Optional



logger = logging.getLogger("aurora.reports")


async def generate_report_builder_excel(
    *,
    dimensions: list[str],
    metrics: list[str],
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    outlet_ids: Optional[list[str]] = None,
    brand_ids: Optional[list[str]] = None,
    vendor_ids: Optional[list[str]] = None,
    category_ids: Optional[list[str]] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "desc",
    limit: int = 1000,
    title: Optional[str] = None,
):
    """Generate Report Builder Excel — wraps report_builder() into styled .xlsx.
    
    Columns: dynamic based on dimensions + metrics (e.g. dim_outlet | dim_month | sales | gross_profit)
    Features: Grand totals row, autosize, freeze header.
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
    from services.reports_analytics_service import report_builder
    
    result = await report_builder(
        dimensions=dimensions, metrics=metrics,
        period_from=period_from, period_to=period_to,
        outlet_ids=outlet_ids, brand_ids=brand_ids,
        vendor_ids=vendor_ids, category_ids=category_ids,
        sort_by=sort_by, sort_dir=sort_dir,
        limit=limit,
    )
    
    rows = result.get("rows", [])
    totals = result.get("totals", {})
    
    # Currency-like metrics → apply Rp format
    currency_metrics = {"sales", "cogs", "gross_profit", "ap_exposure", "purchase_value"}
    
    wb = create_workbook("Report Builder")
    ws = wb.active
    
    # Header
    subtitle_parts = [f"Period: {format_date(period_from) if period_from else 'All'} — {format_date(period_to) if period_to else 'All'}"]
    subtitle_parts.append(f"Dimensions: {', '.join(dimensions)}")
    subtitle_parts.append(f"Metrics: {', '.join(metrics)}")
    
    current_row = add_report_header(
        ws,
        title=title or "Custom Report — Report Builder",
        subtitle=" | ".join(subtitle_parts),
    )
    
    # Build header row: dim_<dim> labels + metric labels
    dim_labels = [d.replace("_", " ").title() for d in dimensions]
    metric_labels = [m.replace("_", " ").title() for m in metrics]
    headers = dim_labels + metric_labels
    
    current_row = write_table_headers(ws, headers, current_row)
    data_start_row = current_row
    
    # Data rows
    metric_col_start = len(dimensions) + 1
    metric_cols = list(range(metric_col_start, metric_col_start + len(metrics)))
    
    for row in rows:
        row_data = []
        for d in dimensions:
            row_data.append(row.get(f"dim_{d}", ""))
        for m in metrics:
            row_data.append(float(row.get(m, 0) or 0))
        write_data_row(ws, row_data, current_row, number_cols=metric_cols)
        current_row += 1
    
    # Total row
    if rows:
        total_row = [""] * (len(dimensions) - 1) + ["TOTAL"]
        for m in metrics:
            total_row.append(float(totals.get(m, 0) or 0))
        write_total_row(ws, total_row, current_row, number_cols=metric_cols)
    
    # Apply currency formatting to currency-like metric columns
    for idx, m in enumerate(metrics):
        if m in currency_metrics:
            apply_currency_format(ws, metric_col_start + idx, data_start_row, current_row, currency="Rp")
    
    autosize_columns(ws)
    freeze_header_row(ws, header_row=data_start_row - 1)
    
    return wb


# ============================================================
# 12. PHASE 2 ITEM 3 — CUSTOM P&L FNB GROUP FORMAT (Multi-month layout)
# ============================================================
