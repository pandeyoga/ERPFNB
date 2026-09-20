"""Journal Service — thin facade re-exporting from _journal sub-package.
Refactored from 706L monolith → modular sub-packages (Phase 5.1).

Sub-modules:
  _journal/_common.py     — shared helpers (_ensure_period_open, _period_of, _post_journal)
  _journal/core.py        — reverse_journal
  _journal/outlet.py      — post_for_daily_sales, post_for_petty_cash, post_for_urgent_purchase
  _journal/procurement.py — post_for_gr
  _journal/inventory.py   — post_for_adjustment, post_for_opname
  _journal/hr.py          — post_for_employee_advance, post_for_service_charge,
                            post_for_incentive, post_for_voucher_issue, post_for_voucher_redeem,
                            post_for_foc, post_for_payroll, post_for_withholding_payment

Backward-compatible: all existing imports still work unchanged.
"""
from services._journal import (  # noqa: F401
    _ensure_period_open,
    _period_of,
    _post_journal,
    reverse_journal,
    post_for_daily_sales,
    post_for_petty_cash,
    post_for_urgent_purchase,
    post_for_gr,
    post_for_adjustment,
    post_for_opname,
    post_for_employee_advance,
    post_for_service_charge,
    post_for_incentive,
    post_for_voucher_issue,
    post_for_voucher_redeem,
    post_for_foc,
    post_for_payroll,
    post_for_withholding_payment,
)

__all__ = [
    "reverse_journal",
    "post_for_daily_sales",
    "post_for_petty_cash",
    "post_for_urgent_purchase",
    "post_for_gr",
    "post_for_adjustment",
    "post_for_opname",
    "post_for_employee_advance",
    "post_for_service_charge",
    "post_for_incentive",
    "post_for_voucher_issue",
    "post_for_voucher_redeem",
    "post_for_foc",
    "post_for_payroll",
    "post_for_withholding_payment",
    "_ensure_period_open",
    "_period_of",
    "_post_journal",
]
