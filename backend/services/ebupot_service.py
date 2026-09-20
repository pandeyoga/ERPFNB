"""e-Bupot (PPh 23/26 Withholding) Export Service — Sprint E Phase 3.

Generates SPT PPh 23/26 data in DJP e-Bupot format:
- Object: services (jasa) from AP invoices / payment records where pph23 was withheld
- Format: CSV compatible with e-Bupot DJP web app

Column spec (DJP e-Bupot 23 Unifikasi CSV):
  NPWP Pemotong, Masa Pajak, Tahun Pajak, NPWP Terpotong, Nama Terpotong, Alamat Terpotong,
  Kode Objek Pajak, Jenis Penghasilan, DPP, Tarif, PPh Dipotong, Nomor Bukti Potong, Tanggal
"""
from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from services.system_settings_service import get_value

logger = logging.getLogger("aurora.ebupot")

KODE_OBJEK_PAJAK = {
    "jasa_lain": "23-100-99",
    "jasa_konsultan": "23-100-02",
    "jasa_manajemen": "23-100-03",
    "jasa_konstruksi": "23-100-04",
    "royalti": "23-100-05",
    "sewa": "23-100-06",
    "hadiah": "23-100-07",
    "dividen": "23-100-08",
    "bunga": "23-100-09",
}


async def get_company_tax_info() -> dict:
    npwp = await get_value("COMPANY_NPWP") or "000000000000000"
    name = await get_value("COMPANY_PKP_NAME") or "PT. FnB Group"
    addr = await get_value("COMPANY_PKP_ADDRESS") or ""
    return {"npwp": npwp, "name": name, "address": addr}


async def build_ebupot_dataset(period: str) -> list[dict]:
    """Build e-Bupot 23 dataset from withholding_transactions for a given period."""
    db = get_db()
    company = await get_company_tax_info()
    masa = int(period[5:7])
    year = period[:4]
    rows = []
    seq = 0

    # Query withholding transactions (PPh 23)
    async for tx in db.withholding_transactions.find({
        "period": period,
        "tax_type": "pph23",
        "deleted_at": None,
    }):
        seq += 1
        vendor_id = tx.get("vendor_id")
        vendor = None
        if vendor_id:
            vendor = await db.vendors.find_one({"id": vendor_id})
        vendor_npwp = (vendor or {}).get("npwp") or "000000000000000"
        vendor_name = (vendor or {}).get("name") or tx.get("vendor_name", "Vendor")
        vendor_addr = (vendor or {}).get("address") or "-"
        service_type = tx.get("service_type", "jasa_lain")
        kode = KODE_OBJEK_PAJAK.get(service_type, KODE_OBJEK_PAJAK["jasa_lain"])
        dpp = float(tx.get("dpp") or tx.get("amount", 0))
        tarif = float(tx.get("rate") or 0.02)
        pph = float(tx.get("pph_amount") or dpp * tarif)
        bukti_no = tx.get("bukti_potong_no") or f"BP-{year}{str(masa).zfill(2)}-{str(seq).zfill(4)}"
        rows.append({
            "npwp_pemotong": company["npwp"],
            "masa_pajak": masa,
            "tahun_pajak": year,
            "npwp_terpotong": vendor_npwp,
            "nama_terpotong": vendor_name,
            "alamat_terpotong": vendor_addr,
            "kode_objek": kode,
            "jenis_penghasilan": service_type.replace("_", " ").title(),
            "dpp": dpp,
            "tarif": tarif * 100,
            "pph_dipotong": pph,
            "bukti_potong_no": bukti_no,
            "tanggal": tx.get("tx_date", period + "-01"),
            "source_id": tx.get("id"),
            "validation_issues": _validate_row(vendor_npwp, vendor_name, vendor_addr),
        })

    # Also pull from AP ledger entries that have pph23_amount set.
    # NOTE: `ap_ledgers` (canonical AP store) does not yet capture per-invoice PPh23/period,
    # so this yields rows only once AP starts tracking withholding tax (design gap, decision 3a).
    async for inv in db.ap_ledgers.find({
        "period": period,
        "pph23_amount": {"$gt": 0},
        "deleted_at": None,
    }):
        seq += 1
        vendor_id = inv.get("vendor_id")
        vendor = None
        if vendor_id:
            vendor = await db.vendors.find_one({"id": vendor_id})
        vendor_npwp = (vendor or {}).get("npwp") or "000000000000000"
        vendor_name = (vendor or {}).get("name") or "Vendor"
        vendor_addr = (vendor or {}).get("address") or "-"
        dpp = float(inv.get("subtotal") or inv.get("amount", 0))
        pph = float(inv.get("pph23_amount", 0))
        tarif = (pph / dpp * 100) if dpp > 0 else 2.0
        bukti_no = inv.get("pph23_bukti_no") or f"BP-{year}{str(masa).zfill(2)}-{str(seq).zfill(4)}"
        rows.append({
            "npwp_pemotong": company["npwp"],
            "masa_pajak": masa,
            "tahun_pajak": year,
            "npwp_terpotong": vendor_npwp,
            "nama_terpotong": vendor_name,
            "alamat_terpotong": vendor_addr,
            "kode_objek": KODE_OBJEK_PAJAK["jasa_lain"],
            "jenis_penghasilan": "Jasa Lain",
            "dpp": dpp,
            "tarif": tarif,
            "pph_dipotong": pph,
            "bukti_potong_no": bukti_no,
            "tanggal": inv.get("invoice_date", period + "-01"),
            "source_id": inv.get("id"),
            "validation_issues": _validate_row(vendor_npwp, vendor_name, vendor_addr),
        })
    return rows


