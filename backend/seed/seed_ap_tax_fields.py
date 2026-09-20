"""seed_ap_tax_fields.py — E3: tambahkan ppn_amount + pph23_amount ke ap_ledgers.

GROUND_TRUTH E3: ap_ledgers tidak lacak ppn_amount / pph23_amount sehingga
e-Bupot PPh 23 preview selalu kosong (design gap 3a).

Fix:
  1. Update vendors dengan NPWP + vendor_type='service'
  2. Patch ap_ledger entries dengan:
     - subtotal      = amount / 1.11  (amount inclusive PPN 11%)
     - ppn_amount    = subtotal * 0.11
     - dpp           = subtotal        (Dasar Pengenaan Pajak PPh 23)
     - pph23_amount  = dpp * 0.02     (PPh 23 rate 2% untuk jasa)
     - service_type  = berdasarkan keyword deskripsi
     - period        = invoice_date[:7]
     - pph23_bukti_no = "BP-{YYYY}{MM}-{seq:04d}"

Idempotent: hanya update jika ppn_amount == 0.
Run: cd /app/backend && python3 -m seed.seed_ap_tax_fields
"""
from __future__ import annotations

import asyncio
import os

try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

from core.db import init_db, close_db, get_db

# ─────────────────────────────────────────────────────────────────────
# Mapping NPWP vendor (NPWP dummy untuk demo — format 15 digit)
# ─────────────────────────────────────────────────────────────────────
VENDOR_NPWP: dict[str, tuple[str, str]] = {
    # name → (npwp_15digit, vendor_type)
    "PT Sumber Pangan Sejati": ("012345678001000", "service"),
    "CV Daging Berkah":        ("023456789002000", "service"),
    "Toko Sayur Pasar Induk":  ("034567890003000", "service"),
    "PT Sinar Kopi Indonesia": ("045678901004000", "service"),
    "Indomaret Kopo Indah":    ("056789012005000", "service"),
    "PT Gas Sentosa":          ("067890123006000", "service"),
}

# ─────────────────────────────────────────────────────────────────────
# Mapping keyword deskripsi → service_type (kode objek e-Bupot)
# ─────────────────────────────────────────────────────────────────────
def _classify_service(description: str) -> str:
    desc = description.lower()
    if "konsultan" in desc:
        return "jasa_konsultan"
    if "sewa" in desc:
        return "sewa"
    if "manajemen" in desc or "pemasaran" in desc or "marketing" in desc:
        return "jasa_manajemen"
    if "konstruksi" in desc or "renovasi" in desc:
        return "jasa_konstruksi"
    # default: jasa_lain (keamanan, laundry, listrik, maintenance, dll)
    return "jasa_lain"


async def _patch_vendors(db) -> dict[str, str]:
    """Update vendor NPWP + vendor_type. Return {vendor_id: npwp}."""
    vendor_npwp_map: dict[str, str] = {}
    for name, (npwp, vtype) in VENDOR_NPWP.items():
        doc = await db.vendors.find_one({"name": name, "deleted_at": None})
        if not doc:
            continue
        existing_npwp = doc.get("npwp", "")
        if not existing_npwp:
            await db.vendors.update_one(
                {"id": doc["id"]},
                {"$set": {"npwp": npwp, "vendor_type": vtype, "category": "service"}}
            )
            print(f"  Vendor NPWP: {name:<35} → {npwp}")
        else:
            print(f"  Vendor NPWP: {name:<35} (sudah ada: {existing_npwp})")
            npwp = existing_npwp
        vendor_npwp_map[doc["id"]] = npwp
    return vendor_npwp_map


async def _patch_ap_ledgers(db) -> int:
    """Patch ppn_amount + pph23_amount ke ap_ledger entries."""
    PPN_RATE = 0.11
    PPH23_RATE = 0.02
    updated = 0
    skipped = 0
    seq = 0

    async for ap in db.ap_ledgers.find({"deleted_at": None}):
        # Idempotent: skip jika sudah ada
        existing_ppn = float(ap.get("ppn_amount") or 0)
        if existing_ppn > 0:
            skipped += 1
            continue

        amount = float(ap.get("amount") or 0)
        if amount <= 0:
            continue

        # Hitung: amount sudah inclusive PPN
        subtotal = round(amount / (1 + PPN_RATE), 2)
        ppn_amount = round(amount - subtotal, 2)
        dpp = subtotal                           # DPP untuk PPh23 = subtotal
        pph23_amount = round(dpp * PPH23_RATE, 2)

        invoice_date = ap.get("invoice_date", "")
        period = invoice_date[:7] if invoice_date else ""

        description = ap.get("description", "")
        service_type = _classify_service(description)

        seq += 1
        year_month = period.replace("-", "") if period else "202601"
        bukti_no = f"BP-{year_month}-{str(seq).zfill(4)}"

        await db.ap_ledgers.update_one(
            {"id": ap["id"]},
            {"$set": {
                "subtotal": subtotal,
                "ppn_amount": ppn_amount,
                "dpp": dpp,
                "pph23_amount": pph23_amount,
                "pph23_rate": PPH23_RATE,
                "service_type": service_type,
                "period": period,
                "pph23_bukti_no": bukti_no,
                "tax_note": f"PPh23 {PPH23_RATE*100:.0f}% dipotong pemberi kerja",
            }}
        )
        print(
            f"  {ap.get('invoice_no',''):<15} | subtotal={subtotal:>12,.0f} "
            f"| ppn={ppn_amount:>10,.0f} | pph23={pph23_amount:>8,.0f} "
            f"| type={service_type:<20} | period={period}"
        )
        updated += 1

    return updated


async def main():
    await init_db()
    db = get_db()
    print("=" * 70)
    print("SEED AP TAX FIELDS (E3 — PPN-in & PPh23 di ap_ledgers)")
    print("=" * 70)

    print("\n[1] Update vendor NPWP + vendor_type:")
    await _patch_vendors(db)

    print("\n[2] Patch ap_ledgers dengan ppn_amount + pph23_amount:")
    updated = await _patch_ap_ledgers(db)
    print(f"  → {updated} entries diperbarui.")

    # Verifikasi ringkas
    print("\n[3] Verifikasi:")
    total_ppn = 0.0
    total_pph23 = 0.0
    count_with_pph = 0
    async for ap in db.ap_ledgers.find({"deleted_at": None}):
        total_ppn += float(ap.get("ppn_amount") or 0)
        pph = float(ap.get("pph23_amount") or 0)
        if pph > 0:
            count_with_pph += 1
            total_pph23 += pph
    print(f"  Total PPN masukan: Rp {total_ppn:,.0f}")
    print(f"  Total PPh23 dipotong: Rp {total_pph23:,.0f} ({count_with_pph} entries)")

    print("\nAP tax fields seed complete.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
