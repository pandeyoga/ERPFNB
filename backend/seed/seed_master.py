"""seed_master.py — Entry point TUNGGAL untuk semua seed data FnB Group ERP.

Menjalankan semua modul seed secara berurutan, idempotent, non-interaktif.
Setiap step boleh gagal secara independen (kecuali Step 1 - master data wajib).

Run:
    cd /app/backend && python3 -m seed.seed_master
    cd /app/backend && python3 -m seed.seed_master --verify   # jalankan gate setelah seed
    cd /app/backend && python3 -m seed.seed_master --skip-transactions
"""
from __future__ import annotations

import asyncio
import importlib
import sys
import time
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

# ─────────────────────────────────────────────────────────────────────────────
# Definisi urutan seed
# format: (label, module_name, critical)
# critical=True → berhenti jika gagal
# ─────────────────────────────────────────────────────────────────────────────
SEED_STEPS: list[tuple[str, str, bool]] = [
    # Step 1 — Master Data (WAJIB: semua langkah bergantung padanya)
    ("Master Data (users, brands, outlets, CoA, GL mapping, number_series)", "seed.seed_demo", True),
    # Step 2 — Transaksional utama
    ("Sales, PO, GR, Journal Entries (~600 entri)", "seed.seed_phase7b_demo", False),
    # Step 3 — Inventory movements & petty cash (opsional via --skip-transactions)
    ("Inventory movements, petty cash, transfers", "seed.seed_transactions", False),
    # Step 4 — Koleksi tambahan (PR, AP, Payroll, Leave, Anomali)
    ("PR, AP Ledgers, Payroll, Leave, Anomaly Events", "seed.seed_missing_demo", False),
    # Step 5 — HR demo (kasbon + service charge)
    ("HR: Employee Advances + Service Charge periods", "seed.seed_hr_demo", False),
    # Step 6 — Item unit costs (E2 fix: harga pokok per item)
    ("Item unit costs (harga pokok per item)", "seed.seed_item_costs", False),
    # Step 7 — Inventory opening stock (subledger coherence)
    ("Inventory opening stock per item×outlet", "seed.seed_inventory_opening", False),
    # Step 8 — GL inventory opening JE (E2 fix: Dr 1301/1302/1303 / Cr 3002)
    ("GL opening JE untuk inventory (E2)", "seed.seed_inventory_gl_opening", False),
    # Step 9 — AP tax fields: ppn_amount + pph23_amount (E3 fix)
    ("AP Ledgers: ppn_amount + pph23_amount (E3 — e-Bupot)", "seed.seed_ap_tax_fields", False),
    # Step 10 — Cash accounts + Owner user
    ("Cash Position: cash_accounts + Owner role", "seed.seed_phase11_demo", False),
    # Step 11 — CRM / Loyalty
    ("CRM / Loyalty: customers + transactions", "seed.seed_crm_demo", False),
    # Step 12 — Rewards catalog
    ("Loyalty rewards catalog", "seed.seed_rewards", False),
    # Step 13 — Outlet operational budgets
    ("Outlet budgets (KDO/FDO/BDO)", "seed.seed_outlet_budgets", False),
    # Step 14 — Public CMS content
    ("CMS: brands, outlets, news, menu", "seed.seed_cms_content", False),
    # Step 15 — Public content extras (Instagram posts)
    ("CMS extras: Instagram posts", "seed.seed_public_content", False),
    # Step 16 — E-Menu
    ("E-Menu: brand menu categories + items", "seed.seed_emenu", False),
    # Step 17 — Careers / job listings
    ("Careers: job listings", "seed.seed_job_listings", False),
    # Step 18 — Tax codes + COA + settings
    ("Tax: codes, COA (PPh), system settings", "seed.seed_sprint1_tax", False),
    # Step 19 — Fixed assets + reservations
    ("Fixed assets + reservations", "seed.seed_finish_extras", False),
    # Step 20 — Normalize fixed assets to canonical schema
    ("Fixed assets: normalize to canonical schema", "seed.seed_fixed_asset_normalize", False),
    # Step 21 — OPEX journal entries (burn rate)
    ("OPEX JE: biaya operasional (burn rate)", "seed.seed_opex_demo", False),
    # Step 22 — AR demo
    ("Finance AR: customers + invoices + receipts", "seed.seed_ar_demo", False),
]


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
CYAN = "\033[0;36m"
BOLD = "\033[1m"
RESET = "\033[0m"
CHECK = f"{GREEN}✓{RESET}"
CROSS = f"{RED}✗{RESET}"
ARROW = f"{CYAN}→{RESET}"


