"""Fixed Asset models — Sprint 2.

Covers:
- FixedAsset: master record per asset
- DepreciationEntry: monthly depreciation posting record
- AssetEvent: disposal, revaluation, transfer events
"""
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Asset categories (Indonesian F&B context)
ASSET_CATEGORIES = [
    {"code": "LAND",    "name": "Tanah",                  "useful_life": 0,  "depreciable": False, "coa_code": "1510"},
    {"code": "BLDG",    "name": "Bangunan",                "useful_life": 20, "depreciable": True,  "coa_code": "1511"},
    {"code": "VEH",     "name": "Kendaraan",               "useful_life": 8,  "depreciable": True,  "coa_code": "1512"},
    {"code": "MACH",    "name": "Mesin & Peralatan Dapur", "useful_life": 10, "depreciable": True,  "coa_code": "1513"},
    {"code": "FURN",    "name": "Furnitur & Inventaris",   "useful_life": 5,  "depreciable": True,  "coa_code": "1514"},
    {"code": "IT",      "name": "Peralatan IT",             "useful_life": 4,  "depreciable": True,  "coa_code": "1515"},
    {"code": "INTANG",  "name": "Aset Tak Berwujud",       "useful_life": 5,  "depreciable": True,  "coa_code": "1520"},
    {"code": "OTHER",   "name": "Aset Lainnya",             "useful_life": 5,  "depreciable": True,  "coa_code": "1519"},
]

DEP_METHODS = {
    "straight_line": "Garis Lurus (Straight Line)",
    "declining_balance": "Saldo Menurun (Declining Balance)",
    "sum_of_years_digits": "Jumlah Angka Tahun (Sum-of-Years' Digits)",
}

ASSET_STATUSES = ["active", "disposed", "revalued", "transferred", "fully_depreciated"]


def make_asset_doc(
    *,
    asset_code: str,
    name: str,
    category: str,              # LAND, BLDG, VEH, etc.
    purchase_date: str,         # YYYY-MM-DD
    purchase_cost: float,
    salvage_value: float,       # nilai residu
    useful_life_years: int,     # 0 = non-depreciable
    dep_method: str,            # straight_line | declining_balance
    outlet_id: Optional[str],
    location: Optional[str],
    vendor_id: Optional[str],
    invoice_no: Optional[str],
    purchase_payment_id: Optional[str],
    coa_asset_id: Optional[str],     # asset COA e.g. 1501
    coa_accum_dep_id: Optional[str], # accumulated dep COA
    coa_dep_exp_id: Optional[str],   # depreciation expense COA
    notes: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "asset_code": asset_code,
        "name": name,
        "category": category,
        "purchase_date": purchase_date,
        "purchase_cost": round(purchase_cost, 2),
        "salvage_value": round(salvage_value, 2),
        "current_cost": round(purchase_cost, 2),     # changes on revaluation
        "useful_life_years": useful_life_years,
        "dep_method": dep_method,
        "accumulated_dep": 0.0,
        "book_value": round(purchase_cost, 2),
        "outlet_id": outlet_id,
        "location": location,
        "vendor_id": vendor_id,
        "invoice_no": invoice_no,
        "purchase_payment_id": purchase_payment_id,
        "coa_asset_id": coa_asset_id,
        "coa_accum_dep_id": coa_accum_dep_id,
        "coa_dep_exp_id": coa_dep_exp_id,
        "last_dep_period": None,    # YYYY-MM of last posting
        "dep_entries": [],          # [dep_entry_id, ...]
        "events": [],               # [event_id, ...]
        "status": "active",
        "notes": notes,
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": created_by,
    }


def make_dep_entry(
    *,
    asset_id: str,
    period: str,                # YYYY-MM
    dep_amount: float,
    accumulated_dep: float,
    book_value_after: float,
    je_id: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "asset_id": asset_id,
        "period": period,
        "dep_amount": round(dep_amount, 2),
        "accumulated_dep": round(accumulated_dep, 2),
        "book_value_after": round(book_value_after, 2),
        "je_id": je_id,
        "created_at": now,
        "created_by": created_by,
    }


def make_asset_event(
    *,
    asset_id: str,
    event_type: str,            # disposal | revaluation | transfer | note
    event_date: str,
    description: str,
    amount_before: float,
    amount_after: float,
    gain_loss: float,
    je_id: Optional[str],
    metadata: Optional[dict],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "asset_id": asset_id,
        "event_type": event_type,
        "event_date": event_date,
        "description": description,
        "amount_before": round(amount_before, 2),
        "amount_after": round(amount_after, 2),
        "gain_loss": round(gain_loss, 2),
        "je_id": je_id,
        "metadata": metadata or {},
        "created_at": now,
        "created_by": created_by,
    }
