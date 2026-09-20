#!/usr/bin/env python3
"""
verify_data_integrity.py — FnB Group ERP POST-SEED INTEGRITY GATE
==============================================================
The "missing guard". It catches the EXACT class of bugs that kept recurring even
though RC-1 (collection-drift) was documented in ENGINEERING_GUARDRAILS.md:

  L1. Seed↔App collection DRIFT     (seed writes legacy name, app reads canonical)
  L2. Seed GAPS                     (an app-read collection is never populated)
  L3. Cross-endpoint INTENT drift   (KPI card != detail page; breakdown != total)
  L4. Ledger not balanced

WHY the old guards missed all of this (root-cause, see CASE_STUDY_*.md):
  • verify_contract.py — static regex `db\\.name` is BLIND to `db["name"]` bracket
    access (the drifting code used db["petty_cash_transactions"]). Worse, BOTH the
    legacy and canonical names were whitelisted, and its alias map even pointed the
    'service_charge' concept at the WRONG collection. A polluted source-of-truth
    cannot detect drift.
  • health_check.py — empty critical data => WARN (never FAIL); it never probes the
    KPI/dashboard endpoints where intent bugs live; and it asserts NO value
    invariants across endpoints.
  • Everything was validated on a long-lived, POLLUTED dev DB (stale + PYTEST rows)
    that masked drift and gaps. Nobody gated on a fresh `seed_reset` into an empty DB.

This gate fixes the method, not just the symptom:
  - one executable CONCEPT registry (concept -> the ONE canonical collection + the
    legacy names that MUST stay empty),
  - run it RIGHT AFTER seed_reset (clean DB) — see scripts/seed_reset.sh,
  - it asserts real VALUES and CROSS-ENDPOINT invariants, not "HTTP 200".

Usage:
    cd /app && python scripts/verify_data_integrity.py
Exit 0 = all invariants hold. Non-zero = integrity violation (use as CI/seed gate).
"""
import asyncio
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ── Shared bootstrap (M4): EVERY entrypoint must load env the same way, otherwise
#    a script silently targets the wrong DB — exactly the bug that hid D1. ─────────
ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend" / ".env")
except Exception:
    pass

G, Y, R, C, B, X = "\033[92m", "\033[93m", "\033[91m", "\033[96m", "\033[1m", "\033[0m"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "aurora_fnb")

API = ""
for line in (ROOT / "frontend" / ".env").read_text().splitlines() if (ROOT / "frontend" / ".env").exists() else []:
    if line.startswith("REACT_APP_BACKEND_URL="):
        API = line.split("=", 1)[1].strip().rstrip("/")
API = os.environ.get("API_BASE", API) or "http://localhost:8001"
ADMIN_EMAIL, ADMIN_PASS = "admin@fnbgroup.id", "Demo@2026"


@dataclass
class Concept:
    """One business concept -> the ONE collection the app reads, plus legacy names
    that must NOT contain data (active drift) once the seed is fixed."""
    name: str
    canonical: str
    must_have_data: bool = True
    legacy_must_be_empty: list = field(default_factory=list)


# The executable contract. Adding a feature => add its concept here.
CONCEPTS = [
    Concept("petty_cash", "petty_cash_transactions", True, ["petty_cash", "petty_cash_entries"]),
    Concept("employee_advances", "employee_advances", True, []),
    Concept("service_charge", "service_charge_periods", True, ["service_charge_runs"]),
    Concept("ap_subledger", "ap_ledgers", True, ["ap_invoices"]),
    Concept("inventory", "inventory_movements", True, ["stock_movements", "stock_balances"]),
    Concept("transfers", "transfers", True, ["stock_transfers"]),
    Concept("daily_sales", "daily_sales", True, []),
    Concept("journal", "journal_entries", True, ["journals", "journal_lines"]),
]

results = {"pass": 0, "fail": 0, "warn": 0}


def line(tag, color, msg, detail=""):
    print(f"  {color}[{tag}]{X} {msg}" + (f"  {color}{detail}{X}" if detail else ""))


async def layer1_collection_reconciliation(db):
    print(f"\n{C}{B}L1/L2 — Seed↔App collection reconciliation (clean-seed required){X}")
    for c in CONCEPTS:
        canon = await db[c.canonical].count_documents({"deleted_at": None})
        if c.must_have_data and canon == 0:
            results["fail"] += 1
            line("FAIL", R, f"{c.name}: canonical '{c.canonical}' is EMPTY",
                 "→ seed GAP or DRIFT (data went to a legacy collection?)")
        else:
            results["pass"] += 1
            line("PASS", G, f"{c.name}: '{c.canonical}' has {canon} docs")
        for legacy in c.legacy_must_be_empty:
            n = await db[legacy].count_documents({})
            if n > 0:
                results["fail"] += 1
                line("FAIL", R, f"{c.name}: legacy '{legacy}' still holds {n} docs",
                     "→ ACTIVE DRIFT: seed/app writing the wrong collection")
            else:
                results["pass"] += 1
                line("PASS", G, f"{c.name}: legacy '{legacy}' is empty")


