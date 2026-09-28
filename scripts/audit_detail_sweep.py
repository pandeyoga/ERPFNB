#!/usr/bin/env python3
"""Second-pass: resolve REAL ids for every domain, hit detail + param-required
endpoints. Catch hidden 500s the first sweep skipped."""
import asyncio, re
import httpx

API = re.search(r"REACT_APP_BACKEND_URL=(\S+)", open("/app/frontend/.env").read()).group(1).strip().rstrip("/")
ADMIN = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}


async def jget(c, h, path):
    try:
        r = await c.get(API + path, headers=h, timeout=25)
        if r.status_code != 200:
            return None, r.status_code
        return r.json(), 200
    except Exception:
        return None, "EXC"


def items_of(d):
    if isinstance(d, dict):
        data = d.get("data", d)
        if isinstance(data, dict):
            for k in ("items", "rows", "results"):
                if isinstance(data.get(k), list):
                    return data[k]
            return []
        if isinstance(data, list):
            return data
    return d if isinstance(d, list) else []


async def first(c, h, path, field="id"):
    d, sc = await jget(c, h, path)
    if not d:
        return None
    its = items_of(d)
    if its and isinstance(its[0], dict):
        return its[0].get(field)
    return None


async def main():
    async with httpx.AsyncClient() as c:
        r = await c.post(API + "/api/auth/login", json=ADMIN, timeout=20)
        h = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}

        # resolve ids
        ids = {}
        ids["po"] = await first(c, h, "/api/procurement/pos")
        ids["pr"] = await first(c, h, "/api/procurement/prs")
        ids["gr"] = await first(c, h, "/api/procurement/grs")
        ids["je"] = await first(c, h, "/api/finance/journal-entries")
        ids["ar_inv"] = await first(c, h, "/api/ar/invoices")
        ids["ar_cust"] = await first(c, h, "/api/ar/customers")
        ids["anomaly"] = await first(c, h, "/api/anomalies")
        ids["recon"] = await first(c, h, "/api/finance/bank-recon/sessions")
        ids["payrun"] = await first(c, h, "/api/finance/payment-runs")
        ids["payreq"] = await first(c, h, "/api/finance/payment-requests")
        ids["pay"] = await first(c, h, "/api/finance/payments")
        ids["emp"] = await first(c, h, "/api/hr/employees")
        ids["outlet"] = await first(c, h, "/api/master/outlets")
        ids["vendor"] = await first(c, h, "/api/master/vendors")
        ids["item"] = await first(c, h, "/api/master/items")
        ids["transfer"] = await first(c, h, "/api/inventory/transfers")
        ids["adj"] = await first(c, h, "/api/inventory/adjustments")
        ids["payroll"] = await first(c, h, "/api/hr/payroll")
        ids["tmpl"] = await first(c, h, "/api/finance/payment-run-templates")
        print("resolved ids:", {k: (v[:8] + '..' if v else None) for k, v in ids.items()})

        # endpoints to test: (path, label)
        tests = [
            (f"/api/procurement/pos/{ids['po']}", "PO detail"),
            (f"/api/procurement/pos/{ids['po']}/approval-state", "PO approval-state"),
            (f"/api/procurement/prs/{ids['pr']}", "PR detail"),
            (f"/api/procurement/prs/{ids['pr']}/approval-state", "PR approval-state"),
            (f"/api/procurement/grs/{ids['gr']}", "GR detail"),
            (f"/api/finance/journal-entries/{ids['je']}", "JE detail"),
            (f"/api/ar/invoices/{ids['ar_inv']}", "AR invoice detail"),
            (f"/api/ar/customers/{ids['ar_cust']}", "AR customer detail"),
            (f"/api/anomalies/{ids['anomaly']}", "Anomaly detail"),
            (f"/api/finance/bank-recon/sessions/{ids['recon']}", "Bank recon detail"),
            (f"/api/finance/payment-runs/{ids['payrun']}", "Payment run detail"),
            (f"/api/finance/payment-requests/{ids['payreq']}", "Payment request detail"),
            (f"/api/finance/payment-run-templates/{ids['tmpl']}", "PRN template detail"),
            (f"/api/inventory/transfers/{ids['transfer']}", "Transfer detail"),
            (f"/api/inventory/adjustments/{ids['adj']}/approval-state", "Adjustment approval"),
            (f"/api/hr/employees/{ids['emp']}", "Employee detail"),
            (f"/api/master/outlets/{ids['outlet']}", "Master outlet detail"),
            # param-required
            ("/api/budget/vs-actual?period=2026-04", "Budget vs-actual"),
            ("/api/ebupot/preview?period=2026-04", "Ebupot preview"),
            ("/api/efaktur/preview?period=2026-04", "Efaktur preview"),
            ("/api/ar/reconciliation?customer_id=" + (ids["ar_cust"] or ""), "AR reconciliation"),
            ("/api/ai/items/suggest?query=ayam", "AI items suggest"),
            (f"/api/forecasting/guard/source/daily_sales/{ids['outlet']}", "Forecast guard source"),
            (f"/api/preferences/presets/finance", "Preferences presets"),
            (f"/api/outlet/daily-sales/00000000-0000-0000-0000-000000000000", "Outlet daily-sales detail(fake)"),
        ]
        print("\n=== RESULTS ===")
        bugs = []
        for path, label in tests:
            if "None" in path:
                print(f"  [skip-noid] {label}")
                continue
            d, sc = await jget(c, h, path)
            tag = "OK" if sc == 200 else f"{sc}"
            if sc not in (200,):
                # 404/400 for fake ids is fine; 500/EXC is a bug
                if sc in (500, "EXC"):
                    bugs.append((label, path, sc))
                    tag = f"🔴 {sc}"
            print(f"  [{tag}] {label:32} {path[:70]}")
            await asyncio.sleep(0.03)

        print("\n=== 🔴 REAL BUGS (5xx/EXC) ===")
        for l, p, sc in bugs:
            print(f"  [{sc}] {l}  {p}")
        if not bugs:
            print("  none")

asyncio.run(main())
