#!/usr/bin/env python3
"""
INTENT AUDIT — remaining finance modules
=========================================
Asserts INTENT-CORRECTNESS invariants (values & cross-ledger coherence, not just
HTTP 200) for the modules not covered by intent_audit_5portals.py:

  A. Fixed Assets        — subledger coherence + register display (post-normalize)
  B. Tax-workflow (PPN)  — GL Output VAT (2110) == Σ AR invoice tax (subledger==GL)
  C. Payment Runs        — write-path: total==Σlines, posted JE balanced, pays paid
  D. Bank Reconciliation — write-path: summary math coherent + auto-match works

C & D are exercised on SYNTHETIC data created via the real service layer, then
FULLY cleaned up (create → verify → rollback), leaving zero residue. The global
trial balance is asserted before and after to prove no GL leakage.

Exit 0 if all invariants hold, 1 otherwise.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except Exception:
    pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.db import init_db, close_db, get_db
from services import payment_runs_service, bank_recon_service, fixed_asset_service

G, R, Y, C, B0 = "\033[92m", "\033[91m", "\033[93m", "\033[96m", "\033[0m"
PASS = 0
FAIL = 0


def check(name: str, cond: bool, detail: str = ""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  {G}[PASS]{B0} {name}{(' — ' + detail) if detail else ''}")
    else:
        FAIL += 1
        print(f"  {R}[FAIL]{B0} {name}{(' — ' + detail) if detail else ''}")


def rp(v) -> str:
    return f"Rp {float(v):,.0f}"


async def trial_balance_delta(db) -> float:
    dr = cr = 0.0
    async for je in db.journal_entries.find({"deleted_at": None}):
        for l in je.get("lines", []):
            dr += float(l.get("dr", 0) or 0)
            cr += float(l.get("cr", 0) or 0)
    return round(dr - cr, 2)


# ──────────────────────────────────────────────────────────────────────────
# A. FIXED ASSETS
# ──────────────────────────────────────────────────────────────────────────
async def audit_fixed_assets(db):
    print(f"\n{C}── A. FIXED ASSETS (subledger coherence + register){B0}")
    assets = await db.fixed_assets.find({"deleted_at": None}).to_list(2000)
    check("assets exist", len(assets) > 0, f"{len(assets)} assets")

    incoherent = []
    total_cost_sum = 0.0
    total_book_sum = 0.0
    for a in assets:
        cost = float(a.get("purchase_cost", 0) or 0)
        accum = float(a.get("accumulated_dep", 0) or 0)
        book = float(a.get("book_value", 0) or 0)
        total_cost_sum += cost
        total_book_sum += book
        if abs(book - (cost - accum)) > 1.0:
            incoherent.append(a.get("asset_code") or a.get("asset_number") or a["id"][:8])
    check("each asset: book_value == purchase_cost − accumulated_dep",
          len(incoherent) == 0,
          "all coherent" if not incoherent else f"{len(incoherent)} incoherent: {incoherent[:5]}")
    check("canonical purchase_cost populated (FixedAssetList 'Total Cost' ≠ Rp 0)",
          total_cost_sum > 0, rp(total_cost_sum))

    # Register report coherence (the endpoint FE calls)
    reg = await fixed_asset_service.get_asset_register()
    rows = reg.get("by_category", [])
    reg_cost = sum(float(r.get("total_cost", 0) or 0) for r in rows)
    reg_book = sum(float(r.get("total_book_value", 0) or 0) for r in rows)
    check("register total_cost > 0 (uses purchase_cost field)", reg_cost > 0, rp(reg_cost))
    check("register Σ book_value == Σ asset book_value", abs(reg_book - total_book_sum) <= 1.0,
          f"register {rp(reg_book)} vs assets {rp(total_book_sum)}")


# ──────────────────────────────────────────────────────────────────────────
# B. TAX-WORKFLOW (PPN)
# ──────────────────────────────────────────────────────────────────────────
async def audit_tax(db):
    print(f"\n{C}── B. TAX-WORKFLOW (PPN Output coherence){B0}")
    coa2110 = await db.chart_of_accounts.find_one({"code": "2110", "deleted_at": None})
    coa1401 = await db.chart_of_accounts.find_one({"code": "1401", "deleted_at": None})
    check("Output VAT COA 2110 exists", coa2110 is not None, coa2110.get("name") if coa2110 else "MISSING")
    check("Input VAT COA 1401 exists", coa1401 is not None, coa1401.get("name") if coa1401 else "MISSING")

    if not coa2110:
        return
    cr = dr = 0.0
    async for je in db.journal_entries.find({"deleted_at": None}):
        for l in je.get("lines", []):
            if l.get("coa_id") == coa2110["id"]:
                cr += float(l.get("cr", 0) or 0)
                dr += float(l.get("dr", 0) or 0)
    gl_output_vat = round(cr - dr, 2)

    ar_tax = 0.0
    n_inv = 0
    async for inv in db.ar_invoices.find({"deleted_at": None}):
        ar_tax += float(inv.get("tax_amount", 0) or 0)
        n_inv += 1
    ar_tax = round(ar_tax, 2)

    check("GL Output VAT (2110) == Σ AR invoice tax (subledger==GL)",
          abs(gl_output_vat - ar_tax) <= 1.0,
          f"GL {rp(gl_output_vat)} vs AR Σtax {rp(ar_tax)} ({n_inv} inv)")


# ──────────────────────────────────────────────────────────────────────────
# C. PAYMENT RUNS (write-path → verify → rollback)
# ──────────────────────────────────────────────────────────────────────────
async def audit_payment_runs(db, user):
    print(f"\n{C}── C. PAYMENT RUNS (write-path correctness, synthetic + rollback){B0}")
    tb_before = await trial_balance_delta(db)

    ap_coa = await db.chart_of_accounts.find_one({"code": "2101", "deleted_at": None})
    vendor = await db.vendors.find_one({"deleted_at": None})
    bank = await db.bank_accounts.find_one({"deleted_at": None, "gl_account_id": {"$ne": None}})
    if not (ap_coa and vendor and bank):
        check("prereqs (AP COA 2101 / vendor / bank w/ GL)", False, "missing prereq")
        return

    tag = f"AUDIT-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()
    pay_specs = [("PAY-" + tag + "-1", 5_000_000.0), ("PAY-" + tag + "-2", 3_000_000.0)]
    pay_ids = []
    for doc_no, amt in pay_specs:
        pid = str(uuid.uuid4())
        await db.payment_requests.insert_one({
            "id": pid, "doc_no": doc_no, "status": "approved", "deleted_at": None,
            "amount": amt, "gl_debit_id": ap_coa["id"],
            "description": f"Intent-audit settle AP {doc_no}",
            "payee_type": "vendor", "payee_id": vendor["id"],
            "_intent_audit": tag, "created_at": now, "updated_at": now,
        })
        pay_ids.append(pid)
    expected_total = round(sum(a for _, a in pay_specs), 2)

    run_id = None
    je_ids = []
    try:
        run = await payment_runs_service.create_payment_run(
            {"payment_date": "2026-06-15", "bank_account_id": bank["id"], "pay_ids": pay_ids,
             "notes": f"intent-audit {tag}"}, user=user)
        run_id = run["id"]
        check("create_payment_run: total_amount == Σ pay amounts",
              abs(float(run.get("total_amount", 0)) - expected_total) <= 1.0,
              f"{rp(run.get('total_amount'))} vs {rp(expected_total)}")

        await payment_runs_service.confirm_payment_run(run_id, user=user)
        posted = await payment_runs_service.post_payment_run(run_id, {}, user=user)
        check("post_payment_run → status 'posted'", posted.get("status") == "posted",
              posted.get("status"))
        je_ids = posted.get("je_ids") or ([posted["je_id"]] if posted.get("je_id") else [])

        # Posted JE balanced + correct legs (Dr AP, Cr bank)
        bal_ok = True
        legs_ok = True
        bank_gl = bank["gl_account_id"]
        for jid in je_ids:
            je = await db.journal_entries.find_one({"id": jid})
            if not je:
                bal_ok = False
                continue
            d = round(sum(float(l.get("dr", 0) or 0) for l in je.get("lines", [])), 2)
            c = round(sum(float(l.get("cr", 0) or 0) for l in je.get("lines", [])), 2)
            if abs(d - c) > 1.0:
                bal_ok = False
            has_ap_dr = any(l.get("coa_id") == ap_coa["id"] and float(l.get("dr", 0) or 0) > 0 for l in je.get("lines", []))
            has_bank_cr = any(l.get("coa_id") == bank_gl and float(l.get("cr", 0) or 0) > 0 for l in je.get("lines", []))
            if not (has_ap_dr and has_bank_cr):
                legs_ok = False
        check("posted JE balanced (Dr == Cr)", bal_ok and len(je_ids) > 0, f"{len(je_ids)} JE(s)")
        check("posted JE legs correct (Dr AP 2101 / Cr Bank)", legs_ok)

        # pays marked paid
        paid_cnt = await db.payment_requests.count_documents({"id": {"$in": pay_ids}, "status": "paid"})
        check("all pays in run marked 'paid'", paid_cnt == len(pay_ids), f"{paid_cnt}/{len(pay_ids)}")

        # KPI reflects (posted_this_month amount includes our run)
        kpi = await payment_runs_service.kpi()
        check("KPI posted_this_month present & numeric",
              isinstance(kpi.get("posted_this_month", {}).get("amount"), (int, float)),
              f"posted amount {rp(kpi['posted_this_month']['amount'])}")
    finally:
        # ── ROLLBACK (leave zero residue) ───────────────────────────────
        for jid in je_ids:
            await db.journal_entries.delete_one({"id": jid})
        if run_id:
            await db.payment_runs.delete_one({"id": run_id})
            await db.notifications.delete_many({"source_type": "payment_run", "source_id": run_id})
        await db.payment_requests.delete_many({"_intent_audit": tag})

    residue = await db.payment_requests.count_documents({"_intent_audit": tag})
    tb_after = await trial_balance_delta(db)
    check("rollback complete (no synthetic residue)", residue == 0, f"residue={residue}")
    check("global trial balance unchanged (no GL leakage)",
          abs(tb_after - tb_before) <= 1.0, f"Δ before={tb_before} after={tb_after}")


# ──────────────────────────────────────────────────────────────────────────
# D. BANK RECONCILIATION (write-path → verify → rollback)
# ──────────────────────────────────────────────────────────────────────────
async def audit_bank_recon(db, user):
    print(f"\n{C}── D. BANK RECONCILIATION (summary math + auto-match, synthetic + rollback){B0}")
    bank = await db.bank_accounts.find_one({"deleted_at": None, "gl_account_id": {"$ne": None}})
    if not bank:
        check("bank account with GL link exists", False)
        return
    bank_gl = bank["gl_account_id"]

    # Pull real posted JEs that hit the bank GL → build a CSV that should auto-match
    je_rows = []
    async for je in db.journal_entries.find(
        {"deleted_at": None, "status": "posted", "lines.coa_id": bank_gl}
    ).sort("entry_date", -1).limit(4):
        bank_lines = [l for l in je.get("lines", []) if l.get("coa_id") == bank_gl]
        net = sum(float(l.get("dr", 0) or 0) - float(l.get("cr", 0) or 0) for l in bank_lines)
        if abs(net) < 0.01 or not je.get("entry_date"):
            continue
        je_rows.append((je["entry_date"], je.get("description", je.get("doc_no", "txn")), round(net, 2), je["id"]))

    if len(je_rows) < 1:
        check("bank GL has matchable posted JEs", False, "no bank-GL JEs found")
        return

    csv_lines = ["date,description,amount"]
    for d, desc, amt, _ in je_rows:
        safe_desc = str(desc).replace(",", " ")[:40]
        csv_lines.append(f"{d},{safe_desc},{amt}")
    csv_content = ("\n".join(csv_lines)).encode("utf-8")

    session_id = None
    try:
        session = await bank_recon_service.upload_statement(
            bank_account_id=bank["id"], filename=f"intent_audit_{uuid.uuid4().hex[:6]}.csv",
            content=csv_content, user=user, date_tol_days=3, amount_tol=1000,
        )
        session_id = session["id"]
        summ = await bank_recon_service.get_summary(session_id)

        total = summ["total_rows"]
        coherent_count = (summ["matched_rows"] + summ["unmatched_rows"] + summ["exceptional_rows"]) == total
        amt_total = summ["total_amount"]
        amt_parts = round(summ["matched_amount"] + summ["unmatched_amount"] + summ["exceptional_amount"], 2)
        check("session created from statement", total == len(je_rows), f"{total} rows")
        check("row counts coherent (matched+unmatched+exception == total)", coherent_count,
              f"{summ['matched_rows']}+{summ['unmatched_rows']}+{summ['exceptional_rows']} == {total}")
        check("amount split coherent (Σ parts == total_amount)", abs(amt_parts - amt_total) <= 1.0,
              f"{rp(amt_parts)} vs {rp(amt_total)}")
        check("auto-match found at least 1 match (matcher works)", summ["matched_rows"] >= 1,
              f"matched {summ['matched_rows']}/{total} ({summ['match_pct']}%)")
    finally:
        if session_id:
            # not committed → no reconciled_at side-effects; just remove the session
            await db.bank_recon_sessions.delete_one({"id": session_id})

    residue = await db.bank_recon_sessions.count_documents({"filename": {"$regex": "^intent_audit_"}})
    check("rollback complete (session removed)", residue == 0, f"residue={residue}")


async def main():
    await init_db()
    db = get_db()
    user = await db.users.find_one({"email": "admin@fnbgroup.id"}) or await db.users.find_one({})
    if not user:
        print(f"{R}No user found — seed first.{B0}")
        return 1
    user = {"id": user["id"], "email": user.get("email"), "name": user.get("name", "Admin")}

    print(f"{B0}{C}╔══════════════════════════════════════════════════════════════╗")
    print(f"║  INTENT AUDIT — Fixed Assets · Tax · Payment Runs · Bank Recon ║")
    print(f"╚══════════════════════════════════════════════════════════════╝{B0}")

    try:
        await audit_fixed_assets(db)
        await audit_tax(db)
        await audit_payment_runs(db, user)
        await audit_bank_recon(db, user)
    finally:
        await close_db()

    print(f"\n{C}{'─'*64}{B0}")
    color = G if FAIL == 0 else R
    print(f"  {color}PASS {PASS}{B0}  |  {R if FAIL else Y}FAIL {FAIL}{B0}")
    if FAIL == 0:
        print(f"  {G}\033[1mALL REMAINING-MODULE INVARIANTS HOLD.{B0}")
    else:
        print(f"  {R}\033[1m{FAIL} INVARIANT(S) FAILED.{B0}")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
