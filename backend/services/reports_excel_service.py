"""reports_excel_service — Re-export hub for all Excel generation sub-services.

Domain split:
- reports_excel_sales_service      → daily sales, outlet performance, FDO history
- reports_excel_inventory_service  → stock balance, stock movement, inventory valuation
- reports_excel_procurement_service → PO summary, GR summary, vendor performance
- reports_excel_finance_service    → journal ledger, trial balance, AP aging, P&L, report builder
"""
from services.reports_excel_sales_service import (
    generate_daily_sales_excel,
    generate_outlet_performance_excel,
    generate_fdo_history_excel,
)
from services.reports_excel_inventory_service import (
    generate_stock_balance_excel,
    generate_stock_movement_excel,
    generate_inventory_valuation_excel,
)
from services.reports_excel_procurement_service import (
    generate_po_summary_excel,
    generate_gr_summary_excel,
    generate_vendor_performance_excel,
)
from services.reports_excel_finance_service import (
    generate_journal_ledger_excel,
    generate_trial_balance_excel,
    generate_ap_aging_excel,
    generate_report_builder_excel,
    generate_pl_group_excel,
)

__all__ = [
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
