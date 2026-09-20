"""Accounts Payable aging report — sumber kanonik: ap_ledgers."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from core.db import get_db


async def ap_aging(*, as_of: Optional[str] = None) -> dict:
    """AP Aging report (vendor-level) dari ap_ledgers (SSOT per ENGINEERING_GUARDRAILS).

    ap_ledgers adalah koleksi kanonik AP — bukan goods_receipts.
    Sebelumnya ap.py membaca goods_receipts sehingga total Rp77,2jt
    tidak sesuai ap_ledgers Rp93,8jt (selisih Rp16,6jt). Fix E4.
    """
    db = get_db()
    if as_of:
        try:
            today = datetime.strptime(as_of, "%Y-%m-%d").date()
        except Exception:  # noqa: BLE001
            today = datetime.now(timezone.utc).date()
    else:
        today = datetime.now(timezone.utc).date()

    bucket_keys = ["current", "d_30", "d_60", "d_90", "d_90p"]
    buckets: dict[str, float] = {k: 0.0 for k in bucket_keys}
    rows: dict[str, dict] = {}
    grand_total = 0.0

    vendor_names: dict[str, str] = {}
    async for v in db.vendors.find({"deleted_at": None}):
        vendor_names[v["id"]] = v.get("name", v["id"])

    async for ap in db.ap_ledgers.find({"deleted_at": None}):
        # Hanya baris yang masih outstanding (balance > 0, status bukan paid)
        balance = float(ap.get("balance") or 0)
        if balance <= 0:
            continue
        if ap.get("status") == "paid":
            continue

        vendor_id = ap.get("vendor_id", "unknown")
        vendor_name = vendor_names.get(vendor_id, vendor_id)

        # Hitung hari jatuh tempo dari due_date atau invoice_date + payment_terms_days
        due_date_str = ap.get("due_date")
        if not due_date_str:
            invoice_date_str = ap.get("invoice_date")
            terms = int(ap.get("payment_terms_days") or 30)
            if invoice_date_str:
                try:
                    inv_date = datetime.strptime(invoice_date_str, "%Y-%m-%d").date()
                    from datetime import timedelta
                    due_date_str = (inv_date + timedelta(days=terms)).strftime("%Y-%m-%d")
                except Exception:  # noqa: BLE001
                    due_date_str = None

        try:
            due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date() if due_date_str else today
        except Exception:  # noqa: BLE001
            due_date = today

        days_overdue = (today - due_date).days
        if days_overdue <= 0:
            b_key = "current"
        elif days_overdue <= 30:
            b_key = "d_30"
        elif days_overdue <= 60:
            b_key = "d_60"
        elif days_overdue <= 90:
            b_key = "d_90"
        else:
            b_key = "d_90p"

        buckets[b_key] = round(buckets[b_key] + balance, 2)
        grand_total += balance

        item_entry = {
            "ap_id": ap.get("id"),
            "invoice_no": ap.get("invoice_no"),
            "invoice_date": ap.get("invoice_date"),
            "due_date": due_date_str,
            "outstanding": balance,
            "days_overdue": days_overdue,
            "bucket": b_key,
            "description": ap.get("description"),
        }

        if vendor_id not in rows:
            rows[vendor_id] = {
                "vendor_id": vendor_id,
                "vendor_name": vendor_name,
                "total": 0.0,
                "current": 0.0,
                "d_30": 0.0,
                "d_60": 0.0,
                "d_90": 0.0,
                "d_90p": 0.0,
                "items": [],
            }
        rows[vendor_id]["total"] = round(rows[vendor_id]["total"] + balance, 2)
        rows[vendor_id][b_key] = round(rows[vendor_id][b_key] + balance, 2)
        rows[vendor_id]["items"].append(item_entry)

    return {
        "as_of": str(today),
        "grand_total": round(grand_total, 2),
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "rows": sorted(rows.values(), key=lambda r: -r["total"]),
        "vendor_count": len(rows),
        "source": "ap_ledgers",  # dokumen audit trail
    }
