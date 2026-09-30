"""Iteration 16 backend regression: FE-06 cookie auth, CTL-15 dropdown fetchAll, DUP-14 daily close, DUP-12 market list, loyalty cookie."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://outlet-salary-mgmt.preview.emergentagent.com").rstrip("/")

ADMIN = ("admin@fnbgroup.id", "Demo@2026")
LOYALTY = ("qa.cookie@example.com", "Qa@12345")


def _data(resp):
    """Unwrap {success,data,errors,meta} envelope; return data (fallback whole body)."""
    try:
        body = resp.json()
    except Exception:
        return None
    if isinstance(body, dict) and "data" in body and "success" in body:
        return body.get("data")
    return body


# ---------- FE-06 staff cookie session ----------

class TestFE06StaffCookies:
    def test_login_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        assert r.status_code == 200, r.text
        cookies = {c.name: c for c in s.cookies}
        assert "aurora_at" in cookies, f"missing aurora_at cookie; got {list(cookies)}"
        assert "aurora_rt" in cookies, f"missing aurora_rt cookie; got {list(cookies)}"
        # httpOnly is not visible on requests.Session but we can verify via Set-Cookie header
        set_cookie = r.headers.get("set-cookie", "")
        assert "HttpOnly" in set_cookie, f"cookies not HttpOnly: {set_cookie}"
        # body still has tokens (for API clients)
        body = _data(r) or {}
        assert "access_token" in body and "refresh_token" in body

    def test_me_with_cookie_only(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        # remove authorization header — cookie only
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200, r.text
        assert (_data(r) or {}).get("email") == ADMIN[0]

    def test_refresh_cookie_no_body_tokens(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        r = s.post(f"{BASE_URL}/api/auth/refresh", timeout=15)
        assert r.status_code == 200, r.text
        body = _data(r) or {}
        # cookie-based refresh should NOT return access_token in body
        assert "access_token" not in body, f"body should not contain access_token; got {body}"
        # new cookies should be set
        set_cookie = r.headers.get("set-cookie", "")
        assert "aurora_at" in set_cookie

    def test_bearer_client_still_works(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        token = (_data(r) or {})["access_token"]
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 200
        assert (_data(r2) or {}).get("email") == ADMIN[0]

    def test_csrf_origin_mismatch(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        # cookie-auth POST with foreign Origin → 403
        # use a real POST endpoint (create journal draft)
        r = s.post(
            f"{BASE_URL}/api/finance/journals/manual",
            json={"entry_date": "2026-01-01", "description": "csrf test", "lines": []},
            headers={"Origin": "https://evil.example"},
            timeout=15,
        )
        # 403 CSRF is the expected outcome; 404/405 means path is wrong (not a CSRF test)
        assert r.status_code == 403, f"expected 403 CSRF, got {r.status_code}: {r.text[:200]}"
        assert "CSRF" in r.text.upper() or "ORIGIN" in r.text.upper(), f"body: {r.text[:200]}"

    def test_bearer_ignores_origin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        token = (_data(r) or {})["access_token"]
        r2 = requests.post(
            f"{BASE_URL}/api/finance/journals/manual",
            json={"entry_date": "2026-01-01", "description": "csrf test", "lines": []},
            headers={"Authorization": f"Bearer {token}", "Origin": "https://evil.example"},
            timeout=15,
        )
        # Bearer with foreign Origin should NOT be 403 CSRF
        assert not (r2.status_code == 403 and "CSRF" in r2.text.upper()), f"Bearer should bypass CSRF: {r2.status_code} {r2.text[:200]}"

    def test_logout_clears_cookies(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code in (200, 204)
        # subsequent /me should fail
        r2 = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r2.status_code in (401, 403)


# ---------- Loyalty cookie session ----------

class TestFE06LoyaltyCookies:
    def _login_or_register(self, s):
        r = s.post(f"{BASE_URL}/api/loyalty/login", json={"email": LOYALTY[0], "password": LOYALTY[1]}, timeout=15)
        if r.status_code != 200:
            # try register
            reg = s.post(f"{BASE_URL}/api/loyalty/register", json={
                "email": LOYALTY[0], "password": LOYALTY[1],
                "full_name": "QA Cookie", "phone": "+628111111199"
            }, timeout=15)
            if reg.status_code not in (200, 201):
                pytest.skip(f"cannot login/register loyalty test user: login={r.status_code} reg={reg.status_code} {reg.text[:200]}")
            r = s.post(f"{BASE_URL}/api/loyalty/login", json={"email": LOYALTY[0], "password": LOYALTY[1]}, timeout=15)
        assert r.status_code == 200, r.text
        return r

    def test_loyalty_login_sets_cookie(self):
        s = requests.Session()
        r = self._login_or_register(s)
        set_cookie = r.headers.get("set-cookie", "")
        assert "loyalty_at" in set_cookie, f"loyalty_at cookie missing: {set_cookie}"
        assert "HttpOnly" in set_cookie

    def test_loyalty_me_with_cookie(self):
        s = requests.Session()
        self._login_or_register(s)
        r = s.get(f"{BASE_URL}/api/loyalty/me", timeout=15)
        assert r.status_code == 200, r.text

    def test_loyalty_logout(self):
        s = requests.Session()
        self._login_or_register(s)
        r = s.post(f"{BASE_URL}/api/loyalty/logout", timeout=15)
        assert r.status_code in (200, 204)
        r2 = s.get(f"{BASE_URL}/api/loyalty/me", timeout=15)
        assert r2.status_code in (401, 403)


# ---------- CTL-15: dropdowns pagination sanity ----------

class TestCTL15Dropdowns:
    @pytest.fixture(autouse=True)
    def _auth(self):
        self.s = requests.Session()
        r = self.s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        assert r.status_code == 200

    def test_vendors_list_paginated(self):
        r = self.s.get(f"{BASE_URL}/api/master/vendors?per_page=100", timeout=15)
        assert r.status_code == 200, r.text
        items = _data(r)
        assert isinstance(items, list), f"expected list, got {type(items)}: {str(items)[:200]}"

    def test_coa_list(self):
        r = self.s.get(f"{BASE_URL}/api/master/coa?per_page=500", timeout=15)
        assert r.status_code == 200
        items = _data(r)
        assert isinstance(items, list) and len(items) > 0

    def test_outlets_list(self):
        r = self.s.get(f"{BASE_URL}/api/master/outlets", timeout=15)
        assert r.status_code == 200
        items = _data(r)
        assert isinstance(items, list) and len(items) >= 1


# ---------- DUP-14: daily close blocks new sales ----------

class TestDUP14DailyClose:
    def test_closed_day_blocks_daily_sales(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        assert r.status_code == 200
        # Search for an existing closed day
        # try outlets one by one
        outs = s.get(f"{BASE_URL}/api/master/outlets", timeout=15).json()
        outs = outs.get("items") if isinstance(outs, dict) else outs
        found = None
        for o in (outs or [])[:10]:
            oid = o.get("id") or o.get("_id") or o.get("outlet_id")
            if not oid:
                continue
            r = s.get(f"{BASE_URL}/api/outlet/daily-close?outlet_id={oid}&per_page=10", timeout=15)
            if r.status_code != 200:
                continue
            body = r.json()
            items = body.get("items") if isinstance(body, dict) else body
            for it in (items or []):
                if it.get("status") in ("closed", "active") and not it.get("reopened_at"):
                    found = (oid, it.get("business_date") or it.get("date"))
                    break
            if found:
                break
        if not found:
            pytest.skip("no closed daily_close records found in demo data")
        oid, biz_date = found
        # try to create daily sales for that outlet+date → expect 400 with 'sudah di-close' or similar
        r = s.post(f"{BASE_URL}/api/outlet/daily-sales", json={
            "outlet_id": oid,
            "sales_date": biz_date,
            "revenue_food": 100000,
            "grand_total": 100000,
        }, timeout=15)
        assert r.status_code in (400, 409), f"expected block, got {r.status_code}: {r.text[:200]}"
        assert "close" in r.text.lower() or "closed" in r.text.lower() or "tutup" in r.text.lower()


# ---------- DUP-12: market list Excel export ----------

class TestDUP12MarketList:
    def test_market_list_export(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        assert r.status_code == 200
        r = s.get(f"{BASE_URL}/api/inventory/market-list/export.xlsx", timeout=30)
        if r.status_code == 404:
            # alternate paths
            r = s.get(f"{BASE_URL}/api/inventory/market-list/export", timeout=30)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        ctype = r.headers.get("content-type", "")
        assert "spreadsheet" in ctype or "excel" in ctype or "xlsx" in ctype or r.content[:2] == b"PK", f"unexpected content-type: {ctype}"
        assert len(r.content) > 100
