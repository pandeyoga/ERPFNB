"""Tax settlement JE generation and preview.

Canonical schema (post-refactor):
  - VAT accounts resolved via `gl_mapping` SSOT (input_vat / output_vat / vat_payable),
    NOT hardcoded COA codes.
  - PPN Keluaran (output VAT) = sum(daily_sales.tax_amount) for the period.
  - PPN Masukan (input VAT)   = sum(ap_ledgers.ppn_amount) for the period — AP ledger does
    not yet track per-invoice PPN, so this is 0 until AP captures tax (documented design gap).
  - JE posted through `_post_journal` (period-lock aware, idempotent, dr/cr canonical lines).
"""
from __future__ import annotations

from typing import Optional

from core.db import get_db
from services._period._common import logger


# ── helpers ────────────────────────────────────────────────────────────────────

async def _ppn_out_for_period(db, period: str) -> float:
    """Output VAT collected = sum of daily_sales.tax_amount in the period (by sales_date)."""
    rows = await db.daily_sales.aggregate([
        {"$match": {"deleted_at": None, "sales_date": {"$regex": f"^{period}"},
                    "tax_amount": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "total": {"$sum": "$tax_amount"}}},
    ]).to_list(1)
    return float(rows[0]["total"]) if rows else 0.0


async def _ppn_in_for_period(db, period: str) -> float:
    """Input VAT = sum of ap_ledgers.ppn_amount in the period (by invoice_date).
    AP ledger may not carry ppn_amount yet → returns 0 (design gap)."""
    rows = await db.ap_ledgers.aggregate([
        {"$match": {"deleted_at": None, "invoice_date": {"$regex": f"^{period}"},
                    "ppn_amount": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "total": {"$sum": "$ppn_amount"}}},
    ]).to_list(1)
    return float(rows[0]["total"]) if rows else 0.0


async def _resolve_vat_accounts() -> Optional[dict]:
    """Resolve VAT coa_ids via gl_mapping SSOT. Returns None if any mapping missing."""
    from services import gl_mapping
    try:
        return {
            "input_vat": await gl_mapping.resolve("input_vat"),
            "output_vat": await gl_mapping.resolve("output_vat"),
            "vat_payable": await gl_mapping.resolve("vat_payable"),
        }
    except Exception as e:
        logger.warning(f"VAT GL mapping incomplete: {e}")
        return None


# ── public API ─────────────────────────────────────────────────────────────────

async def generate_tax_settlement_je(period: str, *, user: dict) -> Optional[dict]:
    """Auto-generate tax settlement JE for the period. Idempotent (by reference_key)."""
    from services._journal._common import _post_journal
    from core.db import serialize
    db = get_db()
    reference_key = f"tax_settlement_{period}"

    existing = await db.journal_entries.find_one({"reference_key": reference_key, "deleted_at": None})
    if existing:
        logger.info(f"Tax settlement JE already exists for period {period}: {existing.get('doc_no')}")
        return serialize(existing)

    try:
        from services import tax_service
        config = await tax_service.get_tax_config()
        if not config.get("ppn", {}).get("enabled"):
            logger.info(f"PPN not enabled, skipping tax settlement for period {period}")
            return None
    except Exception as e:
        logger.error(f"Failed to get tax config: {e}")
        return None

    ppn_out = await _ppn_out_for_period(db, period)
    ppn_in = await _ppn_in_for_period(db, period)
    ppn_payable = ppn_out - ppn_in
    if abs(ppn_payable) < 1:
        logger.info(f"PPN payable too small for period {period}: Rp {ppn_payable:.2f}, skipping")
        return None

    acc = await _resolve_vat_accounts()
    if not acc:
        logger.error(f"Tax settlement skipped for {period}: VAT GL mapping incomplete")
        return None

    # Dr Output VAT (clear liability collected), Cr Input VAT (clear asset),
    # net to VAT Payable (Cr if owed, Dr if overpaid).
    lines = []
    if ppn_out > 0:
        lines.append({"coa_id": acc["output_vat"], "dr": ppn_out, "cr": 0,
                      "memo": f"Settlement PPN Keluaran {period}"})
    if ppn_in > 0:
        lines.append({"coa_id": acc["input_vat"], "dr": 0, "cr": ppn_in,
                      "memo": f"Settlement PPN Masukan {period}"})
    if ppn_payable > 0:
        lines.append({"coa_id": acc["vat_payable"], "dr": 0, "cr": ppn_payable,
                      "memo": f"PPN yang harus dibayar {period}"})
    elif ppn_payable < 0:
        lines.append({"coa_id": acc["vat_payable"], "dr": abs(ppn_payable), "cr": 0,
                      "memo": f"Lebih bayar PPN {period}"})

    je = await _post_journal(
        entry_date=f"{period}-28",
        description=f"Tax Settlement PPN periode {period}",
        source_type="tax_settlement",
        source_id=period,
        lines=lines,
        user_id=user["id"],
    )
    # Tag with reference_key so the period-close lookup can find it.
    await db.journal_entries.update_one({"id": je["id"]}, {"$set": {"reference_key": reference_key}})
    je["reference_key"] = reference_key
    logger.info(f"Tax settlement JE {je.get('doc_no')} created for {period}: "
                f"Out=Rp{ppn_out:.0f} In=Rp{ppn_in:.0f} Payable=Rp{ppn_payable:.0f}")
    return je


async def preview_tax_settlement(period: str) -> dict:
    """Preview tax settlement without creating JE."""
    db = get_db()
    reference_key = f"tax_settlement_{period}"

    existing = await db.journal_entries.find_one({"reference_key": reference_key, "deleted_at": None})
    if existing:
        return {"already_exists": True, "doc_no": existing.get("doc_no"),
                "status": existing.get("status"), "ppn_out": None, "ppn_in": None, "ppn_payable": None}

    try:
        from services import tax_service
        config = await tax_service.get_tax_config()
        ppn_config = config.get("ppn", {})
        ppn_enabled = ppn_config.get("enabled", False)
        ppn_rate = ppn_config.get("rate", 0.12)
    except Exception:
        ppn_enabled = False
        ppn_rate = 0.12

    if not ppn_enabled:
        return {"already_exists": False, "ppn_enabled": False, "ppn_out": 0, "ppn_in": 0,
                "ppn_payable": 0, "will_create": False, "reason": "PPN tidak aktif"}

    ppn_out = await _ppn_out_for_period(db, period)
    ppn_in = await _ppn_in_for_period(db, period)
    ppn_payable = ppn_out - ppn_in

    coa_complete = await _resolve_vat_accounts() is not None
    will_create = abs(ppn_payable) >= 1 and coa_complete

    return {
        "already_exists": False,
        "ppn_enabled": True,
        "ppn_out": ppn_out,
        "ppn_in": ppn_in,
        "ppn_payable": ppn_payable,
        "ppn_rate": ppn_rate,
        "will_create": will_create,
        "coa_complete": coa_complete,
        "reason": (
            "JE settlement akan dibuat otomatis saat period di-close" if will_create
            else ("GL mapping VAT (input_vat/output_vat/vat_payable) belum lengkap" if not coa_complete
                  else "Tidak ada PPN to settle (nilai terlalu kecil)")
        ),
    }