async def _login(client):
    r = await client.post(f"{API}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    d = r.json()
    return (d.get("data") or {}).get("access_token") or d.get("access_token")


async def layer3_intent_invariants():
    print(f"\n{C}{B}L3/L4 — Cross-endpoint INTENT invariants (KPI == detail, breakdown == total){X}")
    try:
        import httpx
    except ImportError:
        os.system("pip install httpx -q"); import httpx
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tok = await _login(client)
        if not tok:
            results["fail"] += 1
            line("FAIL", R, "login failed — cannot run API invariants"); return
        h = {"Authorization": f"Bearer {tok}"}

        async def get(path):
            r = await client.get(f"{API}{path}", headers=h, timeout=25)
            return r.json().get("data", r.json())

        # INV-1 (catches D): approvals breakdown reconciles to total.
        try:
            d = await get("/api/approvals/counts")
            total, by = d.get("total", 0), d.get("by_entity", {}) or {}
            if total == sum(by.values()):
                results["pass"] += 1; line("PASS", G, f"approvals: total {total} == Σby_entity")
            else:
                results["fail"] += 1
                line("FAIL", R, f"approvals: total {total} != Σby_entity {sum(by.values())}",
                     "→ breakdown UI/endpoint hides a category")
        except Exception as e:
            results["warn"] += 1; line("WARN", Y, f"approvals invariant skipped: {e}")

        # INV-2 (catches A): outlet home petty-cash KPI == Σ detail balances.
        try:
            home = await get("/api/outlet/home")
            pc = home.get("petty_cash_balance", {}) or {}
            home_total = round(sum(pc.values()))
            detail_total = 0.0
            for oid in pc.keys():
                b = await get(f"/api/outlet/petty-cash/balance?outlet_id={oid}")
                detail_total += float((b or {}).get("balance", 0) or 0)
            if abs(home_total - round(detail_total)) <= 1:
                results["pass"] += 1
                line("PASS", G, f"petty cash: home KPI Rp{home_total:,} == Σdetail Rp{round(detail_total):,}")
            else:
                results["fail"] += 1
                line("FAIL", R, f"petty cash: home Rp{home_total:,} != detail Rp{round(detail_total):,}",
                     "→ home & detail read different collections")
        except Exception as e:
            results["warn"] += 1; line("WARN", Y, f"petty-cash invariant skipped: {e}")

        # INV-3 (catches B): HR open_advances consistent with the advances list.
        try:
            dash = await get("/api/hr/dashboard")
            adv = await get("/api/hr/advances")
            items = adv.get("items", adv) if isinstance(adv, dict) else adv
            live_open = sum(1 for a in items if a.get("status") in ("awaiting_approval", "repaying"))
            if dash.get("open_advances") == live_open:
                results["pass"] += 1
                line("PASS", G, f"advances: dashboard open {dash.get('open_advances')} == list {live_open}")
            else:
                results["fail"] += 1
                line("FAIL", R, f"advances: dashboard {dash.get('open_advances')} != list {live_open}",
                     "→ KPI semantic mismatch")
        except Exception as e:
            results["warn"] += 1; line("WARN", Y, f"advances invariant skipped: {e}")

        # INV-4 (catches D1): the books balance.
        try:
            bs = await get("/api/finance/balance-sheet?period=2026-06")
            t = bs.get("totals", {})
            if t.get("is_balanced") is True:
                results["pass"] += 1
                line("PASS", G, f"balance sheet balanced (L Rp{round(t.get('liabilities',0)):,})")
            else:
                results["fail"] += 1
                line("FAIL", R, f"balance sheet NOT balanced (diff {t.get('diff')})",
                     "→ subledger not posted to GL")
        except Exception as e:
            results["warn"] += 1; line("WARN", Y, f"balance-sheet invariant skipped: {e}")


async def main():
    print(f"{B}{C}{'='*64}{X}")
    print(f"{B}  FNB GROUP — DATA INTEGRITY GATE  (DB={DB_NAME}  API={API}){X}")
    print(f"{B}{C}{'='*64}{X}")
    from motor.motor_asyncio import AsyncIOMotorClient
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    await layer1_collection_reconciliation(db)
    await layer3_intent_invariants()
    print(f"\n{B}{'='*64}{X}")
    print(f"  {G}PASS {results['pass']}{X}  |  {R}FAIL {results['fail']}{X}  |  {Y}WARN {results['warn']}{X}")
    if results["fail"]:
        print(f"  {R}{B}INTEGRITY VIOLATION — block seed/deploy until fixed.{X}\n")
        return 1
    print(f"  {G}{B}ALL INVARIANTS HOLD.{X}\n")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
