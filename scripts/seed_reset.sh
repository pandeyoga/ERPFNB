#!/usr/bin/env env bash
# =============================================================================
# seed_reset.sh — Reset & Seed Database FnB Group ERP
# =============================================================================
# Menjalankan semua seed secara berurutan dengan progress tracking.
# Berguna untuk:
#   - Environment baru (preview / staging)
#   - Setelah database di-reset / drop
#   - Quick demo environment setup
#
# Usage:
#   cd /app
#   bash scripts/seed_reset.sh
#
#   # Dengan opsi --verify (jalankan health check setelah selesai):
#   bash scripts/seed_reset.sh --verify
#
#   # Skip seed tertentu:
#   bash scripts/seed_reset.sh --skip-transactions
#
# =============================================================================
set -euo pipefail

# ── Warna terminal ─────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'
CHECKMARK="${GREEN}✓${RESET}"
CROSS="${RED}✗${RESET}"
ARROW="${CYAN}→${RESET}"

# ── Parse argumen ─────────────────────────────────────────────────────────────
VERIFY=false
SKIP_TRANSACTIONS=false
for arg in "$@"; do
    case $arg in
        --verify) VERIFY=true ;;
        --skip-transactions) SKIP_TRANSACTIONS=true ;;
        --help|-h)
            echo "Usage: bash scripts/seed_reset.sh [--verify] [--skip-transactions]"
            echo "  --verify             Jalankan health check setelah seed selesai"
            echo "  --skip-transactions  Skip seed_transactions (inventory, petty cash)"
            exit 0
            ;;
    esac
done

# ── Pastikan dijalankan dari direktori /app ───────────────────────────────────
if [ ! -f "backend/server.py" ]; then
    echo -e "${RED}ERROR:${RESET} Jalankan dari direktori /app (bukan /app/backend)"
    echo "  cd /app && bash scripts/seed_reset.sh"
    exit 1
fi

BACKEND_DIR="$(pwd)/backend"
PYTHON="python3"

# ── Helper: jalankan satu seed module ─────────────────────────────────────────
run_seed() {
    local step="$1"
    local module="$2"
    local description="$3"
    local total_steps="$4"

    echo ""
    echo -e "${BOLD}[${step}/${total_steps}]${RESET} ${CYAN}${description}${RESET}"
    echo -e "  ${ARROW} Menjalankan: ${BOLD}python3 -m ${module}${RESET}"

    start_time=$SECONDS
    # Capture python's REAL exit code (not grep's). Previously the pipeline's
    # exit code came from grep — when a seed's output didn't contain a keyword,
    # grep returned 1 and the step was falsely reported as failed (pipefail).
    cd "${BACKEND_DIR}"
    local rc=0
    ${PYTHON} -m "${module}" > /tmp/_seed_step.log 2>&1 || rc=$?
    grep -E "✓|Creating|Seeding|SEED|Error|ERROR|Traceback|→|complete|inserted|Seeded|pairs|movements" \
        /tmp/_seed_step.log | head -30 | sed 's/^/    /' || true
    cd - > /dev/null
    elapsed=$((SECONDS - start_time))
    if [ "${rc}" -eq 0 ]; then
        echo -e "  ${CHECKMARK} ${GREEN}Selesai dalam ${elapsed}s${RESET}"
        return 0
    else
        echo -e "  ${CROSS} ${RED}GAGAL (exit code: ${rc}, ${elapsed}s)${RESET}"
        return "${rc}"
    fi
}

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}================================================================${RESET}"
echo -e "${BOLD}${CYAN}  FNB GROUP GROUP ERP — DATABASE SEED RESET${RESET}"
echo -e "${BOLD}${CYAN}================================================================${RESET}"
echo -e "  Waktu  : $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  Backend: ${BACKEND_DIR}"
echo -e "  Python : $(${PYTHON} --version 2>&1)"
if [ "$VERIFY" = true ]; then
    echo -e "  Mode   : Seed + Health Check"
fi
echo ""
echo -e "${YELLOW}⚠  PERINGATAN: seed_demo.py akan menghapus data master yang ada!${RESET}"
echo -e "   Lanjutkan? (Ctrl+C untuk batal, Enter untuk lanjut)"
read -r

# ── Hitung total steps ────────────────────────────────────────────────────────
TOTAL=20
if [ "$SKIP_TRANSACTIONS" = true ]; then
    TOTAL=19
fi

# ── Jalankan seed berurutan ───────────────────────────────────────────────────
FAILED_STEPS=()
OVERALL_START=$SECONDS

