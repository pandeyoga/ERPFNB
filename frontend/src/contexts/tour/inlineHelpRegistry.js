/**
 * inlineHelpRegistry.js — Centralized registry for InlineHelp content.
 * Key = helpId string, value = { title, content }
 */

export const inlineHelpRegistry = {
  // ===================== FINANCE =====================
  "ap-aging": {
    title: "AP Aging Report",
    content: "Laporan **AP Aging** menunjukkan hutang usaha yang belum lunas dikelompokkan berdasarkan umur:\n\n• **Current** — belum jatuh tempo\n• **1–30 hari** — lewat jatuh tempo s/d 30 hari\n• **31–60 hari** — lewat 31–60 hari\n• **61–90 hari** — lewat 61–90 hari\n• **>90 hari** — lewat lebih dari 90 hari\n\nGunakan laporan ini untuk prioritas pembayaran vendor.",
  },
  "ap-aging-buckets": {
    title: "AP Aging Buckets",
    content: "Pengelompokan hutang dagang berdasarkan umur:\n\n• **Current** — belum jatuh tempo\n• **1–30 hr** — lewat 1–30 hari\n• **31–60 hr** — risiko medium\n• **>60 hr** — perlu perhatian segera\n\nAging dihitung dari **tanggal GR** (bukan PO).",
  },
  "finance-period-validation": {
    title: "Fase Validasi",
    content: "Pastikan semua **daily sales** dari outlet sudah divalidasi sebelum melanjutkan ke fase berikutnya.\n\n• Status harus **Approved**\n• Tidak ada laporan yang **Rejected** atau **Pending**",
  },
  "finance-period-anomaly": {
    title: "Cek Anomali",
    content: "Review **flag anomali** yang terdeteksi sistem:\n\n• Jurnal tidak balance\n• Stok negatif\n• Hutang overdue\n• COA salah mapping\n\nResolve semua anomali **Critical** sebelum close periode.",
  },
  "finance-period-closing-je": {
    title: "Closing Journal Entry",
    content: "Generate **jurnal penutupan** otomatis:\n\n• Tutup akun pendapatan/beban ke retained earnings\n• Pastikan **Trial Balance** seimbang\n• Cek **Balance Sheet** satu kali lagi sebelum lock",
  },
  "finance-period-lock": {
    title: "Lock Periode",
    content: "Setelah lock, periode **tidak bisa diposting lagi**.\n\n• Laporan keuangan final\n• Tidak bisa diubah (audit trail)\n• Hanya Finance Manager yang bisa unlock dengan alasan",
  },
  "journal-source": {
    title: "Sumber Journal Entry",
    content: "**Source** menunjukkan asal auto-journal:\n\n• **DS** — dari validasi daily sales\n• **PROC** — dari GR/payment procurement\n• **INV** — dari movement inventory\n• **MANUAL** — input manual finance\n• **PAYROLL** — dari proses payroll",
  },
  "period-status": {
    title: "Status Periode Akuntansi",
    content: "• **Open** — bisa posting transaksi baru\n• **Locked** — tidak bisa posting; perlu unlock oleh Finance Manager\n• **Closed** — finalized; audit trail permanent\n\nLock periode setelah semua transaksi sebulan sudah divalidasi.",
  },
  "payment-status": {
    title: "Status Payment Request",
    content: "• **Draft** — belum disubmit\n• **Pending** — menunggu approval\n• **Approved** — siap bayar\n• **Paid** — sudah dibayar, JE ter-post\n• **Rejected** — ditolak, perlu revisi",
  },
  "payment-request-workflow": {
    title: "Workflow Payment Request",
    content: "**Alur lengkap PR dari awal sampai paid:**\n\n1. **Draft** → Buat PR, isi detail items\n2. **Submit** → Kirim untuk approval\n3. **Approve/Reject** → Manager/GM review\n4. **Payment** → Finance eksekusi pembayaran\n5. **Paid** → Auto-post JE (Dr Expense, Cr Bank)",
  },
  "payment-request-period": {
    title: "Period Week",
    content: "Format: **YYYY-WW** (mis: 2026-20)\n\n• Week 1-52 dalam setahun\n• Digunakan untuk weekly cash planning\n• Semua PR dalam 1 minggu di-batch untuk approval",
  },
  "je-dr-cr": {
    title: "Debit = Kredit",
    content: "Sistem enforce **Dr = Cr** (double-entry). JE tidak bisa di-post jika tidak balance.\n\nContoh:\n• Dr: Beban Bahan Baku Rp100k\n• Cr: Kas/Bank Rp100k",
  },
  "manual-journal-coa": {
    title: "Chart of Accounts (COA)",
    content: "Pilih akun dari **Chart of Accounts** untuk setiap line:\n\n• Hanya COA yang **postable** dan **active** yang muncul\n• Format: **Code — Name** (mis: 5101 — Beban Gaji)\n• Pastikan memilih COA yang tepat untuk tipe transaksi",
  },
  "manual-journal-dimensions": {
    title: "Dimensi Outlet & Brand",
    content: "**Opsional** — untuk analitik lebih detail:\n\n• **Outlet** — track per lokasi outlet\n• **Brand** — track per brand produk\n• Digunakan untuk laporan komparatif dan budget variance",
  },
  "manual-journal-memo": {
    title: "Memo Line",
    content: "Catatan per line journal entry:\n\n• Jelaskan detail transaksi spesifik\n• Contoh: \"Bayar listrik Januari\", \"Koreksi stok opname\"\n• Membantu audit trail dan reconciliation",
  },
  "trial-balance-opening": {
    title: "Saldo Opening (Awal)",
    content: "Saldo akun di **awal periode** (sebelum transaksi periode berjalan):\n\n• Sama dengan **closing balance** periode sebelumnya\n• Untuk periode pertama sistem = 0",
  },
  "trial-balance-closing": {
    title: "Saldo Closing (Akhir)",
    content: "Saldo akun di **akhir periode**:\n\n**Formula:**\nClosing = Opening + Period Dr − Period Cr\n\n(untuk normal balance debit)\n\natau\n\nClosing = Opening + Period Cr − Period Dr\n\n(untuk normal balance kredit)",
  },
  "trial-balance-balance": {
    title: "Balance Check",
    content: "Trial Balance harus **balance**:\n\n• Total Period Dr = Total Period Cr\n• Jika tidak balance → ada error posting\n• Cek Journal Entries yang tidak balance atau belum ter-post",
  },

  // ===================== PROCUREMENT =====================
  "pr-source": {
    title: "Sumber Purchase Request",
    content: "• **OUTLET** — dari manajer outlet\n• **INVENTORY** — dari low-stock alert otomatis\n• **MANUAL** — dibuat langsung oleh procurement\n\nPR harus di-approve sebelum bisa dibuatkan PO.",
  },
  "pr-status-workflow": {
    title: "Status Workflow PR",
    content: "**Alur lengkap Purchase Request:**\n\n1. **Draft** → PR dibuat, belum submit\n2. **Submitted** → Menunggu approval manager\n3. **Approved** → Siap dibuatkan PO\n4. **Rejected** → Ditolak, perlu revisi\n5. **Converted** → Sudah dibuatkan PO",
  },
  "po-status": {
    title: "Status Purchase Order",
    content: "• **Draft** — belum dikirim ke vendor\n• **Sent** — sudah dikirim\n• **Partial** — GR sebagian\n• **Received** — GR semua item\n• **Cancelled** — dibatalkan",
  },
  "po-status-workflow": {
    title: "Workflow PO ke GR",
    content: "**Alur dari PO sampai GR:**\n\n1. **Draft** → Buat PO dari PR/manual\n2. **Sent** → Kirim ke vendor (email/print)\n3. **Partial** → Terima barang sebagian (GR partial)\n4. **Received** → Terima semua barang (GR complete)\n\nSetiap GR otomatis:\n• Update stok di inventory\n• Posting jurnal (Dr Expense/Inventory, Cr AP)",
  },
  "gr-je-link": {
    title: "Auto Journal pada GR",
    content: "Saat GR di-post, sistem otomatis buat journal:\n\n• **Dr** Beban/Persediaan (sesuai kategori item)\n• **Cr** AP/Hutang Dagang\n\nJika item adalah inventoriable, stok langsung ter-update.",
  },
  "gr-invoice-no": {
    title: "Invoice Number",
    content: "Nomor invoice dari vendor:\n\n• Wajib diisi untuk matching AP aging\n• Digunakan untuk rekonsiliasi pembayaran\n• Dicatat untuk audit trail",
  },
  "vendor-score": {
    title: "Vendor Score",
    content: "Skor komposit vendor berdasarkan:\n\n• **Harga** (60%) — harga terbaik vs median\n• **Recency** (40%) — seberapa sering digunakan\n• **On-Time** — persentase GR tepat waktu\n• **Defect Rate** — persentase GR dengan masalah",
  },
  "vendor-score-breakdown": {
    title: "Score Breakdown",
    content: "**Excellent (85+)** — Vendor top tier\n**Good (70-84)** — Vendor reliable\n**Average (50-69)** — Perlu improvement\n**Poor (<50)** — Perlu evaluasi\n\nScore dihitung berdasarkan data historis PO & GR dalam periode YTD/QTD/MTD.",
  },
  "vendor-ontime-delivery": {
    title: "On-Time Delivery %",
    content: "Persentase GR yang diterima sesuai **expected delivery date** di PO:\n\n• **≥80%** → Good (hijau)\n• **<80%** → Perlu perhatian (merah)\n\nDihitung dari GR yang sudah ter-post dalam periode.",
  },

  // ===================== INVENTORY =====================
  "moving-avg": {
    title: "Harga Moving Average",
    content: "Nilai stok dihitung dengan **metode moving average**:\n\nHarga baru = (Stok lama × Harga lama + Qty masuk × Harga beli) ÷ Total stok\n\nOtomatis ter-update setiap ada GR atau transfer masuk.",
  },
  "stock-negative": {
    title: "Risiko Stok Negatif",
    content: "Stok negatif terjadi jika:\n• Sales dicatat tanpa GR masuk dulu\n• Transfer keluar melebihi stok\n\nSistem **memperingatkan** tapi tidak memblokir. Segera lakukan adjustment jika muncul.",
  },
  "opname-status": {
    title: "Opname Status Workflow",
    content: "**1. Counting** → Hitung fisik sedang berlangsung\n**2. Submitted** → Selesai hitung, menunggu approval\n**3. Approved** → Approved, siap finalize\n**4. Finalized** → Variance sudah diposting ke stock movement",
  },
  "movement-types": {
    title: "Movement Types",
    content: "• **Receipt** — GR dari vendor (+)\n• **Transfer In** — Transfer dari outlet lain (+)\n• **Transfer Out** — Transfer ke outlet lain (−)\n• **Adjustment** — Koreksi manual (+/−)\n• **Opname Diff** — Variance dari opname (+/−)\n• **Issue** — Usage untuk produksi (−)",
  },
  "stock-balance-view": {
    title: "List vs Matrix View",
    content: "**List View** — Row per item × outlet (detail)\n**Matrix View** — Pivot table: Item di row, Outlet di column dengan heatmap par-level\n\nMatrix view cocok untuk quick scan stok multi-outlet.",
  },
  "opname-variance": {
    title: "Variance Stok Opname",
    content: "**Variance** = Qty Fisik − Qty System\n\n• **Positif** — stok fisik lebih banyak (unexplained gain)\n• **Negatif** — stok fisik lebih sedikit (loss/shrinkage/error)\n\nVariance signifikan (>5%) perlu penjelasan sebelum finalize.",
  },
  "transfer-status": {
    title: "Status Transfer Stok",
    content: "• **Draft** — belum dikirim\n• **In Transit** — sudah dikirim, belum diterima\n• **Received** — diterima outlet tujuan, stok ter-update\n• **Cancelled** — dibatalkan\n\nStok berkurang di outlet asal saat status = **In Transit**.",
  },

  // ===================== OUTLET =====================
  "daily-sales-channel": {
    title: "Sales Channel",
    content: "• **Dine-In** — tamu makan di tempat\n• **Takeaway** — bawa pulang\n• **Delivery** — pesan antar (GoFood/GrabFood/dll)\n• **Online Order** — pre-order via website\n\nPisahkan per channel untuk analitik yang akurat.",
  },
  "outlet-eod-workflow": {
    title: "End-of-Day Workflow",
    content: "Penutupan harian dilakukan dalam **4 langkah berurutan**. Semua langkah harus selesai sebelum submit ke Finance.",
  },
  "outlet-eod-sales": {
    title: "Tutup Sales",
    content: "Pastikan semua transaksi penjualan hari ini sudah diinput:\n\n• Daily sales status **Submitted**\n• Semua channel tercatat (Dine-In, Takeaway, Delivery)\n• Total match dengan struk mesin EDC",
  },
  "outlet-eod-petty-cash": {
    title: "Rekonsiliasi Petty Cash",
    content: "Cek saldo kas kecil:\n\n• **Uang fisik = saldo sistem**\n• Jika ada selisih, catat sebagai adjustment\n• Upload foto nota untuk semua pengeluaran hari ini",
  },
  "outlet-eod-inventory": {
    title: "Cek Stok Kritis",
    content: "Review item yang stoknya **di bawah par level**:\n\n• Buat PR untuk item yang kritis\n• Catat kerusakan/expired jika ada\n• Update waste report",
  },
  "outlet-eod-submit": {
    title: "Submit Laporan",
    content: "Tombol **Selesai** hanya aktif jika semua langkah done.\n\nSetelah submit:\n• Laporan dikirim ke Finance untuk validasi\n• Tidak bisa edit lagi keesokan harinya\n• Finance akan approve/reject esok pagi",
  },
  "petty-cash-purpose": {
    title: "Kategori Petty Cash",
    content: "• **Operasional** — sabun, tisu, dll\n• **Darurat** — pembelian mendadak tanpa PO\n• **Transport** — ongkos kirim\n• **Lain-lain** — wajib ada keterangan\n\nSelalu lampirkan foto nota/struk sebagai bukti.",
  },
  "reservation-status": {
    title: "Status Reservasi",
    content: "• **Pending** — belum dikonfirmasi\n• **Confirmed** — sudah konfirmasi\n• **Waitlist** — penuh, masuk daftar tunggu\n• **Rescheduled** — dijadwal ulang\n• **Completed** — selesai, tamu hadir\n• **Cancelled/No-Show** — tidak hadir",
  },
  "end-of-day-flow": {
    title: "Alur End-of-Day",
    content: "Urutan penutupan harian:\n\n1. **Tutup Sales** — input/finalize daily sales\n2. **Petty Cash** — rekonsiliasi kas kecil\n3. **Orders** — tutup KDO/BDO/FDO\n4. **Daily Close** — submit laporan penutupan\n\nSemua langkah harus diisi sebelum submit.",
  },

  // ===================== HR =====================
  "payroll-net": {
    title: "Take-Home Pay (Net)",
    content: "Net = Gaji Pokok + Allowance − Deductions\n\n• **Allowance**: tunjangan makan, transport, jabatan\n• **Deductions**: BPJS, kasbon, absensi\n\nPayroll di-generate otomatis dari data employee master.",
  },
  "service-charge-dist": {
    title: "Distribusi Service Charge",
    content: "Service charge dari daily sales dibagi ke karyawan berdasarkan:\n\n• **Attendance** (kehadiran hari itu)\n• **Level multiplier** (supervisor dapat lebih)\n• **Outlet** (sesuai outlet asal penjualan)\n\nDistribusi diproses saat period closing.",
  },
  "leave-balance": {
    title: "Saldo Cuti",
    content: "Hak cuti dihitung dari tanggal bergabung:\n\n• **Tahunan**: 12 hari/tahun (pro-rata bulan pertama)\n• **Sakit**: tidak terbatas (perlu surat dokter >2 hari)\n• **Khusus**: pernikahan, duka cita, dll\n\nSaldo otomatis dipotong saat cuti disetujui.",
  },

  // ===================== OWNER/EXECUTIVE =====================
  "cash-position-note": {
    title: "Komposisi Cash Position",
    content: "Total kas group = Bank + Petty Cash + E-Wallet\n\n• **Bank**: saldo rekening perusahaan\n• **Petty Cash**: kas kecil di tiap outlet\n• **E-Wallet**: GoPay/OVO/QRIS business\n\nUpdate otomatis dari payment + daily close.",
  },
  "approval-urgency": {
    title: "Prioritas Approval",
    content: "• 🔴 **Merah** — sudah >2 hari menunggu atau nilai >50 juta\n• 🟡 **Kuning** — >1 hari atau nilai 10–50 juta\n• 🟢 **Hijau** — baru, nilai normal\n\nApproval dari Owner diperlukan untuk PR/PO di atas threshold.",
  },

  // ===================== ADMIN =====================
  "rbac-permission": {
    title: "Format Permission",
    content: "Format: **modul.aksi** atau **modul.sub.aksi**\n\nContoh:\n• `finance.journals.read` — lihat journal\n• `procurement.po.approve` — approve PO\n• `admin.*` — semua aksi admin\n• `*` — super admin (semua akses)",
  },
  "rbac-access-level": {
    title: "Access Level User",
    content: "**Full Access** (hijau) — akses semua outlet & brand\n**Brand-Specific** — akses brand tertentu + outlet dalam brand\n**Outlet Staff** (kuning) — akses outlet yang di-assign saja\n\nDefault outlet = outlet yang muncul pertama kali saat login.",
  },
  "approval-workflow-tier": {
    title: "Approval Tier & Amount",
    content: "Workflow tier berdasarkan **amount bracket**:\n\n• Min Amount: batas bawah\n• Max Amount: batas atas (null = ∞)\n\nSetiap tier punya **multiple steps** (serial approval chain).",
  },
  "approval-workflow-step": {
    title: "Approval Step",
    content: "Setiap step punya **any_of_perms**:\n\n• User yang punya salah satu permission bisa approve\n• Contoh: `[\"finance.manager\", \"gm.approve\"]`\n• Step berjalan **berurutan** (step 1 → step 2 → dst)",
  },
  "audit-log-filter": {
    title: "Filter Audit Log",
    content: "Filter tersedia:\n• **User** — siapa yang melakukan aksi\n• **Action** — create/update/delete/login\n• **Entity** — model yang terpengaruh\n• **Period** — rentang tanggal\n\nAudit log tidak bisa dihapus (immutable).",
  },
  "number-series-format": {
    title: "Number Series Format",
    content: "Format mendukung **template tokens**:\n\n• `{YYYY}` — tahun (2026)\n• `{MM}` — bulan (01-12)\n• `{####}` — sequence number dengan padding\n• Contoh: `PR-{YYYY}{MM}-{####}` → `PR-202605-0001`\n\nReset bisa: `never`, `yearly`, `monthly`.",
  },

  // ===================== HR (EXPANDED) =====================
  "hr-leaves-page": {
    title: "Leave Management",
    content: "Kelola **cuti dan absensi** karyawan:\n\n• **Cuti Saya** — pengajuan cuti sendiri\n• **Approval Queue** — approve cuti bawahan\n\nSaldo cuti otomatis dihitung dari tanggal bergabung dan dipotong saat disetujui.",
  },
  "hr-leaves-balance": {
    title: "Saldo & Jenis Cuti",
    content: "Hak cuti per tahun:\n\n• **Tahunan** — 12 hari (pro-rata bulan pertama)\n• **Sakit** — tidak terbatas (surat dokter >2 hari)\n• **Darurat** — pernikahan, duka cita, kelahiran\n\nSaldo ditampilkan di header form pengajuan.",
  },
  "hr-service-charge-list": {
    title: "Service Charge Periods",
    content: "Setiap periode SC menampilkan:\n\n• **Total Sales** — dasar perhitungan SC\n• **Total SC** — 5% dari net sales (sesuai policy)\n• **Distribusi** — per karyawan berdasarkan kehadiran & level\n\nKlik **Hitung SC** untuk generate distribusi periode baru.",
  },
  "hr-payroll-list": {
    title: "Daftar Siklus Payroll",
    content: "Setiap baris = satu periode payroll:\n\n• **Status Draft** → belum diproses\n• **Status Processing** → sedang dihitung\n• **Status Approved** → siap dibayarkan\n• **Status Paid** → sudah selesai\n\nProses payroll di awal setiap bulan untuk periode bulan sebelumnya.",
  },
  "hr-payroll-period": {
    title: "Periode Payroll",
    content: "Format YYYY-MM (misal: 2026-05).\n\nGunakan **Import Excel** untuk upload salary master dari HR. Data BPJS dan PPh21 dihitung otomatis dari master karyawan.",
  },

  // Phase 5A: Additional HR InlineHelp entries
  "hr-payroll-cycles": {
    title: "Siklus Payroll Bulanan",
    content: "Setiap siklus payroll mencakup:\n\n• **Gaji Pokok** + tunjangan dari salary master\n• **Service Share** (jika ada distribusi)\n• **Incentive** yang di-post bulan ini\n• **Deductions**: kasbon, BPJS, PPh21\n\nGenerate payroll di awal bulan untuk periode bulan sebelumnya.",
  },
  "hr-salary-master": {
    title: "Salary Master Configuration",
    content: "Master komponen gaji per karyawan:\n\n• **Gaji Pokok** — basic salary\n• **Tunjangan** — jabatan, makan, transport, kesehatan\n• **BPJS** — enrolled/tidak + employee share\n• **PTKP Status** — untuk kalkulasi PPh21\n\nImport via Excel untuk bulk update atau edit manual satu-satu.",
  },
  "hr-compensation-hub": {
    title: "Compensation & Benefits Hub",
    content: "Workspace terpusat untuk semua jenis kompensasi karyawan:\n\n• **Payroll** — gaji bulanan\n• **Service Charge** — distribusi SC dari penjualan\n• **Incentive** — bonus & insentif program\n• **Voucher** — voucher internal karyawan\n• **FOC** — meal allowance gratis\n• **Advances** — kasbon\n• **LB Fund** — Lebaran & bonus fund\n\nSemua komponen tercatat untuk audit & rekonsiliasi.",
  },
  "hr-job-applications": {
    title: "Manajemen Lamaran Kerja",
    content: "Kelola lamaran masuk dari portal karir public:\n\n• **Filter** — per status (New, Reviewed, Shortlisted, Rejected, Hired)\n• **Status Update** — ubah status kandidat\n• **Catatan Internal** — notes untuk tim HR\n• **Cover Letter** — lihat motivasi pelamar\n\nData terintegrasi dari form /careers di website public.",
  },
  "hr-job-application-status": {
    title: "Status Lamaran",
    content: "• **Baru** — lamaran baru masuk, belum ditinjau\n• **Ditinjau** — HR sudah review, dalam evaluasi\n• **Kandidat** — masuk shortlist, akan panggil interview\n• **Ditolak** — tidak memenuhi kualifikasi\n• **Diterima** — sudah hired, akan onboarding\n\nUpdate status untuk tracking pipeline recruitment.",
  },
  "hr-incentive-schemes": {
    title: "Incentive Schemes",
    content: "Skema insentif yang bisa dibuat:\n\n• **% of Sales** — persentase dari penjualan (mis: 1%)\n• **Flat per Target** — nominal tetap jika capai target\n• **Tiered Sales** — tier berjenjang (scale up bonus)\n\nSetiap scheme bisa di-assign ke **karyawan spesifik** atau **outlet tertentu**.",
  },
  "hr-incentive-runs": {
    title: "Incentive Calculation Runs",
    content: "Run = proses hitung insentif untuk 1 periode:\n\n• Pilih **scheme** yang akan dijalankan\n• Pilih **period** (YYYY-MM)\n• Sistem hitung berdasarkan actual sales\n• Review hasil → **Post** ke jurnal\n\nSetelah di-post, insentif ter-record di GL dan siap dibayar.",
  },

  // ===================== EXECUTIVE =====================
  "exec-kpi-overview": {
    title: "Executive KPI Overview",
    content: "KPI realtime untuk seluruh grup FnB Group:\n\n• **Sales Today** — total dari semua outlet hari ini\n• **MTD Revenue** — kumulatif bulan berjalan\n• **Gross Profit %** — margin kotor setelah COGS\n• **Inventory Value** — nilai stok terkini\n\nKlik angka untuk drill-down ke sumber data.",
  },
  "exec-live-mode": {
    title: "Live Mode",
    content: "Aktifkan **Live Mode** untuk auto-refresh dashboard setiap 60 detik.\n\nCocok untuk display di layar TV meeting room atau pantau realtime saat event besar.",
  },
  "exec-brand-filter": {
    title: "Filter Brand & Outlet",
    content: "Multi-select brand dan outlet:\n\n• Pilih **semua** untuk group-wide view\n• Filter **1 brand** untuk analisis per brand\n• Filter **1 outlet** untuk performa spesifik\n\nURL otomatis update — bisa di-bookmark atau share ke tim.",
  },

  // ===================== OWNER =====================
  "owner-cockpit-kpi": {
    title: "KPI Kritis Owner",
    content: "4 angka paling penting untuk owner:\n\n• **Cash Today** — total kas group saat ini\n• **MTD Revenue** — pendapatan bulan ini\n• **AP 7 Days** — hutang jatuh tempo 7 hari ke depan\n• **Anomalies** — alert AI yang perlu perhatian\n\nKlik kartu untuk masuk ke detail.",
  },
  "owner-daily-briefing": {
    title: "Daily Briefing AI",
    content: "Ringkasan bisnis harian yang di-generate AI setiap pagi pukul 07.00 WIB.\n\nMencakup:\n• Sales kemarin vs target\n• Outlet terbaik & terburuk\n• Anomali yang perlu ditindaklanjuti\n• Pending approvals hari ini\n\nBisa juga dikirim ke Telegram otomatis.",
  },
  "owner-quick-approvals": {
    title: "Quick Approvals",
    content: "Approve atau reject langsung dari cockpit:\n\n• 🔴 **Prioritas tinggi** — >2 hari atau >Rp50 juta\n• 🟡 **Sedang** — >1 hari atau Rp10–50 juta\n• 🟢 **Normal** — baru masuk\n\nKlik **Approve** / **Reject** tanpa perlu masuk ke halaman detail.",
  },

  // ===================== FINANCE REPORTS HUB =====================
  "finance-reports-hub": {
    title: "Finance Reports Hub",
    content: "Semua laporan keuangan dalam satu workspace:\n\n• **Trial Balance** — saldo semua COA\n• **Profit & Loss** — laporan laba rugi\n• **Balance Sheet** — neraca keuangan\n• **Cashflow** — arus kas\n• **Period Compare** — perbandingan periode\n• **Custom Reports** — laporan kustom\n• **Pivot Analysis** — analisis pivot interaktif\n\nKlik tab untuk beralih antar laporan.",
  },

  // ===================== CMS =====================
  "cms-entity": {
    title: "CMS Entity",
    content: "Setiap entity CMS ditampilkan di website public:\n\n• **Brands** — profil brand (The Coffeeshop, The Bakery, dll)\n• **Menu** — daftar menu per brand\n• **News** — artikel & blog\n• **Outlets** — lokasi outlet\n• **Gallery** — foto-foto brand\n• **Careers** — lowongan kerja",
  },
};

export default inlineHelpRegistry;
