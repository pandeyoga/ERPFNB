"""RBAC sync (audit 2c): grant router-guarded permissions that no role held. Idempotent ($addToSet)."""
import logging

from core.db import get_db

logger = logging.getLogger("aurora.rbac")

GRANTS: dict[str, list[str]] = {
    "EXECUTIVE": ["admin.audit_log.read", "tax.efaktur.read", "tax.ebupot.read"],
    "OWNER": ["admin.audit_log.read", "tax.efaktur.read", "tax.ebupot.read"],
    "FINANCE_MANAGER": ["finance.asset.dispose", "finance.asset.revalue", "finance.asset.delete",
                        "tax.efaktur.read", "tax.efaktur.export", "tax.ebupot.read", "tax.ebupot.export",
                        "report_schedules.manage", "admin.audit_log.read", "outlet.daily_sales.validate"],
    "FINANCE_STAFF": ["tax.efaktur.read", "tax.ebupot.read"],
    "HR_MANAGER": ["hr.read", "hr.write"],
    "HR_OFFICER": ["hr.read"],
    "INVENTORY_MANAGER": ["inventory.item.read", "inventory.item.update"],
    "INVENTORY_STAFF": ["inventory.item.read"],
    "PROCUREMENT_MANAGER": ["inventory.item.read"],
    "PROCUREMENT_STAFF": ["inventory.item.read"],
    "OUTLET_MANAGER": ["inventory.item.read"],
}


async def ensure_rbac_grants() -> int:
    db = get_db()
    changed = 0
    for code, perms in GRANTS.items():
        res = await db.roles.update_one({"code": code, "deleted_at": None},
                                        {"$addToSet": {"permissions": {"$each": perms}}})
        changed += res.modified_count
    return changed