# Step 1: Master Data (WAJIB pertama)
if run_seed 1 "seed.seed_demo" \
    "Master Data (users, brands, outlets, employees, CoA, GL mapping, number_series)" \
    "${TOTAL}"; then
    echo -e "    ${CHECKMARK} users, brands, outlets, employees, CoA, roles"
else
    echo -e "  ${CROSS} ${RED}Step 1 gagal. Hentikan — langkah berikutnya bergantung pada master data.${RESET}"
    exit 1
fi

# Step 2: Sales, PO, GR, Journal Entries
if run_seed 2 "seed.seed_phase7b_demo" \
    "Transaksional: Daily Sales, Purchase Orders, Goods Receipts, Journal Entries (600)" \
    "${TOTAL}"; then
    echo -e "    ${CHECKMARK} daily_sales, purchase_orders, goods_receipts, journal_entries"
else
    FAILED_STEPS+=("seed_phase7b_demo")
    echo -e "  ${YELLOW}Step 2 gagal, melanjutkan...${RESET}"
fi

# Step 3: Inventory, Petty Cash (opsional)
if [ "$SKIP_TRANSACTIONS" = false ]; then
    if run_seed 3 "seed.seed_transactions" \
        "Inventory: Stock movements, Petty cash, Transfers" \
        "${TOTAL}"; then
        echo -e "    ${CHECKMARK} inventory_movements, petty_cash, stock_transfers"
    else
        FAILED_STEPS+=("seed_transactions")
        echo -e "  ${YELLOW}Step 3 gagal, melanjutkan...${RESET}"
    fi
    MISSING_STEP=4
else
    echo ""
    echo -e "  ${YELLOW}[SKIP]${RESET} seed_transactions (--skip-transactions)"
    MISSING_STEP=3
fi

# Step 4: Missing collections (PR, AP, Payroll, Leave, Anomalies)
if run_seed ${MISSING_STEP} "seed.seed_missing_demo" \
    "Collections tambahan: PRs, AP Ledgers, Payroll Cycles, Leave Requests, Anomaly Events" \
    "${TOTAL}"; then
    echo -e "    ${CHECKMARK} purchase_requests, ap_ledgers, payroll_cycles, leave_requests, anomaly_events"
else
    FAILED_STEPS+=("seed_missing_demo")
    echo -e "  ${YELLOW}Step ${MISSING_STEP} gagal, melanjutkan...${RESET}"
fi

# Step 5: HR demo (advances + service charge) — fills employee_advances & service_charge_periods
if run_seed 5 "seed.seed_hr_demo" \
    "HR: Employee Advances (kasbon) + Service Charge periods" \
    "${TOTAL}"; then
    echo -e "    ${CHECKMARK} employee_advances, service_charge_periods"
else
    FAILED_STEPS+=("seed_hr_demo")
    echo -e "  ${YELLOW}Step 5 gagal, melanjutkan...${RESET}"
fi

# Step 6: Inventory opening stock (D3) — keeps stock_balance non-negative
if run_seed 6 "seed.seed_inventory_opening" \
    "Inventory: opening stock per item×outlet (subledger coherence)" \
    "${TOTAL}"; then
    echo -e "    ${CHECKMARK} inventory_movements (opening)"
else
    FAILED_STEPS+=("seed_inventory_opening")
    echo -e "  ${YELLOW}Step 6 gagal, melanjutkan...${RESET}"
fi

# Step 7: AP -> GL opening backfill (D1) — Balance Sheet liabilities reconcile
echo -e "  ${ARROW} Menjalankan: ${BOLD}backfill_ap_opening${RESET}"
if cd "${BACKEND_DIR}" && ${PYTHON} /app/scripts/backfill_ap_opening.py; then
    echo -e "    ${CHECKMARK} AP opening JE posted (or idempotent skip)"
else
    FAILED_STEPS+=("backfill_ap_opening")
    echo -e "  ${YELLOW}Step 7 gagal, melanjutkan...${RESET}"
fi

# ── Steps 8+: Feature datasets (additive; do NOT touch the financial core) ─────
# These power feature pages that were previously empty (Owner cash position,
# CRM, loyalty, rewards, outlet budgets, public/CMS content, e-menu, careers,
# fixed assets, reservations, tax). Each writes only to its own collection(s).

# Step 8: Cash accounts + Owner role/user (fixes Owner Cockpit "Cash Position Rp 0")
if run_seed 8 "seed.seed_phase11_demo" \
    "Cash Position: cash_accounts + snapshots + Owner role/user" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} cash_accounts, cash_balance_snapshots"
else
    FAILED_STEPS+=("seed_phase11_demo"); echo -e "  ${YELLOW}Step 8 gagal, melanjutkan...${RESET}"
fi

