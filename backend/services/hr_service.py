"""Public facade for HR service.

The implementation has been split into the private `services._hr` package
to keep individual files under 300 lines. All existing imports remain
identical — e.g.

    from services import hr_service
    await hr_service.create_advance(...)

still works exactly the same. Payroll module continues to live in
`services.hr_payroll_service` (split previously).
"""
from services._hr import (  # noqa: F401
    # Advances (Kasbon)
    list_advances,
    get_advance,
    create_advance,
    submit_advance_for_approval,
    approve_advance,
    reject_advance,
    get_advance_approval_state,
    mark_advance_installment_paid,
    # Service Charge
    list_service_charge,
    get_service_charge,
    calculate_service_charge,
    approve_service_charge,
    post_service_charge,
    # Incentive
    list_schemes,
    create_scheme,
    list_runs,
    get_run,
    calculate_incentive,
    approve_incentive,
    post_incentive,
    # Voucher
    list_vouchers,
    issue_vouchers,
    redeem_voucher,
    # FOC
    list_foc,
    create_foc,
    # LB Fund
    list_lb_fund,
    _lb_ledger_add,
)

# Payroll (already separate)
from services.hr_payroll_service import (  # noqa: F401
    list_payroll,
    get_payroll,
    create_payroll,
    approve_payroll,
    post_payroll,
    hr_dashboard,
    get_salary_master,
    set_salary_master,
    list_salary_masters,
    import_salary_excel,
    get_payroll_payslip_data,
)
