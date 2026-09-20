"""Structured JSON logging configuration with secret redaction.

Phase 10 — Productionization.
"""
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone

# Sensitive field names (case-insensitive) — never log these
_SECRET_KEYS = re.compile(
    r"(password|passwd|pwd|secret|token|api[_-]?key|authorization|bearer|cookie|session)",
    re.IGNORECASE,
)
_REDACTED = "***REDACTED***"


def _redact(value):
    if isinstance(value, dict):
        return {k: (_REDACTED if _SECRET_KEYS.search(str(k)) else _redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


class JsonFormatter(logging.Formatter):
    """Emit each log record as a single-line JSON object."""

    BASE_FIELDS = ("asctime", "levelname", "name", "message")

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Pull common request-scoped extras if attached
        for attr in (
            "request_id", "user_id", "route", "method", "status_code",
            "duration_ms", "client_ip", "user_agent", "error_code",
        ):
            if hasattr(record, attr):
                payload[attr] = getattr(record, attr)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # Redact any extras
        return json.dumps(_redact(payload), default=str, ensure_ascii=False)


def configure_logging(level: str | None = None) -> None:
    """Replace root logger handlers with a JSON stdout handler.
    Idempotent: safe to call multiple times.
    """
    level = (level or os.environ.get("LOG_LEVEL", "INFO")).upper()
    root = logging.getLogger()
    root.setLevel(level)
    # Remove existing handlers (uvicorn adds its own; we want one canonical sink)
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    # Quiet noisy 3rd-parties
    for noisy in ("uvicorn.access", "asyncio", "watchfiles", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel("WARNING")


class DBLogSink(logging.Handler):
    """Optional: persist a sample of log records to Mongo for the Operations UI.
    Buffers records and flushes asynchronously to avoid blocking request loop.
    Usage: configure once during app lifespan AFTER init_db().
    """

    def __init__(self, *, level: int = logging.INFO, sample_rate: float = 1.0,
                 collection_name: str = "log_entries"):
        super().__init__(level=level)
        self.sample_rate = max(0.0, min(1.0, sample_rate))
        self.collection_name = collection_name
        self._buffer: list[dict] = []
        self._max_buffer = 200

    def emit(self, record: logging.LogRecord) -> None:  # noqa: D401
        try:
            import random
            if self.sample_rate < 1.0 and random.random() > self.sample_rate:  # noqa: S311
                return
            doc = {
                "ts": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "msg": record.getMessage(),
            }
            for attr in (
                "request_id", "user_id", "route", "method", "status_code",
                "duration_ms", "client_ip", "error_code",
            ):
                if hasattr(record, attr):
                    doc[attr] = getattr(record, attr)
            self._buffer.append(_redact(doc))
            if len(self._buffer) >= self._max_buffer:
                self._buffer = self._buffer[-self._max_buffer:]
        except Exception:  # noqa: BLE001
            pass

    async def flush_to_db(self) -> int:
        """Drain in-memory buffer into Mongo. Returns number of docs written."""
        if not self._buffer:
            return 0
        try:
            from core.db import get_db
            db = get_db()
            batch, self._buffer = self._buffer, []
            await db[self.collection_name].insert_many(batch, ordered=False)
            return len(batch)
        except Exception:  # noqa: BLE001
            return 0


# Module-level singleton (created lazily by middleware)
_db_sink: DBLogSink | None = None


def get_db_sink() -> DBLogSink:
    global _db_sink
    if _db_sink is None:
        sample = float(os.environ.get("LOG_DB_SAMPLE_RATE", "1.0"))
        _db_sink = DBLogSink(sample_rate=sample)
        logging.getLogger().addHandler(_db_sink)
    return _db_sink
