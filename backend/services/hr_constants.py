"""hr_constants — Shared constants and pure utility functions for HR services.

Extracted from hr_service.py to avoid circular imports when split into sub-modules.
"""
from datetime import datetime, timezone

# ── Sprint G: BPJS & PPh21 constants ──────────────────────────────────────────
BPJS_RATES = {
    "jkk_employer": 0.0054,
    "jkm_employer": 0.0030,
    "jht_employer": 0.0370,
    "jht_employee": 0.0200,
    "jp_employer":  0.0200,
    "jp_employee":  0.0100,
    "jkes_employer": 0.0400,
    "jkes_employee": 0.0100,
    "jp_base_cap":   9_559_600,
    "jkes_base_cap": 12_000_000,
}

PPH21_BRACKETS = [
    (0,            60_000_000,   0.05),
    (60_000_000,   250_000_000,  0.15),
    (250_000_000,  500_000_000,  0.25),
    (500_000_000,  5_000_000_000, 0.30),
    (5_000_000_000, float("inf"), 0.35),
]

PTKP_BY_STATUS = {
    "TK/0": 54_000_000, "TK/1": 58_500_000, "TK/2": 63_000_000, "TK/3": 67_500_000,
    "K/0":  58_500_000, "K/1":  63_000_000, "K/2":  67_500_000, "K/3":  72_000_000,
    "K/I/0": 112_500_000, "K/I/1": 117_000_000, "K/I/2": 121_500_000, "K/I/3": 126_000_000,
}
PTKP_DEFAULT = 54_000_000


def _compute_progressive_tax(pkp: float) -> float:
    tax = 0.0
    remaining = pkp
    for lower, upper, rate in PPH21_BRACKETS:
        if remaining <= 0:
            break
        bracket_size = (upper - lower) if upper != float("inf") else remaining
        taxable = min(remaining, bracket_size)
        if taxable > 0:
            tax += taxable * rate
        remaining -= taxable
    return round(tax, 2)


def _calc_bpjs(gross: float, enrolled: bool) -> dict:
    if not enrolled or gross <= 0:
        return {"employee": 0.0, "employer": 0.0, "detail": {}}
    r = BPJS_RATES
    jp_base   = min(gross, r["jp_base_cap"])
    jkes_base = min(gross, r["jkes_base_cap"])
    emp = round(
        gross     * r["jht_employee"] +
        jp_base   * r["jp_employee"]  +
        jkes_base * r["jkes_employee"],
        2,
    )
    er = round(
        gross     * r["jkk_employer"] +
        gross     * r["jkm_employer"] +
        gross     * r["jht_employer"] +
        jp_base   * r["jp_employer"]  +
        jkes_base * r["jkes_employer"],
        2,
    )
    return {
        "employee": emp, "employer": er,
        "detail": {
            "jht_employee":  round(gross * r["jht_employee"], 2),
            "jp_employee":   round(jp_base * r["jp_employee"], 2),
            "jkes_employee": round(jkes_base * r["jkes_employee"], 2),
            "jkk_employer":  round(gross * r["jkk_employer"], 2),
            "jkm_employer":  round(gross * r["jkm_employer"], 2),
            "jht_employer":  round(gross * r["jht_employer"], 2),
            "jp_employer":   round(jp_base * r["jp_employer"], 2),
            "jkes_employer": round(jkes_base * r["jkes_employer"], 2),
        },
    }


def _calc_pph21(monthly_gross: float, ptkp_status: str) -> dict:
    if monthly_gross <= 0:
        return {"monthly_tax": 0.0, "annual_gross": 0.0, "annual_pkp": 0.0, "annual_tax": 0.0}
    annual_gross = monthly_gross * 12
    biaya_jabatan = min(annual_gross * 0.05, 6_000_000)
    net_income = annual_gross - biaya_jabatan
    ptkp = PTKP_BY_STATUS.get(ptkp_status, PTKP_DEFAULT)
    annual_pkp = max(net_income - ptkp, 0)
    annual_pkp = int(annual_pkp / 1000) * 1000
    annual_tax = _compute_progressive_tax(annual_pkp)
    monthly_tax = round(annual_tax / 12, 2)
    return {
        "monthly_tax": monthly_tax,
        "annual_gross": annual_gross,
        "biaya_jabatan": biaya_jabatan,
        "ptkp": ptkp,
        "annual_pkp": annual_pkp,
        "annual_tax": annual_tax,
        "ptkp_status": ptkp_status,
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _period_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")
