"""Contoh file impor sintetis dengan kebiasaan format sumber nyata (tanpa data asli).

Nama kolom vendor tidak dipublikasikan resmi dan berubah antar versi, jadi contoh ini sengaja beragam: header EN/ID,
kop & baris total, angka format Indonesia/Inggris, tanggal d/m/y, m/d/y, teks bulan, tanpa tahun, datetime Excel,
pemisah ; , tab, encoding Windows, sel gabung, header kosong (CR/DB), kolom ganda, format lebar (channel/bayar per kolom).
Setiap fungsi → (nama_file, bytes, harapan) untuk tes.
"""
from __future__ import annotations

import io
from datetime import datetime


def _xlsx(sheets: dict[str, list[list]], merges: dict[str, list[str]] | None = None) -> bytes:
    import openpyxl
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(name)
        for r in rows:
            ws.append(r)
        for m in (merges or {}).get(name, []):
            ws.merge_cells(m)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def moka_transactions():
    rows = ["Date,Time,Receipt Number,Outlet,Sales Type,Payment Method,Gross Sales,Discounts,Refunds,Net Sales,Gratuity,Tax,Total Collected"]
    data = [("11/20/2026", "10:15 AM", "R-0001", "The Lounge", "Dine In", "Cash", 150000, 0, 0, 150000, 7500, 15750, 173250),
            ("11/20/2026", "12:40 PM", "R-0002", "The Lounge", "Take Away", "QRIS", 80000, 8000, 0, 72000, 0, 7200, 79200),
            ("11/20/2026", "7:05 PM", "R-0003", "The Lounge", "Dine In", "Debit Card", 420000, 20000, 0, 400000, 20000, 42000, 462000),
            ("11/21/2026", "11:00 AM", "R-0004", "The Lounge", "GoFood", "GoFood", 95000, 0, 0, 95000, 0, 9500, 104500)]
    rows += [",".join(str(x) for x in r) for r in data]
    return "moka_transactions.csv", "\n".join(rows).encode(), {"target": "sales", "rows": 4, "total": 818950}


def moka_items():
    rows = ["Date,Time,Receipt Number,Category,Item,Variant,Quantity,Gross Sales,Discounts,Net Sales,Sales Type,Payment Method"]
    data = [("2026-11-20", "10:15", "R-0101", "Makanan", "Nasi Goreng Spesial", "", 2, 90000, 0, 90000, "Dine In", "Cash"),
            ("2026-11-20", "10:15", "R-0101", "Minuman", "Es Teh Manis", "Less Sugar", 2, 30000, 0, 30000, "Dine In", "Cash"),
            ("2026-11-20", "13:20", "R-0102", "Minuman", "Kopi Susu Gula Aren", "", 3, 75000, 7500, 67500, "Take Away", "QRIS"),
            ("2026-11-21", "00:35", "R-0103", "Makanan", "Mie Goreng", "", 1, 40000, 0, 40000, "Dine In", "Cash")]
    rows += [",".join(str(x) for x in r) for r in data]
    return "moka_item_details.csv", "\n".join(rows).encode(), {"target": "sales", "rows": 4, "receipts": 3}


def majoo_detail():
    sheet = [["Laporan Detail Penjualan"], ["Outlet", "The Bistro"], ["Periode", "01/11/2026 - 02/11/2026"], [],
             ["No", "Tanggal", "Jam", "No. Nota", "Tipe Penjualan", "Metode Pembayaran", "Sub Total", "Diskon", "Service", "Pajak", "Total"],
             [1, "01/11/2026", "11.30", "INV/2611/0001", "Dine In", "Tunai", "Rp 125.000", "Rp 0", "Rp 6.250", "Rp 13.125", "Rp 144.375"],
             [2, "01/11/2026", "12.05", "INV/2611/0002", "Bungkus", "QRIS", "Rp 64.000", "Rp 6.400", "Rp 0", "Rp 5.760", "Rp 63.360"],
             [3, "02/11/2026", "19.45", "INV/2611/0003", "Dine In", "Kartu Debit BCA", "Rp 310.000", "Rp 0", "Rp 15.500", "Rp 32.550", "Rp 358.050"],
             [None, None, None, None, None, None, None, None, None, None, None],
             ["Total", None, None, None, None, None, "Rp 499.000", "Rp 6.400", "Rp 21.750", "Rp 51.435", "Rp 565.785"]]
    return "majoo_detail_penjualan.xlsx", _xlsx({"Detail Penjualan": sheet}, {"Detail Penjualan": ["B2:C2"]}), \
        {"target": "sales", "rows": 3, "total": 565785, "outlet_meta": "The Bistro"}


