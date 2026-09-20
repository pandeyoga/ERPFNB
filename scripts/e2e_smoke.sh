#!/usr/bin/env bash
# =============================================================================
# e2e_smoke.sh — Deploy-gate E2E SMOKE PIPELINE (sekali jalan).
#
# Membuktikan flow bisnis inti masih SEHAT & BALANCED sebelum rilis:
#   • Manual Journal (Dr=Cr, tolak imbalanced & zero-amount)
#   • Daily Sales draft->submit->validate -> JE balanced
#   • Procurement P2P: PO -> submit -> approve -> GR (stok + AP + JE balanced)
#   • Inventory: adjustment (+stok, JE) + transfer (stok pindah src/dst)
#   • Payment Run: create -> confirm -> post (batch JE balanced, PAY -> paid)
#   • Trial Balance balanced + AP Aging rekonsiliasi
#
# Semua test memvalidasi LOGIKA (bukan sekadar HTTP 200). Data uji otomatis
# di-rollback (snapshot/restore DB) — tidak mengotori data seed.
#
# Pakai:
#   bash /app/scripts/e2e_smoke.sh            # jalankan smoke pipeline
#   bash /app/scripts/e2e_smoke.sh -v         # verbose per-test
#
# Exit code: 0 = semua lulus (aman deploy), !=0 = ada yang gagal (BLOKIR deploy).
# =============================================================================
set -uo pipefail

BACKEND_DIR="/app/backend"
EXTRA_ARGS="${*:-}"

echo "==================================================================="
echo " E2E SMOKE PIPELINE — FnB Group ERP (deploy gate)"
echo " target: $(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2-)"
echo " waktu : $(date '+%Y-%m-%d %H:%M:%S')"
echo "==================================================================="

cd "$BACKEND_DIR" || { echo "FATAL: $BACKEND_DIR tidak ditemukan"; exit 2; }

# ---------------------------------------------------------------------------
# STEP 0/2 — DATA-INTEGRITY / DRIFT (read-only) [--strict]
# Cek koleksi + GL balance (Dr=Cr semua JE) + number_series counter
# (risiko collision doc-no). Gagal (exit!=0) bila ada temuan KRITIS.
# ---------------------------------------------------------------------------
echo ""
echo ">>> STEP 0/2 — Data integrity & drift (GL balance, number_series)"
echo "-------------------------------------------------------------------"
python /app/scripts/audit_data_integrity.py --strict
INTEG=$?
if [ "$INTEG" -ne 0 ]; then
    echo "-------------------------------------------------------------------"
    echo "❌ DATA-INTEGRITY GAGAL (exit=$INTEG) — drift/GL bermasalah. JANGAN deploy."
    echo "==================================================================="
    exit "$INTEG"
fi
echo "✅ Data integrity bersih — GL balanced, tak ada drift kritis."

# ---------------------------------------------------------------------------
# STEP 1/2 — GET endpoint sweep (deteksi 5xx / route hilang) [--strict]
# Hit setiap GET route sbg admin, resolve path-param dari data nyata.
# Gagal (exit!=0) bila ADA endpoint 5xx/exception → blokir sebelum pytest.
# ---------------------------------------------------------------------------
echo ""
echo ">>> STEP 1/2 — GET endpoint sweep (5xx / route hilang)"
echo "-------------------------------------------------------------------"
python /app/scripts/audit_endpoint_sweep.py --strict
SWEEP=$?
if [ "$SWEEP" -ne 0 ]; then
    echo "-------------------------------------------------------------------"
    echo "❌ ENDPOINT SWEEP GAGAL (exit=$SWEEP) — ada 5xx/route bermasalah."
    echo "   JANGAN deploy. Perbaiki dulu endpoint di atas."
    echo "==================================================================="
    exit "$SWEEP"
fi
echo "✅ Endpoint sweep bersih — 0 server-error (5xx)."

# ---------------------------------------------------------------------------
# STEP 2/2 — E2E business-logic smoke (pytest -m e2e)
# ---------------------------------------------------------------------------
echo ""
echo ">>> STEP 2/2 — E2E business-logic smoke (pytest -m e2e)"
echo "-------------------------------------------------------------------"
# -m e2e -> hanya flow bisnis end-to-end. --strict-markers cegah typo marker.
python -m pytest -m e2e \
    --strict-markers \
    -p no:cacheprovider \
    --no-header \
    -ra \
    ${EXTRA_ARGS:-"-q"}

CODE=$?

echo "-------------------------------------------------------------------"
if [ "$CODE" -eq 0 ]; then
    echo "✅ E2E SMOKE LULUS — P2P, inventory, payment & GL terbukti balanced."
    echo "   Aman untuk deploy."
else
    echo "❌ E2E SMOKE GAGAL (exit=$CODE) — JANGAN deploy. Periksa output di atas."
fi
echo "==================================================================="
exit "$CODE"
