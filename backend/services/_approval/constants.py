"""Shared constants for approval engine (entity catalogs + default workflows)."""
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Map entity_type → mongo collection
ENTITY_COLLECTIONS: dict[str, str] = {
    "purchase_request":  "purchase_requests",
    "purchase_order":    "purchase_orders",
    "stock_adjustment":  "adjustments",
    "payment_request":   "payment_requests",
    "employee_advance":  "employee_advances",
    # New entity types
    "budget":            "budgets",
    "leave_request":     "leave_requests",
    "stock_transfer":    "stock_transfers",
    "ar_invoice":        "ar_invoices",
}

# Entities that use a non-standard field name for approval status
ENTITY_STATUS_FIELD: dict[str, str] = {
    "budget": "approval_status",   # budgets use approval_status, not status
}

# Human-readable labels for all entity types
ENTITY_LABELS: dict[str, str] = {
    "purchase_request":  "Purchase Request",
    "purchase_order":    "Purchase Order",
    "stock_adjustment":  "Stock Adjustment",
    "payment_request":   "Payment Request",
    "employee_advance":  "Employee Advance",
    "budget":            "Budget",
    "leave_request":     "Leave Request",
    "stock_transfer":    "Stock Transfer",
    "ar_invoice":        "AR Invoice",
}

ENTITY_LINK_BUILDERS = {
    "purchase_request":  lambda eid: f"/procurement/pr/{eid}",
    "purchase_order":    lambda eid: f"/procurement/po/{eid}",
    "stock_adjustment":  lambda _eid: "/inventory/adjustments",
    "payment_request":   lambda eid: f"/finance/payment-requests/{eid}",
    "employee_advance":  lambda _eid: "/hr/advances",
    "budget":            lambda eid: "/finance/budget/manage",
    "leave_request":     lambda eid: "/hr/leaves",
    "stock_transfer":    lambda eid: "/inventory/transfers",
    "ar_invoice":        lambda eid: "/finance/ar-invoices",
}


