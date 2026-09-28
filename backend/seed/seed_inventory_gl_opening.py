"""seed_inventory_gl_opening.py — E2: buat JE GL opening untuk inventory.

Problem (E2): GL akun inventory (1301/1302/1303) bernilai ~−Rp1,13M karena
sales COGS terposting tanpa ada opening-stock JE yang menyeimbangkan.

Fix: buat satu balanced JE per kategori inventory:
  Dr 1301  Inventory - Bahan Baku      (Bahan Baku Dapur)
  Dr 1302  Inventory - Minuman/Bar     (Bahan Baku Bar)
  Dr 1303  Inventory - Habis Pakai     (Bahan Habis Pakai)
  Cr 3002  Retained Earnings           (opening equity adjustment)

Nilai = Σ(qty_opening × unit_cost) per kategori, menggunakan data
inventory_movements tipe 'opening' yang sudah ada dari seed_inventory_opening.py.

Idempotent: hapus JE OPENING-INV sebelumnya lalu buat ulang.
Run: cd /app/backend && python3 -m seed.seed_inventory_gl_opening
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

from core.db import init_db, close_db, get_db

OPENING_SOURCE = "OPENING-INV"
OPENING_REF_PREFIX = "JE-OPENING-INV"

# Mapping kategori → COA code
CATEGORY_TO_COA = {
    "Bahan Baku Dapur": "1301",    # Inventory - Bahan Baku
    "Bahan Baku Bar": "1302",      # Inventory - Minuman/Bar
    "Bahan Habis Pakai": "1303",   # Inventory - Habis Pakai
}
CREDIT_COA = "3002"  # Retained Earnings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def main():
    await init_db()
    db = get_db()
    print("=" * 60)
    print("SEED INVENTORY GL OPENING JE (E2)")
    print("=" * 60)

    # 1. Idempotent: hapus JE opening sebelumnya
    del_res = await db.journal_entries.delete_many({"source": OPENING_SOURCE})
    if del_res.deleted_count:
        print(f"  → Hapus {del_res.deleted_count} JE opening lama.")

    # 2. Bangun peta kategori
    cats: dict[str, str] = {}
    async for cat in db.categories.find({"deleted_at": None}):
        cats[cat["id"]] = cat.get("name", "")

    # 3. Bangun peta item → (category_name, unit_cost)
    item_meta: dict[str, tuple[str, float]] = {}
    async for item in db.items.find({"deleted_at": None}):
        cat_name = cats.get(item.get("category_id", ""), "")
        unit_cost = float(item.get("unit_cost") or 0)
        item_meta[item["id"]] = (cat_name, unit_cost)

    # 4. Hitung total nilai per kategori dari opening movements
    category_values: dict[str, float] = {}
    pair_count = 0
    async for mv in db.inventory_movements.find(
        {"movement_type": "opening", "deleted_at": None}
    ):
        item_id = mv.get("item_id", "")
        cat_name, unit_cost = item_meta.get(item_id, ("", 0.0))
        if not cat_name or cat_name not in CATEGORY_TO_COA:
            continue
        qty = float(mv.get("qty") or 0)
        # Gunakan unit_cost dari items collection (seed_item_costs.py)
        # Jika movement sudah punya unit_cost > 0, pakai itu; kalau tidak pakai items
        mv_cost = float(mv.get("unit_cost") or 0)
        cost = mv_cost if mv_cost > 0 else unit_cost
        value = qty * cost
        category_values[cat_name] = category_values.get(cat_name, 0.0) + value
        pair_count += 1

    if not category_values:
        print("  ⚠ Tidak ada data opening movements. Jalankan seed_inventory_opening.py dulu.")
        await close_db()
        return

    # 5. Validasi COA accounts exist
    coa_cache: dict[str, str] = {}
    for coa_code in list(CATEGORY_TO_COA.values()) + [CREDIT_COA]:
        coa = await db.chart_of_accounts.find_one({"code": coa_code, "deleted_at": None})
        if coa:
            coa_cache[coa_code] = coa["id"]
        else:
            print(f"  ⚠ COA {coa_code} tidak ditemukan — skip.")

    # 6. Hitung total debit
    total_debit = sum(category_values.values())
    if total_debit <= 0:
        print("  ⚠ Total nilai inventory = 0 — tidak ada JE yang dibuat.")
        await close_db()
        return

    # 7. Dapatkan admin user untuk created_by
    admin = await db.users.find_one({"email": "admin@fnbgroup.id"})
    admin_id = admin["id"] if admin else "system"

    # 8. Buat satu JE balanced untuk semua kategori
    opening_date = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
    period = opening_date[:7]  # YYYY-MM

    # Pastikan periode buka
    period_doc = await db.accounting_periods.find_one({"period": period})
    if period_doc and period_doc.get("status") == "closed":
        await db.accounting_periods.update_one(
            {"period": period}, {"$set": {"status": "open"}}
        )
        print(f"  → Buka periode {period} untuk posting.")

    lines = []
    seq = 1
    for cat_name, value in sorted(category_values.items()):
        coa_code = CATEGORY_TO_COA[cat_name]
        if coa_code not in coa_cache:
            continue
        rounded_val = round(value, 2)
        lines.append({
            "id": str(uuid.uuid4()),
            "seq": seq,
            "coa_id": coa_code,
            "coa_name": cat_name,
            "description": f"Opening stock — {cat_name}",
            "debit": rounded_val,
            "credit": 0.0,
        })
        print(f"  Dr {coa_code} {cat_name:<25} Rp {rounded_val:>15,.2f}")
        seq += 1

    # Credit: Retained Earnings untuk total
    rounded_total = round(total_debit, 2)
    if CREDIT_COA in coa_cache:
        lines.append({
            "id": str(uuid.uuid4()),
            "seq": seq,
            "coa_id": CREDIT_COA,
            "coa_name": "Retained Earnings",
            "description": "Opening stock equity adjustment",
            "debit": 0.0,
            "credit": rounded_total,
        })
        print(f"  Cr {CREDIT_COA} {'Retained Earnings':<25} Rp {rounded_total:>15,.2f}")
    else:
        print(f"  ⚠ COA {CREDIT_COA} tidak ditemukan — JE tidak seimbang!")
        await close_db()
        return

    # Verifikasi balance
    total_dr = sum(ln["debit"] for ln in lines)
    total_cr = sum(ln["credit"] for ln in lines)
    if abs(total_dr - total_cr) > 0.01:
        print(f"  ✗ JE tidak seimbang! Dr={total_dr:,.2f} Cr={total_cr:,.2f}")
        await close_db()
        return

    je_id = str(uuid.uuid4())
    je = {
        "id": je_id,
        "doc_no": OPENING_REF_PREFIX,
        "source": OPENING_SOURCE,
        "description": "Opening inventory stock valuation (E2)",
        "period": period,
        "journal_date": opening_date,
        "total_dr": total_dr,
        "total_cr": total_cr,
        "status": "posted",
        "lines": lines,
        "created_by": admin_id,
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
        "posted_at": _now(),
        "approved_by": admin_id,
    }
    await db.journal_entries.insert_one(je)
    print(f"  → JE {OPENING_REF_PREFIX} diposting: Dr=Rp {total_dr:,.0f} Cr=Rp {total_cr:,.0f}")
    print(f"  → {pair_count} opening movements, {len([c for c in category_values])} kategori.")
    print("Inventory GL opening JE seed complete.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
