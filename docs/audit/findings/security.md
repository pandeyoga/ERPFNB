# Security / authorization findings (prefix SEC) — audit 2026-10-24

Method: route-guard inventory of all 680 API routes (in-process walk of FastAPI dependencies:
require_perm 462 · require_any_perm 87 · current_user-only 84 · none 34 · loyalty-customer 7 ·
require_role 6), then live probes with scoped users (cfs/rst outlet managers, hr.officer, executive).
Unauthenticated routes (34) were reviewed one by one: all are login/refresh, public CMS/menu/jobs,
public reservation, health, client-error log, analytics track, public file proxy (PUBLIC_PREFIX only)
and the Telegram webhook.

| ID | Sev | Status | Finding | Where | Fix in this session |
|---|---|---|---|---|---|
| SEC-01 | P1 | VERIFIED | Write endpoints guarded only by a *read* permission: daily-sales draft/submit, petty cash, urgent purchase used `outlet.daily_sales.read` → read-only EXECUTIVE could create sales/petty cash | routers/daily_sales.py | ✅ create/update/submit/petty_cash.create/urgent_purchase.create perms |
| SEC-02 | P1 | VERIFIED | Cross-outlet reads: outlet manager read other outlets' stock balance, valuation, movements (`?outlet_id=`), transfer detail, outlet budget (`/by-outlet/{id}/current`, list, detail, precheck), daily-close list/detail, petty-cash balance, daily-sales detail/submit, reservations (list/detail/edit/delete/deposit/status) | routers/inventory.py, outlet_budget.py, daily_close.py, daily_sales.py, reservations.py | ✅ one helper `core.security.resolve_outlet_filter` + `enforce_outlet_scope` on detail/write |
| SEC-03 | P1 | VERIFIED | Users with an empty outlet grant were treated as unrestricted (`[]` → no filter) in several list endpoints | routers/daily_sales.py `_resolve_outlet_ids`, routers/outlet.py home | ✅ `[]` = nothing visible |
| SEC-04 | P1 | VERIFIED | Member PII (name, phone, tier, points) readable by any authenticated user via `/api/outlet/loyalty/cashier/lookup` (duplicate of the permissioned `/loyalty/lookup`) | routers/outlet.py | ✅ requires loyalty permission |
| SEC-05 | P1 | VERIFIED | Business-rule `ValueError`s surfaced as HTTP 500; unhandled exceptions inside `BaseHTTPMiddleware` re-raised → plain-text 500 or dropped connection ("Server disconnected") | server.py, core/middleware.py | ✅ ValueError→400, DuplicateKeyError→409, unhandled→JSON 500 with request id |
| SEC-06 | P2 | VERIFIED | 158 write routes accept `payload: dict = Body(...)` (no schema) — mass-assignment risk, e.g. `/api/master/{entity}` POST stores any field | routers/master.py and others | ⏳ plan (typed models / allow-lists) |
| SEC-07 | P2 | LIKELY | Telegram webhook accepts any payload when `TELEGRAM_WEBHOOK_SECRET` is unset (fail-open) | routers/telegram.py | ⏳ plan (fail closed) |
| SEC-08 | P2 | VERIFIED | `CORS_ORIGINS` defaults to `*` with `allow_credentials=True`; mitigated by SameSite=Lax cookies + same-origin check on unsafe methods, but production must pin origins | server.py | ⏳ deployment config |
| SEC-09 | P2 | VERIFIED | Access token lifetime 24 h (`exp-iat=86400`) — long for shared POS devices; no device binding | core/security.py, constants | ⏳ POS phase (device tokens) |
| SEC-10 | P2 | VERIFIED | Upload endpoints trust client Content-Type; 5 different upload implementations | routers/uploads.py, admin_menu.py, _admin_cms/uploads.py | ⏳ plan |
| SEC-11 | P3 | VERIFIED | Cookie `Secure` flag hard-coded → cookie auth cannot be exercised on a local http stack (8 pytest failures are only this) | routers/auth.py, loyalty.py | ✅ `COOKIE_SECURE` env (default true) |
| SEC-12 | P3 | VERIFIED | `require_perm("admin", "cms")` on CMS outlet/brand admin uses non-catalogue permission codes (only `*` passes) | routers/_admin_cms/*.py | ⏳ plan |
| SEC-13 | P3 | VERIFIED | Demo credentials documented in committed markdown (HANDOFF, guardrails) | memory/, HANDOFF | ⏳ remove before production |

Positive controls verified: user status re-checked on every request (disabled user's token stops
working), refresh-token TTL index, login rate limit, CSRF origin check for cookie writes, regex-escaped
master search, SoD on PR/PO/adjustment/payment approvals.