def gofood():
    lines = ["ID Pesanan;Waktu Pesanan;Nama Outlet;Status;Harga Makanan;Promo Ditanggung Merchant;Komisi;Pendapatan Bersih",
             "F-1029384756;25 Nov 2026 12:31;The Lounge - Cihampelas;Selesai;120.000;10.000;22.000;88.000",
             "F-1029384757;25 Nov 2026 18:02;The Lounge - Cihampelas;Selesai;75.500;0;15.100;60.400",
             "F-1029384758;25 Nov 2026 20:15;The Lounge - Cihampelas;Dibatalkan;54.000;0;0;0"]
    return "GoBiz_laporan_transaksi.csv", "\n".join(lines).encode("cp1252"), {"target": "sales", "rows": 3, "void": 1, "source": "GoFood"}


def grabfood():
    rows = [["Booking ID", "Created On", "Store Name", "Order Value", "Commission", "Net Sales", "Status"],
            ["A-5XYZ123", datetime(2026, 11, 24, 13, 5), "The Bistro", 98000, 19600, 78400, "Completed"],
            ["A-5XYZ124", datetime(2026, 11, 24, 21, 40), "The Bistro", 156000, 31200, 124800, "Completed"]]
    return "grabmerchant_transactions.xlsx", _xlsx({"Transactions": rows}), {"target": "sales", "rows": 2, "source": "GrabFood"}


def klikbca():
    text = "\n".join([
        "No. rekening : ,'1234567890",
        "Nama : ,PT FNB GROUP",
        "Periode : ,01/11/2026 - 05/11/2026",
        "Kode Mata Uang : ,IDR",
        ",",
        "Tanggal Transaksi,Keterangan,Cabang,Jumlah,,Saldo",
        "'01/11,TRSF E-BANKING CR 0111/FTSCY/WS95051 1500000.00 GOFOOD SETTLEMENT,'0000,1500000.00,CR,12500000.00",
        "'02/11,BYR VIA E-BANKING 0211 PLN PASCABAYAR,'0000,850000.00,DB,11650000.00",
        "'03/11,KARTU DEBIT 0311 INDOMARET KOPO,'0998,125500.00,DB,11524500.00",
        "PEND,SWITCHING CR TRF ALTO,'0000,250000.00,CR,11774500.00",
        "",
        "Saldo Awal : ,11000000.00",
        "Mutasi Kredit : ,1750000.00,2",
        "Mutasi Debet : ,975500.00,2",
        "Saldo Akhir : ,11774500.00",
    ])
    return "klikbca_mutasi.csv", text.encode(), {"target": "bank", "rows": 3, "net": 1500000 - 850000 - 125500}


def mandiri():
    rows = [["Account No", "Date", "Val. Date", "Transaction Code", "Description", "Description", "Reference No.", "Debit", "Credit"],
            ["1300012345678", "04/11/2026", "04/11/2026", "4002", "TRANSFER DARI", "PT GRAB TEKNOLOGI", "FT2611040001", "", "2.350.000,00"],
            ["1300012345678", "05/11/2026", "05/11/2026", "1508", "BIAYA ADM", "", "", "12.500,00", ""]]
    return "mandiri_mcm.xlsx", _xlsx({"Sheet1": rows}), {"target": "bank", "rows": 2, "net": 2350000 - 12500}


