"""Anomaly: constants, helpers, threshold resolution."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from services import business_rules_service

logger = logging.getLogger("aurora.anomaly")


ANOMALY_TYPES: list[str] = [
    "sales_deviation",
    "vendor_price_spike",
    "vendor_leadtime",
    "ap_cash_spike",
]

ANOMALY_TYPE_LABELS: dict[str, str] = {
    "sales_deviation": "Deviasi Penjualan Harian",
    "vendor_price_spike": "Lonjakan Harga Vendor",
    "vendor_leadtime": "Lead Time Vendor Memburuk",
    "ap_cash_spike": "Lonjakan Pengeluaran Kas/AP",
}

VALID_STATUSES = ("open", "acknowledged", "investigating", "resolved", "false_positive")

DEFAULT_THRESHOLDS: dict[str, dict] = {
    "sales_deviation": {
        "enabled": True, "sigma_mild": 1.5, "sigma_severe": 2.5,
        "window_days": 14, "min_points": 7,
    },
    "vendor_price_spike": {
        "enabled": True, "pct_mild": 15, "pct_severe": 30, "window_days": 90,
    },
    "vendor_leadtime": {
        "enabled": True, "days_mild": 3, "days_severe": 7, "window_days": 90,
    },
    "ap_cash_spike": {
        "enabled": True, "pct_mild": 15, "pct_severe": 30,
    },
}


# ============================================================
# HELPERS
# ============================================================


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _format_rp(n: float) -> str:
    sign = "-" if n < 0 else ""
    s = f"{int(abs(round(n))):,}".replace(",", ".")
    return f"{sign}Rp {s}"


def _classify_sigma(z: float, mild: float, severe: float) -> str:
    a = abs(z)
    if a >= severe:
        return "severe"
    if a >= mild:
        return "mild"
    return "none"


def _classify_pct(pct: float, mild: float, severe: float) -> str:
    a = abs(pct)
    if a >= severe:
        return "severe"
    if a >= mild:
        return "mild"
    return "none"


def _classify_excess_days(excess: float, mild: float, severe: float) -> str:
    if excess >= severe:
        return "severe"
    if excess >= mild:
        return "mild"
    return "none"


def _rolling_stats(values: list[float]) -> dict:
    n = len(values)
    if n == 0:
        return {"mean": 0.0, "stddev": 0.0, "count": 0}
    mean = sum(values) / n
    if n < 2:
        return {"mean": mean, "stddev": 0.0, "count": n}
    variance = sum((v - mean) ** 2 for v in values) / n
    return {"mean": mean, "stddev": variance ** 0.5, "count": n}


# ============================================================
# THRESHOLD RESOLUTION (via business_rules)
# ============================================================


async def resolve_thresholds(
    *, outlet_id: Optional[str] = None, brand_id: Optional[str] = None,
    on_date: Optional[str] = None,
) -> dict:
    """Resolve effective anomaly thresholds per scope (outlet → brand → group).

    Returns a fully-populated threshold dict with defaults merged in for any
    missing sub-detector.
    """
    on_date = on_date or _today_iso()
    rule = await business_rules_service.resolve_rule(
        rule_type="anomaly_threshold_policy",
        outlet_id=outlet_id, brand_id=brand_id, on_date=on_date,
    )
    merged = {k: dict(v) for k, v in DEFAULT_THRESHOLDS.items()}
    if rule:
        data = rule.get("rule_data") or {}
        for k, v in data.items():
            if k in merged and isinstance(v, dict):
                merged[k].update(v)
        merged["_rule_id"] = rule.get("id")
        merged["_rule_scope_type"] = rule.get("scope_type")
        merged["_rule_scope_id"] = rule.get("scope_id")
        merged["_rule_version"] = rule.get("version")
    else:
        merged["_rule_id"] = None
    return merged
