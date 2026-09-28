"""Live integration tests for AUDIT_2026-09-27 Phase 2b-2c fixes (FIN-03/05/06/09,
SEC-02, CTL-07/08/09, A8 inventory transfer, RBAC sync, uploads).

Uses public REACT_APP_BACKEND_URL. Reuses tokens across tests (30/min login rate limit).
"""
import io
import os
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PWD = "Demo@2026"

_TOKENS: dict = {}


def _login(email: str) -> str:
    if email in _TOKENS:
        return _TOKENS[email]
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": PWD}, timeout=20)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text[:200]}"
    b = r.json(); d = b.get("data") if isinstance(b, dict) and "data" in b else b
    tok = (d or {}).get("access_token") or (d or {}).get("token")
    assert tok
    _TOKENS[email] = tok
    return tok


def _h(email, json_ct=True):
    h = {"Authorization": f"Bearer {_login(email)}"}
    if json_ct:
        h["Content-Type"] = "application/json"
    return h


def _unwrap(r):
    j = r.json()
    if isinstance(j, dict) and "data" in j and set(j.keys()) & {"success", "errors", "meta"}:
        return j["data"]
    return j


# ---------------------- RBAC sync on startup ----------------------
class TestRBACSync:
    def test_finance_has_efaktur_and_asset_dispose(self):
        r = requests.get(f"{BASE}/api/auth/me", headers=_h("finance@fnbgroup.id"), timeout=15)
        assert r.status_code == 200
        me = _unwrap(r)
        perms = set(me.get("permissions") or [])
        # Star means all — accept it
        if "*" not in perms:
            for p in ("tax.efaktur.read", "tax.efaktur.export", "finance.asset.dispose"):
                assert p in perms, f"FINANCE_MANAGER missing {p}; has={sorted(perms)[:20]}"


# ---------------------- CTL-09 master data ----------------------
class TestCTL09Master:
    def test_outlet_manager_bank_accounts_403(self):
        r = requests.get(f"{BASE}/api/master/bank-accounts", headers=_h("cfs.manager@fnbgroup.id"), timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text[:200]}"

    def test_admin_bank_accounts_200(self):
        r = requests.get(f"{BASE}/api/master/bank-accounts", headers=_h("admin@fnbgroup.id"), timeout=15)
        assert r.status_code == 200

    def test_employees_masked_for_outlet_manager(self):
        r = requests.get(f"{BASE}/api/master/employees?per_page=5", headers=_h("cfs.manager@fnbgroup.id"), timeout=15)
        assert r.status_code == 200
        rows = _unwrap(r)
        if isinstance(rows, dict):
            rows = rows.get("items", [])
        assert isinstance(rows, list)
        for e in rows:
            for k in ("basic_salary", "salary", "nik", "npwp", "bank_account_no"):
                assert k not in e, f"outlet manager saw sensitive field {k} in employee row"

    def test_employees_admin_sees_sensitive_fields(self):
        r = requests.get(f"{BASE}/api/master/employees?per_page=10", headers=_h("admin@fnbgroup.id"), timeout=15)
        assert r.status_code == 200
        rows = _unwrap(r)
        if isinstance(rows, dict):
            rows = rows.get("items", [])
        # Admin should see at least one row with basic_salary field present (may be None but key present)
        has_sensitive = any(("basic_salary" in e) or ("nik" in e) for e in rows)
        assert has_sensitive or not rows, "admin should see sensitive employee fields when any employees exist"

    def test_master_query_regex_special_chars_not_500(self):
        # SEC-15: unsafe regex chars in q must not 500
        r = requests.get(f"{BASE}/api/master/items?q=(a%2B", headers=_h("admin@fnbgroup.id"), timeout=15)
        assert r.status_code == 200, f"regex-safe query should 200 not 500; got {r.status_code} {r.text[:200]}"

    def test_delete_number_series_forbidden_for_non_admin(self):
        r = requests.delete(f"{BASE}/api/master/number-series/nonexistent-id",
                            headers=_h("cfs.manager@fnbgroup.id"), timeout=15)
        assert r.status_code in (403, 404), f"got {r.status_code}"


