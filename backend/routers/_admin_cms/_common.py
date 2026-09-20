"""Shared helpers + constants for admin_cms sub-routers."""
from pathlib import Path


def _ser(doc):
    """Serialize datetime objects to ISO strings."""
    if isinstance(doc, dict):
        return {k: _ser(v) for k, v in doc.items() if k != "_id"}
    if isinstance(doc, list):
        return [_ser(i) for i in doc]
    if hasattr(doc, "isoformat"):
        return doc.isoformat()
    return doc


# Configure upload directory
UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed image types and max size
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_SIZE_MB = 5
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
