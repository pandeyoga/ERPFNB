"""Generate next document number per series code (atomic)."""
from pymongo import ReturnDocument

from core.clock import now_local
from core.db import get_db
from core.exceptions import NotFoundError


def _reset_key(series: dict, now) -> str | None:
    """SSOT-12: reset only when the format carries the period token (otherwise numbers would collide)."""
    fmt, reset = series.get("format", ""), series.get("reset", "never")
    has_year = "{YY}" in fmt or "{YYYY}" in fmt
    if reset == "monthly" and has_year and "{MM}" in fmt:
        return now.strftime("%Y%m")
    if reset in ("monthly", "yearly") and has_year:
        return now.strftime("%Y")
    return None


async def next_doc_no(code: str) -> str:
    """Atomically increment & format (WIB clock)."""
    db = get_db()
    cfg = await db.number_series.find_one({"code": code})
    if not cfg and any(d["code"] == code for d in DEDICATED_SERIES):
        await ensure_dedicated_series()
        cfg = await db.number_series.find_one({"code": code})
    if not cfg:
        raise NotFoundError(f"Number series '{code}' not configured")
    now = now_local()
    key = _reset_key(cfg, now)
    after = ReturnDocument.AFTER
    if key is None:
        series = await db.number_series.find_one_and_update({"code": code}, {"$inc": {"current_value": 1}}, return_document=after)
    else:
        series = await db.number_series.find_one_and_update(
            {"code": code, "$or": [{"reset_key": key}, {"reset_key": {"$exists": False}}]},
            {"$inc": {"current_value": 1}, "$set": {"reset_key": key}}, return_document=after)
        if not series:  # new period → restart at 1 (only one writer wins; others fall through to $inc)
            series = await db.number_series.find_one_and_update(
                {"code": code, "reset_key": {"$ne": key}},
                {"$set": {"current_value": 1, "reset_key": key}}, return_document=after)
        if not series:
            series = await db.number_series.find_one_and_update(
                {"code": code, "reset_key": key}, {"$inc": {"current_value": 1}}, return_document=after)
    fmt = series.get("format", f"{code}-{{0000}}")
    padding = int(series.get("padding", 4))
    return (fmt.replace("{YYYY}", now.strftime("%Y")).replace("{YY}", now.strftime("%y"))
               .replace("{MM}", now.strftime("%m")).replace("{0000}", str(series["current_value"]).zfill(padding)))


DEDICATED_SERIES = [
    {"code": "PAYR", "prefix": "PAYR", "format": "PAYR-{YY}{MM}-{0000}", "padding": 4, "reset": "monthly"},
    {"code": "UP", "prefix": "UP", "format": "UP-{YY}{MM}-{0000}", "padding": 4, "reset": "monthly"},
    {"code": "LR", "prefix": "LR", "format": "LR-{YYYY}-{0000}", "padding": 4, "reset": "yearly"},
]


async def ensure_dedicated_series() -> None:
    """B3: payroll, urgent purchase and leave get their own series (no sharing PAY/PR)."""
    import uuid
    db = get_db()
    for s in DEDICATED_SERIES:
        await db.number_series.update_one({"code": s["code"]}, {"$setOnInsert": {
            **s, "id": str(uuid.uuid4()), "current_value": 0, "deleted_at": None}}, upsert=True)
