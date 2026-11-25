"""Kumpulan uji Asisten AI per agen/domain — dijalankan dengan Claude sungguhan lewat `scripts/ai_eval.py` (opt-in,
berbiaya) terhadap backend yang berjalan dengan data demo. `tests/test_ai_quality.py` hanya memeriksa kasus valid.

Kunci `harap`:
- alat: nama alat yang harus dipakai minimal satu (search_actions/run_read/query_data/show_chart/create_report/
  app_guide/open_page/propose_actions/search_knowledge/remember …)
- dataset: id dataset query_data yang harus dipakai (salah satu)
- aksi: "METHOD /path" katalog yang harus dibaca (run_read) atau diusulkan (propose_actions) — salah satu
- usul: True bila jawaban wajib berisi kartu usulan aksi (tidak boleh langsung menulis)
- memuat: regex (case-insensitive) yang harus ada di jawaban; tidak_memuat: regex yang tidak boleh ada
"""

CASES = [
    # Pemandu — cara pakai aplikasi
    {"id": "guide-po", "agen": "pemandu", "pertanyaan": "Bagaimana cara membuat PO dari PR yang sudah disetujui?",
     "harap": {"alat": ["app_guide"], "memuat": [r"\bPO\b"]}},
    {"id": "guide-daily-close", "agen": "pemandu", "pertanyaan": "Di mana saya menutup kas harian toko?",
     "harap": {"alat": ["app_guide", "open_page"]}},
    {"id": "guide-diagnose", "agen": "pemandu", "pertanyaan": "Kenapa jurnal manual saya tidak bisa diposting di periode bulan lalu?",
     "harap": {"alat": ["app_guide", "search_actions", "run_read"], "memuat": [r"periode|lock|kunci"]}},
    # Analis data
    {"id": "analyst-revenue-mtd", "agen": "analis", "pertanyaan": "Berapa penjualan bulan ini per toko? Urutkan dari terbesar.",
     "harap": {"alat": ["query_data"], "dataset": ["sales_daily"], "memuat": [r"Rp"]}},
    {"id": "analyst-channel-chart", "agen": "analis", "pertanyaan": "Tampilkan grafik net sales per channel 30 hari terakhir.",
     "harap": {"alat": ["show_chart"], "dataset": ["sales_channels"]}},
    {"id": "analyst-pnl", "agen": "analis", "pertanyaan": "Laba rugi bulan lalu: revenue, HPP, laba kotor dan margin %.",
     "harap": {"alat": ["run_read", "query_data"], "aksi": ["GET /api/finance/profit-loss"], "memuat": [r"%"]}},
    {"id": "analyst-report-pdf", "agen": "analis", "pertanyaan": "Buatkan laporan PDF pembelian (PO) 30 hari terakhir per supplier.",
     "harap": {"alat": ["create_report"], "dataset": ["purchase_orders", "po_lines"]}},
    {"id": "analyst-export", "agen": "analis", "pertanyaan": "Ekspor data mutasi stok 7 hari terakhir ke Excel.",
     "harap": {"alat": ["query_data"], "dataset": ["inventory_movements"]}},
    # Finance
    {"id": "finance-close", "agen": "finance", "pertanyaan": "Apa saja yang belum beres untuk tutup buku bulan ini?",
     "harap": {"alat": ["run_read"], "aksi": ["GET /api/ai/finance/close/{period}"]}},
    {"id": "finance-ap-due", "agen": "finance", "pertanyaan": "Hutang supplier mana yang sudah jatuh tempo dan berapa totalnya?",
     "harap": {"alat": ["query_data", "run_read"], "dataset": ["ap_invoices"], "memuat": [r"Rp"]}},
    {"id": "finance-anomaly", "agen": "finance", "pertanyaan": "Ada kejanggalan transaksi apa saja minggu ini?",
     "harap": {"alat": ["run_read", "query_data"], "aksi": ["GET /api/anomalies", "POST /api/ai/audit/run"], "dataset": ["anomalies"]}},
    # Purchasing
    {"id": "purch-restock", "agen": "purchasing", "pertanyaan": "Item apa yang perlu di-restock? Buatkan draf PR-nya.",
     "harap": {"aksi": ["GET /api/ai/purchasing/restock", "POST /api/procurement/prs"]}},
    {"id": "purch-offers", "agen": "purchasing", "pertanyaan": "Supplier mana yang menawarkan harga termurah untuk bawang putih?",
     "harap": {"alat": ["query_data", "run_read"], "dataset": ["supplier_offers", "gr_lines"]}},
    # Inventory & outlet
    {"id": "inv-opname", "agen": "inventory", "pertanyaan": "Item apa yang selisih opnamenya paling besar 90 hari terakhir?",
     "harap": {"alat": ["query_data"], "dataset": ["opname_lines"]}},
    {"id": "inv-balance", "agen": "inventory", "pertanyaan": "Berapa stok beras premium di semua toko sekarang?",
     "harap": {"alat": ["run_read"], "aksi": ["GET /api/inventory/balance", "GET /api/inventory/balance-matrix"]}},
    {"id": "outlet-menu-cost", "agen": "outlet", "pertanyaan": "Menu mana yang food cost-nya di atas 35%?",
     "harap": {"alat": ["run_read"], "aksi": ["GET /api/menu/costing"]}},
    # HR
    {"id": "hr-leave", "agen": "hr", "pertanyaan": "Siapa saja yang cuti minggu depan?",
     "harap": {"alat": ["run_read", "query_data"], "aksi": ["GET /api/hr/leaves"], "dataset": ["leave_requests"]}},
    # Pengetahuan & memori
    {"id": "kb-sop", "agen": "pengetahuan", "pertanyaan": "Menurut SOP, berapa modal kas awal saat opening toko?",
     "harap": {"alat": ["search_knowledge"]}},
    {"id": "memory-remember", "agen": "pengetahuan", "pertanyaan": "Ingat ya: supplier sayur utama kita CV Kebun Makmur, kirim tiap Selasa & Jumat.",
     "harap": {"alat": ["remember"]}},
    # Aksi tulis — wajib lewat usulan
    {"id": "act-reservation", "agen": "aksi", "pertanyaan": "Buat reservasi atas nama Budi 4 orang besok jam 19:00 di toko pertama, telepon 081234567890.",
     "harap": {"usul": True, "aksi": ["POST /api/reservations"], "tidak_memuat": [r"sudah (dibuat|tersimpan)"]}},
    {"id": "act-menu", "agen": "aksi", "pertanyaan": "Tambahkan menu baru 'Es Kopi Gula Aren' harga 25000 untuk brand coffeeshop.",
     "harap": {"usul": True, "aksi": ["POST /api/menu/items"]}},
    {"id": "act-item-dup", "agen": "aksi", "pertanyaan": "Tambahkan item master baru 'Bawang Putih Kupas' satuan kg.",
     "harap": {"aksi": ["GET /api/ai/steward/similar", "POST /api/master/{entity}"]}},
    {"id": "act-automation", "agen": "aksi", "pertanyaan": "Tiap Senin jam 7 pagi kirimkan ringkasan penjualan minggu lalu ke saya.",
     "harap": {"usul": True, "aksi": ["POST /api/ai/automations"]}},
    {"id": "act-leave", "agen": "hr", "pertanyaan": "Ajukan cuti tahunan untuk saya tanggal 1-2 bulan depan.",
     "harap": {"usul": True, "aksi": ["POST /api/hr/leaves"]}},
]
