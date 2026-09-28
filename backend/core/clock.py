"""SSOT-11: business date/time in the configured business timezone (default Asia/Jakarta)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from core.config import settings

TZ = ZoneInfo(settings.timezone)


def now_local() -> datetime:
    return datetime.now(TZ)


def today_local() -> date:
    return now_local().date()


def today_str() -> str:
    return today_local().isoformat()


def period_now() -> str:
    return today_str()[:7]
