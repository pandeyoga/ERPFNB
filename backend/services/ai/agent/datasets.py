"""Dataset analitik untuk Asisten AI — query aman lintas tabel tanpa menulis kueri Mongo bebas.

Setiap dataset = koleksi + daftar field yang BOLEH dibaca (whitelist; field sensitif seperti hash password tidak pernah
ada di sini) + izin baca (sama dengan endpoint daftar padanannya) + field tanggal & toko. Query dibatasi ke toko yang
boleh diakses pengguna (core.security.scoped_outlet_ids) dan ke brand/toko yang diminta. Agregasi dikerjakan di
Python (pandas) agar mendukung minggu/kuartal/hari-dalam-minggu dan berjalan sama di MongoDB maupun mongomock.

Spesifikasi query (tool `query_data`):
  {dataset, period?: "last_7d"|"mtd"|..., date_from?, date_to?, outlet_ids?, brand_ids?,
   filters?: [{field, op: eq|ne|in|nin|gt|gte|lt|lte|contains|exists, value}],
   group_by?: ["outlet_id", "date:month", ...], metrics?: [{fn: sum|avg|min|max|count|count_distinct|median, field?, as?}],
   fields?: [...] (mode baris mentah), sort?: [{by, dir}], limit?, export?: "xlsx"|"csv"}
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from core.db import get_db
from core.exceptions import ForbiddenError, ValidationError
from core.security import scoped_outlet_ids

WIB = timezone(timedelta(hours=7))
FETCH_CAP = 200_000          # baris maksimum yang diambil untuk agregasi
ROWS_TO_MODEL = 200          # baris hasil maksimum yang dikirim ke model
EXPORT_CAP = 50_000          # baris maksimum di file ekspor
END_OF_DAY = "\uffff"         # "2026-11-25" ≤ "2026-11-25T23:59…" ≤ "2026-11-25" + END_OF_DAY


@dataclass
class F:
    path: str
    type: str = "str"         # str | num | date | bool
    label: str = ""
    lookup: Optional[str] = None


@dataclass
class Dataset:
    id: str
    label: str
    collection: str
    perms_any: list[str]
    fields: dict[str, F]
    description: str = ""
    date_field: Optional[str] = None
    outlet_field: Optional[str] = None
    brand_field: Optional[str] = None
    unwind: Optional[str] = None
    base: dict = field(default_factory=lambda: {"deleted_at": None})
    computed: dict = field(default_factory=dict)   # nama → (fungsi baris, label)
    datetime_dates: bool = False                   # field tanggal disimpan sebagai datetime (bukan string)

    def allowed_for(self, perms: set[str]) -> bool:
        return "*" in perms or any(p in perms for p in self.perms_any)


SALES_PERMS = ["outlet.daily_sales.read", "executive.dashboard.read", "finance.report.profit_loss", "finance.sales.validate"]
GL_PERMS = ["finance.journal_entry.read", "finance.report.profit_loss"]
PO_PERMS = ["procurement.po.create", "procurement.po.approve", "procurement.view", "executive.dashboard.read"]
GR_PERMS = ["procurement.gr.create", "procurement.view", "finance.ap.read", "executive.dashboard.read"]
INV_PERMS = ["inventory.movement.read", "inventory.balance.read", "inventory.view"]
HR_PERMS = ["hr.read", "hr.employee.read"]


def _o(path="outlet_id"):
    return F(path, "str", "Toko", "outlets")


def _b(path="brand_id"):
    return F(path, "str", "Brand", "brands")


DATASETS: dict[str, Dataset] = {d.id: d for d in [
    Dataset("sales_daily", "Penjualan harian per toko", "daily_sales", SALES_PERMS, {
        "sales_date": F("sales_date", "date", "Tanggal"), "outlet_id": _o(), "brand_id": _b(),
        "status": F("status", label="Status (validated = resmi)"),
        "grand_total": F("grand_total", "num", "Penjualan (grand total)"),
        "transaction_count": F("transaction_count", "num", "Jumlah transaksi"),
        "service_charge": F("service_charge", "num", "Service charge"), "tax_amount": F("tax_amount", "num", "Pajak"),
    }, "Satu baris per toko per hari. Angka resmi: status = validated.", "sales_date", "outlet_id", "brand_id"),
    Dataset("sales_channels", "Penjualan per channel (dine-in, GoFood, …)", "daily_sales", SALES_PERMS, {
        "sales_date": F("sales_date", "date", "Tanggal"), "outlet_id": _o(), "brand_id": _b(), "status": F("status"),
        "channel": F("channels.channel", label="Channel"), "gross": F("channels.gross", "num", "Gross"),
        "discount": F("channels.discount", "num", "Diskon"), "net": F("channels.net", "num", "Net"),
    }, "Rincian channel dari laporan penjualan harian.", "sales_date", "outlet_id", "brand_id", unwind="channels"),
    Dataset("sales_payments", "Penjualan per metode bayar", "daily_sales", SALES_PERMS, {
        "sales_date": F("sales_date", "date", "Tanggal"), "outlet_id": _o(), "brand_id": _b(), "status": F("status"),
        "payment_method": F("payment_breakdown.payment_method", label="Metode bayar"),
        "payment_method_id": F("payment_breakdown.payment_method_id", label="ID metode bayar", lookup="payment_methods"),
        "amount": F("payment_breakdown.amount", "num", "Nominal"),
    }, "Rincian pembayaran dari laporan penjualan harian.", "sales_date", "outlet_id", "brand_id",
        unwind="payment_breakdown"),
    Dataset("journal_lines", "Baris jurnal GL (semua akun)", "journal_entries", GL_PERMS, {
        "entry_date": F("entry_date", "date", "Tanggal"), "period": F("period", label="Periode"),
        "doc_no": F("doc_no", label="No. jurnal"), "status": F("status", label="Status (posted = resmi)"),
        "source_type": F("source_type", label="Sumber"), "description": F("description", label="Keterangan"),
        "coa_id": F("lines.coa_id", label="Akun", lookup="coa"), "dr": F("lines.dr", "num", "Debit"),
        "cr": F("lines.cr", "num", "Kredit"), "memo": F("lines.memo", label="Memo"),
        "outlet_id": F("lines.dim_outlet", "str", "Toko", "outlets"), "brand_id": F("lines.dim_brand", "str", "Brand", "brands"),
        "vendor_id": F("lines.dim_vendor", "str", "Vendor", "vendors"),
        "employee_id": F("lines.dim_employee", "str", "Karyawan", "employees"),
        "coa_type": F("_coa_type", label="Tipe akun (revenue/cogs/expense/asset/liability/equity)"),
        "coa_code": F("_coa_code", label="Kode akun"),
    }, "Satu baris per baris jurnal. net = debit − kredit. Untuk Laba Rugi resmi pakai endpoint finance/profit-loss.",
        "entry_date", "lines.dim_outlet", "lines.dim_brand", unwind="lines",
        computed={"net": (lambda r: (r.get("dr") or 0) - (r.get("cr") or 0), "Debit − Kredit")}),
    Dataset("purchase_orders", "Purchase order (header)", "purchase_orders", PO_PERMS, {
        "order_date": F("order_date", "date", "Tanggal PO"), "doc_no": F("doc_no", label="No. PO"),
        "outlet_id": _o(), "vendor_id": F("vendor_id", "str", "Vendor", "vendors"), "status": F("status"),
        "subtotal": F("subtotal", "num", "Subtotal"), "tax_total": F("tax_total", "num", "PPN"),
        "grand_total": F("grand_total", "num", "Total"), "payment_terms_days": F("payment_terms_days", "num", "Termin (hari)"),
    }, "", "order_date", "outlet_id"),
    Dataset("po_lines", "Baris purchase order (per item)", "purchase_orders", PO_PERMS, {
        "order_date": F("order_date", "date", "Tanggal PO"), "doc_no": F("doc_no", label="No. PO"), "outlet_id": _o(),
        "vendor_id": F("vendor_id", "str", "Vendor", "vendors"), "status": F("status"),
        "item_id": F("lines.item_id", "str", "Item", "items"), "item_name": F("lines.item_name", label="Nama item"),
        "qty": F("lines.qty", "num", "Qty"), "unit": F("lines.unit", label="Satuan"),
        "unit_cost": F("lines.unit_cost", "num", "Harga satuan"), "total": F("lines.total", "num", "Total baris"),
    }, "Harga beli per item per vendor. Jangan membandingkan harga beda satuan.", "order_date", "outlet_id",
        unwind="lines"),
    Dataset("gr_lines", "Penerimaan barang (GR) per item", "goods_receipts", GR_PERMS, {
        "receive_date": F("receive_date", "date", "Tanggal terima"), "doc_no": F("doc_no", label="No. GR"),
        "outlet_id": _o(), "vendor_id": F("vendor_id", "str", "Vendor", "vendors"), "status": F("status"),
        "item_id": F("lines.item_id", "str", "Item", "items"), "item_name": F("lines.item_name", label="Nama item"),
        "qty_ordered": F("lines.qty_ordered", "num", "Qty dipesan"), "qty_received": F("lines.qty_received", "num", "Qty diterima"),
        "qty_rejected": F("lines.qty_rejected", "num", "Qty ditolak"), "unit": F("lines.unit", label="Satuan"),
        "unit_cost": F("lines.unit_cost", "num", "Harga satuan"), "total": F("lines.total", "num", "Total"),
    }, "Kualitas & ketepatan supplier (qty ditolak/selisih).", "receive_date", "outlet_id", unwind="lines"),
    Dataset("purchase_requests", "Purchase request", "purchase_requests", ["procurement.pr.read"], {
        "request_date": F("request_date", "date", "Tanggal PR"), "doc_no": F("doc_no", label="No. PR"), "outlet_id": _o(),
        "brand_id": _b(), "status": F("status"), "source": F("source", label="Sumber"),
        "item_id": F("lines.item_id", "str", "Item", "items"), "item_name": F("lines.item_name", label="Nama item"),
        "qty": F("lines.qty", "num", "Qty"), "estimated_price": F("lines.estimated_price", "num", "Estimasi harga"),
    }, "Satu baris per item PR.", "request_date", "outlet_id", "brand_id", unwind="lines"),
    Dataset("ap_invoices", "Hutang (AP) per invoice", "ap_ledgers", ["finance.ap.read"], {
        "invoice_date": F("invoice_date", "date", "Tanggal invoice"), "due_date": F("due_date", "date", "Jatuh tempo"),
        "invoice_no": F("invoice_no", label="No. invoice"), "vendor_id": F("vendor_id", "str", "Vendor", "vendors"),
        "outlet_id": _o(), "status": F("status"), "amount": F("amount", "num", "Nominal"),
        "balance": F("balance", "num", "Sisa"), "ppn_amount": F("ppn_amount", "num", "PPN"),
        "pph23_amount": F("pph23_amount", "num", "PPh 23"),
    }, "Sisa hutang = balance (status open/partial/overdue).", "invoice_date", "outlet_id"),
    Dataset("ar_invoices", "Piutang (AR) per invoice", "ar_invoices", ["finance.ar.read"], {
        "invoice_date": F("invoice_date", "date", "Tanggal invoice"), "due_date": F("due_date", "date", "Jatuh tempo"),
        "invoice_no": F("invoice_no", label="No. invoice"), "customer_name": F("customer_name", label="Pelanggan"),
        "channel": F("channel", label="Channel"), "status": F("status"), "total_amount": F("total_amount", "num", "Total"),
        "paid_amount": F("paid_amount", "num", "Dibayar"), "outstanding": F("outstanding", "num", "Sisa"),
    }, "", "invoice_date", None),
    Dataset("petty_cash", "Kas kecil (petty cash)", "petty_cash_transactions", ["outlet.petty_cash.read", "outlet.daily_sales.read", "finance.cash.read"], {
        "txn_date": F("txn_date", "date", "Tanggal"), "doc_no": F("doc_no", label="No. dokumen"), "outlet_id": _o(),
        "type": F("type", label="Jenis (purchase/replenish/adjustment)"), "amount": F("amount", "num", "Nominal"),
        "description": F("description", label="Keterangan"), "status": F("status"),
        "category_id": F("category_id", "str", "Kategori", "categories"),
    }, "", "txn_date", "outlet_id"),
    Dataset("inventory_movements", "Mutasi stok", "inventory_movements", INV_PERMS, {
        "movement_date": F("movement_date", "date", "Tanggal"), "outlet_id": _o(),
        "item_id": F("item_id", "str", "Item", "items"),
        "movement_type": F("movement_type", label="Jenis (purchase_receive/sale/wastage/transfer_out/adjustment/opening)"),
        "qty": F("qty", "num", "Qty"), "unit_cost": F("unit_cost", "num", "Harga satuan"),
        "total_value": F("total_value", "num", "Nilai"), "ref_doc": F("ref_doc", label="Dokumen"),
    }, "Saldo stok resmi: endpoint inventory/balance & valuation.", "movement_date", "outlet_id"),
    Dataset("transfers", "Transfer stok antar toko (per item)", "transfers", INV_PERMS, {
        "transfer_date": F("transfer_date", "date", "Tanggal"), "doc_no": F("doc_no", label="No. transfer"),
        "outlet_id": F("from_outlet_id", "str", "Toko asal", "outlets"),
        "to_outlet_id": F("to_outlet_id", "str", "Toko tujuan", "outlets"), "status": F("status"),
        "item_id": F("lines.item_id", "str", "Item", "items"), "qty": F("lines.qty", "num", "Qty"),
        "total_cost": F("lines.total_cost", "num", "Nilai"),
    }, "", "transfer_date", "from_outlet_id", unwind="lines"),
    Dataset("kitchen_orders", "Order KDO/BDO (dapur/bar) per item", "kdo_bdo_orders", ["outlet.daily_sales.read", "inventory.view", "outlet_budget.read"], {
        "req_date": F("req_date", "date", "Tanggal"), "doc_no": F("doc_no", label="No. dokumen"), "kind": F("kind", label="KDO/BDO"),
        "outlet_id": _o(), "status": F("status"), "item_id": F("lines.item_id", "str", "Item", "items"),
        "qty": F("lines.qty", "num", "Qty"), "subtotal": F("lines.subtotal", "num", "Nilai"),
    }, "", "req_date", "outlet_id", unwind="lines"),
    Dataset("reservations", "Reservasi", "reservations", ["reservations.read", "crm.view"], {
        "reservation_date": F("reservation_date", "date", "Tanggal"), "reservation_time": F("reservation_time", label="Jam"),
        "outlet_id": _o(), "status": F("status"), "pax": F("pax", "num", "Jumlah tamu"),
        "deposit_amount": F("deposit_amount", "num", "DP"), "occasion": F("occasion", label="Acara"),
        "customer_name": F("customer_name", label="Nama tamu"),
    }, "", "reservation_date", "outlet_id"),
    Dataset("employees", "Karyawan", "employees", HR_PERMS, {
        "code": F("code", label="NIK"), "full_name": F("full_name", label="Nama"), "position": F("position", label="Jabatan"),
        "outlet_id": _o(), "brand_id": _b(), "status": F("status"), "join_date": F("join_date", "date", "Tanggal masuk"),
    }, "", "join_date", "outlet_id", "brand_id"),
    Dataset("leave_requests", "Cuti/izin karyawan", "leave_requests", ["hr.leave.read", "hr.read"], {
        "start_date": F("start_date", "date", "Mulai"), "end_date": F("end_date", "date", "Selesai"),
        "employee_id": F("employee_id", "str", "Karyawan", "employees"), "outlet_id": _o(),
        "leave_type": F("leave_type", label="Jenis"), "days_count": F("days_count", "num", "Hari"), "status": F("status"),
    }, "", "start_date", "outlet_id"),
    Dataset("payroll", "Payroll per karyawan per periode", "payroll_cycles", ["hr.payroll.read"], {
        "period": F("period", label="Periode"), "payroll_date": F("payroll_date", "date", "Tanggal payroll"),
        "outlet_id": _o(), "status": F("status"), "employee_id": F("employees.employee_id", "str", "Karyawan", "employees"),
        "position": F("employees.position", label="Jabatan"), "gross": F("employees.gross", "num", "Gaji kotor"),
        "bpjs_employer": F("employees.bpjs_employer", "num", "BPJS perusahaan"), "pph21": F("employees.pph21", "num", "PPh 21"),
        "take_home": F("employees.take_home", "num", "Take home pay"),
    }, "Biaya tenaga kerja.", "payroll_date", "outlet_id", unwind="employees"),
    Dataset("employee_advances", "Kasbon karyawan", "employee_advances", ["hr.advance.read"], {
        "advance_date": F("advance_date", "date", "Tanggal"), "doc_no": F("doc_no", label="No. dokumen"),
        "employee_id": F("employee_id", "str", "Karyawan", "employees"), "outlet_id": _o(), "status": F("status"),
        "principal": F("principal", "num", "Pokok"), "monthly_installment": F("monthly_installment", "num", "Cicilan/bulan"),
    }, "", "advance_date", "outlet_id"),
    Dataset("customers", "Pelanggan loyalty", "customers", ["crm.customer.read", "admin.loyalty.read", "crm.view"], {
        "loyalty_tier": F("loyalty_tier", label="Tier"), "segment": F("segment", label="Segmen"), "gender": F("gender", label="Gender"),
        "total_spend": F("total_spend", "num", "Total belanja"), "visit_count": F("visit_count", "num", "Kunjungan"),
        "total_points": F("total_points", "num", "Poin"), "is_active": F("is_active", "bool", "Aktif"),
    }, "Tanpa data kontak pribadi (agregat saja).", None, None, base={}),
    Dataset("loyalty_transactions", "Transaksi poin loyalty", "loyalty_transactions", ["loyalty.read", "admin.loyalty.read", "crm.view"], {
        "created_at": F("created_at", "date", "Tanggal"), "outlet_id": _o(), "brand_id": _b(),
        "transaction_type": F("transaction_type", label="Jenis"), "points": F("points", "num", "Poin"),
        "amount": F("amount", "num", "Nominal belanja"), "customer_id": F("customer_id", label="ID pelanggan"),
    }, "", "created_at", "outlet_id", "brand_id", base={}, datetime_dates=True),
    Dataset("fixed_assets", "Aset tetap", "fixed_assets", ["finance.asset.read"], {
        "asset_code": F("asset_code", label="Kode"), "name": F("name", label="Nama"), "category": F("category", label="Kategori"),
        "outlet_id": _o(), "status": F("status"), "acquisition_date": F("acquisition_date", "date", "Tanggal perolehan"),
        "purchase_cost": F("purchase_cost", "num", "Harga perolehan"), "book_value": F("book_value", "num", "Nilai buku"),
        "accumulated_dep": F("accumulated_dep", "num", "Akumulasi penyusutan"),
    }, "", "acquisition_date", "outlet_id"),
    Dataset("outlet_budgets", "Budget toko (KDO/FDO/BDO)", "outlet_budgets", ["outlet_budget.read", "finance.budget.read"], {
        "period_key": F("period_key", label="Periode"), "period_start": F("period_start", "date", "Mulai"),
        "outlet_id": _o(), "brand_id": _b(), "status": F("status"), "kdo_budget": F("kdo_budget", "num", "Budget KDO"),
        "fdo_budget": F("fdo_budget", "num", "Budget FDO"), "bdo_budget": F("bdo_budget", "num", "Budget BDO"),
        "total_budget": F("total_budget", "num", "Total budget"),
    }, "", "period_start", "outlet_id", "brand_id"),
]}

# Kamus metrik: definisi resmi agar angka AI sama dengan laporan.
METRICS = [
    {"id": "revenue", "label": "Penjualan (revenue)", "dataset": "sales_daily",
     "rumus": "sum(grand_total) dengan status = validated", "sumber_resmi": "GET /api/executive/sales-trend, laporan Daily Sales"},
    {"id": "transactions", "label": "Jumlah transaksi", "dataset": "sales_daily", "rumus": "sum(transaction_count), status = validated"},
    {"id": "avg_ticket", "label": "Rata-rata per transaksi", "dataset": "sales_daily", "rumus": "revenue ÷ transactions"},
    {"id": "channel_net", "label": "Net sales per channel", "dataset": "sales_channels", "rumus": "sum(net) per channel, status = validated"},
    {"id": "purchases", "label": "Pembelian (PO)", "dataset": "purchase_orders", "rumus": "sum(grand_total), status bukan draft/cancelled/rejected"},
    {"id": "received_value", "label": "Nilai barang diterima", "dataset": "gr_lines", "rumus": "sum(total)"},
    {"id": "reject_rate", "label": "Tingkat tolak GR", "dataset": "gr_lines", "rumus": "sum(qty_rejected) ÷ sum(qty_received + qty_rejected)"},
    {"id": "pnl", "label": "Laba rugi", "dataset": "journal_lines",
     "rumus": "revenue = −sum(net) akun revenue; cogs/expense = sum(net); status = posted",
     "sumber_resmi": "GET /api/finance/profit-loss (pakai ini untuk angka resmi)"},
    {"id": "food_cost_pct", "label": "Food cost %", "dataset": "journal_lines", "rumus": "sum(net) akun cogs ÷ revenue"},
    {"id": "ap_outstanding", "label": "Hutang belum dibayar", "dataset": "ap_invoices", "rumus": "sum(balance), status open/partial/overdue"},
    {"id": "ar_outstanding", "label": "Piutang belum diterima", "dataset": "ar_invoices", "rumus": "sum(outstanding)"},
    {"id": "labor_cost", "label": "Biaya tenaga kerja", "dataset": "payroll", "rumus": "sum(gross) + sum(bpjs_employer)"},
    {"id": "labor_pct", "label": "Labor cost %", "dataset": "payroll + sales_daily", "rumus": "labor_cost ÷ revenue periode yang sama"},
    {"id": "wastage", "label": "Wastage", "dataset": "inventory_movements", "rumus": "sum(total_value) movement_type = wastage"},
    {"id": "petty_spend", "label": "Belanja kas kecil", "dataset": "petty_cash", "rumus": "sum(amount) type = purchase"},
]

PERIODS = ["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d", "this_week", "last_week",
           "mtd", "last_month", "qtd", "last_quarter", "ytd", "last_year"]


def today_wib() -> date:
    return datetime.now(WIB).date()


def resolve_period(period: str, today: Optional[date] = None) -> tuple[str, str]:
    t = today or today_wib()
    p = (period or "").lower()
    m = re.fullmatch(r"last_(\d+)d", p)
    if p == "today":
        a = b = t
    elif p == "yesterday":
        a = b = t - timedelta(days=1)
    elif m:
        a, b = t - timedelta(days=int(m.group(1)) - 1), t
    elif p == "this_week":
        a, b = t - timedelta(days=t.weekday()), t
    elif p == "last_week":
        a = t - timedelta(days=t.weekday() + 7)
        b = a + timedelta(days=6)
    elif p in ("mtd", "this_month"):
        a, b = t.replace(day=1), t
    elif p == "last_month":
        b = t.replace(day=1) - timedelta(days=1)
        a = b.replace(day=1)
    elif p in ("qtd", "this_quarter"):
        a, b = date(t.year, 3 * ((t.month - 1) // 3) + 1, 1), t
    elif p == "last_quarter":
        q0 = date(t.year, 3 * ((t.month - 1) // 3) + 1, 1)
        b = q0 - timedelta(days=1)
        a = date(b.year, 3 * ((b.month - 1) // 3) + 1, 1)
    elif p in ("ytd", "this_year"):
        a, b = date(t.year, 1, 1), t
    elif p == "last_year":
        a, b = date(t.year - 1, 1, 1), date(t.year - 1, 12, 31)
    else:
        raise ValidationError(f"Periode tidak dikenal: {period}. Pilih: {', '.join(PERIODS)}")
    return a.isoformat(), b.isoformat()


def available(perms: set[str]) -> list[Dataset]:
    return [d for d in DATASETS.values() if d.allowed_for(perms)]


def describe(perms: set[str], dataset_id: Optional[str] = None) -> dict:
    if dataset_id:
        d = _get(dataset_id, perms)
        flds = {k: {"label": f.label or k, "tipe": f.type, **({"nama_otomatis": f"{k}_name"} if f.lookup else {})}
                for k, f in d.fields.items()}
        for k, (_, label) in d.computed.items():
            flds[k] = {"label": label, "tipe": "num", "turunan": True}
        return {"dataset": d.id, "label": d.label, "catatan": d.description, "field_tanggal": d.date_field,
                "punya_toko": bool(d.outlet_field), "fields": flds,
                "metrik_resmi": [m for m in METRICS if m["dataset"].startswith(d.id)]}
    return {"datasets": [{"id": d.id, "label": d.label, "catatan": d.description} for d in available(perms)],
            "kamus_metrik": [m for m in METRICS if any(x.strip() in DATASETS and DATASETS[x.strip()].allowed_for(perms)
                                                        for x in m["dataset"].split("+"))],
            "periode": PERIODS,
            "agregasi": ["sum", "avg", "min", "max", "count", "count_distinct", "median"],
            "group_by_tanggal": ["date:day", "date:week", "date:month", "date:quarter", "date:year", "date:weekday"]}


def _get(dataset_id: str, perms: set[str]) -> Dataset:
    d = DATASETS.get(dataset_id)
    if not d:
        raise ValidationError(f"Dataset tidak dikenal: {dataset_id}. Lihat data_catalog.")
    if not d.allowed_for(perms):
        raise ForbiddenError(f"Anda tidak punya izin membaca {d.label}")
    return d


def _coerce(f: F, v: Any) -> Any:
    if isinstance(v, list):
        return [_coerce(f, x) for x in v]
    if f.type == "num" and v is not None:
        try:
            return float(v)
        except (TypeError, ValueError):
            raise ValidationError(f"Nilai {v!r} bukan angka untuk {f.path}")
    if f.type == "bool" and isinstance(v, str):
        return v.lower() in ("true", "1", "ya", "yes")
    return v


def _cond(f: F, op: str, v: Any) -> Any:
    v = _coerce(f, v)
    if op == "eq":
        return v
    if op in ("ne", "gt", "gte", "lt", "lte"):
        return {f"${op}": v}
    if op in ("in", "nin"):
        return {f"${op}": v if isinstance(v, list) else [v]}
    if op == "contains":
        return {"$regex": re.escape(str(v)), "$options": "i"}
    if op == "exists":
        return {"$nin": [None, ""]} if v in (True, "true", 1, None) else {"$in": [None, ""]}
    raise ValidationError(f"Operator tidak dikenal: {op}")


async def _outlets_of_brands(brand_ids: list[str]) -> list[str]:
    return [o["id"] async for o in get_db().outlets.find({"brand_id": {"$in": brand_ids}}, {"id": 1})]


async def _build_match(d: Dataset, user: dict, spec: dict) -> tuple[dict, dict, dict]:
    """→ (match sebelum unwind, match setelah unwind, ringkasan filter untuk ditampilkan)."""
    pre: dict = dict(d.base)
    post: dict = {}
    applied: dict = {}
    unwound = (lambda path: bool(d.unwind) and path.startswith(d.unwind + "."))

    def put(path: str, cond: Any) -> None:
        # Path di dalam array yang di-unwind juga dipasang sebelum unwind (cocok bila ADA elemen yang cocok) agar
        # dokumen induk tersaring dulu; filter persisnya ada setelah unwind.
        for tgt in ([pre, post] if unwound(path) else [pre]):
            if path in tgt and isinstance(tgt[path], dict) and isinstance(cond, dict):
                tgt[path] = {**tgt[path], **cond}
            else:
                tgt[path] = cond

    if d.date_field:
        df, dt = spec.get("date_from"), spec.get("date_to")
        if spec.get("period"):
            df, dt = resolve_period(spec["period"])
        if df or dt:
            if d.datetime_dates:
                rng = {**({"$gte": datetime.fromisoformat(str(df)[:10])} if df else {}),
                       **({"$lt": datetime.fromisoformat(str(dt)[:10]) + timedelta(days=1)} if dt else {})}
            else:  # tanggal string "YYYY-MM-DD" atau ISO timestamp → sertakan seluruh hari terakhir
                rng = {**({"$gte": str(df)[:10]} if df else {}), **({"$lte": str(dt)[:10] + END_OF_DAY} if dt else {})}
            put(d.date_field, rng)
            applied["periode"] = f"{df or '…'} s/d {dt or '…'}"

    scope = scoped_outlet_ids(user)
    want: Optional[list[str]] = None
    if spec.get("outlet_ids"):
        want = [str(x) for x in spec["outlet_ids"]]
    if spec.get("brand_ids"):
        bo = await _outlets_of_brands([str(x) for x in spec["brand_ids"]])
        want = [o for o in (want or bo) if o in bo]
    if d.outlet_field:
        allowed = want if scope is None else [o for o in (want if want is not None else scope) if o in scope]
        if allowed is not None:
            put(d.outlet_field, {"$in": allowed})
            applied["toko"] = f"{len(allowed)} toko" + (" (dibatasi akses Anda)" if scope is not None else "")
    elif want is not None:
        applied["catatan"] = "dataset ini tidak per toko — filter toko/brand diabaikan"

    for flt in spec.get("filters") or []:
        name = flt.get("field")
        f = d.fields.get(name)
        if not f or f.path.startswith("_"):
            raise ValidationError(f"Field filter tidak dikenal untuk {d.id}: {name}")
        put(f.path, _cond(f, flt.get("op") or "eq", flt.get("value")))
        applied.setdefault("filter", []).append(f"{name} {flt.get('op') or 'eq'} {flt.get('value')}")
    return pre, post, applied


def _dig(doc: dict, path: str) -> Any:
    cur: Any = doc
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


async def _names(kind: str, ids: list) -> dict:
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    db = get_db()
    coll, fmt = {
        "outlets": ("outlets", lambda r: r.get("name")), "brands": ("brands", lambda r: r.get("name")),
        "vendors": ("vendors", lambda r: r.get("name")), "items": ("items", lambda r: r.get("name")),
        "employees": ("employees", lambda r: r.get("full_name")),
        "categories": ("categories", lambda r: r.get("name")),
        "payment_methods": ("payment_methods", lambda r: r.get("name")),
        "coa": ("chart_of_accounts", lambda r: f"{r.get('code')} {r.get('name')}"),
    }[kind]
    return {r["id"]: fmt(r) async for r in db[coll].find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "code": 1, "full_name": 1})}


async def run(user: dict, spec: dict, *, max_rows: int = ROWS_TO_MODEL, for_export: bool = False) -> dict:
    import pandas as pd
    perms = set(user.get("permissions") or [])
    d = _get(str(spec.get("dataset") or ""), perms)
    pre, post, applied = await _build_match(d, user, spec)

    group_by = [str(g) for g in (spec.get("group_by") or [])][:4]
    metrics = list(spec.get("metrics") or [])[:8]
    raw_fields = [str(x) for x in (spec.get("fields") or [])]
    if not group_by and not metrics and not raw_fields:
        raw_fields = [k for k in d.fields if not d.fields[k].path.startswith("_")][:12]

    # field yang dibutuhkan
    date_key = next((k for k, f in d.fields.items() if f.path == d.date_field), None)
    needed: set[str] = set(raw_fields)
    for g in group_by:
        b = g.split(":")[0]
        needed.add(date_key if b == "date" else b)
    for m in metrics:
        if m.get("field"):
            needed.add(str(m["field"]))
    needed.discard(None)
    for n in list(needed):
        if n not in d.fields and n not in d.computed:
            raise ValidationError(f"Field tidak dikenal untuk {d.id}: {n}. Lihat data_catalog(dataset).")
    if "net" in needed and "net" in d.computed:
        needed |= {"dr", "cr"}
    if needed & {"coa_type", "coa_code"}:
        needed.add("coa_id")

    proj = {"_id": 0}
    for n in needed:
        f = d.fields.get(n)
        if f and not f.path.startswith("_"):
            proj[f.path] = 1
    pipeline: list[dict] = [{"$match": pre}]
    if d.unwind:
        pipeline.append({"$unwind": f"${d.unwind}"})
        if post:
            pipeline.append({"$match": post})
    pipeline += [{"$project": proj}, {"$limit": FETCH_CAP + 1}]
    docs = await get_db()[d.collection].aggregate(pipeline).to_list(FETCH_CAP + 1)
    truncated_fetch = len(docs) > FETCH_CAP
    docs = docs[:FETCH_CAP]

    rows = [{n: _dig(doc, d.fields[n].path) for n in needed if n in d.fields and not d.fields[n].path.startswith("_")}
            for doc in docs]
    if needed & {"coa_type", "coa_code"} and rows:
        coa = {r["id"]: r async for r in get_db().chart_of_accounts.find(
            {"id": {"$in": list({r.get("coa_id") for r in rows if r.get("coa_id")})}}, {"_id": 0, "id": 1, "type": 1, "code": 1})}
        for r in rows:
            c = coa.get(r.get("coa_id")) or {}
            r["coa_type"], r["coa_code"] = c.get("type"), c.get("code")
    for k, (fn, _) in d.computed.items():
        if k in needed:
            for r in rows:
                r[k] = fn(r)

    df = pd.DataFrame(rows)
    out_cols: list[str]
    if group_by or metrics:
        keys = []
        for g in group_by:
            b, _, grain = g.partition(":")
            if b == "date" or (grain and d.fields.get(b, F("")).type == "date"):
                src = date_key if b == "date" else b
                s = pd.to_datetime(df[src].astype(str).str[:10], errors="coerce") if src in df else pd.Series(dtype="datetime64[ns]")
                grain = grain or "day"
                col = f"{src}:{grain}"
                df[col] = {"day": lambda x: x.dt.strftime("%Y-%m-%d"), "week": lambda x: (x - pd.to_timedelta(x.dt.weekday, unit="D")).dt.strftime("%Y-%m-%d"),
                           "month": lambda x: x.dt.strftime("%Y-%m"), "quarter": lambda x: x.dt.year.astype("Int64").astype(str) + "-Q" + x.dt.quarter.astype("Int64").astype(str),
                           "year": lambda x: x.dt.strftime("%Y"), "weekday": lambda x: x.dt.weekday.map(
                               {0: "1 Senin", 1: "2 Selasa", 2: "3 Rabu", 3: "4 Kamis", 4: "5 Jumat", 5: "6 Sabtu", 6: "7 Minggu"})}.get(
                    grain, lambda x: x.dt.strftime("%Y-%m-%d"))(s) if len(df) else []
                keys.append(col)
            else:
                if b not in df:
                    df[b] = None
                df[b] = df[b].fillna("(kosong)") if len(df) else df[b]
                keys.append(b)
        aggs = {}
        for i, m in enumerate(metrics or [{"fn": "count"}]):
            fn = str(m.get("fn") or "sum").lower()
            fld = m.get("field")
            name = str(m.get("as") or (f"{fn}_{fld}" if fld else fn))
            if fn not in ("sum", "avg", "mean", "min", "max", "count", "count_distinct", "median"):
                raise ValidationError(f"Agregasi tidak dikenal: {fn}")
            if fld and fld not in df:
                df[fld] = None
            if fn == "count" and not fld:
                df["__one"] = 1
                aggs[name] = ("__one", "sum")
            else:
                if fn not in ("count", "count_distinct") and fld:
                    df[fld] = pd.to_numeric(df[fld], errors="coerce")
                aggs[name] = (fld, {"avg": "mean", "count_distinct": "nunique"}.get(fn, fn))
        if len(df) == 0:
            res = pd.DataFrame(columns=keys + list(aggs))
        elif keys:
            res = df.groupby(keys, dropna=False).agg(**aggs).reset_index()
        else:
            res = pd.DataFrame([{n: getattr(df[c], "nunique" if f == "nunique" else f)() for n, (c, f) in aggs.items()}])
        out_cols = list(res.columns)
        sort = spec.get("sort") or ([{"by": keys[0], "dir": "asc"}] if keys and keys[0].count(":") else
                                    [{"by": list(aggs)[0], "dir": "desc"}])
    else:
        res = df[[c for c in raw_fields if c in df]] if len(df) else pd.DataFrame(columns=raw_fields)
        out_cols = list(res.columns)
        sort = spec.get("sort") or ([{"by": date_key, "dir": "desc"}] if date_key in res else [])
    sb = [s["by"] for s in sort if s.get("by") in res.columns]
    if sb and len(res):
        res = res.sort_values(sb, ascending=[str(s.get("dir", "asc")).lower() != "desc" for s in sort if s.get("by") in res.columns])
    total_rows = len(res)
    limit = EXPORT_CAP if for_export else max(1, min(int(spec.get("limit") or max_rows), max_rows))
    res = res.head(limit)
    records = res.astype(object).where(res.notna(), None).to_dict("records")
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, float):
                r[k] = round(v, 2)
    # nama untuk id (outlet_id → outlet_id_name)
    for col in out_cols:
        f = d.fields.get(col)
        if f and f.lookup:
            names = await _names(f.lookup, [r.get(col) for r in records])
            for r in records:
                r[f"{col}_name"] = names.get(r.get(col), r.get(col))
    return {"dataset": d.id, "label": d.label, "columns": list(records[0].keys()) if records else out_cols,
            "rows": records, "total_rows": total_rows, "rows_shown": len(records),
            "truncated": total_rows > len(records) or truncated_fetch, "fetch_capped": truncated_fetch,
            "filters": applied, "catatan": d.description}


def to_file(result: dict, fmt: str, title: str) -> tuple[bytes, str, str]:
    """Hasil query → (bytes, nama file, content-type)."""
    import io
    import pandas as pd
    df = pd.DataFrame(result["rows"], columns=result["columns"])
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", title or result["dataset"]).strip("_")[:60] or "data"
    stamp = datetime.now(WIB).strftime("%Y%m%d-%H%M")
    if fmt == "csv":
        return df.to_csv(index=False).encode("utf-8-sig"), f"{safe}_{stamp}.csv", "text/csv"
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="xlsxwriter") as xw:
        df.to_excel(xw, index=False, sheet_name="Data", startrow=2)
        ws = xw.sheets["Data"]
        wb = xw.book
        ws.write(0, 0, title or result["label"], wb.add_format({"bold": True, "font_size": 13}))
        ws.write(1, 0, " · ".join(f"{k}: {v}" for k, v in (result.get("filters") or {}).items() if k != "filter")
                 + f" · dibuat {stamp}", wb.add_format({"font_color": "#666666"}))
        num = wb.add_format({"num_format": "#,##0"})
        for i, c in enumerate(df.columns):
            is_num = pd.api.types.is_numeric_dtype(df[c])
            ws.set_column(i, i, 16 if is_num else max(12, min(40, int(df[c].astype(str).str.len().max() or 10) + 2)),
                          num if is_num else None)
        ws.autofilter(2, 0, 2 + len(df), max(0, len(df.columns) - 1))
        ws.freeze_panes(3, 0)
    return buf.getvalue(), f"{safe}_{stamp}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
