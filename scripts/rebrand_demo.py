#!/usr/bin/env python3
"""rebrand_demo.py — Samarkan brand klien menjadi demo generik "FnB Group".

Dijalankan SEKALI (idempotent) terhadap frontend/src, frontend/public, backend/*.py,
scripts, tests. Urutan penggantian penting: identifier kode dulu, lalu nama spesifik
(panjang), terakhir token generik. Kode brand (ALT/DLS/CAL/RKP/BKK) ikut diganti agar
email demo `{code}.manager@…` konsisten.

Pemetaan brand:
  Altero      (specialty coffee)      -> The Coffeeshop  CFS
  De La Sol   (latin & mediterranean) -> The Restaurant  RST
  Calluna     (european bistro)       -> The Bistro      BST
  Rucker Park (street food & bar)     -> The Lounge      LNG
  Bakkies     (artisan bakery)        -> The Bakery      BKY
"""
import os
import re
import sys

ROOT = "/app"
SCAN_DIRS = ["frontend/src", "frontend/public", "backend", "scripts", "tests"]
ROOT_FILES = ["backend_test.py", "phase3_backend_test.py", "README.md"]
EXTS = {".py", ".js", ".jsx", ".json", ".html", ".css", ".sh", ".md", ".txt", ".webmanifest", ".yml", ".yaml"}
SKIP_PARTS = {"node_modules", "__pycache__", ".git", "artifacts", "uploads", "build"}
SELF = os.path.abspath(__file__)

# (pattern, replacement, is_regex)
RULES = [
    # ── identifier / route / storage keys (harus konsisten lintas FE+BE) ──
    ("PLToradoReport", "PLGroupReport", False),
    ("pl_torado", "pl_group", False),
    ("pl-torado", "pl-group", False),
    ("profit_loss_torado_", "profit_loss_group_", False),
    ("torado_tour_", "fnb_tour_", False),
    ("torado_erp", "fnb_erp", False),
    ("torado123", "fnbgroup123", False),
    ("torado@2026", "fnb@2026", False),
    # ── nama perusahaan ──
    ("PT Torado Indonesia", "PT FnB Group Indonesia", False),
    ("Torado Rewards", "FnB Rewards", False),
    ("Torado ERP", "FnB Group ERP", False),
    ("Torado Group", "FnB Group", False),
    ("TORADO.ID", "FNBGROUP.ID", False),
    ("toradogroup", "fnbgroup", False),
    ("torado.id", "fnbgroup.id", False),
    ("Torado@2026", "Demo@2026", False),
    ("TORADO", "FNB GROUP", False),
    ("Torado", "FnB Group", False),
    ("torado", "fnbgroup", False),
    # ── nama produk lama "Aurora" (tampilan saja; class css/identifier lowercase dibiarkan) ──
    ("Aurora F&amp;B", "FnB Group", False),
    ("Aurora F&B ERP", "FnB Group ERP", False),
    ("Aurora F&B", "FnB Group", False),
    ("Aurora ERP", "FnB Group ERP", False),
    (r"\bAurora\b(?!Exception)", "FnB ERP", True),
    # ── brand: Altero -> The Coffeeshop (CFS) ──
    ("Altero", "The Coffeeshop", False),
    ("altero", "the-coffeeshop", False),
    ("alt.manager", "cfs.manager", False),
    (r"\bALT\b", "CFS", True),
    # ── brand: De La Sol -> The Restaurant (RST) ──
    ("De La Sol", "The Restaurant", False),
    ("DeLaSol", "TheRestaurant", False),
    ("de-la-sol", "the-restaurant", False),
    ("de_la_sol", "the_restaurant", False),
    ("dls.manager", "rst.manager", False),
    (r"\bDLS\b", "RST", True),
    # ── brand: Calluna -> The Bistro (BST) ──
    ("Calluna", "The Bistro", False),
    ("calluna", "the-bistro", False),
    ("cal.manager", "bst.manager", False),
    (r"\bCAL\b", "BST", True),
    # ── brand: Rucker Park -> The Lounge (LNG) ──
    ("Rucker Park", "The Lounge", False),
    ("RuckerPark", "TheLounge", False),
    ("rucker-park", "the-lounge", False),
    ("rucker_park", "the_lounge", False),
    ("rkp.manager", "lng.manager", False),
    (r"\bRKP\b", "LNG", True),
    # ── brand: Bakkies -> The Bakery (BKY) ──
    ("Bakkies", "The Bakery", False),
    ("bakkies", "the-bakery", False),
    ("bkk.manager", "bky.manager", False),
    (r"\bBKK\b", "BKY", True),
    # ── varian uppercase / singkatan sisa ──
    ("ALTERO", "THE COFFEESHOP", False),
    ("DE LA SOL", "THE RESTAURANT", False),
    ("de La Sol", "The Restaurant", False),
    ("CALLUNA", "THE BISTRO", False),
    ("RUCKER PARK", "THE LOUNGE", False),
    ("ruckerpark", "thelounge", False),
    ("Rucker", "Lounge", False),
    ("RUCKER", "LOUNGE", False),
    ("rucker", "lounge", False),
    ("BAKKIES", "THE BAKERY", False),
    # ── perbaikan pasca-ganti: identifier & object-key yang jadi tidak valid ──
    ("FNB GROUP_", "FNB_", False),
    (r"(?m)^(\s*)(the-(?:coffeeshop|restaurant|bistro|lounge|bakery)):", r'\1"\2":', True),
    (r"#The (Coffeeshop|Restaurant|Bistro|Lounge|Bakery)", r"#The\1", True),
]

RENAMES = [
    ("frontend/src/portals/reports/PLToradoReport.jsx", "frontend/src/portals/reports/PLGroupReport.jsx"),
    ("backend/services/_reports_excel_finance/pl_torado.py", "backend/services/_reports_excel_finance/pl_group.py"),
]


def iter_files():
    for d in SCAN_DIRS:
        base = os.path.join(ROOT, d)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [x for x in dirnames if x not in SKIP_PARTS]
            for fn in filenames:
                p = os.path.join(dirpath, fn)
                if os.path.abspath(p) == SELF:
                    continue
                if os.path.splitext(fn)[1] in EXTS:
                    yield p
    for f in ROOT_FILES:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            yield p


def apply(text):
    for pat, rep, is_re in RULES:
        text = re.sub(pat, rep, text) if is_re else text.replace(pat, rep)
    return text


def main():
    dry = "--dry" in sys.argv
    changed = 0
    for p in iter_files():
        try:
            with open(p, encoding="utf-8") as fh:
                src = fh.read()
        except (UnicodeDecodeError, OSError):
            continue
        out = apply(src)
        if out != src:
            changed += 1
            if not dry:
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(out)
            print(("[dry] " if dry else "[ok]  ") + os.path.relpath(p, ROOT))
    for a, b in RENAMES:
        pa, pb = os.path.join(ROOT, a), os.path.join(ROOT, b)
        if os.path.exists(pa) and not dry:
            os.rename(pa, pb)
            print(f"[mv]  {a} -> {b}")
    print(f"\n{changed} file(s) {'would be ' if dry else ''}changed.")


if __name__ == "__main__":
    main()
