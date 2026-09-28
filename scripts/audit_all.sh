#!/usr/bin/env bash
# audit_all.sh — Gate UI/UX + IA + Parity (READ-ONLY). Jalankan sebelum klaim "selesai".
# Pakai: bash /app/scripts/audit_all.sh   (tambah --strict untuk hard-fail)
set -uo pipefail
STRICT="${1:-}"
echo "================ 1) FRONTEND COMPILE CHECK (esbuild) ================"
cd /app/frontend && esbuild src/ --loader:.js=jsx --bundle --outfile=/dev/null 2>&1 | tail -5 || true
echo ""
echo "================ 2) BACKEND <-> FRONTEND PARITY ================"
python3 /app/scripts/audit_parity.py $STRICT
echo ""
echo "================ 3) UI DENSITY + INFORMATION ARCHITECTURE ================"
python3 /app/scripts/audit_ui_ia.py $STRICT
echo ""
echo "Selesai. Bandingkan hasil dengan /app/memory/UI_UX_AUDIT_2026-06-17.md & PARITY_AUDIT_2026-06-17.md"
