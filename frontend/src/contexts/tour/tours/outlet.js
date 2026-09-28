/** Outlet portal tour definitions — Full coverage including Phase D hub pages. */

// ─── Outlet Home ───────────────────────────────────────────────────
const outletHomeTour = {
  name: "Outlet — Workbench Harian",
  description: "Cara memulai hari kerja outlet: tasks, quick actions, dan KPI.",
  steps: [
    {
      target: "[data-testid='outlet-home-page']",
      title: "Selamat Datang di Outlet Portal",
      content: "Pusat operasional harian Anda. Dari sini Anda bisa akses **daily sales**, **petty cash**, **reservasi**, dan **penutupan hari**.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='kpi-strip']",
      title: "KPI Hari Ini",
      content: "Ringkasan performa outlet: **Omzet**, **Total Tamu**, **Reservasi**, dan **Petty Cash Balance**. Update real-time.",
      placement: "bottom",
    },
    {
      target: "[data-testid='today-tasks']",
      title: "Tugas Hari Ini",
      content: "Daftar task yang perlu diselesaikan hari ini. Centang untuk mark done. **End-of-Day tidak bisa disubmit** jika ada task yang belum selesai.",
      placement: "bottom",
    },
    {
      target: "[data-testid='quick-actions']",
      title: "Quick Actions",
      content: "Akses cepat ke halaman yang sering digunakan:\n\n• **Daily Sales** — input penjualan\n• **Petty Cash** — catat pengeluaran\n• **Reservasi** — kelola tamu\n• **End-of-Day** — penutupan harian",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Daily Orders Hub (KDO + BDO + FDO) ────────────────────────────
const outletDailyOrdersHubTour = {
  name: "Daily Orders Hub (KDO, BDO, FDO)",
  description: "Kelola semua purchase orders harian dari satu tempat.",
  steps: [
    {
      target: "[data-testid='daily-orders-hub']",
      title: "Daily Orders Hub",
      content: "Satu halaman untuk semua jenis order harian:\n\n• **KDO** (Kitchen Daily Order) — bahan baku dari gudang\n• **BDO** (Bar Daily Order) — minuman & supplies bar\n• **FDO** (F&B Daily Order) — order ke vendor eksternal",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='daily-orders-tabs']",
      title: "Navigasi Antar Jenis Order",
      content: "Klik tab **KDO**, **BDO**, atau **FDO** untuk beralih. Masing-masing tab memiliki list dan form sendiri sesuai kebutuhan outlet.",
      placement: "bottom",
    },
    {
      target: "[data-testid='daily-orders-content-kdo']",
      title: "Isi Form Order",
      content: "Di setiap tab:\n\n• Klik **+ Buat** untuk order baru\n• Isi item, qty, dan catatan\n• Submit → otomatis jadi **PR** di sistem procurement\n\nSemua order tercatat dan bisa di-track.",
      placement: "top",
    },
    {
      target: "[data-testid='daily-orders-tabs']",
      title: "Tips Penggunaan",
      content: "Buat order **sebelum jam 9 pagi** agar procurement bisa proses di hari yang sama. Untuk order darurat, gunakan **Urgent Purchase** di menu Petty Cash.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── End-of-Day Workflow ────────────────────────────────────────────
const outletEndOfDayWorkflowTour = {
  name: "End-of-Day Workflow (Tutup Hari)",
  description: "Alur penutupan harian outlet dengan 4 langkah berurutan.",
  steps: [
    {
      target: "[data-testid='end-of-day-workflow']",
      title: "End-of-Day Workflow",
      content: "**Penutupan harian** dilakukan dalam 4 langkah berurutan. Semua langkah harus selesai sebelum laporan disubmit ke finance.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='eod-title']",
      title: "Stepper Visual",
      content: "Progress bar di atas menunjukkan posisi Anda. Langkah terkunci sampai langkah sebelumnya selesai — ini memastikan **urutan yang benar**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='eod-step-daily-sales']",
      title: "Langkah 1: Tutup Sales",
      content: "Pastikan semua transaksi penjualan hari ini sudah diinput. Daily sales harus dalam status **Submitted** sebelum bisa lanjut.",
      placement: "bottom",
    },
    {
      target: "[data-testid='eod-step-petty-cash']",
      title: "Langkah 2: Rekonsiliasi Petty Cash",
      content: "Cek saldo kas kecil: **uang fisik = saldo sistem**. Jika ada selisih, catat sebagai adjustment sebelum close.",
      placement: "bottom",
    },
    {
      target: "[data-testid='eod-finish']",
      title: "Submit Laporan",
      content: "Tombol **Selesai** hanya aktif jika semua langkah sudah done. Setelah submit, laporan dikirim ke Finance untuk validasi keesokan paginya.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── CRM Hub ─────────────────────────────────────────────────────
const outletCRMHubTour = {
  name: "CRM & Reservasi Hub",
  description: "Kelola reservasi dan loyalty member dari satu dashboard.",
  steps: [
    {
      target: "[data-testid='crm-hub-page']",
      title: "CRM Hub",
      content: "Pusat pengelolaan **reservasi tamu** dan **loyalty member**. Monitor KPI, buat reservasi baru, dan pantau status membership.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='crm-kpi-strip']",
      title: "KPI Reservasi & Loyalty",
      content: "**4 KPI utama**: Reservasi hari ini, Tamu hadir, Total loyalty members, dan Redemption bulan ini.",
      placement: "bottom",
    },
    {
      target: "[data-testid='crm-quick-actions']",
      title: "Quick Actions",
      content: "Akses cepat ke:\n\n• **Buat Reservasi** — new reservation\n• **Scan Poin** — akumulasi poin member\n• **Redeem** — tukar poin/voucher\n• **Daftar Reservasi** — lihat semua",
      placement: "bottom",
    },
    {
      target: "[data-testid='crm-timeline']",
      title: "Timeline Hari Ini",
      content: "Timeline reservasi diurutkan per jam. Status warna:\n\n• **Hijau** — confirmed\n• **Kuning** — pending/waitlist\n• **Merah** — no-show/cancelled",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Reservation List ────────────────────────────────────────────
const outletReservationListTour = {
  name: "Daftar Reservasi",
  description: "7 status reservasi, downpayment tracking, dan filter.",
  steps: [
    {
      target: "[data-testid='reservation-list-page']",
      title: "Daftar Reservasi",
      content: "Pusat manajemen **reservasi meja** lintas outlet. Pantau status, deposit, dan detail tamu dari satu halaman.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='reservation-filters']",
      title: "Filter Reservasi",
      content: "Filter berdasarkan **tanggal**, **status**, atau **kata kunci** (nama tamu / nomor telepon). Gunakan kombinasi filter untuk cari reservasi spesifik.",
      placement: "bottom",
    },
    {
      target: "[data-testid='reservation-kpi-strip']",
      title: "7 Status & Downpayment",
      content: "Status reservasi: **Pending, Confirmed, Waitlist, Rescheduled, Completed, Cancelled, No-Show**. KPI strip merangkum jumlah per status dan total deposit — DP otomatis terekap di Finance.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Reservation Form ──────────────────────────────────────────────
const outletReservationFormTour = {
  name: "Form Reservasi",
  description: "Cara membuat & mengedit reservasi dengan detail lengkap.",
  steps: [
    {
      target: "[data-testid='reservation-form-page']",
      title: "Form Reservasi",
      content: "Form lengkap untuk buat atau edit reservasi. Isi semua field wajib sebelum submit.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='reservation-form-outlet-card']",
      title: "Info Outlet",
      content: "Pilih **outlet** dan **jumlah tamu (pax)**. Kapasitas outlet ditampilkan sebagai referensi.",
      placement: "bottom",
    },
    {
      target: "[data-testid='reservation-form-datetime-card']",
      title: "Tanggal & Waktu",
      content: "Set tanggal dan jam kedatangan. Jika slot penuh, sistem akan sarankan **status Waitlist**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='reservation-form-deposit-card']",
      title: "Downpayment",
      content: "Isi DP jika diminta:\n\n• **Jumlah** DP\n• **Deadline** konfirmasi\n• **Metode** (transfer/tunai/OVO)\n• **Nomor referensi** (jika transfer)",
      placement: "top",
    },
    {
      target: "[data-testid='reservation-form-actions']",
      title: "Submit Reservasi",
      content: "Klik **Simpan** untuk menyimpan. Status default adalah **Confirmed** kecuali slot penuh (otomatis jadi Waitlist).",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Daily Sales ────────────────────────────────────────────────
const outletDailySalesTour = {
  name: "Daily Sales",
  description: "Input dan monitor penjualan harian per channel.",
  steps: [
    {
      target: "body",
      title: "Daily Sales",
      content: "Catat **penjualan harian** per channel (Dine-In, Takeaway, Delivery, Online). Setiap daily sales harus divalidasi Finance sebelum masuk laporan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Tips Daily Sales",
      content: "• Submit **sebelum jam 23.59** hari yang sama\n• Pisahkan per channel untuk analitik akurat\n• Lampirkan Z-report kasir jika tersedia\n• Cek total match dengan struk mesin EDC",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Sales Wizard ────────────────────────────────────────────────
const outletSalesWizardTour = {
  name: "Sales Wizard 5-Langkah",
  description: "Wizard terstruktur untuk input daily sales per channel & payment.",
  steps: [
    {
      target: "body",
      title: "Sales Wizard",
      content: "Wizard **5 langkah** untuk input daily sales secara lengkap dan terstruktur. Lebih mudah dari form biasa, cocok untuk staf baru.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Langkah Wizard",
      content: "1. **Outlet & Tanggal** — pilih konteks\n2. **Channel Sales** — dine-in, takeaway, delivery\n3. **Payment Method** — cash, debit, QRIS, OVO\n4. **Rekap** — review semua input\n5. **Submit** — kirim ke finance",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Daily Close ─────────────────────────────────────────────────
const outletDailyCloseTour = {
  name: "Daily Close",
  description: "Penutupan harian outlet dengan validasi lengkap.",
  steps: [
    {
      target: "body",
      title: "Daily Close",
      content: "Halaman **konfirmasi akhir hari**. Semua daily sales, petty cash, dan orders harus selesai sebelum bisa close.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Catatan Penting",
      content: "• Setelah close, Anda **tidak bisa edit** daily sales hari itu\n• Finance menerima notifikasi untuk validasi esok pagi\n• Gunakan tombol **End-of-Day Workflow** untuk panduan step-by-step",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Petty Cash ──────────────────────────────────────────────────
const outletPettyCashTour = {
  name: "Petty Cash",
  description: "Kelola kas kecil outlet: catat, rekonsiliasi, dan top-up.",
  steps: [
    {
      target: "body",
      title: "Petty Cash",
      content: "Catat **pengeluaran kas kecil** outlet. Setiap transaksi membutuhkan kategori dan foto nota/struk sebagai bukti.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Kategori & Bukti",
      content: "Kategori yang tersedia:\n\n• **Operasional** — sabun, tisu, dll\n• **Darurat** — pembelian mendadak\n• **Transport** — ongkir\n• **Lain-lain** — wajib ada keterangan\n\n📸 Selalu upload foto nota!",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Loyalty Scan ───────────────────────────────────────────────
const outletLoyaltyScanTour = {
  name: "Input Poin Loyalty",
  description: "Scan struk untuk akumulasi poin member.",
  steps: [
    {
      target: "body",
      title: "Input Poin Loyalty",
      content: "Scan atau input nomor transaksi untuk berikan **poin loyalty** ke member. Poin otomatis dihitung dari total transaksi.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
  ],
};

// ─── Outlet Urgent Purchase ───────────────────────────────────────────
const outletUrgentPurchaseTour = {
  name: "Urgent Purchase",
  description: "Pembelian mendesak di luar siklus PR normal — tetap terkontrol budget.",
  steps: [
    {
      target: "[data-testid='urgent-purchase-page']",
      title: "Urgent Purchase",
      content: "Untuk kebutuhan **mendesak** yang tak bisa menunggu siklus PR biasa. Tetap tercatat & potong budget outlet.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='up-new']",
      title: "Buat Pembelian Mendesak",
      content: "Klik untuk input item, jumlah, dan **alasan urgensi**. Sistem mengecek sisa budget sebelum menyimpan.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Outlet Budget Tracker (Budget Saya) ──────────────────────────────
const outletBudgetTrackerTour = {
  name: "Budget Saya",
  description: "Pantau sisa budget operasional outlet & ajukan penambahan bila perlu.",
  steps: [
    {
      target: "[data-testid='outlet-budget-tracker']",
      title: "Budget Saya",
      content: "Lihat **plafon vs realisasi** budget operasional outlet Anda (KDO/FDO/BDO) per periode.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='hero-total-budget']",
      title: "Total Budget Periode",
      content: "Ringkasan total plafon & serapan periode aktif — cepat tahu sisa yang tersedia.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-weekly']",
      title: "Mingguan / Bulanan",
      content: "Pindah antara tampilan **mingguan** dan **bulanan** sesuai cara alokasi budget Anda.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Outlet Stock Check ───────────────────────────────────────────────
const outletStockCheckTour = {
  name: "Stock Check",
  description: "Cek stok outlet real-time dan mulai opname dari sini.",
  steps: [
    {
      target: "[data-testid='outlet-stock-check']",
      title: "Stock Check",
      content: "Lihat **posisi stok** outlet Anda real-time — item mana yang menipis di bawah par level.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='stock-kpi-low']",
      title: "Item Menipis",
      content: "KPI **Low Stock** menyorot item di bawah par — prioritas untuk re-order.",
      placement: "bottom",
    },
    {
      target: "[data-testid='stock-check-opname']",
      title: "Mulai Opname",
      content: "Klik untuk memulai **stok opname** (hitung fisik) dengan analisis selisih otomatis.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Outlet Stock Transfers ───────────────────────────────────────────
const outletStockTransfersTour = {
  name: "Stock Transfers",
  description: "Kirim & terima transfer stok antar outlet dengan traceability.",
  steps: [
    {
      target: "[data-testid='outlet-stock-transfers']",
      title: "Stock Transfers",
      content: "Pindahkan stok **antar outlet**. Tiap transfer punya status kirim → in-transit → terima.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='transfers-kpi-transit']",
      title: "Dalam Perjalanan",
      content: "KPI **In-Transit** menunjukkan transfer yang sudah dikirim tapi belum diterima outlet tujuan.",
      placement: "bottom",
    },
    {
      target: "[data-testid='transfers-new']",
      title: "Buat Transfer",
      content: "Klik untuk **transfer baru** — pilih outlet asal/tujuan & item. Guard mencegah stok minus.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Outlet Usage Log ─────────────────────────────────────────────────
const outletUsageLogTour = {
  name: "Usage Log",
  description: "Catat pemakaian & waste bahan baku outlet.",
  steps: [
    {
      target: "[data-testid='outlet-usage-log']",
      title: "Usage Log",
      content: "Catatan **pemakaian bahan** dan waste outlet — basis untuk analisis efisiensi & COGS.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='usage-kpi-waste']",
      title: "Waste",
      content: "KPI **Waste** menyoroti nilai bahan terbuang — target untuk ditekan tiap periode.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Outlet Loyalty Points Entry (Input Poin) ─────────────────────────
const outletLoyaltyPointsTour = {
  name: "Input Poin Loyalty",
  description: "Tambah poin loyalty member dari kasir berdasarkan nilai transaksi.",
  steps: [
    { target: "[data-testid='cashier-phone-input']", title: "Cari Member", content: "Masukkan **nomor HP** member lalu cari — sistem menampilkan data & saldo poin member.", placement: "bottom", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='cashier-amount-input']", title: "Nilai Transaksi", content: "Isi **nominal belanja** — preview poin yang akan didapat muncul otomatis sesuai rule.", placement: "bottom" },
    { target: "[data-testid='cashier-add-points-button']", title: "Tambah Poin", content: "Klik untuk **akumulasi poin** ke akun member. Konfirmasi sukses akan ditampilkan.", placement: "top", variant: "tip" },
  ],
};

export {
  outletHomeTour,
  outletDailyOrdersHubTour,
  outletEndOfDayWorkflowTour,
  outletCRMHubTour,
  outletReservationListTour,
  outletReservationFormTour,
  outletDailySalesTour,
  outletSalesWizardTour,
  outletDailyCloseTour,
  outletPettyCashTour,
  outletLoyaltyScanTour,
  outletUrgentPurchaseTour,
  outletBudgetTrackerTour,
  outletStockCheckTour,
  outletStockTransfersTour,
  outletUsageLogTour,
  outletLoyaltyPointsTour,
};
