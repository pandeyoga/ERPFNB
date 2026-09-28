#!/usr/bin/env python3
"""Forensic: scan ALL backend router endpoints and classify their auth guard.
Flags endpoints that return data but have NO permission guard (only authenticated,
or fully public) — these are the real data-leak risk for partial-access roles.
Static analysis of routers/*.py.
"""
import re
from pathlib import Path

ROUTERS = Path("/app/backend/routers")
DECOR = re.compile(r'@router\.(get|post|put|patch|delete)\(\s*["\']([^"\']*)["\']')

# auth markers in the function signature/decorator block
PERM = re.compile(r'require_perm\(|require_any_perm\(')
ROLE = re.compile(r'require_role\(')
USER = re.compile(r'current_user|Depends\(get_current_user\)|user:\s*dict\s*=\s*Depends')

PUBLIC_OK_PREFIXES = ("/public", "/auth/login", "/auth/register", "/auth/refresh",
                      "/health", "/loyalty/login", "/loyalty/register", "/webhooks",
                      "/uploads")

results = {"perm": [], "role": [], "authonly": [], "public": []}

for f in sorted(ROUTERS.glob("*.py")):
    src = f.read_text()
    lines = src.splitlines()
    # build index of decorator line numbers
    for m in DECOR.finditer(src):
        method = m.group(1).upper()
        path = m.group(2)
        start = src[:m.start()].count("\n")
        # look at the decorator + the function def + its signature (next ~25 lines)
        block = "\n".join(lines[start:start + 28])
        # cut block at the function body start (first line after the def's closing paren colon)
        has_perm = bool(PERM.search(block))
        has_role = bool(ROLE.search(block))
        has_user = bool(USER.search(block))
        key = f"{method} {path}  [{f.name}]"
        if has_perm:
            results["perm"].append(key)
        elif has_role:
            results["role"].append(key)
        elif has_user:
            results["authonly"].append(key)
        else:
            results["public"].append(key)

tot = sum(len(v) for v in results.values())
print(f"=== ENDPOINT AUTH-GUARD COVERAGE ({tot} endpoints) ===")
print(f"  require_perm/any : {len(results['perm'])}")
print(f"  require_role     : {len(results['role'])}")
print(f"  authenticated-only (NO perm/role): {len(results['authonly'])}")
print(f"  public/no-auth   : {len(results['public'])}")

print("\n=== 🟠 AUTHENTICATED-ONLY endpoints (no perm gate) — review for sensitive data ===")
for k in results["authonly"]:
    print("  ", k)

print("\n=== 🔴 PUBLIC / NO-AUTH endpoints — must be intentionally public ===")
for k in results["public"]:
    flagged = "" if k.split()[1].startswith(PUBLIC_OK_PREFIXES) else "  <-- VERIFY (not an expected-public prefix)"
    print("  ", k, flagged)
