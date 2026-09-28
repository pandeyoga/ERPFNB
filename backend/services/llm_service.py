"""Phase 12C \u2014 Unified LLM client resolution.

Wraps `emergentintegrations.llm.chat.LlmChat` so all AI services use the same
config resolution and provider selection.

Resolution order for the API key:
  1. `EMERGENT_LLM_KEY` (DB > env) \u2014 used by default
  2. `OPENAI_API_KEY` if `LLM_PROVIDER_PRIMARY == openai`
  3. `ANTHROPIC_API_KEY` if `LLM_PROVIDER_PRIMARY == anthropic`
  4. `GEMINI_API_KEY` if `LLM_PROVIDER_PRIMARY == gemini`

Provider/model resolution:
  - `LLM_PROVIDER_PRIMARY` \u2014 default 'gemini'
  - `LLM_MODEL_TEXT` \u2014 default 'gemini-2.5-flash'
  - `LLM_MODEL_OCR`  \u2014 default 'gemini-2.5-flash'

NOTE: emergentintegrations LlmChat accepts the universal Emergent key OR a
direct provider key. When using a direct provider key, the `provider/model`
combo must be valid for that key.
"""
from __future__ import annotations

import logging
from typing import Optional

from core.config import settings
from core.runtime_config import get_setting

logger = logging.getLogger("aurora.llm")


_DEFAULT_PROVIDER = "gemini"
_DEFAULT_TEXT_MODEL = "gemini-2.5-flash"
_DEFAULT_OCR_MODEL = "gemini-2.5-flash"


async def resolve_llm_key() -> Optional[str]:
    """Pick the best LLM API key based on `LLM_PROVIDER_PRIMARY`.

    Falls back to settings.emergent_llm_key (env-baked at process start).
    """
    primary = ((await get_setting("LLM_PROVIDER_PRIMARY")) or "emergent").strip().lower()

    if primary == "openai":
        k = await get_setting("OPENAI_API_KEY")
        if k:
            return k
    elif primary == "anthropic":
        k = await get_setting("ANTHROPIC_API_KEY")
        if k:
            return k
    elif primary == "gemini":
        k = await get_setting("GEMINI_API_KEY")
        if k:
            return k

    # Default: emergent universal key (DB > env > module-level cache)
    db_key = await get_setting("EMERGENT_LLM_KEY")
    if db_key:
        return db_key
    return settings.emergent_llm_key or None


async def resolve_provider_and_model(*, kind: str = "text") -> tuple[str, str]:
    """Return (provider, model) for the given kind ('text' | 'ocr')."""
    provider_setting = ((await get_setting("LLM_PROVIDER_PRIMARY")) or "").strip().lower()
    # If provider override is for a direct provider, map it to LlmChat namespace
    if provider_setting == "openai":
        provider = "openai"
    elif provider_setting == "anthropic":
        provider = "anthropic"
    elif provider_setting == "gemini":
        provider = "gemini"
    else:
        provider = _DEFAULT_PROVIDER  # emergent universal default

    if kind == "ocr":
        model = (await get_setting("LLM_MODEL_OCR")) or _DEFAULT_OCR_MODEL
    else:
        model = (await get_setting("LLM_MODEL_TEXT")) or _DEFAULT_TEXT_MODEL
    return provider, model


async def is_llm_available() -> bool:
    if not settings.feature_ai_enabled:
        return False
    return bool(await resolve_llm_key())


async def make_chat(
    *,
    session_id: str,
    system_message: str,
    kind: str = "text",
):
    """Construct a configured LlmChat. Returns (chat, error?)."""
    if not settings.feature_ai_enabled:
        return None, "ai_disabled"
    api_key = await resolve_llm_key()
    if not api_key:
        return None, "no_api_key"
    try:
        from emergentintegrations.llm.chat import LlmChat  # type: ignore
        provider, model = await resolve_provider_and_model(kind=kind)
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message,
        ).with_model(provider, model)
        return chat, None
    except Exception as e:  # noqa: BLE001
        logger.exception("make_chat failed: %s", e)
        return None, f"llm_init_failed:{e}"


async def quick_test(prompt: str = "Reply with the single word: OK", *, kind: str = "text") -> dict:
    """Send a minimal prompt through the configured LLM and report status.

    Used by Admin Integrations Hub \"Test LLM\" button.
    """
    import time
    if not settings.feature_ai_enabled:
        return {"ok": False, "reason": "ai_disabled"}
    api_key = await resolve_llm_key()
    if not api_key:
        return {"ok": False, "reason": "no_api_key"}
    chat, err = await make_chat(session_id=f"llm-test-{int(time.time())}", system_message="You are a helpful assistant. Reply ONLY with the answer.")
    if not chat:
        return {"ok": False, "reason": err or "init_failed"}
    try:
        from emergentintegrations.llm.chat import UserMessage  # type: ignore
        t0 = time.perf_counter()
        resp = await chat.send_message(UserMessage(text=prompt))
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        provider, model = await resolve_provider_and_model(kind=kind)
        return {
            "ok": True,
            "provider": provider,
            "model": model,
            "elapsed_ms": elapsed_ms,
            "response": (str(resp) or "").strip()[:300],
        }
    except Exception as e:  # noqa: BLE001
        logger.exception("LLM quick_test failed")
        return {"ok": False, "reason": "llm_error", "error": str(e)[:300]}
