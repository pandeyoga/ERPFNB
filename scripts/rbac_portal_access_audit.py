#!/usr/bin/env python3
"""Forensic: map every role -> which portal namespaces it can ENTER, and whether
that access is FULL or PARTIAL (partial = leak-risk if sub-routes aren't guarded).
Read-only. DB from .env.
"""
import os
from pathlib import Path
from collections import defaultdict

for ln in Path("/app/backend/.env").read_text().splitlines():
    if "=" in ln and not ln.strip().startswith("#"):
        k, v = ln.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
from pymongo import MongoClient

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

# Portal -> permPrefix (from App.js RequirePortal)
PORTALS = ["executive", "finance", "reports", "hr", "inventory",
           "outlet", "owner", "procurement", "admin"]

roles = list(db.roles.find({}))
# global set of perms per namespace (the "full" set = union across all roles)
ns_all = defaultdict(set)
for r in roles:
    for p in r.get("permissions", []):
        if p == "*":
            continue
        ns = p.split(".")[0]
        ns_all[ns].add(p)

print("=== PORTAL ENTRY MATRIX (role can enter portal if it has >=1 perm in namespace) ===\n")
for portal in PORTALS:
    full = ns_all.get(portal, set())
    entrants = []
    for r in roles:
        code = r.get("code") or r.get("name")
        if code == "SUPER_ADMIN":
            continue
        perms = set(r.get("permissions", []))
        if "*" in perms:
            continue
        myns = {p for p in perms if p.split(".")[0] == portal}
        if myns:
            ratio = f"{len(myns)}/{len(full)}"
            partial = len(myns) < len(full)
            entrants.append((code, ratio, partial, sorted(myns)))
    if not entrants:
        continue
    print(f"### /{portal}  (total distinct perms in namespace: {len(full)})")
    for code, ratio, partial, myns in entrants:
        flag = "  <-- PARTIAL (leak-risk if sub-routes unguarded)" if partial else "  (full)"
        # show the cross-namespace perms only if small list
        extra = ""
        if partial and len(myns) <= 6:
            extra = "  perms=" + ",".join(p.split(".", 1)[1] for p in myns)
        print(f"    {code:<24} {ratio:<8}{flag}{extra}")
    print()

# Highlight the most dangerous: a role whose namespace perms are a TINY subset (1-3)
# of a portal that is clearly NOT its home portal.
print("=== 🔴 CROSS-NAMESPACE GRANTS (role has 1-4 perms in a portal namespace = entered 'foreign' portal) ===\n")
for r in roles:
    code = r.get("code") or r.get("name")
    if code == "SUPER_ADMIN":
        continue
    perms = set(r.get("permissions", []))
    if "*" in perms:
        continue
    by_ns = defaultdict(list)
    for p in perms:
        by_ns[p.split(".")[0]].append(p)
    # the role's "home" namespace = the one with the most perms among PORTALS
    portal_ns = {ns: v for ns, v in by_ns.items() if ns in PORTALS}
    if not portal_ns:
        continue
    home = max(portal_ns, key=lambda n: len(portal_ns[n]))
    for ns, v in sorted(portal_ns.items()):
        if ns != home and len(v) <= 4:
            print(f"  {code:<24} home=/{home:<12} -> can ALSO enter /{ns:<11} via {len(v)} perm(s): {sorted(p.split('.',1)[1] for p in v)}")
