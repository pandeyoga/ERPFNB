"""Bank Reconciliation service — thin facade.

All logic lives in services/_bank_recon/. This file re-exports the public API
so all existing routers continue to work with zero changes.
"""
from services._bank_recon import (  # noqa: F401
    DEFAULT_DATE_TOL_DAYS,
    DEFAULT_AMOUNT_TOL,
    _parse_date,
    _parse_amount,
    parse_statement_csv,
    match_score,
    _build_candidates,
    list_sessions,
    get_session,
    upload_statement,
    auto_match,
    set_manual_match,
    unmatch_row,
    commit_session,
    reverse_commit,
    get_match_candidates,
    mark_exception,
    bulk_auto_accept,
    get_summary,
    export_session_csv,
    get_session_history,
)
