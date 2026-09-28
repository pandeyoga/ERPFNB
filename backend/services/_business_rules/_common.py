"""Shared constants and helpers for business_rules service."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger("aurora.business_rules")


SUPPORTED_RULE_TYPES: list[str] = [
    "sales_input_schema",
    "petty_cash_policy",
    "service_charge_policy",
    "incentive_policy",
    "anomaly_threshold_policy",
]

# Rule types managed by THIS service (excludes approval_workflow which has its own service)
RULE_TYPE_LABELS: dict[str, str] = {
    "sales_input_schema": "Skema Penjualan",
    "petty_cash_policy": "Kebijakan Kas Kecil",
    "service_charge_policy": "Service Charge",
    "incentive_policy": "Skema Insentif",
    "anomaly_threshold_policy": "Threshold Deteksi Anomali",
}

VALID_SCOPE_TYPES: tuple[str, ...] = ("group", "brand", "outlet")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
