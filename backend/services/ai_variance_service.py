"""AI Variance Explainer Service — Phase 9C+ enhancement.

Uses emergentintegrations.LlmChat with Gemini 2.5 Flash (text) to explain
opname variance results in Bahasa Indonesia. Non-blocking: callers should
handle empty/error responses gracefully (the variance numbers themselves
are still always shown without the AI explanation).

Usage:
    result = await explain_opname_variance(
        session={"id": "...", "outlet_name": "...", "opname_date": "...",
                 "total_variance_value": -123456, "counted_items": 50,
                 "total_items": 50},
        lines=[{"item_name": "Susu UHT 1L", "system_qty": 24, "counted_qty": 19,
                 "variance": -5, "variance_value": -150000, "unit": "pcs"},
                ...],
        top_n=10,
    )

Returns:
    {
        "summary":         "<2-3 sentence executive summary>",
        "top_drivers":     [{"item_name": ..., "finding": ..., "suspect": ...}, ...],
        "recommended_actions": ["<action 1>", "<action 2>", ...],
        "confidence":      0..1,
    }

Or {"error": "..."} on any failure (caller falls back to silent UI).
"""
import json
import logging
import re
import uuid
from typing import Optional

from core.config import settings
from core.runtime_config import get_setting

logger = logging.getLogger("aurora.ai_variance")


SYSTEM_PROMPT = """Anda adalah asisten audit inventory F&B berpengalaman.
Anda akan menganalisis hasil stock opname dan memberikan penjelasan singkat
mengenai variance yang ditemukan, dalam Bahasa Indonesia.

FOKUS:
- Identifikasi item dengan variance terbesar (negatif = kemungkinan loss/waste/teft;
  positif = kemungkinan recording error atau spillage tidak tercatat).
- Beri hipotesis 1-2 penyebab umum (mis. waste tidak dicatat, salah unit,
  consumption belum di-post, transfer belum di-receive, theft/loss).
- Beri 2-3 rekomendasi tindak lanjut yang konkret dan praktis.
- Output HANYA JSON valid sesuai schema. Bahasa Indonesia. Singkat & actionable.

SCHEMA:
{
  "summary": "<2-3 kalimat ringkasan executive>",
  "top_drivers": [
    {
      "item_name": "<nama item>",
      "finding": "<1 kalimat menjelaskan variance>",
      "suspect": "<kemungkinan penyebab utama, 1 frase>"
    }
  ],
  "recommended_actions": [
    "<aksi konkret 1>",
    "<aksi konkret 2>",
    "<aksi konkret 3>"
  ],
  "confidence": <0..1>
}

ATURAN:
- Output JSON ONLY, no prose, no code fences.
- Bahasa Indonesia conversational tapi profesional.
- Jangan sebut nama orang, hanya nama item dan outlet.
- Jika data terlalu kecil (counted_items < 3 atau semua variance = 0),
  set confidence rendah dan summary konservatif.
"""


