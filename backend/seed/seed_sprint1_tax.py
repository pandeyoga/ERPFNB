"""Seed Sprint 1 — Tax Compliance Indonesia 2026.

Adds:
- 3 new GL accounts: Utang PPh 21 (2112), Utang PPh 23 (2113), Utang PPh 4(2) (2114)
- PPN-12 tax code (replaces / updates PPN-11)
- Default system settings for all tax toggles (PPN enabled @12%, PPh all disabled by default)
- GL mapping entries for the 3 Utang PPh accounts
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, "/app/backend")

from core.db import close_db, get_db, init_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed():
    await init_db()
    db = get_db()

    print("=" * 60)
    print("Seeding Sprint 1 — Tax Compliance Indonesia 2026")
    print("=" * 60)

    # ── 1. New GL Accounts ────────────────────────────────────────
    parent_2100 = await db.chart_of_accounts.find_one({"code": "2100", "deleted_at": None})
    parent_id = parent_2100["id"] if parent_2100 else None

    new_coa = [
        ("2112", "Utang PPh 21 (Karyawan)",       "liability", "Cr", True),
        ("2113", "Utang PPh 23 (Jasa/Royalti)",    "liability", "Cr", True),
        ("2114", "Utang PPh 4(2) (Sewa/Konstruksi)", "liability", "Cr", True),
    ]
    coa_ids: dict[str, str] = {}
    for code, name, acc_type, normal_balance, is_postable in new_coa:
        existing = await db.chart_of_accounts.find_one({"code": code, "deleted_at": None})
        if existing:
            coa_ids[code] = existing["id"]
            print(f"  COA {code} already exists — skipping")
            continue
        new_id = str(uuid.uuid4())
        await db.chart_of_accounts.insert_one({
            "id": new_id,
            "code": code,
            "name": name,
            "type": acc_type,
            "normal_balance": normal_balance,
            "is_postable": is_postable,
            "parent_id": parent_id,
            "description": "Auto-created Sprint 1 Tax Compliance",
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        })
        coa_ids[code] = new_id
        print(f"  Created COA {code}: {name}")

    # ── 2. PPN-12 Tax Code ───────────────────────────────────────
    # First check/update existing PPN code
    ppn_existing = await db.tax_codes.find_one({"code": {"$in": ["PPN-11", "PPN-12"]}})
    if ppn_existing and ppn_existing.get("code") == "PPN-11":
        # Update to PPN-12 rate, keep code as PPN-11 for backward compat but update label/rate
        await db.tax_codes.update_one(
            {"id": ppn_existing["id"]},
            {"$set": {"rate": 0.12, "name": "PPN 12%", "updated_at": _now()}},
        )
        print("  Updated PPN-11 → PPN 12% rate (code kept as PPN-11 for backward compat)")
    elif not ppn_existing:
        # Create fresh PPN-12 code
        output_vat_coa = await db.chart_of_accounts.find_one({"code": "2110", "deleted_at": None})
        input_vat_coa = await db.chart_of_accounts.find_one({"code": "1401", "deleted_at": None})
        await db.tax_codes.insert_one({
            "id": str(uuid.uuid4()),
            "code": "PPN-12",
            "name": "PPN 12%",
            "rate": 0.12,
            "type": "vat",
            "gl_account_payable_id": output_vat_coa["id"] if output_vat_coa else None,
            "description": "PPN 12% sesuai Perpu 2/2024 (efektif 2025)",
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        })
        print("  Created PPN-12 tax code")
    else:
        print("  PPN tax code already exists at 12% rate — skipping")

    # ── 3. System Settings Defaults ─────────────────────────────
    defaults = [
        # key, value, is_secret, label, description, category
        ("TAX_PPN_ENABLED", "true",  False, "PPN Aktif",          "Toggle PPN. True = aktif, False = tidak dikenakan PPN.",   "tax"),
        ("TAX_PPN_RATE",    "0.12",  False, "Tarif PPN",          "Tarif PPN desimal. Default 0.12 (12%) per Perpu 2/2024.",   "tax"),
        ("TAX_PPH21_ENABLED", "false", False, "PPh 21 Aktif",      "Toggle PPh 21 (withholding karyawan). Aktifkan jika payroll dikerjakan di sistem.", "tax"),
        ("TAX_PPH21_METHOD",  "gross",  False, "Metode PPh 21",    "gross = pajak ditanggung karyawan; gross_up = pajak ditanggung perusahaan.", "tax"),
        ("TAX_PPH23_ENABLED", "false", False, "PPh 23 Aktif",      "Toggle PPh 23 (withholding jasa vendor).",                 "tax"),
        ("TAX_PPH23_RATE",    "0.02",  False, "Tarif PPh 23 Default", "Tarif default PPh 23. Default 0.02 (2%) untuk jasa.",   "tax"),
        ("TAX_PPH42_ENABLED", "false", False, "PPh 4(2) Aktif",    "Toggle PPh Pasal 4 ayat 2 (sewa bangunan, konstruksi).",   "tax"),
        ("TAX_PPH42_RATE",    "0.10",  False, "Tarif PPh 4(2) Default", "Tarif default PPh 4(2). Default 0.10 (10%) untuk sewa.", "tax"),
    ]
    for key, value, is_secret, label, desc, cat in defaults:
        existing = await db.system_settings.find_one({"key": key})
        if not existing:
            await db.system_settings.insert_one({
                "id": str(uuid.uuid4()),
                "key": key,
                "value": value,
                "is_secret": is_secret,
                "category": cat,
                "label": label,
                "description": desc,
                "created_at": _now(),
                "updated_at": _now(),
            })
            print(f"  System setting {key} = {value}")
        else:
            print(f"  System setting {key} already exists — skipping")

    # ── 4. GL Mapping entries ─────────────────────────────────────
    # GL mapping stored in system_settings under key='gl_mapping', value=dict
    gl_setting = await db.system_settings.find_one({"key": "gl_mapping"})
    if gl_setting:
        current_map = gl_setting.get("value", {}) or {}
        if isinstance(current_map, str):
            import json
            current_map = json.loads(current_map) if current_map else {}
        updates_map: dict = {}
        if coa_ids.get("2112") and "withholding_pph21" not in current_map:
            updates_map["withholding_pph21"] = coa_ids["2112"]
        if coa_ids.get("2113") and "withholding_pph23" not in current_map:
            updates_map["withholding_pph23"] = coa_ids["2113"]
        if coa_ids.get("2114") and "withholding_pph42" not in current_map:
            updates_map["withholding_pph42"] = coa_ids["2114"]
        if updates_map:
            current_map.update(updates_map)
            await db.system_settings.update_one(
                {"key": "gl_mapping"},
                {"$set": {"value": current_map, "updated_at": _now()}},
            )
            print(f"  Updated GL mapping with PPh accounts: {list(updates_map.keys())}")
        else:
            print("  GL mapping already has PPh accounts — skipping")
    else:
        print("  Warning: No GL mapping found — PPh journal integration may not resolve COA")

    await close_db()
    print("=" * 60)
    print("Sprint 1 Tax seed complete.")
    print("  COA: Utang PPh 21 (2112), PPh 23 (2113), PPh 4(2) (2114)")
    print("  Tax code: PPN updated to 12%")
    print("  System settings: 8 keys seeded")
    print("  PPN=ON@12%, PPh21/23/42=OFF (activate via Admin→Tax)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
