"""Private impl of anomaly detection service — split from former monolithic anomaly_service.py.

Public API is re-exported by services.anomaly_service.
"""
from services._anomaly.helpers import (  # noqa: F401
    ANOMALY_TYPES,
    ANOMALY_TYPE_LABELS,
    VALID_STATUSES,
    DEFAULT_THRESHOLDS,
    _now_iso,
    _today_iso,
    _format_rp,
    _classify_sigma,
    _classify_pct,
    _classify_excess_days,
    _rolling_stats,
    resolve_thresholds,
)
from services._anomaly.detectors import (  # noqa: F401
    detect_sales_deviation,
    detect_vendor_price_spike,
    detect_vendor_leadtime,
    detect_ap_cash_spike,
)
from services._anomaly.storage_notif import (  # noqa: F401
    upsert_event,
    dispatch_event_notification,
    _users_with_any_perm,
    _is_super,
)
from services._anomaly.live import (  # noqa: F401
    check_sales_live,
    check_gr_live,
)
from services._anomaly.batch import (  # noqa: F401
    scan_sales,
    scan_vendors,
    scan_ap_cash,
    scan_all,
)
from services._anomaly.queries import (  # noqa: F401
    list_events,
    get_event,
    triage_event,
    summary,
    export_to_csv,  # Phase 5C.3
)
