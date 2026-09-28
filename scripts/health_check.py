#!/usr/bin/env python3
"""
health_check.py — FnB Group ERP Automated Health Check
=====================================================
Verifikasi SEMUA endpoint kritis: cek isi (bukan hanya status 200).
Deteksi dini: tabel kosong, 404, 500, respons tidak sesuai ekspektasi.

Usage:
    cd /app
    python scripts/health_check.py

    # Atau dengan API URL eksplisit:
    REACT_APP_BACKEND_URL=https://... python scripts/health_check.py

Output:
    [PASS] /api/endpoint -> 10 items
    [WARN] /api/endpoint -> 0 items (empty — perlu seed?)
    [FAIL] /api/endpoint -> HTTP 500 (error)
    [FAIL] /api/endpoint -> parse error
"""

import asyncio
import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Load .env dari backend
env_path = Path(__file__).parent.parent / "frontend" / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            os.environ.setdefault("REACT_APP_BACKEND_URL", line.split("=", 1)[1].strip())

try:
    import httpx
except ImportError:
    print("Installing httpx...")
    os.system("pip install httpx -q")
    import httpx


API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not API:
    print("ERROR: REACT_APP_BACKEND_URL tidak ditemukan di frontend/.env")
    sys.exit(1)

# ── Kredensial default ─────────────────────────────────────────────────────
ADMIN_EMAIL = "admin@fnbgroup.id"
ADMIN_PASS = "Demo@2026"

# ── Warna terminal ─────────────────────────────────────────────────────────
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"


def color(text: str, c: str) -> str:
    return f"{c}{text}{RESET}"


# ── Daftar endpoint kritis yang diverifikasi ───────────────────────────────
# Format: (path, min_items_expected, description)
# min_items_expected = -1 → hanya cek status, tidak cek jumlah item
CRITICAL_ENDPOINTS = [
    # Auth
    ("/api/auth/me",                     -1,  "Auth: current user"),

    # Master data
    ("/api/master/brands",                1,  "Master: brands"),
    ("/api/master/outlets",               1,  "Master: outlets"),
    ("/api/master/items",                 1,  "Master: items"),
    ("/api/master/vendors",               0,  "Master: vendors"),
    ("/api/master/employees",             0,  "Master: employees"),
    ("/api/master/chart-of-accounts",     1,  "Master: CoA"),
    ("/api/master/payment-methods",       0,  "Master: payment methods"),
    ("/api/master/number-series",         1,  "SSOT: number_series [RC-5 guard]"),

    # Finance
    ("/api/finance/periods",              0,  "Finance: periods"),
    ("/api/finance/journal-entries",      0,  "Finance: journal entries"),
    ("/api/finance/ap-invoices",          0,  "Finance: AP invoices"),

    # Procurement
    ("/api/procurement/prs",              0,  "Procurement: purchase requests"),
    ("/api/procurement/pos",              0,  "Procurement: purchase orders"),
    ("/api/procurement/grs",              0,  "Procurement: goods receipts"),

    # Inventory
    ("/api/inventory/balance",            0,  "Inventory: stock balances"),
    ("/api/inventory/movements",          0,  "Inventory: stock movements"),

    # HR
    ("/api/hr/employees",                 0,  "HR: employees"),
    ("/api/hr/payroll",                   0,  "HR: payroll runs"),
    ("/api/hr/leaves",                    0,  "HR: leave requests"),

    # Executive / Analytics
    ("/api/executive/home",              -1,  "Executive: home dashboard"),
    ("/api/executive/kpi-summary",       -1,  "Executive: KPI summary"),
    ("/api/anomalies",                    0,  "Anomalies: events feed"),

    # System
    ("/api/admin/users",                  1,  "System: admin users"),
    ("/api/system-settings/list",        -1,  "System: settings list"),
]


def extract_count(data) -> int:
    """Hitung jumlah item dari berbagai bentuk respons (termasuk envelope FnB Group)."""
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        # Envelope FnB Group: {"success": true, "data": {"items": [...], "total": N}}
        if "data" in data and isinstance(data["data"], dict):
            inner = data["data"]
            for key in ("items", "data", "rows", "results", "records"):
                if key in inner and isinstance(inner[key], list):
                    return len(inner[key])
            if "total" in inner:
                return int(inner["total"])
        # Direct list keys
        for key in ("items", "data", "rows", "results", "records"):
            if key in data and isinstance(data[key], list):
                return len(data[key])
        if "total" in data:
            return int(data["total"])
    return -1


async def get_token(client: httpx.AsyncClient) -> str | None:
    """Login dan dapatkan access token."""
    try:
        r = await client.post(
            f"{API}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
            timeout=15,
        )
        if r.status_code == 200:
            d = r.json()
            # Coba berbagai bentuk respons login (envelope vs direct)
            token = (
                d.get("access_token")
                or d.get("token")
                or (d.get("data") or {}).get("access_token")
                or (d.get("data") or {}).get("token")
            )
            return token
        print(color(f"  LOGIN GAGAL: HTTP {r.status_code} — {r.text[:200]}", RED))
    except Exception as e:
        print(color(f"  LOGIN ERROR: {e}", RED))
    return None


