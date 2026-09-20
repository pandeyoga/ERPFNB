#!/usr/bin/env python3
"""Inspect actual document structures for forensic accuracy."""
import asyncio, json, os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

# Read MONGO_URL + DB_NAME from backend/.env (NEVER hardcode DB — RC-1 / guardrails §10).
_env = Path("/app/backend/.env")
if _env.exists():
    for _ln in _env.read_text().splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

db = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[
    os.environ.get("DB_NAME", "test_database")
]


def show(label, doc):
    print(f"\n=== {label} ===")
    if not doc:
        print("  (none)")
        return
    doc.pop("_id", None)
    # truncate long
    s = json.dumps(doc, default=str, indent=2)
    print(s[:1600])


async def main():
    show("journal_entries sample", await db.journal_entries.find_one({}))
    show("number_series ALL", {"items": [s async for s in db.number_series.find({}, {"_id": 0})]})
    show("purchase_orders sample (po_no fields)", await db.purchase_orders.find_one({}, {"_id": 0, "po_no": 1, "doc_no": 1, "number": 1, "po_number": 1, "id": 1}))
    show("goods_receipts sample (gr_no fields)", await db.goods_receipts.find_one({}, {"_id": 0, "gr_no": 1, "doc_no": 1, "number": 1, "gr_number": 1, "id": 1}))
    show("accounting_periods sample", await db.accounting_periods.find_one({}, {"_id": 0}))
    # does periods collection exist?
    cols = await db.list_collection_names()
    print(f"\n'periods' collection exists: {'periods' in cols}")
    print(f"'accounting_periods' exists: {'accounting_periods' in cols}")

asyncio.run(main())
