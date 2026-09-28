"""Lightweight in-memory metrics + DB stats accessor (Phase 10)."""
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

from core.db import get_db

# In-memory counters
_started_at = time.time()
_total_requests = 0
_total_errors = 0  # 5xx
_total_4xx = 0
_status_counts: dict[int, int] = defaultdict(int)
_method_counts: dict[str, int] = defaultdict(int)
_route_counts: dict[str, int] = defaultdict(int)
_route_durations: dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
# Sliding window of last 60s for r/s
_recent_requests: deque = deque(maxlen=10000)


def record_request(*, route: str, method: str, status_code: int, duration_ms: float) -> None:
    global _total_requests, _total_errors, _total_4xx
    _total_requests += 1
    _status_counts[status_code] += 1
    _method_counts[method] += 1
    # Bucket noisy id-paths by first 4 segments
    parts = route.split("/")
    norm = "/".join(parts[:5]) if len(parts) > 5 else route
    _route_counts[norm] += 1
    _route_durations[norm].append(duration_ms)
    _recent_requests.append((time.time(), status_code))
    if status_code >= 500:
        _total_errors += 1
    elif status_code >= 400:
        _total_4xx += 1


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = int(len(s) * p)
    return s[min(k, len(s) - 1)]


async def collect_metrics() -> dict[str, Any]:
    db = get_db()
    now = time.time()
    cutoff_60s = now - 60
    last_min = [s for ts, s in _recent_requests if ts >= cutoff_60s]
    rps = len(last_min) / 60.0 if last_min else 0.0
    err_min = sum(1 for s in last_min if s >= 500)
    error_rate = (err_min / len(last_min)) if last_min else 0.0

    # Top-N routes by latency
    top_routes: list[dict] = []
    for r, durations in _route_durations.items():
        if not durations:
            continue
        vals = list(durations)
        top_routes.append({
            "route": r,
            "count": _route_counts.get(r, 0),
            "avg_ms": round(sum(vals) / len(vals), 2),
            "p95_ms": round(_percentile(vals, 0.95), 2),
            "max_ms": round(max(vals), 2),
        })
    top_routes.sort(key=lambda x: x["p95_ms"], reverse=True)

    # DB collection counts (cheap estimated)
    collections_to_count = [
        "users", "roles", "audit_log", "notifications", "log_entries",
        "daily_sales", "purchase_requests", "purchase_orders", "goods_receipts",
        "journal_entries", "journal_lines", "ap_ledgers",
        "inventory_movements", "anomaly_events", "refresh_tokens",
    ]
    coll_counts: dict[str, int] = {}
    for c in collections_to_count:
        try:
            coll_counts[c] = await db[c].estimated_document_count()
        except Exception:  # noqa: BLE001
            coll_counts[c] = -1

    # Active users (last 60 min by audit_log/login)
    try:
        active_users = await db.audit_log.count_documents({
            "action": "login",
            "timestamp": {"$gte": (datetime.now(timezone.utc).replace(microsecond=0).isoformat()[:13])}
        }) if False else 0
    except Exception:  # noqa: BLE001
        active_users = 0

    return {
        "uptime_sec": round(now - _started_at, 1),
        "started_at": datetime.fromtimestamp(_started_at, tz=timezone.utc).isoformat(),
        "requests": {
            "total": _total_requests,
            "5xx": _total_errors,
            "4xx": _total_4xx,
            "rps_last_min": round(rps, 2),
            "error_rate_last_min": round(error_rate, 4),
            "by_status": dict(_status_counts),
            "by_method": dict(_method_counts),
        },
        "top_slow_routes": top_routes[:10],
        "collection_counts": coll_counts,
        "active_users_estimate": active_users,
    }


async def health_extended() -> dict[str, Any]:
    db = get_db()
    t0 = time.perf_counter()
    db_ok = True
    try:
        await db.command("ping")
    except Exception:  # noqa: BLE001
        db_ok = False
    db_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "version": "0.3.0",
        "status": "ok" if db_ok else "degraded",
        "db": "ok" if db_ok else "down",
        "db_latency_ms": db_latency_ms,
        "uptime_sec": round(time.time() - _started_at, 1),
    }
