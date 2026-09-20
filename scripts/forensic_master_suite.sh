#!/usr/bin/env bash
# =============================================================================
# forensic_master_suite.sh — ONE command, consistent production-readiness audit.
#
# Runs every forensic gate in a fixed order so ANY agent gets the SAME signal.
# Read-only except the IDOR probe (creates+deletes its own throwaway leave doc).
#
# Usage:   bash /app/scripts/forensic_master_suite.sh
# Exit:    0 = all automated gates green; non-zero = at least one gate failed.
#
# NOTE: Covers the AUTOMATABLE gates. Gate 8 now automates the Phase 3 browser
#       tour-render sweep (headless Playwright). The remaining MANUAL/agent gate
#       is the frontend route-guard URL-tamper check (PHASE 2 in
#       /app/memory/FORENSIC_TEST_PLAYBOOK.md).
# =============================================================================
set -u
cd /app/scripts || exit 2

PASS=0; FAIL=0; FAILED_GATES=""
line() { printf '%.0s=' {1..78}; echo; }

gate() {
  local name="$1"; shift
  line; echo "GATE: $name"; line
  if "$@"; then
    echo "  -> ✅ $name PASSED"; PASS=$((PASS+1))
  else
    echo "  -> ❌ $name FAILED (exit $?)"; FAIL=$((FAIL+1)); FAILED_GATES="$FAILED_GATES\n   - $name"
  fi
  echo
}

# --- Gate 1: static endpoint auth-guard coverage (informational, never fails) ---
gate "Endpoint auth-guard coverage (static)" bash -c 'python rbac_endpoint_guard_audit.py | tail -n +1 | head -6; exit 0'

# --- Gate 2: portal partial-access leak-risk map (informational, never fails) ---
gate "Portal access leak-risk map (static, DB)" bash -c 'python rbac_portal_access_audit.py | head -4; exit 0'

# --- Gate 3: LIVE RBAC allow/deny matrix (asserts) ---
gate "Live RBAC allow/deny matrix" python rbac_forensic_test.py

# --- Gate 4: LIVE IDOR / ownership probe (asserts) ---
gate "Live IDOR / ownership probe" python idor_ownership_probe.py

# --- Gate 5: UI tour static drift + coverage (asserts MISSING==0 via grep) ---
gate "UI tour static drift (no stale targets)" bash -c 'out=$(python audit_tours_v2.py); echo "$out" | grep -E "target resolution"; echo "$out" | grep -q "MISSING=0"'

# --- Gate 6: backend unit/integration tests ---
gate "Backend pytest suite" bash -c 'cd /app/backend && python -m pytest -q 2>&1 | tail -n 5; cd /app/backend && python -m pytest -q >/dev/null 2>&1'

# --- Gate 7: E2E WRITE flows — Phase 4 (asserts) ---
# Purchase Request approval, Payment full cycle (create→submit→approve→mark-paid→verify JE),
# Period lock guard (locked period MUST reject manual JE), Inventory transfer stock delta.
gate "E2E write flows (Phase 4)" python e2e_write_flows.py

# --- Gate 8: LIVE tour runtime render probe — Phase 3 (asserts FAIL==0 & healthy>=90%) ---
# Refreshes route→tour mapping from source, then walks every static tour route in a
# headless browser (as SUPER_ADMIN) verifying each tour target actually mounts in the DOM.
# Requires the frontend to be running (localhost:3000) and Playwright chromium installed.
gate "Tour runtime render probe (Phase 3)" bash -c '
  python dump_tour_map.py >/dev/null 2>&1
  PREVIEW_URL="${PREVIEW_URL:-http://localhost:3000}" python tour_render_probe.py > /tmp/_tour_probe_gate.log 2>&1
  rc=$?
  tail -n 12 /tmp/_tour_probe_gate.log
  exit $rc
'

line
echo "FORENSIC MASTER SUITE SUMMARY:  PASS=$PASS  FAIL=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo -e "FAILED GATES:$FAILED_GATES"
  echo "STATUS: ❌ NOT READY — see failed gates above + FORENSIC_TEST_PLAYBOOK.md"
  exit 1
fi
echo "STATUS: ✅ ALL AUTOMATED GATES GREEN (Phase 3 tour render now automated; still run MANUAL PHASE 2 route-guard URL-tamper check before go-live)"
line
