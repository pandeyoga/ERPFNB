"""Public facade for outlet_budget_service.

The implementation has been split into the private `services._outlet_budget`
package to keep individual files under ~350 lines. All existing imports remain
identical — e.g.

    from services import outlet_budget_service as svc
    await svc.check_pr_against_budget(payload)
"""
from services._outlet_budget import (  # noqa: F401
    # CRUD
    set_budget,
    bulk_set,
    get_budget,
    list_budgets,
    delete_budget,
    # Actuals + pace
    compute_actuals,
    compute_pace,
    # Active lookup
    find_active_budget,
    current_periods_for_outlet,
    # PR hook
    check_pr_against_budget,
    # Increase requests
    create_increase_request,
    list_increase_requests,
    approve_increase_request,
    reject_increase_request,
    # Monitoring
    monitor_overview,
    heatmap,
)
