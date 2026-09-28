"""Owner Daily Briefing — AI-narrated personalized morning briefing.

Combines Owner Cockpit data + AI to generate natural Indonesian briefing text
that owner can read OR listen to (Web Speech API id-ID on frontend).

Output structure:
- greeting: time-of-day greeting (Selamat pagi/siang/sore/malam Pak Hadi)
- briefing_text: 4-6 sentence narrative summary in Indonesian
- voice_text: same but optimized for TTS (no special chars)
- highlights: structured data for visual display
- urgent_actions: prioritized list of items needing attention
- top_outlet: best performer yesterday
- attention_outlet: worst/dropped outlet
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.config import settings
from core.runtime_config import get_setting
from core.db import get_db

logger = logging.getLogger("aurora.daily_briefing")

PROVIDER = "gemini"
MODEL = "gemini-2.5-flash"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _greeting_for_hour(h: int, name: str) -> str:
    """Time-aware Indonesian greeting."""
    if 4 <= h < 11:
        return f"Selamat pagi, {name}"
    if 11 <= h < 15:
        return f"Selamat siang, {name}"
    if 15 <= h < 18:
        return f"Selamat sore, {name}"
    return f"Selamat malam, {name}"


def _format_idr(amount: float) -> str:
    """Format Rupiah with Indonesian conventions: Rp 1,2 Juta / Rp 4,5 Miliar."""
    if amount is None:
        return "Rp 0"
    a = abs(amount)
    sign = "-" if amount < 0 else ""
    if a >= 1_000_000_000:
        return f"{sign}Rp {a / 1_000_000_000:,.1f} Miliar".replace(",", ".")
    if a >= 1_000_000:
        return f"{sign}Rp {a / 1_000_000:,.1f} Juta".replace(",", ".")
    if a >= 1_000:
        return f"{sign}Rp {a / 1_000:,.0f} Ribu".replace(",", ".")
    return f"{sign}Rp {a:,.0f}".replace(",", ".")


async def _aggregate_briefing_data(user: Optional[dict] = None) -> dict:
    """Heavy data aggregation — yesterday vs week-ago, urgent actions, etc."""
    db = get_db()
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    week_ago = yesterday - timedelta(days=7)
    month_start = today.replace(day=1)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    last_month_same_day = last_month_start + timedelta(days=today.day - 1)

    # ---- Sales: Yesterday vs Same day last week ----
    pipe_y = [
        {"$match": {"sales_date": yesterday.isoformat(), "status": {"$in": ["validated", "submitted"]}}},
        {"$group": {"_id": "$outlet_id",
                     "revenue": {"$sum": "$grand_total"},
                     "transactions": {"$sum": "$transaction_count"}}},
    ]
    y_rows = await db.daily_sales.aggregate(pipe_y).to_list(50)
    y_total = sum(float(r["revenue"] or 0) for r in y_rows)

    pipe_w = [
        {"$match": {"sales_date": week_ago.isoformat(), "status": {"$in": ["validated", "submitted"]}}},
        {"$group": {"_id": "$outlet_id", "revenue": {"$sum": "$grand_total"}}},
    ]
    w_rows = await db.daily_sales.aggregate(pipe_w).to_list(50)
    w_total = sum(float(r["revenue"] or 0) for r in w_rows)
    w_by_outlet = {r["_id"]: float(r["revenue"] or 0) for r in w_rows}

    # Outlet name lookup
    outlets = {}
    async for o in db.outlets.find({"deleted_at": None}, {"_id": 0, "id": 1, "name": 1}):
        outlets[o["id"]] = o.get("name", "-")

    yesterday_outlets = []
    for r in y_rows:
        rev = float(r["revenue"] or 0)
        prev = w_by_outlet.get(r["_id"], 0)
        delta_pct = ((rev - prev) / prev * 100) if prev > 0 else None
        yesterday_outlets.append({
            "outlet_id": r["_id"],
            "outlet_name": outlets.get(r["_id"], "-"),
            "revenue": rev,
            "transactions": int(r.get("transactions") or 0),
            "vs_week_ago": prev,
            "delta_pct": delta_pct,
        })
    yesterday_outlets.sort(key=lambda x: x["revenue"], reverse=True)
    top_outlet = yesterday_outlets[0] if yesterday_outlets else None
    # Pick attention outlet: biggest negative delta (or smallest revenue if no comp)
    attention = None
    drops = [o for o in yesterday_outlets if o["delta_pct"] is not None and o["delta_pct"] < -10]
    if drops:
        attention = min(drops, key=lambda x: x["delta_pct"])

    # ---- MTD vs Last MTD ----
    mtd_rows = await db.daily_sales.aggregate([
        {"$match": {"sales_date": {"$gte": month_start.isoformat(), "$lte": today.isoformat()},
                     "status": {"$in": ["validated", "submitted"]}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$grand_total"}}},
    ]).to_list(1)
    mtd_revenue = float(mtd_rows[0]["revenue"]) if mtd_rows else 0

    last_mtd_rows = await db.daily_sales.aggregate([
        {"$match": {"sales_date": {"$gte": last_month_start.isoformat(),
                                     "$lte": last_month_same_day.isoformat()},
                     "status": {"$in": ["validated", "submitted"]}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$grand_total"}}},
    ]).to_list(1)
    last_mtd_revenue = float(last_mtd_rows[0]["revenue"]) if last_mtd_rows else 0
    mtd_delta_pct = ((mtd_revenue - last_mtd_revenue) / last_mtd_revenue * 100) if last_mtd_revenue > 0 else None

    # ---- Urgent: Low stock CRITICAL items ----
    low_stock = []
    items_with_par = await db.items.find(
        {"par_levels": {"$exists": True, "$ne": {}}, "active": True},
        {"_id": 0, "id": 1, "name": 1, "par_levels": 1}
    ).limit(50).to_list(50)
    # For each, compute current stock (from inventory_movements aggregation)
    for it in items_with_par[:30]:
        for outlet_id, par in it.get("par_levels", {}).items():
            mv_pipe = [
                {"$match": {"item_id": it["id"], "outlet_id": outlet_id, "deleted_at": None}},
                {"$group": {"_id": None, "balance": {"$sum": "$qty"}}},
            ]
            mv = await db.inventory_movements.aggregate(mv_pipe).to_list(1)
            balance = float(mv[0]["balance"]) if mv else 0
            if balance < par * 0.3:  # critical: <30% of par
                low_stock.append({
                    "item_name": it["name"],
                    "outlet_name": outlets.get(outlet_id, "-"),
                    "balance": balance,
                    "par": par,
                    "deficit_pct": ((par - balance) / par * 100) if par > 0 else 100,
                })
    low_stock.sort(key=lambda x: x["deficit_pct"], reverse=True)
    low_stock = low_stock[:5]

    # ---- Anomalies: severe & open ----
    anomalies = []
    async for a in db.anomaly_events.find(
        {"severity": "severe", "status": {"$in": ["open", "investigating"]}, "deleted_at": None},
        {"_id": 0}
    ).sort("detected_at", -1).limit(5):
        anomalies.append({
            "title": a.get("title", "Anomali"),
            "description": a.get("description", ""),
            "type": a.get("type"),
            "outlet_name": a.get("outlet_name") or "-",
        })

    # ---- AP Due in 7 days — canonical store is `ap_ledgers` (field: balance) ----
    week_end = today + timedelta(days=7)
    ap_due = await db.ap_ledgers.find({
        "status": {"$in": ["open", "partial", "overdue"]}, "deleted_at": None,
        "due_date": {"$lte": week_end.isoformat()},
    }, {"_id": 0, "vendor_id": 1, "balance": 1, "due_date": 1}).sort("due_date", 1).limit(50).to_list(50)
    ap_due_total = sum(float(r.get("balance", 0) or 0) for r in ap_due)
    top_ap = sorted(ap_due, key=lambda x: float(x.get("balance", 0) or 0), reverse=True)[:3]

    # ---- Cash Position ----
    cash_total = 0.0
    async for a in db.cash_accounts.find({"deleted_at": None, "is_active": True},
                                            {"_id": 0, "current_balance": 1}):
        cash_total += float(a.get("current_balance", 0) or 0)

    # ---- Pending Approvals (for current user) ----
    pending_approvals = 0
    if user and user.get("id"):
        pending_approvals = await db.approval_steps.count_documents({
            "approver_user_id": user["id"], "status": "pending", "deleted_at": None,
        })

    return {
        "today": today.isoformat(),
        "yesterday": yesterday.isoformat(),
        "yesterday_total": y_total,
        "yesterday_vs_week_ago": w_total,
        "yesterday_delta_pct": ((y_total - w_total) / w_total * 100) if w_total > 0 else None,
        "yesterday_by_outlet": yesterday_outlets,
        "top_outlet": top_outlet,
        "attention_outlet": attention,
        "mtd_revenue": mtd_revenue,
        "last_mtd_revenue": last_mtd_revenue,
        "mtd_delta_pct": mtd_delta_pct,
        "cash_total": cash_total,
        "ap_due_total": ap_due_total,
        "ap_due_count": len(ap_due),
        "top_ap_due": top_ap,
        "low_stock_critical": low_stock,
        "anomalies_severe": anomalies,
        "pending_approvals": pending_approvals,
    }


def _build_briefing_prompt(data: dict, owner_name: str, time_of_day: str, greeting: str) -> str:
    """Build prompt for Gemini to produce natural briefing text."""
    top = data.get("top_outlet") or {}
    attn = data.get("attention_outlet")
    delta_pct = data.get("yesterday_delta_pct")

    delta_phrase = ""
    if delta_pct is not None:
        if delta_pct > 5:
            delta_phrase = f"naik {delta_pct:.1f}% dibanding minggu lalu"
        elif delta_pct < -5:
            delta_phrase = f"turun {abs(delta_pct):.1f}% dibanding minggu lalu"
        else:
            delta_phrase = f"relatif stabil ({delta_pct:+.1f}%)"

    mtd_delta = data.get("mtd_delta_pct")
    mtd_delta_phrase = ""
    if mtd_delta is not None:
        if mtd_delta > 5:
            mtd_delta_phrase = f", on track lebih baik {mtd_delta:.1f}% vs bulan lalu"
        elif mtd_delta < -5:
            mtd_delta_phrase = f", lebih lambat {abs(mtd_delta):.1f}% vs bulan lalu"

    # Stock context
    ls = data.get("low_stock_critical", [])
    stock_phrase = ""
    if ls:
        outlets_with_low = list({item['outlet_name'] for item in ls})[:2]
        stock_phrase = f"Ada {len(ls)} item kritis di stock terutama di {' & '.join(outlets_with_low)}."

    # Anomaly context
    anos = data.get("anomalies_severe", [])
    ano_phrase = f"Ada {len(anos)} anomali berat yang perlu diperhatikan." if anos else ""

    # AP context
    ap_phrase = ""
    if data.get("ap_due_count", 0) > 0:
        ap_phrase = f"Total {data['ap_due_count']} invoice akan jatuh tempo minggu ini ({_format_idr(data['ap_due_total'])})."

    return f"""Anda adalah AI assistant untuk pemilik group F&B Indonesia. Buat briefing pagi yang singkat, hangat, dan actionable dalam Bahasa Indonesia.

