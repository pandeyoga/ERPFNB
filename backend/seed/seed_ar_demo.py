"""seed_ar_demo.py — AR (Accounts Receivable) demo data.

Fills the AR feature pages (Finance > AR Invoices) that the core seeds left empty:
  • ar_customers   → Customers tab
  • ar_invoices    → Invoices tab + Aging Report (Per Customer) + Reconciliation
  • ar_receipts    → payments (drives partial/paid status + Reconciliation receipts)

Design notes (follows ENGINEERING_GUARDRAILS):
  • Data is created through the REAL service layer (services._ar) — NOT hand-rolled docs —
    so number-series SSOT (AR_INV_SEQ), GL posting, and subledger↔GL coherence stay correct.
  • Every invoice is auto-posted (Dr 1201 AR / Cr 4101 Revenue / Cr 2110 PPN) and every
    receipt posts (Dr Bank / Cr AR). All journal entries are balanced, so the Balance Sheet
    stays balanced and the integrity gate keeps passing.
  • Invoice/receipt dates land in OPEN periods (all 2026 periods are open) so JE posting
    never silently skips (which would break subledger↔GL coherence).
  • Aging buckets are produced by spreading due_dates relative to *today* so the
    Aging Report shows real current / 1-30 / 31-60 / >60 numbers.

Idempotent: wipes prior AR demo data AND its journal entries before re-seeding, so the
GL returns to its pre-AR (balanced) state on every run. Safe to run repeatedly.

Run: cd /app/backend && python3 -m seed.seed_ar_demo
"""
import asyncio
from datetime import datetime, timezone, timedelta

try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

from core.db import init_db, close_db, get_db
from services import _ar as ar_service

SEED_USER = "system-seed"


def _d(days_from_today: int) -> str:
    """Date string offset from today (negative = past)."""
    return (datetime.now(timezone.utc) + timedelta(days=days_from_today)).strftime("%Y-%m-%d")


# ── Customers ────────────────────────────────────────────────────────────────
CUSTOMERS = [
    {"name": "PT Mitra Boga Nusantara", "channel": "b2b", "npwp": "01.234.567.8-901.000",
     "contact_person": "Budi Santoso", "phone": "081234567890", "email": "budi@mitraboga.id",
     "address": "Jl. Sudirman No. 45, Jakarta Pusat", "credit_terms_days": 30},
    {"name": "CV Sentosa Catering", "channel": "b2b", "npwp": "02.345.678.9-012.000",
     "contact_person": "Siti Aminah", "phone": "081298765432", "email": "siti@sentosa.id",
     "address": "Jl. Diponegoro No. 12, Bandung", "credit_terms_days": 14},
    {"name": "Hotel Grand Menara", "channel": "b2b", "npwp": "03.456.789.0-123.000",
     "contact_person": "Rina Wijaya", "phone": "081377788899", "email": "purchasing@grandmenara.com",
     "address": "Jl. Gatot Subroto No. 88, Jakarta Selatan", "credit_terms_days": 45},
    {"name": "PT Boga Retail Sejahtera", "channel": "b2b", "npwp": "04.567.890.1-234.000",
     "contact_person": "Andi Pratama", "phone": "081255566677", "email": "andi@bogaretail.id",
     "address": "Jl. MH Thamrin No. 7, Surabaya", "credit_terms_days": 30},
    {"name": "Dapur Bersama Aggregator", "channel": "bank_payout", "npwp": "05.678.901.2-345.000",
     "contact_person": "Tim Finance", "phone": "081244455566", "email": "finance@dapurbersama.id",
     "address": "Jl. Asia Afrika No. 19, Jakarta", "credit_terms_days": 7},
]


def _lines(*items):
    """items: tuples of (description, qty, unit_price, include_ppn)."""
    return [{"description": d, "qty": q, "unit_price": p, "include_ppn": ppn} for (d, q, p, ppn) in items]


