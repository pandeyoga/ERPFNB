#!/usr/bin/env python3
"""
verify_contract.py — FnB Group ERP Collection Contract Verifier
=============================================================
Verifikasi bahwa kode yang akan ditulis (seed / endpoint baru) menggunakan
nama koleksi yang BENAR sesuai dengan yang dibaca oleh API handler.

Mencegah RC-1 (Collection Name Drift) sebelum terjadi.

Usage:
    cd /app
    # Cek koleksi apa yang dibaca oleh router tertentu:
    python scripts/verify_contract.py --router procurement

    # Cek semua router sekaligus:
    python scripts/verify_contract.py --all

    # Cari koleksi spesifik di seluruh codebase:
    python scripts/verify_contract.py --find purchase_requests

    # Bandingkan koleksi yang ditulis seed vs yang dibaca API:
    python scripts/verify_contract.py --check-seed seed_demo
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
BACKEND = ROOT / "backend"
ROUTERS = BACKEND / "routers"
SERVICES = BACKEND / "services"
SEEDS = BACKEND / "seed"

# Koleksi kanonik FnB Group — daftar ini HARUS konsisten dengan ENGINEERING_GUARDRAILS.md
CANONICAL_COLLECTIONS = {
    # Master
    "users", "roles", "groups", "brands", "outlets", "items", "categories",
    "vendors", "employees", "chart_of_accounts", "tax_codes", "payment_methods",
    "bank_accounts", "number_series", "business_rules",
    # Operations
    "daily_sales", "petty_cash", "urgent_purchases",
    # Procurement
    "purchase_requests", "purchase_orders", "goods_receipts",
    # Inventory (canonical data collections)
    "inventory_movements", "adjustments", "transfers", "stock_transfers",
    "opname_sessions",
    # Finance (journal lines are EMBEDDED in journal_entries; AP store is ap_ledgers;
    # periods stored in accounting_periods)
    "journal_entries", "ap_ledgers", "accounting_periods",
    "payment_runs", "payment_run_templates", "kdo_bdo_orders",
    # HR
    "employee_advances", "incentive_runs", "payroll_runs",
    "vouchers", "foc_logs", "leave_requests", "leave_balances",
    # AI / Analytics
    "forecast_snapshots", "anomaly_events", "ai_categorize_history",
    # Approvals
    "approval_steps", "approval_matrices",
    # System
    "audit_log", "notifications", "refresh_tokens", "log_entries",
    "scheduler_runs", "report_templates", "attachments", "daily_close_records",
    # Cash & Budget
    "cash_accounts", "cash_balance_snapshots", "digest_subscriptions",
    "digest_logs", "outlet_budgets", "budget_increase_requests",
    # Other
    "reservations", "ocr_receipt_cache", "item_pricings",
    # CRM / Loyalty
    "customers", "loyalty_transactions", "redemptions",
    # AR
    "ar_customers", "ar_invoices",
    # HR Recruitment
    "job_applications", "job_listings",
    # Menu / CMS
    "brand_menu_pdfs", "brand_menu_categories", "brand_menu_items",
    "custom_pages", "public_brands", "public_outlets", "public_news",
    "public_menu_items", "content_analytics_daily", "brand_instagram_posts",
    # Tax
    "efaktur_export_jobs",
    # System / Settings
    "system_settings", "system_configs", "seo_settings",
    # Additional verified domain collections (post-audit 2026-06)
    "budgets", "ar_receipts", "bank_recon_sessions", "payment_requests",
    "payment_run_templates", "incentive_schemes", "foc_entries", "lb_fund_ledger",
    "market_list_prices", "saved_reports", "notification_queue", "approval_delegations",
    "categorization_rules", "rewards", "payroll_cycles", "salary_masters",
    "service_charge_periods", "petty_cash_transactions", "inventory_movements",
    "adjustments", "transfers",
}

# Alias berbahaya — nama koleksi yang SALAH dan pernah menyebabkan bug
DANGEROUS_ALIASES = {
    "prs": "purchase_requests",
    "pr_requests": "purchase_requests",
    "pos": "purchase_orders",
    "po_orders": "purchase_orders",
    "gr": "goods_receipts",
    "grn": "goods_receipts",
    "journals": "journal_entries",
    "journal_entry": "journal_entries",
    "journal_lines": "journal_entries (lines embedded)",
    "je_lines": "journal_entries (lines embedded)",
    "ap_invoice": "ap_ledgers",
    "ap_invoices": "ap_ledgers",
    "accounts_payable": "ap_ledgers",
    "ap_ledger": "ap_ledgers",
    "fiscal_periods": "accounting_periods",
    "periods": "accounting_periods",
    "stock_balance": "inventory_movements",
    "stock_balances": "inventory_movements",
    "inventory_balance": "inventory_movements",
    "stock_movement": "inventory_movements",
    "stock_movements": "inventory_movements",
    "stock_adjustments": "adjustments",
    "movements": "inventory_movements",
    "kdo_bdo_requests": "kdo_bdo_orders",
    "coa": "chart_of_accounts",
    "accounts": "chart_of_accounts",
    "counters": "number_series",
    "sequences": "number_series",
    "payroll": "payroll_runs",
    # 'service_charge' / 'service_charge_runs' are LEGACY — the live store the app
    # reads is `service_charge_periods` (services/_hr/service_charge.py). The old map
    # here pointed at the WRONG collection, so the verifier itself was drifted.
    "service_charge": "service_charge_periods",
    "service_charge_runs": "service_charge_periods",
    "petty_cash_entries": "petty_cash_transactions",
    "anomalies": "anomaly_events",
    "audit_logs": "audit_log",
    "audits": "audit_log",
}


def extract_collections_from_file(filepath: Path) -> dict[str, list[int]]:
    """Extract collection names referenced via db.<name> OR db["<name>"]/db['<name>'].

    NOTE: the original version only matched dot-notation `db.name` and was therefore
    BLIND to bracket access like db["petty_cash_transactions"] — which is exactly how
    the petty-cash drift hid from this verifier. Both forms are now detected.
    """
    pattern = re.compile(
        r'''db(?:\.([a-z][a-z0-9_]*)|\[\s*['"]([a-z][a-z0-9_]*)['"]\s*\])'''
    )
    collections = {}
    try:
        lines = filepath.read_text(encoding="utf-8", errors="ignore").splitlines()
        for i, line in enumerate(lines, 1):
            for match in pattern.finditer(line):
                col = match.group(1) or match.group(2)
                if col and col not in ("get_db", "command", "ping", "list_collection_names"):
                    collections.setdefault(col, []).append(i)
    except Exception as e:
        print(f"  ERROR membaca {filepath}: {e}")
    return collections


def scan_router(router_name: str) -> None:
    """Scan satu router dan tampilkan koleksi yang digunakan."""
    router_file = ROUTERS / f"{router_name}.py"
    if not router_file.exists():
        print(f"Router tidak ditemukan: {router_file}")
        # Coba cari file yang mirip
        matches = list(ROUTERS.glob(f"*{router_name}*.py"))
        if matches:
            print(f"File yang mirip: {[m.name for m in matches]}")
        return

    print(f"\n{'='*60}")
    print(f"ROUTER: {router_file.name}")
    print('='*60)

    collections = extract_collections_from_file(router_file)

    # Juga scan service layer jika ada import
    content = router_file.read_text(encoding="utf-8", errors="ignore")
    service_imports = re.findall(r'from services\.(\w+)', content)
    service_collections = {}

    for svc in service_imports:
        svc_path = SERVICES / f"{svc}.py"
        if svc_path.exists():
            svc_cols = extract_collections_from_file(svc_path)
            for col, lines in svc_cols.items():
                service_collections.setdefault(col, []).extend(
                    [f"{svc}.py:{l}" for l in lines]
                )

    # Gabungkan
    all_collections = {**collections}
    for col, refs in service_collections.items():
        all_collections.setdefault(col, [])

    if not all_collections:
        print("  Tidak ada akses koleksi langsung yang ditemukan.")
        return

    print(f"\n{'Koleksi':<35} {'Status':<15} {'Baris'}")
    print('-'*70)

    for col in sorted(all_collections.keys()):
        lines = all_collections[col]
        if col in CANONICAL_COLLECTIONS:
            status = "\033[92m[KANONIK]\033[0m"
        elif col in DANGEROUS_ALIASES:
            alias_for = DANGEROUS_ALIASES[col]
            status = f"\033[91m[SALAH → {alias_for}]\033[0m"
        else:
            status = "\033[93m[TIDAK DIKENAL]\033[0m"

        line_refs = ", ".join(str(l) for l in lines[:5])
        if len(lines) > 5:
            line_refs += f"... (+{len(lines)-5})"
        print(f"  {col:<33} {status:<24} baris {line_refs}")


def scan_all_routers() -> None:
    """Scan semua router DAN service (termasuk sub-package _*) — cari koleksi berbahaya."""
    print(f"\n{'='*60}")
    print("SCAN SEMUA ROUTER + SERVICE — Mencari koleksi berbahaya / tidak dikenal")
    print('='*60)

    dangerous_found = []
    unknown_found = []

    # Routers (top-level) + Services (recursive, includes _ar/_finance/_period/... sub-packages)
    files = list(ROUTERS.glob("*.py")) + list(SERVICES.rglob("*.py"))
    for src_file in sorted(files):
        if "__pycache__" in str(src_file):
            continue
        rel = src_file.relative_to(BACKEND)
        collections = extract_collections_from_file(src_file)

        for col, lines in collections.items():
            if col in DANGEROUS_ALIASES:
                dangerous_found.append((str(rel), col,
                                        DANGEROUS_ALIASES[col], lines[:3]))
            elif col not in CANONICAL_COLLECTIONS:
                # Abaikan helper names
                if not col.startswith("_") and len(col) > 3:
                    unknown_found.append((str(rel), col, lines[:3]))

    if dangerous_found:
        print(f"\n\033[91m[BAHAYA] Koleksi dengan nama SALAH yang ditemukan:\033[0m")
        for fname, col, correct, lines in dangerous_found:
            print(f"  {fname}: '{col}' → seharusnya '{correct}' (baris {lines})")
    else:
        print(f"\n\033[92m[OK] Tidak ada koleksi berbahaya ditemukan.\033[0m")

    if unknown_found:
        print(f"\n\033[93m[INFO] Koleksi tidak dikenal (mungkin domain baru):\033[0m")
        for fname, col, lines in unknown_found[:40]:
            print(f"  {fname}: '{col}' (baris {lines})")
    else:
        print(f"\033[92m[OK] Semua koleksi dikenal.\033[0m")


def find_collection(name: str) -> None:
    """Cari semua penggunaan koleksi di seluruh codebase."""
    print(f"\n{'='*60}")
    print(f"CARI KOLEKSI: '{name}'")
    print('='*60)

    pattern = re.compile(rf'db\.{re.escape(name)}\s*[\.\[]')
    found = []

    for py_file in sorted(BACKEND.rglob("*.py")):
        if "test_" in py_file.name or "__pycache__" in str(py_file):
            continue
        try:
            lines = py_file.read_text(encoding="utf-8", errors="ignore").splitlines()
            for i, line in enumerate(lines, 1):
                if pattern.search(line):
                    rel = py_file.relative_to(ROOT)
                    found.append((str(rel), i, line.strip()))
        except Exception:
            pass

    if found:
        print(f"\n  Ditemukan di {len(found)} lokasi:")
        for fpath, lineno, line in found:
            print(f"  {fpath}:{lineno}")
            print(f"    {line[:100]}")
    else:
        print(f"\n  Tidak ditemukan. Apakah nama koleksinya benar?")
        if name in DANGEROUS_ALIASES:
            print(f"  PERINGATAN: '{name}' adalah alias berbahaya! Gunakan '{DANGEROUS_ALIASES[name]}'")

    # Cek juga alias
    reverse_aliases = {v: k for k, v in DANGEROUS_ALIASES.items() if v == name}
    if reverse_aliases:
        print(f"\n  Alias berbahaya yang merujuk ke '{name}': {list(reverse_aliases.values())}")
        print("  Pastikan tidak ada kode yang menggunakan alias tersebut.")


def check_seed(seed_name: str) -> None:
    """Bandingkan koleksi yang ditulis seed vs yang dibaca API router."""
    seed_file = SEEDS / f"{seed_name}.py"
    if not seed_file.exists():
        seeds = list(SEEDS.glob(f"*{seed_name}*.py"))
        if seeds:
            seed_file = seeds[0]
        else:
            print(f"Seed tidak ditemukan: {seed_name}")
            return

    print(f"\n{'='*60}")
    print(f"CHECK SEED: {seed_file.name}")
    print('='*60)

    seed_collections = extract_collections_from_file(seed_file)
    print(f"\nKoleksi yang DITULIS seed ini:")
    print(f"{'Koleksi':<35} {'Status'}")
    print('-'*55)

    has_issue = False
    for col in sorted(seed_collections.keys()):
        if col in CANONICAL_COLLECTIONS:
            print(f"  \033[92m✓\033[0m {col}")
        elif col in DANGEROUS_ALIASES:
            correct = DANGEROUS_ALIASES[col]
            print(f"  \033[91m✗ {col} → seharusnya '{correct}' [RC-1!]\033[0m")
            has_issue = True
        else:
            print(f"  \033[93m? {col} (tidak dikenal)\033[0m")

    if has_issue:
        print(f"\n\033[91mADA MASALAH! Seed menulis ke koleksi SALAH → RC-1 Collection Drift.\033[0m")
        print("Perbaiki sebelum menjalankan seed ini.")
    else:
        print(f"\n\033[92mSemua koleksi seed terlihat kanonik.\033[0m")


def main():
    parser = argparse.ArgumentParser(
        description="Verifikasi contract koleksi MongoDB FnB Group ERP"
    )
    parser.add_argument("--router", help="Scan router tertentu (misal: procurement)")
    parser.add_argument("--all", action="store_true", help="Scan semua router")
    parser.add_argument("--find", help="Cari koleksi tertentu di seluruh codebase")
    parser.add_argument("--check-seed", help="Cek koleksi yang ditulis seed tertentu")
    parser.add_argument("--list-canonical", action="store_true",
                        help="Tampilkan daftar koleksi kanonik")

    args = parser.parse_args()

    if args.list_canonical:
        print("\nKoleksi Kanonik FnB Group:")
        for col in sorted(CANONICAL_COLLECTIONS):
            print(f"  - {col}")
        return

    if args.router:
        scan_router(args.router)
    elif args.all:
        scan_all_routers()
    elif args.find:
        find_collection(args.find)
    elif getattr(args, "check_seed", None):
        check_seed(args.check_seed)
    else:
        parser.print_help()
        print("\nContoh penggunaan:")
        print("  python scripts/verify_contract.py --router procurement")
        print("  python scripts/verify_contract.py --all")
        print("  python scripts/verify_contract.py --find journal_entries")
        print("  python scripts/verify_contract.py --check-seed seed_demo")
        print("  python scripts/verify_contract.py --list-canonical")


if __name__ == "__main__":
    main()
