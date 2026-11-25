# Runtime UI crawl + gate findings (lead auditor)

Method: production build of frontend (`craco build`, CI=false) served same-origin with /api proxied to the
running backend; Playwright (Chromium, 1280×800) logged in through /api/auth/login (cookie session) and
opened every route extracted from App.js + 9 portal routers (188 unique routes; 20 parametrized resolved to
real DB ids). Per route captured: uncaught page errors, console errors, /api responses ≥400, error-boundary
text, final URL (redirects), text length, count of "Rp 0" literals, screenshot.
Runs: admin@ (181 routes), cfs.manager@ (/outlet/*, 20 routes), finance@ (/finance/*, 36 routes).

Overall: 0 white screens, 0 error-boundary renders on valid data; build passes with 56 react-hooks
exhaustive-deps warnings and 0 errors.

### UI-01 · P1 · Budget vs Actual shows revenue as negative and P&L rollup is meaningless
- Status: VERIFIED (screenshot admin__finance_budget_hub.png; code)
- Where: backend/services/_budget/vs_actual.py:31 (`net = dr - cr` for every account), backend/services/_budget/_common.py:25-39 (`guess_category`)
- Evidence: UI for 2026-10 shows Revenue "-Rp 1.341.959.000", Gross Profit "-Rp 1.879.937.000", Net Income "-Rp 2.683.918.000".
  `guess_category` returns "OPEX" for any code not starting 4/5/6 → assets/liabilities/equity (1xxx/2xxx/3xxx) are summed
  into OPEX, and every 5xxx except 54/55/57/58 is treated as COGS although CoA `type` says 5100–5304 are `expense`.
  With correct sign the "net" collapses to ≈0 because balance-sheet legs are included. Meanwhile
  GET /api/finance/profit-loss?period=2026-10 → net_income 562,889,000 and Profit Walk shows 560,981,000.
- Impact: Budget vs Actual (Finance > Budget hub) is wrong for every period; flags good/warn inverted for revenue.
- Fix: classify by `chart_of_accounts.type` (revenue/cogs/expense/other_income…) instead of code prefix; exclude
  non-P&L types; use `services._finance.balances.is_debit_normal()` so revenue = cr − dr. Filter outlet by
  `lines[].dim_outlet` like the P&L does. Regression test: vs_actual(period).REV.actual == profit_loss(period).revenue total.
- POS relevance: high — POS revenue will land in these accounts; owners will read this report.

### UI-02 · P1 · Three different "net profit" numbers for the same month (KPI SSOT broken)
- Status: VERIFIED
- Where: services/finance_service.profit_loss (562,889,000), services/profit_walk_service.py (560,981,000), services/_budget/vs_actual.py (UI-01)
- Evidence: 2026-10 — P&L API net 562,889,000; Profit Walk net 560,981,000 and revenue 1,340,459,000 vs budget-vs-actual revenue 1,341,959,000.
- Impact: Owner/Executive see different profit per screen; erodes trust in ERP numbers.
- Fix: one P&L aggregation service (finance_service.profit_loss) consumed by profit walk / budget / executive KPIs; add an
  intent invariant to scripts/verify_data_integrity.py (profit walk net == P&L net).
- POS relevance: high.

### UI-03 · P2 · Stock Movements "Total Cost" is Rp 0 for seeded rows; seeded wastage increases stock
- Status: VERIFIED (screenshot admin__inventory_movements_hub.png; DB)
- Where: backend/seed/seed_transactions.py:362-383 (writes `total_value`, random sign for wastage/adjustment, fake `sale` rows), FE reads `total_cost`
- Evidence: DB: `wastage` 27 rows, 13 with qty>0; `adjustment` 24 rows incl. qty 0; seeded movements use field `total_value`
  while app writers (services/inventory_service.py:234,308,349,394) use `total_cost`. UI shows Unit Cost Rp 14.607 / Total Rp 0.
- Impact: demo data contradicts business rules (wastage must be negative); valuation screens and KPIs built on it are misleading;
  `sale` movements are random and not linked to any daily_sales.
- Fix: seed must call the same service the app uses (or write `total_cost` and sign wastage negative); drop fake `sale` rows until a
  real sale→stock deduction exists.
- POS relevance: high (stock deduction from POS sales will be built on this collection).

### UI-04 · P2 · Finance user's Anomaly Feed calls /api/admin/users → 403 (assignee picker empty)
- Status: VERIFIED (crawl finance@ /finance/anomalies: `403 GET /api/admin/users`)
- Where: frontend/src/portals/finance/AnomalyFeed/index.jsx (user list fetch)
- Impact: finance staff cannot assign anomalies; noisy 403s.
- Fix: expose a scoped lightweight user lookup (e.g. GET /api/master/users/lookup with finance perms) or reuse an existing directory endpoint.
- POS relevance: none.

### UI-05 · P2 · Approval Center for outlet manager calls /api/forecasting/guard/logs → 403
- Status: VERIFIED (crawl cfs.manager@ /outlet/approvals)
- Where: frontend/src/pages/MyApprovals.jsx (forecast-guard panel)
- Fix: only fetch when user has the forecasting permission (portalGate `permitted()`), or return an empty list for unauthorized roles.
- POS relevance: low.

### UI-06 · P3 · /outlet/inventory/transfers redirects outlet manager to /no-access with a misleading message
- Status: VERIFIED (crawl cfs.manager@)
- Evidence: final URL /no-access, text "Akun Anda belum memiliki akses ke portal manapun" although the user has the Outlet portal.
- Fix: hide the link for roles without `inventory.transfer.*` and change the copy of NoAccess for partial access ("Anda tidak memiliki akses ke halaman ini").

### UI-07 · P3 · Opname detail with unknown id throws an uncaught AxiosError
- Status: VERIFIED (pageerror "AxiosError: Request failed with status code 404" on /inventory/opname/<unknown>)
- Where: frontend/src/portals/inventory/* opname detail page — missing try/catch around the fetch.
- Fix: catch and render an empty/not-found state like PaymentDetail does.

### UI-08 · P3 · GET /api/rfq/{unknown} returns 400 instead of 404
- Status: VERIFIED (crawl: `400 GET /api/rfq/nonexistent-id`, `400 .../compare`)
- Fix: raise NotFoundError in rfq_service.get.

### UI-09 · P3 · 56 react-hooks/exhaustive-deps warnings in production build
- Status: VERIFIED (build log). Typical `useEffect(..., [])` that calls an outer `load`. Low risk; fix opportunistically.

### GATE-01 · P1 · Project quality gates are not green on a fresh environment (handoff claims are stale)
- Status: VERIFIED
- Evidence (fresh seed, this session):
  - `pytest` (backend): 323 passed, **19 failed, 1 error**, 13 skipped (handoff: "233 pass / 11 skip", "all green").
    Real app bug among them: AR receipt on draft invoice → 500 (services/_ar/receipt.py:42 raises ValueError).
    Test-design problems: tests share the live demo DB and today's date (daily-sales "already submitted" collision),
    tests approve their own documents (now blocked by SoD), unit tests that need init_db(), cookie tests that need HTTPS,
    tests depending on Emergent object storage.
  - `scripts/idor_ownership_probe.py`: exit 1 ("1 IDOR LEAK") — actually an upload 500 caused by unreachable object storage; the probe
    counts infrastructure errors as leaks.
  - `scripts/e2e_write_flows.py`: exit 1 — picks an outlet that is not in the outlet manager's scope (OUTLET_OUT_OF_SCOPE).
  - `scripts/audit_tours.py` prints "0 tour files" in its RESULT line although it checked 474 targets (cosmetic counter bug).
  - Green: verify_data_integrity 21/21, health_check, intent_audit_5portals 25/25, intent_audit_remaining 21/21, ux_audit 0/0, audit_all OK.
- Fix: isolate tests on their own DB (`DB_NAME=test_ci_<uuid>` + seed fixture), use two users for create/approve, mark
  external-service tests `@pytest.mark.external`, make probes pick in-scope fixtures; add a CI workflow that runs these gates.

### ENV-01 · P2 · Hard coupling to Emergent platform services
- Status: VERIFIED
- Evidence: startup `object_storage_init_failed` (integrations.emergentagent.com); all uploads → 500 when unreachable;
  LLM features import `emergentintegrations` (not on PyPI; requirements.txt also pins litellm from customer-assets.emergentagent.com);
  frontend devDependency from assets.emergent.sh. Scripts hardcode `/app` paths.
- Impact: cannot deploy outside Emergent without code changes; uploads (e.g. receipts/photos from POS) fail hard.
- Fix: storage adapter interface with local-disk/S3 implementations selected by env; make emergent packages optional extras.
- POS relevance: high (POS device will upload receipts/photos; deployment target).

### ENV-02 · P2 · No frontend lockfile; `yarn precheck` broken
- Status: VERIFIED — no yarn.lock/package-lock in frontend/; `lint:no-undef` references missing `eslint.no-undef.config.mjs`.
- Fix: commit yarn.lock; add the eslint config or drop the script.

## Coverage
Checked: every routed page as super admin; outlet portal as outlet manager; finance portal as finance staff; all repo
gate scripts. Not checked: interactive write flows through the UI (forms submit) — covered at API level by the
domain auditors; mobile viewport; public website + loyalty customer pages (/loyalty/* need customer auth).

### UI-10 · P3 · Public site: anonymous visitors trigger /api/auth/me + /api/auth/refresh 401 on every page; home page scrolls horizontally on mobile
- Status: VERIFIED (Playwright 390×844 on /, /brands, /menu, /locations, /about, /news, /careers, /contact, /reservation, /loyalty/*, /login)
- Evidence: every public page logs `401 /api/auth/me` and `401 /api/auth/refresh`; on `/` documentElement.scrollWidth > viewport.
- Fix: AuthProvider should skip the session probe on public routes (or only after a "has_session" hint cookie); find the overflowing
  element on the home hero (screenshot shots/pub_mobile_.png).