# Default workflows used by seed and admin "Reset to default"
DEFAULT_WORKFLOWS: dict[str, dict] = {
    "purchase_request": {
        "entity_type": "purchase_request",
        "amount_field": None,
        "tiers": [
            {
                "min_amount": 0, "max_amount": 1000000, "label": "Tier 1 (<Rp 1jt)",
                "steps": [
                    {"label": "Procurement", "any_of_perms": ["procurement.pr.approve"]},
                ],
            },
            {
                "min_amount": 1000000, "max_amount": 10000000, "label": "Tier 2 (Rp 1jt – 10jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.pr.approve"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                ],
            },
            {
                "min_amount": 10000000, "max_amount": None, "label": "Tier 3 (>Rp 10jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.pr.approve"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                    {"label": "Executive / GM",      "any_of_perms": ["executive.dashboard.read", "*"]},
                ],
            },
        ],
    },
    "purchase_order": {
        "entity_type": "purchase_order",
        "amount_field": "grand_total",
        "tiers": [
            {
                "min_amount": 0, "max_amount": 5000000, "label": "Tier 1 (<Rp 5jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.po.send", "procurement.po.create"]},
                ],
            },
            {
                "min_amount": 5000000, "max_amount": 50000000, "label": "Tier 2 (Rp 5jt – 50jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.po.send"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                ],
            },
            {
                "min_amount": 50000000, "max_amount": None, "label": "Tier 3 (>Rp 50jt)",
                "steps": [
                    {"label": "Procurement Manager", "any_of_perms": ["procurement.po.send"]},
                    {"label": "Finance Manager",     "any_of_perms": ["finance.payment.approve"]},
                    {"label": "Executive / GM",      "any_of_perms": ["executive.dashboard.read", "*"]},
                ],
            },
        ],
    },
    "stock_adjustment": {
        "entity_type": "stock_adjustment",
        "amount_field": "total_value",
        "tiers": [
            {
                "min_amount": 0, "max_amount": 500000, "label": "Tier 1 (<Rp 500rb)",
                "steps": [
                    {"label": "Inventory Approver", "any_of_perms": ["inventory.adjustment.approve"]},
                ],
            },
            {
                "min_amount": 500000, "max_amount": None, "label": "Tier 2 (≥Rp 500rb)",
                "steps": [
                    {"label": "Inventory Approver", "any_of_perms": ["inventory.adjustment.approve"]},
                    {"label": "Finance Manager",    "any_of_perms": ["finance.payment.approve"]},
                ],
            },
        ],
    },
    "payment_request": {
        "entity_type": "payment_request",
        "amount_field": "amount",
        "tiers": [
            {
                "min_amount": 0, "max_amount": 10000000, "label": "Tier 1 (<Rp 10jt)",
                "steps": [
                    {"label": "Finance Manager", "any_of_perms": ["finance.payment.approve"], "deadline_hours": 24},
                ],
            },
            {
                "min_amount": 10000000, "max_amount": 50000000, "label": "Tier 2 (Rp 10jt – 50jt)",
                "steps": [
                    {"label": "Finance Manager", "any_of_perms": ["finance.payment.approve"], "deadline_hours": 24},
                    {"label": "Executive / GM",   "any_of_perms": ["executive.dashboard.read", "*"], "deadline_hours": 48, "escalate_to_perms": ["*"]},
                ],
            },
            {
                "min_amount": 50000000, "max_amount": None, "label": "Tier 3 (>Rp 50jt)",
                "steps": [
                    {"label": "Finance Manager", "any_of_perms": ["finance.payment.approve"], "deadline_hours": 24},
                    {"label": "Executive / GM",   "any_of_perms": ["executive.dashboard.read", "*"], "deadline_hours": 24},
                    {"label": "Owner",            "any_of_perms": ["*"], "deadline_hours": 48, "escalate_to_perms": ["*"]},
                ],
            },
        ],
    },
    "budget": {
        "entity_type": "budget",
        "amount_field": None,
        "tiers": [
            {
                "min_amount": 0, "max_amount": None, "label": "Semua Budget",
                "steps": [
                    {"label": "Finance Manager", "any_of_perms": ["finance.budget.update"], "deadline_hours": 48},
                    {"label": "Executive / GM",  "any_of_perms": ["executive.dashboard.read", "*"], "deadline_hours": 72, "escalate_to_perms": ["*"]},
                ],
            },
        ],
    },
    "leave_request": {
        "entity_type": "leave_request",
        "amount_field": None,
        "tiers": [
            {
                "min_amount": 0, "max_amount": None, "label": "Semua Leave",
                "steps": [
                    {"label": "HR / Outlet Manager", "any_of_perms": ["hr.leave.approve"], "deadline_hours": 24, "escalate_to_perms": ["hr.advance.approve"]},
                ],
            },
        ],
    },
    "stock_transfer": {
        "entity_type": "stock_transfer",
        "amount_field": "total_value",
        "tiers": [
            {
                "min_amount": 0, "max_amount": 5000000, "label": "Tier 1 (<Rp 5jt)",
                "steps": [
                    {"label": "Inventory Approver", "any_of_perms": ["inventory.adjustment.approve"], "deadline_hours": 4},
                ],
            },
            {
                "min_amount": 5000000, "max_amount": None, "label": "Tier 2 (≥Rp 5jt)",
                "steps": [
                    {"label": "Inventory Approver", "any_of_perms": ["inventory.adjustment.approve"], "deadline_hours": 4},
                    {"label": "Finance Manager",    "any_of_perms": ["finance.payment.approve"], "deadline_hours": 24},
                ],
            },
        ],
    },
    "ar_invoice": {
        "entity_type": "ar_invoice",
        "amount_field": "total_amount",
        "tiers": [
            {
                "min_amount": 0, "max_amount": 10000000, "label": "Tier 1 (<Rp 10jt)",
                "steps": [
                    {"label": "Finance Manager", "any_of_perms": ["finance.ar.send"], "deadline_hours": 24},
                ],
            },
            {
                "min_amount": 10000000, "max_amount": None, "label": "Tier 2 (≥Rp 10jt)",
                "steps": [
                    {"label": "Finance Manager", "any_of_perms": ["finance.ar.send"], "deadline_hours": 24},
                    {"label": "Executive / GM",  "any_of_perms": ["executive.dashboard.read", "*"], "deadline_hours": 48},
                ],
            },
        ],
    },
}
