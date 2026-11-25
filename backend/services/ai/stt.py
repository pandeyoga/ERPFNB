"""Speech-to-text untuk voice note WhatsApp (opsional).

Claude tidak menerima audio, jadi voice note ditranskripsi dulu oleh server STT yang kompatibel dengan OpenAI
`POST /v1/audio/transcriptions` (mis. faster-whisper-server / whisper.cpp server self-host, atau layanan lain).
Setting: STT_API_URL (wajib; URL penuh endpoint transcriptions), STT_API_KEY (opsional), STT_MODEL (opsional).
Tidak dikonfigurasi → bot membalas bahwa pesan suara belum didukung.
"""
from __future__ import annotations

import logging
from typing import Optional

import aiohttp

from core.runtime_config import get_setting

logger = logging.getLogger("aurora.ai.stt")


async def configured() -> bool:
    return bool(await get_setting("STT_API_URL"))


async def transcribe(data: bytes, mimetype: str = "audio/ogg", *, language: str = "id") -> Optional[str]:
    url = await get_setting("STT_API_URL")
    if not url:
        return None
    key = await get_setting("STT_API_KEY")
    model = await get_setting("STT_MODEL", default="") or "whisper-1"
    ext = {"audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav"}.get((mimetype or "").split(";")[0], "ogg")
    form = aiohttp.FormData()
    form.add_field("file", data, filename=f"voice.{ext}", content_type=(mimetype or "audio/ogg").split(";")[0])
    form.add_field("model", model)
    form.add_field("language", language)
    form.add_field("response_format", "json")
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=120)) as s:
            async with s.post(url, data=form, headers=headers) as r:
                if r.status >= 300:
                    logger.warning("STT %s: %s", r.status, (await r.text())[:200])
                    return None
                body = await r.json(content_type=None)
    except Exception:  # noqa: BLE001
        logger.warning("STT gagal", exc_info=True)
        return None
    text = (body or {}).get("text") if isinstance(body, dict) else None
    return (text or "").strip() or None
