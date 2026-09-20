#!/usr/bin/env bash
# =============================================================================
# load_context.sh — Context Loader (Tiered) · FnB Group ERP (FnB Group)
# =============================================================================
# Tujuan: memuat KONTEKS yang BENAR sebelum mengerjakan tugas apa pun.
# Prinsip: "code-first, bukan doc-first" (lihat GROUND_TRUTH). Baca Tier-0
# (hukum/kebenaran terverifikasi) lebih dulu, lalu Tier-1 SESUAI TUGAS.
# JANGAN baca "dokumen aspiratif" (PRD/visi/blueprint) sebagai sumber kebenaran.
#
# Klasifikasi tier diturunkan dari memory/GROUND_TRUTH_2026-06-17.md (PART A —
# status setiap dokumen) + header status tiap dokumen.
#
# Usage:
#   cd /app && bash scripts/load_context.sh             # tampilkan peta + probe state
#   cd /app && bash scripts/load_context.sh --task bug  # rute Tier-1 utk task tertentu
#   cd /app && bash scripts/load_context.sh --print t0   # cetak isi semua file Tier-0
#
#   --task <bug|feature|ui|finance|inventory|procurement|hr|testing|rbac>
#   --print <t0|t1>   Cetak (cat) seluruh isi file pada tier tsb ke stdout
#   --no-probe        Lewati live state probe (DB counts + health + login)
# =============================================================================
set -uo pipefail

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; RESET='\033[0m'
OK="${GREEN}✓${RESET}"; NO="${RED}✗${RESET}"; ARROW="${CYAN}→${RESET}"; WARN="${YELLOW}⚠${RESET}"

# ── Pastikan dari /app ────────────────────────────────────────────────────────
if [ ! -f "backend/server.py" ]; then
  echo -e "${RED}ERROR:${RESET} Jalankan dari /app  →  cd /app && bash scripts/load_context.sh"
  exit 1
fi

TASK=""; PRINT=""; PROBE=true
while [ $# -gt 0 ]; do
  case "$1" in
    --task) TASK="${2:-}"; shift 2 ;;
    --print) PRINT="${2:-}"; shift 2 ;;
    --no-probe) PROBE=false; shift ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Definisi tier (path relatif /app) ─────────────────────────────────────────
# Tier-0 = HUKUM + KEBENARAN TERVERIFIKASI (selalu dibaca lebih dulu)
TIER0=(
  "memory/ENGINEERING_GUARDRAILS.md|SSOT ATURAN (WAJIB): RC-1..15, koleksi kanonik, DoD, gate eksekutabel"
  "memory/GROUND_TRUTH_2026-06-17.md|SSOT STATUS fitur (code-verified): apa yang NYATA selesai vs belum"
  "memory/UI_IA_PARITY_GUARDRAILS.md|WAJIB (UI/IA): UI-RC-1..7, PAR-RC-1..3 — pelengkap guardrails FE"
  "docs/UX_USABILITY_STANDARD.md|Standar UX (living): acuan kualitas UX, bukan daftar tugas"
  "memory/test_credentials.md|Kredensial uji (login demo/bypass) — baca sebelum auth/test"
)

# Tier-1 = KONTEKS TUGAS (dibaca SESUAI TUGAS saja)
TIER1=(
  "plan.md|Master plan & progress (UI/UX + IA + parity + backend)"
  "memory/FLOW_INVENTORY_2026-06-18.md|Inventaris flow end-to-end — untuk kerja FITUR/FLOW"
  "memory/COMPLETE_FEATURE_INVENTORY_2026-06-18.md|Peta ~180 fitur & endpoint — orientasi cakupan"
  "memory/UI_UX_AUDIT_2026-06-17.md|Temuan UI/UX per-halaman — untuk task UI/UX"
  "memory/PARITY_AUDIT_2026-06-17.md|Parity Backend↔Frontend — untuk task parity"
  "test_result.md|Log hasil test per-sesi (protokol testing data/render)"
)

# Aspiratif = JANGAN dibaca sebagai sumber kebenaran (visi/requirement/blueprint)
ASPIRATIONAL=(
  "memory/PRD.md|Requirement/visi produk — ASPIRATIF (pakai GROUND_TRUTH utk realita)"
  "design_guidelines.md|Blueprint desain token-level — ASPIRATIF (referensi, bukan status)"
  "design_guidelines.json|Token desain (machine) — ASPIRATIF"
)

