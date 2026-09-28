"""AI Executive Q&A — tool-calling (Phase 9D).

Enhances the legacy single-shot RAG (`ai_insights_service.conversational_qa`)
with a two-step LLM flow:
  1) **Tool router** — given user question + tool catalog, output strict JSON
     `{tool, params, reason}`.
  2) **Answer formulator** — given question + tool result, output a concise
     Bahasa Indonesia answer.

Tools are READ-ONLY. The LLM cannot mutate data; it can only ask the server
to execute one of a fixed set of executive metric helpers.

Session memory:
  - Persisted in MongoDB `ai_qa_sessions` collection
  - Last 10 messages kept per session
  - TTL: 30 days
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from core.config import settings
from core.db import get_db
from core.runtime_config import get_setting

logger = logging.getLogger("aurora.ai_exec_qa")

# Model used for Phase 9D
PROVIDER = "gemini"
MODEL = "gemini-2.5-flash"

# History size kept per session
HISTORY_LIMIT = 10
# Session TTL (days)
SESSION_TTL_DAYS = 30


# =================== TOOL CATALOG ===================
# Each tool is a callable that takes a `params` dict and returns JSON-safe output.
async def _tool_get_kpis(params: dict, *, user: dict) -> Any:
    from services import executive_service
    period_param = (params or {}).get("period")
    # `kpis` expects YYYY-MM. Accept both presets and explicit YYYY-MM.
    period: Optional[str] = None
    if period_param:
        if re.match(r"^\d{4}-\d{2}$", str(period_param)):
            period = str(period_param)
        # presets fall through to None (=current month)
    return await executive_service.kpis(period=period)


async def _tool_get_sales_trend(params: dict, *, user: dict) -> Any:
    from services import executive_service
    days = int((params or {}).get("days", 30))
    days = max(7, min(days, 90))
    return await executive_service.sales_trend(days=days)


async def _tool_get_brand_mix(params: dict, *, user: dict) -> Any:
    from services import executive_drilldown_service
    period_param = (params or {}).get("period")
    period = period_param if period_param and re.match(r"^\d{4}-\d{2}$", str(period_param)) else None
    return await executive_drilldown_service.brand_mix(period=period)


async def _tool_get_anomalies(params: dict, *, user: dict) -> Any:
    from services import ai_insights_service
    days = int((params or {}).get("days", 14))
    days = max(7, min(days, 30))
    return await ai_insights_service.detect_anomalies(days=days)


async def _tool_get_ap_aging(params: dict, *, user: dict) -> Any:
    try:
        from services import executive_drilldown_service
        return await executive_drilldown_service.ap_aging_summary()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"ap_aging_summary failed: {e}")
        try:
            from services import finance_service
            return await finance_service.ap_aging()
        except Exception:  # noqa: BLE001
            return {"buckets": {}, "error": "ap aging unavailable"}


async def _tool_get_pl_summary(params: dict, *, user: dict) -> Any:
    """P&L is not a single direct service — synthesize from KPIs + ap_aging."""
    try:
        from services import executive_service
        kpi = await executive_service.kpis()
        return {
            "period": kpi.get("period"),
            "revenue": kpi.get("sales_mtd", 0),
            "wtd": kpi.get("sales_wtd", 0),
            "ap_exposure": kpi.get("ap_exposure", 0),
            "inventory_value": kpi.get("inventory_value", 0),
        }
    except Exception:  # noqa: BLE001
        return {"period": "current", "revenue": 0, "ap_exposure": 0}


async def _tool_get_low_stock_count(params: dict, *, user: dict) -> Any:
    from services import inventory_matrix_service
    res = await inventory_matrix_service.low_stock(include_zero=True, include_negative=True)
    return {
        "total_below": res.get("total_below", 0),
        "critical_count": sum(1 for it in res.get("items", []) if it.get("severity") == "critical"),
        "outlets": [{"id": o["id"], "name": o["name"]} for o in res.get("outlets", [])],
    }


async def _tool_get_outlet_drilldown(params: dict, *, user: dict) -> Any:
    db = get_db()
    outlet_id = (params or {}).get("outlet_id")
    days_param = (params or {}).get("days", 30)
    if not outlet_id:
        outlets = await db.outlets.find({"deleted_at": None}, {"id": 1, "name": 1}).to_list(20)
        return {"error": "outlet_id required", "available_outlets": outlets}
    try:
        from services import executive_drilldown_service
        # outlet_drilldown signature uses period (YYYY-MM)
        period = None
        if isinstance(days_param, str) and re.match(r"^\d{4}-\d{2}$", days_param):
            period = days_param
        return await executive_drilldown_service.outlet_drilldown(
            outlet_id=outlet_id, period=period,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"outlet_drilldown failed: {e}")
        return {"outlet_id": outlet_id, "error": str(e)[:200]}


async def _tool_get_top_vendors(params: dict, *, user: dict) -> Any:
    db = get_db()
    month = (params or {}).get("month")  # YYYY-MM
    limit = int((params or {}).get("limit", 5))
    limit = max(3, min(limit, 10))

    match: dict = {"deleted_at": None, "status": "posted"}
    if month and re.match(r"\d{4}-\d{2}", str(month)):
        match["receive_date"] = {"$regex": f"^{month}"}

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$vendor_id",
            "spend": {"$sum": "$grand_total"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"spend": -1}},
        {"$limit": limit},
    ]
    rows = []
    async for r in db.goods_receipts.aggregate(pipeline):
        rows.append(r)

    # Resolve vendor names
    ids = [r["_id"] for r in rows if r.get("_id")]
    name_by_id: dict[str, str] = {}
    async for v in db.vendors.find({"id": {"$in": ids}}, {"id": 1, "name": 1}):
        name_by_id[v["id"]] = v.get("name", "")

    return {
        "month": month or "all-time",
        "vendors": [
            {
                "vendor_id": r["_id"],
                "vendor_name": name_by_id.get(r["_id"], "—"),
                "spend": float(r.get("spend") or 0),
                "gr_count": int(r.get("count") or 0),
            }
            for r in rows
        ],
    }


TOOL_REGISTRY: dict[str, dict] = {
    "get_kpis": {
        "fn": _tool_get_kpis,
        "params": {"period": "today | 7d | 30d | 90d | mtd | qtd | ytd"},
        "desc": "Total revenue, gross margin, AP outstanding, top brand for the period.",
    },
    "get_sales_trend": {
        "fn": _tool_get_sales_trend,
        "params": {"days": "int 7-90"},
        "desc": "Daily revenue trend for the last N days (7-90).",
    },
    "get_brand_mix": {
        "fn": _tool_get_brand_mix,
        "params": {"period": "7d | 30d | mtd | qtd"},
        "desc": "Revenue breakdown per brand for the period.",
    },
    "get_anomalies": {
        "fn": _tool_get_anomalies,
        "params": {"days": "int 7-30"},
        "desc": "Recent daily-sales anomalies (z-score > 1.6).",
    },
    "get_ap_aging": {
        "fn": _tool_get_ap_aging,
        "params": {},
        "desc": "Accounts payable aging buckets (current, 1-30, 31-60, 60+).",
    },
    "get_pl_summary": {
        "fn": _tool_get_pl_summary,
        "params": {"period": "mtd | qtd | ytd"},
        "desc": "Profit & Loss summary for the period.",
    },
    "get_low_stock_count": {
        "fn": _tool_get_low_stock_count,
        "params": {},
        "desc": "Number of inventory items below par across outlets.",
    },
    "get_outlet_drilldown": {
        "fn": _tool_get_outlet_drilldown,
        "params": {"outlet_id": "string", "days": "int 7-90"},
        "desc": "Outlet-specific revenue + traffic + average ticket. Requires outlet_id.",
    },
    "get_top_vendors": {
        "fn": _tool_get_top_vendors,
        "params": {"month": "YYYY-MM (optional)", "limit": "int 3-10"},
        "desc": "Top vendors by spend in a month (optionally filter to a single month).",
    },
}


def _tool_catalog_str() -> str:
    parts = []
    for name, meta in TOOL_REGISTRY.items():
        parts.append(f"- {name}{meta['params']}: {meta['desc']}")
    return "\n".join(parts)


# =================== LLM HELPERS ===================
async def _llm_call(system: str, user_text: str, *, session_id: str = "exec-qa") -> str:
    llm_key = await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)
    if not settings.feature_ai_enabled or not llm_key:
        return ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message=system,
        ).with_model(PROVIDER, MODEL)
        return await chat.send_message(UserMessage(text=user_text)) or ""
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Exec-QA LLM call failed: {e}")
        return ""


def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:  # noqa: BLE001
            pass
    m = re.search(r"\{[\s\S]+\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:  # noqa: BLE001
        return None


# =================== SESSION STORE ===================
async def _ensure_indexes() -> None:
    db = get_db()
    try:
        await db.ai_qa_sessions.create_index([("session_id", 1)], background=True)
        await db.ai_qa_sessions.create_index(
            [("expires_at", 1)],
            expireAfterSeconds=0,
            background=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"AI QA index create failed: {e}")


async def _load_session(session_id: str) -> dict:
    if not session_id:
        return {"session_id": "", "messages": []}
    db = get_db()
    doc = await db.ai_qa_sessions.find_one({"session_id": session_id})
    if not doc:
        return {"session_id": session_id, "messages": []}
    return {
        "session_id": doc["session_id"],
        "messages": doc.get("messages", []) or [],
    }


async def _save_session(session_id: str, messages: list[dict], user: dict) -> None:
    db = get_db()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    await db.ai_qa_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "session_id": session_id,
            "user_id": user.get("id"),
            "messages": messages[-HISTORY_LIMIT:],
            "updated_at": now.isoformat(),
            "expires_at": expires_at,
        }},
        upsert=True,
    )


# =================== PUBLIC API ===================
async def list_sessions(user: dict, limit: int = 20) -> list[dict]:
    db = get_db()
    cursor = db.ai_qa_sessions.find(
        {"user_id": user.get("id")},
        {"session_id": 1, "updated_at": 1, "messages": 1},
    ).sort("updated_at", -1).limit(limit)
    out = []
    async for d in cursor:
        msgs = d.get("messages", []) or []
        first = next((m for m in msgs if m.get("role") == "user"), None)
        out.append({
            "session_id": d["session_id"],
            "updated_at": d.get("updated_at"),
            "preview": (first or {}).get("content", "")[:80],
            "message_count": len(msgs),
        })
    return out


async def delete_session(session_id: str, user: dict) -> bool:
    db = get_db()
    res = await db.ai_qa_sessions.delete_one({
        "session_id": session_id, "user_id": user.get("id"),
    })
    return res.deleted_count > 0


async def ask(question: str, *, user: dict, session_id: Optional[str] = None) -> dict:
    """Main entry point. Returns {answer, tool_calls, session_id, history}."""
    await _ensure_indexes()
    if not question or len(question.strip()) < 2:
        return {
            "answer": "Mohon ajukan pertanyaan yang lebih spesifik.",
            "tool_calls": [],
            "session_id": session_id or "",
            "history": [],
        }
    if not settings.feature_ai_enabled or not (await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)):
        return {
            "answer": "Layanan AI tidak aktif. Hubungi admin.",
            "tool_calls": [],
            "session_id": session_id or "",
            "history": [],
        }

    sid = session_id or str(uuid.uuid4())
    state = await _load_session(sid)
    history = state["messages"]

    # Build conversation snapshot for context (last few only)
    history_snapshot = "\n".join(
        f"{m['role'].upper()}: {m['content'][:300]}"
        for m in history[-6:]
    )

    # ---------- 1) TOOL ROUTER ----------
    router_sys = f"""You are an Executive Q&A router for an Indonesian F&B ERP (FnB Group / FnB Group).
