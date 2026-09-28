"""Market List models — quarterly reference pricing + vendor item catalog."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- MARKET LIST QUARTERS ----------

class MarketListQuarter(BaseModel):
    """Represents a pricing period (Q1-2026, Q2-2026, etc.)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    year: int
    quarter: int  # 1-4
    label: str   # "Q1-2026"
    effective_from: str  # "2026-01-01"
    effective_to: str    # "2026-03-31"
    status: str = "draft"  # draft | active | closed
    notes: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)
    created_by: Optional[str] = None


def make_quarter(year: int, quarter: int, created_by: str) -> dict:
    """Create a MarketListQuarter dict with correct dates."""
    q_start_month = {1: "01", 2: "04", 3: "07", 4: "10"}[quarter]
    q_end_month = {1: "03", 2: "06", 3: "09", 4: "12"}[quarter]
    q_end_day = {1: "31", 2: "30", 3: "30", 4: "31"}[quarter]
    return {
        "id": str(uuid.uuid4()),
        "year": year,
        "quarter": quarter,
        "label": f"Q{quarter}-{year}",
        "effective_from": f"{year}-{q_start_month}-01",
        "effective_to": f"{year}-{q_end_month}-{q_end_day}",
        "status": "draft",
        "notes": None,
        "created_at": _now(),
        "updated_at": _now(),
        "created_by": created_by,
    }


# ---------- MARKET LIST PRICES (Reference) ----------

class MarketListPrice(BaseModel):
    """Reference price for an item in a specific quarter. NOT actual vendor price."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quarter_id: str
    quarter_label: str   # denormalized for quick display
    item_id: str
    unit: str
    ref_price: float  # quarterly reference / benchmark price
    previous_ref_price: Optional[float] = None
    variance_pct: Optional[float] = None  # vs previous quarter
    notes: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


def make_ml_price(
    quarter_id: str,
    quarter_label: str,
    item_id: str,
    unit: str,
    ref_price: float,
    previous_ref_price: Optional[float] = None,
    notes: Optional[str] = None,
    created_by: str = "system",
) -> dict:
    variance_pct = None
    if previous_ref_price and previous_ref_price > 0:
        variance_pct = round(((ref_price - previous_ref_price) / previous_ref_price) * 100, 2)
    return {
        "id": str(uuid.uuid4()),
        "quarter_id": quarter_id,
        "quarter_label": quarter_label,
        "item_id": item_id,
        "unit": unit,
        "ref_price": ref_price,
        "previous_ref_price": previous_ref_price,
        "variance_pct": variance_pct,
        "notes": notes,
        "created_at": _now(),
        "updated_at": _now(),
        "created_by": created_by,
        "updated_by": None,
    }


# ---------- VENDOR ITEMS (Actual price catalog) ----------

class VendorItem(BaseModel):
    """Vendor's item catalog — actual prices sourced from PO and GR transactions."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    item_id: str
    unit: str
    current_price: float = 0.0   # most recent actual transaction price
    min_order_qty: float = 0.0
    lead_time_days: int = 0
    is_preferred: bool = False   # manually marked as preferred vendor for this item
    # Availability
    availability_status: str = "available"  # available | unavailable | discontinued
    unavailable_since: Optional[str] = None
    unavailable_count: int = 0   # running count of times marked unavailable
    last_available_date: Optional[str] = None
    # Transaction tracking
    last_po_date: Optional[str] = None
    last_po_no: Optional[str] = None
    last_gr_date: Optional[str] = None
    last_gr_no: Optional[str] = None
    total_po_qty: float = 0.0    # cumulative qty ordered
    total_gr_qty: float = 0.0    # cumulative qty received
    notes: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)
    created_by: Optional[str] = None


# ---------- VENDOR ITEM PRICE HISTORY ----------

class VendorItemPriceHistory(BaseModel):
    """Audit trail of price changes for each vendor-item pair."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_item_id: str
    vendor_id: str
    item_id: str
    unit: str
    old_price: float
    new_price: float
    change_pct: Optional[float] = None  # percentage change (can be None if first entry)
    effective_date: str   # date of the change
    source: str           # manual | po | gr
    source_doc_id: Optional[str] = None
    source_doc_no: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    changed_by: Optional[str] = None


def make_price_history(
    vendor_item_id: str,
    vendor_id: str,
    item_id: str,
    unit: str,
    old_price: float,
    new_price: float,
    effective_date: str,
    source: str,
    source_doc_id: Optional[str] = None,
    source_doc_no: Optional[str] = None,
    notes: Optional[str] = None,
    changed_by: str = "system",
) -> dict:
    change_pct = None
    if old_price and old_price > 0:
        change_pct = round(((new_price - old_price) / old_price) * 100, 2)
    return {
        "id": str(uuid.uuid4()),
        "vendor_item_id": vendor_item_id,
        "vendor_id": vendor_id,
        "item_id": item_id,
        "unit": unit,
        "old_price": old_price,
        "new_price": new_price,
        "change_pct": change_pct,
        "effective_date": effective_date,
        "source": source,
        "source_doc_id": source_doc_id,
        "source_doc_no": source_doc_no,
        "notes": notes,
        "created_at": _now(),
        "changed_by": changed_by,
    }