# ── Invoice plan ─────────────────────────────────────────────────────────────
# (customer_idx, invoice_date, due_date, lines, receipt) — receipt: None | ("full"|amt)
INVOICE_PLAN = [
    # current (not yet due)
    (0, _d(-5), _d(25), _lines(("Paket Catering Corporate Lunch (100 pax)", 100, 75_000, True),
                               ("Coffee Break Package", 50, 45_000, True)), None),
    # 1-30 overdue
    (1, _d(-28), _d(-14), _lines(("Snack Box Premium", 300, 25_000, False)), None),
    # 31-60 overdue
    (2, _d(-62), _d(-47), _lines(("Banquet Dinner Package (200 pax)", 200, 120_000, True)), None),
    # >60 overdue
    (3, _d(-99), _d(-69), _lines(("Wedding Catering Full Service", 1, 45_000_000, True)), None),
    # current — will be PARTIALLY paid
    (0, _d(-16), _d(14), _lines(("Monthly Office Pantry Supply", 1, 18_500_000, True)), ("partial", 0.4)),
    # recently due — will be FULLY paid (status paid)
    (1, _d(-23), _d(-9), _lines(("Event Catering Gathering (150 pax)", 150, 85_000, True)), ("full", None)),
    # aggregator payout (current)
    (4, _d(-7), _d(0), _lines(("GoFood/GrabFood Settlement Batch #2026-24", 1, 32_750_000, False)), None),
    # current with PPN
    (2, _d(-3), _d(42), _lines(("Hotel Restaurant Supply — Frozen Goods", 1, 27_300_000, True)), None),
    # 1-30 overdue — partial paid
    (3, _d(-42), _d(-12), _lines(("Retail Distribution — Sambal & Sauce", 500, 32_000, True)), ("partial", 0.5)),
]


async def _wipe_existing(db):
    """Idempotent: remove prior AR demo + its journal entries so GL stays coherent."""
    # Remove AR journal entries first (keeps Balance Sheet balanced after re-seed).
    je_del = await db.journal_entries.delete_many(
        {"source_type": {"$in": ["ar_invoice", "ar_receipt"]}})
    inv_del = await db.ar_invoices.delete_many({})
    rcp_del = await db.ar_receipts.delete_many({})
    cust_del = await db.ar_customers.delete_many({})
    # Reset invoice number sequence for clean numbering each run.
    year = datetime.now(timezone.utc).year
    await db.system_settings.delete_one({"key": f"AR_INV_SEQ_{year}"})
    print(f"  ↺ cleaned: {cust_del.deleted_count} customers, {inv_del.deleted_count} invoices, "
          f"{rcp_del.deleted_count} receipts, {je_del.deleted_count} AR journal entries")


async def main():
    await init_db()
    db = get_db()
    print("=" * 60)
    print("AR DEMO SEED — customers + invoices + receipts (auto-posted)")
    print("=" * 60)

    await _wipe_existing(db)

    # 1) Customers
    customer_ids = []
    for c in CUSTOMERS:
        created = await ar_service.create_customer(c, user_id=SEED_USER)
        customer_ids.append(created["id"])
    print(f"  → {len(customer_ids)} AR customers seeded")

    # 2) Invoices (auto-posted) + 3) Receipts
    inv_count = posted = receipts = 0
    for (cidx, inv_date, due_date, lines, receipt) in INVOICE_PLAN:
        cust = CUSTOMERS[cidx]
        payload = {
            "customer_id": customer_ids[cidx],
            "customer_name": cust["name"],
            "customer_npwp": cust.get("npwp"),
            "channel": cust["channel"],
            "invoice_date": inv_date,
            "due_date": due_date,
            "credit_terms_days": cust["credit_terms_days"],
            "lines": lines,
        }
        inv = await ar_service.create_invoice(payload, user_id=SEED_USER)
        inv_count += 1
        # Issue the invoice (status -> sent) which also posts the AR journal entry.
        await ar_service.send_invoice(inv["id"], user_id=SEED_USER)
        # Re-fetch to confirm GL posting (je_id is set on the DB doc, not the returned dict).
        fresh = await db.ar_invoices.find_one({"id": inv["id"]})
        if fresh and fresh.get("je_id"):
            posted += 1

        if receipt:
            kind, ratio = receipt
            total = float(inv["total_amount"])
            amount = total if kind == "full" else round(total * ratio, 2)
            # receipt date a few days after invoice (within open period)
            rcpt_date = (datetime.strptime(inv_date, "%Y-%m-%d") + timedelta(days=4)).strftime("%Y-%m-%d")
            await ar_service.record_receipt(
                inv["id"], receipt_date=rcpt_date, amount=amount,
                payment_method="transfer", reference=f"TRF/{inv['invoice_no']}",
                user_id=SEED_USER,
            )
            receipts += 1

    print(f"  → {inv_count} AR invoices seeded ({posted} GL-posted), {receipts} receipts recorded")

    # Summary
    aging = await ar_service.aging_report()
    print(f"  → Aging total outstanding: Rp {aging.get('total_outstanding', 0):,.0f} "
          f"across {len(aging.get('by_customer', []))} customers")
    print("\nAR demo seed complete.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