Pick EXACTLY ONE tool from the catalog below to answer the user. Output STRICT JSON ONLY (no prose, no markdown):
{{"tool": "<tool_name>", "params": {{...}}, "reason": "<short Indonesian, max 12 words>"}}

TOOL CATALOG:
{_tool_catalog_str()}

RULES:
- Use only listed tool names. If none fits, use get_kpis with default params.
- For period defaults, prefer "30d" for revenue/KPI, 30 for days/anomalies, "mtd" for P&L.
- If user asks about a specific outlet by name, you cannot resolve names — fall back to get_brand_mix or get_kpis.
"""
    prompt = (
        f"PRIOR CONVERSATION:\n{history_snapshot or '(none)'}\n\n"
        f"USER QUESTION:\n{question.strip()}\n\nOutput JSON."
    )
    router_text = await _llm_call(router_sys, prompt, session_id=f"router-{sid[:8]}")
    parsed = _extract_json(router_text) or {}
    tool_name = parsed.get("tool")
    tool_params = parsed.get("params") or {}
    tool_reason = parsed.get("reason", "")

    if tool_name not in TOOL_REGISTRY:
        # Fallback to KPIs
        tool_name = "get_kpis"
        tool_params = {"period": "30d"}
        tool_reason = "Default fallback"

    # ---------- 2) EXECUTE TOOL ----------
    tool_meta = TOOL_REGISTRY[tool_name]
    try:
        tool_result = await tool_meta["fn"](tool_params, user=user)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Tool {tool_name} failed: {e}")
        tool_result = {"error": str(e)[:200]}

    tool_calls = [{"tool": tool_name, "params": tool_params, "reason": tool_reason}]

    # ---------- 3) ANSWER FORMULATOR ----------
    answer_sys = (
        "You are a concise Indonesian F&B finance & operations analyst. "
        "Answer the user's question in Bahasa Indonesia, MAX 4 sentences. "
        "Ground every number you cite in the JSON tool result. "
        "If data is missing or zero, say so explicitly. "
        "DO NOT invent numbers. DO NOT output JSON or markdown. Just plain Indonesian prose."
    )
    answer_prompt = (
        f"QUESTION: {question.strip()}\n\n"
        f"TOOL USED: {tool_name}\n"
        f"TOOL PARAMS: {json.dumps(tool_params, ensure_ascii=False)}\n"
        f"TOOL RESULT (JSON):\n{json.dumps(tool_result, ensure_ascii=False, default=str)[:4000]}\n\n"
        f"FORMULATE ANSWER:"
    )
    answer = await _llm_call(answer_sys, answer_prompt, session_id=f"answer-{sid[:8]}")
    answer = (answer or "Maaf, saat ini saya tidak bisa merangkum hasilnya. Coba ulang.").strip()

    # ---------- 4) Persist history ----------
    now_iso = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "content": question.strip(), "timestamp": now_iso})
    history.append({
        "role": "assistant",
        "content": answer,
        "tool_calls": tool_calls,
        "timestamp": now_iso,
    })
    await _save_session(sid, history, user)

    return {
        "answer": answer,
        "tool_calls": tool_calls,
        "session_id": sid,
        "history": history[-HISTORY_LIMIT:],
    }
