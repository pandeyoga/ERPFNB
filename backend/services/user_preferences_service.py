"""User Preferences Service — Sprint F Phase 3.

Stores per-user preferences like dashboard preset selection,
widget visibility, and other personalization settings.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional
from core.db import get_db, serialize

logger = logging.getLogger("aurora.user_prefs")


# ──────────────────────────────────────────
# 1. PRESET DEFINITIONS
# ──────────────────────────────────────────

OWNER_PRESETS = {
    "sales_focus": {
        "id": "sales_focus",
        "name": "Sales Focus",
        "icon": "TrendingUp",
        "description": "Fokus pada penjualan harian dan performa outlet",
        "widgets": [
            "kpi_revenue", "kpi_covers", "kpi_avg_check",
            "sales_chart", "outlet_ranking", "top_products",
        ],
    },
    "cash_flow": {
        "id": "cash_flow",
        "name": "Cash Flow",
        "icon": "Wallet",
        "description": "Fokus pada posisi kas dan pembayaran",
        "widgets": [
            "kpi_cash", "kpi_outstanding_ap", "kpi_pending_payment",
            "cash_trend", "ap_aging_mini", "payment_schedule",
        ],
    },
    "operations": {
        "id": "operations",
        "name": "Operations",
        "icon": "Settings",
        "description": "Monitoring operasional: inventory, approval, anomali",
        "widgets": [
            "kpi_low_stock", "kpi_pending_approvals", "kpi_open_anomalies",
            "anomaly_feed", "pending_approvals_list", "outlet_status",
        ],
    },
    "full_view": {
        "id": "full_view",
        "name": "Full View",
        "icon": "LayoutDashboard",
        "description": "Semua widget — tampilan lengkap",
        "widgets": [
            "kpi_revenue", "kpi_covers", "kpi_cash", "kpi_pending_approvals",
            "sales_chart", "outlet_ranking", "anomaly_feed", "ap_aging_mini",
            "cash_trend", "top_products",
        ],
    },
}

EXEC_PRESETS = {
    "kpi_overview": {
        "id": "kpi_overview",
        "name": "KPI Overview",
        "icon": "BarChart3",
        "description": "Semua KPI utama dalam satu pandang",
        "widgets": [
            "kpi_revenue", "kpi_covers", "kpi_gp_margin", "kpi_labor_cost",
            "revenue_trend", "brand_breakdown",
        ],
    },
    "brand_performance": {
        "id": "brand_performance",
        "name": "Brand Performance",
        "icon": "Award",
        "description": "Perbandingan performa antar brand",
        "widgets": [
            "brand_breakdown", "brand_vs_target", "outlet_ranking",
            "top_products", "brand_trend",
        ],
    },
    "anomaly_watch": {
        "id": "anomaly_watch",
        "name": "Anomaly Watch",
        "icon": "AlertTriangle",
        "description": "Fokus pada anomali dan risiko",
        "widgets": [
            "kpi_open_anomalies", "kpi_severe_anomalies",
            "anomaly_feed", "anomaly_trend", "ai_insights",
        ],
    },
    "finance_view": {
        "id": "finance_view",
        "name": "Finance View",
        "icon": "FileText",
        "description": "Ringkasan keuangan untuk Executive",
        "widgets": [
            "kpi_revenue", "kpi_gp_margin", "kpi_cash", "kpi_outstanding_ap",
            "pl_summary", "ap_aging_mini", "cash_trend",
        ],
    },
}

PRESET_CATALOG = {
    "owner": OWNER_PRESETS,
    "executive": EXEC_PRESETS,
}


# ──────────────────────────────────────────
# 2. CRUD
# ──────────────────────────────────────────

async def get_preferences(user_id: str) -> dict:
    db = get_db()
    doc = await db.user_preferences.find_one({"user_id": user_id})
    return serialize(doc) if doc else {"user_id": user_id, "preferences": {}}


async def set_preference(user_id: str, key: str, value) -> dict:
    """Upsert a single preference key for a user."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.user_preferences.update_one(
        {"user_id": user_id},
        {"$set": {f"preferences.{key}": value, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return await get_preferences(user_id)


async def set_preferences_bulk(user_id: str, updates: dict) -> dict:
    """Upsert multiple preference keys at once.

    Lightweight client-side validation:
      - `collapsed_widgets` must be a list of strings, max 100 entries.
      - `dashboard_preset_{portal}` must be a non-empty string.
    Unknown keys are accepted (forward compatibility) but coerced to JSON-safe types.
    """
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    sanitized: dict = {}
    for k, v in (updates or {}).items():
        if k == "collapsed_widgets":
            if not isinstance(v, list):
                raise ValueError("collapsed_widgets must be a list of strings")
            cleaned = [str(x) for x in v if isinstance(x, (str, int))]
            if len(cleaned) > 100:
                cleaned = cleaned[:100]
            sanitized[k] = cleaned
        elif k.startswith("dashboard_preset_"):
            if not isinstance(v, str) or not v:
                raise ValueError(f"{k} must be a non-empty string")
            sanitized[k] = v
        else:
            sanitized[k] = v

    set_fields = {f"preferences.{k}": v for k, v in sanitized.items()}
    set_fields["updated_at"] = now
    await db.user_preferences.update_one(
        {"user_id": user_id},
        {"$set": set_fields, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return await get_preferences(user_id)


async def get_dashboard_preset(user_id: str, portal: str) -> Optional[str]:
    prefs = await get_preferences(user_id)
    return prefs.get("preferences", {}).get(f"dashboard_preset_{portal}")


async def set_dashboard_preset(user_id: str, portal: str, preset_id: str) -> dict:
    catalog = PRESET_CATALOG.get(portal, {})
    if preset_id not in catalog:
        valid = list(catalog.keys())
        raise ValueError(f"Invalid preset_id '{preset_id}'. Valid: {valid}")
    return await set_preference(user_id, f"dashboard_preset_{portal}", preset_id)
