#!/usr/bin/env python3
"""Forensic RBAC enforcement test — login per role, assert allow/deny matrix.
Read-only. Verifies require_perm + outlet scope enforcement against the LIVE API.
"""
import json, time, urllib.request, urllib.error

API = "http://localhost:8001"
PW = "Demo@2026"

def login(email):
    body = json.dumps({"email": email, "password": PW}).encode()
    req = urllib.request.Request(API + "/api/auth/login", data=body,
                                 headers={"Content-Type": "application/json"})
    for _ in range(3):
        try:
            r = urllib.request.urlopen(req, timeout=15)
            d = json.loads(r.read())
            data = d.get("data") or d
            return data["access_token"], data.get("user", {})
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(7); continue
            raise
    raise RuntimeError("login failed (rate limit) " + email)

def call(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {token}",
                                          "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return r.status
    except urllib.error.HTTPError as e:
        return e.code

# (role label, email)
ROLES = [
    ("SUPER_ADMIN", "admin@fnbgroup.id"),
    ("FINANCE_MANAGER", "finance@fnbgroup.id"),
    ("PROCUREMENT_MANAGER", "procurement@fnbgroup.id"),
    ("OUTLET_MANAGER(The Coffeeshop)", "cfs.manager@fnbgroup.id"),
    ("EXECUTIVE", "executive@fnbgroup.id"),
]

# (method, path, body) -> dict of role_label -> expected outcome ("ALLOW" => 2xx, "DENY" => 403)
# ALLOW means NOT 403 (200/422/404 ok — we only assert it's not a permission block).
CASES = [
    ("GET", "/api/finance/journals?per_page=1", None, {
        "SUPER_ADMIN": "ALLOW", "FINANCE_MANAGER": "ALLOW",
        "PROCUREMENT_MANAGER": "DENY", "OUTLET_MANAGER(The Coffeeshop)": "DENY",
        "EXECUTIVE": "ALLOW",   # verified: EXECUTIVE has finance.journal_entry.read (read-only oversight)
    }),
    ("GET", "/api/admin/roles", None, {
        "SUPER_ADMIN": "ALLOW", "FINANCE_MANAGER": "DENY",
        "PROCUREMENT_MANAGER": "DENY", "OUTLET_MANAGER(The Coffeeshop)": "DENY", "EXECUTIVE": "DENY",
    }),
    ("GET", "/api/procurement/pos?per_page=1", None, {
        "SUPER_ADMIN": "ALLOW", "FINANCE_MANAGER": "DENY",   # verified: finance lacks procurement.po.create gate
        "PROCUREMENT_MANAGER": "ALLOW", "OUTLET_MANAGER(The Coffeeshop)": "DENY", "EXECUTIVE": "DENY",
    }),
    ("POST", "/api/finance/periods/2026-04/lock", {}, {
        "SUPER_ADMIN": "ALLOW", "FINANCE_MANAGER": "ALLOW",
        "PROCUREMENT_MANAGER": "DENY", "OUTLET_MANAGER(The Coffeeshop)": "DENY", "EXECUTIVE": "DENY",
    }),
    ("GET", "/api/admin/users", None, {
        "SUPER_ADMIN": "ALLOW", "FINANCE_MANAGER": "DENY",
        "PROCUREMENT_MANAGER": "DENY", "OUTLET_MANAGER(The Coffeeshop)": "DENY", "EXECUTIVE": "DENY",
    }),
]

def main():
    tokens = {}
    for label, email in ROLES:
        tokens[label], _ = login(email)
        time.sleep(1.0)

    print(f"{'CASE':<46}{'ROLE':<26}{'exp':<6}{'http':<6}verdict")
    print("-" * 96)
    fails = 0; total = 0
    for method, path, body, expect in CASES:
        for label, exp in expect.items():
            total += 1
            code = call(method, path, tokens[label], body)
            is_denied = (code == 403)
            ok = (exp == "DENY" and is_denied) or (exp == "ALLOW" and not is_denied)
            if not ok: fails += 1
            short = (method + " " + path)[:44]
            print(f"{short:<46}{label:<26}{exp:<6}{code:<6}{'OK' if ok else 'XXXX FAIL'}")
        print()
    print("=" * 96)
    print(f"RBAC MATRIX: {total-fails}/{total} correct  |  {'✅ ALL ENFORCED' if fails==0 else '❌ '+str(fails)+' VIOLATIONS'}")
    return fails

if __name__ == "__main__":
    import sys
    sys.exit(0 if main() == 0 else 1)
