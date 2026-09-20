# 🚀 PRODUCTION READINESS — PHASED REPORT
### Torado Group ERP (Aurora F&B)

> 🏷️ **STATUS: 🟡 IN PROGRESS** — P0 security blocker cleared; remaining work
> split into phases for an efficient, zero-bug path to production.
> **Audience:** the next engineering agent. **Language:** reply to user in **Indonesian**.
> Pair this with the repeatable procedure in `/app/memory/FORENSIC_TEST_PLAYBOOK.md`.

---

## 1. Executive summary

| Area | State |
|---|---|
| **P0 IDOR (leave PII)** | ✅ **FIXED + VERIFIED** (15/15 testing-agent tests, live probe green) |
| Automated forensic gates | ✅ **6/6 GREEN** (`bash scripts/forensic_master_suite.sh`) |
| Backend pytest | ✅ 233 passed, 11 skipped |
| Live RBAC matrix | ✅ 25/25 enforced |
| Endpoint guard coverage | 524/619 `require_perm` · 6 role · **59 auth-only** · 30 public |
| Frontend route guards | 🟡 Admin done; **7 portals pending** (PHASE 2) |
| UI tours | 🟡 static drift = 0; **browser render validation pending** (PHASE 3) |
| Critical WRITE E2E | 🔴 **pending** (PHASE 4) |
| Deploy check | 🔴 **pending** (PHASE 5) |

**Go / No-Go:** ❌ **NOT yet** — PHASE 2–5 must complete. No P0 blockers remain;
remaining items are P1 defense-in-depth + verification.

---

## 2. Fixed THIS session (P0)

### IDOR in Leave endpoints — `routers/leave.py`
**Vuln:** `GET /api/hr/leaves/summary/{employee_id}` and `GET /api/hr/leaves/{leave_id}`
had only `current_user` (no ownership/permission check) → any authenticated user
could read another employee's leave PII.

**Fix:** added `_assert_can_view_employee_leave(user, employee_id)` — allows only if
`employee_id == user["id"]` **OR** user has `*` **OR** any of
`hr.leave.approve` / `hr.leave.read` / `hr.employee.read`; else `403 LEAVE_OWNERSHIP_REQUIRED`.
Applied to both endpoints (detail uses the doc's `employee_id`). `list_leaves` already
scoped non-HR users to their own id; unified to the same permission set.

**Verification:** owner→200, cross-user→403, super→200, missing→404, no-token→401.
Reusable tests: `backend/idor_leave_security_test.py` + `scripts/idor_ownership_probe.py`.

---

## 3. Phased plan for remaining work

### PHASE 1 — Backend IDOR sweep of the 59 auth-only endpoints · **P0/P1**
- **Goal:** prove every authenticated-only endpoint that returns per-user/PII/financial
  data enforces ownership or a permission *at runtime* (static scan can't tell).
- **How:** for each candidate from `python scripts/rbac_endpoint_guard_audit.py` (🟠 list),
  add a case to `scripts/idor_ownership_probe.py` and run it. See PLAYBOOK §3 triage list.
- **Priority candidates:** `approvals.py` (queue/pending/counts/delegations — must be
  scoped to the user's eligible items), `admin.py business-rules/*` (reachable by
  OUTLET_MANAGER's `admin.*` perms — confirm writes need an admin perm),
  `daily_close.py /{record_id}/reopen` (outlet scope). Reference data (`master.py /coa`,
  `/{entity}`) = low risk, confirm & document.
- **Done when:** `idor_ownership_probe.py` covers all per-entity auth-only endpoints, exit 0.

### PHASE 2 — Frontend route-level RBAC guards (7 portals) · **P1 (defense-in-depth)**
- **Goal:** a partial-access role can't load a forbidden screen via URL tampering.
- **Pattern:** replicate the proven `Gate`/`permitted` helper from
  `portals/admin/AdminPortal.jsx` into Finance, HR, Inventory, Outlet, Procurement,
  Owner, Executive/Reports portals; also add section `reqPerm` in
  `lib/navigationSchema/<x>.js` for sidebar consistency. Full recipe + leak-risk
  role list in PLAYBOOK §4.
- **Note:** backend already enforces perms, so this is UI hardening (no data leak today),
  but required for the "deep audit" bar. Do ONE portal, browser-verify, then repeat.
- **Done when:** each partial-access role redirected to `/no-access` on forbidden deep-link
  (verified by testing agent / screenshot URL-tamper).

### PHASE 3 — UI tours browser validation (~98 tours / 429 steps) · **P1**
- **Goal:** every tour step's target actually renders on its route at runtime.
- **How:** PLAYBOOK §5 — per tour from `tourMap.js`, run it in browser, confirm each
  step highlights (no "target not found"). Static gate already 0 drift.
- **Already fixed (don't regress):** `executive-home`, `outlet-drilldown`, `brand-drilldown`.
- **Done when:** all tours run clean in-browser; log any route-drift fixes.

### PHASE 4 — E2E critical WRITE flows · **P0**
- approval workflow (submit→approve→reject + delegation), period close/lock,
  payroll/payment run, inventory transfer. Use testing agent (backend + frontend),
  assert state transitions + permission gates + audit-log entries.

### PHASE 5 — Deploy readiness · **P1**
- `bash scripts/forensic_master_suite.sh` → all green, then run **deployment_agent**
  (no hardcoded env/ports/CORS). Never edit `REACT_APP_BACKEND_URL` / `MONGO_URL`.

---

## 4. Known nuances / false-positives (read before "fixing")

- **Static endpoint guard over-reports.** The 59 "authenticated-only" endpoints include
  SAFE ones that check ownership *inside* the handler (e.g. leave). Do **not** blindly add
  `require_perm` — verify behavior with the live IDOR probe first; a blanket perm could
  break legitimate self-service (a user reading their OWN data).
- **Tour static audit (429 exact, 0 missing)** only proves the `data-testid` exists in the
  codebase, NOT that it's rendered on the route → PHASE 3 must be in-browser.
- **OUTLET_MANAGER holds 3 `admin.loyalty.*` perms** → can enter `/admin` shell; already
  mitigated by per-route `Gate` in `AdminPortal.jsx`. Keep this when refactoring.

---

## 5. New tooling created this session

| File | Purpose |
|---|---|
| `scripts/forensic_master_suite.sh` | one-command run of all 6 automated gates |
| `scripts/idor_ownership_probe.py` | live cross-user IDOR probe (data-driven, extensible) |
| `backend/idor_leave_security_test.py` | full leave IDOR + regression suite (testing agent) |
| `memory/FORENSIC_TEST_PLAYBOOK.md` | the repeatable procedure (extend RBAC/IDOR/tours) |
| `memory/PRODUCTION_READINESS_PHASED_REPORT.md` | this report |

**Quick start for next agent:**
```bash
bash /app/scripts/forensic_master_suite.sh   # confirm baseline still green
# then pick up PHASE 1 (extend idor_ownership_probe.py) per PLAYBOOK §3
```