DATA HARI INI ({time_of_day}):
- Greeting target: {owner_name}
- Total revenue kemarin: {_format_idr(data['yesterday_total'])} ({delta_phrase})
- Top outlet kemarin: {top.get('outlet_name', '-')} dengan {_format_idr(top.get('revenue', 0))}
- Outlet yang perlu perhatian: {attn['outlet_name'] + ' (turun ' + str(round(abs(attn.get('delta_pct', 0)), 1)) + '%)' if attn else 'tidak ada'}
- Revenue MTD: {_format_idr(data['mtd_revenue'])}{mtd_delta_phrase}
- Cash position: {_format_idr(data['cash_total'])}
- AP jatuh tempo 7 hari: {ap_phrase or 'tidak ada urgensi'}
- Stock alert: {stock_phrase or 'tidak ada'}
- Anomali: {ano_phrase or 'tidak ada'}
- Approval pending: {data.get('pending_approvals', 0)} item

INSTRUKSI:
1. WAJIB: Mulai briefing dengan kalimat persis: "{greeting}!"  (Tidak boleh diubah)
2. Ringkasan revenue kemarin + outlet top performer (1-2 kalimat)
3. Hal-hal yang perlu diperhatikan: outlet drop, AP, stock, anomali (2-3 kalimat)
4. Closing motivasi singkat (1 kalimat)

