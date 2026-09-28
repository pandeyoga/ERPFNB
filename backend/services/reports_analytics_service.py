"""reports_analytics_service — Public facade.

The implementation has been split into the private `services._reports_analytics`
package to keep individual files under ~350 lines. All existing imports remain
identical — e.g.:

    from services.reports_analytics_service import (
        vendor_scorecard, report_builder, pivot_matrix, comparatives,
        save_report, list_saved_reports, get_saved, delete_saved, get_catalog,
    )

Features:
- Vendor Performance Scorecard
- Report Builder (lite)
- Pivot Matrix
- Comparatives (MoM / YoY)
- Saved Reports CRUD
- Report Catalog
"""
from services._reports_analytics import (  # noqa: F401
    # Constants
    SUPPORTED_DIMENSIONS,
    SUPPORTED_METRICS,
    # 1. Vendor scorecard
    vendor_scorecard,
    # 2. Report builder (lite)
    report_builder,
    # 3. Pivot matrix
    pivot_matrix,
    # 4. Comparatives
    comparatives,
    # 5. Saved report definitions
    save_report,
    list_saved_reports,
    get_saved,
    delete_saved,
    # 6. Catalog (UI helper)
    get_catalog,
)
