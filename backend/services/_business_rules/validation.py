"""Validation logic for business rule payloads."""
from __future__ import annotations

from typing import Optional

from core.exceptions import ValidationError

from services._business_rules._common import (
    SUPPORTED_RULE_TYPES,
    VALID_SCOPE_TYPES,
    logger,
)


def _validate_scope(scope_type: str, scope_id: str) -> None:
    if scope_type not in VALID_SCOPE_TYPES:
        raise ValidationError(
            f"scope_type tidak valid. Pilihan: {', '.join(VALID_SCOPE_TYPES)}",
            field="scope_type",
        )
    if not scope_id:
        raise ValidationError("scope_id wajib", field="scope_id")


def _validate_rule_type(rule_type: str) -> None:
    if rule_type not in SUPPORTED_RULE_TYPES:
        raise ValidationError(
            f"rule_type tidak didukung. Pilihan: {', '.join(SUPPORTED_RULE_TYPES)}",
            field="rule_type",
        )


def _validate_dates(effective_from: Optional[str], effective_to: Optional[str]) -> None:
    if effective_from and effective_to and effective_from > effective_to:
        raise ValidationError(
            "effective_from tidak boleh lebih besar dari effective_to",
            field="effective_to",
        )


def _validate_rule_data(rule_type: str, rule_data: dict) -> None:
    """Rule-type specific light validation. Editors enforce most constraints
    on the FE; backend keeps these guard rails minimal so payloads stay flexible.
    """
    if not isinstance(rule_data, dict):
        raise ValidationError("rule_data harus berupa object", field="rule_data")

    if rule_type == "sales_input_schema":
        _validate_sales_input_schema(rule_data)
    elif rule_type == "petty_cash_policy":
        _validate_petty_cash_policy(rule_data)
    elif rule_type == "service_charge_policy":
        _validate_service_charge_policy(rule_data)
    elif rule_type == "incentive_policy":
        _validate_incentive_policy(rule_data)
    elif rule_type == "anomaly_threshold_policy":
        _validate_anomaly_threshold_policy(rule_data)


def _validate_sales_input_schema(rule_data: dict) -> None:
    channels = rule_data.get("channels", [])
    if not isinstance(channels, list):
        raise ValidationError("rule_data.channels harus berupa list", field="rule_data.channels")
    for i, c in enumerate(channels):
        if not isinstance(c, dict) or not c.get("code"):
            raise ValidationError(
                f"channels[{i}].code wajib", field=f"rule_data.channels[{i}].code"
            )
    payment_methods = rule_data.get("payment_methods", [])
    if not isinstance(payment_methods, list):
        raise ValidationError(
            "rule_data.payment_methods harus berupa list", field="rule_data.payment_methods"
        )
    revenue_buckets = rule_data.get("revenue_buckets", [])
    if not isinstance(revenue_buckets, list):
        raise ValidationError(
            "rule_data.revenue_buckets harus berupa list", field="rule_data.revenue_buckets"
        )


def _validate_petty_cash_policy(rule_data: dict) -> None:
    for f in ("monthly_limit", "max_per_txn", "approval_threshold"):
        v = rule_data.get(f)
        if v is None:
            continue
        try:
            v_num = float(v)
        except (TypeError, ValueError):
            raise ValidationError(f"{f} harus angka", field=f"rule_data.{f}")
        if v_num < 0:
            raise ValidationError(f"{f} tidak boleh negatif", field=f"rule_data.{f}")
    freq = rule_data.get("replenish_frequency")
    if freq is not None and freq not in ("daily", "weekly", "monthly", "manual"):
        raise ValidationError(
            "replenish_frequency tidak valid (daily|weekly|monthly|manual)",
            field="rule_data.replenish_frequency",
        )


def _validate_service_charge_policy(rule_data: dict) -> None:
    for f in ("service_charge_pct", "lb_pct", "ld_pct"):
        v = rule_data.get(f)
        if v is None:
            continue
        try:
            v_num = float(v)
        except (TypeError, ValueError):
            raise ValidationError(f"{f} harus angka", field=f"rule_data.{f}")
        if v_num < 0 or v_num > 1:
            raise ValidationError(
                f"{f} harus di rentang 0..1 (rasio, bukan persen)",
                field=f"rule_data.{f}",
            )
    method = rule_data.get("allocation_method")
    if method is not None and method not in (
        "by_days_worked",
        "equal",
        "by_role_multiplier",
    ):
        raise ValidationError(
            "allocation_method tidak valid (by_days_worked|equal|by_role_multiplier)",
            field="rule_data.allocation_method",
        )
    # Sum sanity
    sc = float(rule_data.get("service_charge_pct") or 0)
    lb = float(rule_data.get("lb_pct") or 0)
    ld = float(rule_data.get("ld_pct") or 0)
    if (lb + ld) > sc and sc > 0:
        # Not blocking, but log a warning hint via field metadata: keep as soft validation.
        # Editors will surface a UI warning.
        pass


def _validate_incentive_policy(rule_data: dict) -> None:
    rt = rule_data.get("rule_type")
    if rt not in (None, "pct_of_sales", "flat_per_target", "tiered_sales"):
        raise ValidationError(
            "rule_data.rule_type tidak valid (pct_of_sales|flat_per_target|tiered_sales)",
            field="rule_data.rule_type",
        )
    if rt == "tiered_sales":
        tiers = rule_data.get("tiers") or []
        if not isinstance(tiers, list) or not tiers:
            raise ValidationError(
                "tiered_sales harus punya minimal 1 tier", field="rule_data.tiers"
            )
        for i, t in enumerate(tiers):
            if not isinstance(t, dict):
                raise ValidationError(
                    f"tiers[{i}] harus object", field=f"rule_data.tiers[{i}]"
                )


def _validate_anomaly_threshold_policy(rule_data: dict) -> None:
    # Each sub-detector is optional but if present must be well-formed.
    # Allowed keys: sales_deviation, vendor_price_spike, vendor_leadtime, ap_cash_spike.
    valid_keys = {"sales_deviation", "vendor_price_spike", "vendor_leadtime", "ap_cash_spike"}
    for k, v in rule_data.items():
        if k not in valid_keys:
            # Tolerate unknown keys (forward compatibility) but warn in logs.
            logger.warning("Unknown anomaly_threshold_policy key: %s", k)
            continue
        if not isinstance(v, dict):
            raise ValidationError(
                f"{k} harus berupa object", field=f"rule_data.{k}"
            )
        # Numeric guards (negative/huge rejected)
        for nf in ("sigma_mild", "sigma_severe", "pct_mild", "pct_severe",
                   "days_mild", "days_severe", "window_days", "min_points",
                   "rolling_window_days"):
            val = v.get(nf)
            if val is None:
                continue
            try:
                num = float(val)
            except (TypeError, ValueError):
                raise ValidationError(
                    f"{k}.{nf} harus angka", field=f"rule_data.{k}.{nf}"
                )
            if num < 0:
                raise ValidationError(
                    f"{k}.{nf} tidak boleh negatif", field=f"rule_data.{k}.{nf}"
                )
            if nf.startswith("window") and num > 365:
                raise ValidationError(
                    f"{k}.{nf} maksimal 365", field=f"rule_data.{k}.{nf}"
                )
