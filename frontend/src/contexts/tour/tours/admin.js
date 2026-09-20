/** Admin portal tour definitions — Full coverage including all sub-pages. */

// ─── Admin Home ───────────────────────────────────────────────────
const adminHomeTour = {
  name: "Admin Home",
  description: "Tour cepat halaman utama admin portal.",
  steps: [
    {
      target: "[data-testid='admin-page']",
      title: "Admin Portal",
      content: "Pusat konfigurasi sistem ERP: **users, roles, master data, CMS, dan settings**. Hanya accessible oleh Super Admin.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='admin-welcome']",
      title: "Dashboard Overview",
      content: "KPI admin: jumlah user aktif, roles, items master, dan audit log terbaru.",
      placement: "bottom",
    },
    {
      target: "[data-testid='admin-kpi-strip']",
      title: "KPI System",
      content: "Monitor kesehatan sistem: **User count**, **Role count**, **Pending requests**, dan **Last audit event**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='admin-master-tiles']",
      title: "Quick Access Tiles",
      content: "Tile cepat ke modul admin utama. Klik untuk masuk langsung.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Master Data Hub ──────────────────────────────────────────────
const adminMasterDataHubTour = {
  name: "Master Data Hub",
  description: "Kelola semua master data dari satu halaman dengan tab navigation.",
  steps: [
    {
      target: "body",
      title: "Master Data Hub",
      content: "Semua **master data** dalam satu halaman dengan tab terorganisir:\n\n• **Items** — katalog bahan/produk\n• **Vendors** — data pemasok\n• **Employees** — data karyawan\n• **COA** — chart of accounts\n• **Tax Codes, Payment Methods, Bank Accounts**",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Navigasi Antar Master",
      content: "Gunakan **tab horizontal** di atas untuk beralih antar entitas master. Data di-load fresh setiap ganti tab.",
      placement: "center",
    },
    {
      target: "body",
      title: "CRUD Operations",
      content: "Setiap tab memiliki:\n\n• **Search & Filter** — cari data cepat\n• **+ Baru** — tambah entri baru\n• **Edit** — klik baris untuk edit\n• **Soft Delete** — tidak permanent, bisa dipulihkan\n• **Import** — bulk upload via CSV/Excel",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── CMS Studio ───────────────────────────────────────────────────
const adminCMSStudioTour = {
  name: "CMS Studio — Kelola Konten Website",
  description: "9 entitas CMS website public dalam satu workspace.",
  steps: [
    {
      target: "[data-testid='cms-studio']",
      title: "CMS Studio",
      content: "Pusat pengelolaan **konten website public** FnB Group. 9 entitas CMS tersedia dalam satu workspace.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='cms-tabs']",
      title: "9 Entitas CMS",
      content: "Tab yang tersedia:\n\n• **Brands** — profil brand\n• **Menu** — menu makanan/minuman\n• **News** — artikel & blog\n• **Outlets** — lokasi & info outlet\n• **Gallery** — foto-foto\n• **Careers** — lowongan kerja\n• **About** — profil perusahaan\n• **Testimonials** — ulasan tamu\n• **Promos** — promosi aktif",
      placement: "bottom",
    },
    {
      target: "[data-testid='cms-content-brands']",
      title: "Edit Konten",
      content: "Di setiap tab: klik **+ Tambah** untuk konten baru, atau klik baris untuk edit. Perubahan langsung live di website public.",
      placement: "top",
    },
    {
      target: "[data-testid='cms-tabs']",
      title: "Tips CMS",
      content: "• Upload foto berkualitas tinggi (min. 1200×800px)\n• Gunakan tab **Menu** untuk update harga dan foto menu\n• Tab **News** untuk publish artikel promo\n• Tab **Careers** ter-link langsung ke form lamaran publik",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── E-Menu CMS (specific) ────────────────────────────────────────
const adminMenuCMSTour = {
  name: "E-Menu CMS",
  description: "Kelola menu digital: CRUD items, upload foto, buat kategori.",
  steps: [
    {
      target: "[data-testid='admin-menu-brand-group']",
      title: "Pilih Brand",
      content: "Setiap brand punya menu terpisah: **The Coffeeshop, The Bakery, The Bistro, The Restaurant, The Lounge**. Pilih brand yang ingin diedit.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "[data-testid='admin-menu-tabs']",
      title: "Tab Menu vs Kategori",
      content: "**Menu Items** — daftar makanan/minuman\n**Kategori** — kelompokkan menu (Appetizer, Main Course, dll)",
      placement: "bottom",
    },
    {
      target: "[data-testid='admin-menu-toolbar']",
      title: "Toolbar Actions",
      content: "• **+ Item** — tambah menu baru\n• **Upload PDF** — menu PDF fallback\n• **Preview** — lihat tampilan di website",
      placement: "bottom",
    },
    {
      target: "[data-testid='admin-menu-search-group']",
      title: "Search & Filter",
      content: "Cari menu berdasarkan nama. Filter by kategori untuk edit kategori tertentu.",
      placement: "bottom",
    },
    {
      target: "[data-testid='admin-menu-search']",
      title: "Tips Upload Foto",
      content: "Upload foto menu berkualitas tinggi. Foto yang bagus meningkatkan order. Rekomendasi: **rasio 4:3**, pencahayaan natural, background bersih.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Users ────────────────────────────────────────────────────────
const adminUsersTour = {
  name: "Manajemen User",
  description: "Buat user, atur role, dan reset password.",
  steps: [
    {
      target: "body",
      title: "Manajemen User",
      content: "Kelola **semua akun user** ERP. Buat user baru, assign role, dan reset password jika diperlukan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Cara Assign Role",
      content: "Setiap user harus punya **minimal 1 role**. Role menentukan portal dan fitur yang bisa diakses.\n\nContoh: role **Outlet Manager** hanya bisa akses Outlet Portal.",
      placement: "center",
    },
    {
      target: "body",
      title: "Tips Keamanan",
      content: "• Assign role sesempit mungkin (least privilege)\n• Audit log mencatat semua login & perubahan\n• Nonaktifkan user yang sudah resign, jangan hapus (untuk audit trail)",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Roles ────────────────────────────────────────────────────────
const adminRolesTour = {
  name: "Roles & Permissions",
  description: "Kelola peran dan izin akses untuk semua user.",
  steps: [
    {
      target: "[data-testid='roles-page']",
      title: "Roles & Permissions",
      content: "Sistem **RBAC (Role-Based Access Control)** FnB ERP. Setiap role memiliki set permissions yang menentukan apa yang bisa dilakukan user.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='roles-grid']",
      title: "Daftar Role",
      content: "Semua role yang ada di sistem. Klik **Edit** pada role untuk ubah permissions-nya. Klik **Hapus** untuk nonaktifkan role (user yang punya role ini akan kehilangan akses).",
      placement: "top",
    },
    {
      target: "[data-testid='roles-new']",
      title: "Buat Role Baru",
      content: "Klik **+ Role Baru** untuk membuat role custom. Isi kode (unik), nama, dan pilih permissions dari daftar.",
      placement: "bottom",
    },
    {
      target: "[data-testid='roles-grid']",
      title: "Format Permission",
      content: "Format: **modul.aksi** (misal: `finance.journals.read`)\n\n• `finance.*` — semua aksi finance\n• `*` — super admin\n• `outlet.manager` — role khusus outlet",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Approval Matrix Builder ──────────────────────────────────────
const adminApprovalBuilderTour = {
  name: "Approval Matrix Builder",
  description: "Bangun workflow approval multi-tier secara visual.",
  steps: [
    {
      target: "[data-testid='approval-matrix-builder']",
      title: "Approval Matrix Builder",
      content: "Bangun **alur approval multi-tier** secara visual. Tentukan siapa yang harus approve apa, dan sampai nominal berapa.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='entity-rail']",
      title: "Pilih Entitas",
      content: "Pilih jenis dokumen yang akan diatur approvalnya:\n\n• **PR** — Purchase Request\n• **PO** — Purchase Order\n• **Payment** — Payment Request\n• **Adjustment** — Stock Adjustment",
      placement: "right",
    },
    {
      target: "[data-testid='tab-builder']",
      title: "Builder Tab",
      content: "Di tab **Builder**: tambah tier approval, set approver per tier, dan atur threshold nominal. Tier berjalan berurutan dari bawah ke atas.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-preview']",
      title: "Preview & Test",
      content: "Tab **Preview**: masukkan nominal test untuk lihat siapa yang akan di-notify. Sangat berguna sebelum deploy workflow ke production.",
      placement: "bottom",
    },
    {
      target: "[data-testid='btn-save-workflow']",
      title: "Simpan Workflow",
      content: "Klik **Simpan** untuk aktifkan workflow. Semua dokumen baru akan mengikuti workflow ini. Perubahan tidak mempengaruhi dokumen yang sudah dalam proses.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Approval Workflows (Legacy) ──────────────────────────────────
const adminWorkflowsTour = {
  name: "Approval Workflows",
  description: "Kelola aturan approval berbasis teks untuk semua modul.",
  steps: [
    {
      target: "body",
      title: "Approval Workflows",
      content: "Atur **aturan approval** untuk setiap jenis dokumen. Workflow menentukan siapa yang harus menyetujui PR, PO, Payment, dan Adjustment.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='wf-new']",
      title: "Buat Workflow Baru",
      content: "Klik **+ Workflow** untuk membuat aturan approval baru. Pilih entitas (PR/PO/dll), set threshold, dan tambah tier approver.",
      placement: "bottom",
    },
    {
      target: "body",
      title: "Cara Kerja Tier",
      content: "Setiap workflow bisa punya **multiple tier**. Contoh:\n\n• Tier 1: Manager (hingga Rp 5 juta)\n• Tier 2: GM (Rp 5–50 juta)\n• Tier 3: Owner (di atas Rp 50 juta)",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Bulk Import ──────────────────────────────────────────────────
const adminBulkImportTour = {
  name: "Bulk Excel Import",
  description: "Import ratusan data sekaligus via CSV/Excel dengan validasi baris per baris.",
  steps: [
    {
      target: "[data-testid='bulk-import-page']",
      title: "Bulk Excel Import",
      content: "Import **ratusan data** sekaligus via CSV/Excel. Cocok untuk migrasi awal atau update massal items, vendors, employees, dan COA.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='bulk-import-steps']",
      title: "3 Langkah Import",
      content: "Proses import dalam 3 langkah:\n\n1. **Pilih Entity** — pilih jenis data\n2. **Download Template** — gunakan template Excel yang tersedia\n3. **Upload & Preview** — upload file, validasi, lalu import",
      placement: "bottom",
    },
    {
      target: "[data-testid='step-select-entity']",
      title: "Langkah 1: Pilih Entity",
      content: "Pilih entitas data yang akan diimport. Setiap entitas punya template berbeda — **jangan gunakan template yang salah** untuk menghindari error.",
      placement: "bottom",
    },
    {
      target: "[data-testid='step-download-template']",
      title: "Langkah 2: Download Template",
      content: "Download template Excel → isi data → upload kembali. Jangan ubah nama kolom karena sistem membaca header secara exact match.",
      placement: "bottom",
    },
    {
      target: "[data-testid='step-upload-preview']",
      title: "Langkah 3: Upload & Validasi",
      content: "Upload file → sistem validasi setiap baris. Baris error ditampilkan dengan detail pesan. Anda bisa **import baris valid** dan perbaiki baris error secara terpisah.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Number Series ────────────────────────────────────────────────
const adminNumberSeriesTour = {
  name: "Number Series — Format Nomor Dokumen",
  description: "Atur format nomor otomatis untuk semua jenis dokumen.",
  steps: [
    {
      target: "[data-testid='number-series-page']",
      title: "Number Series",
      content: "Atur **format nomor otomatis** untuk semua dokumen: PR, PO, GR, Journal, Payment. Nomor di-generate otomatis saat dokumen dibuat.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='number-series-grid']",
      title: "Konfigurasi per Dokumen",
      content: "Setiap jenis dokumen punya series sendiri. Format konfigurasi:\n\n• **Prefix** — misal `PR-` atau `CFS-PO-`\n• **Year/Month** — auto-include tanggal\n• **Digit** — panjang angka sekuensial\n• **Reset** — per tahun atau per bulan",
      placement: "top",
    },
    {
      target: "[data-testid='number-series-grid']",
      title: "Tips Number Series",
      content: "• Gunakan prefix brand/outlet untuk identifikasi mudah\n• Contoh: `CFS-PR-2026-001` = The Coffeeshop, Purchase Request, 2026\n• Perubahan hanya berlaku untuk dokumen baru, tidak retroaktif",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Tax Config ───────────────────────────────────────────────────
const adminTaxConfigTour = {
  name: "Tax Configuration",
  description: "Atur tax codes dan rate PPN/service charge untuk transaksi.",
  steps: [
    {
      target: "[data-testid='tax-config-page']",
      title: "Tax Configuration",
      content: "Kelola **tax codes** yang digunakan dalam transaksi. Tax code ter-link ke COA GL untuk posting journal otomatis.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='tax-cards-grid']",
      title: "Daftar Tax Code",
      content: "Klik card tax untuk toggle aktif/nonaktif. Tax yang aktif akan muncul sebagai pilihan di form transaksi (PO, Invoice, Payment).",
      placement: "top",
    },
    {
      target: "[data-testid='tax-config-info-banner']",
      title: "Catatan Konfigurasi",
      content: "Untuk konfigurasi detail COA mapping per tax code, klik link **Full Tax Config** yang tersedia. Tax rate tidak bisa diubah jika sudah ada transaksi yang menggunakannya.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── System Operations ────────────────────────────────────────────
const adminOperationsTour = {
  name: "System Operations — Monitoring",
  description: "Pantau kesehatan sistem: metrics, logs, scheduler, dan rate limits.",
  steps: [
    {
      target: "[data-testid='operations-page']",
      title: "System Operations",
      content: "Monitoring dan administrasi sistem. Hanya untuk **Super Admin** teknis.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Tab Monitoring",
      content: "• **Metrics** — CPU, memory, query latency real-time\n• **Logs** — application logs dengan filter level\n• **Scheduler** — cron jobs (digest, archival, anomaly scan)\n• **Archival** — backup dan cold storage management\n• **Rate Limits** — lihat & reset rate limit counter",
      placement: "center",
    },
    {
      target: "body",
      title: "Tips Monitoring",
      content: "• Cek **Metrics** jika app terasa lambat (lihat slow queries)\n• **Scheduler** menjalankan digest harian jam 07.00 WIB\n• Log level ERROR/CRITICAL harus di-investigate segera",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── System Settings ─────────────────────────────────────────────
const adminSettingsTour = {
  name: "System Settings",
  description: "Konfigurasi global sistem: timezone, branding, dan parameter global.",
  steps: [
    {
      target: "body",
      title: "System Settings",
      content: "Konfigurasi **parameter global** sistem: timezone, nama perusahaan, logo, mata uang, dan lainnya.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Pengaturan Penting",
      content: "• **Timezone** — pastikan sesuai WIB/WITA/WIT\n• **Fiscal Year Start** — bulan mulai tahun fiskal\n• **Currency** — IDR (tidak bisa diubah setelah ada data)\n• **Company Logo** — muncul di header semua laporan",
      placement: "center",
    },
    {
      target: "body",
      title: "Perubahan Kritis",
      content: "Perubahan settings seperti **timezone** dan **fiscal year** dapat mempengaruhi semua laporan historis. Konsultasikan dengan Finance Manager sebelum mengubah.",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Loyalty Admin Overview ───────────────────────────────────────
const adminLoyaltyOverviewTour = {
  name: "Loyalty Admin — Overview",
  description: "Dashboard overview program loyalty: member, poin, dan rewards.",
  steps: [
    {
      target: "[data-testid='admin-loyalty-home']",
      title: "Loyalty Admin Dashboard",
      content: "Overview program **loyalty FnB Group**: jumlah member, poin beredar, rewards aktif, dan redemption terbaru.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='link-admin-loyalty-customers']",
      title: "Kelola Member",
      content: "Klik **Customers** untuk lihat semua member loyalty. Bisa filter berdasarkan tier (Bronze/Silver/Gold/Platinum) dan status.",
      placement: "bottom",
    },
    {
      target: "[data-testid='link-admin-loyalty-rewards']",
      title: "Rewards Catalog",
      content: "Klik **Rewards** untuk kelola katalog hadiah. Atur poin yang diperlukan, stok voucher, dan masa berlaku.",
      placement: "bottom",
    },
    {
      target: "[data-testid='link-admin-loyalty-redemptions']",
      title: "Redemption History",
      content: "Monitor semua **penukaran poin** yang terjadi. Bisa filter per tanggal, member, atau reward.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Loyalty Customers ────────────────────────────────────────────
const adminLoyaltyCustomersTour = {
  name: "Loyalty Customers",
  description: "Kelola daftar member loyalty: lihat profil, tier, dan riwayat poin.",
  steps: [
    {
      target: "[data-testid='admin-loyalty-customers']",
      title: "Loyalty Customers",
      content: "Daftar semua **member loyalty** FnB Group. Setiap member bisa lihat saldo poin, tier, dan history transaksi mereka.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='loyalty-customers-search']",
      title: "Cari Member",
      content: "Cari berdasarkan nama, nomor member, atau nomor HP. Filter tambahan: **tier** (Bronze/Silver/Gold/Platinum) dan **status aktif**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='customers-table']",
      title: "Detail Member",
      content: "Klik baris member untuk lihat detail: poin balance, tier, history transaksi. Admin bisa **adjust poin** secara manual jika ada keluhan.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Loyalty Rewards ──────────────────────────────────────────────
const adminLoyaltyRewardsTour = {
  name: "Loyalty Rewards Catalog",
  description: "Kelola katalog rewards: buat voucher, set poin, atur stok.",
  steps: [
    {
      target: "body",
      title: "Rewards Catalog",
      content: "Kelola **katalog rewards** program loyalty. Member bisa tukar poin dengan rewards di sini.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Jenis Rewards",
      content: "• **Voucher Diskon** — misal 20% off\n• **Free Item** — item gratis tertentu\n• **Birthday Reward** — reward otomatis di ulang tahun\n• **Tier Upgrade** — bonus saat naik tier",
      placement: "center",
    },
    {
      target: "body",
      title: "Tips Program Loyalty",
      content: "• Set minimum poin yang realistis (tidak terlalu mudah/sulit)\n• Beri reward **time-limited** untuk mendorong redemption\n• Review top performers setiap bulan untuk adjust program",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Business Rules Configuration ────────────────────────────────
const adminConfigurationTour = {
  name: "Business Rules Configuration",
  description: "Atur parameter bisnis: sales schema, petty cash policy, dan lainnya.",
  steps: [
    {
      target: "body",
      title: "Business Rules Configuration",
      content: "Konfigurasi **parameter bisnis** yang bisa disesuaikan per outlet: sales input schema, petty cash policy, service charge, dan incentive scheme.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Modul Konfigurasi",
      content: "• **Sales Schemas** — field custom di daily sales per brand\n• **Petty Cash Policies** — limit, kategori, approval threshold\n• **Service Charge Policies** — rate SC per outlet\n• **Incentive Schemes** — formula bonus per jabatan\n• **Anomaly Thresholds** — batas deteksi anomali",
      placement: "center",
    },
    {
      target: "body",
      title: "Effective Dating",
      content: "Setiap perubahan konfigurasi menggunakan **effective date**. Perubahan hanya berlaku mulai tanggal yang ditetapkan — historis tidak terpengaruh.",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Report Schedules ─────────────────────────────────────────────
const adminReportSchedulesTour = {
  name: "Laporan Terjadwal",
  description: "Atur laporan yang dikirim otomatis via Email/WhatsApp/Telegram.",
  steps: [
    {
      target: "[data-testid='report-schedules-page']",
      title: "Laporan Terjadwal",
      content: "Jadwalkan **laporan otomatis** yang dikirim via email, WhatsApp, atau Telegram. Cocok untuk laporan harian/mingguan ke manajemen.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='create-schedule-btn']",
      title: "Buat Jadwal Baru",
      content: "Klik **Tambah Jadwal** untuk buat jadwal baru. Pilih jenis laporan, frekuensi (harian/mingguan/bulanan), dan penerima.",
      placement: "bottom",
    },
    {
      target: "[data-testid='schedules-grid']",
      title: "Kelola Jadwal",
      content: "Toggle **on/off** tiap jadwal tanpa menghapus. Klik **Preview** untuk test kirim laporan sekarang. Klik **Jalankan** untuk trigger manual.",
      placement: "top",
    },
    {
      target: "[data-testid='report-schedules-tabs']",
      title: "Riwayat Pengiriman",
      content: "Tab **Riwayat Kirim** menampilkan log semua laporan yang sudah dikirim, termasuk status (berhasil/gagal) dan waktu pengiriman.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Data Management ──────────────────────────────────────────────
const adminDataManagementTour = {
  name: "Manajemen Data",
  description: "Export, import, dan hapus data dalam jumlah besar.",
  steps: [
    {
      target: "[data-testid='data-management-page']",
      title: "Manajemen Data",
      content: "Tool untuk **manajemen data skala besar**: export snapshot, import massal, atau hapus data lama. Hanya untuk Super Admin.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='dm-tabs']",
      title: "3 Tab Utama",
      content: "• **Export** — export semua data ke CSV/Excel untuk backup atau analisis eksternal\n• **Import** — import data yang sudah disiapkan\n• **Delete** — hapus data lama (soft-delete by default)",
      placement: "bottom",
    },
    {
      target: "body",
      title: "Peringatan Penting",
      content: "Operasi **Delete** bersifat permanen untuk data yang sudah melewati periode retensi. Selalu **Export** terlebih dahulu sebelum delete sebagai backup.",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── Smart SEO ────────────────────────────────────────────────────
const adminSmartSEOTour = {
  name: "Smart SEO AI",
  description: "Optimalkan SEO website public dengan bantuan AI.",
  steps: [
    {
      target: "[data-testid='smart-seo-page']",
      title: "Smart SEO AI",
      content: "Optimalkan **SEO website public** FnB Group dengan bantuan AI. Atur meta title, description, keywords, dan Open Graph per halaman.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Pilih Halaman",
      content: "Pilih halaman yang ingin dioptimasi dari daftar (Home, Brands, Menu, News, Careers, dll). Setiap halaman punya SEO config terpisah.",
      placement: "center",
    },
    {
      target: "[data-testid='seo-analyze-btn']",
      title: "Analisis AI",
      content: "Klik **Analyze** untuk AI generate rekomendasi SEO otomatis berdasarkan konten halaman. AI akan suggest keywords yang relevan untuk F&B industri.",
      placement: "bottom",
    },
    {
      target: "[data-testid='seo-generate-btn']",
      title: "Generate Meta",
      content: "Klik **Generate** untuk AI auto-fill meta title dan description berdasarkan konten aktual halaman. Review sebelum save.",
      placement: "bottom",
    },
    {
      target: "[data-testid='seo-save-btn']",
      title: "Simpan & Deploy",
      content: "Setelah review, klik **Simpan**. Perubahan langsung live di website dan bisa diindeks oleh search engine.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Integrations ─────────────────────────────────────────────────
const adminIntegrationsTour = {
  name: "Integrations Hub",
  description: "Konfigurasi API key dan layanan eksternal.",
  steps: [
    {
      target: "[data-testid='admin-integrations-page']",
      title: "Integrations Hub",
      content: "Konfigurasi **layanan eksternal**: LLM/AI, Email SMTP, WhatsApp/Twilio, dan lainnya. Semua API key disimpan terenkripsi.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='admin-integrations-header']",
      title: "Tabs Integrasi",
      content: "Tab tersedia:\n\n• **LLM/AI** — untuk AI Variance Explainer & Executive Q&A\n• **Email** — SMTP untuk notifikasi & PO email\n• **Messaging** — WhatsApp/SMS alerts",
      placement: "bottom",
    },
    {
      target: "[data-testid='admin-integrations-tabs']",
      title: "Tips Keamanan API Key",
      content: "API key hanya muncul sekali saat input. Simpan di password manager. Jangan share atau commit ke git.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Tour Analytics ───────────────────────────────────────────────
const adminTourAnalyticsTour = {
  name: "Tour Analytics Dashboard",
  description: "Monitor penggunaan dan efektivitas Help & Tour.",
  steps: [
    {
      target: "body",
      title: "Tour Analytics",
      content: "Dashboard untuk melihat seberapa efektif **Help & Tour** digunakan oleh user. Berguna untuk identifikasi fitur yang membingungkan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "KPI Tour",
      content: "• **Starts** — berapa kali tour dimulai\n• **Completion Rate** — persentase user yang selesai\n• **Skip Rate** — tour yang di-skip\n• **Unique Users** — berapa user berbeda",
      placement: "center",
    },
    {
      target: "body",
      title: "Interpretasi Data",
      content: "• **Completion Rate <50%** → tour terlalu panjang atau konten kurang relevan\n• **Skip Rate >70%** → user sudah familiar, pertimbangkan hapus tour\n• **High Starts tapi Low Completion** → identifikasi step yang menyebabkan user exit",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── User Management Hub (Users · Roles · Activity Log) ───────────────
const adminUserManagementHubTour = {
  name: "User Management Hub",
  description: "All Users, Roles & Permissions, dan Activity Log dalam satu workspace.",
  steps: [
    {
      target: "[data-testid='admin-user-management-hub']",
      title: "User Management",
      content: "Kelola **user, role, dan audit log** dari satu halaman bertab — tidak lagi menu terpisah.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='user-mgmt-tab-users']",
      title: "All Users",
      content: "Buat user, atur role & outlet, dan reset password dari tab ini.",
      placement: "bottom",
    },
    {
      target: "[data-testid='user-mgmt-tab-roles']",
      title: "Roles & Permissions",
      content: "Definisikan **peran** dan izin granular per modul. Tab **Activity Log** untuk jejak audit.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Setup & Numbering Hub (Number Series · Tax · Bulk Import) ─────────
const adminSetupHubTour = {
  name: "Setup & Numbering Hub",
  description: "Number Series, Tax Config, dan Bulk Import dalam satu tempat.",
  steps: [
    {
      target: "[data-testid='admin-setup-hub']",
      title: "Setup & Numbering",
      content: "Konfigurasi teknis sistem: **format nomor dokumen, pajak, dan import massal** — kini satu hub.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='setup-tab-number-series']",
      title: "Number Series",
      content: "Atur format penomoran otomatis (PR/PO/PAY/JAE) beserta reset periodik.",
      placement: "bottom",
    },
    {
      target: "[data-testid='setup-tab-tax-config']",
      title: "Tax & Bulk Import",
      content: "Tab **Tax Config** untuk kode & rate pajak; **Bulk Import** untuk unggah data massal via Excel/CSV.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Effective Dating Timeline ────────────────────────────────────────
const adminEffectiveDatingTour = {
  name: "Effective Dating Timeline",
  description: "Lihat kapan tiap konfigurasi berlaku (timeline versi aturan).",
  steps: [
    { target: "[data-testid='config-effective-dating-page']", title: "Effective Dating", content: "Timeline **kapan tiap aturan/konfigurasi berlaku** — penting agar perubahan kebijakan tidak retroaktif keliru.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='timeline-filter-all']", title: "Filter Timeline", content: "Saring per jenis konfigurasi untuk fokus ke aturan tertentu.", placement: "bottom" },
    { target: "[data-testid='config-timeline-today-marker']", title: "Penanda Hari Ini", content: "Garis **hari ini** memperjelas mana aturan aktif vs terjadwal. Warning muncul bila ada overlap periode.", placement: "top", variant: "tip" },
  ],
};

// ─── Loyalty Redemptions (Admin) ──────────────────────────────────────
const adminLoyaltyRedemptionsTour = {
  name: "Loyalty Redemptions",
  description: "Pantau & proses penukaran reward member loyalty.",
  steps: [
    { target: "[data-testid='admin-loyalty-redemptions']", title: "Redemptions", content: "Daftar **penukaran reward** oleh member — pantau status dari requested hingga fulfilled.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='status-filter']", title: "Filter Status", content: "Saring per status untuk proses penukaran yang masih pending.", placement: "bottom" },
    { target: "[data-testid='export-csv']", title: "Export", content: "Export data redemption untuk rekonsiliasi & analisis program loyalty.", placement: "left", variant: "tip" },
  ],
};

// ─── Audit Log ────────────────────────────────────────────────────────
const adminAuditLogTour = {
  name: "Audit Log",
  description: "Jejak audit semua aktivitas & mutasi data di sistem.",
  steps: [
    {
      target: "[data-testid='audit-log-page']",
      title: "Audit Log",
      content: "Jejak audit **semua aktivitas** sistem: siapa, kapan, dan apa yang diubah. Penting untuk keamanan & kepatuhan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='audit-filter-entity']",
      title: "Filter Entitas",
      content: "Saring log per **jenis entitas** (User, Journal, PO, Payment, dll.) dan per **aksi** untuk investigasi cepat.",
      placement: "bottom",
    },
    {
      target: "[data-testid='audit-refresh']",
      title: "Muat Ulang",
      content: "Klik **Refresh** untuk memuat event terbaru. Gunakan navigasi halaman untuk menelusuri histori lama.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

export {
  adminHomeTour,
  adminAuditLogTour,
  adminMasterDataHubTour,
  adminCMSStudioTour,
  adminMenuCMSTour,
  adminUsersTour,
  adminRolesTour,
  adminApprovalBuilderTour,
  adminWorkflowsTour,
  adminBulkImportTour,
  adminNumberSeriesTour,
  adminTaxConfigTour,
  adminOperationsTour,
  adminSettingsTour,
  adminLoyaltyOverviewTour,
  adminLoyaltyCustomersTour,
  adminLoyaltyRewardsTour,
  adminConfigurationTour,
  adminReportSchedulesTour,
  adminDataManagementTour,
  adminSmartSEOTour,
  adminIntegrationsTour,
  adminTourAnalyticsTour,
  adminUserManagementHubTour,
  adminSetupHubTour,
  adminEffectiveDatingTour,
  adminLoyaltyRedemptionsTour,
};
