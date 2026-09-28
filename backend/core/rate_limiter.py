"""In-memory token-bucket rate limiter (Phase 10).

Lightweight, dependency-free. Per-key sliding-window counters keyed on bucket.
If you need persistence across restarts, set persist=True (Mongo backed).
"""
import asyncio
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    reset_unix: int
    retry_after_sec: int


class RateLimiter:
    DEFAULT_BUCKETS = {
        "login":       (10, 60),   # 10 req per 60s per ip
        "ai":          (30, 60),   # 30 req per 60s per user
        "public_form": (5,  60),   # 5 req per 60s per ip (anti-spam A9 fix)
        "api":         (1000, 60), # 1000 req per 60s per user (general; raised to avoid false 429s during fast SPA navigation + dashboard polling)
    }

    def __init__(self, buckets: Optional[dict] = None):
        self.buckets = buckets or dict(self.DEFAULT_BUCKETS)
        # in-memory store: key -> (window_start, count)
        self._store: dict[str, tuple[float, int]] = {}
        self._lock = asyncio.Lock()

    def configure(self, bucket: str, *, limit: int, window_sec: int) -> None:
        self.buckets[bucket] = (limit, window_sec)

    async def check(self, bucket: str, key: str) -> RateLimitDecision:
        cfg = self.buckets.get(bucket) or self.buckets["api"]
        limit, window = cfg
        now = time.time()
        ck = f"{bucket}:{key}"
        async with self._lock:
            window_start, count = self._store.get(ck, (now, 0))
            if now - window_start >= window:
                # Reset window
                window_start, count = now, 0
            count += 1
            self._store[ck] = (window_start, count)
        reset_unix = int(window_start + window)
        remaining = max(0, limit - count)
        if count > limit:
            return RateLimitDecision(
                allowed=False, limit=limit, remaining=0,
                reset_unix=reset_unix,
                retry_after_sec=max(1, reset_unix - int(now)),
            )
        return RateLimitDecision(
            allowed=True, limit=limit, remaining=remaining,
            reset_unix=reset_unix,
            retry_after_sec=0,
        )

    async def reset(self, bucket: str | None = None, key: str | None = None) -> int:
        """Reset counters. If bucket+key given, only that key. Returns count cleared."""
        async with self._lock:
            if bucket and key:
                return 1 if self._store.pop(f"{bucket}:{key}", None) else 0
            if bucket:
                pre = f"{bucket}:"
                victims = [k for k in self._store if k.startswith(pre)]
                for k in victims:
                    self._store.pop(k, None)
                return len(victims)
            n = len(self._store)
            self._store.clear()
            return n

    def stats(self) -> dict:
        """Diagnostic: top hits per bucket."""
        out: dict[str, list[dict]] = {b: [] for b in self.buckets}
        for ck, (start, count) in self._store.items():
            try:
                bucket, key = ck.split(":", 1)
            except ValueError:
                continue
            out.setdefault(bucket, []).append({"key": key, "count": count, "window_start": int(start)})
        for b in out:
            out[b].sort(key=lambda r: r["count"], reverse=True)
            out[b] = out[b][:20]
        return out


# Module-level singleton
limiter = RateLimiter()
