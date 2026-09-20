#!/usr/bin/env python3
"""audit_routes_full.py — COMPLETE route inventory vs tour coverage.

Parses App.js (portal mount points + direct routes) and every portal router,
composes full absolute paths, classifies each, and resolves each path against
the real tourMap getToursForPath logic. Reports every REAL page that only gets
the generic 'general-navigation' fallback (i.e. not truly covered).
"""
import re
from pathlib import Path

SRC = Path("/app/frontend/src")
TOUR = SRC / "contexts/tour"

# ---- portal file -> mount prefix ----
MOUNT = {
    "portals/executive/ExecutivePortal.jsx": "/executive",
    "portals/finance/FinancePortal.jsx": "/finance",
    "portals/HRPortal.jsx": "/hr",
    "portals/inventory/InventoryPortal.jsx": "/inventory",
    "portals/outlet/OutletPortal.jsx": "/outlet",
    "portals/owner/OwnerPortal.jsx": "/owner",
    "portals/procurement/ProcurementPortal.jsx": "/procurement",
    "portals/admin/AdminPortal.jsx": "/admin",
}

route_re = re.compile(r'<Route\s+path="([^"]+)"([^>]*)>?')
nav_re = re.compile(r'Navigate\s+to=')

def routes_in(file):
    txt = (SRC / file).read_text()
    out = []
    for m in re.finditer(r'<Route\s+([^>]*?)/?>', txt, re.S):
        attrs = m.group(1)
        pm = re.search(r'path="([^"]+)"', attrs)
        if not pm:
            continue
        path = pm.group(1)
        is_nav = "Navigate" in attrs
        is_index = 'index' in attrs and 'path=' not in attrs
        out.append((path, is_nav))
    return out

full = {}   # absolute path -> {'nav':bool}
# portal sub-routes
for file, prefix in MOUNT.items():
    for path, is_nav in routes_in(file):
        if path in ("*", "/*"):
            continue
        if path.startswith("/"):
            ap = path
        else:
            ap = prefix + "/" + path if path else prefix
        ap = ap.rstrip("/") or prefix
        full[ap] = {"nav": is_nav}

# App.js direct routes (these SHADOW portal routes for same path)
app_txt = (SRC / "App.js").read_text()
for m in re.finditer(r'<Route\s+([^>]*?)/?>', app_txt, re.S):
    attrs = m.group(1)
    pm = re.search(r'path="(/[^"]+)"', attrs)
    if not pm:
        continue
    path = pm.group(1).rstrip("/")
    if path.endswith("/*") or path == "":
        continue
    full[path] = {"nav": "Navigate" in attrs, "app": True}

# ---- load tourMap resolution ----
tm = (TOUR / "tourMap.js").read_text()
block = tm[tm.index('const pathToTours = {'):tm.index('// TOUR METADATA')]
pmap = dict((p, re.findall(r'"([^"]+)"', v)) for p, v in re.findall(r'"(/[^"]*)":\s*\[([^\]]*)\]', block))

def resolve(path):
    if path in pmap:
        return pmap[path]
    for pat, ids in pmap.items():
        if ":" in pat and re.match("^" + re.sub(r":[^/]+", "[^/]+", pat) + "$", path):
            return ids
    return ["general-navigation"]

# ---- classify + report ----
real_uncovered = []
detail_uncovered = []
redirects = []
covered = 0
for path in sorted(full):
    info = full[path]
    if info.get("nav"):
        redirects.append(path)
        continue
    tours = resolve(path)
    is_detail = ":" in path
    if tours == ["general-navigation"]:
        (detail_uncovered if is_detail else real_uncovered).append(path)
    else:
        covered += 1

print("=" * 74)
print("  FULL ROUTE INVENTORY vs TOUR COVERAGE")
print("=" * 74)
print(f"  total distinct routes parsed : {len(full)}")
print(f"  redirects (<Navigate>)       : {len(redirects)}")
print(f"  covered by a specific tour   : {covered}")
print(f"  UNCOVERED real pages         : {len(real_uncovered)}")
print(f"  UNCOVERED :param/detail pages: {len(detail_uncovered)}")
print()
print("  >>> UNCOVERED REAL PAGES (only generic fallback):")
for p in real_uncovered:
    print("       -", p)
print()
print("  >>> UNCOVERED DETAIL/:param PAGES:")
for p in detail_uncovered:
    print("       -", p)
print()
print("  (redirects, for reference):")
for p in redirects:
    print("       ~", p)
