"""_journal — modular journal service package.

Re-exports all public functions for backward-compatible imports.
Sub-modules:
  _common.py     — shared helpers (_ensure_period_open, _period_of, _post_journal)
  core.py        — reverse_journal
  outlet.py      — post_for_daily_sales, post_for_petty_cash, post_for_urgent_purchase
  procurement.py — post_for_gr
  inventory.py   — post_for_adjustment, post_for_opname
  hr_payroll.py  — post_for_employee_advance, post_for_service_charge, post_for_incentive,
                    post_for_payroll, post_for_withholding_payment
  hr_expenses.py — post_for_voucher_issue, post_for_voucher_redeem, post_for_foc
  hr.py          — thin re-exporter for backward compat (from _journal.hr import ...)
"""
from services._journal._common import _ensure_period_open, _period_of, _post_journal  # noqa: F401
from services._journal.core import reverse_journal  # noqa: F401
from services._journal.outlet import (  # noqa: F401
    post_for_daily_sales,
    post_for_petty_cash,
    post_for_urgent_purchase,
)
from services._journal.procurement import post_for_gr  # noqa: F401
from services._journal.inventory import (  # noqa: F401
    post_for_adjustment,
    post_for_opname,
)
from services._journal.hr_payroll import (  # noqa: F401
    post_for_employee_advance,
    post_for_incentive,
    post_for_payroll,
    post_for_service_charge,
    post_for_withholding_payment,
)
from services._journal.hr_expenses import (  # noqa: F401
    post_for_foc,
    post_for_voucher_issue,
    post_for_voucher_redeem,
)

__all__ = [
    # Core
    "reverse_journal",
    # Outlet
    "post_for_daily_sales",
    "post_for_petty_cash",
    "post_for_urgent_purchase",
    # Procurement
    "post_for_gr",
    # Inventory
    "post_for_adjustment",
    "post_for_opname",
    # HR Payroll
    "post_for_employee_advance",
    "post_for_service_charge",
    "post_for_incentive",
    "post_for_payroll",
    "post_for_withholding_payment",
    # HR Expenses
    "post_for_voucher_issue",
    "post_for_voucher_redeem",
    "post_for_foc",
    # Internal helpers (for tests / period_service)
    "_ensure_period_open",
    "_period_of",
    "_post_journal",
]
