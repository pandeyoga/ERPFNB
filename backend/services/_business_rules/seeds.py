"""Default rule templates and seed function used by Admin 'Seed Defaults' button."""
from __future__ import annotations

from core.db import get_db

from services._business_rules._common import _now
from services._business_rules.crud import create_rule


DEFAULT_RULES: dict[str, dict] = {
    "sales_input_schema": {
        "name": "Skema Penjualan Standar",
        "description": "Channel, metode pembayaran, dan bucket pendapatan default untuk outlet F&B.",
        "rule_data": {
            "channels": [
                {"code": "DINEIN", "name": "Dine-in", "active": True},
                {"code": "TAKEAWAY", "name": "Takeaway", "active": True},
                {"code": "GOFOOD", "name": "GoFood", "active": True},
                {"code": "GRABFOOD", "name": "GrabFood", "active": True},
                {"code": "SHOPEEFOOD", "name": "ShopeeFood", "active": False},
            ],
            "payment_methods": [
                {"code": "CASH", "name": "Cash", "active": True},
                {"code": "DEBIT", "name": "Debit Card", "active": True},
                {"code": "CREDIT", "name": "Credit Card", "active": True},
                {"code": "QRIS", "name": "QRIS", "active": True},
                {"code": "GOPAY", "name": "GoPay", "active": True},
                {"code": "OVO", "name": "OVO", "active": False},
            ],
            "revenue_buckets": [
                {"code": "FOOD", "name": "Food", "required": True},
                {"code": "BEVERAGE", "name": "Beverage", "required": True},
                {"code": "BAR", "name": "Bar", "required": False},
                {"code": "OTHER", "name": "Other", "required": False},
            ],
            "validation_rules": [
                {"id": "payment_total_match", "label": "Total pembayaran harus sama dengan grand total", "severity": "error", "active": True},
                {"id": "transaction_count_positive", "label": "Jumlah transaksi harus > 0", "severity": "warning", "active": True},
            ],
        },
    },
    "petty_cash_policy": {
        "name": "Kebijakan Kas Kecil Standar",
        "description": "Limit, threshold approval, dan akun GL yang diizinkan.",
        "rule_data": {
            "monthly_limit": 5_000_000,
            "max_per_txn": 500_000,
            "approval_threshold": 250_000,
            "replenish_frequency": "weekly",
            "allowed_gl_accounts": [],
            "require_receipt": True,
        },
    },
    "service_charge_policy": {
        "name": "Service Charge Standar",
        "description": "5% service charge dengan potongan L&B 1%, alokasi by days worked.",
        "rule_data": {
            "service_charge_pct": 0.05,
            "lb_pct": 0.01,
            "ld_pct": 0.0,
            "allocation_method": "by_days_worked",
            "default_working_days": 22,
        },
    },
    "incentive_policy": {
        "name": "Skema Insentif Standar",
        "description": "Insentif % dari penjualan dengan target bulanan.",
        "rule_data": {
            "rule_type": "pct_of_sales",
            "target_amount": 100_000_000,
            "incentive_pct": 0.01,
            "eligibility": {
                "roles": [],
                "min_days_worked": 22,
                "exclude_probation": True,
            },
            "tiers": [],
        },
    },
    "anomaly_threshold_policy": {
        "name": "Threshold Deteksi Anomali Standar",
        "description": "Default thresholds untuk deteksi anomali real-time (sales, vendor, AP/cash).",
        "rule_data": {
            "sales_deviation": {
                "enabled": True,
                "sigma_mild": 1.5,
                "sigma_severe": 2.5,
                "window_days": 14,
                "min_points": 7,
            },
            "vendor_price_spike": {
                "enabled": True,
                "pct_mild": 15,
                "pct_severe": 30,
                "window_days": 90,
            },
            "vendor_leadtime": {
                "enabled": True,
                "days_mild": 3,
                "days_severe": 7,
                "window_days": 90,
            },
            "ap_cash_spike": {
                "enabled": True,
                "pct_mild": 15,
                "pct_severe": 30,
            },
        },
    },
}


async def seed_defaults(*, user: dict, overwrite: bool = False) -> int:
    """Insert one default rule per supported rule_type at scope=group/* if missing.
    Returns the number of rules inserted.
    """
    db = get_db()
    inserted = 0
    for rt, tpl in DEFAULT_RULES.items():
        existing = await db.business_rules.find_one(
            {
                "deleted_at": None,
                "rule_type": rt,
                "scope_type": "group",
                "scope_id": "*",
            }
        )
        if existing and not overwrite:
            continue
        if existing and overwrite:
            await db.business_rules.update_one(
                {"id": existing["id"]},
                {"$set": {"active": False, "updated_at": _now()}},
            )
        await create_rule(
            {
                "rule_type": rt,
                "scope_type": "group",
                "scope_id": "*",
                "rule_data": tpl["rule_data"],
                "name": tpl["name"],
                "description": tpl["description"],
                "active": True,
                "effective_from": None,
                "effective_to": None,
            },
            user=user,
        )
        inserted += 1
    return inserted
