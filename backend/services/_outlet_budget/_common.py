"""Shared imports + tiny helpers for outlet_budget package."""
from datetime import datetime, date, timezone

from core.audit import log as audit_log  # noqa: F401
from core.db import get_db, serialize  # noqa: F401
from core.exceptions import NotFoundError, ValidationError  # noqa: F401
from models.outlet_budget import BUCKETS  # noqa: F401


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> date:
    return datetime.now(timezone.utc).date()
