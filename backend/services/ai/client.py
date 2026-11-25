"""Satu pintu ke Claude (Anthropic API) untuk semua fitur AI ERP.

Menggantikan `emergentintegrations` + `EMERGENT_LLM_KEY` (Emergent). Semua fitur AI — fitur lama (OCR, kategori GL,
generator jurnal, briefing, dll.) dan agen — memanggil `create()` / `ask()` di sini, sehingga:

- kunci & model diatur di satu tempat: `ANTHROPIC_API_KEY`, `AI_MODEL` (Admin → Integrations; DB > env);
- kebijakan AI (`system_settings.key = "ai_policy"`): tombol darurat `enabled`, anggaran bulanan (peringatan, bukan
  batas keras — keputusan D6), ambang peringatan;
- pemakaian & biaya dicatat per fitur/pengguna di `ai_usage`;
- penolakan model (stop_reason `refusal`) memakai *server-side fallback* Anthropic (beta).

Rencana: docs/ai/AGENTIC_AI_PLAN_2026-11-25.md §6.2.
"""
from __future__ import annotations

import base64
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from core.config import settings
from core.db import get_db
from core.runtime_config import get_setting

logger = logging.getLogger("aurora.ai")

DEFAULT_MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# Harga per 1 juta token (USD): input, output. Cache read ±0,05× input, cache write ±1,25× input.
PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (4.0, 20.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
}

POLICY_KEY = "ai_policy"
DEFAULT_POLICY: dict[str, Any] = {
    "enabled": True,               # tombol darurat: False = semua fitur AI berhenti
    "write_actions_enabled": True,  # False = agen hanya boleh membaca/mengusulkan, tidak mengeksekusi
    "monthly_budget_usd": None,     # None = tanpa anggaran
    "alert_pct": 80,                # peringatan ke admin AI saat pemakaian ≥ x% anggaran
    "agent_effort": "high",         # effort Claude untuk agen (low|medium|high|xhigh|max)
    "agent_max_steps": 15,          # batas langkah alat per permintaan
    "practice_mode": False,         # mode latihan untuk semua: usulan aksi disetujui → disimulasikan, tidak dijalankan
    "mask_pii": False,              # samarkan data pribadi (telepon, email, NIK, NPWP, rekening, alamat) sebelum ke model
    "retention_days": None,         # hapus percakapan/run/file AI & log WA lebih tua dari N hari (None = simpan)
}


class AIUnavailable(Exception):
    """AI dimatikan (kebijakan/env) atau kunci belum diisi. `reason` dipakai UI."""

    def __init__(self, reason: str, message: str = ""):
        super().__init__(message or reason)
        self.reason = reason


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- konfigurasi ----------------

async def get_policy() -> dict:
    try:
        doc = await get_db().system_settings.find_one({"key": POLICY_KEY}, {"_id": 0})
    except Exception:  # noqa: BLE001
        doc = None
    return {**DEFAULT_POLICY, **((doc or {}).get("value") or {})}


async def update_policy(patch: dict, *, user: dict) -> dict:
    cur = await get_policy()
    out = dict(cur)
    if "enabled" in patch:
        out["enabled"] = bool(patch["enabled"])
    if "write_actions_enabled" in patch:
        out["write_actions_enabled"] = bool(patch["write_actions_enabled"])
    if "monthly_budget_usd" in patch:
        v = patch["monthly_budget_usd"]
        out["monthly_budget_usd"] = None if v in (None, "", 0) else max(0.0, float(v))
    if "alert_pct" in patch:
        out["alert_pct"] = min(100, max(1, int(patch["alert_pct"] or 80)))
    if patch.get("agent_effort") in ("low", "medium", "high", "xhigh", "max"):
        out["agent_effort"] = patch["agent_effort"]
    for k in ("practice_mode", "mask_pii"):
        if k in patch:
            out[k] = bool(patch[k])
    if "retention_days" in patch:
        v = patch["retention_days"]
        out["retention_days"] = None if v in (None, "", 0) else min(3650, max(30, int(v)))
    if "agent_max_steps" in patch:
        out["agent_max_steps"] = min(40, max(3, int(patch["agent_max_steps"] or 15)))
    await get_db().system_settings.update_one(
        {"key": POLICY_KEY},
        {"$set": {"key": POLICY_KEY, "value": out, "updated_at": _now(), "updated_by": user.get("id")}},
        upsert=True,
    )
    from core.audit import log as audit_log
    await audit_log(user_id=user.get("id"), entity_type="ai_policy", entity_id=POLICY_KEY, action="update",
                    before=cur, after=out)
    return out


async def api_key() -> Optional[str]:
    return (await get_setting("ANTHROPIC_API_KEY")) or None


async def model_name() -> str:
    return (await get_setting("AI_MODEL")) or DEFAULT_MODEL