print_row() { # "<path>|<desc>"  <symbol>
  local path="${1%%|*}"; local desc="${1#*|}"; local sym="$2"
  if [ -f "$path" ]; then
    local lines; lines=$(wc -l < "$path" 2>/dev/null | tr -d ' ')
    printf "  %b ${BOLD}%-46s${RESET} ${CYAN}%5s ln${RESET}  %s\n" "$sym" "$path" "$lines" "$desc"
  else
    printf "  %b ${BOLD}%-46s${RESET} ${RED}MISSING${RESET}   %s\n" "$NO" "$path" "$desc"
  fi
}

header() {
  echo ""
  echo -e "${BOLD}${CYAN}===============================================================================${RESET}"
  echo -e "${BOLD}${CYAN}  CONTEXT LOADER — FnB Group ERP (FnB Group)  ·  $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
  echo -e "${BOLD}${CYAN}===============================================================================${RESET}"
  echo -e "  Prinsip: ${BOLD}code-first, bukan doc-first${RESET}. Verify, don't assume."
  echo -e "  Urutan : ${BOLD}Tier-0 (hukum/kebenaran)${RESET} → ${BOLD}Tier-1 (sesuai tugas)${RESET} → ${RED}skip aspiratif${RESET}"
}

# ── --print mode: cat seluruh isi tier ───────────────────────────────────────
if [ -n "$PRINT" ]; then
  declare -n SRC
  case "$PRINT" in
    t0|tier0|0) SRC=TIER0 ;;
    t1|tier1|1) SRC=TIER1 ;;
    *) echo "Unknown --print '$PRINT' (pakai t0|t1)"; exit 1 ;;
  esac
  for entry in "${SRC[@]}"; do
    f="${entry%%|*}"
    echo -e "\n\n############################## ${f} ##############################\n"
    [ -f "$f" ] && cat "$f" || echo "(MISSING: $f)"
  done
  exit 0
fi

header

echo ""
echo -e "${BOLD}${GREEN}▌ TIER-0 — WAJIB DIBACA LEBIH DULU (hukum + kebenaran terverifikasi)${RESET}"
for e in "${TIER0[@]}"; do print_row "$e" "$OK"; done
echo -e "  ${ARROW} cetak semua: ${BOLD}bash scripts/load_context.sh --print t0${RESET}"

echo ""
echo -e "${BOLD}${YELLOW}▌ TIER-1 — BACA SESUAI TUGAS (jangan baca semua sekaligus)${RESET}"
for e in "${TIER1[@]}"; do print_row "$e" "$ARROW"; done

echo ""
echo -e "${BOLD}${RED}▌ ASPIRATIF — JANGAN dibaca sebagai sumber kebenaran (skip by default)${RESET}"
for e in "${ASPIRATIONAL[@]}"; do print_row "$e" "$WARN"; done

# ── Rute Tier-1 per task ──────────────────────────────────────────────────────
if [ -n "$TASK" ]; then
  echo ""
  echo -e "${BOLD}${MAGENTA}▌ RUTE TIER-1 untuk task: '${TASK}'${RESET}"
  case "$TASK" in
    bug|bugfix|fix)
      echo -e "  ${WARN} Tidak ada bug-backlog/handoff statis (sengaja dihapus: false-positive)."
      echo -e "  ${ARROW} Verifikasi bug SECARA code-first: reproduksi via curl + screenshot dulu."
      echo -e "  ${ARROW} Gate realita: python scripts/verify_data_integrity.py · python scripts/health_check.py"
      echo -e "  ${ARROW} ENGINEERING_GUARDRAILS §3 (RC), §9 (registry fix) — klasifikasi root cause" ;;
    feature|flow)
      echo -e "  ${ARROW} memory/FLOW_INVENTORY_2026-06-18.md"
      echo -e "  ${ARROW} memory/COMPLETE_FEATURE_INVENTORY_2026-06-18.md" ;;
    ui|ux|design)
      echo -e "  ${ARROW} memory/UI_UX_AUDIT_2026-06-17.md + memory/UI_IA_PARITY_GUARDRAILS.md (Tier-0)"
      echo -e "  ${ARROW} docs/UX_USABILITY_STANDARD.md (Tier-0)  · plan.md" ;;
    rbac|permission|role)
      echo -e "  ${ARROW} ENGINEERING_GUARDRAILS RC-9 (RBAC bukan satu sumber) + core/perms_catalog.py + koleksi roles"
      echo -e "  ${ARROW} Verifikasi code-first: bandingkan peta akses FE vs BE per endpoint (jangan percaya audit lama)" ;;
    testing|qa|coverage)
      echo -e "  ${ARROW} test_result.md + ENGINEERING_GUARDRAILS RC-10/DoD (data+render, bukan status 200)"
      echo -e "  ${ARROW} Gate: verify_data_integrity.py · health_check.py · intent_audit_*.py · pytest" ;;
    finance|inventory|procurement|hr)
      echo -e "  ${ARROW} memory/FLOW_INVENTORY_2026-06-18.md (cari domain '${TASK}')"
      echo -e "  ${ARROW} ENGINEERING_GUARDRAILS §2 (koleksi kanonik domain '${TASK}')" ;;
    *) echo -e "  ${WARN} task tidak dikenal. Pakai: bug|feature|ui|rbac|testing|finance|inventory|procurement|hr" ;;
  esac
