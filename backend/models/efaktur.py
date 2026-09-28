"""e-Faktur / Coretax models — Sprint 1b.

Covers:
- FakturHeader: header record per faktur pajak
- FakturLine: detail baris barang/jasa
- ExportJob: audit trail of every CSV/XML export
"""
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Kode Jenis Transaksi (KTR) per DJP
KODE_TRANSAKSI = {
    "01": "Penyerahan Kepada Selain Pemungut PPN",
    "02": "Penyerahan Kepada Pemungut Bendaharawan",
    "03": "Penyerahan Kepada Pemungut Selain Bendaharawan",
    "04": "DPP Nilai Lain",
    "06": "Penyerahan Lainnya",
    "07": "Penyerahan yang PPN-nya Tidak Dipungut",
    "08": "Penyerahan yang Dibebaskan dari PPN",
    "09": "Penyerahan Aktiva (Pasal 16D)",
}

# Kode Status Faktur
STATUS_FAKTUR = {"0": "Normal", "1": "Pengganti", "2": "Dibatalkan"}

# Document types for faktur sources
FAKTUR_SOURCE_TYPES = {
    "daily_sales": "Daily Sales (Keluaran)",
    "gr": "Goods Receipt / AP (Masukan)",
    "ar_invoice": "AR Invoice (Keluaran)",
    "manual": "Manual Entry",
}


def make_faktur_doc(
    *,
    faktur_type: str,          # keluaran | masukan
    source_type: str,          # daily_sales | gr | ar_invoice | manual
    source_id: str,
    faktur_no: str,            # e.g. "010.000-26.00000001"
    kode_transaksi: str,       # e.g. "01"
    status_faktur: str,        # "0" = Normal
    tanggal_faktur: str,       # YYYY-MM-DD
    masa_pajak: int,           # 1-12
    tahun_pajak: str,          # e.g. "2026"
    # Penjual (for keluaran: our company; for masukan: vendor)
    npwp_penjual: str,
    nama_penjual: str,
    alamat_penjual: str,
    # Pembeli (for keluaran: customer; for masukan: our company)
    npwp_pembeli: str,
    nama_pembeli: str,
    alamat_pembeli: str,
    # Amounts
    dpp: float,                # Dasar Pengenaan Pajak (excl. PPN)
    ppn: float,                # PPN amount
    ppnbm: float,              # PPnBM (usually 0)
    # Items
    lines: list,               # [{desc, qty, unit_price, dpp, ppn}]
    # Meta
    outlet_id: Optional[str],
    currency: str,
    notes: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "faktur_type": faktur_type,
        "source_type": source_type,
        "source_id": source_id,
        "faktur_no": faktur_no,
        "kode_transaksi": kode_transaksi,
        "status_faktur": status_faktur,
        "tanggal_faktur": tanggal_faktur,
        "masa_pajak": masa_pajak,
        "tahun_pajak": tahun_pajak,
        "npwp_penjual": npwp_penjual,
        "nama_penjual": nama_penjual,
        "alamat_penjual": alamat_penjual,
        "npwp_pembeli": npwp_pembeli,
        "nama_pembeli": nama_pembeli,
        "alamat_pembeli": alamat_pembeli,
        "dpp": round(dpp, 2),
        "ppn": round(ppn, 2),
        "ppnbm": round(ppnbm, 2),
        "total": round(dpp + ppn + ppnbm, 2),
        "lines": lines,
        "outlet_id": outlet_id,
        "currency": currency or "IDR",
        "notes": notes,
        "export_jobs": [],   # list of export_job ids that included this faktur
        "status": "draft",   # draft | exported | cancelled
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": created_by,
    }


def make_export_job(
    *,
    job_type: str,          # keluaran | masukan | all
    period: str,            # YYYY-MM
    formats: list,          # ["csv", "xml"]
    faktur_count: int,
    total_dpp: float,
    total_ppn: float,
    files: dict,            # {"csv_keluaran": "...", "xml_keluaran": "...", ...}
    created_by: Optional[str],
) -> dict:
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "job_type": job_type,
        "period": period,
        "formats": formats,
        "faktur_count": faktur_count,
        "total_dpp": round(total_dpp, 2),
        "total_ppn": round(total_ppn, 2),
        "files": files,
        "status": "done",
        "created_at": now,
        "created_by": created_by,
    }
