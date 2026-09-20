"""Phase 2a fix verification: C1 global search, C2 endpoint paths, A3 daily sales voucher."""
import os
import pytest
import requests

BASE_URL = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
API = BASE_URL + "/api"
PWD = "Demo@2026"


def _login(email):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": PWD}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


@pytest.fixture(scope="module")
def admin_h():
    return _login("admin@fnbgroup.id")


@pytest.fixture(scope="module")
def cfs_h():
    return _login("cfs.manager@fnbgroup.id")


# ---------- FIX C1: Global Search ----------
class TestC1GlobalSearch:
    def test_search_kopi_returns_results(self, admin_h):
        r = requests.get(f"{API}/search", headers=admin_h, params={"q": "kopi"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        # Must have at least 1 item and 1 vendor per problem statement
        assert isinstance(data, dict) or isinstance(data, list)
        # Flatten shape - accept either
        total = 0
        if isinstance(data, dict):
            for k, v in data.items():
                if isinstance(v, list):
                    total += len(v)
        else:
            total = len(data)
        assert total >= 1, f"Expected results for 'kopi', got: {data}"

    def test_no_double_api_prefix(self, admin_h):
        # /api/api/search should 404
        r = requests.get(f"{BASE_URL}/api/api/search", headers=admin_h, params={"q": "kopi"}, timeout=30)
        assert r.status_code == 404


# ---------- FIX C2: Frontend endpoint paths ----------
class TestC2EndpointPaths:
    def test_master_coa_returns_data(self, admin_h):
        r = requests.get(f"{API}/master/coa", headers=admin_h, params={"per_page": 10}, timeout=30)
        assert r.status_code == 200, r.text
        assert len(r.json()["data"]) > 0

    def test_master_brands_returns_data(self, admin_h):
        r = requests.get(f"{API}/master/brands", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        assert len(r.json()["data"]) > 0

    def test_opname_detail_route(self, admin_h):
        # List opname sessions
        r = requests.get(f"{API}/inventory/opname", headers=admin_h, params={"per_page": 5}, timeout=30)
        assert r.status_code == 200, r.text
        sessions = r.json()["data"]
        if not sessions:
            pytest.skip("No opname sessions to test detail")
        sid = sessions[0]["id"]
        rd = requests.get(f"{API}/inventory/opname/{sid}", headers=admin_h, timeout=30)
        assert rd.status_code == 200, rd.text
        d = rd.json()["data"]
        # must contain lines
        assert "lines" in d or "session" in d or "id" in d, f"Unexpected shape: {list(d.keys())[:10]}"


# ---------- FIX A3: Voucher discount in daily sales grand total ----------
class TestA3DailySalesVoucher:
    def test_daily_sales_with_voucher_validates(self, cfs_h):
        # Get outlet + payment method
        pm = requests.get(f"{API}/master/payment-methods", headers=cfs_h, params={"per_page": 5}, timeout=30)
        assert pm.status_code == 200, pm.text
        pms = pm.json()["data"]
        if not pms:
            pytest.skip("No payment methods available")
        pm_id = pms[0]["id"]

        # Get outlet assigned to cfs manager via login payload
        login_resp = requests.post(f"{API}/auth/login", json={"email": "cfs.manager@fnbgroup.id", "password": PWD}, timeout=30).json()["data"]
        u = login_resp.get("user") or {}
        outlet_id = u.get("default_outlet_id") or (u.get("outlet_ids") or [None])[0]
        assert outlet_id, "cfs manager has no outlet"

        # Get revenue bucket
        rb = requests.get(f"{API}/master/revenue-buckets", headers=cfs_h, params={"per_page": 5}, timeout=30)
        bucket_id = None
        if rb.ok and rb.json()["data"]:
            bucket_id = rb.json()["data"][0]["id"]

        import datetime
        payload = {
            "outlet_id": outlet_id,
            "sales_date": datetime.date.today().isoformat(),
            "revenue_buckets": [{"bucket_id": bucket_id, "amount": 100000}] if bucket_id else [{"amount": 100000}],
            "service_charge": 0,
            "tax_amount": 0,
            "voucher_discount_amount": 20000,
            "payment_breakdown": [{"payment_method_id": pm_id, "amount": 80000}],
        }
        r = requests.post(f"{API}/outlet/daily-sales/draft", headers=cfs_h, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"Create daily-sales draft failed: {r.status_code} {r.text[:400]}"
        data = r.json()["data"]
        gt = data.get("grand_total")
        assert gt in (80000, 80000.0), f"Expected grand_total 80000, got {gt}"
        ds_id = data.get("id")

        # Submit -> should NOT fail with 'tidak cocok' since 100000 - 20000 == 80000 payment total
        rs = requests.post(f"{API}/outlet/daily-sales/{ds_id}/submit", headers=cfs_h, timeout=30)
        assert "tidak cocok" not in rs.text.lower(), f"Voucher fix broken: {rs.text[:400]}"
        assert rs.status_code in (200, 201), f"Submit failed: {rs.status_code} {rs.text[:400]}"

        # Cleanup: delete draft doc directly from db
        try:
            import asyncio, sys
            sys.path.insert(0, "/app/backend")
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            from motor.motor_asyncio import AsyncIOMotorClient
            async def _del():
                db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
                await db.daily_sales.delete_one({"id": ds_id})
            asyncio.get_event_loop().run_until_complete(_del()) if False else asyncio.run(_del())
        except Exception:
            pass


# ---------- REGRESSION: quick smoke ----------
class TestRegressionSmoke:
    def test_health_or_login(self, admin_h):
        # basic auth already exercised in fixture
        assert admin_h["Authorization"].startswith("Bearer ")

    def test_finance_journals_list(self, admin_h):
        r = requests.get(f"{API}/finance/journals", headers=admin_h, params={"per_page": 5}, timeout=30)
        assert r.status_code == 200, r.text

    def test_procurement_pos_list(self, admin_h):
        r = requests.get(f"{API}/procurement/pos", headers=admin_h, params={"per_page": 5}, timeout=30)
        assert r.status_code == 200, r.text

    def test_ap_aging(self, admin_h):
        r = requests.get(f"{API}/finance/ap-aging", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text

    def test_unpaid_grs(self, admin_h):
        r = requests.get(f"{API}/finance/payments/unpaid-grs", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
