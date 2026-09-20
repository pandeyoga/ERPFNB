"""e-Faktur / Coretax service — Sprint 1b.

Generates CSV + XML exports from:
- Daily Sales (Faktur Keluaran)
- Goods Receipts/AP (Faktur Masukan)

Formats:
- CSV: compatible with e-Faktur DJP desktop v2.x
- XML: Coretax-ready structured format
"""
from __future__ import annotations

import io
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from models.efaktur import make_export_job
from services.system_settings_service import get_value

logger = logging.getLogger("aurora.efaktur")


# ──────────────────────────────────────────
# 1. COMPANY TAX CONFIG
# ──────────────────────────────────────────

async def get_company_tax_info() -> dict:
    npwp  = await get_value("COMPANY_NPWP") or "000000000000000"
    name  = await get_value("COMPANY_PKP_NAME") or "PT. FnB Group"
    addr  = await get_value("COMPANY_PKP_ADDRESS") or ""
    return {"npwp": npwp, "name": name, "address": addr}


async def next_faktur_no(faktur_type: str, year: str) -> str:
    """Generate sequential faktur number in DJP format.

    Format: KTR+KSF.000-YY.NNNNNNNN
    Example: 010.000-26.00000001
    """
    db = get_db()
    seq_key = f"EFAKTUR_SEQ_{faktur_type.upper()}_{year}"
    result = await db.system_settings.find_one_and_update(
        {"key": seq_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq_num = result.get("seq", 1) if result else 1
    ktr = "01" if faktur_type == "keluaran" else "04"  # 01=normal, 04=masukan
    short_year = year[-2:]
    return f"{ktr}0.000-{short_year}.{str(seq_num).zfill(8)}"


# ──────────────────────────────────────────
# 2. DATASET BUILDERS
# ──────────────────────────────────────────

async def build_keluaran_dataset(period: str) -> list[dict]:
    """Build Faktur Keluaran dataset from Daily Sales for given period (YYYY-MM)."""
    db = get_db()
    company = await get_company_tax_info()
    year = period[:4]
    masa = int(period[5:7])

    rows = []
    async for sale in db.daily_sales.find({
        "period": period,
        "status": {"$in": ["approved", "validated", "posted"]},
        "deleted_at": None,
    }):
        revenue = float(sale.get("total_revenue", 0) or 0)
        tax_amount = float(sale.get("total_tax", 0) or 0)
        if revenue <= 0:
            continue
        dpp = revenue - tax_amount if tax_amount > 0 else revenue
        faktur_no = await next_faktur_no("keluaran", year)
        outlet = None
        if sale.get("outlet_id"):
            outlet = await db.outlets.find_one({"id": sale["outlet_id"]})
        rows.append({
            "faktur_type": "keluaran",
            "source_type": "daily_sales",
            "source_id": sale["id"],
            "faktur_no": faktur_no,
            "kode_transaksi": "01",
            "status_faktur": "0",
            "tanggal_faktur": sale.get("sale_date", ""),
            "masa_pajak": masa,
            "tahun_pajak": year,
            "npwp_penjual": company["npwp"],
            "nama_penjual": company["name"],
            "alamat_penjual": company["address"],
            "npwp_pembeli": "000000000000000",  # retail/end consumer
            "nama_pembeli": "KONSUMEN AKHIR",
            "alamat_pembeli": (outlet or {}).get("address", "-"),
            "dpp": dpp,
            "ppn": tax_amount,
            "ppnbm": 0.0,
            "total": revenue,
            "lines": [
                {
                    "no": 1,
                    "nama": f"Penjualan F&B - {(outlet or {}).get('name', 'Outlet')}",
                    "unit_price": dpp,
                    "qty": 1,
                    "dpp": dpp,
                    "ppn": tax_amount,
                }
            ],
            "outlet_id": sale.get("outlet_id"),
            "validation_issues": [],
        })
    return rows


async def build_masukan_dataset(period: str) -> list[dict]:
    """Build Faktur Masukan dataset from Goods Receipts for given period (YYYY-MM)."""
    db = get_db()
    company = await get_company_tax_info()
    year = period[:4]
    masa = int(period[5:7])

    rows = []
    async for gr in db.goods_receipts.find({
        "period": period,
        "status": {"$in": ["approved", "posted"]},
        "deleted_at": None,
    }):
        subtotal = float(gr.get("subtotal", 0) or 0)
        tax_total = float(gr.get("tax_total", 0) or 0)
        if subtotal <= 0:
            continue
        vendor = None
        if gr.get("vendor_id"):
            vendor = await db.vendors.find_one({"id": gr["vendor_id"]})
        vendor_npwp = (vendor or {}).get("npwp") or "000000000000000"
        vendor_name = (vendor or {}).get("name") or "Vendor"
        vendor_addr  = (vendor or {}).get("address") or "-"
        faktur_no = await next_faktur_no("masukan", year)
        rows.append({
            "faktur_type": "masukan",
            "source_type": "gr",
            "source_id": gr["id"],
            "faktur_no": faktur_no,
            "kode_transaksi": "01",
            "status_faktur": "0",
            "tanggal_faktur": gr.get("receive_date", ""),
            "masa_pajak": masa,
            "tahun_pajak": year,
            "npwp_penjual": vendor_npwp,
            "nama_penjual": vendor_name,
            "alamat_penjual": vendor_addr,
            "npwp_pembeli": company["npwp"],
            "nama_pembeli": company["name"],
            "alamat_pembeli": company["address"],
            "dpp": subtotal,
            "ppn": tax_total,
            "ppnbm": 0.0,
            "total": subtotal + tax_total,
            "lines": [
                {
                    "no": i + 1,
                    "nama": line.get("item_name", "Item"),
                    "unit_price": float(line.get("unit_price", 0)),
                    "qty": float(line.get("qty_received", 1)),
                    "dpp": float(line.get("unit_price", 0)) * float(line.get("qty_received", 1)),
                    "ppn": float(line.get("unit_price", 0)) * float(line.get("qty_received", 1)) * 0.12,
                }
                for i, line in enumerate(gr.get("lines", []))
            ],
            "outlet_id": gr.get("outlet_id"),
            "validation_issues": _validate_row(vendor_npwp, vendor_name, vendor_addr),
        })
    return rows


def _validate_row(npwp: str, name: str, addr: str) -> list[str]:
    issues = []
    if not npwp or npwp == "000000000000000":
        issues.append("NPWP tidak diisi — akan menggunakan 000000000000000")
    if not name:
        issues.append("Nama tidak diisi")
    if not addr or addr == "-":
        issues.append("Alamat tidak diisi")
    return issues


# ──────────────────────────────────────────
# 3. CSV GENERATOR (e-Faktur DJP Desktop v2.x)
# ──────────────────────────────────────────

def _fmt_date_djp(iso_date: str) -> str:
    """Convert YYYY-MM-DD to DD/MM/YYYY for DJP CSV."""
    try:
        d = datetime.strptime(iso_date[:10], "%Y-%m-%d")
        return d.strftime("%d/%m/%Y")
    except Exception:
        return iso_date


def generate_csv(rows: list[dict]) -> str:
    """Generate e-Faktur CSV string from dataset rows.

    Format:
    FK|kode_status|fg_pengganti|kode_transaksi|nomor_faktur|masa|tahun|tanggal|
       npwp_pembeli|nama_pembeli|alamat_pembeli|dpp|ppn|ppnbm|id_keterangan
    FD|no|kode_objek|nama|harga|qty|bruto|diskon|dpp|ppn|ppnbm|tarif_ppn
    """
    buf = io.StringIO()
    for row in rows:
        tgl = _fmt_date_djp(row["tanggal_faktur"])
        dpp = int(row["dpp"])
        ppn = int(row["ppn"])
        ppnbm = int(row["ppnbm"])
        # FK header line
        buf.write("|".join([
            "FK",
            str(row.get("status_faktur", "0")),
            "0",  # fg_pengganti (0=asli)
            str(row.get("kode_transaksi", "01")),
            str(row.get("faktur_no", "")),
            str(row.get("masa_pajak", "")),
            str(row.get("tahun_pajak", "")),
            tgl,
            str(row.get("npwp_pembeli", "")),
            str(row.get("nama_pembeli", "")),
            str(row.get("alamat_pembeli", "")),
            str(dpp),
            str(ppn),
            str(ppnbm),
            "",  # id_keterangan_tertentu (kosong = normal)
        ]) + "\n")
        # FD detail lines
        for ln in row.get("lines", []):
            line_dpp = int(float(ln.get("dpp", 0)))
            line_ppn = int(float(ln.get("ppn", 0)))
            buf.write("|".join([
                "FD",
                str(ln.get("no", 1)),
                "",  # kode_objek (kosong untuk jasa)
                str(ln.get("nama", "")),
                str(int(float(ln.get("unit_price", 0)))),
                str(int(float(ln.get("qty", 1)))),
                str(int(float(ln.get("unit_price", 0)) * float(ln.get("qty", 1)))),  # bruto
                "0",  # diskon
                str(line_dpp),
                str(line_ppn),
                "0",  # ppnbm
                "12",  # tarif_ppn %
            ]) + "\n")
    return buf.getvalue()


# ──────────────────────────────────────────
# 4. XML GENERATOR (Coretax-compatible)
# ──────────────────────────────────────────

def generate_xml(rows: list[dict], faktur_type: str, company: dict, period: str) -> str:
    """Generate Coretax-compatible XML string."""
    root = ET.Element("FakturPajak")
    root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    root.set("versi", "2.0")

    header = ET.SubElement(root, "Header")
    ET.SubElement(header, "TipeFaktur").text = faktur_type.upper()
    ET.SubElement(header, "Periode").text = period
    ET.SubElement(header, "TanggalEkspor").text = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ET.SubElement(header, "JumlahFaktur").text = str(len(rows))
    ET.SubElement(header, "TotalDPP").text = str(int(sum(r["dpp"] for r in rows)))
    ET.SubElement(header, "TotalPPN").text = str(int(sum(r["ppn"] for r in rows)))

    penjual_el = ET.SubElement(header, "Penjual" if faktur_type == "keluaran" else "Pembeli")
    ET.SubElement(penjual_el, "NPWP").text = company["npwp"]
    ET.SubElement(penjual_el, "Nama").text = company["name"]
    ET.SubElement(penjual_el, "Alamat").text = company["address"]

    daftar = ET.SubElement(root, "DaftarFaktur")
    for row in rows:
        fk = ET.SubElement(daftar, "Faktur")
        ET.SubElement(fk, "NoFaktur").text = row.get("faktur_no", "")
        ET.SubElement(fk, "KodeTransaksi").text = row.get("kode_transaksi", "01")
        ET.SubElement(fk, "StatusFaktur").text = row.get("status_faktur", "0")
        ET.SubElement(fk, "TanggalFaktur").text = row.get("tanggal_faktur", "")
        ET.SubElement(fk, "MasaPajak").text = str(row.get("masa_pajak", ""))
        ET.SubElement(fk, "TahunPajak").text = str(row.get("tahun_pajak", ""))

        lawan = ET.SubElement(fk, "Lawan")
        key = "Pembeli" if faktur_type == "keluaran" else "Penjual"
        ET.SubElement(lawan, "NPWP").text = row.get(f"npwp_{key.lower()}", "000000000000000")
        ET.SubElement(lawan, "Nama").text = row.get(f"nama_{key.lower()}", "")
        ET.SubElement(lawan, "Alamat").text = row.get(f"alamat_{key.lower()}", "")

        amounts = ET.SubElement(fk, "Jumlah")
        ET.SubElement(amounts, "DPP").text = str(int(row["dpp"]))
        ET.SubElement(amounts, "PPN").text = str(int(row["ppn"]))
        ET.SubElement(amounts, "PPnBM").text = "0"
        ET.SubElement(amounts, "Total").text = str(int(row["total"]))

        det = ET.SubElement(fk, "DetailBarang")
        for ln in row.get("lines", []):
            item = ET.SubElement(det, "Barang")
            ET.SubElement(item, "Nama").text = str(ln.get("nama", ""))
            ET.SubElement(item, "HargaSatuan").text = str(int(float(ln.get("unit_price", 0))))
            ET.SubElement(item, "Qty").text = str(float(ln.get("qty", 1)))
            ET.SubElement(item, "DPP").text = str(int(float(ln.get("dpp", 0))))
            ET.SubElement(item, "PPN").text = str(int(float(ln.get("ppn", 0))))

    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


# ──────────────────────────────────────────
# 5. EXPORT JOB MANAGEMENT
# ──────────────────────────────────────────

async def create_export_job(
    *,
    period: str,
    job_type: str,   # keluaran | masukan | all
    user_id: str,
) -> dict:
    """Run full export pipeline and return job with embedded file content."""
    company = await get_company_tax_info()
    files: dict = {}
    all_rows: list = []

    if job_type in ("keluaran", "all"):
        kel_rows = await build_keluaran_dataset(period)
        if kel_rows:
            files["csv_keluaran"] = generate_csv(kel_rows)
            files["xml_keluaran"] = generate_xml(kel_rows, "keluaran", company, period)
        all_rows.extend(kel_rows)

    if job_type in ("masukan", "all"):
        mas_rows = await build_masukan_dataset(period)
        if mas_rows:
            files["csv_masukan"] = generate_csv(mas_rows)
            files["xml_masukan"] = generate_xml(mas_rows, "masukan", company, period)
        all_rows.extend(mas_rows)

    job = make_export_job(
        job_type=job_type,
        period=period,
        formats=["csv", "xml"],
        faktur_count=len(all_rows),
        total_dpp=sum(r["dpp"] for r in all_rows),
        total_ppn=sum(r["ppn"] for r in all_rows),
        files={k: "<inline>" for k in files},  # store keys only in DB, content in-memory
        created_by=user_id,
    )
    db = get_db()
    await db.efaktur_export_jobs.insert_one(job)
    return {**serialize(job), "files": files}  # include content in response only


async def list_export_jobs(period: Optional[str] = None, page: int = 1, per_page: int = 20) -> tuple[list, dict]:
    db = get_db()
    q: dict = {}
    if period:
        q["period"] = period
    skip = (page - 1) * per_page
    items = await db.efaktur_export_jobs.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.efaktur_export_jobs.count_documents(q)
    return [serialize(i) for i in items], {"page": page, "per_page": per_page, "total": total}


async def preview_dataset(period: str, job_type: str) -> dict:
    """Return preview rows (no file generation, no sequence increment preview)."""
    rows_k: list = []
    rows_m: list = []
    if job_type in ("keluaran", "all"):
        rows_k = await build_keluaran_dataset(period)
    if job_type in ("masukan", "all"):
        rows_m = await build_masukan_dataset(period)
    return {
        "keluaran": rows_k,
        "masukan": rows_m,
        "total_dpp": sum(r["dpp"] for r in rows_k + rows_m),
        "total_ppn": sum(r["ppn"] for r in rows_k + rows_m),
        "warning_count": sum(len(r.get("validation_issues", [])) for r in rows_k + rows_m),
    }
