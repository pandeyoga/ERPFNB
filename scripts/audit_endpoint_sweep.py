#!/usr/bin/env python3
"""Comprehensive GET-endpoint sweep — hit every GET route as admin, resolve path
params from real data, record status + emptiness + errors. No gaps left."""
import asyncio, re, sys
import httpx

sys.path.insert(0, "/app/backend")
from server import app  # noqa

API = open("/app/frontend/.env").read()
API = re.search(r"REACT_APP_BACKEND_URL=(\S+)", API).group(1).strip().rstrip("/")
ADMIN = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}


def get_routes():
    out = []
    for r in app.routes:
        methods = getattr(r, "methods", set()) or set()
        path = getattr(r, "path", "")
        if "GET" in methods and path.startswith("/api"):
            out.append(path)
    return sorted(set(out))


# Sample value resolvers for path params (filled at runtime from list endpoints)
SAMPLES = {}


def fill_path(path):
    """Replace {param} with sampled values; return None if cannot fill."""
    params = re.findall(r"\{([^}]+)\}", path)
    if not params:
        return path
    filled = path
    for p in params:
        key = p.lower()
        val = None
        # heuristics
        if "period" in key:
            val = "2026-04"
        elif key in SAMPLES:
            val = SAMPLES[key]
        else:
            # try generic id pools
            for k in ("id", "outlet_id", "vendor_id", "item_id", "employee_id"):
                if k in SAMPLES and (key.endswith("id") or key == k):
                    val = SAMPLES[k]
                    break
        if val is None and key.endswith("id") and "id" in SAMPLES:
            val = SAMPLES["id"]
        if val is None:
            return None
        filled = filled.replace("{" + p + "}", str(val))
    return filled


async def resolve_samples(client, headers):
    """Populate SAMPLES dict from key list endpoints."""
    async def first_id(path, field="id"):
        try:
            r = await client.get(API + path, headers=headers, timeout=20)
            if r.status_code != 200:
                return None
            d = r.json()
            data = d.get("data", d) if isinstance(d, dict) else d
            items = data.get("items", data) if isinstance(data, dict) else data
            if isinstance(items, list) and items:
                return items[0].get(field)
        except Exception:
            return None
        return None

    SAMPLES["id"] = await first_id("/api/finance/journal-entries")
    SAMPLES["outlet_id"] = await first_id("/api/master/outlets")
    SAMPLES["vendor_id"] = await first_id("/api/master/vendors")
    SAMPLES["item_id"] = await first_id("/api/master/items")
    SAMPLES["employee_id"] = await first_id("/api/hr/employees")
    SAMPLES["brand_id"] = await first_id("/api/master/brands")


def count_of(d):
    if isinstance(d, list):
        return len(d)
    if isinstance(d, dict):
        inner = d.get("data", d)
        if isinstance(inner, dict):
            for k in ("items", "rows", "results", "records"):
                if isinstance(inner.get(k), list):
                    return len(inner[k])
            if isinstance(inner, dict) and "total" in inner:
                return inner["total"]
        if isinstance(inner, list):
            return len(inner)
    return "obj"


async def main():
    routes = get_routes()
    async with httpx.AsyncClient(follow_redirects=False) as client:
        r = await client.post(API + "/api/auth/login", json=ADMIN, timeout=20)
        token = r.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        await resolve_samples(client, headers)

        results = {"ok": [], "empty": [], "err5xx": [], "err4xx": [], "skipped": []}
        for path in routes:
            filled = fill_path(path)
            if filled is None:
                results["skipped"].append(path)
                continue
            try:
                resp = await client.get(API + filled, headers=headers, timeout=30)
                sc = resp.status_code
                if sc >= 500:
                    results["err5xx"].append((path, sc, resp.text[:120]))
                elif sc in (400, 404, 422, 405):
                    results["err4xx"].append((path, sc))
                elif sc in (401, 403):
                    results["err4xx"].append((path, sc))
                else:
                    try:
                        c = count_of(resp.json())
                    except Exception:
                        c = "non-json"
                    if c == 0:
                        results["empty"].append((path, filled))
                    else:
                        results["ok"].append((path, c))
            except Exception as e:
                results["err5xx"].append((path, "EXC", str(e)[:120]))
            await asyncio.sleep(0.02)

    print(f"TOTAL GET ROUTES: {len(routes)}")
    print(f"  OK(data): {len(results['ok'])}  EMPTY: {len(results['empty'])}  5xx/EXC: {len(results['err5xx'])}  4xx: {len(results['err4xx'])}  SKIPPED(unresolvable param): {len(results['skipped'])}")

    print("\n=== 🔴 5xx / EXCEPTIONS (REAL BUGS) ===")
    for p, sc, msg in results["err5xx"]:
        print(f"  [{sc}] {p}\n        {msg}")
    if not results["err5xx"]:
        print("  none")

    print("\n=== 🟠 4xx (auth/validation — review) ===")
    for p, sc in results["err4xx"]:
        print(f"  [{sc}] {p}")
    if not results["err4xx"]:
        print("  none")

    print("\n=== 🟡 EMPTY (200 but 0 items — verify intended) ===")
    for p, f in results["empty"]:
        print(f"  {p}   (called: {f})")

    print("\n=== SKIPPED (could not resolve path param) ===")
    for p in results["skipped"]:
        print(f"  {p}")

    return results


if __name__ == "__main__":
    _res = asyncio.run(main())
    _strict = "--strict" in sys.argv
    if _strict and _res and _res["err5xx"]:
        print(f"\n❌ STRICT: {len(_res['err5xx'])} endpoint mengembalikan 5xx/exception — GATE GAGAL.")
        sys.exit(1)
    sys.exit(0)
