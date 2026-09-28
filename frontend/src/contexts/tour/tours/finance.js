/** Finance portal tour definitions — Full specific coverage including all sub-pages. */

// ─── Finance Home ──────────────────────────────────────────────────
const financeHomeTour = {
  name: "Finance Home",
  description: "Validasi sales, AP ledger, journals, dan approvals.",
  steps: [
    {
      target: "[data-testid='finance-welcome']",
      title: "Finance Overview",
      content: "Pusat **kontrol finansial**: validasi sales, AP ledger, journal entries, payments. Periode aktif ditunjukkan di header.",
      placement: "bottom",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='finance-kpi-strip']",
      title: "KPI Finance",
      content: "**4 KPI utama**:\n\n• **Pending Validation** — daily sales menunggu finance\n• **Journal This Period** — JAE bulan aktif\n• **AP Exposure** — total hutang ke vendor\n• **Rejected DS** — daily sales yang perlu fix",
      placement: "bottom",
    },
    {
      target: "[data-testid='fin-qa-validate']",
      title: "Validate Sales Queue",
      content: "Klik untuk masuk queue **validasi daily sales** dari outlet. Validasi cepat menjaga TB akurat.",
      placement: "right",
    },
    {
      target: "[data-testid='fin-qa-manual']",
      title: "Manual Journal Entry",
      content: "Buat **JAE manual** untuk koreksi/penyesuaian. Sistem enforce **Dr = Cr** sebelum post.",
      placement: "right",
    },
    {
      target: "[data-testid='fin-qa-pl']",
      title: "Profit & Loss",
      content: "Laporan **P&L** matrix bulan x periode YTD. Drill-down ke transaksi level dari tiap cell.",
      placement: "left",
    },
  ],
};

