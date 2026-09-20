"""Accounting period CRUD."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import ValidationError
from services._period._common import _now, _valid_period


async def list_periods(*, year: Optional[int] = None) -> list[dict]:
    """List all accounting periods, sorted by period DESC.
    Auto-fills missing months for current year.
    """
    db = get_db()
    q: dict = {}
    if year is not None:
        q["fiscal_year"] = year
    items = await db.accounting_periods.find(q).sort([("period", -1)]).to_list(500)
    existing = {p["period"] for p in items}

    today = datetime.now(timezone.utc)
    target_year = year if year is not None else today.year
    for m in range(1, 13):
        period = f"{target_year:04d}-{m:02d}"
        if period not in existing:
            doc = {
                "id": str(uuid.uuid4()),
                "period": period,
                "fiscal_year": target_year,
                "status": "open",
                "auto_created": True,
                "created_at": _now(),
                "updated_at": _now(),
            }
            try:
                await db.accounting_periods.insert_one(doc)
                items.append(doc)
            except Exception:  # noqa: BLE001
                pass
    items.sort(key=lambda p: p.get("period", ""), reverse=True)
    return [serialize(p) for p in items]


async def get_period(period: str) -> dict:
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        if not _valid_period(period):
            raise ValidationError("period harus YYYY-MM")
        doc = {
            "id": str(uuid.uuid4()),
            "period": period,
            "fiscal_year": int(period.split("-")[0]),
            "status": "open",
            "auto_created": True,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.accounting_periods.insert_one(doc)
        return serialize(doc)
    return serialize(p)
