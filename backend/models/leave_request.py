"""Leave Request model — custom approval sprint."""
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


LEAVE_TYPES = [
    {"code": "annual",     "name": "Cuti Tahunan"},
    {"code": "sick",       "name": "Sakit"},
    {"code": "personal",   "name": "Keperluan Pribadi"},
    {"code": "emergency",  "name": "Darurat Keluarga"},
    {"code": "maternity",  "name": "Cuti Melahirkan"},
    {"code": "paternity",  "name": "Cuti Ayah"},
    {"code": "other",      "name": "Lainnya"},
]

_COUNTERS: dict[str, int] = {}


async def _next_doc_no(db) -> str:
    year = datetime.now(timezone.utc).year
    key = f"LR-{year}"
    existing = await db.leave_requests.count_documents({"doc_no": {"$regex": f"^{key}"}})
    return f"{key}-{existing + 1:04d}"


def make_leave_request(
    *,
    employee_id: str,
    employee_name: str,
    outlet_id: Optional[str],
    leave_type: str,
    start_date: str,
    end_date: str,
    days_count: float,
    notes: Optional[str],
    attachment_url: Optional[str],
    created_by: str,
    doc_no: str = "",
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "employee_id": employee_id,
        "employee_name": employee_name,
        "outlet_id": outlet_id,
        "leave_type": leave_type,
        "start_date": start_date,
        "end_date": end_date,
        "days_count": days_count,
        "notes": notes,
        "attachment_url": attachment_url,
        # Approval
        "status": "draft",
        "approval_chain": [],
        "submitted_at": None,
        "approved_at": None,
        "rejected_at": None,
        "rejection_reason": None,
        # Audit
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
    }
