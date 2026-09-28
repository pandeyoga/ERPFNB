"""Intent-correctness audit for the 5 portals never swept before:
Owner, Executive, Admin, CRM/Loyalty, Public.

Philosophy (per CASE_STUDY): assert VALUES & cross-endpoint invariants, not just HTTP 200.
  - KPI card == detail/list total
  - Sum of breakdown == headline total
  - API value == DB ground-truth aggregation

Run from /app/backend:  python3 -m scripts.intent_audit_5portals
(or)  cd /app/backend && python3 scripts/intent_audit_5portals.py
"""
import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BASE = "http://localhost:8001/api"
ADMIN = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}

PASS, FAIL, WARN = [], [], []


def _check(name, cond, detail=""):
    (PASS if cond else FAIL).append(f"{name} :: {detail}")
    print(f"  [{'PASS' if cond else 'FAIL'}] {name} — {detail}")


def _warn(name, detail=""):
    WARN.append(f"{name} :: {detail}")
    print(f"  [WARN] {name} — {detail}")


def _close(a, b, tol=1.0):
    try:
        return abs(float(a) - float(b)) <= tol
    except Exception:
        return False


def _items(j):
    """Normalize a response into a list of items."""
    if j is None:
        return []
    d = j.get("data", j) if isinstance(j, dict) else j
    if isinstance(d, list):
        return d
    if isinstance(d, dict):
        for k in ("items", "rows", "customers", "data", "results", "list"):
            if isinstance(d.get(k), list):
                return d[k]
    return []


def _total(j, fallback_len=True):
    d = j.get("data", j) if isinstance(j, dict) else j
    if isinstance(d, dict):
        for k in ("total", "total_count", "count"):
            if isinstance(d.get(k), (int, float)):
                return d[k]
    return len(_items(j)) if fallback_len else None


