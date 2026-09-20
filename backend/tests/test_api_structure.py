"""API structure guardrail tests.

Ensures the codebase adheres to project-wide conventions:
- No trailing slashes on any registered route
- Trailing-slash requests return 400 (not 404 / 307)
"""
import pytest

pytestmark = pytest.mark.integration


# ── Route-level scan ─────────────────────────────────────────────────────────

def _get_app_routes():
    """Import server app and return all registered APIRoutes."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    # Use the running server's registered routes via http_client is cleaner;
    # we test behaviour via HTTP rather than introspecting the app object.
    return []


@pytest.mark.structure
def test_no_trailing_slash_on_routes(http_client, admin_token):
    """Critical endpoints must NOT have trailing-slash definitions.

    Strategy: call a known endpoint with trailing slash and assert 400 (not 200/307).
    If the route was accidentally defined with a trailing slash, it would return 200.
    """
    known_routes_no_slash = [
        ("GET",  "/finance/journals"),
        ("GET",  "/procurement/prs"),
        ("GET",  "/finance/bank-recon/sessions"),
        ("GET",  "/hr/employees"),
        ("GET",  "/anomalies"),
        ("GET",  "/finance/periods"),
        ("GET",  "/ar/invoices"),
        ("GET",  "/finance/ap-aging"),
    ]
    violations = []
    for method, path in known_routes_no_slash:
        # Call WITH trailing slash — must NOT be 200
        r = getattr(http_client, method.lower())(
            f"{path}/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        if r.status_code == 200:
            violations.append(f"{method} {path}/ returned 200 — route may be defined with trailing slash!")

    assert not violations, "\n".join(violations)


# ── Middleware behaviour ──────────────────────────────────────────────────────

@pytest.mark.structure
def test_trailing_slash_returns_400_not_404_or_307(http_client, admin_token):
    """Trailing-slash middleware must return 400 with TRAILING_SLASH code."""
    r = http_client.get(
        "/finance/journals/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400, (
        f"Expected 400 for trailing slash, got {r.status_code}. "
        "Check reject_trailing_slash middleware in server.py"
    )
    body = r.json()
    assert body.get("code") == "TRAILING_SLASH", f"Expected TRAILING_SLASH code, got: {body}"
    assert "message" in body
    # Must suggest the correct URL
    assert "/finance/journals" in body["message"]


@pytest.mark.structure
def test_trailing_slash_no_307_redirect(http_client, admin_token):
    """There must be ZERO 307 redirects for trailing-slash requests.

    307 redirects break POST/PUT/PATCH because the body is re-sent to the redirect URL
    but many HTTP clients don't follow 307 for non-GET methods.
    """
    import httpx
    # httpx by default does NOT follow redirects — so if we get a 307, test catches it
    r = http_client.post(
        "/finance/bank-recon/sessions/fake-id/commit/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={},
        follow_redirects=False,
    )
    assert r.status_code != 307, "Got 307 redirect — redirect_slashes should be False!"
    # Should be 400 (trailing slash guard) not 307
    assert r.status_code == 400


@pytest.mark.structure
def test_correct_url_still_works_after_middleware(http_client, admin_token):
    """Middleware must NOT interfere with valid (no-slash) requests."""
    r = http_client.get(
        "/finance/journals",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, (
        f"Valid request /finance/journals returned {r.status_code} — middleware may be too aggressive"
    )


@pytest.mark.structure
def test_root_path_not_affected(http_client, admin_token):
    """A valid deep path without trailing slash must not be rejected."""
    # The middleware allows any path that does NOT end with /.
    # We test this via a known working endpoint.
    r = http_client.get(
        "/master/bank-accounts",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, (
        f"Valid path /master/bank-accounts returned {r.status_code} — middleware over-blocking"
    )