fi

# ── Live state probe (kebenaran = state nyata, bukan klaim dokumen) ───────────
if [ "$PROBE" = true ]; then
  echo ""
  echo -e "${BOLD}${CYAN}▌ LIVE STATE PROBE (realita runtime — bukan klaim dokumen)${RESET}"

  # services
  if command -v supervisorctl >/dev/null 2>&1; then
    be=$(sudo supervisorctl status backend 2>/dev/null | awk '{print $2}')
    fe=$(sudo supervisorctl status frontend 2>/dev/null | awk '{print $2}')
    echo -e "  services : backend=${BOLD}${be:-?}${RESET}  frontend=${BOLD}${fe:-?}${RESET}"
  fi

  # health
  H=$(curl -s --max-time 5 http://localhost:8001/api/health 2>/dev/null)
  if echo "$H" | grep -q '"status":"ok"'; then
    echo -e "  health   : ${OK} /api/health OK  $(echo "$H" | head -c 120)"
  else
    echo -e "  health   : ${NO} /api/health tidak OK"
  fi

  # DB counts (DB_NAME dari .env — jangan hardcode)
  python3 - <<'PY' 2>/dev/null || echo -e "  db       : ${RED}probe gagal${RESET}"
import os
from pathlib import Path
env = Path("backend/.env")
if env.exists():
    for ln in env.read_text().splitlines():
        if ln.strip() and not ln.strip().startswith("#") and "=" in ln:
            k,v=ln.split("=",1); os.environ.setdefault(k.strip(), v.strip().strip('"'))
try:
    from pymongo import MongoClient
    db = MongoClient(os.environ.get("MONGO_URL","mongodb://localhost:27017"))[os.environ.get("DB_NAME","test_database")]
    cols = ["users","outlets","daily_sales","journal_entries","purchase_orders",
            "goods_receipts","customers","inventory_movements"]
    parts = [f"{c}={db[c].count_documents({})}" for c in cols]
    print("  db       : " + os.environ.get("DB_NAME","?") + " · " + "  ".join(parts))
except Exception as e:
    print(f"  db       : probe error {e}")
PY

  # login sanity (creds dari test_credentials.md fallback ke demo)
  L=$(curl -s --max-time 6 -X POST http://localhost:8001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@fnbgroup.id","password":"Demo@2026"}' 2>/dev/null)
  if echo "$L" | grep -q 'access_token'; then
    echo -e "  login    : ${OK} admin@fnbgroup.id (SUPER_ADMIN) — token OK"
  else
    echo -e "  login    : ${NO} login demo gagal — cek rate-limit/seed"
  fi
fi

echo ""
echo -e "${BOLD}${GREEN}▌ NEXT STEPS${RESET}"
echo -e "  1. Baca Tier-0 sekarang (mulai ENGINEERING_GUARDRAILS → GROUND_TRUTH)."
echo -e "  2. Tentukan TUGAS, lalu: ${BOLD}bash scripts/load_context.sh --task <jenis>${RESET} untuk rute Tier-1."
echo -e "  3. Gate eksekutabel sebelum klaim selesai: ${BOLD}python scripts/verify_data_integrity.py${RESET}, ${BOLD}python scripts/health_check.py${RESET}."
echo -e "  4. ${RED}JANGAN${RESET} jadikan dokumen aspiratif (PRD/design_guidelines) sebagai sumber kebenaran."
echo ""