# Step 9: CRM / Loyalty demo (customers + loyalty_transactions)
if run_seed 9 "seed.seed_crm_demo" \
    "CRM / Loyalty: customers + loyalty_transactions" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} customers, loyalty_transactions"
else
    FAILED_STEPS+=("seed_crm_demo"); echo -e "  ${YELLOW}Step 9 gagal, melanjutkan...${RESET}"
fi

# Step 10: Rewards catalog
if run_seed 10 "seed.seed_rewards" "Loyalty rewards catalog" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} rewards"
else
    FAILED_STEPS+=("seed_rewards"); echo -e "  ${YELLOW}Step 10 gagal, melanjutkan...${RESET}"
fi

# Step 11: Outlet operational budgets (KDO/FDO/BDO)
if run_seed 11 "seed.seed_outlet_budgets" "Outlet budgets + increase requests" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} outlet_budgets, budget_increase_requests"
else
    FAILED_STEPS+=("seed_outlet_budgets"); echo -e "  ${YELLOW}Step 11 gagal, melanjutkan...${RESET}"
fi

# Step 12: Public/CMS content (brands, outlets, news, menu items)
if run_seed 12 "seed.seed_cms_content" "Public CMS content: brands/outlets/news/menu" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} public_brands, public_outlets, public_news, public_menu_items"
else
    FAILED_STEPS+=("seed_cms_content"); echo -e "  ${YELLOW}Step 12 gagal, melanjutkan...${RESET}"
fi

# Step 13: Public content extras (Instagram posts) — run AFTER cms_content
if run_seed 13 "seed.seed_public_content" "Public content: instagram posts + brands/outlets" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} brand_instagram_posts"
else
    FAILED_STEPS+=("seed_public_content"); echo -e "  ${YELLOW}Step 13 gagal, melanjutkan...${RESET}"
fi

# Step 14: E-Menu (brand_menu_categories/items) — needs public_brands first
if run_seed 14 "seed.seed_emenu" "E-Menu: categories + items per brand" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} brand_menu_categories, brand_menu_items"
else
    FAILED_STEPS+=("seed_emenu"); echo -e "  ${YELLOW}Step 14 gagal, melanjutkan...${RESET}"
fi

# Step 15: Careers / job listings
if run_seed 15 "seed.seed_job_listings" "Careers: job listings" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} job_listings"
else
    FAILED_STEPS+=("seed_job_listings"); echo -e "  ${YELLOW}Step 15 gagal, melanjutkan...${RESET}"
fi

# Step 16: Tax codes + tax COA + tax settings (PPN/PPh)
if run_seed 16 "seed.seed_sprint1_tax" "Tax: codes + COA (PPh) + settings" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} tax_codes, chart_of_accounts (PPh), system_settings"
else
    FAILED_STEPS+=("seed_sprint1_tax"); echo -e "  ${YELLOW}Step 16 gagal, melanjutkan...${RESET}"
fi

# Step 17: Fixed assets + reservations (safe subset of seed_compro)
if run_seed 17 "seed.seed_finish_extras" "Fixed assets + reservations" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} fixed_assets, reservations"
else
    FAILED_STEPS+=("seed_finish_extras"); echo -e "  ${YELLOW}Step 17 gagal, melanjutkan...${RESET}"
fi

# Step 18: Normalize fixed assets to canonical schema (purchase_cost/accumulated_dep/
# asset_code/dep_method) so FixedAssetList "Total Cost" + asset register are coherent
# (fixes RC-2 field drift: source uses acquisition_value/accumulated_depreciation).
if run_seed 18 "seed.seed_fixed_asset_normalize" "Fixed assets: normalize to canonical schema" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} fixed_assets canonical fields (register Total Cost coherent)"
else
    FAILED_STEPS+=("seed_fixed_asset_normalize"); echo -e "  ${YELLOW}Step 18 gagal, melanjutkan...${RESET}"
fi

# Step 19: Operating-expense JEs (OPEX) — makes burn_30d / cash runway meaningful
if run_seed 19 "seed.seed_opex_demo" "Finance: operating-expense journal entries (burn rate)" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} journal_entries (opex; Dr Expense / Cr Bank, balanced)"
else
    FAILED_STEPS+=("seed_opex_demo"); echo -e "  ${YELLOW}Step 19 gagal, melanjutkan...${RESET}"
fi

# Step 20: AR demo (customers + invoices + receipts) — fills Finance > AR Invoices pages
# (Customers tab, Aging Report Per Customer, Reconciliation). Auto-posts balanced AR JEs.
if run_seed "${TOTAL}" "seed.seed_ar_demo" \
    "Finance AR: customers + invoices (sent/partial/paid) + receipts (GL-posted)" "${TOTAL}"; then
    echo -e "    ${CHECKMARK} ar_customers, ar_invoices, ar_receipts, journal_entries (AR; balanced)"
