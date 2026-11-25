"""Regression: payment list accepts several statuses ("a,b") — used by the merged "Menunggu Approval" tab
(submitted = no approval workflow, awaiting_approval = with workflow; same stage for the user)."""
from .conftest import api_get


def _ids(http_client, token, status):
    r = api_get(http_client, f"/finance/payments?status={status}&per_page=100", token)
    assert r.status_code == 200, r.text
    return {p["id"] for p in r.json()["data"]}


def test_multi_status_is_union(http_client, admin_token):
    sub = _ids(http_client, admin_token, "submitted")
    awa = _ids(http_client, admin_token, "awaiting_approval")
    both = _ids(http_client, admin_token, "submitted,awaiting_approval")
    assert both == sub | awa


def test_single_status_unchanged(http_client, admin_token):
    paid = api_get(http_client, "/finance/payments?status=paid&per_page=100", admin_token).json()["data"]
    assert all(p["status"] == "paid" for p in paid)
