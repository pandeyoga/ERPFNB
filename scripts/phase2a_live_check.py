"""Phase 2a live check: GR cumulative PO status, AP settlement, voucher grand total."""
import json
import os
import sys
import uuid

import requests

API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/") + "/api"


def login(email):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "Demo@2026"}, timeout=30)
    d = r.json()["data"]
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


def unwrap(r):
    if r.status_code >= 400:
        print("  !!", r.status_code, r.text[:300])
        sys.exit(1)
    return r.json()["data"]


H = login("admin@fnbgroup.id")
vendor = unwrap(requests.get(f"{API}/master/vendors", headers=H, params={"per_page": 1}))[0]
outlet = unwrap(requests.get(f"{API}/master/outlets", headers=H, params={"per_page": 1}))[0]
item = unwrap(requests.get(f"{API}/master/items", headers=H, params={"per_page": 1}))[0]
bank = unwrap(requests.get(f"{API}/master/bank-accounts", headers=H, params={"per_page": 1}))[0]
coa = [c for c in unwrap(requests.get(f"{API}/master/coa", headers=H, params={"per_page": 500}))
       if c.get("is_postable", True) and str(c.get("code", "")).startswith("2")][0]

# 1) PO 100 pcs
po = unwrap(requests.post(f"{API}/procurement/pos", headers=H, json={
    "vendor_id": vendor["id"], "outlet_id": outlet["id"],
    "lines": [{"item_id": item["id"], "item_name": item["name"], "qty": 100, "unit_cost": 1000, "unit": "pcs"}],
}))
print("PO", po["doc_no"], po["status"])

# 2) GR #1 60 pcs → expect partial
gr1 = unwrap(requests.post(f"{API}/procurement/grs", headers=H, json={
    "po_id": po["id"], "vendor_id": vendor["id"], "outlet_id": outlet["id"],
    "lines": [{"item_id": item["id"], "item_name": item["name"], "qty_ordered": 100, "qty_received": 60, "unit_cost": 1000, "unit": "pcs"}],
}))
po_after1 = unwrap(requests.get(f"{API}/procurement/pos/{po['id']}", headers=H))
print("after GR1 (60):", po_after1["status"], "expect partial")

# 3) GR #2 40 pcs → expect received (A2 fix)
gr2 = unwrap(requests.post(f"{API}/procurement/grs", headers=H, json={
    "po_id": po["id"], "vendor_id": vendor["id"], "outlet_id": outlet["id"],
    "lines": [{"item_id": item["id"], "item_name": item["name"], "qty_ordered": 100, "qty_received": 40, "unit_cost": 1000, "unit": "pcs"}],
}))
po_after2 = unwrap(requests.get(f"{API}/procurement/pos/{po['id']}", headers=H))
print("after GR2 (40):", po_after2["status"], "expect received  ->", "OK" if po_after2["status"] == "received" else "FAIL")

# 4) Pay GR1 fully → ap_ledgers balance for gr1 should be 0 (A1 fix)
aging_before = unwrap(requests.get(f"{API}/finance/ap-aging", headers=H))["grand_total"] if requests.get(f"{API}/finance/ap-aging", headers=H).ok else None
pay = unwrap(requests.post(f"{API}/finance/payments", headers=H, json={
    "payee_type": "vendor", "payee_id": vendor["id"], "amount": gr1["grand_total"],
    "description": f"Pay {gr1['doc_no']}", "gl_debit_id": coa["id"], "bank_account_id": bank["id"], "gr_id": gr1["id"],
}))
unwrap(requests.post(f"{API}/finance/payments/{pay['id']}/submit", headers=H))
st = unwrap(requests.get(f"{API}/finance/payments/{pay['id']}", headers=H))["status"]
if st != "approved":
    unwrap(requests.post(f"{API}/finance/payments/{pay['id']}/approve", headers=H, json={}))
    st = unwrap(requests.get(f"{API}/finance/payments/{pay['id']}", headers=H))["status"]
print("payment status before mark-paid:", st)
unwrap(requests.post(f"{API}/finance/payments/{pay['id']}/mark-paid", headers=H, json={"bank_account_id": bank["id"], "payment_ref": "TEST"}))

sys.path.insert(0, "/app/backend")
os.chdir("/app/backend")
import asyncio
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient


async def check():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    ap = await db.ap_ledgers.find_one({"gr_id": gr1["id"]})
    gr = await db.goods_receipts.find_one({"id": gr1["id"]})
    print("GR1 paid_amount/payment_status:", gr.get("paid_amount"), gr.get("payment_status"))
    print("AP for GR1 balance/status:", ap.get("balance"), ap.get("status"), "->", "OK" if ap["balance"] == 0 and ap["status"] == "paid" else "FAIL")
    ap2 = await db.ap_ledgers.find_one({"gr_id": gr2["id"]})
    print("AP for GR2 (unpaid) balance:", ap2.get("balance"), "expect", gr2["grand_total"])
    # cleanup test docs
    for col, q in [("purchase_orders", {"id": po["id"]}), ("goods_receipts", {"id": {"$in": [gr1["id"], gr2["id"]]}}),
                   ("ap_ledgers", {"gr_id": {"$in": [gr1["id"], gr2["id"]]}}), ("inventory_movements", {"ref_id": {"$in": [gr1["id"], gr2["id"]]}}),
                   ("journal_entries", {"source_id": {"$in": [gr1["id"], gr2["id"], pay["id"]]}}), ("payment_requests", {"id": pay["id"]})]:
        await db[col].delete_many(q)
    print("cleanup done")

asyncio.run(check())

# 5) voucher grand total (A3) — pure function check
from services.outlet_service import _calc_grand_total
gt = _calc_grand_total({"revenue_buckets": [{"amount": 100000}], "service_charge": 5000, "tax_amount": 11000, "voucher_discount_amount": 20000})
print("grand_total with voucher 20k:", gt, "->", "OK" if gt == 96000 else "FAIL")
