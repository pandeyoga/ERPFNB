"""Regression tests for the 2026-06 forensic-audit fixes.

Covers:
  F2  — Tax settlement preview resolves COA via gl_mapping (coa_complete True)
  F3  — Cash position AP exposure reads ap_ledgers (non-zero) + burn-rate works
  F4  — KDO/BDO (FDO history) Excel report reads kdo_bdo_orders (200 + xlsx)
  F10 — AP Aging XLSX export returns a valid workbook (was HTTP 500)
  D1  — Balance Sheet liabilities reflect AP subledger after backfill
"""
import io
import zipfile
from pathlib import Path

import pytest
import requests


def _api_url() -> str:
    env = Path(__file__).parent.parent.parent / "frontend" / ".env"
    for line in env.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL tidak ditemukan")


BASE_URL = _api_url()
ADMIN = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _is_xlsx(content: bytes) -> bool:
    """A real .xlsx is a zip archive containing [Content_Types].xml."""
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            return "[Content_Types].xml" in zf.namelist()
    except Exception:
        return False


# ── F2: Tax settlement preview ─────────────────────────────────────────────────
def test_f2_tax_settlement_preview_resolves_coa(headers):
    r = requests.get(f"{BASE_URL}/api/finance/periods/2026-04/tax-settlement/preview",
                     headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    # Core fix: COA accounts now resolve via gl_mapping (was always False before)
    assert data.get("coa_complete") is True, f"coa_complete should be True: {data}"
    assert "GL mapping VAT" not in (data.get("reason") or ""), data


# ── F3: Cash position AP exposure + burn rate ──────────────────────────────────
def test_f3_cash_position_ap_exposure_nonzero(headers):
    r = requests.get(f"{BASE_URL}/api/finance/cash/position", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    # AP exposure now reads ap_ledgers (was 0 due to empty ap_invoices drift)
    assert data.get("ap_exposure", 0) > 0, f"ap_exposure should be > 0: {data.get('ap_exposure')}"
    # Burn-rate pipeline now uses coa.type + lines.dr (was always 0)
    assert data.get("burn_30d", 0) > 0, f"burn_30d should be > 0: {data.get('burn_30d')}"


# ── F4: KDO/BDO (FDO history) Excel report ─────────────────────────────────────
def test_f4_fdo_history_report_xlsx(headers):
    r = requests.get(f"{BASE_URL}/api/reports/outlet/fdo-history.xlsx", headers=headers, timeout=30)
    assert r.status_code == 200, r.text[:200]
    assert _is_xlsx(r.content), "response is not a valid xlsx workbook"


# ── F10: AP Aging XLSX export (was 500) ────────────────────────────────────────
def test_f10_ap_aging_export_xlsx(headers):
    r = requests.get(f"{BASE_URL}/api/finance/ap-aging/export/xlsx", headers=headers, timeout=30)
    assert r.status_code == 200, f"AP aging xlsx export must not 500: {r.status_code} {r.text[:200]}"
    assert _is_xlsx(r.content), "AP aging export is not a valid xlsx workbook"


# ── D1: Balance Sheet liabilities reflect AP subledger ─────────────────────────
def test_d1_balance_sheet_has_ap_liabilities(headers):
    r = requests.get(f"{BASE_URL}/api/finance/balance-sheet?period=2026-06", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    totals = r.json()["data"]["totals"]
    assert totals.get("liabilities", 0) > 0, f"liabilities should reflect AP: {totals}"
    assert totals.get("is_balanced") is True, f"balance sheet must balance: {totals}"
