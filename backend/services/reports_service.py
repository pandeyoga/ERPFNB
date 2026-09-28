"""reports_service — Re-export hub (backward-compatible).

Split into sub-modules for maintainability:
- reports_analytics_service  → vendor scorecard, report builder, pivot, comparatives, saved reports
- reports_excel_service      → all Excel generation (further split into 4 domain sub-services)

All public functions remain importable as:  from services import reports_service
"""
from services.reports_analytics_service import (
    vendor_scorecard,
    report_builder,
    pivot_matrix,
    comparatives,
    save_report,
    list_saved_reports,
    get_saved,
    delete_saved,
    get_catalog,
)
from services.reports_excel_service import (
    generate_daily_sales_excel,
    generate_outlet_performance_excel,
    generate_fdo_history_excel,
    generate_stock_balance_excel,
    generate_stock_movement_excel,
    generate_inventory_valuation_excel,
    generate_po_summary_excel,
    generate_gr_summary_excel,
    generate_vendor_performance_excel,
    generate_journal_ledger_excel,
    generate_trial_balance_excel,
    generate_ap_aging_excel,
    generate_report_builder_excel,
    generate_pl_group_excel,
)

__all__ = [
    # Analytics
    "vendor_scorecard",
    "report_builder",
    "pivot_matrix",
    "comparatives",
    "save_report",
    "list_saved_reports",
    "get_saved",
    "delete_saved",
    "get_catalog",
    # Excel exports
    "generate_daily_sales_excel",
    "generate_outlet_performance_excel",
    "generate_fdo_history_excel",
    "generate_stock_balance_excel",
    "generate_stock_movement_excel",
    "generate_inventory_valuation_excel",
    "generate_po_summary_excel",
    "generate_gr_summary_excel",
    "generate_vendor_performance_excel",
    "generate_journal_ledger_excel",
    "generate_trial_balance_excel",
    "generate_ap_aging_excel",
    "generate_report_builder_excel",
    "generate_pl_group_excel",
]
