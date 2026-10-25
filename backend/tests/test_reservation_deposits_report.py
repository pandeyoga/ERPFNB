"""Regression: Finance › Reservation Deposits report.

Legacy/demo reservations have no deposit_status/deposit_amount; the $group key then lacked
`deposit_status` and the report raised KeyError (HTTP 500) once rows matched the period.
"""
from datetime import datetime

from .conftest import api_get

CURRENT_PERIOD = datetime.now().strftime("%Y-%m")


def test_deposits_report_handles_rows_without_deposit_fields(http_client, admin_token):
    r = api_get(http_client, f"/reservations/reports/deposits?period={CURRENT_PERIOD}", admin_token)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert set(data["totals"]) >= {"paid", "pending", "refunded", "forfeited", "none"}
    assert None not in data["totals"]
    assert all(row["count"] >= 1 for row in data["by_outlet"])


def test_reservation_list_exposes_canonical_fields(http_client, admin_token):
    r = api_get(http_client, "/reservations?per_page=20", admin_token)
    assert r.status_code == 200, r.text
    for row in r.json()["data"]["items"]:
        assert "guest_name" not in row and "date" not in row
        assert row.get("reservation_date")
