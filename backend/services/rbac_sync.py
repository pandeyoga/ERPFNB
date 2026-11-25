"""RBAC sync — izin default untuk peran bawaan, diterapkan SEKALI per (peran, izin).

Dulu `$addToSet` dijalankan di setiap startup: begitu peran bisa dikonfigurasi, izin yang sengaja dicabut admin
muncul lagi setelah restart. Sekarang setiap pasangan yang sudah pernah diberikan dicatat di
`system_settings.rbac_grants_applied`; startup berikutnya hanya memberi pasangan BARU (mis. izin fitur baru).
"""
import logging

from core.db import get_db

logger = logging.getLogger("aurora.rbac")

GRANTS: dict[str, list[str]] = {
    "EXECUTIVE": ["admin.audit_log.read", "tax.efaktur.read", "tax.ebupot.read", "executive.view",
                  "anomaly.scan.trigger", "procurement.sourcing.read", "ai.agent.use", "ai.agent.automate", "ai.knowledge.manage", "import.smart.use", "menu.item.read", "ai.wa.use"],
    "OWNER": ["admin.audit_log.read", "tax.efaktur.read", "tax.ebupot.read", "executive.view", "crm.view",
              "procurement.sourcing.read", "ai.agent.use", "ai.agent.automate", "ai.knowledge.manage", "ai.agent.admin", "import.smart.use", "menu.item.read", "menu.item.manage", "ai.wa.use"],
    "GM": ["executive.view", "reservations.reports", "procurement.sourcing.read", "ai.agent.use",
           "ai.agent.automate", "ai.knowledge.manage", "import.smart.use", "menu.item.read", "menu.item.manage", "ai.wa.use"],
    "FINANCE_MANAGER": ["finance.asset.dispose", "finance.asset.revalue", "finance.asset.delete",
                        "tax.efaktur.read", "tax.efaktur.export", "tax.ebupot.read", "tax.ebupot.export",
                        "report_schedules.manage", "admin.audit_log.read", "outlet.daily_sales.validate",
                        "procurement.sourcing.read", "ai.agent.use", "ai.agent.automate", "import.smart.use", "menu.item.read", "ai.wa.use"],
    "FINANCE_STAFF": ["tax.efaktur.read", "tax.ebupot.read", "ai.agent.use", "import.smart.use", "menu.item.read"],
    "HR_MANAGER": ["hr.read", "hr.write", "hr.payroll.read", "hr.payroll.manage", "hr.payroll.approve",
                   "hr.employee.read", "ai.agent.use", "ai.agent.automate", "ai.wa.use"],
    "HR_OFFICER": ["hr.read", "hr.payroll.read", "hr.payroll.manage", "hr.employee.read", "ai.agent.use"],
    "INVENTORY_MANAGER": ["inventory.item.read", "inventory.item.update", "procurement.sourcing.read",
                          "ai.agent.use", "ai.agent.automate", "menu.item.read", "ai.wa.use"],
    "INVENTORY_STAFF": ["inventory.item.read", "ai.agent.use"],
    "PROCUREMENT_MANAGER": ["inventory.item.read", "procurement.sourcing.read", "procurement.price_list.manage",
                            "procurement.sourcing.settings", "ai.agent.use", "ai.agent.automate", "ai.wa.use"],
    "PROCUREMENT_STAFF": ["inventory.item.read", "procurement.sourcing.read", "procurement.price_list.manage",
                          "ai.agent.use"],
    "OUTLET_MANAGER": ["inventory.item.read", "reservations.reports", "procurement.sourcing.read",
                       "ai.agent.use", "ai.agent.automate", "import.smart.use", "menu.item.read", "menu.item.manage", "ai.wa.use"],
}

_LEDGER_KEY = "rbac_grants_applied"


async def ensure_rbac_grants() -> int:
    db = get_db()
    ledger = await db.system_settings.find_one({"key": _LEDGER_KEY})
    applied = set((ledger or {}).get("value") or [])
    changed = 0
    newly = []
    # Run pertama: semua grant diterapkan (aman — sebelum peran bisa diedit, versi lama menambahkannya tiap startup).
    for code, perms in GRANTS.items():
        pending = [p for p in perms if f"{code}:{p}" not in applied]
        if not pending:
            continue
        res = await db.roles.update_one({"code": code, "deleted_at": None},
                                        {"$addToSet": {"permissions": {"$each": pending}}})
        changed += res.modified_count
        # izin bawaan baru juga masuk ke default peran (dipakai "Kembalikan ke bawaan")
        await db.roles.update_one({"code": code, "deleted_at": None, "default_permissions": {"$exists": True}},
                                  {"$addToSet": {"default_permissions": {"$each": pending}}})
        newly += [f"{code}:{p}" for p in pending]
    if newly:
        await db.system_settings.update_one(
            {"key": _LEDGER_KEY}, {"$set": {"key": _LEDGER_KEY, "value": sorted(applied | set(newly))}}, upsert=True)
    return changed


async def ensure_role_defaults() -> int:
    """Peran bawaan tanpa `default_permissions` → snapshot izin saat ini sebagai bawaan (sekali)."""
    db = get_db()
    n = 0
    async for r in db.roles.find({"is_system": True, "deleted_at": None, "default_permissions": {"$exists": False}},
                                 {"id": 1, "permissions": 1}):
        await db.roles.update_one({"id": r["id"]}, {"$set": {"default_permissions": list(r.get("permissions") or [])}})
        n += 1
    return n
