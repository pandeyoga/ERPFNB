"""Konteks Group / Brand / Toko (docs/audit/OUTLET_SCOPE_ANALYSIS_2026-10-29.md).

- GL dipotong per brand = jumlah per toko brand itu (seed: The Coffeeshop punya 3 toko).
- Group = brand + transaksi pusat; transaksi pusat bisa dilihat sendiri (Journals `unallocated`).
- User finance yang dibatasi ke 1 toko tidak bisa melihat konsolidasi / toko lain / jurnal pusat, juga lewat detail.
- `brand_id` memotong endpoint yang memakai resolve_outlet_filter (mis. stok) tanpa parameter tambahan.
"""
import time

import pytest

from services._finance.scope import LedgerScope

from .conftest import _login, api_get, api_post

PERIOD = time.strftime("%Y-%m")


# ---------- unit: LedgerScope ----------
def test_line_rules():
    s = LedgerScope(outlet_ids=["o1"], brand_ids=["b1"], unallocated=False)
    assert s.has_line({}, {"dim_outlet": "o1"})
    assert not s.has_line({}, {"dim_outlet": "o2"})
    assert s.has_line({"outlet_id": "o1"}, {})  # manual JE: toko di header
    assert s.has_line({}, {"dim_brand": "b1"})  # tingkat brand, tanpa toko
    assert not s.has_line({}, {})  # pusat
    assert LedgerScope(outlet_ids=[], unallocated=True).has_line({}, {})
    assert LedgerScope().line_match() == {}
    assert LedgerScope(outlet_ids=[], unallocated=False).line_match() == {"$expr": {"$eq": [1, 0]}}


# ---------- integration ----------
@pytest.fixture(scope="module")
def hierarchy(http_client, admin_token):
    brands = api_get(http_client, "/master/brands?per_page=100", admin_token).json()["data"]
    outlets = api_get(http_client, "/master/outlets?per_page=100", admin_token).json()["data"]
    by_brand = {b["id"]: [o["id"] for o in outlets if o.get("brand_id") == b["id"]] for b in brands}
    multi = next(b for b, ids in by_brand.items() if len(ids) >= 2)
    return {"by_brand": by_brand, "multi": multi, "outlets": outlets}


def _pl(client, token, **params):
    q = "&".join(f"{k}={v}" for k, v in params.items())
    r = api_get(client, f"/finance/profit-loss?period={PERIOD}&compare_prev=false&{q}", token)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def test_brand_equals_sum_of_its_stores(http_client, admin_token, hierarchy):
    brand = hierarchy["multi"]
    pl_brand = _pl(http_client, admin_token, brand_id=brand)
    assert pl_brand["scope"] == "brand"
    per_store = [_pl(http_client, admin_token, outlet_id=o) for o in hierarchy["by_brand"][brand]]
    assert all(p["scope"] == "outlet" for p in per_store)
    assert pl_brand["net_income"] == pytest.approx(sum(p["net_income"] for p in per_store), abs=0.01)


def test_group_includes_pusat(http_client, admin_token, hierarchy):
    group = _pl(http_client, admin_token)
    assert group["scope"] == "group"
    brands = sum(_pl(http_client, admin_token, brand_id=b)["net_income"] for b in hierarchy["by_brand"])
    pusat = api_get(http_client, f"/finance/journals?unallocated=true&per_page=5", admin_token).json()
    assert pusat["meta"]["total"] > 0, "seed punya jurnal pusat (AR, payroll, payment run)"
    # Group = Σ brand + pusat; pusat bukan nol di seed, jadi konsolidasi ≠ jumlah brand saja.
    assert group["net_income"] != pytest.approx(brands)


def test_outlet_outside_brand_is_empty(http_client, admin_token, hierarchy):
    other = next(o for b, ids in hierarchy["by_brand"].items() if b != hierarchy["multi"] for o in ids)
    pl = _pl(http_client, admin_token, brand_id=hierarchy["multi"], outlet_id=other)
    assert pl["net_income"] == 0


def test_brand_id_narrows_outlet_filtered_endpoints(http_client, admin_token, hierarchy):
    brand = hierarchy["multi"]
    rows = api_get(http_client, f"/inventory/balance?brand_id={brand}&per_page=500", admin_token).json()["data"]
    assert rows and {r["outlet_id"] for r in rows} <= set(hierarchy["by_brand"][brand])


