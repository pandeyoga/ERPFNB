"""Catalog of dimensions + metrics + comparatives — for UI dropdowns."""
from typing import Any

from services._reports_analytics._common import (
    SUPPORTED_DIMENSIONS, SUPPORTED_METRICS,
)


def get_catalog() -> dict[str, Any]:
    return {
        "dimensions": [
            {"key": k, "label": k.replace("_", " ").title()} for k in SUPPORTED_DIMENSIONS
        ],
        "metrics": [
            {"key": k, "label": v} for k, v in SUPPORTED_METRICS.items()
        ],
        "comparatives": [
            {"key": "mom", "label": "Month-over-Month"},
            {"key": "yoy", "label": "Year-over-Year"},
        ],
    }