async def status() -> dict:
    """Ringkas untuk UI/Admin: aktif? kenapa tidak?"""
    policy = await get_policy()
    key = await api_key()
    reason = None
    if not settings.feature_ai_enabled:
        reason = "ai_disabled_env"
    elif not policy["enabled"]:
        reason = "ai_disabled_policy"
    elif not key:
        reason = "no_api_key"
    return {"available": reason is None, "reason": reason, "model": await model_name(), "policy": policy}


async def is_available() -> bool:
    return (await status())["available"]


_clients: dict[str, Any] = {}


async def get_client(key: Optional[str] = None):
    key = key or await api_key()
    if not key:
        raise AIUnavailable("no_api_key", "ANTHROPIC_API_KEY belum diisi (Admin → Integrations)")
    if key not in _clients:
        import anthropic
        _clients.clear()  # kunci berganti → buang klien lama
        _clients[key] = anthropic.AsyncAnthropic(api_key=key, max_retries=2, timeout=600.0)
    return _clients[key]


# ---------------- biaya ----------------

def cost_usd(model: str, usage: Any) -> float:
    pin, pout = PRICES.get(model, PRICES[DEFAULT_MODEL])
    g = (lambda k: float(getattr(usage, k, None) or (usage.get(k) if isinstance(usage, dict) else 0) or 0))
    inp, out = g("input_tokens"), g("output_tokens")
    cr, cw = g("cache_read_input_tokens"), g("cache_creation_input_tokens")
    return round((inp * pin + out * pout + cr * pin * 0.05 + cw * pin * 1.25) / 1_000_000, 6)


async def record_usage(*, feature: str, user_id: Optional[str], model: str, usage: Any = None, latency_ms: int = 0,
                       status_: str = "ok", error: Optional[str] = None, extra: Optional[dict] = None) -> None:
    def g(k):
        if usage is None:
            return 0
        return int(getattr(usage, k, None) or (usage.get(k) if isinstance(usage, dict) else 0) or 0)
    doc = {
        "id": str(uuid.uuid4()), "ts": _now(), "month": _now()[:7], "feature": feature, "user_id": user_id,
        "model": model, "input_tokens": g("input_tokens"), "output_tokens": g("output_tokens"),
        "cache_read_input_tokens": g("cache_read_input_tokens"),
        "cache_creation_input_tokens": g("cache_creation_input_tokens"),
        "cost_usd": cost_usd(model, usage) if usage is not None else 0.0,
        "latency_ms": latency_ms, "status": status_, "error": (error or "")[:300] or None, **(extra or {}),
    }
    try:
        await get_db().ai_usage.insert_one(doc)
        await _maybe_alert_budget(doc["month"])
    except Exception:  # noqa: BLE001 — pencatatan tidak boleh menggagalkan fitur
        logger.warning("ai_usage insert failed", exc_info=True)


async def month_usage(month: Optional[str] = None) -> dict:
    month = month or _now()[:7]
    rows = await get_db().ai_usage.aggregate([
        {"$match": {"month": month}},
        {"$group": {"_id": None, "cost": {"$sum": "$cost_usd"}, "calls": {"$sum": 1},
                    "input": {"$sum": {"$add": [{"$ifNull": ["$input_tokens", 0]},
                                                {"$ifNull": ["$cache_read_input_tokens", 0]},
                                                {"$ifNull": ["$cache_creation_input_tokens", 0]}]}},
                    "cached": {"$sum": {"$ifNull": ["$cache_read_input_tokens", 0]}},
                    "output": {"$sum": "$output_tokens"}}},
    ]).to_list(1)
    r = rows[0] if rows else {}
    return {"month": month, "cost_usd": round(r.get("cost", 0.0), 4), "calls": r.get("calls", 0),
            "input_tokens": r.get("input", 0), "cached_input_tokens": r.get("cached", 0),
            "output_tokens": r.get("output", 0)}


async def _maybe_alert_budget(month: str) -> None:
    policy = await get_policy()
    budget = policy.get("monthly_budget_usd")
    if not budget:
        return
    used = (await month_usage(month))["cost_usd"]
    db = get_db()
    for level in (100, int(policy.get("alert_pct") or 80)):
        if used < budget * level / 100:
            continue
        flag = f"ai_budget_alert:{month}:{level}"
        if await db.system_settings.find_one({"key": flag}):
            return
        await db.system_settings.insert_one({"key": flag, "value": True, "created_at": _now()})
        from services import notification_service
        admins = await _ai_admin_user_ids()
        for uid in admins:
            await notification_service.push(
                user_id=uid, type="warn" if level < 100 else "urgent",
                title=f"Pemakaian AI {level}% dari anggaran bulan ini",
                body=f"Terpakai ${used:,.2f} dari ${budget:,.2f} ({month}).", link="/admin/ai?tab=usage",
                source_type="ai_budget", source_id=month)
        return