def _validate_row(npwp: str, name: str, addr: str) -> list[str]:
    issues = []
    if not npwp or npwp == "000000000000000":
        issues.append("NPWP terpotong tidak diisi")
    if not name:
        issues.append("Nama tidak diisi")
    return issues


def generate_ebupot_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "NPWP Pemotong", "Masa Pajak", "Tahun Pajak",
        "NPWP Terpotong", "Nama Terpotong", "Alamat Terpotong",
        "Kode Objek Pajak", "Jenis Penghasilan",
        "DPP", "Tarif (%)", "PPh Dipotong",
        "Nomor Bukti Potong", "Tanggal",
    ])
    for row in rows:
        writer.writerow([
            row["npwp_pemotong"],
            str(row["masa_pajak"]),
            str(row["tahun_pajak"]),
            row["npwp_terpotong"],
            row["nama_terpotong"],
            row["alamat_terpotong"],
            row["kode_objek"],
            row["jenis_penghasilan"],
            str(int(row["dpp"])),
            f"{row['tarif']:.1f}",
            str(int(row["pph_dipotong"])),
            row["bukti_potong_no"],
            row["tanggal"],
        ])
    return buf.getvalue()


async def preview_ebupot(period: str) -> dict:
    rows = await build_ebupot_dataset(period)
    total_dpp = sum(r["dpp"] for r in rows)
    total_pph = sum(r["pph_dipotong"] for r in rows)
    warning_count = sum(1 for r in rows if r["validation_issues"])
    return {
        "rows": rows,
        "total_dpp": total_dpp,
        "total_pph": total_pph,
        "row_count": len(rows),
        "warning_count": warning_count,
    }


async def export_ebupot(period: str, user_id: str) -> dict:
    rows = await build_ebupot_dataset(period)
    csv_content = generate_ebupot_csv(rows)
    job = {
        "id": str(uuid.uuid4()),
        "period": period,
        "row_count": len(rows),
        "total_dpp": sum(r["dpp"] for r in rows),
        "total_pph": sum(r["pph_dipotong"] for r in rows),
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db = get_db()
    await db.ebupot_export_jobs.insert_one(job)
    return {**serialize(job), "csv": csv_content}


async def list_ebupot_jobs(period: Optional[str] = None) -> list[dict]:
    db = get_db()
    q: dict = {}
    if period:
        q["period"] = period
    items = await db.ebupot_export_jobs.find(q).sort("created_at", -1).limit(20).to_list(20)
    return [serialize(i) for i in items]
