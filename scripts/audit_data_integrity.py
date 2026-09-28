#!/usr/bin/env python3
"""Forensic data-integrity audit against MongoDB (read-only)."""
import asyncio
import re as _re
import sys
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient

# Read the REAL DB target from backend/.env (never hardcode — the previous
# hardcoded 'aurora_fnb'/'localhost' audited an empty wrong DB and falsely
# reported "no issues").
_env = open("/app/backend/.env").read()
MONGO = _re.search(r"MONGO_URL=(.*)", _env).group(1).strip().strip('"')
DB_NAME = _re.search(r"DB_NAME=(.*)", _env).group(1).strip().strip('"')


async def main():
    db = AsyncIOMotorClient(MONGO)[DB_NAME]
    findings = []
    critical = []  # gate-blocking issues (GL unbalanced, doc-no collision risk)

    # ---- 0. List all collections + counts ----
    cols = await db.list_collection_names()
    print(f"=== COLLECTIONS ({len(cols)}) ===")
    counts = {}
    for c in sorted(cols):
        n = await db[c].count_documents({})
        counts[c] = n
    # print non-empty interesting ones
    for c in sorted(counts):
        if counts[c] > 0:
            print(f"  {c:32} {counts[c]}")

    # ---- 1. Journal balance integrity (debit==credit) ----
    print("\n=== 1. JOURNAL ENTRY BALANCE (debit==credit) ===")
    je = db.journal_entries
    total_je = await je.count_documents({})
    unbalanced = []
    grand_dr = grand_cr = 0.0
    async for entry in je.find({}):
        if entry.get("deleted_at"):
            continue
        lines = entry.get("lines") or []
        # Canonical JE line fields are `dr`/`cr` (fallback to debit/credit for legacy docs)
        dr = sum(float(l.get("dr", l.get("debit", 0)) or 0) for l in lines)
        cr = sum(float(l.get("cr", l.get("credit", 0)) or 0) for l in lines)
        grand_dr += dr
        grand_cr += cr
        if abs(dr - cr) > 0.01:
            unbalanced.append((entry.get("entry_no") or entry.get("id"), dr, cr, entry.get("status")))
    print(f"  Total JE: {total_je}")
    print(f"  Grand total Dr: {grand_dr:,.2f}  Cr: {grand_cr:,.2f}  diff: {grand_dr-grand_cr:,.2f}")
    if unbalanced:
        findings.append(f"{len(unbalanced)} unbalanced journal entries")
        critical.append(f"{len(unbalanced)} unbalanced journal entries (GL integrity broken)")
        print(f"  ❌ UNBALANCED ENTRIES: {len(unbalanced)}")
        for n, dr, cr, st in unbalanced[:10]:
            print(f"     {n}: Dr={dr:,.0f} Cr={cr:,.0f} status={st}")
    else:
        print("  ✅ All journal entries balanced")

    # ---- 2. number_series SSOT sync ----
    print("\n=== 2. NUMBER_SERIES SSOT SYNC ===")
    series = {s["code"]: s async for s in db.number_series.find({})}
    # Map series code -> (collection, field)
    checks = [
        ("PR", "purchase_requests", "pr_no"),
        ("PO", "purchase_orders", "po_no"),
        ("GR", "goods_receipts", "gr_no"),
        ("PAY", "payment_requests", "pay_no"),
    ]
    import re
    for code, coll, field in checks:
        s = series.get(code)
        if not s:
            print(f"  {code}: no series doc (skip)")
            continue
        cur = s.get("current_value", s.get("current", 0))
        # find max numeric suffix in docs
        maxnum = 0
        async for d in db[coll].find({}, {field: 1, "doc_no": 1, "number": 1}):
            val = d.get(field) or d.get("doc_no") or d.get("number") or ""
            # Skip seed/test docs that use a separate namespace (e.g. PO-DEMO-xxx,
            # GR-DEMO-xxx). They never collide with generated {PREFIX}-{YYMM}-{0000}.
            if "DEMO" in str(val).upper() or "TEST" in str(val).upper():
                continue
            m = re.findall(r"(\d+)", str(val))
            if m:
                maxnum = max(maxnum, int(m[-1]))
        status = "✅" if cur >= maxnum else "❌ COUNTER BEHIND"
        if cur < maxnum:
            findings.append(f"number_series {code} counter={cur} < max doc {maxnum} (collision risk RC-5)")
            critical.append(f"number_series {code} counter behind max doc (doc-no collision risk)")
        print(f"  {code}: counter={cur}  max_doc={maxnum}  {status}")

    # ---- 3. Orphan linkage checks ----
    print("\n=== 3. ORPHAN LINKAGE ===")
    # GR without po_id
    gr_no_po = await db.goods_receipts.count_documents({"$or": [{"po_id": None}, {"po_id": {"$exists": False}}, {"po_id": ""}]})
    print(f"  goods_receipts without po_id: {gr_no_po}")
    if gr_no_po:
        findings.append(f"{gr_no_po} GR without po_id")
    # stock movements without outlet_id (real collection is inventory_movements)
    sm_no_outlet = await db.inventory_movements.count_documents({"$or": [{"outlet_id": None}, {"outlet_id": {"$exists": False}}, {"outlet_id": ""}]})
    print(f"  inventory_movements without outlet_id: {sm_no_outlet}")
    if sm_no_outlet:
        findings.append(f"{sm_no_outlet} inventory_movements without outlet_id")

    # ---- 4. Period status distribution ----
    print("\n=== 4. PERIODS ===")
    period_status = defaultdict(int)
    async for p in db.accounting_periods.find({}):
        period_status[p.get("status", "?")] += 1
    print(f"  status distribution: {dict(period_status)}")

    # ---- 5. Anomaly events sanity ----
    print("\n=== 5. ANOMALY EVENTS ===")
    ae_total = await db.anomaly_events.count_documents({})
    ae_open = await db.anomaly_events.count_documents({"status": {"$in": ["new", "open", "acknowledged", "investigating"]}})
    print(f"  total: {ae_total}  open/active: {ae_open}")

    # ---- summary ----
    print("\n" + "=" * 50)
    if findings:
        print(f"⚠️  {len(findings)} INTEGRITY FINDINGS:")
        for f in findings:
            print(f"   - {f}")
    else:
        print("✅ NO DATA-INTEGRITY ISSUES FOUND")
    return findings, critical


if __name__ == "__main__":
    _findings, _critical = asyncio.run(main())
    if "--strict" in sys.argv and _critical:
        print(f"\n❌ STRICT: {len(_critical)} temuan KRITIS (GL/doc-no) — GATE GAGAL.")
        for _c in _critical:
            print(f"   - {_c}")
        sys.exit(1)
    sys.exit(0)
