"""AR aging and reconciliation reports."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize


async def ar_aging() -> dict:
    """AR Aging report bucketed: Current, 1-30d, 31-60d, 61-90d, >90d."""
    db = get_db()
    today = datetime.now(timezone.utc).date()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    bucket_items: dict[str, list] = {k: [] for k in buckets}
    total_outstanding = 0.0

    async for inv in db.ar_invoices.find({"status": {"$nin": ["paid", "cancelled"]}, "deleted_at": None}):
        outstanding = float(inv.get("outstanding", 0))
        if outstanding <= 0:
            continue
        try:
            due = datetime.strptime(inv.get("due_date", str(today)), "%Y-%m-%d").date()
        except Exception:
            due = today
        days_overdue = (today - due).days
        item = {"id": inv["id"], "invoice_no": inv.get("invoice_no"), "customer_name": inv.get("customer_name"), "outstanding": outstanding, "due_date": inv.get("due_date"), "days_overdue": days_overdue}
        total_outstanding += outstanding
        if days_overdue <= 0:
            buckets["current"] += outstanding
            bucket_items["current"].append(item)
        elif days_overdue <= 30:
            buckets["1_30"] += outstanding
            bucket_items["1_30"].append(item)
        elif days_overdue <= 60:
            buckets["31_60"] += outstanding
            bucket_items["31_60"].append(item)
        elif days_overdue <= 90:
            buckets["61_90"] += outstanding
            bucket_items["61_90"].append(item)
        else:
            buckets["over_90"] += outstanding
            bucket_items["over_90"].append(item)

    return {
        "as_of": str(today),
        "total_outstanding": round(total_outstanding, 2),
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "items": bucket_items,
    }


async def aging_report(as_of: Optional[str] = None, customer_id: Optional[str] = None) -> dict:
    """AR Aging report with customer breakdown and optional as_of date."""
    db = get_db()
    if as_of:
        try:
            today = datetime.strptime(as_of, "%Y-%m-%d").date()
        except Exception:
            today = datetime.now(timezone.utc).date()
    else:
        today = datetime.now(timezone.utc).date()

    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    bucket_labels = {"current": "Belum Jatuh Tempo", "1_30": "1-30 Hari", "31_60": "31-60 Hari", "61_90": "61-90 Hari", "over_90": ">90 Hari"}
    bucket_items: dict[str, list] = {k: [] for k in buckets}
    total_outstanding = 0.0
    by_customer: dict[str, dict] = {}

    q: dict = {"status": {"$nin": ["paid", "cancelled"]}, "deleted_at": None}
    if customer_id:
        q["customer_id"] = customer_id

    async for inv in db.ar_invoices.find(q):
        outstanding = float(inv.get("outstanding", 0))
        if outstanding <= 0:
            continue
        try:
            due = datetime.strptime(inv.get("due_date", str(today)), "%Y-%m-%d").date()
        except Exception:
            due = today
        days_overdue = (today - due).days
        item = {
            "id": inv["id"],
            "invoice_no": inv.get("invoice_no"),
            "customer_id": inv.get("customer_id"),
            "customer_name": inv.get("customer_name"),
            "outstanding": outstanding,
            "due_date": inv.get("due_date"),
            "days_overdue": days_overdue,
        }
        total_outstanding += outstanding

        if days_overdue <= 0:
            key = "current"
        elif days_overdue <= 30:
            key = "1_30"
        elif days_overdue <= 60:
            key = "31_60"
        elif days_overdue <= 90:
            key = "61_90"
        else:
            key = "over_90"
        buckets[key] += outstanding
        bucket_items[key].append(item)

        cust_key = inv.get("customer_id") or inv.get("customer_name", "unknown")
        if cust_key not in by_customer:
            by_customer[cust_key] = {
                "customer_id": inv.get("customer_id"),
                "customer_name": inv.get("customer_name", ""),
                "total_outstanding": 0.0,
                "buckets": {k: 0.0 for k in buckets},
                "invoices": [],
            }
        by_customer[cust_key]["total_outstanding"] += outstanding
        by_customer[cust_key]["buckets"][key] += outstanding
        by_customer[cust_key]["invoices"].append(item)

    return {
        "as_of": str(today),
        "total_outstanding": round(total_outstanding, 2),
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "bucket_labels": bucket_labels,
        "items": bucket_items,
        "by_customer": sorted(by_customer.values(), key=lambda x: -x["total_outstanding"]),
    }


async def reconciliation_report(period: str) -> dict:
    """AR Reconciliation for a given YYYY-MM period."""
    db = get_db()

    async def _sum_outstanding_before(cutoff: str) -> float:
        total = 0.0
        async for inv in db.ar_invoices.find({"deleted_at": None, "invoice_date": {"$lt": cutoff + "-01"}, "status": {"$nin": ["cancelled"]}}):
            total += float(inv.get("outstanding", 0))
        return total

    async def _sum_invoices_in_period(p: str) -> float:
        total = 0.0
        async for inv in db.ar_invoices.find({"deleted_at": None, "period": p}):
            total += float(inv.get("total_amount", 0))
        return total

    async def _sum_receipts_in_period(p: str) -> float:
        total = 0.0
        async for rec in db.ar_receipts.find({"receipt_date": {"$regex": f"^{p}"}}):
            total += float(rec.get("amount", 0))
        return total

    opening = await _sum_outstanding_before(period)
    invoiced = await _sum_invoices_in_period(period)
    received = await _sum_receipts_in_period(period)
    closing = opening + invoiced - received

    return {
        "period": period,
        "opening_balance": round(opening, 2),
        "invoices_issued": round(invoiced, 2),
        "receipts_received": round(received, 2),
        "closing_balance": round(closing, 2),
    }