def _print_header():
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}  FNB GROUP ERP — MASTER SEED (non-interaktif){RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")


async def _run_module(module_name: str) -> bool:
    """Import dan jalankan fungsi main() dari modul seed."""
    try:
        mod = importlib.import_module(module_name)
        if hasattr(mod, "main"):
            await mod.main()
        return True
    except SystemExit:
        return True
    except Exception as exc:
        print(f"    {CROSS} Error: {exc}")
        return False


async def run_all(skip_transactions: bool = False, verify: bool = False):
    _print_header()
    total = len(SEED_STEPS)
    failed: list[str] = []
    overall_start = time.time()

    for idx, (label, module_name, critical) in enumerate(SEED_STEPS, start=1):
        # Skip transactions if requested
        if skip_transactions and module_name == "seed.seed_transactions":
            print(f"  [{YELLOW}SKIP{RESET}] {label}")
            continue

        step_start = time.time()
        print(f"\n{BOLD}[{idx}/{total}]{RESET} {CYAN}{label}{RESET}")
        print(f"  {ARROW} {BOLD}python3 -m {module_name}{RESET}")

        ok = await _run_module(module_name)
        elapsed = round(time.time() - step_start, 1)

        if ok:
            print(f"  {CHECK} {GREEN}Selesai dalam {elapsed}s{RESET}")
        else:
            print(f"  {CROSS} {RED}GAGAL ({elapsed}s){RESET}")
            failed.append(label)
            if critical:
                print(f"\n  {RED}{BOLD}Step kritis gagal. Hentikan seed.{RESET}")
                break

    total_time = round(time.time() - overall_start, 1)
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}  SEED SELESAI — {total_time}s{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")
    if failed:
        print(f"  {YELLOW}⚠  {len(failed)} step gagal:{RESET}")
        for f in failed:
            print(f"    - {f}")
    else:
        print(f"  {CHECK} {GREEN}Semua step berhasil.{RESET}")

    # Backfill AP → GL (script terpisah, tidak melalui module)
    print(f"\n{ARROW} Menjalankan backfill_ap_opening...")
    import subprocess
    res = subprocess.run(
        ["python3", "/app/scripts/backfill_ap_opening.py"],
        capture_output=True, text=True, cwd="/app/backend"
    )
    if res.returncode == 0:
        print(f"  {CHECK} backfill_ap_opening OK")
    else:
        print(f"  {YELLOW}⚠ backfill_ap_opening warning: {res.stderr[:200]}{RESET}")

    # Integrity gate
    print(f"\n{BOLD}[GATE]{RESET} Integrity gate...")
    res = subprocess.run(
        ["python3", "/app/scripts/verify_data_integrity.py"],
        cwd="/app"
    )
    if res.returncode == 0:
        print(f"  {CHECK} {GREEN}Integrity gate PASS.{RESET}")
    else:
        print(f"  {CROSS} {RED}Integrity gate FAIL.{RESET}")

    if verify:
        print(f"\n{BOLD}[VERIFY]{RESET} Health check...")
        res = subprocess.run(
            ["python3", "/app/scripts/health_check.py"],
            cwd="/app"
        )
        if res.returncode == 0:
            print(f"  {CHECK} {GREEN}Health check PASS.{RESET}")
        else:
            print(f"  {CROSS} {RED}Health check FAIL.{RESET}")


def main():
    args = sys.argv[1:]
    skip_tx = "--skip-transactions" in args
    verify = "--verify" in args
    asyncio.run(run_all(skip_transactions=skip_tx, verify=verify))


if __name__ == "__main__":
    main()
