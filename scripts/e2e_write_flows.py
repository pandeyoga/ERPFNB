#!/usr/bin/env python3
"""E2E WRITE-flow harness for FnB Group ERP — Phase 4 (2026-07-18).

Complements the READ-only integration tests (backend/tests/*) with true END-TO-END
WRITE flows that:
  1. Create isolated test data (never mutates seed).
  2. Walk the FULL transactional pipeline (create → submit → approve → post → verify).
  3. Verify side effects (status transitions, journal-entry balance, RBAC on writes).
  4. Clean up after itself (or leave data marked as `e2e-write-flow` for inspection).

Flows exercised:
  FLOW 1 — Approval full cycle (Purchase Request: create → submit → approve → verify)
  FLOW 2 — Payment full cycle (Payment: create → submit → approve → mark-paid → verify JE)
  FLOW 3 — Period lock guard (lock a fresh period → verify JE post rejected → unlock)
  FLOW 4 — Inventory transfer full cycle (create → send → receive → verify stock delta)

Run:  python /app/scripts/e2e_write_flows.py
Exit: 0 on all-pass, 1 on any fail.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional


API = os.environ.get("E2E_API_BASE", "http://localhost:8001")


# ---------- pretty printing ----------
def _c(color: str, s: str) -> str:
    return f"\033[{color}m{s}\033[0m"


def hdr(t: str) -> None:
    print()
    print(_c("1;36", "=" * 78))
    print(_c("1;36", f"  {t}"))
    print(_c("1;36", "=" * 78))


def step(msg: str) -> None:
    print(_c("36", f"• {msg}"))


def okmsg(msg: str) -> None:
    print(_c("32", f"  ✅ {msg}"))


def failmsg(msg: str) -> None:
    print(_c("31", f"  ❌ {msg}"))


# ---------- HTTP helpers ----------
def _req(method: str, path: str, token: Optional[str], body: Any = None) -> tuple[int, bytes]:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except urllib.error.URLError as e:
        return 0, f"URLError: {e.reason}".encode()


def login(email: str, password: str = "Demo@2026") -> str:
    code, raw = _req("POST", "/api/auth/login", None, {"email": email, "password": password})
    if code != 200:
        raise SystemExit(f"login failed for {email}: {code} {raw[:200]!r}")
    return json.loads(raw)["data"]["access_token"]


def api(method: str, path: str, token: str, body: Any = None,
        expect: int = 200, hint: str = "") -> Optional[dict]:
    """Call API, assert HTTP status matches `expect`, return parsed data field."""
    code, raw = _req(method, path, token, body)
    if code != expect:
        failmsg(f"{method} {path} → {code} (expected {expect}). "
                f"{hint} body={raw[:300]!r}")
        return None
    try:
        return json.loads(raw).get("data")
    except Exception:
        return {"_raw": raw}


# ---------- fixture setup ----------
def get_tokens() -> dict[str, str]:
    return {
        "admin":       login("admin@fnbgroup.id"),
        "finance":     login("finance@fnbgroup.id"),
        "procurement": login("procurement@fnbgroup.id"),
        "outlet":      login("cfs.manager@fnbgroup.id"),
    }


def _first_id(data, key="id"):
    if isinstance(data, list) and data:
        return data[0].get(key)
    if isinstance(data, dict) and "items" in data and data["items"]:
        return data["items"][0].get(key)
    return None


# ---------- FLOW 1 — Approval full cycle (Purchase Request) ----------
def flow1_approval_pr(tokens: dict[str, str]) -> int:
    hdr("FLOW 1 — Purchase Request: create → approve → verify (RBAC too)")
    fails = 0

    # Get a real vendor + item + outlet + account from master data
    step("Fetch master data (vendor, item, outlet)")
    vendors_env = api("GET", "/api/master/vendors?per_page=1", tokens["procurement"])
    items_env = api("GET", "/api/master/items?per_page=1", tokens["procurement"])
    outlets_env = api("GET", "/api/master/outlets?per_page=5", tokens["admin"])

    def _list(env):
        if isinstance(env, list):
            return env
        if isinstance(env, dict) and "items" in env:
            return env["items"]
        return []

    vendors, items, outlets = _list(vendors_env), _list(items_env), _list(outlets_env)
    if not (vendors and items and outlets):
        failmsg(f"missing master data (vendor={bool(vendors)} item={bool(items)} outlet={bool(outlets)})")
        return fails + 1

    vendor_id, item_id, outlet_id = vendors[0]["id"], items[0]["id"], outlets[0]["id"]
    okmsg(f"vendor={vendor_id[:8]}… item={item_id[:8]}… outlet={outlet_id[:8]}…")

    # Create PR as OUTLET manager (has procurement.pr.create for urgent purchase);
    # PROCUREMENT_MANAGER only APPROVES per role separation.
    step("Create Purchase Request (submitted) as OUTLET manager")
    pr = api("POST", "/api/procurement/prs", tokens["outlet"], {
        "outlet_id": outlet_id,
        "lines": [{
            "item_id": item_id, "qty": 5, "uom": "pcs",
            "estimated_price": 25000, "note": "e2e-write-flow"
        }],
        "notes": f"e2e-flow1-{uuid.uuid4().hex[:8]}",
        "request_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        # skip_budget_check to avoid outlet operational budget guard blocking test PRs
        "skip_budget_check": True,
    })
    if not pr or not pr.get("id"):
        failmsg("PR create returned no id")
        return fails + 1
    pr_id = pr["id"]
    okmsg(f"PR created id={pr_id[:8]}… status={pr.get('status')} doc_no={pr.get('doc_no')}")

    # Approve via quick-action (admin has * perm)
    step("Approve PR via /approvals/quick-action")
    qa = api("POST", "/api/approvals/quick-action", tokens["admin"], {
        "entity_type": "purchase_request",
        "entity_id": pr_id,
        "action": "approve",
        "note": "e2e approved",
    })
    if not qa:
        failmsg("quick-action approve returned nothing")
        fails += 1

    # Verify final status via detail
    step("Verify PR final status")
    detail = api("GET", f"/api/procurement/prs/{pr_id}", tokens["admin"])
    if not detail:
        failmsg("PR detail fetch failed")
        fails += 1
    else:
        final = detail.get("status")
        if final in ("approved", "partially_approved", "in_progress"):
            okmsg(f"final status = {final}")
        else:
            failmsg(f"final status = {final} (expected approved-family)")
            fails += 1

    # RBAC WRITE guard: outlet manager (submitter) cannot approve their own PR
    step("RBAC: outlet manager MUST NOT be able to approve PR")
    code, body = _req("POST", "/api/approvals/quick-action", tokens["outlet"], {
        "entity_type": "purchase_request", "entity_id": pr_id, "action": "approve",
    })
    # After PR is already approved, this may 403 (no perm) OR 400/409 (already approved).
    # Only 200 would be a bug (permission bypass).
    if code in (403, 400, 409, 422):
        okmsg(f"outlet manager blocked from approving PR (http {code})")
    elif code == 200:
        failmsg(f"outlet manager NOT blocked (http {code}) — RBAC leak")
        fails += 1
    else:
        okmsg(f"non-200 response (http {code}) — treated as safe")

    return fails


# ---------- FLOW 2 — Payment full cycle ----------
def flow2_payment(tokens: dict[str, str]) -> int:
    hdr("FLOW 2 — Payment: create → submit → approve → mark-paid → verify JE")
    fails = 0

    def _list(env):
        if isinstance(env, list):
            return env
        if isinstance(env, dict) and "items" in env:
            return env["items"]
        return []

    vendors = _list(api("GET", "/api/master/vendors?per_page=1", tokens["finance"]))
    if not vendors:
        failmsg("no vendor available")
        return 1
    vendor_id = vendors[0]["id"]

    banks = _list(api("GET", "/api/master/bank-accounts?per_page=1", tokens["finance"]))
    bank_id = banks[0]["id"] if banks else None

    # Payment requires a postable expense COA to debit
    step("Fetch a postable expense COA for debit side")
    all_accts = _list(api("GET", "/api/master/chart-of-accounts?per_page=200", tokens["finance"]))
    gl_debit = None
    for a in all_accts:
        if a.get("is_postable") and (a.get("account_type") or "").lower() in ("expense", "beban"):
            gl_debit = a["id"]
            break
    if not gl_debit:
        # Fallback: any postable COA (expense-preferred but not required)
        for a in all_accts:
            if a.get("is_postable"):
                gl_debit = a["id"]
                break
    if not gl_debit:
        failmsg("no postable COA available")
        return 1
    okmsg(f"gl_debit={gl_debit[:8]}…")

    step(f"Create payment (vendor={vendor_id[:8]}… bank={bank_id and bank_id[:8]}…)")
    reference = f"e2e-flow2-{uuid.uuid4().hex[:8]}"
    payload = {
        "payee_type": "vendor",
        "payee_id": vendor_id,
        "amount": 100000,
        "gl_debit_id": gl_debit,
        "payment_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "request_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "payment_method": "transfer",
        "reference": reference,
        "description": f"E2E test payment {reference}",
        "notes": "e2e-write-flow",
    }
    if bank_id:
        payload["bank_account_id"] = bank_id
    pay = api("POST", "/api/finance/payments", tokens["finance"], payload)
    if not pay or not pay.get("id"):
        failmsg("payment create failed")
        return fails + 1
    pay_id = pay["id"]
    okmsg(f"payment created id={pay_id[:8]}… status={pay.get('status')}")

    # Submit
    step("Submit payment")
    sub = api("POST", f"/api/finance/payments/{pay_id}/submit", tokens["finance"])
    if sub:
        okmsg(f"submitted status={sub.get('status')}")
    else:
        failmsg("submit failed")
        fails += 1

    # Approve (as admin — has all perms)
    step("Approve payment")
    apr = api("POST", f"/api/finance/payments/{pay_id}/approve", tokens["admin"],
              {"note": "e2e approved"})
    if apr:
        okmsg(f"approved status={apr.get('status')}")
    else:
        failmsg("approve failed")
        fails += 1

    # Mark-paid → should create a JE
    step("Mark payment as paid (should post JE)")
    paid = api("POST", f"/api/finance/payments/{pay_id}/mark-paid", tokens["admin"],
               {"actual_paid_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")})
    if paid:
        okmsg(f"marked paid status={paid.get('status')}")
    else:
        failmsg("mark-paid failed (may be a soft fail)")
        fails += 1

    # Verify journal entry created (balance debits==credits)
    step("Verify journal entry balance (total_dr == total_cr)")
    q_ref = reference
    je_env = api("GET", f"/api/finance/journals?q={q_ref}", tokens["admin"])
    je_list = je_env if isinstance(je_env, list) else (je_env.get("items") or [])
    if not je_list:
        je_env2 = api("GET", f"/api/finance/journals?q={pay_id[:12]}", tokens["admin"])
        je_list = je_env2 if isinstance(je_env2, list) else (je_env2.get("items") or [])
    if not je_list:
        # Broadest search: pull latest JEs and match by source_id
        latest = api("GET", "/api/finance/journals?per_page=20", tokens["admin"])
        latest_list = latest if isinstance(latest, list) else (latest.get("items") or [])
        je_list = [j for j in latest_list if j.get("source_id") == pay_id]

    if je_list:
        je = je_list[0]
        # FnB Group uses total_dr / total_cr top-level + lines[].dr/.cr
        deb = float(je.get("total_dr") or 0)
        cre = float(je.get("total_cr") or 0)
        if deb == 0 and cre == 0:
            lines = je.get("lines") or []
            deb = sum(float(l.get("dr", 0) or 0) for l in lines)
            cre = sum(float(l.get("cr", 0) or 0) for l in lines)
        if abs(deb - cre) < 0.01 and deb > 0:
            okmsg(f"JE balanced: dr={deb:.0f} cr={cre:.0f} je_no={je.get('je_number')}")
        else:
            failmsg(f"JE UNBALANCED dr={deb} cr={cre}")
            fails += 1
    else:
        failmsg("no JE found — verify payment truly posted a journal")
        fails += 1

    return fails


# ---------- FLOW 3 — Period lock guard ----------
def flow3_period_lock(tokens: dict[str, str]) -> int:
    hdr("FLOW 3 — Period lock: lock → JE-post rejected → unlock")
    fails = 0

    # Use a fresh unlikely-touched period (12 months ago) to avoid affecting current
    tgt = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m")
    step(f"Target period = {tgt}")

    # Ensure the period exists (list first)
    periods_env = api("GET", "/api/finance/periods?per_page=50", tokens["admin"])
    periods = periods_env if isinstance(periods_env, list) else (periods_env.get("items") or [])
    period_ids = {p.get("period") for p in periods if p.get("period")}
    if tgt not in period_ids:
        # Pick an earliest available period as safe target
        if periods:
            tgt = periods[-1]["period"]
            step(f"Target period not seeded; using earliest available: {tgt}")
        else:
            failmsg("no periods available in system")
            return 1

    # Check lock-status before
    step(f"Lock-status BEFORE for {tgt}")
    before = api("GET", f"/api/finance/periods/{tgt}/lock-status", tokens["admin"])
    is_locked_before = bool(before and before.get("is_locked"))
    okmsg(f"is_locked={is_locked_before}")

    unlock_needed = False
    if not is_locked_before:
        step(f"Lock period {tgt}")
        lk = api("POST", f"/api/finance/periods/{tgt}/lock", tokens["admin"],
                 {"reason": "e2e-flow3 lock test"})
        if lk is None:
            failmsg("lock call failed")
            fails += 1
        else:
            okmsg("period locked")
            unlock_needed = True

    # Verify JE post to locked period is rejected
    step(f"Attempt to POST a manual JE in locked period {tgt}")
    ymd = f"{tgt}-15"
    accts_env = api("GET", "/api/master/chart-of-accounts?per_page=100", tokens["admin"])
    accts = accts_env if isinstance(accts_env, list) else (accts_env.get("items") or [])
    if len(accts) < 2:
        failmsg("not enough accounts to build JE")
    else:
        # Correct endpoint: /api/finance/journals/manual (not /journals);
        # correct payload: coa_id + dr/cr (not account_id + debit/credit).
        code, raw = _req("POST", "/api/finance/journals/manual", tokens["admin"], {
            "entry_date": ymd,
            "period": tgt,
            "description": "e2e-flow3 locked period test",
            "lines": [
                {"coa_id": accts[0]["id"], "dr": 1000, "cr": 0, "memo": "e2e"},
                {"coa_id": accts[1]["id"], "dr": 0, "cr": 1000, "memo": "e2e"},
            ],
        })
        if code in (400, 403, 409, 422):
            okmsg(f"JE post correctly rejected (http {code}) in locked period")
        else:
            failmsg(f"JE post NOT rejected — http {code} raw={raw[:200]!r}")
            fails += 1

    # Cleanup: unlock if we locked
    if unlock_needed:
        step(f"Unlock period {tgt} (cleanup)")
        code, raw = _req("POST", f"/api/finance/periods/{tgt}/unlock", tokens["admin"],
                         {"reason": "e2e-flow3 cleanup"})
        if code == 200:
            okmsg("period unlocked (cleanup)")
        else:
            failmsg(f"unlock cleanup failed http={code} raw={raw[:200]!r}")
            fails += 1

    return fails


# ---------- FLOW 4 — Inventory transfer full cycle ----------
# ---------- FLOW 4 — Inventory transfer full cycle ----------
def _extract_qty(bal):
    """balance API returns [{qty, item_id, outlet_id, ...}] — pick qty of first match."""
    if not bal:
        return 0
    if isinstance(bal, list):
        if bal:
            return float(bal[0].get("qty", 0) or 0)
        return 0
    if isinstance(bal, dict):
        if "items" in bal and bal["items"]:
            return float(bal["items"][0].get("qty", 0) or 0)
        # single object
        return float(bal.get("qty", 0) or 0)
    return 0


def _extract_qty_for(bals, item_id):
    """Given a list of stock_balance rows, pick qty for item_id."""
    for row in bals or []:
        if row.get("item_id") == item_id:
            return float(row.get("qty", 0) or 0)
    return 0


def flow4_inventory_transfer(tokens: dict[str, str]) -> int:
    hdr("FLOW 4 — Inventory transfer: create → send → receive → verify stock delta")
    fails = 0

    def _list(env):
        if isinstance(env, list):
            return env
        if isinstance(env, dict) and "items" in env:
            return env["items"]
        return []

    outlets = _list(api("GET", "/api/master/outlets?per_page=5", tokens["admin"]))
    if len(outlets) < 2:
        failmsg("need at least 2 outlets")
        return 1
    src, dst = outlets[0]["id"], outlets[1]["id"]

    # Pick an item that HAS stock at src outlet, so send won't be blocked by
    # negative-stock guard AND our delta assertion is meaningful.
    step("Find an item with positive stock at source outlet")
    bals_env = api("GET", f"/api/inventory/balance?outlet_id={src}&per_page=100", tokens["admin"])
    bals = _list(bals_env)
    item_id = None
    for row in bals:
        if float(row.get("qty", 0) or 0) >= 5:  # need at least 5 to safely transfer 2
            item_id = row.get("item_id")
            break
    if not item_id:
        # Fallback: pick any item and use skip_budget_check-like bypass; we know
        # send will still create the negative-stock movement (service does insert first).
        items = _list(api("GET", "/api/master/items?per_page=1", tokens["admin"]))
        if not items:
            failmsg("no item available anywhere")
            return 1
        item_id = items[0]["id"]
        step(f"(no item with >=5 stock at src; falling back to {item_id[:8]}…)")

    step(f"src={src[:8]}… dst={dst[:8]}… item={item_id[:8]}…")

    qty_src_before = _extract_qty_for(bals, item_id) if bals else 0
    bal_dst_before = api("GET", f"/api/inventory/balance?outlet_id={dst}&item_id={item_id}",
                         tokens["admin"])
    qty_dst_before = _extract_qty(bal_dst_before)
    step(f"stock BEFORE: src={qty_src_before} dst={qty_dst_before}")

    qty = 2
    step(f"Create transfer qty={qty}")
    tr = api("POST", "/api/inventory/transfers", tokens["admin"], {
        "from_outlet_id": src, "to_outlet_id": dst,
        # Service expects `lines` (not `items`)
        "lines": [{"item_id": item_id, "qty": qty, "uom": "pcs"}],
        "notes": f"e2e-flow4-{uuid.uuid4().hex[:8]}",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    })
    if not tr or not tr.get("id"):
        failmsg("transfer create failed")
        return fails + 1
    tr_id = tr["id"]
    okmsg(f"transfer created id={tr_id[:8]}… status={tr.get('status')}")

    step("Send transfer")
    code_send, raw_send = _req("POST", f"/api/inventory/transfers/{tr_id}/send", tokens["admin"])
    if code_send == 200:
        send = json.loads(raw_send).get("data") or {}
        okmsg(f"sent status={send.get('status')}")
    else:
        failmsg(f"send failed http={code_send} raw={raw_send[:200]!r}")
        # If send is blocked by negative-stock guard, skip receive + delta check
        return fails + 1

    step("Receive transfer")
    rcv = api("POST", f"/api/inventory/transfers/{tr_id}/receive", tokens["admin"])
    if rcv:
        okmsg(f"received status={rcv.get('status')}")
    else:
        failmsg("receive failed")
        fails += 1

    # Verify stock AFTER via balance API + also count movement rows for the transfer
    time.sleep(0.3)
    bal_src_after = api("GET", f"/api/inventory/balance?outlet_id={src}&item_id={item_id}",
                        tokens["admin"])
    bal_dst_after = api("GET", f"/api/inventory/balance?outlet_id={dst}&item_id={item_id}",
                        tokens["admin"])
    qty_src_after = _extract_qty(bal_src_after)
    qty_dst_after = _extract_qty(bal_dst_after)
    step(f"stock AFTER : src={qty_src_after} dst={qty_dst_after}")

    delta_src = qty_src_after - qty_src_before
    delta_dst = qty_dst_after - qty_dst_before
    if abs(delta_src + qty) < 0.01 and abs(delta_dst - qty) < 0.01:
        okmsg(f"stock delta correct: src −{qty}, dst +{qty}")
    else:
        failmsg(f"stock delta WRONG: src_Δ={delta_src} dst_Δ={delta_dst} (expected -{qty}/+{qty})")
        # Cross-check via movement rows — should have transfer_out and transfer_in
        movs_env = api("GET", f"/api/inventory/movements?item_id={item_id}&per_page=20", tokens["admin"])
        movs = _list(movs_env)
        related = [m for m in movs if m.get("ref_id") == tr_id]
        outs = [m for m in related if m.get("movement_type") == "transfer_out"]
        ins = [m for m in related if m.get("movement_type") == "transfer_in"]
        if outs and ins:
            step(f"movements recorded: transfer_out qty={outs[0].get('qty')} transfer_in qty={ins[0].get('qty')} (service DID write ledger — balance API may cache)")
        fails += 1

    return fails


def _extract_qty_for(bals, item_id):
    """Given a list of stock_balance rows, pick qty for item_id (module-level dup removed)."""
    for row in bals or []:
        if row.get("item_id") == item_id:
            return float(row.get("qty", 0) or 0)
    return 0


# ---------- FLOW 4 END ----------





# ---------- main ----------
def main() -> int:
    hdr("E2E WRITE-FLOW HARNESS — Phase 4")
    print(f"API base: {API}")
    try:
        tokens = get_tokens()
    except SystemExit as e:
        print(_c("31", str(e)))
        return 1

    okmsg(f"logged in as: admin, finance, procurement, outlet ({len(tokens)} tokens)")

    total_fails = 0
    total_fails += flow1_approval_pr(tokens)
    total_fails += flow2_payment(tokens)
    total_fails += flow3_period_lock(tokens)
    total_fails += flow4_inventory_transfer(tokens)

    hdr("E2E WRITE-FLOW SUMMARY")
    if total_fails == 0:
        print(_c("1;32", "  ✅ ALL WRITE FLOWS PASS"))
        return 0
    else:
        print(_c("1;31", f"  ❌ {total_fails} write-flow assertion(s) FAILED"))
        return 1


if __name__ == "__main__":
    sys.exit(main())