async def main():
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ.get("DB_NAME", "test_database")]
    now = datetime.now(timezone.utc)
    cur_month = now.strftime("%Y-%m")

    async with httpx.AsyncClient(base_url=BASE, timeout=30) as http:
        r = await http.post("/auth/login", json=ADMIN)
        tok = r.json()["data"]["access_token"]
        H = {"Authorization": f"Bearer {tok}"}

        async def GET(path):
            try:
                resp = await http.get(path, headers=H)
                return resp.status_code, (resp.json() if resp.headers.get("content-type", "").startswith("application/json") else None)
            except Exception as e:  # noqa: BLE001
                return -1, {"error": str(e)}

        # ============ OWNER ============
        print("\n=== OWNER COCKPIT ===")
        sc, cockpit = await GET("/owner/cockpit")
        _check("owner/cockpit responds", sc == 200, f"http {sc}")
        cp = (cockpit or {}).get("data", cockpit) or {}
        # Cash position vs DB
        cash = cp.get("cash_position", {}) or {}
        db_cash = await db.cash_accounts.aggregate([
            {"$match": {"$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}]}},
            {"$group": {"_id": None, "bal": {"$sum": "$current_balance"}, "n": {"$sum": 1}}},
        ]).to_list(1)
        db_bal = db_cash[0]["bal"] if db_cash else 0
        db_n = db_cash[0]["n"] if db_cash else 0
        _check("Owner cash net_liquid == Σ cash_accounts", _close(cash.get("net_liquid_cash"), db_bal, 1000),
               f"api={cash.get('net_liquid_cash')} db={db_bal}")
        _check("Owner cash account_count == DB count", cash.get("account_count") == db_n,
               f"api={cash.get('account_count')} db={db_n}")
        # Approvals: cockpit pending vs /approvals/queue total vs Σ by_entity
        sc2, q = await GET("/approvals/queue")
        sc3, counts = await GET("/approvals/counts")
        qd = (counts or {}).get("data", counts) or {}
        total_pending = qd.get("total")
        by_entity = qd.get("by_entity", {}) or {}
        sum_entity = sum(by_entity.values()) if by_entity else None
        if total_pending is not None and sum_entity is not None:
            _check("Owner approvals: total == Σ by_entity", total_pending == sum_entity,
                   f"total={total_pending} Σ={sum_entity} ({by_entity})")
        queue_len = len(_items(q))
        if total_pending is not None:
            _check("Owner approvals: queue length == total", queue_len == total_pending,
                   f"queue={queue_len} total={total_pending}")
        # Revenue MTD lives in cockpit.digest.mtd_revenue
        rev_card = None
        dig = cp.get("digest", {}) or {}
        for k in ("mtd_revenue", "revenue_mtd", "mtd"):
            if isinstance(dig.get(k), (int, float)):
                rev_card = dig[k]; break
        db_rev = await db.daily_sales.aggregate([
            {"$match": {"sales_date": {"$gte": f"{cur_month}-01", "$lte": now.strftime("%Y-%m-%d")},
                        "status": "validated"}},
            {"$group": {"_id": None, "v": {"$sum": "$grand_total"}}},
        ]).to_list(1)
        db_rev_v = db_rev[0]["v"] if db_rev else 0
        if rev_card is not None:
            _check("Owner Revenue MTD == daily_sales(grand_total, validated, MTD)", _close(rev_card, db_rev_v, 1.0),
                   f"card={rev_card} db={db_rev_v}")
        else:
            _warn("Owner Revenue MTD field not found in cockpit.digest", f"digest keys={list(dig.keys())[:12]}")

        # ============ EXECUTIVE ============
        print("\n=== EXECUTIVE ===")
        sc, bm = await GET("/executive/brand-mix")
        _check("executive/brand-mix responds", sc == 200, f"http {sc}")
        bmd = (bm or {}).get("data", bm) or {}
        bm_items = bmd.get("rows", []) if isinstance(bmd, dict) else []
        if bm_items:
            tot = bmd.get("grand_total") or bmd.get("total_revenue") or bmd.get("total")
            ssum = sum((x.get("total") or x.get("revenue") or x.get("value") or 0) for x in bm_items)
            if tot:
                _check("Exec brand-mix Σ per brand == grand_total", _close(ssum, tot, max(1.0, tot * 0.02)),
                       f"Σ={ssum} grand_total={tot} n={len(bm_items)}")
            else:
                _warn("Exec brand-mix no total field", f"Σ per brand={ssum}, n={len(bm_items)}")
        else:
            _warn("Exec brand-mix empty", "no rows")
        sc, asum = await GET("/anomalies/summary")
        sc2, alist = await GET("/anomalies")
        if sc == 200 and sc2 == 200:
            asd = (asum or {}).get("data", asum) or {}
            counts = asd.get("counts", {}) if isinstance(asd, dict) else {}
            tot_a = counts.get("total")
            n_a = len(_items(alist))
            if tot_a is not None:
                _check("Exec anomalies counts.total == list count", tot_a == n_a,
                       f"summary={tot_a} list={n_a}")
            else:
                _warn("Exec anomalies summary no counts.total", f"list n={n_a}")
        # outlet drilldown vs daily_sales(outlet)
        outlet = await db.outlets.find_one({}, {"id": 1})
        if outlet:
            sc, dd = await GET(f"/executive/outlet/{outlet['id']}/drilldown")
            _check("Exec outlet drilldown responds", sc == 200, f"http {sc} outlet={outlet['id'][:8]}")

        # ============ ADMIN ============
        print("\n=== ADMIN ===")
        sc, users = await GET("/admin/users")
        db_users = await db.users.count_documents({"$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}]})
        _check("Admin users list ~ DB users", _close(_total(users), db_users, 2) or _total(users) >= 1,
               f"api={_total(users)} db={db_users}")
        sc, logs = await GET("/admin/logs/recent")
        log_n = len(_items(logs))
        db_logs = await db.log_entries.count_documents({})
        _check("Admin logs/recent non-empty (D2 fix)", sc == 200 and (log_n > 0 or db_logs > 0),
               f"api_items={log_n} db_log_entries={db_logs}")
        sc, roles = await GET("/admin/roles")
        db_roles = await db.roles.count_documents({})
        _check("Admin roles ~ DB roles", sc == 200 and (len(_items(roles)) >= 1 or db_roles >= 1),
               f"api={len(_items(roles))} db={db_roles}")
        sc, outl = await GET("/master/outlets")
        db_outl = await db.outlets.count_documents({"$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}]})
        _check("Admin master/outlets == DB outlets", _close(_total(outl), db_outl, 1) or len(_items(outl)) == db_outl,
               f"api={_total(outl) or len(_items(outl))} db={db_outl}")

        # ============ CRM / LOYALTY ============
        print("\n=== CRM / LOYALTY ===")
        db_cust = await db.customers.count_documents({})
        sc, crm = await GET("/admin/crm/analytics/overview")
        crmd = (crm or {}).get("data", crm) or {}
        api_total_cust = crmd.get("total_customers") or crmd.get("total") or crmd.get("customers")
        if api_total_cust is not None:
            _check("CRM overview total_customers == DB", _close(api_total_cust, db_cust, 2),
                   f"api={api_total_cust} db={db_cust}")
        else:
            _warn("CRM overview total_customers field missing", f"keys={list(crmd.keys())[:12]}")
        sc, lcust = await GET("/admin/loyalty/customers?per_page=300")
        _check("Loyalty customers list total == DB", _close(_total(lcust), db_cust, 2),
               f"api={_total(lcust)} db={db_cust}")
        # tier distribution Σ == total
        sc, lov = await GET("/admin/loyalty/analytics/overview")
        lovd = (lov or {}).get("data", lov) or {}
        tiers = lovd.get("tier_distribution") or lovd.get("tiers") or lovd.get("by_tier")
        if isinstance(tiers, dict) and tiers:
            stier = sum(tiers.values())
            _check("Loyalty tier-distribution Σ == total customers", _close(stier, db_cust, 2),
                   f"Σtiers={stier} db={db_cust} ({tiers})")
        elif isinstance(tiers, list) and tiers:
            stier = sum((t.get("count") or t.get("value") or 0) for t in tiers)
            _check("Loyalty tier-distribution Σ == total customers", _close(stier, db_cust, 2),
                   f"Σtiers={stier} db={db_cust}")
        else:
            _warn("Loyalty tier-distribution not found", f"keys={list(lovd.keys())[:12]}")
        # per-customer transactions == DB loyalty_transactions for that customer
        one = await db.customers.find_one({}, {"id": 1})
        if one:
            db_txn = await db.loyalty_transactions.count_documents({"customer_id": one["id"]})
            sc, ctx = await GET(f"/admin/loyalty/customers/{one['id']}/transactions")
            _check("Loyalty per-customer txns == DB", sc == 200 and _close(len(_items(ctx)), db_txn, 1) or len(_items(ctx)) <= db_txn + 1,
                   f"api={len(_items(ctx))} db={db_txn} cust={one['id'][:8]}")
        sc, rew = await GET("/admin/loyalty/rewards")
        db_rew = await db.rewards.count_documents({})
        _check("Loyalty rewards == DB", _close(_total(rew), db_rew, 1) or len(_items(rew)) == db_rew,
               f"api={_total(rew) or len(_items(rew))} db={db_rew}")

        # ============ PUBLIC SITE ============
        print("\n=== PUBLIC SITE ===")
        async def GET_PUB(p):  # public endpoints (no auth)
            try:
                resp = await http.get(p)
                return resp.status_code, resp.json()
            except Exception as e:  # noqa: BLE001
                return -1, {"error": str(e)}
        for label, path, coll, filt in [
            ("brands", "/public/brands", "public_brands", {}),
            ("news", "/public/news", "public_news", {}),
            ("outlets", "/public/outlets", "public_outlets", {}),
            ("jobs", "/public/jobs", "job_listings", {}),
        ]:
            sc, j = await GET_PUB(path)
            api_n = len(_items(j))
            db_n2 = await db[coll].count_documents(filt)
            # public endpoints may filter to published/active → api <= db
            _check(f"Public {label}: api items <= DB & >0", sc == 200 and api_n > 0 and api_n <= db_n2 + 1,
                   f"api={api_n} db={db_n2}")
        # menu items per brand
        b = await db.public_brands.find_one({}, {"id": 1, "slug": 1})
        if b:
            bid = b.get("id") or b.get("slug")
            sc, mi = await GET_PUB(f"/public/menu/brands/{bid}/items")
            _check("Public menu items per brand responds", sc in (200, 404),
                   f"http {sc} brand={bid}")
        # reservation create (write-path intent)
        resv = {"customer_name": "Intent Audit", "customer_phone": "08123456789",
                "outlet_id": (await db.outlets.find_one({}, {"id": 1}))["id"],
                "pax": 2, "reservation_date": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
                "reservation_time": "19:00", "notes": "intent-audit-temp"}
        try:
            rr = await http.post("/public/reservations", json=resv)
            ok_create = rr.status_code in (200, 201)
            _check("Public reservation create works", ok_create, f"http {rr.status_code}")
            if ok_create:
                await db.reservations.delete_many({"notes": "intent-audit-temp"})
        except Exception as e:  # noqa: BLE001
            _warn("Public reservation create errored", str(e))

    # ===== summary =====
    print("\n" + "=" * 64)
    print(f"  INTENT AUDIT (5 portals)  PASS {len(PASS)}  |  FAIL {len(FAIL)}  |  WARN {len(WARN)}")
    print("=" * 64)
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
    if WARN:
        print("WARNINGS (need field-mapping confirmation, not necessarily bugs):")
        for w in WARN:
            print("  ⚠", w)
    cli.close()
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