async def _ai_admin_user_ids() -> list[str]:
    db = get_db()
    role_ids = [r["id"] async for r in db.roles.find(
        {"permissions": {"$in": ["*", "ai.agent.admin"]}}, {"id": 1})]
    return [u["id"] async for u in db.users.find(
        {"role_ids": {"$in": role_ids}, "deleted_at": None, "status": "active"}, {"id": 1})]


# ---------------- panggilan model ----------------

async def create(*, feature: str, user_id: Optional[str] = None, api_key_override: Optional[str] = None,
                 model: Optional[str] = None, fallback: bool = True, betas: Optional[list[str]] = None, **params: Any):
    """`messages.create` dengan kebijakan, model default, fallback penolakan, dan pencatatan biaya.

    `params` diteruskan apa adanya (system, messages, tools, max_tokens, output_config, ...).
    Melempar `AIUnavailable` bila AI dimatikan/kunci kosong; error API diteruskan setelah dicatat.
    """
    st = await status()
    if not api_key_override and not st["available"]:
        raise AIUnavailable(st["reason"])
    client = await get_client(api_key_override)
    mdl = model or st["model"]
    params.setdefault("max_tokens", 8000)
    t0 = time.perf_counter()
    try:
        if fallback or betas:
            extra = {"fallbacks": "default"} if fallback else {}
            resp = await client.beta.messages.create(
                model=mdl, betas=[*([FALLBACK_BETA] if fallback else []), *(betas or [])], **extra, **params)
        else:
            resp = await client.messages.create(model=mdl, **params)
    except Exception as e:  # noqa: BLE001
        await record_usage(feature=feature, user_id=user_id, model=mdl, latency_ms=int((time.perf_counter() - t0) * 1000),
                           status_="error", error=f"{type(e).__name__}: {e}")
        raise
    await record_usage(feature=feature, user_id=user_id, model=getattr(resp, "model", mdl) or mdl, usage=resp.usage,
                       latency_ms=int((time.perf_counter() - t0) * 1000),
                       status_="refusal" if resp.stop_reason == "refusal" else "ok")
    return resp


def text_of(resp: Any) -> str:
    return "".join(getattr(b, "text", "") for b in (resp.content or []) if getattr(b, "type", "") == "text").strip()


def media_type_of(data: bytes) -> str:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:5] == b"%PDF-":
        return "application/pdf"
    return "application/octet-stream"


def file_block(data: bytes, media_type: Optional[str] = None) -> dict:
    """Blok konten untuk gambar (image/*) atau PDF (document)."""
    mt = media_type or media_type_of(data)
    b64 = base64.standard_b64encode(data).decode("ascii")
    if mt == "application/pdf":
        return {"type": "document", "source": {"type": "base64", "media_type": mt, "data": b64}}
    if not mt.startswith("image/"):
        raise ValueError(f"Jenis file tidak didukung untuk dibaca AI: {mt}")
    return {"type": "image", "source": {"type": "base64", "media_type": mt, "data": b64}}


async def ask(*, system: str, user: str, feature: str, user_id: Optional[str] = None,
              files: Optional[list[bytes]] = None, max_tokens: int = 4000, effort: str = "low",
              json_schema: Optional[dict] = None, api_key_override: Optional[str] = None) -> str:
    """Satu permintaan → teks. `files`: gambar/PDF (dibaca model). `json_schema`: keluaran JSON terjamin."""
    content: list[dict] = [file_block(f) for f in (files or [])]
    content.append({"type": "text", "text": user})
    output_config: dict = {"effort": effort}
    if json_schema:
        output_config["format"] = {"type": "json_schema", "schema": json_schema}
    resp = await create(feature=feature, user_id=user_id, api_key_override=api_key_override, system=system,
                        max_tokens=max_tokens, output_config=output_config,
                        messages=[{"role": "user", "content": content}])
    if resp.stop_reason == "refusal":
        return ""
    return text_of(resp)


async def quick_test(prompt: str = "Balas satu kata: OK", *, api_key_override: Optional[str] = None,
                     model: Optional[str] = None) -> dict:
    """Tombol "Test LLM" di Admin → Integrations."""
    st = await status()
    if not api_key_override and not st["available"]:
        return {"ok": False, "reason": st["reason"]}
    t0 = time.perf_counter()
    try:
        resp = await create(feature="admin_test", api_key_override=api_key_override, model=model, max_tokens=64,
                            output_config={"effort": "low"}, messages=[{"role": "user", "content": prompt}])
        return {"ok": True, "provider": "anthropic", "model": resp.model, "elapsed_ms": int((time.perf_counter() - t0) * 1000),
                "response": text_of(resp)[:300]}
    except AIUnavailable as e:
        return {"ok": False, "reason": e.reason}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "reason": "llm_error", "error": f"{type(e).__name__}: {str(e)[:300]}"}
