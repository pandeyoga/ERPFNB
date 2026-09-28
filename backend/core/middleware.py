"""Phase 10 ASGI middlewares: request_id + access logging + rate limiting + security headers."""
import logging
import time
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .rate_limiter import RateLimiter, RateLimitDecision

import os as _os

_LOOPBACK_BYPASS = _os.environ.get("RATE_LIMIT_BYPASS_LOOPBACK", "false").lower() == "true"
_TRUSTED_PROXY_HOPS = int(_os.environ.get("TRUSTED_PROXY_HOPS", "1"))


def client_ip(request: Request) -> str:
    """SEC-17: take the IP appended by our trusted proxy chain (right side of XFF), not the client-controlled left side."""
    xff = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    if xff and _TRUSTED_PROXY_HOPS > 0:
        return xff[-min(_TRUSTED_PROXY_HOPS, len(xff))]
    return request.client.host if request.client else "unknown"

logger = logging.getLogger("aurora.access")

_X_REQ_ID = "X-Request-ID"

# CSP baseline untuk React SPA (unsafe-inline dibutuhkan untuk styled-components/TailwindCSS)
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob: https:; "
    "connect-src 'self' wss:; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self';"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Tambah security headers ke semua response (A8 fix: SEC-003)."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        resp = await call_next(request)
        # Skip security headers untuk preflight CORS (browser menangani sendiri)
        if request.method == "OPTIONS":
            return resp
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        resp.headers["Content-Security-Policy"] = _CSP
        return resp


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Generate atau propagate X-Request-ID dan time request.
    Attaches request_id ke request.state dan ke setiap log record via contextvars.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        rid = request.headers.get(_X_REQ_ID) or str(uuid.uuid4())
        request.state.request_id = rid
        request.state.start_ns = time.perf_counter_ns()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter_ns() - request.state.start_ns) / 1e6
            logger.exception(
                "unhandled_exception",
                extra={
                    "request_id": rid,
                    "route": request.url.path,
                    "method": request.method,
                    "duration_ms": round(duration_ms, 2),
                    "status_code": 500,
                },
            )
            raise
        duration_ms = (time.perf_counter_ns() - request.state.start_ns) / 1e6
        response.headers[_X_REQ_ID] = rid
        # Access log line
        try:
            client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
                request.client.host if request.client else "-"
            )
            user_id = getattr(request.state, "user_id", None)
            level = logging.INFO if response.status_code < 500 else logging.ERROR
            logger.log(
                level,
                f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)",
                extra={
                    "request_id": rid,
                    "route": request.url.path,
                    "method": request.method,
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                    "client_ip": client_ip,
                    "user_id": user_id,
                },
            )
            # Track in metrics (lightweight, in-memory)
            from services import metrics_service
            metrics_service.record_request(
                route=request.url.path,
                method=request.method,
                status_code=response.status_code,
                duration_ms=duration_ms,
            )
        except Exception:  # noqa: BLE001
            pass
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter untuk /api/* routes.

    Buckets:
      - login:       10 req/min per (email-or-ip)
      - ai:          30 req/min per user_id       (heavy LLM calls)
      - public_form:  5 req/min per ip             (anti-spam forms publik)
      - api:       1000 req/min per user_id        (general)
    Excluded routes: /api/health, /api/, OPTIONS preflight.
    """

    EXCLUDED = ("/api/health", "/api/", "/api/telegram/webhook")

    # Route prefix yang termasuk bucket public_form (anti-spam)
    PUBLIC_FORM_PATHS = (
        "/api/public/reservations",
        "/api/public/jobs/apply",
        "/api/loyalty/register",
        "/api/public/analytics/track",
    )

    def __init__(self, app, limiter: RateLimiter):
        super().__init__(app)
        self.limiter = limiter

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if request.method == "OPTIONS" or not path.startswith("/api/") or path in self.EXCLUDED:
            return await call_next(request)
        # SEC-17: bypass only for a real loopback socket (never from a client header), opt-in via env
        peer = request.client.host if request.client else ""
        if _LOOPBACK_BYPASS and peer in ("127.0.0.1", "::1") and not request.headers.get("x-forwarded-for"):
            return await call_next(request)

        bucket, key = self._classify(request)
        decision: RateLimitDecision = await self.limiter.check(bucket, key)
        if not decision.allowed:
            from core.exceptions import error_envelope
            resp = JSONResponse(
                status_code=429,
                content=error_envelope(
                    "RATE_LIMIT_EXCEEDED",
                    f"Terlalu banyak request. Coba lagi dalam {decision.retry_after_sec} detik.",
                ),
            )
            self._apply_headers(resp, decision)
            return resp
        response = await call_next(request)
        self._apply_headers(response, decision)
        return response

    def _classify(self, request: Request) -> tuple[str, str]:
        path = request.url.path
        method = request.method
        if path.startswith("/api/auth/login"):
            return "login", client_ip(request)
        if any(path.startswith(p) for p in ("/api/loyalty/login", "/api/loyalty/auth/login", "/api/public/loyalty/login")):
            return "login", client_ip(request)
        if path.startswith("/api/ai/") or path.startswith("/api/executive/qa"):
            uid = self._user_key(request)
            return "ai", uid
        # Anti-spam untuk public form endpoints (POST only)
        if method == "POST" and any(path.startswith(p) for p in self.PUBLIC_FORM_PATHS):
            return "public_form", client_ip(request)
        return "api", self._user_key(request)

    @staticmethod
    def _user_key(request: Request) -> str:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            # SEC-17: key by verified JWT subject; random/forged tokens fall back to the client IP
            try:
                import jwt as _jwt
                from core.config import settings as _s
                sub = _jwt.decode(auth.split(" ", 1)[1].strip(), _s.jwt_secret, algorithms=[_s.jwt_algorithm]).get("sub")
                if sub:
                    return f"user:{sub}"
            except Exception:  # noqa: BLE001
                pass
        return f"ip:{client_ip(request)}"

    @staticmethod
    def _apply_headers(response: Response, decision: RateLimitDecision) -> None:
        response.headers["X-RateLimit-Limit"] = str(decision.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, decision.remaining))
        response.headers["X-RateLimit-Reset"] = str(decision.reset_unix)
        if not decision.allowed:
            response.headers["Retry-After"] = str(decision.retry_after_sec)