@pytest.fixture(scope="module")
def single_store_finance(http_client, admin_token, hierarchy):
    roles = api_get(http_client, "/admin/roles", admin_token).json()["data"]
    role = next(r for r in roles if r["code"] == "FINANCE_MANAGER")
    store = hierarchy["by_brand"][hierarchy["multi"]][0]
    email = f"scope.fin.{int(time.time())}@fnbgroup.id"
    r = api_post(http_client, "/admin/users", admin_token, json={
        "email": email, "full_name": "Scope Test Finance", "password": "Demo@2026!x",
        "role_ids": [role["id"]], "outlet_ids": [store], "brand_ids": [hierarchy["multi"]],
    })
    assert r.status_code == 200, r.text
    token = _login(http_client, email, "Demo@2026!x")
    assert token
    return {"token": token, "store": store}


def test_restricted_user_never_sees_more_than_own_store(http_client, admin_token, hierarchy, single_store_finance):
    tok, store = single_store_finance["token"], single_store_finance["store"]
    mine = _pl(http_client, tok)
    assert mine["scope"] == "mine"
    assert mine["net_income"] == pytest.approx(_pl(http_client, admin_token, outlet_id=store)["net_income"], abs=0.01)
    # brand → hanya tokonya; toko lain → kosong
    assert _pl(http_client, tok, brand_id=hierarchy["multi"])["net_income"] == pytest.approx(mine["net_income"], abs=0.01)
    other = next(o for o in hierarchy["by_brand"][hierarchy["multi"]] if o != store)
    assert _pl(http_client, tok, outlet_id=other)["net_income"] == 0
    # jurnal pusat tidak terlihat, juga lewat detail
    assert api_get(http_client, "/finance/journals?unallocated=true", tok).json()["meta"]["total"] == 0
    pusat_je = api_get(http_client, "/finance/journals?unallocated=true&per_page=1", admin_token).json()["data"][0]
    assert api_get(http_client, f"/finance/journals/{pusat_je['id']}", tok).status_code == 404


# ---------- konteks brand di endpoint daftar (GET dari frontend membawa brand_id + brand_ids) ----------
LIST_ENDPOINTS = [
    "/inventory/low-stock", "/inventory/balance", "/procurement/prs", "/procurement/pos", "/procurement/grs",
    "/hr/service-charges", "/hr/advances", "/anomalies", "/outlet/daily-sales", "/outlet/petty-cash",
    "/finance/validation-queue", "/outlet-budget/increase-requests", "/reservations",
]


def test_workboard_cards_stay_inside_brand(http_client, admin_token, hierarchy):
    brand = hierarchy["multi"]
    d = api_get(http_client, f"/procurement/workboard?brand_id={brand}&brand_ids={brand}", admin_token).json()["data"]
    cards = [c for col in d["cards"].values() for c in col]  # {kolom: [kartu]}
    outlets = {c.get("outlet_id") for c in cards if c.get("outlet_id")}
    assert cards and outlets <= set(hierarchy["by_brand"][brand]), outlets


def _rows(payload):
    d = payload.get("data")
    if isinstance(d, list):
        return d
    if isinstance(d, dict):
        for k in ("items", "rows", "data", "events", "requests"):
            if isinstance(d.get(k), list):
                return d[k]
    return []


@pytest.mark.parametrize("path", LIST_ENDPOINTS)
def test_list_endpoints_stay_inside_brand(http_client, admin_token, hierarchy, path):
    brand = hierarchy["multi"]
    r = api_get(http_client, f"{path}?brand_id={brand}&brand_ids={brand}&per_page=100", admin_token)
    assert r.status_code == 200, r.text
    outlets = {row.get("outlet_id") for row in _rows(r.json()) if isinstance(row, dict) and row.get("outlet_id")}
    assert outlets <= set(hierarchy["by_brand"][brand]), f"{path}: toko di luar brand {outlets - set(hierarchy['by_brand'][brand])}"


def test_transfers_in_brand_touch_its_stores(http_client, admin_token, hierarchy):
    brand = hierarchy["multi"]
    stores = set(hierarchy["by_brand"][brand])
    rows = api_get(http_client, f"/inventory/transfers?brand_id={brand}&per_page=100", admin_token).json()["data"]
    assert all(t.get("from_outlet_id") in stores or t.get("to_outlet_id") in stores for t in rows)