def _safe_json(raw: str) -> Optional[dict]:
    raw = (raw or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _build_user_prompt(session: dict, lines: list, top_n: int = 10) -> str:
    """Build a compact, well-structured user prompt with only top variance items."""
    outlet = session.get("outlet_name") or session.get("outlet_id") or "-"
    date = session.get("opname_date") or session.get("date") or "-"
    period = session.get("period") or "-"
    counted = int(session.get("counted_items") or 0)
    total = int(session.get("total_items") or 0)
    total_var_value = float(session.get("total_variance_value") or 0)

    # Filter only lines with non-zero variance (rounded), sort by abs(variance_value)
    flagged = [ln for ln in lines if (ln.get("variance") is not None and float(ln.get("variance") or 0) != 0)]
    flagged.sort(key=lambda x: abs(float(x.get("variance_value") or 0)), reverse=True)
    flagged = flagged[:top_n]

    lines_text = []
    for ln in flagged:
        nm = (ln.get("item_name") or "-").strip()
        sys_qty = ln.get("system_qty")
        cnt_qty = ln.get("counted_qty")
        var = ln.get("variance")
        var_val = ln.get("variance_value")
        unit = ln.get("unit") or ""
        lines_text.append(
            f"- {nm} | sistem {sys_qty} {unit} | counted {cnt_qty} {unit} | "
            f"variance {var} {unit} (Rp {var_val:,.0f})".replace(",", ".")
        )
    lines_block = "\n".join(lines_text) if lines_text else "(tidak ada item dengan variance ≠ 0)"

    return (
        f"OUTLET: {outlet}\n"
        f"TANGGAL: {date}\n"
        f"PERIOD: {period}\n"
        f"PROGRESS: {counted}/{total} items counted\n"
        f"TOTAL VARIANCE VALUE: Rp {total_var_value:,.0f}\n"
        f"TOP {len(flagged)} VARIANCE LINES (sorted by |variance value|):\n"
        f"{lines_block}\n\n"
        f"Analisis variance ini. Output JSON sesuai schema."
    ).replace(",", ".")


async def explain_opname_variance(
    *,
    session: dict,
    lines: list,
    top_n: int = 10,
) -> dict:
    """Generate AI explanation for opname variance.

    On any failure → returns dict with 'error' key. UI never blocks on this.
    On success returns: { summary, top_drivers[], recommended_actions[], confidence }
    """
    if not settings.feature_ai_enabled or not (
        await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)
    ):
        return {"error": "AI tidak diaktifkan. Anda dapat menganalisis variance secara manual."}

    if not session or not isinstance(session, dict):
        return {"error": "Session data tidak valid."}
    if not lines or not isinstance(lines, list):
        return {"error": "Lines kosong — tidak ada data variance untuk dianalisis."}

    # Quick sanity: if all variance == 0, skip the LLM call
    has_variance = any(
        float(ln.get("variance") or 0) != 0 for ln in lines
    )
    if not has_variance:
        return {
            "summary": "Tidak ada variance pada sesi opname ini. Stock fisik sesuai sistem.",
            "top_drivers": [],
            "recommended_actions": [
                "Lanjutkan operasi normal — stock fisik akurat.",
                "Pertahankan disiplin recording transfer & adjustment.",
            ],
            "confidence": 1.0,
            "_llm_skipped": True,
        }

    user_prompt = _build_user_prompt(session, lines, top_n=top_n)

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        llm_key = await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)
        model = await get_setting("LLM_MODEL_VARIANCE", default="gemini-2.5-flash")
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"variance-{uuid.uuid4().hex[:12]}",
            system_message=SYSTEM_PROMPT,
        ).with_model("gemini", model or "gemini-2.5-flash")
        msg = UserMessage(text=user_prompt)
        resp = await chat.send_message(msg)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"LLM variance call failed: {e}")
        return {"error": f"AI gagal menganalisis: {str(e)[:200]}"}

    if not resp:
        return {"error": "AI tidak merespon. Coba lagi nanti."}

    parsed = _safe_json(str(resp))
    if not parsed:
        logger.warning(f"Variance LLM response not JSON: {str(resp)[:200]}")
        return {"error": "Respon AI tidak valid. Lihat variance manual di bawah."}

    # Normalize
    return {
        "summary": (parsed.get("summary") or "").strip() or "Tidak ada ringkasan tersedia.",
        "top_drivers": [
            {
                "item_name": (d.get("item_name") or "").strip() or "-",
                "finding": (d.get("finding") or "").strip(),
                "suspect": (d.get("suspect") or "").strip(),
            }
            for d in (parsed.get("top_drivers") or [])[:10]
        ],
        "recommended_actions": [
            a.strip() for a in (parsed.get("recommended_actions") or [])[:5]
            if (a or "").strip()
        ],
        "confidence": float(parsed.get("confidence") or 0.5),
    }