Output: Plain text, ramah, langsung tanpa heading. Maksimal 6 kalimat. Jangan pakai bullet point. Pakai angka yang sudah diformat (jangan recompute).
"""


async def generate_daily_briefing(user: dict | None = None) -> dict:
    """Main entry — produces structured briefing payload for owner cockpit briefing page."""
    data = await _aggregate_briefing_data(user)

    owner_name = (user or {}).get("full_name", "Pak Hadi") if user else "Pak Hadi"
    # Strip parenthetical role from name if present (e.g., "Pak Hadi (Owner)")
    if "(" in owner_name:
        owner_name = owner_name.split("(")[0].strip()

    now = datetime.now(timezone.utc) + timedelta(hours=7)  # Asia/Jakarta
    h = now.hour
    greeting = _greeting_for_hour(h, owner_name)
    time_of_day = greeting.split(",")[0].replace("Selamat ", "")

    # ---- Build urgent_actions list for UI ----
    urgent_actions = []
    if data.get("attention_outlet"):
        a = data["attention_outlet"]
        urgent_actions.append({
            "type": "outlet_drop",
            "severity": "high",
            "title": f"{a['outlet_name']} turun {abs(a.get('delta_pct', 0)):.1f}%",
            "description": f"Revenue kemarin {_format_idr(a['revenue'])} vs week-ago {_format_idr(a.get('vs_week_ago', 0))}",
            "action_label": "Drilldown Outlet",
            "action_link": f"/executive/outlet/{a['outlet_id']}",
        })
    for ls in data.get("low_stock_critical", [])[:3]:
        urgent_actions.append({
            "type": "low_stock",
            "severity": "high" if ls["deficit_pct"] > 80 else "medium",
            "title": f"Stock kritis: {ls['item_name']} di {ls['outlet_name']}",
            "description": f"Sisa {ls['balance']:.0f} dari par {ls['par']} (kurang {ls['deficit_pct']:.0f}%)",
            "action_label": "Buat PR",
            "action_link": "/inventory/low-stock",
        })
    for an in data.get("anomalies_severe", [])[:2]:
        urgent_actions.append({
            "type": "anomaly",
            "severity": "high",
            "title": an["title"],
            "description": an.get("description", ""),
            "action_label": "Review Anomali",
            "action_link": "/finance/anomalies",
        })
    if data.get("ap_due_count", 0) > 0:
        urgent_actions.append({
            "type": "ap_due",
            "severity": "medium" if data["ap_due_total"] < 100_000_000 else "high",
            "title": f"{data['ap_due_count']} invoice jatuh tempo 7 hari",
            "description": f"Total {_format_idr(data['ap_due_total'])} — utama: {(data['top_ap_due'][0].get('vendor_name') or '-') if data['top_ap_due'] else '-'}",
            "action_label": "Buat Payment Request",
            "action_link": "/finance/payment-requests",
        })
    if data.get("pending_approvals", 0) > 0:
        urgent_actions.append({
            "type": "approvals",
            "severity": "medium",
            "title": f"{data['pending_approvals']} approval menunggu Anda",
            "description": "Review & approve untuk mempercepat workflow",
            "action_label": "Buka Approvals",
            "action_link": "/approvals",
        })

    # ---- Try LLM-narrated briefing, fallback to deterministic ----
    briefing_text = ""
    voice_text = ""
    llm_used = False
    llm_key = await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)
    if llm_key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            prompt = _build_briefing_prompt(data, owner_name, time_of_day)
            chat = LlmChat(
                api_key=llm_key,
                session_id=f"daily-briefing-{(user or {}).get('id', 'guest')}-{now.strftime('%Y%m%d%H')}",
                system_message="Anda adalah asisten cerdas untuk pemilik bisnis F&B di Indonesia. Bahasa Anda ramah, ringkas, dan profesional.",
            ).with_model(PROVIDER, MODEL)
            briefing_text = await chat.send_message(UserMessage(text=prompt)) or ""
            briefing_text = briefing_text.strip()
            llm_used = bool(briefing_text)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"daily_briefing_llm_failed: {e}")

    if not briefing_text:
        # Deterministic fallback briefing
        delta = data.get("yesterday_delta_pct")
        delta_str = f"({delta:+.1f}% vs minggu lalu)" if delta is not None else ""
        top = data.get("top_outlet") or {}
        attn = data.get("attention_outlet")
        sentences = [
            f"{greeting}.",
            f"Kemarin total revenue kita {_format_idr(data['yesterday_total'])} {delta_str}".strip() + ".",
        ]
        if top:
            sentences.append(f"Top performer adalah {top['outlet_name']} dengan {_format_idr(top['revenue'])}.")
        if attn:
            sentences.append(f"Yang perlu perhatian: {attn['outlet_name']} turun {abs(attn.get('delta_pct', 0)):.1f}%.")
        if data.get("low_stock_critical"):
            sentences.append(f"Ada {len(data['low_stock_critical'])} item stock kritis yang perlu segera di-restock.")
        if data.get("ap_due_count", 0) > 0:
            sentences.append(f"{data['ap_due_count']} invoice senilai {_format_idr(data['ap_due_total'])} akan jatuh tempo minggu ini.")
        sentences.append("Semoga hari Anda produktif!")
        briefing_text = " ".join(sentences)

    # Voice text: clean special chars for TTS
    voice_text = (
        briefing_text
        .replace("Rp", "Rupiah")
        .replace("%", " persen")
        .replace("&", "dan")
        .replace("\n", " ")
    )

    return {
        "greeting": greeting,
        "owner_name": owner_name,
        "time_of_day": time_of_day,
        "today": data["today"],
        "yesterday": data["yesterday"],
        "briefing_text": briefing_text,
        "voice_text": voice_text,
        "llm_used": llm_used,
        "highlights": {
            "yesterday_total": data["yesterday_total"],
            "yesterday_delta_pct": data.get("yesterday_delta_pct"),
            "mtd_revenue": data["mtd_revenue"],
            "mtd_delta_pct": data.get("mtd_delta_pct"),
            "cash_total": data["cash_total"],
            "ap_due_total": data["ap_due_total"],
            "ap_due_count": data["ap_due_count"],
            "top_outlet": data.get("top_outlet"),
            "attention_outlet": data.get("attention_outlet"),
            "anomaly_count": len(data.get("anomalies_severe", [])),
            "low_stock_count": len(data.get("low_stock_critical", [])),
            "pending_approvals": data.get("pending_approvals", 0),
        },
        "urgent_actions": urgent_actions,
        "yesterday_by_outlet": data["yesterday_by_outlet"],
        "computed_at": _now(),
    }