async def check_endpoint(
    client: httpx.AsyncClient,
    token: str,
    path: str,
    min_items: int,
    desc: str,
) -> dict:
    """Cek satu endpoint dan kembalikan hasil."""
    headers = {"Authorization": f"Bearer {token}"}
    result = {
        "path": path,
        "desc": desc,
        "status": None,
        "count": None,
        "ok": False,
        "warning": False,
        "error": None,
    }

    try:
        r = await client.get(f"{API}{path}", headers=headers, timeout=15)
        result["status"] = r.status_code

        if r.status_code in (401, 403):
            result["error"] = f"Auth error: HTTP {r.status_code}"
            return result

        if r.status_code >= 500:
            result["error"] = f"Server error: HTTP {r.status_code} — {r.text[:100]}"
            return result

        if r.status_code == 404:
            result["error"] = f"Not Found: HTTP 404"
            return result

        if min_items == -1:
            # Hanya cek status
            result["ok"] = (r.status_code < 400)
            result["count"] = "N/A"
            return result

        # Parse dan hitung items
        try:
            data = r.json()
        except Exception:
            result["error"] = "Respons bukan JSON valid"
            return result

        count = extract_count(data)
        result["count"] = count

        if r.status_code >= 400:
            result["error"] = f"HTTP {r.status_code}"
        elif count == 0:
            result["ok"] = True
            result["warning"] = True  # Kosong — mungkin perlu seed
        elif count < min_items:
            result["ok"] = True
            result["warning"] = True
        else:
            result["ok"] = True

    except httpx.TimeoutException:
        result["error"] = "TIMEOUT (>15s)"
    except Exception as e:
        result["error"] = str(e)[:150]

    return result


async def run_health_check():
    print(f"\n{color('='*60, BOLD)}")
    print(color("  FNB GROUP ERP — HEALTH CHECK", BOLD + CYAN))
    print(f"  API: {API}")
    print(f"  Waktu: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(color('='*60, BOLD))

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # Login
        print(f"\n{color('[AUTH]', CYAN)} Login sebagai {ADMIN_EMAIL}...")
        token = await get_token(client)
        if not token:
            print(color("FATAL: Tidak bisa login. Hentikan health check.", RED))
            sys.exit(1)
        print(color("  ✓ Login berhasil", GREEN))

        # Sweep endpoints
        print(f"\n{color('[SWEEP]', CYAN)} Memeriksa {len(CRITICAL_ENDPOINTS)} endpoint...\n")

        results = []
        pass_count = warn_count = fail_count = 0

        for path, min_items, desc in CRITICAL_ENDPOINTS:
            r = await check_endpoint(client, token, path, min_items, desc)
            results.append(r)

            if r["error"]:
                fail_count += 1
                status_str = color(f"[FAIL]", RED)
                detail = color(r["error"], RED)
                print(f"  {status_str} {path:<45} {detail}")
                print(f"         {desc}")
            elif r["warning"]:
                warn_count += 1
                status_str = color(f"[WARN]", YELLOW)
                count_str = color(f"0 items", YELLOW)
                print(f"  {status_str} {path:<45} {count_str} — kosong (perlu seed?)")
                print(f"         {desc}")
            else:
                pass_count += 1
                status_str = color(f"[PASS]", GREEN)
                count_str = f"{r['count']} items" if r['count'] != "N/A" else "OK"
                print(f"  {status_str} {path:<45} {color(count_str, GREEN)}")

            # Jeda kecil agar tidak kena rate limit auth
            await asyncio.sleep(0.1)

    # Ringkasan
    total = len(CRITICAL_ENDPOINTS)
    print(f"\n{color('='*60, BOLD)}")
    print(color("  RINGKASAN", BOLD))
    print(f"  Total   : {total}")
    print(f"  {color('PASS', GREEN)}    : {pass_count}")
    print(f"  {color('WARN', YELLOW)} (kosong): {warn_count}")
    print(f"  {color('FAIL', RED)}    : {fail_count}")
    print(color('='*60, BOLD))

    if fail_count > 0:
        print(f"\n{color('ACTION REQUIRED:', RED + BOLD)}")
        print("  Ada endpoint FAIL — ini kemungkinan bug aktif.")
        print("  Jalankan: grep -rn 'db\\.' backend/routers/<router>.py | grep 'find'")
        print("  Lalu cek ENGINEERING_GUARDRAILS.md Bagian RC-1 sampai RC-3.")
    elif warn_count > 0:
        print(f"\n{color('INFO:', YELLOW)}")
        print("  Beberapa endpoint mengembalikan 0 items.")
        print("  Ini normal jika data belum di-seed. Jalankan seed jika diperlukan.")
    else:
        print(f"\n{color('SISTEM SEHAT', GREEN + BOLD)} — Semua endpoint responsif dengan data.")

    print()

    # Return exit code
    return 1 if fail_count > 0 else 0


if __name__ == "__main__":
    exit_code = asyncio.run(run_health_check())
    sys.exit(exit_code)