// ─── Sales Validation Queue ────────────────────────────────────────
const financeValidationTour = {
  name: "Sales Validation Queue",
  description: "Review dan validasi daily sales dari semua outlet.",
  steps: [
    {
      target: "[data-testid='validation-queue-page']",
      title: "Sales Validation Queue",
      content: "Antrian **validasi daily sales** dari semua outlet. Finance Manager harus validasi setiap laporan sebelum journal entries di-post.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='vq-header-card']",
      title: "Filter & Actions",
      content: "Filter berdasarkan outlet dan tanggal. Klik **Validate** untuk approve laporan — journal entries otomatis ter-post ke GL.",
      placement: "bottom",
    },
    {
      target: "[data-testid='vq-table-card']",
      title: "Detail Laporan",
      content: "Setiap baris = satu daily sales report dari outlet. Klik **View** untuk lihat breakdown per channel dan payment method sebelum validasi.",
      placement: "top",
    },
    {
      target: "[data-testid='vq-table-card']",
      title: "Reject & Feedback",
      content: "Jika laporan tidak akurat, klik **Reject** dan tulis alasan. Outlet manager akan di-notifikasi untuk perbaikan dan submit ulang.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Manual Journal Entry ────────────────────────────────────────
const financeManualJournalTour = {
  name: "Manual Journal Entry",
  description: "Buat jurnal akuntansi manual dengan validasi Dr=Cr.",
  steps: [
    {
      target: "[data-testid='mje-page']",
      title: "Manual Journal Entry",
      content: "Buat **jurnal akuntansi manual** untuk koreksi, penyesuaian, atau transaksi yang tidak masuk via auto-journal.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='mje-date']",
      title: "Tanggal & Deskripsi",
      content: "Pilih **tanggal** posting (harus dalam periode aktif). Isi **deskripsi** yang jelas untuk audit trail.",
      placement: "bottom",
    },
    {
      target: "[data-testid='mje-lines-table']",
      title: "Baris Debit/Kredit",
      content: "Tambah baris dengan tombol **+ Baris**. Setiap baris: pilih COA, isi Debit atau Kredit (tidak keduanya), tambah memo dan outlet.",
      placement: "top",
    },
    {
      target: "[data-testid='mje-save']",
      title: "Posting JE",
      content: "**Post** hanya aktif jika **Dr = Cr** (balanced). JE yang sudah dipost bisa di-**reverse** jika ada kesalahan — system buat JE kebalikan otomatis.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── AP Aging ──────────────────────────────────────────────────────
const financeAPTour = {
  name: "AP Aging — Hutang Dagang",
  description: "Pantau dan kelola hutang ke vendor dengan aging analysis.",
  steps: [
    {
      target: "[data-testid='ap-aging-page']",
      title: "AP Aging Ledger",
      content: "Monitor **hutang dagang** ke semua vendor. Aging mengelompokkan hutang berdasarkan umur: Current, 1-30hr, 31-60hr, dan >60hr.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='ap-toolbar']",
      title: "Filter & Export",
      content: "Set **As of Date** untuk lihat posisi AP di tanggal tertentu. Klik **Export** untuk download CSV untuk rekonsiliasi eksternal.",
      placement: "bottom",
    },
    {
      target: "[data-testid='ap-buckets']",
      title: "Aging Buckets",
      content: "**5 bucket aging**:\n\n• **Current** — belum jatuh tempo\n• **1–30 hr** — lewat 1-30 hari\n• **31–60 hr** — risiko medium\n• **>60 hr** — butuh tindakan segera\n\nKlik bucket untuk filter tabel otomatis.",
      placement: "bottom",
    },
    {
      target: "[data-testid='ap-aging-table']",
      title: "Detail per Vendor",
      content: "Setiap baris = satu vendor. Klik baris untuk lihat **GR/PO detail** yang belum dibayar. Siapkan Payment Request dari sini.",
      placement: "top",
    },
    {
      target: "[data-testid='ap-grand-total']",
      title: "Grand Total AP",
      content: "Total hutang ke semua vendor pada tanggal yang dipilih. Angka ini harus **match dengan saldo COA AP** di Balance Sheet.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Journal List ────────────────────────────────────────────────
const financeJournalsTour = {
  name: "Journal Entries — Daftar JAE",
  description: "Lihat, filter, dan buat journal entries akuntansi.",
  steps: [
    {
      target: "[data-testid='journal-list-page']",
      title: "Journal Entries",
      content: "Daftar semua **journal entries** — auto-generated (dari DS, GR, payroll) maupun manual. Double-entry accounting terjamin.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='je-filter-card']",
      title: "Filter Jurnal",
      content: "Filter berdasarkan:\n\n• **Periode** (bulan akuntansi)\n• **Source** (DS/PROC/INV/MANUAL/PAYROLL)\n• **Search** (doc no / deskripsi)",
      placement: "bottom",
    },
    {
      target: "[data-testid='je-source']",
      title: "Source Journal",
      content: "**Source** menunjukkan asal auto-journal:\n\n• **DS** — dari daily sales\n• **PROC** — dari GR procurement\n• **INV** — dari movement inventory\n• **MANUAL** — input finance",
      placement: "right",
    },
    {
      target: "[data-testid='je-new']",
      title: "Buat Manual JAE",
      content: "Klik **+ JAE Manual** untuk jurnal koreksi/penyesuaian. Sistem enforce **Dr = Cr** sebelum bisa di-post.",
      placement: "left",
    },
    {
      target: "[data-testid='je-list-card']",
      title: "Klik Baris untuk Detail",
      content: "Klik baris journal untuk lihat detail baris Dr/Cr lengkap. Dari detail, bisa **reverse** journal jika ada kesalahan input.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Payment Request List ────────────────────────────────────────
const financePaymentRequestsTour = {
  name: "Payment Requests — Tagihan ke Finance",
  description: "Daftar semua payment request yang diajukan ke Finance.",
  steps: [
    {
      target: "[data-testid='payment-request-list-page']",
      title: "Payment Requests",
      content: "Daftar semua **payment request** dari outlet dan procurement. Finance memproses pembayaran setelah request diapprove.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='pr-stats-cards']",
      title: "Stats Overview",
      content: "Ringkasan: **Total Pending** (menunggu approval), **Approved** (siap bayar), **Paid MTD**, dan **Total Outstanding**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='pr-filter-card']",
      title: "Filter Requests",
      content: "Filter berdasarkan **status** (Pending/Approved/Paid/Rejected), tanggal, dan outlet. Berguna untuk daily reconciliation.",
      placement: "bottom",
    },
    {
      target: "[data-testid='pr-create']",
      title: "Buat Payment Request",
      content: "Klik **+ Buat** untuk request pembayaran baru. Link ke AP/GR untuk full traceability. Request masuk approval workflow sebelum diproses.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Payment List ────────────────────────────────────────────────
const financePaymentsTour = {
  name: "Payment Requests — Workflow Pembayaran",
  description: "Kelola payment request: dari draft → approval → paid.",
  steps: [
    {
      target: "[data-testid='payment-list-page']",
      title: "Payment Requests",
      content: "Workflow pembayaran ke vendor. Setiap payment harus melalui **request → approval → paid** sebelum JE otomatis dibuat.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='pay-kpi-strip']",
      title: "KPI Payments",
      content: "Ringkasan: **Total Pending**, **Approved (siap bayar)**, **Paid MTD**, dan **Total Outstanding**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='pay-status-tabs']",
      title: "Filter by Status",
      content: "Tab status:\n\n• **Pending** — menunggu approval\n• **Approved** — siap dibayarkan\n• **Paid** — sudah dibayar\n• **Rejected** — ditolak, perlu revisi",
      placement: "bottom",
    },
    {
      target: "[data-testid='pay-new-btn']",
      title: "Buat Payment Request",
      content: "Klik **New Payment** untuk buat payment request baru. Link ke GR/AP aging untuk traceability lengkap.",
      placement: "left",
    },
    {
      target: "[data-testid='pay-table-card']",
      title: "Aksi per Payment",
      content: "Di tabel: klik **Approve** (jika punya izin) atau **View** untuk lihat detail. Setelah paid, **JE otomatis ter-post** di accounts payable.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Bank Reconciliation ─────────────────────────────────────────
const financeBankReconTour = {
  name: "Bank Reconciliation",
  description: "Upload mutasi rekening dan cocokkan dengan journal entries.",
  steps: [
    {
      target: "body",
      title: "Bank Reconciliation",
      content: "Cocokkan **mutasi rekening bank** dengan journal entries di sistem. Identifikasi transaksi yang belum ter-posting atau ada discrepancy.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='br-new-upload']",
      title: "Upload Mutasi",
      content: "Upload file **CSV mutasi rekening** dari internet banking. Sistem auto-parse format standar bank Indonesia.",
      placement: "bottom",
    },
    {
      target: "body",
      title: "Proses Matching",
      content: "Sistem otomatis match berdasarkan **jumlah** dan **tanggal** (toleransi ±3 hari). Klik **Match** manual untuk transaksi yang tidak ter-match otomatis.",
      placement: "center",
    },
    {
      target: "[data-testid='br-commit']",
      title: "Commit Rekonsiliasi",
      content: "Klik **Commit** setelah semua match selesai. Transaksi unmatched bisa di-mark sebagai **exception** dengan catatan alasan.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── AR Invoices ──────────────────────────────────────────────────
const financeARInvoicesTour = {
  name: "AR Invoices — Piutang Dagang",
  description: "Kelola invoice ke customer B2B dan aging piutang.",
  steps: [
    {
      target: "[data-testid='ar-invoice-list']",
      title: "AR Invoices",
      content: "Kelola **piutang dagang** dari customer B2B (katering, event, dll). Track invoice yang belum dibayar dengan aging analysis.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='ar-kpi-strip']",
      title: "KPI AR",
      content: "• **Total Invoices** — jumlah invoice aktif\n• **Outstanding** — total piutang belum dibayar\n• **Overdue** — piutang lewat jatuh tempo\n• **Paid MTD** — pembayaran diterima bulan ini",
      placement: "bottom",
    },
    {
      target: "[data-testid='ar-tabs']",
      title: "4 Tab AR",
      content: "• **Invoices** — daftar invoice dengan status\n• **Customers** — master customer B2B\n• **Aging Report** — aging analysis piutang\n• **Rekonsiliasi** — cocokkan pembayaran yang diterima",
      placement: "bottom",
    },
    {
      target: "[data-testid='create-invoice-btn']",
      title: "Buat Invoice",
      content: "Klik **+ Invoice** untuk buat invoice ke customer. Isi detail, nominal, dan jatuh tempo. Invoice otomatis ter-journal sebagai piutang.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Trial Balance ────────────────────────────────────────────────
const financeTrialBalanceTour = {
  name: "Trial Balance",
  description: "Neraca saldo semua akun COA untuk cek keseimbangan buku.",
  steps: [
    {
      target: "[data-testid='trial-balance-page']",
      title: "Trial Balance",
      content: "**Neraca Saldo** semua akun COA per periode. Jumlah total Debit harus sama dengan total Kredit — jika tidak, ada error di jurnal.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='tb-filter-card']",
      title: "Filter & Export",
      content: "Pilih **periode** (bulan akuntansi) dan **outlet** (All atau spesifik). Export ke CSV untuk rekonsiliasi eksternal dengan akuntan.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tb-balance-status']",
      title: "Status Balance",
      content: "**Hijau** = TB balance (Dr = Cr). **Amber/Merah** = ada discrepancy yang perlu diselidiki. Investigasi journal entries untuk temukan sumber masalah.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tb-table-card']",
      title: "Baca TB",
      content: "Klik baris akun untuk drill-down ke semua jurnal yang mempengaruhi akun tersebut di periode yang dipilih.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Balance Sheet ────────────────────────────────────────────────
const financeBalanceSheetTour = {
  name: "Balance Sheet — Neraca Keuangan",
  description: "Laporan posisi keuangan: Aset, Kewajiban, dan Ekuitas.",
  steps: [
    {
      target: "[data-testid='balance-sheet-page']",
      title: "Balance Sheet",
      content: "Laporan **posisi keuangan** FnB Group. Menampilkan Aset = Kewajiban + Ekuitas per tanggal yang dipilih.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='bs-filter-card']",
      title: "As of Date",
      content: "Pilih **tanggal** untuk lihat posisi keuangan di titik waktu tertentu. Berguna untuk laporan bulanan, kuartalan, atau tahunan.",
      placement: "bottom",
    },
    {
      target: "[data-testid='bs-balance-status']",
      title: "Status Balanced",
      content: "**Hijau** = neraca seimbang (Aset = Kewajiban + Ekuitas). Jika tidak seimbang, ada jurnal yang salah atau belum ter-posting.",
      placement: "bottom",
    },
    {
      target: "[data-testid='bs-sections']",
      title: "3 Seksi Neraca",
      content: "**Aset** (kiri atas) — **Kewajiban** (kanan atas) — **Ekuitas** (kanan bawah). Klik akun untuk drill-down ke jurnal pendukungnya.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Cashflow Report ──────────────────────────────────────────────
const financeCashflowTour = {
  name: "Cashflow Statement — Arus Kas",
  description: "Laporan arus kas: operasional, investasi, dan pendanaan.",
  steps: [
    {
      target: "[data-testid='cashflow-report-page']",
      title: "Cashflow Statement",
      content: "Laporan **arus kas** FnB Group per periode. Menampilkan kas masuk dan keluar dari aktivitas operasional, investasi, dan pendanaan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='cf-filter-card']",
      title: "Pilih Periode",
      content: "Pilih **bulan** untuk laporan arus kas. Export ke CSV untuk laporan ke stakeholder atau auditor.",
      placement: "bottom",
    },
    {
      target: "[data-testid='cf-kpi-cards']",
      title: "KPI Arus Kas",
      content: "• **Kas Masuk** — total pemasukan\n• **Kas Keluar** — total pengeluaran\n• **Net Cashflow** — selisih masuk-keluar\n• **Closing Balance** — saldo kas akhir periode",
      placement: "bottom",
    },
    {
      target: "[data-testid='cf-daily-chart-card']",
      title: "Chart Harian",
      content: "Chart arus kas harian untuk lihat **pola cash flow** dalam sebulan. Berguna identifikasi hari-hari dengan cash crunch.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Chart of Accounts ───────────────────────────────────────────
const financeCOATour = {
  name: "Chart of Accounts (COA)",
  description: "Browse dan manage akun-akun buku besar.",
  steps: [
    {
      target: "[data-testid='coa-browser-page']",
      title: "Chart of Accounts",
      content: "Daftar lengkap **akun buku besar** (COA) FnB Group. Setiap transaksi akuntansi di-posting ke salah satu akun ini.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='coa-filter-card']",
      title: "Filter COA",
      content: "Filter berdasarkan **tipe akun** (Aset/Kewajiban/Ekuitas/Pendapatan/Beban). Toggle **Postable Only** untuk lihat akun yang bisa digunakan di jurnal.",
      placement: "bottom",
    },
    {
      target: "[data-testid='coa-table-card']",
      title: "Struktur COA",
      content: "COA memiliki **hierarki**: group account → sub-account → detail account. Hanya **detail account** (postable) yang bisa digunakan di jurnal.",
      placement: "top",
    },
    {
      target: "[data-testid='coa-edit-link']",
      title: "Edit COA",
      content: "Untuk tambah atau edit akun COA, klik link **Edit di Master Data**. Perubahan COA harus dikonsultasikan dengan Finance Manager — salah COA bisa merusak laporan.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Profit & Loss ───────────────────────────────────────────────
const financeProfitLossTour = {
  name: "Profit & Loss — Laporan Laba Rugi",
  description: "Baca dan drill-down laporan P&L per periode dan outlet.",
  steps: [
    {
      target: "body",
      title: "Laporan P&L",
      content: "Laporan **Laba Rugi** menampilkan Revenue − COGS − Opex = Net Profit. Pilih periode dan outlet untuk filter yang spesifik.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Cara Membaca P&L",
      content: "• **Hijau** — nilai positif (revenue/profit)\n• **Merah** — nilai negatif (expense/loss)\n• Klik **sel angka** untuk drill-down ke transaksi asal\n• Column = bulan, Row = akun COA",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Anomaly Feed ─────────────────────────────────────────────────
const financeAnomaliesTour = {
  name: "Anomaly Feed — Deteksi Keuangan",
  description: "Review flag anomali otomatis dari seluruh data keuangan.",
  steps: [
    {
      target: "[data-testid='anomaly-feed-page']",
      title: "Anomaly Feed",
      content: "Sistem secara otomatis mendeteksi **anomali keuangan**: jurnal tidak balance, stok negatif, sales spike, dan hutang overdue.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='anomaly-scan-btn']",
      title: "Scan Manual",
      content: "Klik **Scan Sekarang** untuk jalankan deteksi anomali real-time. Scan otomatis berjalan setiap malam via scheduler.",
      placement: "bottom",
    },
    {
      target: "body",
      title: "Filter Anomali",
      content: "Filter berdasarkan:\n\n• **Tipe** — journal, sales, inventory, AP\n• **Severity** — Critical/High/Medium/Low\n• **Status** — Open/Resolved/Ignored",
      placement: "center",
    },
    {
      target: "body",
      title: "Respons Anomali",
      content: "Klik anomali untuk lihat detail dan **AI explanation** penyebabnya. Klik **Resolve** setelah ditangani, atau **Ignore** jika sudah diketahui dan acceptable.",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Comparatives ────────────────────────────────────────────────
const financeComparativesTour = {
  name: "Period Comparatives",
  description: "Bandingkan performa keuangan antar periode.",
  steps: [
    {
      target: "[data-testid='comparatives-page']",
      title: "Period Comparatives",
      content: "Bandingkan **performa keuangan** antar periode: bulan ini vs bulan lalu, Q1 vs Q2, atau year-over-year.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='comp-period']",
      title: "Pilih Periode Pembanding",
      content: "Pilih 2 periode untuk dibandingkan. Bisa berupa 2 bulan berbeda, 2 kuartal, atau 2 tahun berbeda.",
      placement: "bottom",
    },
    {
      target: "[data-testid='comp-delta']",
      title: "Delta & Trend",
      content: "Kolom **Δ (Delta)** menunjukkan selisih absolut dan persentase perubahan. **Hijau** = membaik, **Merah** = memburuk.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Period Locking ──────────────────────────────────────────────
const financePeriodsLockingTour = {
  name: "Period Locking & Enforcement",
  description: "Cara kelola periode akuntansi dan enforcement locking backdated entries.",
  steps: [
    {
      target: "[data-testid='periods-page']",
      title: "Finance Periods",
      content: "Kelola **periode akuntansi** bulanan. Setiap periode bisa di-lock untuk mencegah perubahan retroaktif.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='periods-table']",
      title: "Status Periode",
      content: "Status periode:\n\n• **Open** — bisa posting transaksi\n• **Locked** — tidak bisa posting (kecuali override permission)\n• **Closed** — full lock untuk audit trail",
      placement: "top",
    },
    {
      target: "[data-testid='period-refresh']",
      title: "Muat Ulang Periode",
      content: "Klik **Refresh** untuk memuat status terbaru. Tombol **Lock** pada tiap baris periode mencegah backdated journal entries — enforcement aktif di seluruh sistem.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Period Closing Hub ──────────────────────────────────────────
const financePeriodClosingHubTour = {
  name: "Period Closing Hub — Tutup Bulan",
  description: "Workflow 4-fase penutupan periode akuntansi bulanan.",
  steps: [
    {
      target: "[data-testid='period-closing-hub']",
      title: "Period Closing Hub",
      content: "Workflow **4 fase** penutupan bulanan yang berurutan. Selesaikan tiap fase sebelum lanjut ke fase berikutnya.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='pc-phase-validation']",
      title: "Fase 1: Validasi",
      content: "Validasi semua daily sales outlet belum ada yang pending/rejected. Semua harus **Approved** sebelum close.",
      placement: "bottom",
    },
    {
      target: "[data-testid='pc-phase-anomaly']",
      title: "Fase 2: Cek Anomali",
      content: "Review flag anomali otomatis:\n\n• Jurnal tidak balance\n• COA salah mapping\n• Stok negatif\n• Hutang overdue",
      placement: "bottom",
    },
    {
      target: "[data-testid='pc-phase-closing']",
      title: "Fase 3: Closing Wizard",
      content: "Generate **closing journal** otomatis: tutup akun pendapatan/beban ke retained earnings. Cek TB Balance Sheet satu kali lagi.",
      placement: "bottom",
    },
    {
      target: "[data-testid='pc-phase-lock']",
      title: "Fase 4: Lock Periode",
      content: "Fase terakhir: **lock periode** agar tidak bisa di-posting lagi. Setelah lock, laporan keuangan final dan tidak bisa diubah.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Finance Payments Hub (consolidated) ──────────────────────────────
const financePaymentsHubTour = {
  name: "Payments Hub",
  description: "Payment Requests, AP, Payments, Runs, Bank Recon & AR kini satu workspace bertab.",
  steps: [
    {
      target: "[data-testid='finance-payments-hub']",
      title: "Payments Hub",
      content: "Semua alur pembayaran & piutang **digabung jadi tabs** — tidak lagi menu terpisah di sidebar.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='payments-tab-payment-requests']",
      title: "Payment Requests",
      content: "Mulai dari **pengajuan pembayaran** → approve → bayar. Titik awal workflow kas keluar.",
      placement: "bottom",
    },
    {
      target: "[data-testid='payments-tab-ap-aging']",
      title: "Accounts Payable",
      content: "Pantau **aging hutang** ke vendor — yang jatuh tempo & overdue.",
      placement: "bottom",
    },
    {
      target: "[data-testid='payments-tab-bank-recon']",
      title: "Bank Reconciliation",
      content: "Cocokkan mutasi rekening dengan jurnal. Tab **AR Invoices** untuk piutang customer.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Finance Reports Hub (consolidated) ───────────────────────────────
const financeReportsHubTour = {
  name: "Reports Hub",
  description: "Trial Balance, P&L, Balance Sheet, Cashflow & Pivot dalam satu tempat bertab.",
  steps: [
    {
      target: "[data-testid='finance-reports-hub']",
      title: "Reports Hub",
      content: "Semua **laporan keuangan** kini jadi tabs di satu halaman — lebih cepat berpindah antar laporan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='reports-tab-trial-balance']",
      title: "Trial Balance",
      content: "**Neraca saldo** seluruh akun COA — titik awal verifikasi pembukuan.",
      placement: "bottom",
    },
    {
      target: "[data-testid='reports-tab-profit-loss']",
      title: "Profit & Loss",
      content: "Laporan **laba rugi** dengan drill-down per kategori pendapatan & beban.",
      placement: "bottom",
    },
    {
      target: "[data-testid='reports-tab-cashflow']",
      title: "Balance Sheet & Cashflow",
      content: "Tab **Balance Sheet** (posisi keuangan) & **Cashflow** (arus kas), plus Period Compare, Custom & Pivot.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Finance Tax Hub ──────────────────────────────────────────────────
const financeTaxHubTour = {
  name: "Tax Center Hub",
  description: "Tax Center, e-Faktur, dan e-Bupot dalam satu workspace pajak.",
  steps: [
    {
      target: "[data-testid='finance-tax-hub']",
      title: "Tax & Compliance",
      content: "Pusat **perpajakan**: hitung PPN/PPh, lalu export ke format DJP.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='tax-tab-tax']",
      title: "Tax Center",
      content: "Ringkasan PPN keluaran/masukan & PPh — basis perhitungan setoran pajak.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tax-tab-efaktur']",
      title: "e-Faktur & e-Bupot",
      content: "Tab **e-Faktur** (PPN) dan **e-Bupot** (PPh) untuk generate file export resmi.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Finance Budget Hub ───────────────────────────────────────────────
const financeBudgetHubTour = {
  name: "Budget Hub",
  description: "Budget vs Actual, Budget Management, dan Forecasting dalam satu tempat.",
  steps: [
    {
      target: "[data-testid='finance-budget-hub']",
      title: "Budget Hub",
      content: "Kelola **anggaran** end-to-end: bandingkan vs realisasi, atur master budget, dan forecast.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='budget-tab-vs-actual']",
      title: "Budget vs Actual",
      content: "Bandingkan **anggaran vs realisasi** per akun/periode — temukan varians signifikan.",
      placement: "bottom",
    },
    {
      target: "[data-testid='budget-tab-forecasting']",
      title: "Management & Forecasting",
      content: "Tab **Management** untuk set budget, **Forecasting** untuk proyeksi berbasis tren.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Finance Fixed Assets ─────────────────────────────────────────────
const financeAssetsTour = {
  name: "Fixed Assets — Aset Tetap",
  description: "Kelola aset tetap, nilai buku, dan penyusutan.",
  steps: [
    {
      target: "[data-testid='fixed-asset-list']",
      title: "Daftar Aset Tetap",
      content: "Register **aset tetap** perusahaan: harga perolehan, akumulasi penyusutan, dan nilai buku.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='asset-summary-cards']",
      title: "Ringkasan Nilai",
      content: "Kartu total: **Harga Perolehan**, **Nilai Buku**, dan **Akumulasi Penyusutan** seluruh aset.",
      placement: "bottom",
    },
    {
      target: "[data-testid='category-filter']",
      title: "Filter Kategori",
      content: "Saring per **kategori** (kendaraan, peralatan dapur, dll) dan **status** aset.",
      placement: "bottom",
    },
    {
      target: "[data-testid='add-asset-btn']",
      title: "Tambah Aset",
      content: "Klik untuk **registrasi aset baru** — isi harga, tanggal perolehan, dan metode penyusutan.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Cash Position ────────────────────────────────────────────────────
const financeCashPositionTour = {
  name: "Cash Position",
  description: "Posisi kas real-time, proyeksi runway, dan rencana kas.",
  steps: [
    { target: "[data-testid='cash-position-page']", title: "Cash Position", content: "Posisi **kas** group: saldo, kewajiban jatuh tempo, dan **runway** (berapa lama kas bertahan).", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='cash-kpi-strip']", title: "KPI Kas", content: "Net cash, AP jatuh tempo, kas setelah AP, dan estimasi runway dalam hari.", placement: "bottom" },
    { target: "[data-testid='cash-health-banner']", title: "Status Kesehatan Kas", content: "Indikator cepat: aman / waspada / kritis berdasarkan runway & kewajiban.", placement: "bottom" },
    { target: "[data-testid='cash-create-btn']", title: "Catat Rencana Kas", content: "Tambah proyeksi penerimaan/pengeluaran agar forecast kas lebih akurat.", placement: "left", variant: "tip" },
  ],
};

// ─── Vendor Scorecard (Finance) ───────────────────────────────────────
const financeVendorScorecardTour = {
  name: "Vendor Scorecard",
  description: "Peringkat performa vendor dari sisi finance (nilai & ketepatan).",
  steps: [
    { target: "[data-testid='vendor-scorecard-page']", title: "Vendor Scorecard", content: "Nilai performa vendor berdasarkan histori PO & pembayaran untuk evaluasi kemitraan.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='scorecard-from']", title: "Rentang Periode", content: "Pilih periode evaluasi (From–To) untuk menilai vendor pada jendela waktu tertentu.", placement: "bottom" },
    { target: "[data-testid='scorecard-export']", title: "Export", content: "Export scorecard untuk review meeting procurement/finance.", placement: "left", variant: "tip" },
  ],
};

// ─── Reservation Deposits (Finance) ───────────────────────────────────
const financeReservationDepositsTour = {
  name: "Deposit Reservasi",
  description: "Rekap deposit reservasi outlet sebagai kewajiban (titipan tamu).",
  steps: [
    { target: "[data-testid='reservation-deposits-page']", title: "Deposit Reservasi", content: "Pantau **deposit reservasi** yang diterima outlet — diakui sebagai kewajiban hingga acara berlangsung.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='deposits-summary-cards']", title: "Ringkasan Deposit", content: "Total deposit aktif & per status untuk periode terpilih.", placement: "bottom" },
    { target: "[data-testid='deposits-period-selector']", title: "Filter Periode", content: "Saring berdasarkan periode untuk rekonsiliasi bulanan.", placement: "bottom", variant: "tip" },
  ],
};

// ─── Payment Runs ─────────────────────────────────────────────────────
const financePaymentRunsTour = {
  name: "Payment Runs",
  description: "Proses pembayaran batch ke banyak vendor sekaligus.",
  steps: [
    { target: "[data-testid='payment-run-list-page']", title: "Payment Runs", content: "Jalankan **pembayaran batch** — gabungkan banyak tagihan jadi satu run untuk efisiensi.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='prn-kpi-strip']", title: "Ringkasan Run", content: "Nilai & jumlah run per status (draft, approved, paid).", placement: "bottom" },
    { target: "[data-testid='prn-create-btn']", title: "Buat Run Baru", content: "Buat run dari tagihan terpilih, atau dari **template** untuk run rutin.", placement: "left", variant: "tip" },
  ],
};

// ─── Payment Run Templates ────────────────────────────────────────────
const financePaymentRunTemplatesTour = {
  name: "Payment Run Templates",
  description: "Template untuk pembayaran batch berulang.",
  steps: [
    { target: "[data-testid='prn-template-list-page']", title: "Run Templates", content: "Simpan konfigurasi run yang sering dipakai sebagai **template** — bayar rutin lebih cepat.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='prn-tmpl-create-btn']", title: "Buat Template", content: "Definisikan vendor/akun & kriteria, lalu apply kapan saja untuk membuat run instan.", placement: "left", variant: "tip" },
  ],
};

// ─── Forecasting ──────────────────────────────────────────────────────
const financeForecastingTour = {
  name: "Forecasting",
  description: "Proyeksi keuangan berbasis tren historis.",
  steps: [
    { target: "[data-testid='forecasting-page']", title: "Forecasting", content: "Proyeksi **arus & performa** ke depan berdasarkan tren data historis.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='forecast-history-days']", title: "Basis Historis", content: "Atur jumlah hari historis yang dipakai sebagai dasar proyeksi.", placement: "bottom" },
    { target: "[data-testid='forecast-chart']", title: "Kurva Proyeksi", content: "Grafik aktual vs proyeksi — bantu antisipasi kebutuhan kas/pembelian.", placement: "top", variant: "tip" },
  ],
};

// ─── Budget vs Actual ─────────────────────────────────────────────────
const financeBudgetVsActualTour = {
  name: "Budget vs Actual",
  description: "Bandingkan anggaran vs realisasi per akun/periode.",
  steps: [
    { target: "[data-testid='budget-vs-actual']", title: "Budget vs Actual", content: "Bandingkan **anggaran vs realisasi** — deteksi varians signifikan lebih awal.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='scope-select']", title: "Scope & Filter", content: "Pilih scope (group/brand/outlet), periode, dan level untuk fokus analisis.", placement: "bottom" },
    { target: "[data-testid='category-summary']", title: "Ringkasan per Kategori", content: "Lihat varians per kategori; klik untuk drill ke detail COA.", placement: "top", variant: "tip" },
  ],
};

// ─── e-Faktur Export ──────────────────────────────────────────────────
const financeEFakturTour = {
  name: "e-Faktur Export",
  description: "Generate file e-Faktur PPN untuk DJP.",
  steps: [
    { target: "[data-testid='efaktur-export']", title: "e-Faktur", content: "Buat file **e-Faktur** (PPN keluaran/masukan) sesuai format DJP.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='period-input']", title: "Periode & Jenis", content: "Pilih masa pajak dan jenis faktur sebelum generate.", placement: "bottom" },
    { target: "[data-testid='generate-btn']", title: "Preview & Generate", content: "Klik **Preview** lalu **Generate** — unduh CSV/XML untuk diunggah ke aplikasi DJP.", placement: "left", variant: "tip" },
  ],
};

// ─── e-Bupot Export ───────────────────────────────────────────────────
const financeEBupotTour = {
  name: "e-Bupot Export",
  description: "Generate bukti potong PPh (e-Bupot).",
  steps: [
    { target: "[data-testid='ebupot-export-page']", title: "e-Bupot", content: "Buat **bukti potong PPh** (e-Bupot) untuk pelaporan pajak penghasilan.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='ebupot-export-btn']", title: "Generate", content: "Pilih periode lalu generate file e-Bupot untuk diunggah ke DJP.", placement: "left", variant: "tip" },
  ],
};

export {
  financeHomeTour,
  financeValidationTour,
  financeManualJournalTour,
  financeAPTour,
  financeJournalsTour,
  financePaymentRequestsTour,
  financePaymentsTour,
  financeBankReconTour,
  financeARInvoicesTour,
  financeTrialBalanceTour,
  financeBalanceSheetTour,
  financeCashflowTour,
  financeCOATour,
  financeProfitLossTour,
  financeAnomaliesTour,
  financeComparativesTour,
  financePeriodsLockingTour,
  financePeriodClosingHubTour,
  financePaymentsHubTour,
  financeReportsHubTour,
  financeTaxHubTour,
  financeBudgetHubTour,
  financeAssetsTour,
  financeCashPositionTour,
  financeVendorScorecardTour,
  financeReservationDepositsTour,
  financePaymentRunsTour,
  financePaymentRunTemplatesTour,
  financeForecastingTour,
  financeBudgetVsActualTour,
  financeEFakturTour,
  financeEBupotTour,
};
