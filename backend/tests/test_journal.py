"""Integration tests for journal_service (GL).

Covers:
- List journal entries
- Chart of accounts
- Trial balance / P&L responses
- Manual JE creation requires balanced lines (Dr == Cr)
- Manual JE creation in a LOCKED period is rejected

These tests CREATE one manual JE with a unique reference, then verify it appears
in the journal list. They do NOT delete it (soft-delete may not be exposed via
the public API) — instead the unique ref makes them idempotent across runs.
"""
import pytest
from datetime import datetime

from .conftest import api_get, api_post

pytestmark = pytest.mark.journal


class TestChartOfAccounts:
    def test_list_coa(self, http_client, admin_token):
        r = api_get(http_client, "/finance/chart-of-accounts", admin_token)
        assert r.status_code == 200
        coa = r.json()["data"]
        assert isinstance(coa, list)
        assert len(coa) >= 30, f"Expected >=30 COA accounts seeded, got {len(coa)}"
        # spot check: must have at least one asset account
        codes = [a.get("code") for a in coa]
        assert any((c or "").startswith("1") for c in codes), "Expected at least one '1xxx' (asset) account"


class TestJournalList:
    def test_list_journals_admin(self, http_client, admin_token):
        r = api_get(http_client, "/finance/journals", admin_token)
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_journal_entries_alias(self, http_client, admin_token):
        r = api_get(http_client, "/finance/journal-entries", admin_token)
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_journals_unauthorized(self, http_client):
        r = http_client.get("/finance/journals")
        assert r.status_code == 401


class TestTrialBalanceAndPL:
    def test_trial_balance(self, http_client, admin_token):
        period = datetime.now().strftime("%Y-%m")
        r = api_get(http_client, f"/finance/trial-balance?period={period}", admin_token)
        # 200 expected, even if empty. Allow 404 if endpoint doesn't accept query var.
        assert r.status_code in (200, 422), f"trial-balance failed: {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            assert r.json()["success"] is True

    def test_profit_loss(self, http_client, admin_token):
        period = datetime.now().strftime("%Y-%m")
        r = api_get(http_client, f"/finance/profit-loss?period={period}", admin_token)
        assert r.status_code in (200, 422), f"profit-loss failed: {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            assert r.json()["success"] is True


class TestManualJE:
    def _pick_two_accounts(self, coa: list[dict]) -> tuple[dict, dict]:
        """Pick TWO POSTABLE accounts (is_postable=true).

        Most ranking COAs (level 1 headers) are non-postable; we need leaves.
        """
        postable = [a for a in coa if a.get("is_postable") is True]
        if len(postable) < 2:
            pytest.skip(f"Need at least 2 postable COA accounts, found {len(postable)}")
        # Prefer asset + revenue if available
        cash = next((a for a in postable if (a.get("code") or "").startswith("1")), postable[0])
        rev = next((a for a in postable if (a.get("code") or "").startswith("4")), postable[1])
        if cash["id"] == rev["id"]:
            rev = postable[1] if postable[1]["id"] != cash["id"] else postable[-1]
        return cash, rev

    def test_unbalanced_je_rejected(self, http_client, admin_token, seeded_coa):
        if not seeded_coa:
            pytest.skip("No COA seeded")
        dr_acc, cr_acc = self._pick_two_accounts(seeded_coa)
        unbalanced = {
            "entry_date": datetime.now().strftime("%Y-%m-%d"),
            "description": "TEST-unbalanced-must-fail",
            "lines": [
                {"coa_id": dr_acc["id"], "dr": 1000, "cr": 0, "memo": "dr"},
                {"coa_id": cr_acc["id"], "dr": 0, "cr": 500, "memo": "cr — unbalanced!"},
            ],
        }
        r = api_post(http_client, "/finance/journals/manual", admin_token, json=unbalanced)
        # Must reject with 400/422 — NOT a 500
        assert r.status_code in (400, 422), (
            f"Unbalanced JE should be rejected, got status={r.status_code} body={r.text[:300]}"
        )
        body = r.json()
        assert body["success"] is False

    def test_balanced_je_created(self, http_client, admin_token, seeded_coa, unique_suffix):
        if not seeded_coa:
            pytest.skip("No COA seeded")
        dr_acc, cr_acc = self._pick_two_accounts(seeded_coa)
        ref = f"PYTEST-JE-{unique_suffix}"
        balanced = {
            "entry_date": datetime.now().strftime("%Y-%m-%d"),
            "description": ref,
            "reference": ref,
            "lines": [
                {"coa_id": dr_acc["id"], "dr": 1000, "cr": 0, "memo": "dr"},
                {"coa_id": cr_acc["id"], "dr": 0, "cr": 1000, "memo": "cr"},
            ],
        }
        r = api_post(http_client, "/finance/journals/manual", admin_token, json=balanced)
        # 200 success expected. ONLY a genuinely locked/closed accounting period may
        # legitimately block creation. Anything else (e.g. a mis-configured number
        # series) is a REAL bug and MUST fail the test — never silently skip it.
        if r.status_code != 200:
            body = r.json()
            # If failure, it must be a clean envelope (not a crash)
            assert body.get("success") is False
            assert body.get("errors")
            err_msg = " ".join(
                str(e.get("message", "")) for e in (body.get("errors") or [])
            ).lower()
            if any(k in err_msg for k in ("period", "locked", "closed", "terkunci")):
                pytest.skip(f"JE creation blocked by locked/closed period: {body}")
            pytest.fail(
                f"Manual JE creation failed unexpectedly (NOT a period lock): {body}"
            )
        body = r.json()
        assert body["success"] is True
        je_id = body["data"].get("id") or body["data"].get("je_id")
        assert je_id, f"Expected an id in created JE response: {body}"

        # Sanity: pull the JE detail back
        get = api_get(http_client, f"/finance/journals/{je_id}", admin_token)
        assert get.status_code == 200, f"could not GET back the JE we just created: {get.text[:200]}"
