"""Generate routes.json (all <Route path> per portal + App.js) for the UI size crawler."""
import re, json
from pathlib import Path
HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / "frontend" / "src"
MOUNT = {
    "portals/executive/ExecutivePortal.jsx": "/executive",
    "portals/finance/FinancePortal.jsx": "/finance",
    "portals/HRPortal.jsx": "/hr",
    "portals/inventory/InventoryPortal.jsx": "/inventory",
    "portals/outlet/OutletPortal.jsx": "/outlet",
    "portals/owner/OwnerPortal.jsx": "/owner",
    "portals/procurement/ProcurementPortal.jsx": "/procurement",
    "portals/admin/AdminPortal.jsx": "/admin",
    "portals/ReportsPortal.jsx": "/reports",
}
# reports portal?
for f in SRC.rglob("*Portal*.jsx"):
    rel = str(f.relative_to(SRC))
    if rel not in MOUNT: print("unmapped portal file:", rel)
out = []
for f, pre in MOUNT.items():
    p = SRC / f
    if not p.exists(): print("missing", f); continue
    txt = p.read_text()
    for m in re.finditer(r'<Route\s+([^>]*?)/?>', txt, re.S):
        attrs = m.group(1)
        pm = re.search(r'path="([^"]+)"', attrs)
        if not pm: continue
        path = pm.group(1)
        if "Navigate" in attrs: continue
        full = pre if path in ("", "/") else (path if path.startswith("/") else f"{pre}/{path}")
        out.append({"route": full, "portal": pre, "src": f})
app = (SRC/"App.js").read_text()
for m in re.finditer(r'path="(/[^"]+)"', app):
    r = m.group(1)
    if r.endswith("/*") or r == "*" : continue
    out.append({"route": r, "portal": "app", "src": "App.js"})
seen=set(); uniq=[]
for o in out:
    if o["route"] in seen: continue
    seen.add(o["route"]); uniq.append(o)
json.dump(uniq, open(HERE / "routes.json", "w"), indent=1)
print(len(out), "routes,", len(uniq), "unique;", sum(1 for o in uniq if ":" in o["route"]), "parametrized")
