"""Shared constants + tiny helpers for reports_analytics package."""
import logging
from datetime import datetime, timezone
from typing import Optional

from core.exceptions import ValidationError

logger = logging.getLogger("aurora.reports")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_date(s: Optional[str], *, fallback_today: bool = False) -> Optional[datetime]:
    if not s:
        if fallback_today:
            return datetime.now(timezone.utc)
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as e:
        raise ValidationError(f"Invalid date format (expect YYYY-MM-DD): {s}") from e


# ============================================================
# REPORT BUILDER — supported dimensions + metrics
# ============================================================
SUPPORTED_DIMENSIONS: dict[str, str] = {
    # name -> source key in lookup map
    "outlet": "outlet_id",
    "brand": "brand_id",
    "vendor": "vendor_id",
    "category": "category_id",
    "month": "month",  # derived from date
}

SUPPORTED_METRICS: dict[str, str] = {
    "sales": "Sales (validated daily_sales grand_total)",
    "transaction_count": "Transaction count (validated daily_sales)",
    "cogs": "COGS (JE postings to COGS account)",
    "gross_profit": "Gross Profit (sales - cogs)",
    "ap_exposure": "AP Exposure (open GR grand_total)",
    "po_count": "PO count",
    "gr_count": "GR count",
    "purchase_value": "Purchase value (GR grand_total)",
}


def _dim_value(dim: str, outlet_id, brand_id, vendor_id, category_id, month) -> Optional[str]:
    if dim == "outlet":
        return outlet_id
    if dim == "brand":
        return brand_id
    if dim == "vendor":
        return vendor_id
    if dim == "category":
        return category_id
    if dim == "month":
        return month
    return None
