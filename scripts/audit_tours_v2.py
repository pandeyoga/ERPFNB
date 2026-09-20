#!/usr/bin/env python3
"""audit_tours_v2.py — stricter, page-scoped tour drift + coverage gaps."""
import re
from pathlib import Path

SRC = Path("/app/frontend/src")
TOURS_DIR = SRC / "contexts/tour/tours"

# PURE data-testid literals only (no constants heuristic)
pure_testids = set()
file_text = {}
for p in SRC.rglob("*.js*"):
    try:
        t = p.read_text()
    except Exception:
        continue
    file_text[p] = t
    for m in re.finditer(r"""data-testid\s*=\s*[\"']([a-zA-Z0-9_\-:]+)[\"']""", t):
        pure_testids.add(m.group(1))

# dynamic prefixes (template literal / prefix props)
prefixes = set()
for p, t in file_text.items():
    for m in re.finditer(r"""data-testid\s*=\s*\{`([a-zA-Z0-9_\-]+)-\$\{""", t):
        prefixes.add(m.group(1))
    for m in re.finditer(r"""(?:rowTestIdPrefix|testIdPrefix|rowTestId|idPrefix|prefix)\s*=\s*[\"']([a-zA-Z0-9_\-]+)[\"']""", t):
        prefixes.add(m.group(1))

def exists(tid):
    if tid in pure_testids:
        return "exact"
    for pre in prefixes:
        if tid == pre or tid.startswith(pre + "-"):
            return "prefix"
    return None

target_dq = re.compile(r'target:\s*"([^"]+)"')
target_sq = re.compile(r"target:\s*'([^']+)'")
testid_in_target = re.compile(r"\[data-testid=['\"]?([a-zA-Z0-9_\-:]+)['\"]?\]")

print("=" * 72)
print("  TOUR AUDIT v2 — pure data-testid match + coverage")
print("=" * 72)
print(f"  pure data-testid literals: {len(pure_testids)} | dynamic prefixes: {len(prefixes)}")
print()

exact = prefix = missing = 0
miss_list = {}
for f in sorted(TOURS_DIR.glob("*.js")):
    if f.name == "registry.js":
        continue
    txt = f.read_text()
    targets = [m.group(1) for m in target_dq.finditer(txt)] + [m.group(1) for m in target_sq.finditer(txt)]
    for tgt in targets:
        tm = testid_in_target.search(tgt)
        if not tm:
            continue
        tid = tm.group(1)
        r = exists(tid)
        if r == "exact":
            exact += 1
        elif r == "prefix":
            prefix += 1
        else:
            missing += 1
            miss_list.setdefault(f.name, []).append(tid)

print(f"  target resolution: exact={exact}  prefix-only={prefix}  MISSING={missing}")
print()
if miss_list:
    print("  >>> MISSING (no exact, no prefix) — likely STALE targets:")
    for fn in sorted(miss_list):
        print(f"   • {fn} ({len(miss_list[fn])}):")
        for tid in miss_list[fn]:
            print(f"       - {tid}")
else:
    print("  (no fully-missing targets)")
print()

# ---- COVERAGE: nav routes (navigationSchema) without a tour ----
nav_dir = SRC / "lib/navigationSchema"
nav_routes = set()
for p in (nav_dir.rglob("*.js") if nav_dir.exists() else []):
    t = file_text.get(p, "")
    for m in re.finditer(r"""(?:path|to|route)\s*[:=]\s*[\"'](/[a-zA-Z0-9_\-/]+)[\"']""", t):
        nav_routes.add(m.group(1))

tourmap = (SRC / "contexts/tour/tourMap.js").read_text()
mapped = set(re.findall(r"""[\"'](/[a-zA-Z0-9_\-/:]+)[\"']\s*:\s*\[""", tourmap))
def n(p): return re.sub(r":[^/]+", ":p", p)
mapped_n = {n(x) for x in mapped}

uncovered = sorted(r for r in nav_routes if n(r) not in mapped_n and r not in mapped)
print(f"  [COVERAGE] nav routes WITHOUT a tour mapping: {len(uncovered)} / {len(nav_routes)} nav routes")
for r in uncovered:
    print(f"       - {r}")
print()
print("=" * 72)
