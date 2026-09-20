"""Public facade for anomaly_service.

The implementation has been split into the private `services._anomaly` package
to keep individual files under ~300 lines. All existing imports remain identical.
"""
from services._anomaly import (  # noqa: F401
    # Constants
    ANOMALY_TYPES,
    ANOMALY_TYPE_LABELS,
    VALID_STATUSES,
    DEFAULT_THRESHOLDS,
    # Helpers
    _now_iso,
    _today_iso,
    _format_rp,
    _classify_sigma,
    _classify_pct,
    _classify_excess_days,
    _rolling_stats,
    resolve_thresholds,
    # Detectors
    detect_sales_deviation,
    detect_vendor_price_spike,
    detect_vendor_leadtime,
    detect_ap_cash_spike,
    # Storage + Notifications
    upsert_event,
    dispatch_event_notification,
    _users_with_any_perm,
    _is_super,
    # Live hooks
    check_sales_live,
    check_gr_live,
    # Batch scans
    scan_sales,
    scan_vendors,
    scan_ap_cash,
    scan_all,
    # Queries
    list_events,
    get_event,
    triage_event,
    summary,
    export_to_csv,  # Phase 5C.3
)
