"""Pivot matrix — 2-D rendering of report_builder."""
from typing import Any, Optional

from core.constants import MAX_EXPORT_ROWS
from core.exceptions import ValidationError

from services._reports_analytics.report_builder import report_builder


async def pivot_matrix(
    *,
    dim_x: str,
    dim_y: str,
    metric: str,
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
) -> dict[str, Any]:
    """Pivot 2-D matrix using report_builder under the hood.
    Output: { x_labels: [...], y_labels: [...], cells: [[...]] }.
    """
    if dim_x == dim_y:
        raise ValidationError("dim_x dan dim_y harus berbeda")
    result = await report_builder(
        dimensions=[dim_y, dim_x],
        metrics=[metric],
        period_from=period_from, period_to=period_to,
        limit=MAX_EXPORT_ROWS,
    )
    rows = result["rows"]
    x_labels: list[str] = []
    y_labels: list[str] = []
    matrix: dict[tuple[str, str], float] = {}
    for r in rows:
        xl = r.get(f"dim_{dim_x}", "(–)")
        yl = r.get(f"dim_{dim_y}", "(–)")
        if xl not in x_labels:
            x_labels.append(xl)
        if yl not in y_labels:
            y_labels.append(yl)
        matrix[(yl, xl)] = float(r.get(metric, 0) or 0)
    x_labels.sort()
    y_labels.sort()
    cells: list[list[float]] = []
    row_totals: list[float] = []
    col_totals: dict[str, float] = {x: 0.0 for x in x_labels}
    grand: float = 0.0
    for yl in y_labels:
        row: list[float] = []
        rt = 0.0
        for xl in x_labels:
            v = round(matrix.get((yl, xl), 0.0), 2)
            row.append(v)
            rt += v
            col_totals[xl] = round(col_totals[xl] + v, 2)
        cells.append(row)
        row_totals.append(round(rt, 2))
        grand += rt
    return {
        "dim_x": dim_x, "dim_y": dim_y, "metric": metric,
        "x_labels": x_labels, "y_labels": y_labels,
        "cells": cells,
        "row_totals": row_totals,
        "col_totals": [col_totals[x] for x in x_labels],
        "grand_total": round(grand, 2),
        "filters": {"period_from": period_from, "period_to": period_to},
    }
