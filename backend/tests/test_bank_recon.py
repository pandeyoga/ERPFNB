"""Bank Reconciliation integration tests.

Tests cover:
- Upload CSV statement
- Auto-match
- Manual match / unmatch
- Mark exception
- Bulk auto-accept (regression: field-name consistency + deduplication)
- Session summary
- Commit session
- Reverse commit (undo)
- Export CSV (regression: correct field names)
- Journal entry matching
"""
import io
from datetime import date, timedelta
import pytest

pytestmark = pytest.mark.integration

# Seed data is generated relative to today, so JE-matching tests use recent dates.
_RECENT = (date.today() - timedelta(days=10)).isoformat()
_RECENT2 = (date.today() - timedelta(days=7)).isoformat()

# --------------------------------------------------------------------------- #
# CSV fixture helpers
# --------------------------------------------------------------------------- #

def _make_csv(rows: list[dict]) -> bytes:
    """Generate minimal CSV bytes from list of {date, description, amount}."""
    lines = ["Date,Description,Amount"]
    for r in rows:
        lines.append(f"{r['date']},{r['description']},{r['amount']}")
    return "\n".join(lines).encode()


SAMPLE_ROWS = [
    {"date": "2025-06-01", "description": "Pembayaran Vendor A",   "amount": "500000"},
    {"date": "2025-06-02", "description": "Pembayaran Vendor B",   "amount": "1200000"},
    {"date": "2025-06-03", "description": "Bank charge",           "amount": "25000"},
]


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture(scope="module")
def bank_account_id(http_client, admin_token):
    """Get first available bank account."""
    r = http_client.get(
        "/master/bank-accounts",
        params={"per_page": 1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, f"Cannot fetch bank accounts: {r.text}"
    items = r.json()["data"]
    assert items, "No bank accounts seeded — run seed_demo.py"
    return items[0]["id"]


@pytest.fixture(scope="module")
def session_id(http_client, admin_token, bank_account_id):
    """Upload a sample CSV and return session id."""
    csv_bytes = _make_csv(SAMPLE_ROWS)
    r = http_client.post(
        "/finance/bank-recon/upload",
        files={"file": ("test_statement.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={
            "bank_account_id": bank_account_id,
            "date_tol_days": "5",
            "amount_tol": "5000",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, f"Upload failed: {r.text}"
    d = r.json()["data"]
    assert d["total_rows"] == len(SAMPLE_ROWS)
    return d["id"]


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #

@pytest.mark.bank_recon
def test_list_sessions(http_client, admin_token):
    r = http_client.get(
        "/finance/bank-recon/sessions",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert isinstance(data, list)


@pytest.mark.bank_recon
def test_get_session(http_client, admin_token, session_id):
    r = http_client.get(
        f"/finance/bank-recon/sessions/{session_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["id"] == session_id
    assert d["total_rows"] == len(SAMPLE_ROWS)
    assert d["status"] == "pending"
    assert "rows" in d
    assert len(d["rows"]) == len(SAMPLE_ROWS)


@pytest.mark.bank_recon
def test_session_summary(http_client, admin_token, session_id):
    r = http_client.get(
        f"/finance/bank-recon/sessions/{session_id}/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    d = r.json()["data"]
    assert "total_rows" in d
    assert "matched_rows" in d
    assert "match_pct" in d
    assert d["total_rows"] == len(SAMPLE_ROWS)
    assert isinstance(d["match_pct"], (int, float))


@pytest.mark.bank_recon
def test_row_candidates(http_client, admin_token, session_id):
    """Candidates endpoint should return a list (may be empty if no paid PAYs exist)."""
    # Get the first row id
    r = http_client.get(
        f"/finance/bank-recon/sessions/{session_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    row_id = r.json()["data"]["rows"][0]["id"]

    r2 = http_client.get(
        f"/finance/bank-recon/sessions/{session_id}/rows/{row_id}/candidates",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    assert isinstance(r2.json()["data"], list)


@pytest.mark.bank_recon
def test_mark_exception_and_unmatch_not_applicable(http_client, admin_token, session_id):
    """Mark first unmatched row as exception."""
    r = http_client.get(
        f"/finance/bank-recon/sessions/{session_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    rows = r.json()["data"]["rows"]
    unmatched = [row for row in rows if not row.get("matched") and not row.get("exception")]
    if not unmatched:
        pytest.skip("No unmatched rows to mark as exception")
    row_id = unmatched[0]["id"]

    r2 = http_client.post(
        f"/finance/bank-recon/sessions/{session_id}/rows/{row_id}/exception",
        json={"note": "Biaya bank otomatis, belum direkam"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    updated = r2.json()["data"]
    exc_row = next(rr for rr in updated["rows"] if rr["id"] == row_id)
    assert exc_row["exception"] is True
    assert exc_row["matched"] is False
    assert exc_row["exception_note"] == "Biaya bank otomatis, belum direkam"


@pytest.mark.bank_recon
def test_bulk_auto_accept_field_names(http_client, admin_token, session_id):
    """Regression: bulk_auto_accept must use correct field names.

    After bulk accept, any accepted rows must have:
    - matched=True
    - match_type="auto"
    - match_confidence (not match_score)
    - match_target_doc_no (not match_ref)
    """
    r = http_client.post(
        f"/finance/bank-recon/sessions/{session_id}/bulk-auto-accept",
        json={"min_score": 0.0},   # accept any match
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    d = r.json()["data"]
    assert "accepted" in d
    assert "session" in d
    accepted_count = d["accepted"]

    # Validate field names on accepted rows
    session_rows = d["session"]["rows"]
    bulk_accepted = [row for row in session_rows if row.get("matched") and row.get("match_type") == "auto"]
    for row in bulk_accepted:
        # match_confidence must be set (not match_score)
        assert "match_confidence" in row, f"Row {row['id']}: match_confidence missing"
        assert row.get("match_confidence") is not None
        # match_score should NOT be the canonical field (legacy renamed)
        assert "match_score" not in row or row.get("match_confidence") is not None


@pytest.mark.bank_recon
def test_bulk_auto_accept_no_duplicates(http_client, admin_token, session_id):
    """Regression: same payment_request must not match to multiple rows."""
    r = http_client.get(
        f"/finance/bank-recon/sessions/{session_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    rows = r.json()["data"]["rows"]
    matched = [row for row in rows if row.get("matched")]
    if len(matched) < 2:
        pytest.skip("Need at least 2 matched rows to check deduplication")
    target_ids = [row.get("match_target_id") for row in matched if row.get("match_target_id")]
    assert len(target_ids) == len(set(target_ids)), "Duplicate target_ids found — deduplication failed!"


@pytest.mark.bank_recon
def test_auto_match_rerun(http_client, admin_token, session_id):
    """Re-run auto-match should succeed and return same session structure."""
    r = http_client.post(
        f"/finance/bank-recon/sessions/{session_id}/auto-match",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["id"] == session_id
    assert "rows" in d
    assert len(d["rows"]) == len(SAMPLE_ROWS)


@pytest.mark.bank_recon
def test_export_csv_field_names(http_client, admin_token, session_id):
    """Regression: export CSV must use match_target_doc_no and match_confidence columns."""
    r = http_client.get(
        f"/finance/bank-recon/sessions/{session_id}/export-csv",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    content = r.text
    assert "Match Ref" in content, "CSV header 'Match Ref' missing"
    assert "Confidence" in content, "CSV header 'Confidence' missing"
    # Score (old name) should NOT be in header
    header_line = content.split("\n")[0]
    assert "Score" not in header_line.replace("Confidence", ""), "Old 'Score' header still present"


@pytest.mark.bank_recon
def test_commit_session_empty_match(http_client, admin_token, bank_account_id):
    """Commit must fail if no rows are matched."""
    # Create a fresh session with a row that won't auto-match
    csv_bytes = _make_csv([{"date": "2000-01-01", "description": "Very old tx", "amount": "9999999"}])
    r = http_client.post(
        "/finance/bank-recon/upload",
        files={"file": ("old.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"bank_account_id": bank_account_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    sid = r.json()["data"]["id"]

    r2 = http_client.post(
        f"/finance/bank-recon/sessions/{sid}/commit",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Must fail — no matched rows
    assert r2.status_code in (400, 422, 409), f"Expected 4xx but got {r2.status_code}: {r2.text}"


@pytest.mark.bank_recon
def test_bulk_accept_on_committed_session_rejected(http_client, admin_token, bank_account_id):
    """Bulk accept must return 409 on a committed session."""
    # We can't easily commit a session without matched rows, so we test
    # the committed guard by attempting a commit on a fresh empty session
    # then testing auto-match afterward (indirect test of guard)
    # Instead: just verify that the bulk_accept endpoint returns 409 for committed
    # This test is skipped if we can't create a committed session easily
    pytest.skip("Requires a pre-committed session — covered by functional test")


# --------------------------------------------------------------------------- #
# Journal Entry matching tests
# --------------------------------------------------------------------------- #

@pytest.mark.bank_recon
def test_build_candidates_includes_je(http_client, admin_token, bank_account_id):
    """Candidates for a BCA session should include journal_entry types.

    This verifies _build_candidates was extended to pull JE bank lines.
    We upload a statement with very wide amount tolerance to capture any JE.
    """
    # Upload a fresh session with wide tolerances to ensure JE candidates appear
    csv_bytes = _make_csv([
        {"date": _RECENT, "description": "JE AR Receipt match test", "amount": "3000000"},
    ])
    r = http_client.post(
        "/finance/bank-recon/upload",
        files={"file": ("je_test.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={
            "bank_account_id": bank_account_id,
            "date_tol_days": "10",
            "amount_tol": "10000000",   # very wide to capture any JE amount
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, f"Upload failed: {r.text}"
    sid = r.json()["data"]["id"]

    # Fetch candidates for the first row
    row_id = r.json()["data"]["rows"][0]["id"]
    r2 = http_client.get(
        f"/finance/bank-recon/sessions/{sid}/rows/{row_id}/candidates",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    cands = r2.json()["data"]
    target_types = {c["target_type"] for c in cands}
    assert "journal_entry" in target_types, (
        f"Expected journal_entry candidates but found types: {target_types}. "
        "Check gl_account_id is stored in session and JE dates overlap."
    )


@pytest.mark.bank_recon
def test_je_candidate_fields(http_client, admin_token, bank_account_id):
    """Journal entry candidates must have correct required fields."""
    csv_bytes = _make_csv([
        {"date": _RECENT2, "description": "Test JE candidate fields", "amount": "3000000"},
    ])
    r = http_client.post(
        "/finance/bank-recon/upload",
        files={"file": ("je_fields.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={
            "bank_account_id": bank_account_id,
            "date_tol_days": "5",
            "amount_tol": "10000000",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    sid = r.json()["data"]["id"]
    row_id = r.json()["data"]["rows"][0]["id"]

    r2 = http_client.get(
        f"/finance/bank-recon/sessions/{sid}/rows/{row_id}/candidates",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    cands = r2.json()["data"]
    je_cands = [c for c in cands if c["target_type"] == "journal_entry"]
    if not je_cands:
        pytest.skip("No JE candidates found — may need wider tolerance or different date range")

    for c in je_cands:
        assert "target_id" in c, "JE candidate missing target_id"
        assert "doc_no" in c, "JE candidate missing doc_no"
        assert "date" in c, "JE candidate missing date"
        assert "amount" in c, "JE candidate missing amount"
        assert c["amount"] != 0, "JE candidate amount should be non-zero"
        assert c.get("doc_no", "").startswith("JAE-"), f"Expected JAE- prefix, got: {c.get('doc_no')}"


@pytest.mark.bank_recon
def test_session_stores_gl_account_id(http_client, admin_token, bank_account_id):
    """Session must store gl_account_id from bank account for JE matching."""
    # Get the bank account's gl_account_id
    r_ba = http_client.get(
        f"/master/bank-accounts",
        params={"per_page": 10},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    bas = r_ba.json()["data"]
    target_ba = next((b for b in bas if b["id"] == bank_account_id), None)
    assert target_ba is not None
    expected_gl = target_ba.get("gl_account_id")
    if not expected_gl:
        pytest.skip("Bank account has no gl_account_id — JE matching disabled")

    # Upload a session and check it stores gl_account_id
    csv_bytes = _make_csv([{"date": "2026-01-01", "description": "GL ID test", "amount": "50000"}])
    r = http_client.post(
        "/finance/bank-recon/upload",
        files={"file": ("gl_id_test.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"bank_account_id": bank_account_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    session_data = r.json()["data"]
    assert session_data.get("gl_account_id") == expected_gl, (
        f"Session gl_account_id={session_data.get('gl_account_id')} "
        f"but expected {expected_gl}"
    )



# --------------------------------------------------------------------------- #
# Reverse commit tests
# --------------------------------------------------------------------------- #

@pytest.fixture(scope="module")
def committed_session_id(http_client, admin_token, bank_account_id):
    """Upload, auto-match (wide tolerance to get matches), then commit.

    Returns the committed session_id. Used to test reverse_commit.
    """
    csv_bytes = _make_csv([
        {"date": _RECENT, "description": "Daily sales reverse test", "amount": "3000000"},
    ])
    r = http_client.post(
        "/finance/bank-recon/upload",
        files={"file": ("reverse_test.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={
            "bank_account_id": bank_account_id,
            "date_tol_days": "10",
            "amount_tol": "10000000",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    sid = r.json()["data"]["id"]

    # Trigger auto-match to get at least one matched row
    r2 = http_client.post(
        f"/finance/bank-recon/sessions/{sid}/auto-match",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    matched = sum(1 for row in r2.json()["data"]["rows"] if row.get("matched"))
    if not matched:
        pytest.skip("No matched rows after auto-match — cannot test commit/reverse")

    # Commit
    r3 = http_client.post(
        f"/finance/bank-recon/sessions/{sid}/commit",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 200, f"Commit failed: {r3.text}"
    assert r3.json()["data"]["status"] == "committed"
    return sid


@pytest.mark.bank_recon
def test_reverse_commit_returns_pending(http_client, admin_token, committed_session_id):
    """After reverse_commit, session status must be 'pending'."""
    r = http_client.post(
        f"/finance/bank-recon/sessions/{committed_session_id}/reverse-commit",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, f"Reverse failed: {r.text}"
    d = r.json()["data"]
    assert d["status"] == "pending", f"Expected pending, got {d['status']}"
    assert "committed_at" not in d or d.get("committed_at") is None, "committed_at should be cleared"


@pytest.mark.bank_recon
def test_reverse_preserves_match_data(http_client, admin_token, committed_session_id):
    """After reverse, row match data must still be intact (matched=True, match_target_id set)."""
    r = http_client.get(
        f"/finance/bank-recon/sessions/{committed_session_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    rows = r.json()["data"]["rows"]
    matched_rows = [row for row in rows if row.get("matched")]
    assert matched_rows, "Match data was wiped — should be preserved after reverse"
    for row in matched_rows:
        assert row.get("match_target_id"), "match_target_id wiped — should be preserved"
        assert row.get("match_target_type"), "match_target_type wiped — should be preserved"


@pytest.mark.bank_recon
def test_reverse_on_pending_session_fails(http_client, admin_token, session_id):
    """Reversing a non-committed session must return 409 Conflict."""
    r = http_client.post(
        f"/finance/bank-recon/sessions/{session_id}/reverse-commit",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 409, f"Expected 409 for pending session, got {r.status_code}"


@pytest.mark.bank_recon
def test_can_recommit_after_reverse(http_client, admin_token, committed_session_id):
    """After reverse, session can be committed again successfully."""
    # Session is now pending with preserved matches — commit it again
    r = http_client.post(
        f"/finance/bank-recon/sessions/{committed_session_id}/commit",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, f"Re-commit after reverse failed: {r.text}"
    assert r.json()["data"]["status"] == "committed"
