#!/usr/bin/env python3
"""
audit_tours.py — Detect drift between tour definitions and the current frontend.

Checks, code-first (verify don't assume):
  1. TARGET DRIFT: every tour step `target: "[data-testid='X']"` — does testid X
     still exist anywhere in frontend/src? (literal data-testid="X"/'X', testIds consts,
     or as a dynamic prefix `X-...`).
  2. ROUTE DRIFT: every tourMap pathToTours route — is it reachable in the app?
     (present in any navigationSchema or as a <Route path=...>).
  3. Orphans: registry tours never referenced by tourMap.

Output: per-tour list of MISSING targets, plus summary counts. Read-only.
"""
import re
import sys
from pathlib import Path

SRC = Path("/app/frontend/src")
TOURS_DIR = SRC / "contexts/tour/tours"

# ---- 1. Gather all data-testid values that exist in the codebase ----
testid_literal = set()
testid_prefixes = set()  # from rowTestIdPrefix="x" / testIdPrefix / `${prefix}-...`
all_text = {}
for p in SRC.rglob("*.js*"):
    try:
        txt = p.read_text()
    except Exception:
        continue
    all_text[p] = txt
    for m in re.finditer(r"""data-testid\s*=\s*[\"']([a-zA-Z0-9_\-:]+)[\"']""", txt):
        testid_literal.add(m.group(1))
    # template-literal testids: data-testid={`foo-${...`}  -> prefix "foo-"
    for m in re.finditer(r"""data-testid\s*=\s*\{`([a-zA-Z0-9_\-]+)-\$\{""", txt):
        testid_prefixes.add(m.group(1))
    # rowTestIdPrefix / testIdPrefix / prefix props
    for m in re.finditer(r"""(?:rowTestIdPrefix|testIdPrefix|rowTestId|idPrefix)\s*=\s*[\"']([a-zA-Z0-9_\-]+)[\"']""", txt):
        testid_prefixes.add(m.group(1))

# testIds constant files often define objects: KEY: "kebab-id"
for p in (SRC / "constants").rglob("*.js*") if (SRC / "constants").exists() else []:
    txt = all_text.get(p, "")
    for m in re.finditer(r""":\s*[\"']([a-z0-9][a-z0-9_\-]+)[\"']""", txt):
        testid_literal.add(m.group(1))


def testid_exists(tid: str) -> bool:
    if tid in testid_literal:
        return True
    # dynamic prefix match: tid like "po-row" but code emits `po-row-${id}` => prefix "po-row"
    for pre in testid_prefixes:
        if tid == pre or tid.startswith(pre + "-") or pre.startswith(tid + "-"):
            return True
    # also: some targets are a prefix of a literal (e.g. target 'kpi' but literal 'kpi-sales')
    for lit in testid_literal:
        if lit.startswith(tid + "-") or tid.startswith(lit + "-"):
            return True
    return False


# ---- 2. Parse tour step targets per file ----
# target value may be double-quoted (with single quotes inside) or single-quoted.
target_dq = re.compile(r'target:\s*"([^"]+)"')
target_sq = re.compile(r"target:\s*'([^']+)'")
testid_in_target = re.compile(r"\[data-testid=['\"]?([a-zA-Z0-9_\-:]+)['\"]?\]")

total_steps = 0
total_testid_targets = 0
missing = []  # (file, target, testid)
non_testid = set()

for f in sorted(TOURS_DIR.glob("*.js")):
    if f.name == "registry.js":
        continue
    txt = f.read_text()
    targets = [(m.group(1)) for m in target_dq.finditer(txt)] + [(m.group(1)) for m in target_sq.finditer(txt)]
    for tgt in targets:
        total_steps += 1
        tm = testid_in_target.search(tgt)
        if tm:
            total_testid_targets += 1
            tid = tm.group(1)
            if not testid_exists(tid):
                missing.append((f.name, tgt, tid))
        else:
            non_testid.add(tgt)

# ---- 3. Route drift: tourMap routes vs nav schema / routes ----
tourmap = (SRC / "contexts/tour/tourMap.js").read_text()
routes_in_map = re.findall(r"""[\"'](/[a-zA-Z0-9_\-/:]+)[\"']\s*:\s*\[""", tourmap)

# collect all known route paths from navigationSchema + portal route files
known_paths = set()
nav_dir = SRC / "lib/navigationSchema"
for p in (list(nav_dir.rglob("*.js")) if nav_dir.exists() else []) + list(SRC.rglob("*Portal*.js*")):
    txt = all_text.get(p, p.read_text() if p.exists() else "")
    for m in re.finditer(r"""(?:path|to|route)\s*[:=]\s*[\"'](/[a-zA-Z0-9_\-/:]+)[\"']""", txt):
        known_paths.add(m.group(1))
# also scan whole src for any path literal under portal namespaces
for p, txt in all_text.items():
    for m in re.finditer(r"""[\"'](/(?:outlet|admin|finance|inventory|procurement|hr|owner|executive)/[a-zA-Z0-9_\-/:]+)[\"']""", txt):
        known_paths.add(m.group(1))

def norm(path):
    return re.sub(r":[^/]+", ":p", path)

known_norm = {norm(p) for p in known_paths}
route_missing = []
for r in routes_in_map:
    # base portal landing like /outlet, /admin always exist
    if r.count("/") == 1:
        continue
    if norm(r) not in known_norm and r not in known_paths:
        route_missing.append(r)

# ---- Report ----
print("=" * 70)
print("  TOUR AUDIT — drift between tour defs and current frontend")
print("=" * 70)
print(f"  tour step targets total        : {total_steps}")
print(f"  ...of which data-testid targets: {total_testid_targets}")
print(f"  distinct data-testid in codebase: {len(testid_literal)} literal + {len(testid_prefixes)} prefixes")
print()
print(f"  [A] MISSING TARGETS (testid not found in code): {len(missing)}")
by_file = {}
for fn, tgt, tid in missing:
    by_file.setdefault(fn, []).append((tid, tgt))
for fn in sorted(by_file):
    print(f"   • {fn}  ({len(by_file[fn])} missing)")
    for tid, tgt in by_file[fn]:
        print(f"       - {tid}")
print()
print(f"  [B] ROUTE DRIFT (tourMap path not found in nav/routes): {len(route_missing)}")
for r in route_missing:
    print(f"       - {r}")
print()

# ---- STRICT pass: exact literal match only (surfaces rename/removal candidates) ----
strict_missing = {}
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
        if tid not in testid_literal:
            strict_missing.setdefault(f.name, []).append(tid)

n_strict = sum(len(v) for v in strict_missing.values())
print(f"  [A2] STRICT (exact literal) NOT-FOUND targets: {n_strict}")
print(f"       (dynamic/prefix testids may be legit — verify each)")
for fn in sorted(strict_missing):
    print(f"   • {fn}  ({len(strict_missing[fn])})")
    for tid in strict_missing[fn]:
        print(f"       - {tid}")
print()
print(f"  [C] non-testid targets (body/.class/#id) used: {len(non_testid)}")
for t in sorted(non_testid):
    print(f"       - {t}")
print()
print("=" * 70)
print(f"  RESULT: {len(missing)} missing-target steps across {len(by_file)} tour files; "
      f"{len(route_missing)} route-drift entries")
print("=" * 70)
sys.exit(0)
