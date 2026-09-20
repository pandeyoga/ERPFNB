"""Bank recon shared constants and helpers."""
import logging
from datetime import datetime

logger = logging.getLogger("aurora.bank_recon")

DEFAULT_DATE_TOL_DAYS = 3
DEFAULT_AMOUNT_TOL = 1000  # Rp 1.000


def _now() -> str:
    return datetime.now().isoformat()
