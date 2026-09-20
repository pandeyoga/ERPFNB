"""Comparatives (MoM / YoY) + 12-month rolling trend."""
from typing import Any, Optional

from core.exceptions import ValidationError

from services._reports_analytics._common import SUPPORTED_METRICS
from services._reports_analytics.report_builder import report_builder


async def _metric_for_period(metric: str, period: str,
                              outlet_ids: Optional[list[str]],
                              brand_ids: Optional[list[str]]) -> float:
    """Return a single scalar for a given metric in a given period (YYYY-MM)."""
    period_from = f"{period}-01"
    y, m = [int(x) for x in period.split("-")]
    if m == 12:
        ny, nm = y + 1, 1
    else:
        ny, nm = y, m + 1
    period_to = f"{ny:04d}-{nm:02d}-01"

    # Use report_builder w/o dim → all aggregated
    result = await report_builder(
        dimensions=["month"],  # ensure month-aggregated
        metrics=[metric],
        period_from=period_from, period_to=period_to,
        outlet_ids=outlet_ids, brand_ids=brand_ids,
        limit=100,
    )
    return float(result["totals"].get(metric, 0) or 0)


async def comparatives(
    *,
    metric: str,
    period: str,  # YYYY-MM
    compare_to: str = "mom",  # mom | yoy
    outlet_ids: Optional[list[str]] = None,
    brand_ids: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Compare metric value between current period and previous (mom) or last year (yoy).
    Also returns 12-month rolling trend.
    """
    if metric not in SUPPORTED_METRICS:
        raise ValidationError(f"Metrik tidak didukung: {metric}")
    if compare_to not in ("mom", "yoy"):
        raise ValidationError("compare_to harus 'mom' atau 'yoy'")
    try:
        y, m = [int(x) for x in period.split("-")]
        assert 1 <= m <= 12
    except Exception as e:
        raise ValidationError("period harus YYYY-MM") from e

    if compare_to == "mom":
        prev_y, prev_m = (y, m - 1) if m > 1 else (y - 1, 12)
    else:  # yoy
        prev_y, prev_m = y - 1, m
    prev_period = f"{prev_y:04d}-{prev_m:02d}"

    cur = await _metric_for_period(metric, period, outlet_ids, brand_ids)
    prev = await _metric_for_period(metric, prev_period, outlet_ids, brand_ids)

    # 12-month rolling (current and 11 before, including prev as needed)
    rolling: list[dict[str, Any]] = []
    for i in range(11, -1, -1):
        cur_y = y
        cur_m = m - i
        while cur_m <= 0:
            cur_m += 12
            cur_y -= 1
        per = f"{cur_y:04d}-{cur_m:02d}"
        v = await _metric_for_period(metric, per, outlet_ids, brand_ids)
        rolling.append({"period": per, "value": round(v, 2)})

    delta = cur - prev
    delta_pct = round((delta / prev) * 100, 2) if prev else None

    return {
        "metric": metric,
        "period": period,
        "compare_to": compare_to,
        "current": round(cur, 2),
        "previous_period": prev_period,
        "previous": round(prev, 2),
        "delta": round(delta, 2),
        "delta_pct": delta_pct,
        "rolling_12m": rolling,
        "filters": {"outlet_ids": outlet_ids, "brand_ids": brand_ids},
    }
