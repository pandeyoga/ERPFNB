"""Finance service — thin facade.

All logic lives in services/_finance/. This file re-exports the public API
so all existing routers continue to work with zero changes.
"""
from services._finance import (  # noqa: F401
    list_journals,
    get_journal,
    _enrich_journal,
    post_manual_journal,
    reverse_journal,
    _aggregate_balance,
    _prev_period,
    trial_balance,
    profit_loss,
    ap_aging,
    sales_validation_queue,
    finance_home,
)
