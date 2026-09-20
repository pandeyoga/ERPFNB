"""Private impl of reports_analytics_service — split from the former monolithic
services/reports_analytics_service.py.

Public API is re-exported by services.reports_analytics_service (facade).
"""
from services._reports_analytics._common import (  # noqa: F401
    SUPPORTED_DIMENSIONS,
    SUPPORTED_METRICS,
)
from services._reports_analytics.vendor_scorecard import (  # noqa: F401
    vendor_scorecard,
)
from services._reports_analytics.report_builder import (  # noqa: F401
    report_builder,
)
from services._reports_analytics.pivot import (  # noqa: F401
    pivot_matrix,
)
from services._reports_analytics.comparatives import (  # noqa: F401
    comparatives,
)
from services._reports_analytics.saved import (  # noqa: F401
    save_report,
    list_saved_reports,
    get_saved,
    delete_saved,
)
from services._reports_analytics.catalog import (  # noqa: F401
    get_catalog,
)
