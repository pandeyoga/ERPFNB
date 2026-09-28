"""Executive Drilldown service — thin facade.

All logic lives in services/_exec_drilldown/. This file re-exports the public API
so all existing routers continue to work with zero changes.
"""
from services._exec_drilldown import (  # noqa: F401
    _today,
    _period_to_range,
    _resolve_period,
    brand_mix,
    ap_aging_summary,
    brand_drilldown,
    outlet_drilldown,
)
