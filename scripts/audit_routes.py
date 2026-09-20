#!/usr/bin/env python3
"""Forensic route audit — dump all registered routes, detect duplicates & anomalies."""
import sys
from collections import Counter, defaultdict

sys.path.insert(0, "/app/backend")
from server import app  # noqa

routes = []
for r in app.routes:
    methods = getattr(r, "methods", None)
    path = getattr(r, "path", None)
    if path is None:
        continue
    for m in (methods or {"WS"}):
        routes.append((m, path))

# 1. Duplicate (method, path) pairs
counter = Counter(routes)
dups = {k: v for k, v in counter.items() if v > 1}

# 2. Same path+method but registered twice (true collision)
print(f"TOTAL ROUTES: {len(routes)}")
print(f"UNIQUE (method,path): {len(counter)}")

print("\n=== DUPLICATE (method,path) PAIRS ===")
if dups:
    for (m, p), c in sorted(dups.items()):
        print(f"  x{c}  {m:6} {p}")
else:
    print("  none")

# 3. API routes without /api prefix (excluding docs/openapi/root)
print("\n=== NON-/api ROUTES (excluding system) ===")
allow = ("/docs", "/openapi.json", "/redoc", "/", "/api")
non_api = sorted(set(p for m, p in routes if not p.startswith("/api") and not any(p == a or p.startswith(a + "/") for a in ("/docs", "/redoc", "/openapi")) and p not in ("/",)))
for p in non_api:
    print(f"  {p}")
if not non_api:
    print("  none")

# 4. Trailing slash routes
print("\n=== TRAILING-SLASH ROUTES (should be rejected by middleware) ===")
ts = sorted(set(p for m, p in routes if p.endswith("/") and p != "/" and len(p) > 1))
for p in ts:
    print(f"  {p}")
if not ts:
    print("  none")

# 5. Same path different cases of prefix collisions — group by path
print("\n=== PATHS SERVED BY MULTIPLE METHODS (info) ===")
by_path = defaultdict(set)
for m, p in routes:
    by_path[p].add(m)
multi = {p: ms for p, ms in by_path.items() if len(ms) > 3}
for p, ms in sorted(multi.items()):
    print(f"  {p}: {sorted(ms)}")
