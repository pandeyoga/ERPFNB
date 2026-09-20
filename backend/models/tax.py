"""Tax models — Sprint 1 Indonesian Compliance.

Covers:
- WithholdingTransaction: records every PPh withholding event
- TaxConfig snapshot (transient, not stored — comes from system settings)
"""
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# PPh type constants
PPH_TYPES = {
    "pph21": {"name": "PPh Pasal 21", "desc": "Pemotongan pajak penghasilan karyawan"},
    "pph23": {"name": "PPh Pasal 23", "desc": "Pemotongan pajak atas jasa/royalti vendor"},
    "pph42": {"name": "PPh Pasal 4(2)", "desc": "Pajak final atas sewa tanah/bangunan & konstruksi"},
}

# PPh 23 service types with rates
PPH23_SERVICE_TYPES = [
    {"code": "jasa",      "label": "Jasa (Umum)",            "rate": 0.02},
    {"code": "royalti",   "label": "Royalti",               "rate": 0.15},
    {"code": "bunga",     "label": "Bunga / Hadiah",        "rate": 0.15},
    {"code": "dividen",   "label": "Dividen ke WP Badan",   "rate": 0.15},
    {"code": "sewa",      "label": "Sewa Selain Tanah/Bangunan", "rate": 0.02},
    {"code": "konsultan", "label": "Jasa Konsultan",        "rate": 0.02},
    {"code": "teknik",    "label": "Jasa Teknik",           "rate": 0.02},
    {"code": "manajemen", "label": "Jasa Manajemen",        "rate": 0.02},
]

# PPh 4(2) types with rates
PPH42_SERVICE_TYPES = [
    {"code": "sewa_bangunan",   "label": "Sewa Tanah/Bangunan",   "rate": 0.10},
    {"code": "konstruksi_kecil", "label": "Jasa Konstruksi (Kecil)", "rate": 0.02},
    {"code": "konstruksi_menengah", "label": "Jasa Konstruksi (Menengah)", "rate": 0.03},
    {"code": "konstruksi_besar", "label": "Jasa Konstruksi (Besar)", "rate": 0.04},
    {"code": "konstruksi_perencanaan", "label": "Perencanaan/Pengawasan Konstruksi Kecil", "rate": 0.04},
    {"code": "konstruksi_perencanaan_besar", "label": "Perencanaan/Pengawasan Konstruksi Besar", "rate": 0.06},
    {"code": "hak_tanah",       "label": "Pengalihan Hak Tanah/Bangunan", "rate": 0.025},
]

# PPh 21 progressive brackets (UU HPP No.7/2021)
# (lower_bound_annual, upper_bound_annual, rate)
PPH21_BRACKETS = [
    (0,           60_000_000,   0.05),
    (60_000_000,  250_000_000,  0.15),
    (250_000_000, 500_000_000,  0.25),
    (500_000_000, 5_000_000_000, 0.30),
    (5_000_000_000, float('inf'), 0.35),
]

# PTKP (Penghasilan Tidak Kena Pajak) 2026
# TK/0 = 54jt; K/0 = 58.5jt; K/1 = 63jt; K/2 = 67.5jt; K/3 = 72jt
PTKP_BY_STATUS = {
    "TK/0": 54_000_000,
    "TK/1": 58_500_000,
    "TK/2": 63_000_000,
    "TK/3": 67_500_000,
    "K/0":  58_500_000,
    "K/1":  63_000_000,
    "K/2":  67_500_000,
    "K/3":  72_000_000,
    "K/I/0": 112_500_000,
    "K/I/1": 117_000_000,
    "K/I/2": 121_500_000,
    "K/I/3": 126_000_000,
}
PTKP_DEFAULT = 54_000_000  # TK/0


def make_withholding_doc(
    *,
    source_type: str,   # payment_request | payroll
    source_id: str,
    wh_type: str,       # pph21 | pph23 | pph42
    wh_subtype: Optional[str],   # e.g. 'jasa', 'sewa_bangunan'
    gross_amount: float,
    wh_rate: float,
    wh_amount: float,
    period: str,        # YYYY-MM
    payee_type: str,    # vendor | employee | other
    payee_id: Optional[str],
    payee_name: Optional[str],
    gl_withholding_id: Optional[str],   # COA id for Utang PPh account
    journal_entry_id: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "source_type": source_type,
        "source_id": source_id,
        "wh_type": wh_type,
        "wh_subtype": wh_subtype,
        "gross_amount": round(gross_amount, 2),
        "wh_rate": wh_rate,
        "wh_amount": round(wh_amount, 2),
        "net_amount": round(gross_amount - wh_amount, 2),
        "period": period,
        "payee_type": payee_type,
        "payee_id": payee_id,
        "payee_name": payee_name,
        "gl_withholding_id": gl_withholding_id,
        "journal_entry_id": journal_entry_id,
        "status": "posted",
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": created_by,
    }
