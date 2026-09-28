"""Public facade for budget_service.

The implementation has been split into the private `services._budget`
package to keep individual files under ~350 lines. All existing imports remain
identical — e.g.

    from services import budget_service as svc
    await svc.vs_actual(period, outlet_id=...)
"""
from services._budget import (  # noqa: F401
    # Category helper / constants
    guess_category,
    MONTH_COLS,
    MONTH_IDX,
    # CRUD
    create_budget,
    list_budgets,
    get_budget,
    update_budget,
    delete_budget,
    # Approval workflow
    submit_for_approval,
    approve_budget,
    reject_budget,
    lock_budget,
    unlock_budget,
    # Vs Actual
    vs_actual,
    vs_actual_multi_outlet,
    # Import / Export
    import_csv,
    import_excel,
    generate_template_excel,
)
