"""System Settings service — thin facade.

All logic lives in services/_system_settings/. This file re-exports the public API
so all existing routers continue to work with zero changes.
"""
from services._system_settings import (  # noqa: F401
    KNOWN_SETTINGS,
    COLLECTION,
    _now,
    _mask,
    _ensure_index,
    _meta_for,
    _is_secret_key,
    get_value,
    list_settings,
    set_value,
    delete_value,
    _audit,
    encrypt_legacy_plaintext_secrets,
)
