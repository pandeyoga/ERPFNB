"""Selective runner for the SAFE, additive seed_compro functions only.

Seeds two feature collections that are read by the live API but are not
covered by the canonical seed_reset.sh order:
  - fixed_assets   (Finance → Fixed Assets list/detail)
  - reservations   (Executive/Outlet → Reservations)

We DELIBERATELY skip seed_compro's finance/procurement/HR/CMS functions
because they write to LEGACY/WRONG collections (ap_invoices, journal_lines,
cms_pages, ...) and would corrupt the canonical financial core.

Run: python3 -m seed.seed_finish_extras
Idempotent: each function clears its own collection then reseeds.
"""
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from seed.seed_compro import seed_fixed_assets, seed_reservations  # noqa: E402


async def main():
    await init_db()
    db = get_db()
    await seed_fixed_assets(db)
    await seed_reservations(db)
    # quick counts
    fa = await db["fixed_assets"].count_documents({})
    rv = await db["reservations"].count_documents({})
    print("=" * 60)
    print(f"  fixed_assets : {fa}")
    print(f"  reservations : {rv}")
    print("=" * 60)
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
