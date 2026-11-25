"""Audit: frontend api.* literal paths vs backend registered routes."""
_REPO_ROOT = str(__import__("pathlib").Path(__file__).resolve().parents[1])  # root repo
import glob
import os
import re
import sys

os.environ.setdefault("SCHEDULER_ENABLED", "false")
sys.path.insert(0, (_REPO_ROOT + "/backend"))
os.chdir((_REPO_ROOT + "/backend"))
from dotenv import load_dotenv  # noqa: E402

load_dotenv((_REPO_ROOT + "/backend/.env"))
from server import app  # noqa: E402

routes = []
for r in app.routes:
    if hasattr(r, "methods") and r.methods:
        p = r.path[4:] if r.path.startswith("/api") else r.path
        rx = "^" + re.sub(r"\{[^}]+\}", "[^/]+", p) + "/?$"
        routes.append((re.compile(rx), {m for m in r.methods if m not in ("HEAD", "OPTIONS")}, r.path))

call_re = re.compile(r"""api\.(get|post|put|patch|delete)\(\s*["']([^"'?]+)["']""")
tmpl_re = re.compile(r"""api\.(get|post|put|patch|delete)\(\s*`([^`?]+)`""")
missing = []
checked = 0
for f in glob.glob((_REPO_ROOT + "/frontend/src/**/*.js*"), recursive=True):
    if "/tour/" in f or "/__" in f:
        continue
    src = open(f).read()
    calls = [(m, p) for m, p in call_re.findall(src)]
    for m, p in tmpl_re.findall(src):
        calls.append((m, re.sub(r"\$\{[^}]+\}", "X", p)))
    for m, p in calls:
        if not p.startswith("/"):
            continue
        p = p.split("?")[0].rstrip("/") or "/"
        checked += 1
        ok = any(rx.match(p) and m.upper() in ms for rx, ms, _ in routes)
        if not ok:
            path_only = any(rx.match(p) for rx, _, _ in routes)
            missing.append((f.replace((_REPO_ROOT + "/frontend/src/"), ""), m.upper(), p, "METHOD-MISMATCH" if path_only else "NO-ROUTE"))

print(f"checked {checked} frontend api calls; unmatched: {len(missing)}")
for row in sorted(set(missing)):
    print("  ", *row)
