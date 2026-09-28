"""
seed_transactions.py — Seeds realistic transaction data per outlet for richer dashboards.
...
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

from core.db import init_db, close_db, get_db

def uid() -> str:
    return str(uuid.uuid4())

def doc(d: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": uid(),
        "created_at": now,
        "updated_at": now,
        "created_by": None,
        "updated_by": None,
        "deleted_at": None,
        **d,
    }

def days_ago(n: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=n)

def jakiso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

# ── Brand revenue profiles (avg daily revenue per outlet in that brand) ──────
BRAND_PROFILES = {
    "THE COFFEESHOP":       {"avg_revenue": 12_000_000, "std": 2_000_000, "covers": (80, 160)},
    "DE_LA_SOL":    {"avg_revenue": 9_500_000,  "std": 1_500_000, "covers": (60, 130)},
    "THE BISTRO":      {"avg_revenue": 7_000_000,  "std": 1_200_000, "covers": (50, 100)},
    "LOUNGE_PARK":  {"avg_revenue": 8_500_000,  "std": 1_800_000, "covers": (70, 150)},
    "THE BAKERY":      {"avg_revenue": 6_000_000,  "std": 900_000,   "covers": (40, 90)},
}

# Payment method mix
PAYMENT_MIX = [
    ("cash", 0.30),
    ("card", 0.25),
    ("qris", 0.30),
    ("transfer", 0.10),
    ("voucher", 0.05),
]

async def seed_transactions():
    await init_db()
    db = get_db()

    # ── Load master data ──────────────────────────────────────────────────────
    outlets = await db.outlets.find({"deleted_at": None}).to_list(100)
    brands  = await db.brands.find({"deleted_at": None}).to_list(100)
    items   = await db.items.find({"deleted_at": None}).to_list(100)
    users   = await db.users.find({"deleted_at": None}).to_list(100)
    payment_methods = await db.payment_methods.find({"deleted_at": None}).to_list(100)

    if not outlets:
        print("ERROR: No outlets found. Run seed_demo.py first.")
        await close_db()
        return

    brand_map    = {b["id"]: b for b in brands}
    outlet_brand = {o["id"]: o.get("brand_id", "") for o in outlets}

    # Map brand code → profile
    brand_code_map = {b["code"].upper(): b["id"] for b in brands}
    
    def get_profile(outlet_id: str) -> dict:
        bid = outlet_brand.get(outlet_id, "")
        brand = brand_map.get(bid)
        if brand:
            code = brand.get("code", "").upper()
            return BRAND_PROFILES.get(code, BRAND_PROFILES["THE BISTRO"])
        return BRAND_PROFILES["THE BISTRO"]

    pm_ids = [p["id"] for p in payment_methods]
    pm_names = {p["id"]: p["name"] for p in payment_methods}
    if not pm_ids:
        pm_ids = ["cash-pm"]
        pm_names = {"cash-pm": "Cash"}

    item_ids = [i["id"] for i in items[:10]]  # use first 10 items

    # ── 1. Daily Sales (60 days) ─────────────────────────────────────────────
    print(f"\nSeeding Daily Sales for {len(outlets)} outlets × 60 days…")
    ds_count = 0
    ds_docs = []
    for outlet in outlets:
        oid = outlet["id"]
        profile = get_profile(oid)
        manager = next((u for u in users if oid in (u.get("outlet_ids") or [])), None)
        manager_id = manager["id"] if manager else None

        for day in range(60):
            dt = days_ago(day)
            date_str = jakiso(dt)

            # Skip ~15% of days (closed / no data)
            if random.random() < 0.08 and day > 0:
                continue

            # Weekend boost
            weekday = dt.weekday()
            multiplier = 1.3 if weekday >= 5 else 1.0

            revenue = max(0, random.gauss(
                profile["avg_revenue"] * multiplier,
                profile["std"]
            ))
            covers = random.randint(*profile["covers"])
            avg_check = revenue / max(covers, 1)

            # Break down payment
            payment_breakdown = []
            remaining = revenue
            for pm_name, share in PAYMENT_MIX:
                pm_id = pm_ids[random.randint(0, len(pm_ids) - 1)]
                amount = revenue * share * random.uniform(0.8, 1.2)
                amount = min(amount, remaining)
                if amount > 0:
                    payment_breakdown.append({
                        "payment_method_id": pm_id,
                        "payment_method_name": pm_names.get(pm_id, pm_name),
                        "amount": round(amount),
                    })
                    remaining -= amount
            # Put remainder in first payment
            if payment_breakdown:
                payment_breakdown[0]["amount"] = round(
                    payment_breakdown[0]["amount"] + remaining
                )

            # Revenue buckets (F&B split)
            food_pct   = random.uniform(0.55, 0.70)
            bev_pct    = random.uniform(0.20, 0.30)
            other_pct  = 1 - food_pct - bev_pct
            revenue_buckets = [
                {"label": "Food",      "amount": round(revenue * food_pct)},
                {"label": "Beverage",  "amount": round(revenue * bev_pct)},
                {"label": "Other",     "amount": round(revenue * other_pct)},
            ]

            cogs = revenue * random.uniform(0.28, 0.35)
            gross_profit = revenue - cogs
            opex = revenue * random.uniform(0.18, 0.25)
            net_profit = gross_profit - opex

            ds_docs.append(doc({
                "outlet_id": oid,
                "date": date_str,          # keep legacy field
                "sales_date": date_str,    # ← field expected by executive_service
                "status": "validated",     # ← status expected by executive_service
                "grand_total": round(revenue),       # ← field for sales trend
                "total_revenue": round(revenue),     # keep legacy field
                "transaction_count": covers,         # ← for trx count in trend
                "total_covers": covers,
                "avg_check_per_cover": round(avg_check),
                "revenue_buckets": revenue_buckets,
                "payment_breakdown": payment_breakdown,
                "service_charge": round(revenue * 0.05),
                "cogs": round(cogs),
                "gross_profit": round(gross_profit),
                "opex": round(opex),
                "net_profit": round(net_profit),
                "shift": "all",
                "cashier_id": manager_id,
                "notes": "",
                "submitted_at": dt.isoformat(),
                "submitted_by": manager_id,
                "approved_at": dt.isoformat(),
                "approved_by": manager_id,
            }))
            ds_count += 1

    if ds_docs:
        # Remove duplicates (by outlet+date) in case script is re-run
        # Clear existing seeded docs first so re-runs work cleanly
        await db.daily_sales.delete_many({"shift": "all", "cashier_id": {"$ne": None}})
        for d_doc in ds_docs:
            await db.daily_sales.update_one(
                {"outlet_id": d_doc["outlet_id"], "sales_date": d_doc["sales_date"], "deleted_at": None},
                {"$setOnInsert": d_doc},
                upsert=True
            )
    print(f"  → {ds_count} Daily Sales records seeded.")

    # ── 2. KDO / BDO orders per outlet ──────────────────────────────────────
    print("Seeding KDO/BDO orders…")
    kdo_count = 0
    kdo_docs = []
    statuses = ["pending", "submitted", "approved", "ordered", "received"]
    for outlet in outlets:
        oid = outlet["id"]
        for i in range(6):
            day = random.randint(0, 45)
            dt = days_ago(day)
            status = random.choice(statuses)
            lines = []
            for item_id in random.sample(item_ids or [uid()], min(3, len(item_ids or [uid()]))):
                qty = random.randint(2, 20)
                price = random.randint(15_000, 120_000)
                lines.append({
                    "item_id": item_id,
                    "qty": qty,
                    "unit": "pcs",
                    "unit_price": price,
                    "subtotal": qty * price,
                    "notes": "",
                })
            total = sum(l["subtotal"] for l in lines)
            kind = random.choice(["kdo", "bdo"])
            doc_no = f"{kind.upper()}-{outlet['code'][:3]}-{dt.strftime('%y%m%d')}-{i+1:02d}"
            kdo_docs.append(doc({
                "doc_no": doc_no,
                "kind": kind,
                "outlet_id": oid,
                "req_date": jakiso(dt),
                "status": status,
                "lines": lines,
                "total_amount": total,
                "notes": "",
                "requested_by": None,
            }))
            kdo_count += 1

    if kdo_docs:
        await db.kdo_bdo_orders.insert_many(kdo_docs)
    print(f"  → {kdo_count} KDO/BDO orders seeded.")

    # ── 3. Petty Cash per outlet ─────────────────────────────────────────────
    # CANONICAL collection is `petty_cash_transactions` (read by outlet_service,
    # daily_close, exec-drilldown, and /api/outlet/home). Schema fields:
    #   txn_date, type (purchase|replenish|adjustment), amount(+), status="posted",
    #   balance_after (running). Balance = sum(replenish/adjustment) - sum(purchase).
    print("Seeding Petty Cash transactions (petty_cash_transactions)…")
    # Idempotent: clear previous petty-cash data (canonical + legacy collection)
    await db.petty_cash_transactions.delete_many({})
    await db.petty_cash.delete_many({})
    pc_count = 0
    pc_docs = []
    pc_expense_desc = [
        "Beli gas tabung 3kg", "Servis AC", "Sabun & alat kebersihan",
        "Obat-obatan kotak P3K", "Alat tulis kantor", "Plastik pembungkus",
        "Bensin genset", "Fee jasa cuci karpet", "Aqua galon untuk staff",
        "Materai & fotokopi", "Perbaikan kran air", "Parkir & tol kurir",
    ]
    for outlet in outlets:
        oid = outlet["id"]
        code = (outlet.get("code") or "PCX")[:3]
        # Build chronological transactions: opening replenish (oldest) + activity.
        txns: list[tuple[int, str, int, str]] = [
            (45, "replenish", random.randint(3_000_000, 5_000_000), "Pengisian awal kas kecil"),
        ]
        for d in random.sample(range(0, 44), 14):
            r = random.random()
            if r < 0.18:
                txns.append((d, "replenish", random.randint(1_000_000, 3_000_000), "Top up saldo kas kecil"))
            elif r < 0.26:
                txns.append((d, "adjustment", random.randint(20_000, 150_000), "Penyesuaian saldo kas (selisih hitung)"))
            else:
                txns.append((d, "purchase", random.randint(25_000, 600_000), random.choice(pc_expense_desc)))
        # Process oldest → newest (largest day number first) keeping a running balance.
        txns.sort(key=lambda t: t[0], reverse=True)
        running = 0.0
        seq = 0
        for day, ttype, amount, desc in txns:
            # Guard: never let a purchase drive the balance negative — convert to top-up.
            if ttype == "purchase" and amount > running - 50_000:
                ttype, amount, desc = "replenish", random.randint(1_500_000, 3_000_000), "Top up saldo kas kecil"
            if ttype in ("replenish", "adjustment"):
                running += amount
            else:
                running -= amount
            seq += 1
            dt = days_ago(day)
            doc_no = f"PC-{code}-{dt.strftime('%y%m%d')}-{seq:02d}"
            pc_docs.append(doc({
                "doc_no": doc_no,
                "outlet_id": oid,
                "txn_date": jakiso(dt),
                "type": ttype,
                "amount": float(amount),
                "description": desc,
                "item_text": None, "item_id": None,
                "vendor_text": None, "vendor_id": None,
                "category_id": None, "gl_account_id": None,
                "receipt_url": None, "notes": None,
                "status": "posted",
                "balance_after": round(running, 2),
                "journal_entry_id": None,
            }))
            pc_count += 1

    if pc_docs:
        await db.petty_cash_transactions.insert_many(pc_docs)
    print(f"  → {pc_count} Petty Cash transactions seeded (petty_cash_transactions).")

    # ── 4. Stock Transfers between outlets ───────────────────────────────────
    # CANONICAL collection is `transfers` (read/written by inventory_service for the
    # full draft→sent→received lifecycle). Seed previously wrote legacy `stock_transfers`
    # with `qty_requested`/`qty_sent`/`pending` → list page showed empty. Fixed here.
    print("Seeding Stock Transfers (transfers)…")
    item_name_map = {i["id"]: i.get("name") for i in items}
    await db.transfers.delete_many({})          # idempotent
    await db.stock_transfers.delete_many({})     # drop legacy
    tf_count = 0
    tf_docs = []
    if len(outlets) >= 2:
        for i in range(15):
            day = random.randint(0, 45)
            dt = days_ago(day)
            from_outlet, to_outlet = random.sample(outlets, 2)
            lines = []
            total = 0.0
            for item_id in random.sample(item_ids or [uid()], min(2, len(item_ids or [uid()]))):
                qty = random.randint(1, 10)
                unit_cost = random.randint(8_000, 90_000)
                total_cost = qty * unit_cost
                total += total_cost
                lines.append({
                    "item_id": item_id,
                    "item_name": item_name_map.get(item_id),
                    "qty": qty,
                    "unit": "pcs",
                    "unit_cost": unit_cost,
                    "total_cost": total_cost,
                    "notes": "",
                })
            doc_no = f"TRF-{from_outlet['code'][:3]}-{dt.strftime('%y%m%d')}-{i+1:02d}"
            tf_docs.append(doc({
                "doc_no": doc_no,
                "from_outlet_id": from_outlet["id"],
                "to_outlet_id": to_outlet["id"],
                "transfer_date": jakiso(dt),
                "status": random.choice(["draft", "sent", "received", "received"]),
                "lines": lines,
                "total_value": round(total, 2),
                "movement_out_ids": [],
                "movement_in_ids": [],
                "notes": "Transfer antar outlet",
            }))
            tf_count += 1

    if tf_docs:
        await db.transfers.insert_many(tf_docs)
    print(f"  → {tf_count} Stock Transfers seeded (transfers).")

    # ── 5. Inventory Movements ───────────────────────────────────────────────
    print("Seeding Inventory Movements…")
    mv_count = 0
    mv_docs = []
    mv_types = ["sale", "sale", "purchase_receive", "adjustment", "transfer_out", "wastage"]
    for outlet in outlets:
        oid = outlet["id"]
        for i in range(25):
            day = random.randint(0, 45)
            dt = days_ago(day)
            mv_type = random.choice(mv_types)
            item_id = random.choice(item_ids) if item_ids else uid()
            qty = random.randint(1, 20) if "purchase" in mv_type else random.randint(-10, -1) if "sale" in mv_type or "transfer_out" in mv_type else random.randint(-5, 5)
            unit_cost = random.randint(5_000, 80_000)
            mv_docs.append(doc({
                "outlet_id": oid,
                "item_id": item_id,
                "movement_type": mv_type,
                "movement_date": jakiso(dt),
                "qty": qty,
                "unit_cost": unit_cost,
                "total_value": abs(qty) * unit_cost,
                "ref_doc": f"REF-{i:04d}",
                "notes": "",
            }))
            mv_count += 1

    if mv_docs:
        await db.inventory_movements.insert_many(mv_docs)
    print(f"  → {mv_count} Inventory Movements seeded.")

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n✅ Transaction seeding complete!")
    print(f"   Daily Sales:          {ds_count}")
    print(f"   KDO/BDO Orders:       {kdo_count}")
    print(f"   Petty Cash:           {pc_count}")
    print(f"   Stock Transfers:      {tf_count}")
    print(f"   Inventory Movements:  {mv_count}")
    print(f"   Total records:        {ds_count + kdo_count + pc_count + tf_count + mv_count}")

    await close_db()


if __name__ == "__main__":
    asyncio.run(seed_transactions())
