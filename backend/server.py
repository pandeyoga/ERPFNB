"""FnB Group — FastAPI entrypoint (Phase 10 productionization wired)."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from core.db import close_db, init_db  # noqa: E402
from core.exceptions import AuroraException, error_envelope  # noqa: E402
from core.logging_config import configure_logging, get_db_sink  # noqa: E402
from core.middleware import RateLimitMiddleware, RequestIDMiddleware, SecurityHeadersMiddleware  # noqa: E402
from core.rate_limiter import limiter as rate_limiter  # noqa: E402

# Routers
from routers import crm_analytics
from routers import data_management
from routers import admin, admin_loyalty, admin_ops, ai, anomalies, approval_matrix, approvals, ar, auth, bank_recon, budget, bulk_import, cash, daily_close, daily_sales, efaktur, executive, finance, fixed_asset, forecasting, hr, inventory, item_pricing, kdo_bdo, leave, loyalty, master, notifications, outlet, outlet_budget, owner, payments, payment_requests, payment_runs, payment_run_templates, procurement, reports, rewards, search, seo, system_settings, tax, telegram, uploads, public_content, admin_cms, cms_advanced, report_schedules, rfq, ebupot, user_preferences, market_list, vendor_items, reservations, admin_menu, public_menu, tour_analytics  # noqa: E402

# Configure structured JSON logging EARLY (before any logger.info calls)
configure_logging()
logger = logging.getLogger("aurora")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    # Attach DB log sink (logs persist to log_entries collection)
    try:
        get_db_sink()
    except Exception:  # noqa: BLE001
        logger.exception("db_log_sink_attach_failed")

    # Seed default approval workflows (idempotent — only inserts if missing)
    try:
        from services.approval_service import seed_defaults as _seed_wf
        n = await _seed_wf(user_id="system", overwrite=False)
        if n:
            logger.info(f"Seeded {n} default approval workflow(s)")
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Approval workflow seed failed: {e}")

    # Phase 12B \u2014 encrypt any legacy plaintext is_secret values in system_settings
    try:
        from services.system_settings_service import encrypt_legacy_plaintext_secrets
        result = await encrypt_legacy_plaintext_secrets()
        if result.get("encrypted"):
            logger.info(
                "system_settings encryption migration: encrypted=%d skipped=%d errors=%d",
                result.get("encrypted", 0), result.get("skipped", 0), result.get("errors", 0),
            )
    except Exception:  # noqa: BLE001
        logger.exception("settings_encryption_migration_failed")

    # Start background scheduler (Phase 10D)
    try:
        if os.environ.get("SCHEDULER_ENABLED", "true").lower() == "true":
            from services.scheduler_service import start_scheduler
            await start_scheduler()
    except Exception:  # noqa: BLE001
        logger.exception("scheduler_start_failed")

    # Phase 3 — Help & Tour analytics indexes
    try:
        from services.tour_analytics_service import ensure_indexes as _tour_indexes
        await _tour_indexes()
    except Exception:  # noqa: BLE001
        logger.exception("tour_analytics_indexes_failed")

    logger.info("FnB ERP backend started")
    try:
        yield
    finally:
        try:
            from services.scheduler_service import shutdown_scheduler
            await shutdown_scheduler()
        except Exception:  # noqa: BLE001
            pass
        await close_db()
        logger.info("FnB ERP backend shut down")


app = FastAPI(
    title="FnB Group API",
    version="0.3.0",
    description="Integrated F&B ERP for FnB Group (multi-brand, multi-outlet, single-tenant).",
    lifespan=lifespan,
    # POLICY: All API routes must be defined WITHOUT trailing slashes.
    # Setting redirect_slashes=False means /api/foo/ returns 404 instead of
    # silently redirecting to /api/foo (which would break POST body on 307).
    # The TrailingSlashMiddleware below converts 400 with a helpful hint.
    redirect_slashes=False,
)

# Order matters: outermost first.
# CORS must wrap the rate-limit + request-id middlewares so preflight isn't rate-limited.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining",
        "X-RateLimit-Reset", "Retry-After",
    ],
)
# Configure rate limit buckets from env (override defaults)
# api: 1000/60s/user — a dashboard-heavy SPA fires many calls per page (KPIs, charts,
#   notification/approval polling) + fast navigation; 120 caused false 429s. login: 30/60s/IP
#   keeps brute-force protection while allowing shift-start logins from a shared outlet IP.
rate_limiter.configure("login",       limit=int(os.environ.get("RATE_LIMIT_LOGIN", "30")),       window_sec=60)
rate_limiter.configure("ai",          limit=int(os.environ.get("RATE_LIMIT_AI", "30")),          window_sec=60)
rate_limiter.configure("api",         limit=int(os.environ.get("RATE_LIMIT_API", "1000")),       window_sec=60)
rate_limiter.configure("public_form", limit=int(os.environ.get("RATE_LIMIT_PUBLIC_FORM", "5")),  window_sec=60)

if os.environ.get("RATE_LIMIT_ENABLED", "true").lower() == "true":
    app.add_middleware(RateLimitMiddleware, limiter=rate_limiter)
app.add_middleware(RequestIDMiddleware)
# A8 fix: SEC-003 — Security headers (X-Frame-Options, CSP, HSTS, etc.)
app.add_middleware(SecurityHeadersMiddleware)
# GZip compression for API responses (min 1KB — saves ~60-80% on JSON payloads)
app.add_middleware(GZipMiddleware, minimum_size=1024)


# ── Trailing-slash guard ────────────────────────────────────────────────────
# POLICY: No trailing slashes on API routes.
# Returns 400 with the corrected URL instead of a silent 404.
# This only affects /api/* paths (the backend never receives frontend routes).
@app.middleware("http")
async def reject_trailing_slash(request: Request, call_next):
    path = request.url.path
    if path != "/" and path.endswith("/"):
        clean = path.rstrip("/")
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "code": "TRAILING_SLASH",
                "message": f"Trailing slash tidak diizinkan. Gunakan: {clean}",
            },
        )
    return await call_next(request)


# Global exception handlers — always return our envelope
@app.exception_handler(AuroraException)
async def aurora_exception_handler(_, exc: AuroraException):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope(exc.code, exc.message, exc.field),
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope("HTTP_ERROR", str(exc.detail)),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    errs = [
        {
            "code": "VALIDATION_ERROR",
            "field": ".".join(str(p) for p in e.get("loc", []) if p != "body"),
            "message": e.get("msg", "invalid"),
        }
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"success": False, "data": None, "errors": errs, "meta": None},
    )


# Routers
app.include_router(auth.router)
app.include_router(loyalty.router)
app.include_router(rewards.router)
app.include_router(admin.router)
app.include_router(admin_loyalty.router)
app.include_router(admin_ops.router)
app.include_router(master.router)
app.include_router(notifications.router)
app.include_router(crm_analytics.router)  # Sprint CRM Advanced Analytics
app.include_router(search.router)
app.include_router(seo.router)  # Smart SEO Optimization module
app.include_router(outlet.router)
app.include_router(daily_sales.router)  # Sprint A: daily sales, petty cash, urgent purchase CRUD
app.include_router(procurement.router)
app.include_router(inventory.router)
app.include_router(approvals.router)
app.include_router(approval_matrix.router)  # Phase 15: visual workflow builder
app.include_router(bulk_import.router)  # Sprint D: Bulk Excel Import
app.include_router(ai.router)
app.include_router(finance.router)
app.include_router(payments.router)
app.include_router(payment_runs.router)
app.include_router(payment_run_templates.router)
app.include_router(bank_recon.router)
app.include_router(cash.router)
app.include_router(executive.router)
app.include_router(hr.router)
app.include_router(reports.router)
app.include_router(forecasting.router)
app.include_router(anomalies.router)
app.include_router(uploads.router)
app.include_router(daily_close.router)
app.include_router(kdo_bdo.router)
app.include_router(owner.router)
app.include_router(system_settings.router)
app.include_router(tax.router)
app.include_router(efaktur.router)
app.include_router(fixed_asset.router)
app.include_router(budget.router)
app.include_router(outlet_budget.router)  # Outlet Operational Budget (KDO/FDO/BDO cost control)
app.include_router(ar.router)
app.include_router(leave.router)
app.include_router(telegram.router)
app.include_router(public_content.router)  # Sprint D: Public CMS API
app.include_router(admin_cms.router)
app.include_router(cms_advanced.router)       # Sprint D: Admin CMS CRUD
app.include_router(report_schedules.router) # Sprint E: Scheduled Reports
app.include_router(rfq.router)             # Sprint E: RFQ Flow
app.include_router(ebupot.router)          # Sprint E: e-Bupot PPh23
app.include_router(user_preferences.router) # Sprint F: User Preferences + Dashboard Presets
app.include_router(payment_requests.router) # Fase 1: Payment Request Workflow (Excel Migration)
app.include_router(item_pricing.router)    # Fase 2: Item Price Versioning (Market List multi-periode)
app.include_router(market_list.router)     # Smart Procurement: Market List + Quarterly Pricing
app.include_router(vendor_items.router)    # Smart Procurement: Vendor Item Catalog
app.include_router(reservations.router)    # Reservation Feature: Online booking + outlet management
app.include_router(data_management.router)  # Data Management: Import / Export / Delete
app.include_router(admin_menu.router)      # E-Menu: Admin CMS for menu management
app.include_router(public_menu.router)     # E-Menu: Public menu viewing per brand
app.include_router(tour_analytics.router)  # Help & Tour: analytics event tracking + admin summary

# Mount static files for uploaded images
app.mount("/uploads", StaticFiles(directory="/app/backend/uploads"), name="uploads")


@app.get("/api/health")
async def health():
    """Liveness + db health probe (extended for Phase 10)."""
    from services.metrics_service import health_extended
    return {
        "success": True,
        "data": await health_extended(),
        "errors": None,
        "meta": None,
    }


@app.get("/api/")
async def root():
    return {"success": True, "data": {"app": "FnB Group", "version": "0.3.0"}, "errors": None, "meta": None}


@app.post("/api/errors/client")
async def log_client_error(request: Request):
    """Phase 5 — Receive client-side ErrorBoundary reports. Best-effort, never 500."""
    try:
        body = await request.json()
        logger.warning(f"client_error_boundary ref={body.get('error_ref')} scope={body.get('scope')} msg={body.get('message')}")
    except Exception:
        pass
    return {"success": True, "data": {"logged": True}, "errors": None, "meta": None}
