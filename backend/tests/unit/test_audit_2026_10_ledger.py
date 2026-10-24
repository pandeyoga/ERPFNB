"""Audit 2026-10 — ledger / classification regressions (in-process, isolated throw-away DB).

Each test runs against its own temporary MongoDB database (dropped afterwards), so nothing here
touches the seeded demo data. Covers:
  FIN-09  money summed in integer sen; per-line rounding residue absorbed, real imbalance rejected
  FIN-11  posting to header / unknown accounts is rejected
  FIN-10  malformed / far-future entry dates are rejected (no lock bypass)
  FIN-28  concurrent posting of the same source returns the existing JE (no 500)
  FIN-06  contra-revenue (4010 Discount, normal Dr) reduces revenue in the P&L
  UI-01   budget vs actual: revenue positive, balance-sheet accounts excluded
  POS-05  one canonical phone key for every Indonesian number format
"""
import asyncio
import os
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

import core.db as core_db
from core.exceptions import ValidationError

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")


def _coa(code, name, typ, normal, postable=True):
    return {"id": f"coa-{code}", "code": code, "name": name, "type": typ, "normal_balance": normal,
            "is_postable": postable, "active": True, "deleted_at": None}


@pytest.fixture
async def isolated_db():
    client = AsyncIOMotorClient(MONGO_URL, uuidRepresentation="standard")
    name = f"audit_unit_{uuid.uuid4().hex[:10]}"
    db = client[name]
    prev = core_db._db
    core_db._db = db
    await db.chart_of_accounts.insert_many([
        _coa("1000", "Aset", "asset", "Dr", postable=False),
        _coa("1101", "Kas", "asset", "Dr"),
        _coa("2110", "PPN Keluaran", "liability", "Cr"),
        _coa("4000", "Pendapatan", "revenue", "Cr", postable=False),
        _coa("4001", "Revenue - Food", "revenue", "Cr"),
        _coa("4010", "Discount Expense", "revenue", "Dr"),
        _coa("5001", "COGS", "cogs", "Dr"),
        _coa("5302", "Listrik & Air", "expense", "Dr"),
        _coa("5410", "Salary Expense", "expense", "Dr"),
    ])
    await db.number_series.insert_one({"id": "ns-jae", "code": "JAE", "prefix": "JAE", "current_value": 0,
                                       "format": "{prefix}-{yy}{mm}-{seq:05d}", "reset": "never",
                                       "deleted_at": None})
    await db.journal_entries.create_index(
        [("source_type", 1), ("source_id", 1)], unique=True,
        partialFilterExpression={"source_type": {"$exists": True, "$type": "string"},
                                 "source_id": {"$exists": True, "$type": "string"}, "deleted_at": None},
        name="je_source_unique_partial")
    try:
        yield db
    finally:
        core_db._db = prev
        await client.drop_database(name)
        client.close()


def _today():
    from core.clock import today_str
    return today_str()


async def _post(lines, source_id=None, entry_date=None):
    from services._journal._common import _post_journal
    return await _post_journal(entry_date=entry_date or _today(), description="t", source_type="unit_test",
                               source_id=source_id or uuid.uuid4().hex, lines=lines)


async def test_rounding_residue_absorbed_and_ledger_exact(isolated_db):
    # 0.09 kg × 15,750 + PPN 11 % rounded per line by the caller (FIN-09 repro)
    net = round(0.09 * 15750, 2)          # 1417.5
    tax = round(net * 0.11, 2)            # 155.93 (155.925)
    total = round(net * 1.11, 2)          # 1573.43 — Σ lines = 1573.43, cr side 1573.42 when derived
    je = await _post([
        {"coa_id": "coa-5001", "dr": net}, {"coa_id": "coa-1101", "dr": tax},
        {"coa_id": "coa-2110", "cr": total - 0.01},
    ])
    assert je["total_dr"] == je["total_cr"]
    assert round(sum(ln["dr"] for ln in je["lines"]), 2) == round(sum(ln["cr"] for ln in je["lines"]), 2)


async def test_real_imbalance_rejected(isolated_db):
    with pytest.raises(ValidationError):
        await _post([{"coa_id": "coa-1101", "dr": 100000}, {"coa_id": "coa-4001", "cr": 99000}])


async def test_header_and_unknown_accounts_rejected(isolated_db):
    with pytest.raises(ValidationError):
        await _post([{"coa_id": "coa-1101", "dr": 1000}, {"coa_id": "coa-4000", "cr": 1000}])
    with pytest.raises(ValidationError):
        await _post([{"coa_id": "coa-1101", "dr": 1000}, {"coa_id": "NOT-A-COA", "cr": 1000}])


@pytest.mark.parametrize("bad", ["2019-1-15", "15/01/2019", "abc", "2099-01-01"])
async def test_malformed_or_far_future_dates_rejected(isolated_db, bad):
    with pytest.raises(ValidationError):
        await _post([{"coa_id": "coa-1101", "dr": 1000}, {"coa_id": "coa-4001", "cr": 1000}], entry_date=bad)
    # a rejected entry must not leave a phantom accounting period behind (FIN-22)
    assert await isolated_db.accounting_periods.count_documents({}) == 0


async def test_concurrent_same_source_returns_one_je(isolated_db):
    lines = [{"coa_id": "coa-1101", "dr": 5000}, {"coa_id": "coa-4001", "cr": 5000}]
    res = await asyncio.gather(*[_post(lines, source_id="same-src") for _ in range(6)],
                               return_exceptions=True)
    assert not [r for r in res if isinstance(r, Exception)], res
    assert len({r["id"] for r in res}) == 1
    assert await isolated_db.journal_entries.count_documents({"source_id": "same-src"}) == 1


async def test_pnl_contra_revenue_reduces_revenue(isolated_db):
    from services._finance.reports import profit_loss
    await _post([{"coa_id": "coa-1101", "dr": 9000}, {"coa_id": "coa-4010", "dr": 1000},
                 {"coa_id": "coa-4001", "cr": 10000}])
    pl = await profit_loss(period=_today()[:7], compare_prev=False)
    assert pl["revenue"]["total"] == 9000
    assert pl["net_income"] == 9000
    disc = [r for r in pl["revenue"]["rows"] if r["code"] == "4010"]
    assert disc and disc[0]["amount"] == -1000


async def test_budget_vs_actual_signs_and_scope(isolated_db):
    from services._budget.vs_actual import vs_actual
    await _post([{"coa_id": "coa-1101", "dr": 10000}, {"coa_id": "coa-4001", "cr": 10000}])
    await _post([{"coa_id": "coa-5302", "dr": 2000}, {"coa_id": "coa-1101", "cr": 2000}])
    await _post([{"coa_id": "coa-5410", "dr": 3000}, {"coa_id": "coa-1101", "cr": 3000}])
    r = await vs_actual(_today()[:7], scope="group")
    cats = {c["category"]: c for c in r["category_rollup"]}
    assert cats["REV"]["actual"] == 10000          # positive, not -10000
    assert cats["OPEX"]["actual"] == 2000          # cash (1101) is NOT counted as OPEX
    assert cats["PAYROLL"]["actual"] == 3000
    assert cats["NET"]["actual"] == 5000
    assert all(row["coa_code"] != "1101" for row in r["coa_level"])


@pytest.mark.parametrize("raw", ["0813 9284-7589", "+6281392847589", "6281392847589", "081392847589",
                                 "(0813) 9284 7589"])
def test_phone_key_canonical(raw):
    from services.customer_service import phone_e164, phone_key
    assert phone_key(raw) == "6281392847589"
    assert phone_e164(raw) == "+6281392847589"
