"""Outlet Operational Budget — Cost Control for KDO/FDO/BDO procurement.

Different from finance/budget.py which is accounting/P&L COA-based.
This module is owned by Executive, consumed by Outlet Manager.

Two modes (Phase 16):
  - per_bucket (default): set KDO + FDO + BDO budgets separately;
                          each PR consumes its own bucket; over-spend per
                          bucket is blocked even when total is OK.
  - combined:             single budget pool covering KDO + FDO + BDO together;
                          ANY KDO/FDO/BDO PR consumes the same pool.

Flow:
  Executive sets KDO/FDO/BDO budget per outlet per period (week|month|custom).
  Outlet PR (source ∈ kdo|bdo|fdo) consumes the budget bucket (or combined pool).
  When PR would exceed remaining → BLOCKED. Outlet must submit a BudgetIncreaseRequest.
  Executive reviews increase request and approves/rejects (adds delta to budget).
  At period end: unused budget HANGUS (no carryover).
"""
from datetime import datetime, date, timedelta
from typing import Literal, Optional, List
from pydantic import BaseModel, Field, validator


BUCKETS = ("kdo", "fdo", "bdo")
PERIOD_TYPES = ("weekly", "monthly", "custom")
BUDGET_MODES = ("per_bucket", "combined")


class OutletBudgetCreate(BaseModel):
    outlet_id: str
    brand_id: Optional[str] = None
    period_type: Literal["weekly", "monthly", "custom"]
    period_key: str = Field(..., description="e.g. 2026-W21 / 2026-05 / custom-YYYYMMDD-YYYYMMDD")
    period_start: str = Field(..., description="ISO date YYYY-MM-DD")
    period_end: str = Field(..., description="ISO date YYYY-MM-DD inclusive")
    budget_mode: Literal["per_bucket", "combined"] = "per_bucket"
    kdo_budget: float = 0.0
    fdo_budget: float = 0.0
    bdo_budget: float = 0.0
    combined_budget: float = 0.0  # used only when budget_mode == "combined"
    alert_threshold_pct: float = 80.0
    notes: Optional[str] = None

    @validator("period_start", "period_end")
    def _iso(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except Exception as e:
            raise ValueError("period_start/end harus format YYYY-MM-DD") from e
        return v

    @validator("kdo_budget", "fdo_budget", "bdo_budget", "combined_budget")
    def _nonneg(cls, v):
        if v < 0:
            raise ValueError("budget tidak boleh negatif")
        return v


class OutletBudgetUpdate(BaseModel):
    budget_mode: Optional[Literal["per_bucket", "combined"]] = None
    kdo_budget: Optional[float] = None
    fdo_budget: Optional[float] = None
    bdo_budget: Optional[float] = None
    combined_budget: Optional[float] = None
    alert_threshold_pct: Optional[float] = None
    notes: Optional[str] = None


class BulkSetItem(BaseModel):
    outlet_id: str
    brand_id: Optional[str] = None
    budget_mode: Optional[Literal["per_bucket", "combined"]] = None
    kdo_budget: float = 0.0
    fdo_budget: float = 0.0
    bdo_budget: float = 0.0
    combined_budget: float = 0.0
    notes: Optional[str] = None


class OutletBudgetBulkSet(BaseModel):
    """Set budget for many outlets at once (Executive allocation page)."""
    period_type: Literal["weekly", "monthly", "custom"]
    period_key: str
    period_start: str
    period_end: str
    budget_mode: Literal["per_bucket", "combined"] = "per_bucket"
    alert_threshold_pct: float = 80.0
    items: List[BulkSetItem]


# ============================================================================
# Budget Increase Request
# ============================================================================


class BudgetIncreaseRequestCreate(BaseModel):
    outlet_id: str
    budget_id: str
    # "combined" allowed when parent budget is in combined mode
    bucket: Literal["kdo", "fdo", "bdo", "combined"]
    requested_amount: float = Field(..., gt=0, description="Additional budget needed (delta)")
    reason: str = Field(..., min_length=10, description="Justification")
    related_pr_id: Optional[str] = None
    related_pr_amount: Optional[float] = None


class BudgetIncreaseDecision(BaseModel):
    approved_amount: Optional[float] = Field(None, description="Amount to add (if different from requested)")
    note: Optional[str] = None


# ============================================================================
# Helpers — period key calculations
# ============================================================================


def iso_week_key(d: date) -> str:
    """Return ISO week key (YYYY-Www) for date d."""
    y, w, _ = d.isocalendar()
    return f"{y:04d}-W{w:02d}"


def month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def week_range(d: date) -> tuple[date, date]:
    """Monday → Sunday for week of date d (ISO)."""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def month_range(d: date) -> tuple[date, date]:
    first = d.replace(day=1)
    if first.month == 12:
        nxt = first.replace(year=first.year + 1, month=1)
    else:
        nxt = first.replace(month=first.month + 1)
    last = nxt - timedelta(days=1)
    return first, last
