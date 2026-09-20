"""AI Receipt OCR Service — Phase 5 + Phase 8C cache layer.

Uses emergentintegrations.LlmChat with Gemini 2.5 Flash (vision) to extract
structured data from receipt images. Non-blocking: callers should handle
empty/error responses gracefully (manual entry fallback).

Phase 8C additions:
- SHA-256 image cache (collection: ocr_receipt_cache). Identical images
  short-circuit the LLM call → fast fast-path (no LLM cost or latency).
- extract_from_file_id(file_id) loads bytes via upload_service then runs
  the cached extraction.
"""
import base64
import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.config import settings
from core.db import get_db
from core.runtime_config import get_setting

logger = logging.getLogger("aurora.ai_ocr")


# Strict prompt; model returns JSON only.
SYSTEM_PROMPT = """You extract structured data from F&B receipt photos (typically Indonesian).
Return STRICT JSON ONLY — no prose, no code fences. Schema:
{
  "vendor_name": "<string or null>",
  "vendor_npwp": "<string or null>",
  "receipt_no": "<string or null>",
  "receipt_date": "<YYYY-MM-DD or null>",
  "subtotal": <number or 0>,
  "tax": <number or 0>,
  "service": <number or 0>,
  "total": <number or 0>,
  "items": [
    {"name": "<string>", "qty": <number>, "unit": "<string or null>",
     "price": <number>, "total": <number>}
  ],
  "currency": "IDR",
  "confidence_overall": <0..1>,
  "confidence_per_field": {
    "vendor_name": <0..1>, "receipt_date": <0..1>, "total": <0..1>, "items": <0..1>
  }
}
Notes:
- Use Indonesian Rupiah (no decimals usually).
- If unsure, set fields null/0 and lower confidence.
- Output ONLY the JSON object, nothing else.
"""

ALLOWED_MIME = ("image/jpeg", "image/jpg", "image/png", "image/webp")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _f(v) -> float:
    """Safely coerce a number-like value to float; tolerate Indonesian
    formatting (Rp 1.234.567 / Rp 1,234,567)."""
    try:
        if v is None:
            return 0.0
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip()
        # strip currency / spaces
        s = re.sub(r"[A-Za-z\s]", "", s)
        # If both . and , present, treat last separator as decimal
        if "." in s and "," in s:
            if s.rfind(",") > s.rfind("."):
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        else:
            # Indonesian thousands often use dot. If there are 3 digits after
            # the last dot we treat all dots as thousands.
            if s.count(".") >= 1:
                parts = s.split(".")
                if all(len(p) == 3 for p in parts[1:]):
                    s = "".join(parts)
            s = s.replace(",", "")
        return float(s) if s else 0.0
    except Exception:  # noqa: BLE001
        return 0.0


def _normalize_parsed(parsed: dict) -> dict:
    """Coerce the LLM JSON output into our canonical OCR result shape."""
    items_norm = []
    for it in parsed.get("items", []) or []:
        items_norm.append({
            "name": (it.get("name") or "").strip() or None,
            "qty": _f(it.get("qty")),
            "unit": it.get("unit") or None,
            "price": _f(it.get("price")),
            "total": _f(it.get("total")),
        })
    return {
        "vendor_name": parsed.get("vendor_name") or None,
        "vendor_npwp": parsed.get("vendor_npwp") or None,
        "receipt_no": parsed.get("receipt_no") or None,
        "receipt_date": parsed.get("receipt_date") or None,
        "subtotal": _f(parsed.get("subtotal")),
        "tax": _f(parsed.get("tax")),
        "service": _f(parsed.get("service")),
        "total": _f(parsed.get("total")),
        "currency": parsed.get("currency") or "IDR",
        "items": items_norm,
        "confidence_overall": float(parsed.get("confidence_overall") or 0),
        "confidence_per_field": parsed.get("confidence_per_field") or {},
    }


def _hash_b64(image_base64: str) -> str:
    return hashlib.sha256(image_base64.encode("ascii")).hexdigest()


async def _cache_get(image_hash: str) -> Optional[dict]:
    try:
        db = get_db()
        rec = await db.ocr_receipt_cache.find_one({"image_hash": image_hash})
        if rec:
            return rec.get("result")
    except Exception:  # noqa: BLE001
        return None
    return None