def bri():
    text = "TGL_TRAN,DESK_TRAN,MUTASI_DEBET,MUTASI_KREDIT,SALDO_AKHIR_MUTASI\n" \
           "2026-11-06 08:00:00,SETORAN TUNAI CABANG,0,5000000,25000000\n" \
           "2026-11-06 14:21:00,TRF KE CV DAGING BERKAH,3250000,0,21750000\n"
    return "bri_mutasi.csv", text.encode(), {"target": "bank", "rows": 2, "net": 5000000 - 3250000}


def rekap_manual_wide():
    rows = [["REKAP PENJUALAN HARIAN — THE BAKERY"], [],
            ["Tanggal", "Outlet", "Dine In", "Take Away", "GoFood", "Tunai", "QRIS", "Debit", "Jumlah Transaksi"],
            ["Senin, 2 November 2026", "The Bakery", 1200000, 450000, 300000, 900000, 750000, 300000, 85],
            ["Selasa, 3 November 2026", "The Bakery", 1100000, 500000, 0, 800000, 600000, 200000, 77],
            ["TOTAL", None, 2300000, 950000, 300000, 1700000, 1350000, 500000, 162]]
    return "rekap_harian_manual.xlsx", _xlsx({"Rekap": rows}), {"target": "sales", "rows": 2, "wide": True, "total": 3550000}


def esb_html_xls():
    html = """<html><body><table border=1>
    <tr><th>Business Date</th><th>Bill No</th><th>Branch</th><th>Order Type</th><th>Payment</th><th>Subtotal</th><th>Disc</th><th>Service Charge</th><th>Tax</th><th>Grand Total</th></tr>
    <tr><td>2026-11-22</td><td>B-77001</td><td>Coffeeshop Kemang</td><td>DINE IN</td><td>OVO</td><td>55000</td><td>0</td><td>0</td><td>5500</td><td>60500</td></tr>
    <tr><td>2026-11-22</td><td>B-77002</td><td>Coffeeshop Kemang</td><td>TAKE AWAY</td><td>CASH</td><td>42000</td><td>2000</td><td>0</td><td>4000</td><td>44000</td></tr>
    </table></body></html>"""
    return "esb_sales_report.xls", html.encode(), {"target": "sales", "rows": 2, "total": 104500}


def us_dates_tab():
    text = "Order Date\tOrder #\tLocation\tType\tTender\tAmount\n" \
           "11/23/2026 18:30\t1001\tThe Restaurant\tdine-in\tVisa\t275,500.00\n" \
           "11/23/2026 19:10\t1002\tThe Restaurant\ttakeout\tCash\t98,000.00\n"
    return "export_pos_us.txt", text.encode(), {"target": "sales", "rows": 2, "total": 373500}


def multi_sheet():
    summary = [["Ringkasan"], ["Total Penjualan", 230000]]
    trx = [["Tanggal", "No Struk", "Toko", "Metode Bayar", "Total"],
           ["24/11/2026", "S-1", "The Coffeeshop", "Tunai", "Rp 100.000"],
           ["24/11/2026", "S-2", "The Coffeeshop", "Transfer BCA", "Rp 130.000"]]
    return "laporan_multi_sheet.xlsx", _xlsx({"Ringkasan": summary, "Transaksi": trx}), {"target": "sales", "rows": 2, "total": 230000}


def cp1252_semicolon():
    text = "Tanggal;No. Struk;Outlet;Menu;Qty;Harga;Total\n" \
           "23-11-2026;C-01;Café Kemang;Croissant Beurre;2;35.000;70.000\n" \
           "23-11-2026;C-01;Café Kemang;Café Latte;2;38.000;76.000\n"
    return "penjualan_cafe.csv", text.encode("cp1252"), {"target": "sales", "rows": 2, "receipts": 1, "total": 146000}


ALL = [moka_transactions, moka_items, majoo_detail, gofood, grabfood, klikbca, mandiri, bri, rekap_manual_wide,
       esb_html_xls, us_dates_tab, multi_sheet, cp1252_semicolon]
