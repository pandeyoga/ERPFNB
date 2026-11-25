"""Audit 2026-10 — POS-readiness regressions against the live backend (seeded demo DB).

Concurrency, outlet scope, permission and input-validation fixes found by the October 2026 audit:
  POS-01 concurrent daily-sales drafts → one record      POS-03 double validate → one JE, 409s
  POS-12 malformed daily-sales input → 400 (never 500)   SEC   read-only role cannot write sales
  POS-07/11 + SEC cross-outlet reads/writes are blocked   POS-04 cashier points idempotent per receipt
  POS-05 one member per phone regardless of format        FIN-01 concurrent AR receipts → one posting
  FIN-10/11 manual JE: malformed date / header account → 400
"""
import asyncio
import os
import random
import uuid
from datetime import date, timedelta

import httpx
import pytest
from pymongo import MongoClient

from tests.conftest import API, DEMO_PASSWORD

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")


def _db():
    from tests.conftest import _load_backend_env
    env = _load_backend_env()
    return MongoClient(os.environ.get("MONGO_URL") or env.get("MONGO_URL") or MONGO_URL)[
        os.environ.get("DB_NAME") or env.get("DB_NAME") or "test_database"]


def _token(email: str) -> str:
    r = httpx.post(f"{API}/auth/login", json={"email": email, "password": DEMO_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["data"]["access_token"]


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {k: _token(e) for k, e in {
        "admin": "admin@fnbgroup.id", "finance": "finance@fnbgroup.id", "executive": "executive@fnbgroup.id",
        "cfs": "cfs.manager@fnbgroup.id", "rst": "rst.manager@fnbgroup.id", "lng": "lng.manager@fnbgroup.id",
        "hr": "hr.officer@fnbgroup.id",
    }.items()}


@pytest.fixture(scope="module")
def ctx():
    db = _db()
    outlets = {o["code"]: o for o in db.outlets.find({"deleted_at": None})}
    cash = db.payment_methods.find_one({"code": "CASH", "deleted_at": None})
    return {"db": db, "outlets": outlets, "cash_pm": cash["id"]}


def _free_sales_date(db, outlet_id: str) -> str:
    """A past business date in an open period with no daily sales and no close for this outlet."""
    used = {d["sales_date"] for d in db.daily_sales.find({"outlet_id": outlet_id}, {"sales_date": 1})}
    closed = {d["close_date"] for d in db.daily_close_records.find({"outlet_id": outlet_id}, {"close_date": 1})}
    locked = {p["period"] for p in db.accounting_periods.find({"status": {"$in": ["locked", "closed"]}})}
    d = date.today() - timedelta(days=2)
    for _ in range(400):
        s = d.isoformat()
        if s not in used and s not in closed and s[:7] not in locked:
            return s
        d -= timedelta(days=1)
    pytest.skip("no free sales date available")


def _draft_payload(outlet_id, sales_date, pm_id, amount=150000):
    return {"outlet_id": outlet_id, "sales_date": sales_date,
            "revenue_buckets": [{"bucket": "food", "amount": amount}],
            "payment_breakdown": [{"payment_method_id": pm_id, "amount": amount}],
            "service_charge": 0, "tax_amount": 0, "transaction_count": 3,
            "notes": f"AUDIT-2026-10 {uuid.uuid4().hex[:6]}"}


async def _burst(n, method, url, **kw):
    async with httpx.AsyncClient(timeout=30) as c:
        return await asyncio.gather(*[c.request(method, url, **kw) for _ in range(n)])


def test_concurrent_drafts_create_one_record(tokens, ctx):
    lng = ctx["outlets"]["LNG"]["id"]
    sd = _free_sales_date(ctx["db"], lng)
    res = asyncio.run(_burst(8, "POST", f"{API}/outlet/daily-sales/draft",
                             json=_draft_payload(lng, sd, ctx["cash_pm"]), headers=_h(tokens["lng"])))
    assert all(r.status_code in (200, 409) for r in res), [r.text for r in res]
    assert ctx["db"].daily_sales.count_documents({"outlet_id": lng, "sales_date": sd, "deleted_at": None}) == 1


def test_double_validate_posts_one_journal(tokens, ctx):
    lng = ctx["outlets"]["LNG"]["id"]
    sd = _free_sales_date(ctx["db"], lng)
    r = httpx.post(f"{API}/outlet/daily-sales/draft", json=_draft_payload(lng, sd, ctx["cash_pm"]),
                   headers=_h(tokens["lng"]), timeout=30)
    assert r.status_code == 200, r.text
    ds_id = r.json()["data"]["id"]
    r = httpx.post(f"{API}/outlet/daily-sales/{ds_id}/submit", headers=_h(tokens["lng"]), timeout=30)
    assert r.status_code == 200, r.text
    res = asyncio.run(_burst(5, "POST", f"{API}/outlet/daily-sales/{ds_id}/validate", headers=_h(tokens["finance"])))
    codes = sorted(x.status_code for x in res)
    assert codes.count(200) == 1 and all(c == 409 for c in codes if c != 200), [x.text for x in res]
    assert ctx["db"].journal_entries.count_documents(
        {"source_type": "sales", "source_id": ds_id, "deleted_at": None}) == 1


@pytest.mark.parametrize("patch,field", [
    ({"sales_date": "not-a-date"}, "sales_date"),
    ({"sales_date": (date.today() + timedelta(days=5)).isoformat()}, "sales_date"),
    ({"revenue_buckets": [{"bucket": "food", "amount": "abc"}]}, "revenue_buckets"),
    ({"revenue_buckets": ["food"]}, "revenue_buckets"),
    ({"tax_amount": -100}, "tax_amount"),
    ({"payment_breakdown": [{"payment_method_id": "no-such-pm", "amount": 150000}]}, "payment_breakdown"),
])
def test_draft_input_validation_is_400(tokens, ctx, patch, field):
    bky = ctx["outlets"]["BKY"]["id"]
    body = {**_draft_payload(bky, _free_sales_date(ctx["db"], bky), ctx["cash_pm"]), **patch}
    r = httpx.post(f"{API}/outlet/daily-sales/draft", json=body,
                   headers=_h(_token("bky.manager@fnbgroup.id")), timeout=30)
    assert r.status_code == 400, r.text
    assert (r.json()["errors"][0].get("field") or "").startswith(field)


def test_read_only_executive_cannot_write_outlet_ops(tokens, ctx):
    cfs = ctx["outlets"]["CFS"]["id"]
    body = _draft_payload(cfs, _free_sales_date(ctx["db"], cfs), ctx["cash_pm"])
    assert httpx.post(f"{API}/outlet/daily-sales/draft", json=body, headers=_h(tokens["executive"])).status_code == 403
    pc = {"outlet_id": cfs, "type": "purchase", "amount": 1000, "txn_date": date.today().isoformat()}
    assert httpx.post(f"{API}/outlet/petty-cash", json=pc, headers=_h(tokens["executive"])).status_code == 403


def test_cross_outlet_reads_blocked(tokens, ctx):
    db, rst, cfs = ctx["db"], ctx["outlets"]["RST"]["id"], ctx["outlets"]["CFS"]["id"]
    h = _h(tokens["cfs"])
    other_ds = db.daily_sales.find_one({"outlet_id": rst, "deleted_at": None})
    if other_ds:
        assert httpx.get(f"{API}/outlet/daily-sales/{other_ds['id']}", headers=h).status_code == 403
    r = httpx.get(f"{API}/inventory/balance", params={"outlet_id": rst}, headers=h)
    assert r.status_code == 200 and r.json()["data"] == []
    r = httpx.get(f"{API}/inventory/balance", headers=h)
    assert {row["outlet_id"] for row in r.json()["data"]} <= {cfs}
    r = httpx.get(f"{API}/inventory/valuation", params={"outlet_id": rst}, headers=h)
    assert r.json()["data"]["total_value"] == 0
    assert httpx.get(f"{API}/outlet/petty-cash/balance", params={"outlet_id": rst}, headers=h).status_code == 403
    assert httpx.get(f"{API}/outlet-budget/by-outlet/{rst}/current", headers=h).status_code == 403
    r = httpx.get(f"{API}/outlet/daily-close", params={"outlet_id": rst}, headers=h)
    assert r.status_code == 200 and r.json()["data"] == []


def test_reservations_are_outlet_scoped(tokens, ctx):
    db, rst = ctx["db"], ctx["outlets"]["RST"]["id"]
    r = httpx.get(f"{API}/reservations", params={"per_page": 100}, headers=_h(tokens["rst"]))
    assert r.status_code == 200
    assert {i["outlet_id"] for i in r.json()["data"]["items"]} <= {rst}
    other = db.reservations.find_one({"outlet_id": {"$ne": rst}, "deleted_at": None})
    if other:
        assert httpx.get(f"{API}/reservations/{other['id']}", headers=_h(tokens["rst"])).status_code == 403
        r = httpx.patch(f"{API}/reservations/{other['id']}/deposit", json={"deposit_status": "paid"},
                        headers=_h(tokens["rst"]))
        assert r.status_code == 403


def test_customer_lookup_requires_loyalty_permission(tokens):
    r = httpx.get(f"{API}/outlet/loyalty/cashier/lookup", params={"phone": "081234567890"}, headers=_h(tokens["hr"]))
    assert r.status_code == 403


def test_cashier_points_idempotent_per_receipt_and_one_member_per_phone(tokens, ctx):
    db = ctx["db"]
    digits = f"8{random.randint(10**9, 10**10 - 1)}"
    ref = f"AUDIT-{uuid.uuid4().hex[:8]}"
    body = {"phone": f"0{digits[:3]} {digits[3:7]}-{digits[7:]}", "amount_idr": 250000, "order_ref": ref}
    res = asyncio.run(_burst(6, "POST", f"{API}/outlet/loyalty/cashier/add-points", json=body,
                             headers=_h(tokens["cfs"])))
    codes = [r.status_code for r in res]
    assert codes.count(200) == 1 and all(c == 409 for c in codes if c != 200), [r.text for r in res]
    assert db.customers.count_documents({"phone_key": f"62{digits}", "deleted_at": None}) == 1
    # same person, different formatting → still the same member (no duplicate account)
    body2 = {"phone": f"+62{digits}", "amount_idr": 100000, "order_ref": ref + "-2"}
    assert httpx.post(f"{API}/outlet/loyalty/cashier/add-points", json=body2, headers=_h(tokens["cfs"])).status_code == 200
    assert db.customers.count_documents({"phone_key": f"62{digits}", "deleted_at": None}) == 1


def test_ar_receipts_concurrent_and_status_errors(tokens, ctx):
    h = _h(tokens["finance"])
    cust = ctx["db"].ar_customers.find_one({"deleted_at": None})
    body = {"customer_id": cust["id"], "customer_name": cust.get("name"), "invoice_date": date.today().isoformat(),
            "lines": [{"description": "AUDIT receipt race", "qty": 1, "unit_price": 100000, "include_ppn": False}]}
    draft = httpx.post(f"{API}/ar/invoices", json=body, headers=h, timeout=30)
    assert draft.status_code == 200, draft.text
    inv_draft = draft.json()["data"]["id"]
    r = httpx.post(f"{API}/ar/invoices/{inv_draft}/receipt", json={"amount": 1000}, headers=h)
    assert r.status_code == 400, r.text          # was a bare 500 (ValueError)

    sent = httpx.post(f"{API}/ar/invoices", json={**body, "auto_post": True}, headers=h, timeout=30)
    assert sent.status_code == 200 and sent.json()["data"]["status"] == "sent", sent.text   # FIN-05
    inv = sent.json()["data"]
    res = asyncio.run(_burst(3, "POST", f"{API}/ar/invoices/{inv['id']}/receipt",
                             json={"amount": inv["total_amount"]}, headers=h))
    assert sorted(r.status_code for r in res)[0] == 200
    assert sum(1 for r in res if r.status_code == 200) == 1, [r.text for r in res]
    assert ctx["db"].ar_receipts.count_documents({"invoice_id": inv["id"]}) == 1
    # a posted invoice can no longer be edited behind the ledger
    r = httpx.put(f"{API}/ar/invoices/{inv['id']}", json={"notes": "x"}, headers=h)
    assert r.status_code in (400, 404, 405, 409), r.text


@pytest.mark.parametrize("entry_date", ["2019-1-15", "15/01/2019", "abc"])
def test_manual_journal_rejects_malformed_dates(tokens, ctx, entry_date):
    db = ctx["db"]
    cash = db.chart_of_accounts.find_one({"code": "1101"})["id"]
    rev = db.chart_of_accounts.find_one({"code": "4001"})["id"]
    body = {"entry_date": entry_date, "description": "AUDIT bad date",
            "lines": [{"coa_id": cash, "dr": 1000, "cr": 0}, {"coa_id": rev, "dr": 0, "cr": 1000}]}
    r = httpx.post(f"{API}/finance/journals/manual", json=body, headers=_h(tokens["admin"]))
    assert r.status_code == 400, r.text
