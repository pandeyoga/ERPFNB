"""Procurement Workboard service (Phase 9B) — Kanban-style aggregation
of PRs + POs + GRs across the procurement pipeline.

Columns (logical):
  pr_draft           -> PRs status=draft
  pr_pending         -> PRs status=submitted/awaiting_approval
  pr_approved        -> PRs status=approved (not yet converted)
  po_draft           -> POs status=draft / awaiting_approval (pending approval)
  po_sent            -> POs status=sent (waiting receiving)
  po_partial         -> POs status=partial
  po_received        -> POs status=received (closed)

We return a UNIFIED list of "cards" with column hints + key metadata.
Drag-and-drop in UI translates to API calls (existing approve/send/etc).
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Map PR status -> kanban column
_PR_COL = {
    "draft": "pr_draft",
    "submitted": "pr_pending",
    "awaiting_approval": "pr_pending",
    "approved": "pr_approved",
}
# Map PO status -> kanban column
_PO_COL = {
    "draft": "po_draft",
    "awaiting_approval": "po_draft",
    "approved": "po_draft",  # approved-but-not-sent stays in "Draft / approved" column
    "sent": "po_sent",
    "partial": "po_partial",
    "received": "po_received",
}


COLUMN_DEFS: list[dict] = [
    {"key": "pr_draft", "label": "PR Draft", "tone": "muted"},
    {"key": "pr_pending", "label": "PR Pending Approval", "tone": "amber"},
    {"key": "pr_approved", "label": "PR Approved", "tone": "blue"},
    {"key": "po_draft", "label": "PO Draft / Approval", "tone": "indigo"},
    {"key": "po_sent", "label": "PO Sent", "tone": "violet"},
    {"key": "po_partial", "label": "PO Partial", "tone": "orange"},
    {"key": "po_received", "label": "PO Received", "tone": "green"},
]


async def get_workboard(
    *,
    outlet_ids: Optional[list[str]] = None,
    vendor_id: Optional[str] = None,
    days: int = 60,
    limit_per_column: int = 50,
) -> dict:
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    pr_q: dict = {
        "deleted_at": None,
        "request_date": {"$gte": cutoff},
        "status": {"$in": list(_PR_COL.keys())},
    }
    if outlet_ids is not None:
        pr_q["outlet_id"] = {"$in": outlet_ids}
    prs = await db.purchase_requests.find(pr_q).sort([("created_at", -1)]).limit(500).to_list(500)

    po_q: dict = {
        "deleted_at": None,
        "order_date": {"$gte": cutoff},
        "status": {"$in": list(_PO_COL.keys())},
    }
    if vendor_id:
        po_q["vendor_id"] = vendor_id
    pos = await db.purchase_orders.find(po_q).sort([("created_at", -1)]).limit(500).to_list(500)

    # Resolve names
    outlet_ids_seen: set[str] = set()
    vendor_ids_seen: set[str] = set()
    for d in prs:
        if d.get("outlet_id"):
            outlet_ids_seen.add(d["outlet_id"])
    for d in pos:
        if d.get("vendor_id"):
            vendor_ids_seen.add(d["vendor_id"])
        if d.get("outlet_id"):
            outlet_ids_seen.add(d["outlet_id"])

    outlets = await db.outlets.find({"id": {"$in": list(outlet_ids_seen)}}).to_list(len(outlet_ids_seen) or 1)
    vendors = await db.vendors.find({"id": {"$in": list(vendor_ids_seen)}}).to_list(len(vendor_ids_seen) or 1)
    outlets_by_id = {o["id"]: o for o in outlets}
    vendors_by_id = {v["id"]: v for v in vendors}

    # Build cards
    cards: dict[str, list[dict]] = {col["key"]: [] for col in COLUMN_DEFS}

    for pr in prs:
        col = _PR_COL.get(pr.get("status"))
        if not col:
            continue
        outlet = outlets_by_id.get(pr.get("outlet_id"), {})
        line_count = len(pr.get("lines", []) or [])
        # Estimate total
        est_total = sum(
            float(ln.get("qty", 0) or 0) * float(ln.get("est_cost", 0) or 0)
            for ln in (pr.get("lines") or [])
        )
        cards[col].append({
            "type": "pr",
            "id": pr["id"],
            "doc_no": pr.get("doc_no"),
            "status": pr.get("status"),
            "title": pr.get("doc_no") or pr["id"][:8],
            "outlet_id": pr.get("outlet_id"),
            "outlet_name": outlet.get("name"),
            "outlet_code": outlet.get("code"),
            "vendor_id": None,
            "vendor_name": None,
            "date": pr.get("request_date"),
            "needed_by": pr.get("needed_by"),
            "line_count": line_count,
            "total": round(est_total, 2),
            "source": pr.get("source", "manual"),
            "url": f"/procurement/pr/{pr['id']}",
            "created_at": pr.get("created_at"),
            "updated_at": pr.get("updated_at"),
        })

    for po in pos:
        col = _PO_COL.get(po.get("status"))
        if not col:
            continue
        vendor = vendors_by_id.get(po.get("vendor_id"), {})
        outlet = outlets_by_id.get(po.get("outlet_id"), {})
        line_count = len(po.get("lines", []) or [])
        cards[col].append({
            "type": "po",
            "id": po["id"],
            "doc_no": po.get("doc_no"),
            "status": po.get("status"),
            "title": po.get("doc_no") or po["id"][:8],
            "outlet_id": po.get("outlet_id"),
            "outlet_name": outlet.get("name"),
            "vendor_id": po.get("vendor_id"),
            "vendor_name": vendor.get("name"),
            "date": po.get("order_date"),
            "expected_delivery_date": po.get("expected_delivery_date"),
            "line_count": line_count,
            "total": round(float(po.get("grand_total", 0) or 0), 2),
            "source": "po",
            "url": f"/procurement/po/{po['id']}",
            "created_at": po.get("created_at"),
            "updated_at": po.get("updated_at"),
        })

    # Sort & truncate per column
    for k, lst in cards.items():
        lst.sort(key=lambda c: c.get("updated_at") or c.get("created_at") or "", reverse=True)
        cards[k] = lst[:limit_per_column]

    # Counts (untrucated using full prs/pos lists)
    counts = {col["key"]: 0 for col in COLUMN_DEFS}
    for pr in prs:
        col = _PR_COL.get(pr.get("status"))
        if col:
            counts[col] += 1
    for po in pos:
        col = _PO_COL.get(po.get("status"))
        if col:
            counts[col] += 1

    return {
        "columns": COLUMN_DEFS,
        "cards": cards,
        "counts": counts,
        "as_of": _now(),
        "filters": {"outlet_ids": outlet_ids, "vendor_id": vendor_id, "days": days},
    }


# Available actions per (card_type, current_status, target_column)
# Returns the API path the UI must call when a card is dragged from current → target.
ALLOWED_TRANSITIONS: list[dict] = [
    # PR transitions
    {"type": "pr", "from": "draft", "to": "pr_pending",
     "action": "submit", "method": "POST", "path": "/procurement/prs/{id}",
     "label": "Submit PR (set status=submitted)", "writable": False,
     "note": "PR submit is implicit on create — drag-and-drop limited"},
    {"type": "pr", "from": "submitted", "to": "pr_approved",
     "action": "approve", "method": "POST", "path": "/procurement/prs/{id}/approve",
     "label": "Approve PR", "writable": True, "perm": "procurement.pr.approve"},
    # PO transitions
    {"type": "po", "from": "draft", "to": "po_draft",
     "action": "submit", "method": "POST", "path": "/procurement/pos/{id}/submit",
     "label": "Submit PO for approval", "writable": True, "perm": "procurement.po.create"},
    {"type": "po", "from": "awaiting_approval", "to": "po_draft",
     "action": "approve", "method": "POST", "path": "/procurement/pos/{id}/approve",
     "label": "Approve PO", "writable": True, "perm": "procurement.po.approve"},
    {"type": "po", "from": "approved", "to": "po_sent",
     "action": "send", "method": "POST", "path": "/procurement/pos/{id}/send",
     "label": "Send PO to vendor", "writable": True, "perm": "procurement.po.send"},
    {"type": "po", "from": "draft", "to": "po_sent",
     "action": "send", "method": "POST", "path": "/procurement/pos/{id}/send",
     "label": "Send PO directly (no workflow)", "writable": True, "perm": "procurement.po.send"},
    {"type": "po", "from": "sent", "to": "po_received",
     "action": "receive", "method": "GET",  # opens GR form
     "path": "/procurement/gr/new?po={id}",
     "label": "Buat Goods Receipt (terima barang)", "writable": True,
     "perm": "procurement.gr.post", "redirect": True},
    {"type": "po", "from": "partial", "to": "po_received",
     "action": "receive_more", "method": "GET",
     "path": "/procurement/gr/new?po={id}",
     "label": "Lanjut Terima Barang", "writable": True,
     "perm": "procurement.gr.post", "redirect": True},
]


def get_transition(card_type: str, from_status: str, to_column: str) -> Optional[dict]:
    for t in ALLOWED_TRANSITIONS:
        if t["type"] == card_type and t["from"] == from_status and t["to"] == to_column:
            return t
    return None
