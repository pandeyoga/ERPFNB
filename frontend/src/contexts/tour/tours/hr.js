/** HR portal tour definitions — Full coverage including all HR sub-pages.
 * Phase D Hardening: replaced all `body` targets with stable data-testid anchors.
 */

// ─── HR Home ──────────────────────────────────────────────────
const hrHomeTour = {
  name: "HR Home",
  description: "Overview HR: employees, advance, service charge, dan leaves.",
  steps: [
    {
      target: "[data-testid='hr-home-page']",
      title: "HR Portal",
      content: "Kelola **SDM FnB Group**: payroll, kasbon, service charge, cuti, dan rekrutmen.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='hr-home-kpi-strip']",
      title: "KPI HR Overview",
      content: "• **Active Employees** — jumlah karyawan aktif\n• **Open Advances** — kasbon yang belum lunas\n• **Voucher Liability** — total kewajiban voucher\n• **LB Fund** — saldo loss & breakage fund",
      placement: "bottom",
    },
    {
      target: "[data-testid='hr-home-header']",
      title: "Tip HR Manager",
      content: "Proses **payroll** dan **service charge** di awal bulan (periode bulan sebelumnya). Koordinasi dengan Finance untuk closing jurnal.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Payroll ──────────────────────────────────────────────────
const hrPayrollTour = {
  name: "HR Payroll — Gaji Karyawan",
  description: "Cara kelola payroll bulanan karyawan.",
  steps: [
    {
      target: "[data-testid='hr-payroll-page']",
      title: "Payroll Management",
      content: "Kelola **penggajian bulanan** karyawan: master data gaji, adjustment, deduction, dan payment batch.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='payroll-period-select']",
      title: "Pilih Periode",
      content: "Pilih **bulan** payroll. Sistem menampilkan daftar karyawan aktif di periode tersebut.",
      placement: "bottom",
    },
    {
      target: "[data-testid='payroll-employee-table']",
      title: "Tabel Payroll",
      content: "Setiap baris = satu karyawan:\n\n\u2022 **Gaji Pokok** — base salary\n\u2022 **Allowance** — tunjangan\n\u2022 **Deduction** — potongan BPJS/kasbon\n\u2022 **Take-Home Pay** — net gaji",
      placement: "top",
    },
    {
      target: "[data-testid='payroll-process-btn']",
      title: "Proses Payroll",
      content: "Klik **Proses** untuk generate journal dan payment request ke Finance. Payroll masuk **approval workflow** sebelum dibayarkan.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Advances ──────────────────────────────────────────────────
const hrAdvancesTour = {
  name: "HR Advances — Kasbon Karyawan",
  description: "Cara kelola kasbon (advance) karyawan.",
  steps: [
    {
      target: "[data-testid='hr-advances-page']",
      title: "Employee Advances",
      content: "Kelola **kasbon karyawan**: pengajuan, approval, dan pelunasan. Semua advance otomatis ter-journal di akun piutang karyawan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='advance-new-btn']",
      title: "Buat Advance Baru",
      content: "Isi form:\n\n\u2022 **Karyawan** — pilih dari daftar\n\u2022 **Jumlah** — nominal kasbon\n\u2022 **Alasan** — keperluan mendesak\n\u2022 **Jadwal pelunasan** — auto-deduct dari gaji",
      placement: "bottom",
    },
    {
      target: "[data-testid='advances-table']",
      title: "Status & Tracking",
      content: "Track pelunasan otomatis setiap bulan. Karyawan dengan outstanding advance >3 bulan akan di-flag untuk review HR.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Leaves ────────────────────────────────────────────────────
const hrLeavesTour = {
  name: "Leave Management — Kelola Cuti",
  description: "Kelola cuti dan absensi karyawan dengan saldo otomatis.",
  steps: [
    {
      target: "[data-testid='leave-requests']",
      title: "Leave Management",
      content: "Kelola **cuti tahunan, sakit, dan khusus** semua karyawan. Saldo cuti otomatis dihitung dari tanggal bergabung.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='leave-summary']",
      title: "Jenis Cuti",
      content: "\u2022 **Tahunan** — 12 hari/tahun (pro-rata)\n\u2022 **Sakit** — tanpa batas (surat dokter >2 hari)\n\u2022 **Khusus** — pernikahan, duka, dll\n\nSaldo otomatis dipotong saat cuti disetujui.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-approval-queue']",
      title: "Alur Approve",
      content: "Karyawan mengajukan → HR Manager approve → Notifikasi ke karyawan.\n\nCuti yang di-reject otomatis mengembalikan saldo.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Job Applications ───────────────────────────────────────────────
const hrJobApplicationsTour = {
  name: "Job Applications — Lamaran Kerja",
  description: "Review lamaran kerja yang masuk dari website public.",
  steps: [
    {
      target: "[data-testid='job-applications-page']",
      title: "Job Applications",
      content: "Review **lamaran kerja** yang masuk dari halaman Careers website FnB Group. Lamaran langsung terekam ke sistem HR.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='status-filter']",
      title: "Pipeline Rekrutmen",
      content: "Filter status lamaran:\n\n\u2022 **New** — baru masuk\n\u2022 **Reviewed** — sudah dibaca HR\n\u2022 **Interview** — dijadwalkan interview\n\u2022 **Hired** — diterima\n\u2022 **Rejected** — ditolak",
      placement: "bottom",
    },
    {
      target: "[data-testid='dept-filter']",
      title: "Tips Screening",
      content: "Filter berdasarkan **posisi** dan **outlet** untuk focus ke kebutuhan spesifik. Download CV langsung dari detail lamaran.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Job Listings ───────────────────────────────────────────────────
const hrJobListingsTour = {
  name: "Job Listings — Kelola Lowongan",
  description: "Buat dan kelola lowongan kerja yang tampil di website public.",
  steps: [
    {
      target: "[data-testid='job-listings-page']",
      title: "Job Listings",
      content: "Kelola **lowongan kerja** yang dipublikasikan di halaman Careers website FnB Group. Pelamar bisa apply langsung dari website.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='create-job-btn']",
      title: "Buat Lowongan Baru",
      content: "Klik **+ Lowongan** untuk buat posting baru. Isi:\n\n\u2022 **Judul posisi** — jelas dan spesifik\n\u2022 **Brand/Outlet** — lokasi penempatan\n\u2022 **Deskripsi** — tugas dan tanggung jawab\n\u2022 **Kualifikasi** — syarat pelamar\n\u2022 **Deadline** — batas waktu lamaran",
      placement: "bottom",
    },
    {
      target: "[data-testid='view-applications-btn']",
      title: "Publikasi & Monitoring",
      content: "Toggle **Aktif/Nonaktif** untuk kontrol kapan lowongan tampil di website. Klik lowongan untuk lihat berapa pelamar yang sudah masuk.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Service Charge ───────────────────────────────────────────────
const hrServiceChargeTour = {
  name: "Service Charge Distribution",
  description: "Distribusi service charge dari penjualan ke karyawan.",
  steps: [
    {
      target: "[data-testid='hr-service-charge-page']",
      title: "Service Charge Distribution",
      content: "Distribusi **service charge** dari daily sales ke karyawan berdasarkan kehadiran dan level jabatan.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='hr-sc-calc-btn']",
      title: "Cara Distribusi",
      content: "SC dihitung otomatis:\n\n\u2022 **Rate SC** — sesuai policy per outlet (misal: 5% dari sales)\n\u2022 **Kehadiran** — hanya karyawan hadir yang dapat\n\u2022 **Level multiplier** — supervisor dapat lebih banyak\n\u2022 **Outlet** — SC dari outlet yang bersangkutan",
      placement: "bottom",
    },
    {
      target: "[data-testid='hr-sc-period-filter']",
      title: "Proses & Submit",
      content: "Filter periode → hitung SC → review distribusi → submit ke payroll bulan ini. SC ter-journal otomatis ke akun beban SC.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Incentive Management ──────────────────────────────────────────────
const hrIncentiveTour = {
  name: "Incentive Management",
  description: "Kelola bonus dan insentif kinerja karyawan.",
  steps: [
    {
      target: "[data-testid='hr-incentive-page']",
      title: "Incentive Management",
      content: "Kelola **bonus dan insentif** kinerja karyawan. Insentif dihitung berdasarkan formula yang ditetapkan di Incentive Scheme.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='hr-inc-tab-schemes']",
      title: "Jenis Insentif",
      content: "\u2022 **Sales Achievement** — bonus jika target sales tercapai\n\u2022 **Upselling Bonus** — insentif per upsell item\n\u2022 **Attendance Bonus** — bonus kehadiran penuh\n\u2022 **Performance Bonus** — berdasarkan KPI evaluasi",
      placement: "bottom",
    },
    {
      target: "[data-testid='hr-inc-calc-btn']",
      title: "Workflow Insentif",
      content: "Generate insentif → review oleh HR Manager → approve → masuk payroll. Konfigurasi formula insentif di **Admin > Configuration > Incentive Schemes**.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Compensation Hub ──────────────────────────────────────────────
const hrCompensationHubTour = {
  name: "Compensation Hub — Remunerasi & Benefits",
  description: "7 modul remunerasi karyawan dalam satu workspace.",
  steps: [
    {
      target: "[data-testid='compensation-hub']",
      title: "Compensation Hub",
      content: "Semua modul **remunerasi karyawan** dalam satu tempat:\n\n\u2022 Payroll, Service Charge, Incentive\n\u2022 Advances, Vouchers, Deductions\n\u2022 Leave Balance",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='comp-tabs']",
      title: "7 Tab Kompensasi",
      content: "Tab sesuai jenis kompensasi. Klik untuk beralih antar modul tanpa kehilangan context. Data di-load fresh setiap ganti tab.",
      placement: "bottom",
    },
    {
      target: "[data-testid='comp-content-payroll']",
      title: "Alur Payroll Bulan Ini",
      content: "Urutan bulanan yang direkomendasikan:\n\n1. **Payroll** — generate penggajian\n2. **Service Charge** — distribusikan SC\n3. **Incentive** — hitung bonus\n4. **Deductions** — rekap potongan\n5. Submit ke Finance untuk payment",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── HR Voucher ───────────────────────────────────────────────────────
const hrVoucherTour = {
  name: "HR Voucher",
  description: "Terbitkan & kelola voucher karyawan (mis. meal/benefit).",
  steps: [
    { target: "[data-testid='hr-voucher-page']", title: "HR Voucher", content: "Kelola **voucher karyawan** — penerbitan, penggunaan, dan posting jurnal terkait.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='hr-voucher-filter-status']", title: "Filter & Cari", content: "Saring per status dan cari voucher tertentu dengan cepat.", placement: "bottom" },
    { target: "[data-testid='hr-voucher-issue-btn']", title: "Terbitkan Voucher", content: "Buat voucher baru: tentukan jumlah, nilai, tujuan, dan opsi posting jurnal.", placement: "left", variant: "tip" },
  ],
};

// ─── HR FOC (Free of Charge) ──────────────────────────────────────────
const hrFOCTour = {
  name: "FOC — Free of Charge",
  description: "Catat & kontrol transaksi gratis (FOC) per outlet/tipe.",
  steps: [
    { target: "[data-testid='hr-foc-page']", title: "FOC Management", content: "Catat **transaksi gratis (FOC)** — entertainment, training, atau kompensasi — agar tetap terkontrol & teraudit.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='hr-foc-filters']", title: "Filter", content: "Saring per tipe FOC dan outlet untuk analisis & kontrol budget.", placement: "bottom" },
    { target: "[data-testid='hr-foc-create']", title: "Catat FOC", content: "Tambah entri FOC baru dengan tanggal, tipe, outlet, dan detail terkait.", placement: "left", variant: "tip" },
  ],
};

// ─── HR LB Fund (Layanan Bersama / dana kolektif) ─────────────────────
const hrLBFundTour = {
  name: "LB Fund Ledger",
  description: "Buku besar dana bersama karyawan (masuk, keluar, saldo).",
  steps: [
    { target: "[data-testid='hr-lb-fund-page']", title: "LB Fund", content: "Buku besar **dana bersama** karyawan — transparansi penerimaan, pengeluaran, dan saldo.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='lb-fund-kpi-strip']", title: "Saldo & Arus", content: "KPI saldo, total masuk, dan total keluar dana untuk periode berjalan.", placement: "bottom" },
    { target: "[data-testid='lb-fund-table-card']", title: "Riwayat Transaksi", content: "Daftar mutasi dana — sumber dan peruntukan tiap transaksi tercatat untuk audit.", placement: "top", variant: "tip" },
  ],
};

export {
  hrHomeTour,
  hrPayrollTour,
  hrAdvancesTour,
  hrLeavesTour,
  hrJobApplicationsTour,
  hrJobListingsTour,
  hrServiceChargeTour,
  hrIncentiveTour,
  hrCompensationHubTour,
  hrVoucherTour,
  hrFOCTour,
  hrLBFundTour,
};
