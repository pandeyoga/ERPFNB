"""Phase 11 demo seed — cash accounts + Owner role/user.

Run: python -m seed.seed_phase11_demo
Idempotent: re-run is safe.
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from core.security import hash_password  # noqa: E402


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def doc(extra: dict | None = None) -> dict:
    base = {
        "id": str(uuid.uuid4()),
        "created_at": now(), "updated_at": now(),
        "deleted_at": None, "is_active": True,
    }
    if extra:
        base.update(extra)
    return base


OWNER_ROLE = {
    "code": "OWNER",
    "name": "Owner / Founder",
    "description": "Read-only finance + executive + cash position. Approve PR/PO/PAY. Mobile-friendly.",
    "permissions": [
        # Executive & dashboards
        "executive.dashboard.read", "executive.drilldown.read", "executive.export",
        # Cash position (Phase 11B)
        "finance.cash.read",
        # Finance reads
        "finance.report.profit_loss", "finance.report.balance_sheet",
        "finance.report.cashflow", "finance.ap.read",
        "finance.journal_entry.read",
        # AI
        "ai.chat.use", "ai.exec_qa.use", "ai.forecast.read", "ai.anomaly.read",
        "search.global.use",
        # Approvals
        "procurement.pr.read", "procurement.pr.approve", "procurement.po.approve",
        "finance.payment.approve",
        # Anomaly feed
        "anomaly.feed.read",
        # Owner-specific
        "owner.digest.manage", "owner.cockpit.access",
        # Phase 11C++: Owner can manage system settings (Telegram token, etc.)
        "system.settings.read", "system.settings.manage",
    ],
    "is_system": True,
}


DEMO_CASH_ACCOUNTS = [
    # Group-level bank accounts
    {"code": "BANK-BCA-OPS", "name": "BCA Operasional", "type": "bank",
     "bank_name": "BCA", "bank_account_no": "7530-XXXX-12",
     "current_balance": 487_250_000, "opening_balance": 350_000_000,
     "linked_coa_code": "1110"},
    {"code": "BANK-MDR-PAY", "name": "Mandiri Payroll", "type": "bank",
     "bank_name": "Mandiri", "bank_account_no": "123-XXXX-456",
     "current_balance": 142_800_000, "opening_balance": 100_000_000,
     "linked_coa_code": "1111"},
    # Petty cash per outlet
    {"code": "PC-CFS", "name": "Petty Cash The Coffeeshop", "type": "petty_cash",
     "outlet_code": "CFS", "current_balance": 4_280_000, "opening_balance": 5_000_000,
     "linked_coa_code": "1102"},
    {"code": "PC-RST", "name": "Petty Cash The Restaurant", "type": "petty_cash",
     "outlet_code": "RST", "current_balance": 3_520_000, "opening_balance": 5_000_000,
     "linked_coa_code": "1102"},
    {"code": "PC-BST", "name": "Petty Cash The Bistro", "type": "petty_cash",
     "outlet_code": "BST", "current_balance": 4_905_000, "opening_balance": 5_000_000,
     "linked_coa_code": "1102"},
    {"code": "PC-LNG", "name": "Petty Cash The Lounge", "type": "petty_cash",
     "outlet_code": "LNG", "current_balance": 2_890_000, "opening_balance": 5_000_000,
     "linked_coa_code": "1102"},
    # E-Wallets
    {"code": "EW-OVO", "name": "OVO Merchant", "type": "ewallet",
     "current_balance": 28_540_000, "opening_balance": 0},
    {"code": "EW-GOPAY", "name": "GoPay Merchant", "type": "ewallet",
     "current_balance": 41_700_000, "opening_balance": 0},
    {"code": "EW-DANA", "name": "DANA Bisnis", "type": "ewallet",
     "current_balance": 12_300_000, "opening_balance": 0},
]


async def seed():
    await init_db()
    db = get_db()

    # 1) Owner role
    print("Seeding OWNER role…")
    existing = await db.roles.find_one({"code": "OWNER"})
    if existing:
        await db.roles.update_one(
            {"code": "OWNER"},
            {"$set": {
                "name": OWNER_ROLE["name"],
                "description": OWNER_ROLE["description"],
                "permissions": OWNER_ROLE["permissions"],
                "is_system": True,
                "updated_at": now(),
            }},
        )
        owner_role_id = existing["id"]
        print("  OWNER role updated.")
    else:
        rec = doc({
            "code": OWNER_ROLE["code"],
            "name": OWNER_ROLE["name"],
            "description": OWNER_ROLE["description"],
            "permissions": OWNER_ROLE["permissions"],
            "is_system": True,
        })
        await db.roles.insert_one(rec)
        owner_role_id = rec["id"]
        print("  OWNER role inserted.")

    # 2) Owner user
    print("Seeding owner@fnbgroup.id…")
    outlets = await db.outlets.find({"deleted_at": None}).to_list(50)
    brands = await db.brands.find({"deleted_at": None}).to_list(50)
    outlet_ids = [o["id"] for o in outlets]
    brand_ids = [b["id"] for b in brands]

    existing_owner = await db.users.find_one({"email": "owner@fnbgroup.id"})
    if existing_owner:
        await db.users.update_one(
            {"email": "owner@fnbgroup.id"},
            {"$set": {
                "role_ids": [owner_role_id],
                "outlet_ids": outlet_ids,
                "brand_ids": brand_ids,
                "default_portal": "owner",
                "status": "active",
                "updated_at": now(),
            }},
        )
        print("  Owner user updated.")
    else:
        await db.users.insert_one(doc({
            "email": "owner@fnbgroup.id",
            "password_hash": hash_password("Demo@2026"),
            "full_name": "Pak Hadi (Owner)",
            "phone": "+62-811-9999-0001",
            "status": "active",
            "role_ids": [owner_role_id],
            "outlet_ids": outlet_ids,
            "brand_ids": brand_ids,
            "default_portal": "owner",
            "failed_login_count": 0, "locked_until": None,
            "mfa_enabled": False,
        }))
        print("  Owner user inserted.")

    # 3) Cash accounts
    print("Seeding cash accounts…")
    outlet_code_map = {o.get("code"): o["id"] for o in outlets if o.get("code")}
    coa_rows = await db.chart_of_accounts.find({"deleted_at": None}).to_list(500)
    coa_code_map = {c.get("code"): c["id"] for c in coa_rows}

    n_inserted = 0
    n_updated = 0
    for spec in DEMO_CASH_ACCOUNTS:
        existing_acc = await db.cash_accounts.find_one(
            {"code": spec["code"], "deleted_at": None})
        outlet_id = outlet_code_map.get(spec.get("outlet_code"))
        coa_id = coa_code_map.get(spec.get("linked_coa_code"))
        payload = {
            "code": spec["code"],
            "name": spec["name"],
            "type": spec["type"],
            "outlet_id": outlet_id,
            "brand_id": None,
            "bank_name": spec.get("bank_name"),
            "bank_account_no": spec.get("bank_account_no"),
            "currency": "IDR",
            "current_balance": float(spec["current_balance"]),
            "opening_balance": float(spec["opening_balance"]),
            "linked_coa_id": coa_id,
            "last_updated_at": now(),
            "last_updated_by": "system-seed",
            "last_reconciled_at": None,
            "is_active": True,
            "updated_at": now(),
        }
        if existing_acc:
            await db.cash_accounts.update_one({"id": existing_acc["id"]}, {"$set": payload})
            n_updated += 1
        else:
            rec = doc(payload)
            await db.cash_accounts.insert_one(rec)
            # Initial snapshot
            await db.cash_balance_snapshots.insert_one({
                "id": str(uuid.uuid4()),
                "cash_account_id": rec["id"],
                "balance": rec["current_balance"],
                "delta": 0,
                "recorded_at": now(),
                "source": "opening",
                "uploaded_by": "system-seed",
                "attachment_id": None,
                "notes": "Phase 11 demo seed",
                "created_at": now(),
            })
            n_inserted += 1

    # 4) Add cash perms to Finance Manager + Executive (if not present)
    print("Granting cash perms…")
    for role_code, perms_to_add in [
        ("FINANCE_MANAGER", ["finance.cash.read", "finance.cash.update"]),
        ("FINANCE_STAFF", ["finance.cash.read", "finance.cash.update"]),
        ("EXECUTIVE", ["finance.cash.read"]),
        ("GM", ["finance.cash.read"]),
    ]:
        role = await db.roles.find_one({"code": role_code})
        if not role:
            continue
        existing_perms = set(role.get("permissions", []))
        new_perms = existing_perms | set(perms_to_add)
        if new_perms != existing_perms:
            await db.roles.update_one(
                {"id": role["id"]},
                {"$set": {"permissions": sorted(new_perms), "updated_at": now()}},
            )

    print()
    print("=" * 60)
    print("Phase 11 demo seed complete.")
    print("=" * 60)
    print(f"Cash accounts inserted: {n_inserted}")
    print(f"Cash accounts updated:  {n_updated}")
    print("Owner login: owner@fnbgroup.id / Demo@2026")
    print("=" * 60)
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
