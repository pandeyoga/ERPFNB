"""Phase 12B — Symmetric encryption helpers (Fernet) for at-rest secrets.

Resolves the encryption key from these sources, in order:
  1. `SECRETS_ENCRYPTION_KEY` env var (must be 32 url-safe base64 bytes)
  2. Persisted key file at `/app/.app_secret` (auto-generated on first boot)
  3. Throws RuntimeError if neither available (should never happen due to step 2)

Design:
- Plaintext is encoded as: `enc_v1::<fernet_token>` so we can detect ciphertext
  vs legacy plaintext at decryption time. This lets us migrate old plaintext
  values lazily without a hard cutover.
- `decrypt(value)` is idempotent: passing plaintext returns plaintext; passing
  ciphertext returns the original.
- `encrypt(value)` is also idempotent: re-encrypting an already-encrypted value
  is a no-op (returns input as-is).
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("aurora.secrets")

PREFIX = "enc_v1::"
_DEFAULT_KEY_FILE = Path("/app/.app_secret")

_fernet: Optional[Fernet] = None


def _resolve_key_bytes() -> bytes:
    """Load or generate the encryption key. Returns 32-byte url-safe base64."""
    env_key = (os.environ.get("SECRETS_ENCRYPTION_KEY") or "").strip()
    if env_key:
        try:
            # Validate format (Fernet will throw if not exact)
            Fernet(env_key.encode())
            return env_key.encode()
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "SECRETS_ENCRYPTION_KEY is set but invalid (%s); falling back to file-based key",
                e,
            )
    key_file = Path(os.environ.get("SECRETS_KEY_FILE", str(_DEFAULT_KEY_FILE)))
    if key_file.exists():
        try:
            data = key_file.read_bytes().strip()
            Fernet(data)  # validate
            return data
        except Exception as e:  # noqa: BLE001
            logger.warning("Existing key file invalid (%s); regenerating", e)

    # Generate fresh key and persist
    new_key = Fernet.generate_key()
    try:
        key_file.parent.mkdir(parents=True, exist_ok=True)
        key_file.write_bytes(new_key)
        try:
            os.chmod(key_file, 0o600)
        except Exception:  # noqa: BLE001
            pass
        logger.info("Generated new secrets encryption key at %s", key_file)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Could not persist encryption key; will only live for this process"
        )
    return new_key


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_resolve_key_bytes())
    return _fernet


def is_ciphertext(value: str | None) -> bool:
    return bool(value) and isinstance(value, str) and value.startswith(PREFIX)


def encrypt(plaintext: str | None) -> str | None:
    """Encrypt a plaintext string. Idempotent on already-encrypted values."""
    if plaintext is None or plaintext == "":
        return plaintext
    if is_ciphertext(plaintext):
        return plaintext  # already encrypted
    try:
        token = _get_fernet().encrypt(str(plaintext).encode("utf-8")).decode("ascii")
        return f"{PREFIX}{token}"
    except Exception:  # noqa: BLE001
        logger.exception("encrypt failed")
        # If encryption fails, return plaintext (best-effort) so the caller
        # doesn't lose data. The migration step will re-try later.
        return plaintext


def decrypt(value: str | None) -> str | None:
    """Decrypt; if value isn't ciphertext, return as-is (legacy plaintext)."""
    if value is None or value == "":
        return value
    if not is_ciphertext(value):
        return value
    token = value[len(PREFIX):]
    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        logger.error("decrypt failed: invalid Fernet token (key rotated?)")
        return None
    except Exception:  # noqa: BLE001
        logger.exception("decrypt failed")
        return None


def rotate_key(new_key: bytes) -> None:
    """Helper to swap in a new Fernet key for tests / rotation procedure.

    Note: existing ciphertext encrypted with the old key will become
    undecryptable after rotation. Use `MultiFernet` if you need rotation
    without re-encrypting all rows.
    """
    global _fernet
    _fernet = Fernet(new_key)