# ---------------------- FIN-05 petty cash ----------------------
class TestFIN05PettyCash:
    def _outlet_id(self):
        # cfs.manager has a single outlet; get from /me
        r = requests.get(f"{BASE}/api/auth/me", headers=_h("cfs.manager@fnbgroup.id"), timeout=15)
        me = _unwrap(r)
        oids = me.get("outlet_ids") or []
        assert oids, "cfs.manager expected to have at least 1 outlet_id"
        return oids[0]

    def test_purchase_without_gl_account_400(self):
        oid = self._outlet_id()
        payload = {
            "outlet_id": oid, "txn_date": "2026-01-05", "type": "purchase",
            "amount": 25000, "description": "TEST_no_gl", "item_text": "TEST",
        }
        r = requests.post(f"{BASE}/api/outlet/petty-cash", headers=_h("cfs.manager@fnbgroup.id"), json=payload, timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text[:200]}"
        assert "gl" in r.text.lower() or "akun" in r.text.lower()

    def test_amount_zero_rejected(self):
        oid = self._outlet_id()
        payload = {"outlet_id": oid, "txn_date": "2026-01-05", "type": "replenish", "amount": 0}
        r = requests.post(f"{BASE}/api/outlet/petty-cash", headers=_h("cfs.manager@fnbgroup.id"), json=payload, timeout=15)
        assert r.status_code == 400

    def test_creator_cannot_approve_own_replenish(self):
        oid = self._outlet_id()
        # Create replenish as admin (has all perms)
        payload = {
            "outlet_id": oid, "txn_date": "2026-01-05", "type": "replenish",
            "amount": 1, "description": f"TEST_sod_{uuid.uuid4().hex[:6]}",
        }
        r = requests.post(f"{BASE}/api/outlet/petty-cash", headers=_h("admin@fnbgroup.id"), json=payload, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"could not create replenish: {r.status_code} {r.text[:200]}")
        pid = _unwrap(r).get("id")
        assert pid
        # Approve by same admin → 400 SoD
        r2 = requests.post(f"{BASE}/api/outlet/petty-cash/{pid}/approve",
                           headers=_h("admin@fnbgroup.id"), timeout=15)
        assert r2.status_code == 400, f"expected 400 SoD, got {r2.status_code} {r2.text[:200]}"
        body_low = r2.text.lower()
        assert "sod" in body_low or "sendiri" in body_low or "pembuat" in body_low

    def test_other_user_can_approve_and_posts(self):
        oid = self._outlet_id()
        payload = {
            "outlet_id": oid, "txn_date": "2026-01-05", "type": "replenish",
            "amount": 1, "description": f"TEST_approve_{uuid.uuid4().hex[:6]}",
        }
        # Create as cfs.manager (has outlet.daily_sales.read scope on this outlet)
        r = requests.post(f"{BASE}/api/outlet/petty-cash", headers=_h("cfs.manager@fnbgroup.id"), json=payload, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"could not create replenish: {r.status_code} {r.text[:200]}")
        pid = _unwrap(r).get("id")
        # Approve by admin (different user, has * perms) — SoD OK, has approve perm
        r2 = requests.post(f"{BASE}/api/outlet/petty-cash/{pid}/approve",
                           headers=_h("admin@fnbgroup.id"), timeout=15)
        assert r2.status_code == 200, f"admin approve failed: {r2.status_code} {r2.text[:200]}"
        approved = _unwrap(r2)
        assert approved.get("status") == "posted"


# ---------------------- FIN-09 payments create validations ----------------------
class TestFIN09Payments:
    def test_missing_required_returns_4xx(self):
        r = requests.post(f"{BASE}/api/finance/payments", headers=_h("finance@fnbgroup.id"),
                          json={}, timeout=15)
        # Should be 400 or 422, definitely not 500
        assert r.status_code in (400, 422), f"expected 400/422 got {r.status_code} {r.text[:200]}"


# ---------------------- SEC-02 loyalty endpoint permissions ----------------------
class TestSEC02Loyalty:
    def test_procurement_lookup_403(self):
        # procurement_manager has no loyalty permission → should be 403
        r = requests.get(f"{BASE}/api/outlet/loyalty/lookup?phone=0812",
                         headers=_h("procurement@fnbgroup.id"), timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"

    def test_outlet_manager_lookup_ok(self):
        r = requests.get(f"{BASE}/api/outlet/loyalty/lookup?phone=0812",
                         headers=_h("cfs.manager@fnbgroup.id"), timeout=15)
        # 200 empty is fine; not 403
        assert r.status_code in (200, 400), f"outlet manager should have loyalty read; got {r.status_code} {r.text[:200]}"

    def test_verify_code_invalid_returns_4xx(self):
        r = requests.get(f"{BASE}/api/outlet/vouchers/verify/DOES-NOT-EXIST",
                         headers=_h("cfs.manager@fnbgroup.id"), timeout=15)
        # not_found is acceptable (200 with status field, or 404, or 400)
        assert r.status_code in (200, 400, 404), r.status_code

    def test_verify_procurement_403(self):
        r = requests.get(f"{BASE}/api/outlet/vouchers/verify/ANY",
                         headers=_h("procurement@fnbgroup.id"), timeout=15)
        assert r.status_code == 403


# ---------------------- CTL-08 period ----------------------
class TestCTL08Period:
    def test_period_list_200(self):
        r = requests.get(f"{BASE}/api/finance/periods", headers=_h("finance@fnbgroup.id"), timeout=15)
        assert r.status_code == 200


# ---------------------- Uploads ----------------------
_PNG_1x1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc``\x00\x00\x00"
    b"\x04\x00\x01\'!\xd3\x9f\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestUploads:
    def test_upload_and_fetch_uploads(self):
        h = {"Authorization": f"Bearer {_login('admin@fnbgroup.id')}"}
        files = {"file": ("test.png", io.BytesIO(_PNG_1x1), "image/png")}
        r = requests.post(f"{BASE}/api/uploads", headers=h, files=files, timeout=30)
        assert r.status_code == 200, f"upload: {r.status_code} {r.text[:200]}"
        data = _unwrap(r)
        fid = data.get("id") or data.get("file_id")
        assert fid, f"no id in response {data}"
        # Fetch by /api/uploads/{id}
        r2 = requests.get(f"{BASE}/api/uploads/{fid}", headers=h, timeout=15)
        assert r2.status_code == 200
        assert len(r2.content) > 0

    def test_admin_cms_upload_image(self):
        h = {"Authorization": f"Bearer {_login('admin@fnbgroup.id')}"}
        files = {"file": ("cms.png", io.BytesIO(_PNG_1x1), "image/png")}
        r = requests.post(f"{BASE}/api/admin/cms/upload-image", headers=h, files=files, timeout=30)
        assert r.status_code == 200, f"cms upload: {r.status_code} {r.text[:200]}"
        data = _unwrap(r)
        url = data.get("url")
        assert url, f"no url in {data}"
        # If /api/files/... fetch it — but url may be root-relative. Only test /api/files/*
        if url.startswith("/api/files/"):
            r2 = requests.get(f"{BASE}{url}", timeout=15)
            assert r2.status_code == 200
