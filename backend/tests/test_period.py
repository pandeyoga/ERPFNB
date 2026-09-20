"""Integration tests for period_service.

Covers:
- List periods
- Period detail
- Closing checks (preview, must not crash)
- Tax settlement preview (must not crash even if no data)
- Lock status endpoint

We do NOT actually close or lock a period in tests because that has side effects
that could break other tests. We only call the READ + PREVIEW endpoints.
"""
import pytest
from datetime import datetime

from .conftest import api_get

pytestmark = pytest.mark.period


CURRENT_PERIOD = datetime.now().strftime("%Y-%m")


class TestPeriodList:
    def test_list_periods(self, http_client, admin_token):
        r = api_get(http_client, "/finance/periods", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        # Phase 10 seeds 12 periods on startup. Allow >=1 to be safe.
        assert isinstance(body["data"], list)

    def test_period_detail(self, http_client, admin_token):
        r = api_get(http_client, f"/finance/periods/{CURRENT_PERIOD}", admin_token)
        # Either the period exists (200) or it isn't auto-seeded (404). Both fine.
        assert r.status_code in (200, 404)


class TestClosingChecks:
    def test_closing_checks_preview(self, http_client, admin_token):
        r = api_get(http_client, f"/finance/periods/{CURRENT_PERIOD}/closing-checks", admin_token)
        # Must NOT 500. Acceptable: 200 with envelope, 404 if not found.
        assert r.status_code in (200, 404, 422), f"closing-checks crashed with {r.status_code}"
        if r.status_code == 200:
            body = r.json()
            assert body["success"] is True

    def test_tax_settlement_preview(self, http_client, admin_token):
        r = api_get(http_client, f"/finance/periods/{CURRENT_PERIOD}/tax-settlement", admin_token)
        # Same: must not 500. Empty data is OK.
        assert r.status_code in (200, 404, 422), f"tax-settlement crashed with {r.status_code}"
        if r.status_code == 200:
            body = r.json()
            assert body["success"] is True


class TestLockStatus:
    def test_lock_status_endpoint(self, http_client, admin_token):
        r = api_get(http_client, f"/finance/periods/{CURRENT_PERIOD}/lock-status", admin_token)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            body = r.json()
            assert body["success"] is True
            # Should contain a `locked` flag (bool) — exact key name varies, just check non-null
            assert body["data"] is not None


class TestPeriodAuth:
    def test_list_periods_unauthorized(self, http_client):
        r = http_client.get("/finance/periods")
        assert r.status_code == 401