async def _cache_set(image_hash: str, mime_type: str, result: dict,
                     source_hint: Optional[str] = None) -> None:
    try:
        db = get_db()
        await db.ocr_receipt_cache.update_one(
            {"image_hash": image_hash},
            {
                "$set": {
                    "image_hash": image_hash,
                    "mime_type": mime_type,
                    "result": result,
                    "updated_at": _now_iso(),
                    "source_hint": source_hint,
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": _now_iso(),
                },
                "$inc": {"hits": 1},
            },
            upsert=True,
        )
    except Exception:  # noqa: BLE001
        logger.warning("OCR cache write failed", exc_info=True)


async def _call_llm(image_base64: str, mime_type: str) -> dict:
    """Raw LLM call. Returns either the OCR result dict or {"error": ...}."""
    llm_key = await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)
    ocr_model = await get_setting("LLM_MODEL_OCR", default="gemini-2.5-flash")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"ocr-{uuid.uuid4().hex[:12]}",
            system_message=SYSTEM_PROMPT,
        ).with_model("gemini", ocr_model or "gemini-2.5-flash")
        image_content = ImageContent(image_base64=image_base64)
        message = UserMessage(
            text="Extract the structured fields from this receipt. Output JSON only.",
            file_contents=[image_content],
        )
        resp = await chat.send_message(message)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"LLM vision call failed: {e}")
        return {"error": f"OCR failed: {str(e)[:200]}"}

    if not resp:
        return {}

    raw = str(resp).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        logger.warning(f"No JSON detected in OCR response: {raw[:200]}")
        return {"error": "AI response could not be parsed", "raw": raw[:300]}
    try:
        parsed = json.loads(m.group(0))
    except json.JSONDecodeError as e:
        logger.warning(f"OCR JSON parse failed: {e}")
        return {"error": "AI response not valid JSON", "raw": m.group(0)[:300]}
    return _normalize_parsed(parsed)


async def extract_receipt(
    *,
    image_base64: str,
    mime_type: str = "image/jpeg",
    use_cache: bool = True,
    source_hint: Optional[str] = None,
) -> dict:
    """Extract OCR fields from a base64 image.

    On any failure → returns dict with optional 'error' key (caller falls back
    to manual). On success returns the canonical OCR result shape.
    """
    if not settings.feature_ai_enabled or not (await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)):
        logger.warning("AI not enabled or key missing — skipping OCR")
        return {"error": "AI OCR is not configured. Manual entry required."}
    if not image_base64:
        return {"error": "image_base64 required"}
    if mime_type not in ALLOWED_MIME:
        return {"error": f"MIME type {mime_type} not supported. Use JPEG/PNG/WEBP."}
    # Sanity: limit huge payloads (>6MB base64) to avoid runaway latency
    if len(image_base64) > 6_000_000:
        logger.warning("Receipt image too large for OCR (>6MB base64)")
        return {"error": "Image too large; please attach a smaller photo (<4MB)."}

    image_hash = _hash_b64(image_base64)

    if use_cache:
        cached = await _cache_get(image_hash)
        if cached:
            return {**cached, "_cache_hit": True, "_image_hash": image_hash}

    result = await _call_llm(image_base64, mime_type)
    if not result or result.get("error"):
        return result or {"error": "Empty response"}

    # Persist on success
    await _cache_set(image_hash, mime_type, result, source_hint=source_hint)
    return {**result, "_cache_hit": False, "_image_hash": image_hash}


async def extract_from_file_id(
    file_id: str, *, use_cache: bool = True, user: Optional[dict] = None,
) -> dict:
    """Run OCR on an existing uploaded attachment (Phase 8B integration)."""
    from services import upload_service
    meta = await upload_service.get_attachment(file_id, user=user)
    path = await upload_service.get_attachment_path(file_id, user=user)
    mime = (meta.get("content_type") or "image/jpeg").lower()
    if mime not in ALLOWED_MIME:
        return {"error": f"File MIME {mime} bukan gambar yang didukung."}
    raw = path.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    return await extract_receipt(
        image_base64=b64,
        mime_type=mime,
        use_cache=use_cache,
        source_hint=f"file_id={file_id}",
    )


async def cache_stats() -> dict:
    """Expose cache size + hit count for diagnostics."""
    db = get_db()
    total = await db.ocr_receipt_cache.count_documents({})
    pipeline = [{"$group": {"_id": None, "hits": {"$sum": "$hits"}}}]
    agg = await db.ocr_receipt_cache.aggregate(pipeline).to_list(1)
    return {
        "entries": total,
        "total_hits": int(agg[0]["hits"]) if agg else 0,
    }
