"""Payment Request model — weekly payment approval workflow untuk FnB Group.

PR adalah workflow approval sebelum payment dieksekusi. Finance team memilih
invoices dari APLedger yang akan dibayar, submit PR, lalu Manager/CFO approve.
"""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PaymentRequestItem(BaseModel):
    """Single item dalam PR — reference ke AP Ledger atau GoodsReceipt."""
    ap_ledger_id: Optional[str] = None
    gr_id: Optional[str] = None  # Bisa langsung dari GR jika belum ada AP Ledger
    vendor_id: str
    vendor_name: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    amount: float
    priority: str = "normal"  # urgent | normal | low
    notes: Optional[str] = None


class ApprovalStep(BaseModel):
    """Single approval step dalam chain."""
    user_id: str
    user_name: Optional[str] = None
    role: str  # misal: "Finance Manager", "CFO", "Director"
    status: str = "pending"  # pending | approved | rejected
    action_at: Optional[str] = None
    notes: Optional[str] = None


def payment_request_doc(
    *,
    doc_no: str,
    request_date: str,
    period_week: str,  # YYYY-WW format
    brand_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    items: list[dict],
    requested_by: str,
    requested_by_name: Optional[str] = None,
    status: str = "draft",
    notes: Optional[str] = None,
    created_by: str,
) -> dict:
    """Create PaymentRequest document."""
    total_amount = sum(float(item.get("amount", 0)) for item in items)
    
    return {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "request_date": request_date,
        "period_week": period_week,
        "brand_id": brand_id,
        "outlet_id": outlet_id,
        "items": items,
        "total_amount": total_amount,
        "requested_by": requested_by,
        "requested_by_name": requested_by_name,
        "status": status,  # draft | submitted | approved | rejected | paid | cancelled
        "approval_chain": [],  # Will be populated when submitted
        "current_approver": None,  # User ID yang sedang harus approve
        "approved_by": None,
        "approved_at": None,
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": None,
        "paid_at": None,
        "notes": notes,
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
        "created_by": created_by,
    }


def generate_pr_no(prefix: str = "PR") -> str:
    """Generate PR number: PR-YYMM-NNNN"""
    now = datetime.now(timezone.utc)
    # Note: In production, this should query DB for max sequence in current month
    # For MVP, we use timestamp-based approach
    return f"{prefix}-{now.strftime('%y%m')}-{now.strftime('%H%M%S')}"
