#!/usr/bin/env python3
"""
ux_audit.py — FnB Group ERP frontend usability auditor.

Enforces the UX Usability Standard (docs/UX_USABILITY_STANDARD.md) by scanning
React (.jsx) files for the usability baseline: tables must have loading/empty
states + tabular numbers; charts must use a styled tooltip + empty state; etc.

Usage:
    python3 scripts/ux_audit.py                 # full report + migration backlog
    python3 scripts/ux_audit.py --strict        # exit 1 if any ERROR found
    python3 scripts/ux_audit.py --files a.jsx b.jsx
    python3 scripts/ux_audit.py --json

Severities:
    ERROR  — blocks `finish` for NEW/touched files (hard usability gap)
    WARN   — technical debt (tracked as migration backlog)
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "src"
SCAN_DIRS = [SRC / "portals", SRC / "components"]

# ---- signal regexes -------------------------------------------------------
def has(pattern, text, flags=re.I):
    return re.search(pattern, text, flags) is not None

def detect(text: str) -> dict:
    is_chart = has(r'from\s+["\']recharts["\']', text)
    is_table = (
        has(r"<table[\s>]", text)
        or has(r"\bDataTable\b", text)
        or has(r"\bDataList\b", text)
        or has(r'@/components/ui/table', text)
    )
    return {
        "is_chart": is_chart,
        "is_table": is_table,
        "uses_datatable": has(r"\bDataTable\b", text),
        "uses_datalist": has(r"\bDataList\b", text),
        "raw_table": has(r"<table[\s>]", text),
        "loading": has(r"LoadingState|Skeleton|\bloading\b|isLoading", text),
        "empty": has(r"EmptyState|Belum ada|Tidak ada|ChartEmpty|\bempty\b", text),
        "tabular": has(r"tabular-nums", text),
        "money": has(r"\bfmtRp\b|formatCurrency|Rp\s", text),
        "sortable": has(r"sortable|setSort|sortBy|sortConfig|toggleSort|onSort", text),
        "sticky": has(r"sticky", text),
        "expand": has(r"renderExpanded|setExpand|expandedRow|useState\(.*[Ee]xpand", text),
        "pagination": has(r"per_page|setPage|hasMore|pagination", text),
        "tooltip": has(r"<Tooltip\b", text),
        "custom_tooltip": has(r"content=\{|GlassTooltip", text),
        "native_select": has(r"<select[\s>]", text, flags=0),
        "shadcn_select": has(r'@/components/ui/select', text),
        "rows_map": has(r"\.map\(", text),
    }

# ---- rules ----------------------------------------------------------------
def evaluate(rel: str, s: dict) -> list[tuple[str, str, str]]:
    """Return list of (severity, rule, message)."""
    out = []
    # Files built on the shared primitives inherit the baseline automatically.
    on_primitive = s["uses_datatable"] or s["uses_datalist"]
    renders_rows = s["rows_map"]
    # Form/dialog/detail line-item tables don't need a per-table fetch-loading
    # state (the parent form/page owns loading) → downgrade those to WARN.
    form_like = any(k in rel for k in (
        "Form", "Dialog", "Detail", "Steps", "Uploader", "Generator", "Panel", "Badge", "Wizard",
    ))
    sev = "WARN" if form_like else "ERROR"
    if s["is_table"]:
        # loading/empty only meaningful for files that actually render row lists.
        if renders_rows and not s["loading"]:
            out.append((sev, "table.loading", "Tabel tanpa loading/skeleton state"))
        if renders_rows and not s["empty"]:
            out.append((sev, "table.empty", "Tabel tanpa empty state"))
        # tabular-nums is enforced by DataTable/DataList; only flag raw tables.
        if s["money"] and not s["tabular"] and not on_primitive and s["raw_table"]:
            out.append(("ERROR", "table.tabular-nums", "Kolom uang tanpa tabular-nums (angka tidak rata)"))
        if s["raw_table"] and not on_primitive:
            out.append(("WARN", "table.use-datatable", "Pakai <table> mentah — migrasikan ke DataTable"))
        if s["pagination"] and not s["sortable"] and not s["uses_datatable"]:
            out.append(("WARN", "table.sortable", "Tabel list tanpa sort kolom"))
        if not s["sticky"] and s["raw_table"] and not s["uses_datatable"]:
            out.append(("WARN", "table.sticky-header", "Tabel panjang tanpa sticky header"))
    if s["is_chart"]:
        if s["tooltip"] and not s["custom_tooltip"]:
            out.append(("ERROR", "chart.tooltip", "Tooltip Recharts default — pakai GlassTooltip"))
        if not s["empty"]:
            out.append(("ERROR", "chart.empty", "Chart tanpa empty state (ChartEmpty)"))
    if s["native_select"]:
        out.append(("WARN", "form.select", "Pakai <select> native — gunakan shadcn Select"))
    return out

# ---- runner ---------------------------------------------------------------
def collect_files(explicit):
    if explicit:
        return [ (ROOT / f) if not Path(f).is_absolute() else Path(f) for f in explicit ]
    files = []
    for d in SCAN_DIRS:
        files.extend(sorted(d.rglob("*.jsx")))
    # Skip the shadcn/ui design-system layer — those are primitives, not screens.
    return [f for f in files if "/components/ui/" not in str(f).replace("\\", "/")]

def main():
    ap = argparse.ArgumentParser(description="FnB Group ERP UX usability auditor")
    ap.add_argument("--strict", action="store_true", help="exit 1 if any ERROR")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--files", nargs="*", help="audit only these files")
    args = ap.parse_args()

    files = collect_files(args.files)
    findings = []  # (severity, rel, rule, msg)
    counters = {}
    n_files = 0
    for f in files:
        if not f.exists():
            continue
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        n_files += 1
        rel = str(f.relative_to(ROOT))
        for sev, rule, msg in evaluate(rel, detect(text)):
            findings.append((sev, rel, rule, msg))
            counters[rule] = counters.get(rule, 0) + 1

    errors = [x for x in findings if x[0] == "ERROR"]
    warns = [x for x in findings if x[0] == "WARN"]

    if args.json:
        print(json.dumps({
            "files_scanned": n_files,
            "errors": len(errors), "warnings": len(warns),
            "by_rule": counters,
            "findings": [{"severity": s, "file": f, "rule": r, "message": m} for s, f, r, m in findings],
        }, indent=2))
    else:
        print(f"\n  FnB Group UX Audit — {n_files} berkas dipindai\n  {'='*52}")
        if errors:
            print(f"\n  ❌ ERROR ({len(errors)}) — wajib diperbaiki untuk berkas baru/tersentuh:")
            for s, f, r, m in errors:
                print(f"     [{r:<22}] {f}\n        → {m}")
        if warns:
            print(f"\n  ⚠️  WARN / Migration backlog ({len(warns)}):")
            for s, f, r, m in warns:
                print(f"     [{r:<22}] {f}")
        print(f"\n  {'='*52}\n  Ringkasan per-rule:")
        for rule, cnt in sorted(counters.items(), key=lambda x: -x[1]):
            print(f"     {cnt:>4}  {rule}")
        print(f"\n  TOTAL: {len(errors)} ERROR, {len(warns)} WARN  ({n_files} berkas)\n")

    if args.strict and errors:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
