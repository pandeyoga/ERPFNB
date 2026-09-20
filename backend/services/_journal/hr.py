"""_journal/hr.py — backward-compatible re-exporter for HR journal postings.
Actual implementations split into hr_payroll.py and hr_expenses.py.
"""
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
    "post_for_employee_advance",
    "post_for_service_charge",
    "post_for_incentive",
    "post_for_voucher_issue",
    "post_for_voucher_redeem",
    "post_for_foc",
    "post_for_payroll",
    "post_for_withholding_payment",
]
