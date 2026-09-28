"""Audit Fase 2 — historical data correction (run BEFORE go-live, reviewed by Finance).

Usage:
  cd /app/backend && python -m scripts.audit_data_correction            # dry-run report
  cd /app/backend && python -m scripts.audit_data_correction --apply    # post safe fixes (AR receipts)

Only AR receipts are auto-fixed (missing JE → posted with receipt id as source_id).
Everything else is REPORTED for a Finance-reviewed manual correcting journal.
"""
import asyncio
import json
import sys

from core.db import get_db, init_db


async def main(apply: bool) -> dict:
    await init_db()
    db = get_db()
    report: dict = {}

    # 1) AR receipts without a JE (P0-05: 2nd+ partial receipts were skipped)
    missing = await db.ar_receipts.find({"$or": [{"je_id": None}, {"je_id": {"$exists": False}}]}).to_list(None)
    report["ar_receipts_without_je"] = [{"id": r["id"], "invoice_id": r.get("invoice_id"), "amount": r.get("amount")} for r in missing]
    if apply and missing:
        from services import gl_mapping, journal_service
        from services._ar.journal import resolve_ar_accounts
        ar_id, _, _ = await resolve_ar_accounts()
        bank_default = await gl_mapping.resolve("bank_default")
        for r in missing:
            inv = await db.ar_invoices.find_one({"id": r.get("invoice_id")}) or {}
            ba = await db.bank_accounts.find_one({"id": r.get("bank_account_id")}) if r.get("bank_account_id") else None
            bank = (ba or {}).get("gl_account_id") or bank_default
            je = await journal_service._post_journal(
                entry_date=r.get("receipt_date"), description=f"[KOREKSI] Receipt {inv.get('invoice_no', '')}",
                source_type="ar_receipt", source_id=r["id"],
                lines=[{"coa_id": bank, "dr": float(r["amount"]), "cr": 0, "memo": "Koreksi audit P0-05"},
                       {"coa_id": ar_id, "dr": 0, "cr": float(r["amount"]), "memo": "Koreksi audit P0-05"}],
                user_id="system-audit-correction")
            await db.ar_receipts.update_one({"id": r["id"]}, {"$set": {"je_id": je["id"]}})

    # 2) Fixed assets: accumulated depreciation vs depreciation JEs (P0-06)
    fa_rows = []
    async for a in db.fixed_assets.find({"deleted_at": None}):
        je_total = 0.0
        async for je in db.journal_entries.find({"source_type": "fixed_asset_dep", "deleted_at": None,
                                                 "source_id": {"$regex": f"^{a['id']}"}}):
            je_total += sum(float(ln.get("dr", 0) or 0) for ln in je.get("lines", []))
        acc = float(a.get("accumulated_depreciation", 0) or 0)
        if abs(acc - je_total) > 1:
            fa_rows.append({"asset_id": a["id"], "code": a.get("code"), "accumulated": acc, "journaled": round(je_total, 2),
                            "gap": round(acc - je_total, 2)})
    report["fixed_asset_depreciation_gaps"] = fa_rows

    # 3) Posted payrolls under the old logic (P0-01/02): SC/incentive double-expensed, BPJS missing
    pay_rows = []
    async for p in db.payroll_cycles.find({"status": "posted", "deleted_at": None}):
        je = await db.journal_entries.find_one({"source_type": "payroll", "source_id": p["id"], "deleted_at": None})
        variable = sum(float(e.get("variable_pay", 0) or 0) for e in p.get("employees", []))
        has_bpjs = bool(je and any("BPJS" in (ln.get("memo") or "") for ln in je.get("lines", [])))
        if je and (not has_bpjs):
            pay_rows.append({"payroll_id": p["id"], "period": p.get("period"), "je_id": je["id"],
                             "variable_pay_double_expensed": round(variable, 2),
                             "bpjs_employer_missing": float(p.get("total_bpjs_employer", 0) or 0),
                             "bpjs_employee_missing": float(p.get("total_bpjs_employee", 0) or 0)})
    report["payrolls_posted_with_old_logic"] = pay_rows

    # 4) Petty cash replenish/adjustment posted without JE (FIN-05)
    pcs = await db.petty_cash_transactions.find({"type": {"$in": ["replenish", "adjustment"]}, "status": "posted",
                                                 "journal_entry_id": None, "deleted_at": None}).to_list(None)
    report["petty_cash_without_je"] = [{"id": t["id"], "outlet_id": t["outlet_id"], "type": t["type"], "amount": t["amount"]} for t in pcs]

    # 5) Duplicate active payrolls per period/outlet (P0-03)
    dups = await db.payroll_cycles.aggregate([
        {"$match": {"deleted_at": None, "status": {"$in": ["draft", "approved", "posted"]}}},
        {"$group": {"_id": {"p": "$period", "o": "$outlet_id"}, "n": {"$sum": 1}, "ids": {"$push": "$id"}}},
        {"$match": {"n": {"$gt": 1}}},
    ]).to_list(None)
    report["duplicate_payrolls"] = [{"period": d["_id"]["p"], "outlet_id": d["_id"]["o"], "ids": d["ids"]} for d in dups]

    report["summary"] = {k: len(v) for k, v in report.items() if isinstance(v, list)}
    report["applied"] = apply
    return report


if __name__ == "__main__":
    print(json.dumps(asyncio.run(main("--apply" in sys.argv)), indent=2, default=str))
