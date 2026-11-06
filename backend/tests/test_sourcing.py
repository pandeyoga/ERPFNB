"""Sourcing — harga acuan per periode & wilayah, penawaran supplier, analisis, dan izin.

Desain: docs/audit/MARKET_PRICE_SOURCING_ANALYSIS_2026-11-05.md. DB demo dipulihkan oleh snapshot di conftest.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from pymongo import MongoClient

from services.sourcing_service import period_bounds, supplier_score

from .conftest import _load_backend_env, api_get, api_post


def _ok(r):
    j = r.json()
    assert r.status_code == 200 and j.get("success") is True, f"{r.request.method} {r.request.url} → {r.status_code} {r.text[:300]}"
    return j.get("data")


def _denied(r):
    assert r.status_code in (401, 403), f"seharusnya ditolak: {r.status_code} {r.text[:200]}"


# ---------- unit ----------
def test_period_bounds():
    d = date(2026, 11, 5)  # Kamis
    k, _, s, e = period_bounds("weekly", d)
    assert (s, e) == (date(2026, 11, 2), date(2026, 11, 8)) and k == "2026-W45"
    k, lbl, s, e = period_bounds("monthly", d)
    assert (s, e, k, lbl) == (date(2026, 11, 1), date(2026, 11, 30), "2026-11", "Nov 2026")
    k, lbl, s, e = period_bounds("quarterly", d)
    assert (s, e, k, lbl) == (date(2026, 10, 1), date(2026, 12, 31), "2026-Q4", "Q4-2026")
    assert period_bounds("quarterly", date(2026, 12, 31))[0] == "2026-Q4"
    assert period_bounds("monthly", date(2026, 2, 10))[3] == date(2026, 2, 28)


def test_supplier_score_reweights_missing_components():
    # tanpa data on-time / reject: bobot dibagi ulang, bukan dihitung 0
    s = supplier_score(price=100, best_price=100, fill_rate=100, on_time=None, reject_rate=None)
    assert s == 100
    assert supplier_score(price=None, best_price=None, fill_rate=None, on_time=None, reject_rate=None) is None
    # 10% di atas termurah menurunkan komponen harga ke 80
    assert supplier_score(price=110, best_price=100, fill_rate=None, on_time=None, reject_rate=None) == 80


# ---------- live ----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup():
    """Snapshot/restore DB di conftest butuh mongodump; tanpa itu tes ini menghapus datanya sendiri."""
    env = _load_backend_env()
    db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
    start = datetime.now(timezone.utc).isoformat()
    settings = db.system_settings.find_one({"key": "sourcing"})
    yield
    db.supplier_prices.delete_many({"created_at": {"$gte": start}})
    db.market_list_prices.delete_many({"created_at": {"$gte": start}})
    used = set(db.market_list_prices.distinct("period_id"))
    db.price_periods.delete_many({"created_at": {"$gte": start}, "id": {"$nin": list(used)}})
    reg = [r["id"] for r in db.regions.find({"name": "Wilayah Uji"})]
    db.outlets.update_many({"region_id": {"$in": reg}}, {"$set": {"region_id": None}})
    db.regions.delete_many({"id": {"$in": reg}})
    db.rfqs.delete_many({"title": "QA Sourcing RFQ"})
    if settings:
        db.system_settings.replace_one({"key": "sourcing"}, settings)
    else:
        db.system_settings.delete_one({"key": "sourcing"})


@pytest.fixture(scope="module")
def ctx(http_client, tokens):
    for k in ("admin", "procurement", "alt_manager"):
        if k not in tokens:
            pytest.skip(f"butuh token {k}")
    c, t = http_client, tokens
    items = _ok(api_get(c, "/master/items?per_page=50", t["admin"]))
    items = items if isinstance(items, list) else items.get("items", [])
    item = next(i for i in items if (i.get("unit_default") or "").lower() == "kg")
    vendors = _ok(api_get(c, "/master/vendors?per_page=10", t["admin"]))
    vendors = vendors if isinstance(vendors, list) else vendors.get("items", [])
    region = _ok(api_post(c, "/master/regions", t["admin"], json={
        "code": f"RG{uuid.uuid4().hex[:5].upper()}", "name": "Wilayah Uji", "active": True}))
    return {"c": c, "t": t, "item": item, "vendors": vendors, "region": region}


def test_benchmark_unit_region_and_period(ctx):
    c, t, item, region = ctx["c"], ctx["t"], ctx["item"], ctx["region"]
    # acuan semua wilayah (satuan kg) & khusus wilayah uji, periode bulanan berjalan
    a = _ok(api_post(c, "/sourcing/benchmarks", t["procurement"], json={
        "item_id": item["id"], "unit": item["unit_default"], "price": 50000, "period_type": "monthly", "source": "survey"}))
    assert a["period_type"] == "monthly" and a["region_id"] is None
    _ok(api_post(c, "/sourcing/benchmarks", t["procurement"], json={
        "item_id": item["id"], "unit": item["unit_default"], "price": 55000, "period_type": "monthly",
        "region_id": region["id"], "source": "manual"}))
    # satuan lain tidak bercampur
    _ok(api_post(c, "/sourcing/benchmarks", t["procurement"], json={
        "item_id": item["id"], "unit": "gram", "price": 60, "period_type": "monthly"}))
    ws = _ok(api_get(c, f"/sourcing/benchmarks/worksheet?period_type=monthly&region_id={region['id']}", t["procurement"]))
    row = next(r for r in ws["rows"] if r["item_id"] == item["id"])
    assert row["price"] == 55000
    ws_all = _ok(api_get(c, "/sourcing/benchmarks/worksheet?period_type=monthly", t["procurement"]))
    assert next(r for r in ws_all["rows"] if r["item_id"] == item["id"])["price"] == 50000
    # harga ≤ 0 ditolak
    r = api_post(c, "/sourcing/benchmarks", t["procurement"], json={"item_id": item["id"], "unit": "kg", "price": 0})
    assert r.status_code in (400, 422)


def test_offers_crud_validation_and_overview(ctx):
    c, t, item, vendors = ctx["c"], ctx["t"], ctx["item"], ctx["vendors"]
    today = date.today()
    cheap = _ok(api_post(c, "/sourcing/offers", t["procurement"], json={
        "vendor_id": vendors[0]["id"], "item_id": item["id"], "unit": item["unit_default"], "price": 1,
        "min_order_qty": 5, "lead_time_days": 1, "valid_from": today.isoformat(),
        "valid_to": (today + timedelta(days=3)).isoformat(), "source": "contract"}))
    assert cheap["status"] == "valid" and cheap["vendor_name"] == vendors[0]["name"]
    # masa berlaku terbalik ditolak; harga 0 ditolak
    bad = api_post(c, "/sourcing/offers", t["procurement"], json={
        "vendor_id": vendors[0]["id"], "item_id": item["id"], "price": 10, "valid_from": today.isoformat(),
        "valid_to": (today - timedelta(days=1)).isoformat()})
    assert bad.status_code in (400, 422)
    assert api_post(c, "/sourcing/offers", t["procurement"], json={
        "vendor_id": vendors[0]["id"], "item_id": item["id"], "price": 0}).status_code in (400, 422)
    # penawaran kedaluwarsa tidak dihitung berlaku
    _ok(api_post(c, "/sourcing/offers", t["procurement"], json={
        "vendor_id": vendors[1]["id"], "item_id": item["id"], "unit": item["unit_default"], "price": 500,
        "valid_from": (today - timedelta(days=30)).isoformat(), "valid_to": (today - timedelta(days=1)).isoformat()}))

    ov = _ok(api_get(c, f"/sourcing/overview?search={item['name']}", t["procurement"]))
    row = next(r for r in ov["rows"] if r["item_id"] == item["id"])
    assert row["best_offer"] == 1 and row["best_offer_vendor_id"] == vendors[0]["id"]
    assert row["benchmark"] == 50000
    assert "offer_expiring" in row["flags"]  # habis dalam 3 hari ≤ expiring_days (7)
    if row["spend"] > 0:  # riwayat GR harga > 1 → potensi hemat bila beli di penawaran termurah
        assert row["potential_saving"] > 0 and "saving" in row["flags"]

    det = _ok(api_get(c, f"/sourcing/items/{item['id']}", t["procurement"]))
    assert det["summary"]["best_offer"] == 1
    sup = next(s for s in det["suppliers"] if s["vendor_id"] == vendors[0]["id"])
    assert sup["offer_price"] == 1 and sup["offer_moq"] == 5
    assert any(o["status"] == "expired" for o in det["offers"])

    valid = _ok(api_get(c, f"/sourcing/offers?item_id={item['id']}&status=valid", t["procurement"]))
    assert all(o["status"] == "valid" for o in valid)
    _ok(c.delete(f"/sourcing/offers/{cheap['id']}", headers={"Authorization": f"Bearer {t['procurement']}"}))
    assert cheap["id"] not in {o["id"] for o in _ok(api_get(c, f"/sourcing/offers?item_id={item['id']}", t["procurement"]))}


def test_rfq_quote_becomes_offer(ctx):
    c, t, item, vendors = ctx["c"], ctx["t"], ctx["item"], ctx["vendors"]
    rfq = _ok(api_post(c, "/rfq", t["procurement"], json={
        "title": "QA Sourcing RFQ", "items": [{"item_id": item["id"], "item_name": item["name"], "qty": 5, "uom": item["unit_default"]}],
        "vendor_ids": [vendors[2]["id"]], "deadline": (date.today() + timedelta(days=5)).isoformat()}))
    rid = rfq["id"]
    _ok(api_post(c, f"/rfq/{rid}/quotes/{vendors[2]['id']}", t["procurement"], json={
        "lines": [{"item_id": item["id"], "unit_price": 777, "moq": 2, "lead_time_days": 2,
                   "validity_date": (date.today() + timedelta(days=14)).isoformat()}]}))
    offers = _ok(api_get(c, f"/sourcing/offers?item_id={item['id']}&vendor_id={vendors[2]['id']}", t["procurement"]))
    o = next(o for o in offers if o["source"] == "rfq" and o["source_ref"] == rfq["rfq_no"])
    assert o["price"] == 777 and o["lead_time_days"] == 2 and o["unit"] == item["unit_default"]
    # penawaran ulang supplier yang sama di RFQ yang sama menggantikan, bukan menambah
    _ok(api_post(c, f"/rfq/{rid}/quotes/{vendors[2]['id']}", t["procurement"], json={
        "lines": [{"item_id": item["id"], "unit_price": 700}]}))
    offers = _ok(api_get(c, f"/sourcing/offers?item_id={item['id']}&vendor_id={vendors[2]['id']}", t["procurement"]))
    mine = [o for o in offers if o["source"] == "rfq" and o["source_ref"] == rfq["rfq_no"]]
    assert len(mine) == 1 and mine[0]["price"] == 700


def test_ref_price_endpoint_uses_unit_and_region(ctx):
    c, t, item, region = ctx["c"], ctx["t"], ctx["item"], ctx["region"]
    r = _ok(api_get(c, f"/market-list/items/{item['id']}/ref-price", t["procurement"]))
    assert r and r["ref_price"] == 50000 and (r["unit"] or "").lower() == "kg"
    # toko di wilayah uji memakai acuan wilayahnya
    outlets = _ok(api_get(c, "/master/outlets?per_page=50", t["admin"]))
    outlets = outlets if isinstance(outlets, list) else outlets.get("items", [])
    o = outlets[0]
    _ok(c.patch(f"/master/outlets/{o['id']}", json={"region_id": region["id"]}, headers={"Authorization": f"Bearer {t['admin']}"}))
    r2 = _ok(api_get(c, f"/market-list/items/{item['id']}/ref-price?outlet_id={o['id']}", t["procurement"]))
    assert r2["ref_price"] == 55000
    bulk = _ok(api_get(c, f"/market-list/ref-prices/bulk?item_ids={item['id']}&outlet_id={o['id']}", t["procurement"]))
    assert bulk[item["id"]]["ref_price"] == 55000
    _ok(c.patch(f"/master/outlets/{o['id']}", json={"region_id": None}, headers={"Authorization": f"Bearer {t['admin']}"}))


def test_settings_and_permissions(ctx):
    c, t, item, vendors = ctx["c"], ctx["t"], ctx["item"], ctx["vendors"]
    s = _ok(c.put("/sourcing/settings", json={"default_period_type": "weekly", "alert_pct": 15},
                  headers={"Authorization": f"Bearer {t['procurement']}"}))
    assert s["default_period_type"] == "weekly" and s["alert_pct"] == 15
    assert c.put("/sourcing/settings", json={"default_period_type": "daily"},
                 headers={"Authorization": f"Bearer {t['procurement']}"}).status_code in (400, 422)
    _ok(c.put("/sourcing/settings", json={"default_period_type": "monthly", "alert_pct": 10},
              headers={"Authorization": f"Bearer {t['procurement']}"}))
    # Outlet Manager: tidak bisa membaca sourcing, menetapkan acuan lewat API sourcing, atau mengelola penawaran
    m = t["alt_manager"]
    _denied(api_get(c, "/sourcing/overview", m))
    _denied(api_post(c, "/sourcing/offers", m, json={"vendor_id": vendors[0]["id"], "item_id": item["id"], "price": 1}))
    _denied(c.put("/sourcing/settings", json={"alert_pct": 1}, headers={"Authorization": f"Bearer {m}"}))
    # menandai item vendor tidak tersedia = aksi tulis (dulu cukup procurement.view)
    _denied(api_post(c, f"/vendor-items/vendor/{vendors[0]['id']}/item/{item['id']}/unavailable", m, json={}))
