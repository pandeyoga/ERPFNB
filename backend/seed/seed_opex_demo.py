"""Operating-expense demo seed (OPEX) — fixes burn_30d = 0.

A real F&B business incurs operating expenses (salary, utilities, supplies,
maintenance, marketing, card fees). The canonical demo only journalised
sales (revenue/COGS/cash), so NO expense-type JE lines existed and the Owner
Cockpit "burn rate / cash runway" was meaningless (burn_30d = 0).

This seed posts realistic, BALANCED operating-expense journal entries
(Dr Expense / Cr Bank BCA) across all outlets for the last ~8 weeks using the
canonical `_post_journal` helper, so:
  - burn_30d > 0 (cash runway becomes meaningful)
  - P&L shows operating expenses
  - books stay balanced (per-entry Dr == Cr) → Balance Sheet still balances

Idempotent: deterministic source_id per (outlet, date, bucket); re-run is safe.

Run: python3 -m seed.seed_opex_demo
"""
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from services._journal._common import _post_journal  # noqa: E402

# Monthly OPEX budget per outlet (IDR). Spread across 4 weekly runs/month.
# Sized to ~35% of monthly revenue so runway is realistic, not dominant.
MONTHLY_OPEX = [
    # (expense_coa_code, label, monthly_amount)
    ("5410", "Gaji & Upah Staff", 42_000_000),
    ("5302", "Listrik & Air (PLN/PDAM)", 9_500_000),
    ("5303", "Gas & BBM", 3_200_000),
    ("5301", "Bahan Habis Pakai", 5_800_000),
    ("5304", "Perbaikan & Pemeliharaan", 2_600_000),
    ("5401", "Marketing & Promosi", 4_500_000),
    ("5430", "Biaya Proses Kartu (EDC)", 1_800_000),
]
BANK_CODE = "1110"  # Bank BCA (credit side)
WEEKS_BACK = 8      # ~2 months of weekly OPEX runs


async def main():
    await init_db()
    db = get_db()

    # Resolve COA ids by code
    codes = [c for c, _, _ in MONTHLY_OPEX] + [BANK_CODE]
    coa_rows = await db.chart_of_accounts.find(
        {"code": {"$in": codes}}, {"_id": 0, "id": 1, "code": 1, "name": 1}
    ).to_list(100)
    coa = {r["code"]: r for r in coa_rows}
    missing = [c for c in codes if c not in coa]
    if missing:
        print(f"  ⚠ Missing COA codes {missing} — aborting OPEX seed")
        await close_db()
        return
    bank = coa[BANK_CODE]

    outlets = await db.outlets.find(
        {"deleted_at": None}, {"_id": 0, "id": 1, "code": 1, "name": 1, "brand_id": 1}
    ).to_list(100)
    if not outlets:
        print("  ⚠ No outlets — aborting OPEX seed")
        await close_db()
        return

    today = datetime.now(timezone.utc).date()
    posted = 0
    skipped = 0
    total_value = 0.0

    for wk in range(WEEKS_BACK):
        # weekly run dated every 7 days back, offset 2 days so it's not "today"
        run_date = today - timedelta(days=2 + wk * 7)
        date_str = run_date.isoformat()
        for o in outlets:
            lines = []
            run_total = 0.0
            for code, label, monthly in MONTHLY_OPEX:
                weekly = round(monthly / 4.0, 2)  # weekly portion
                acc = coa[code]
                lines.append({
                    "coa_id": acc["id"], "coa_code": acc["code"], "coa_name": acc["name"],
                    "dr": weekly, "cr": 0, "memo": f"{label} — {o['name']} (mgg {run_date.isocalendar()[1]})",
                    "dim_outlet": o["id"], "dim_brand": o.get("brand_id"),
                })
                run_total += weekly
            # Credit bank for the full run total
            lines.append({
                "coa_id": bank["id"], "coa_code": bank["code"], "coa_name": bank["name"],
                "dr": 0, "cr": round(run_total, 2),
                "memo": f"Pembayaran beban operasional {o['name']}",
                "dim_outlet": o["id"], "dim_brand": o.get("brand_id"),
            })
            src_id = f"opex-{o.get('code', o['id'])}-{date_str}"
            try:
                res = await _post_journal(
                    entry_date=date_str,
                    description=f"Beban Operasional Mingguan — {o['name']} ({date_str})",
                    source_type="opex",
                    source_id=src_id,
                    lines=lines,
                    user_id="seed",
                    dim_outlet=o["id"],
                    dim_brand=o.get("brand_id"),
                )
                if res.get("posted_at"):
                    # distinguish new vs idempotent-skip by checking doc_no novelty is hard;
                    # count value only for newly intended runs
                    pass
                posted += 1
                total_value += run_total
            except Exception as e:  # noqa: BLE001
                skipped += 1
                print(f"    ⚠ skip {src_id}: {e}")

    print("=" * 60)
    print(f"  OPEX runs processed : {posted} (skipped {skipped})")
    print(f"  Outlets             : {len(outlets)} × {WEEKS_BACK} weeks")
    print(f"  Approx weekly value : Rp{total_value:,.0f} (cumulative across runs)")
    print("=" * 60)
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
