"""Item Pricing model — price versioning untuk Market List multi-periode.

Excel Market List punya history harga per periode (Q1 2025, Q2 2025, dst).
Model ini menyimpan historical pricing dengan effective date range.
"""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ItemPricingDoc(BaseModel):
    """Single price record dengan effective period."""
    id: str
    item_id: str
    vendor_id: Optional[str] = None  # Harga bisa berbeda per vendor
    unit: str  # kg, pcs, liter, dll
    price: float
    effective_from: str  # YYYY-MM-DD
    effective_to: Optional[str] = None  # None = current/active
    is_active: bool = True
    notes: Optional[str] = None
    previous_price: Optional[float] = None  # For variance calculation
    variance: Optional[float] = None  # Percentage change from previous
    created_at: str
    updated_at: str
    created_by: str


def item_pricing_doc(
    *,
    item_id: str,
    unit: str,
    price: float,
    effective_from: str,
    vendor_id: Optional[str] = None,
    effective_to: Optional[str] = None,
    is_active: bool = True,
    notes: Optional[str] = None,
    previous_price: Optional[float] = None,
    created_by: str,
) -> dict:
    """Create ItemPricing document."""
    variance = None
    if previous_price and previous_price > 0:
        variance = ((price - previous_price) / previous_price) * 100
    
    return {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "vendor_id": vendor_id,
        "unit": unit,
        "price": price,
        "effective_from": effective_from,
        "effective_to": effective_to,
        "is_active": is_active,
        "notes": notes,
        "previous_price": previous_price,
        "variance": variance,
        "created_at": _now(),
        "updated_at": _now(),
        "created_by": created_by,
    }