else
    FAILED_STEPS+=("seed_ar_demo"); echo -e "  ${YELLOW}Step ${TOTAL} gagal, melanjutkan...${RESET}"
fi


# ── Ringkasan ─────────────────────────────────────────────────────────────────
TOTAL_TIME=$((SECONDS - OVERALL_START))
echo ""
echo -e "${BOLD}${CYAN}================================================================${RESET}"
echo -e "${BOLD}  SEED SELESAI — ${TOTAL_TIME}s${RESET}"
echo -e "${BOLD}${CYAN}================================================================${RESET}"

if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
    echo -e "  ${CHECKMARK} ${GREEN}Semua seed berhasil${RESET}"
else
    echo -e "  ${YELLOW}⚠  ${#FAILED_STEPS[@]} seed gagal: ${FAILED_STEPS[*]}${RESET}"
    echo -e "     Periksa error di atas dan jalankan ulang jika diperlukan"
fi

# ── Quick summary query ──────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Summary database:${RESET}"
cd "${BACKEND_DIR}" && ${PYTHON} -c "
import asyncio, os
from dotenv import load_dotenv
load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient

async def count():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ.get('DB_NAME', 'fnb_erp')]
    collections = [
        ('users', 'users'),
        ('outlets', 'outlets'),
        ('employees', 'employees'),
        ('chart_of_accounts', 'CoA'),
        ('journal_entries', 'journal_entries'),
        ('purchase_orders', 'purchase_orders'),
        ('goods_receipts', 'goods_receipts'),
        ('inventory_movements', 'inventory_movements'),
        ('ap_ledgers', 'ap_ledgers'),
        ('payroll_cycles', 'payroll_cycles'),
        ('leave_requests', 'leave_requests'),
        ('anomaly_events', 'anomaly_events'),
        ('ar_customers', 'ar_customers'),
        ('ar_invoices', 'ar_invoices'),
    ]
    for col, label in collections:
        n = await db[col].count_documents({'deleted_at': None})
        status = '✓' if n > 0 else '○'
        print(f'    {status} {label:<25} : {n}')
    client.close()

asyncio.run(count())
" 2>/dev/null
cd - > /dev/null

# ── Verifikasi (opsional) ─────────────────────────────────────────────────────
if [ "$VERIFY" = true ]; then
    echo ""
    echo -e "${BOLD}[VERIFY]${RESET} Menjalankan health check..."
    cd "$(pwd)/.." 2>/dev/null || true
    if [ -f "scripts/health_check.py" ]; then
        ${PYTHON} scripts/health_check.py
    else
        echo -e "  ${YELLOW}health_check.py tidak ditemukan. Skip verify.${RESET}"
    fi
fi

# ── Integrity gate (ALWAYS) — the guard that catches seed↔app drift, seed gaps,
#    and cross-endpoint intent drift. Runs on the just-seeded CLEAN DB. ───────────
echo ""
echo -e "${BOLD}[GATE]${RESET} Menjalankan data-integrity gate..."
if [ -f "/app/scripts/verify_data_integrity.py" ]; then
    if ${PYTHON} /app/scripts/verify_data_integrity.py; then
        echo -e "  ${GREEN}Integrity gate PASS.${RESET}"
    else
        echo -e "  ${RED}${BOLD}Integrity gate FAIL — periksa drift/gap di atas sebelum lanjut.${RESET}"
    fi
else
    echo -e "  ${YELLOW}verify_data_integrity.py tidak ditemukan. Skip gate.${RESET}"
fi

# ── Intent audit: remaining modules (Fixed Assets · Tax · Payment Runs · Bank Recon)
#    Write-path checks use synthetic data + full rollback (zero residue).
if [ -f "/app/backend/scripts/intent_audit_remaining.py" ]; then
    echo ""
    if (cd /app/backend && ${PYTHON} scripts/intent_audit_remaining.py); then
        echo -e "  ${GREEN}Intent audit (remaining modules) PASS.${RESET}"
    else
        echo -e "  ${RED}${BOLD}Intent audit FAIL — periksa invariant modul di atas.${RESET}"
    fi
fi

echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo -e "  bash scripts/seed_reset.sh --verify   ${CYAN}# Jalankan ulang dengan health check${RESET}"
echo -e "  python scripts/health_check.py         ${CYAN}# Cek kesehatan sistem${RESET}"
echo -e "  python scripts/verify_contract.py --all ${CYAN}# Audit collection contract${RESET}"
echo ""
