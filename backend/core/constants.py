"""Centralized constants — Sprint E5.

Extracted magic numbers and configuration defaults to eliminate scattered
hardcoded values across services and routers.
"""

# ---------------------------------------------------------------------------
# Pagination & Query Limits
# ---------------------------------------------------------------------------
MAX_PAGE_SIZE: int = 500          # Hard cap on per_page / limit
DEFAULT_PAGE_SIZE: int = 20       # Default items per page
MAX_EXPORT_ROWS: int = 10_000     # Max rows for Excel/PDF export
MAX_REPORT_ROWS: int = 1_000      # Max rows for in-app report tables
MAX_AUDIT_ROWS: int = 500         # Max rows for audit log queries
MAX_SEARCH_RESULTS: int = 100     # Max global search results

# ---------------------------------------------------------------------------
# Tax Rates (Indonesia)
# ---------------------------------------------------------------------------
PPN_DEFAULT_RATE: float = 0.12    # 12% PPN (Perpu 2/2024, efektif 2025)
PPH_21_DEFAULT_RATE: float = 0.05  # PPh 21 default progressive rate
PPH_23_DEFAULT_RATE: float = 0.02  # PPh 23 withholding (jasa)
PPH_4_2_FINAL_RATE: float = 0.01   # PPh 4(2) final rate (sewa tanah/bangunan)

# ---------------------------------------------------------------------------
# Token & Auth
# ---------------------------------------------------------------------------
ACCESS_TOKEN_DEFAULT_MINUTES: int = 30   # JWT access token TTL
REFRESH_TOKEN_DEFAULT_DAYS: int = 7      # JWT refresh token TTL
BCRYPT_ROUNDS: int = 12                  # bcrypt cost factor

# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------
AUDIT_LOG_RETENTION_DAYS: int = 365      # Default retention before sweep

# ---------------------------------------------------------------------------
# AI / LLM
# ---------------------------------------------------------------------------
AI_CHAT_SESSION_TTL_DAYS: int = 90       # Auto-expire inactive chat sessions
AI_RATE_LIMIT_PER_MIN: int = 30          # Per-user AI request rate limit
AI_MAX_CONTEXT_MESSAGES: int = 50        # Max history messages in LLM context

# ---------------------------------------------------------------------------
# Upload / File Handling
# ---------------------------------------------------------------------------
MAX_UPLOAD_SIZE_MB: int = 10             # Max file upload size
ALLOWED_IMAGE_MIME_TYPES: tuple = (
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
)
ALLOWED_DOCUMENT_MIME_TYPES: tuple = (
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.ms-excel",  # xls
)

# ---------------------------------------------------------------------------
# Database Connection Pool
# ---------------------------------------------------------------------------
DB_POOL_MIN_SIZE: int = 10
DB_POOL_MAX_SIZE: int = 50

# ---------------------------------------------------------------------------
# Anomaly Detection Defaults
# (actual thresholds can be overridden via business_rules collection)
# ---------------------------------------------------------------------------
ANOMALY_SALES_DEVIATION_PCT: float = 0.30    # 30% deviation triggers flag
ANOMALY_VENDOR_PRICE_SPIKE_PCT: float = 0.20  # 20% price spike
ANOMALY_VENDOR_LEAD_TIME_DAYS: int = 7        # Lead time > 7d triggers flag

# ---------------------------------------------------------------------------
# Scheduler Jobs
# ---------------------------------------------------------------------------
NOTIFICATION_READ_RETENTION_DAYS: int = 30   # Keep read notifications for 30d
REFRESH_TOKEN_SWEEP_DAYS: int = 1            # Sweep expired tokens daily
