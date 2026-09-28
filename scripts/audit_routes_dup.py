"""Audit: duplicate route registrations + param-route shadowing."""
import collections
import os
import sys

os.environ.setdefault("SCHEDULER_ENABLED", "false")
sys.path.insert(0, "/app/backend")
os.chdir("/app/backend")
from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")
from server import app  # noqa: E402

seen = collections.defaultdict(list)
for r in app.routes:
    if hasattr(r, "methods") and r.methods:
        for m in r.methods:
            if m in ("HEAD", "OPTIONS"):
                continue
            seen[(m, r.path)].append(f"{r.endpoint.__module__}.{r.endpoint.__name__}")
dups = {k: v for k, v in seen.items() if len(v) > 1}
print("== Duplicate route registrations (method+path) ==")
for k, v in sorted(dups.items()):
    print(" ", k, v)
print("total routes:", len([r for r in app.routes if hasattr(r, "methods")]), "duplicates:", len(dups))

print("== Param route shadows a later literal sibling ==")
paths = [(r.path, r.methods) for r in app.routes if hasattr(r, "methods")]
for i, (p, m) in enumerate(paths):
    if "{" in p.split("/")[-1]:
        prefix = "/".join(p.split("/")[:-1])
        for j, (q, n) in enumerate(paths):
            if j > i and q.startswith(prefix + "/") and "{" not in q and q.count("/") == p.count("/") and (m & n):
                print(f"  {p} [{','.join(sorted(m & n))}] shadows {q}")
