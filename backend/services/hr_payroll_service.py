"""HR Payroll service — thin facade.

All logic lives in services/_hr_payroll/. This file re-exports the public API
so all existing routers continue to work with zero changes.
"""
from services._hr_payroll import (  # noqa: F401
    list_payroll,
    get_payroll,
    create_payroll,
    approve_payroll,
    post_payroll,
    hr_dashboard,
    STANDARD_COMPONENTS,
    PTKP_OPTIONS,
    get_salary_master,
    set_salary_master,
    list_salary_masters,
    import_salary_excel,
    get_payroll_payslip_data,
)
