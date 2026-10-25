# Audit UI/UX — Admin — User, Master Data, Konfigurasi

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/admin` — Admin Overview

- **File:** `frontend/src/portals/admin/AdminHome.jsx`, `frontend/src/portals/admin/AdminPortal.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-HOME-01 | page | title | P2 | Judul 'Admin Platform' dirender di AdminPortal, tidak sama dengan nama menu 'Overview'. Ada juga kartu sambutan besar (p-6/p-8, h2 font-bold, emoji 👋, teks dev 'Sprint D aktif'). | PageHeader dipindah ke AdminHome dengan judul 'Admin Overview'. Salam masuk ke subtitle, chip Online/versi masuk ke slot actions (dibungkus data-testid admin-welcome). Kartu hero dan emoji dihapus. | Diperbaiki |
| ADM-HOME-02 | page | card | P2 | KPI memakai KpiCard tanpa delta/tren, grid gap-4, halaman space-y-6. | Diganti CompactStatCard (testid kpi-* tetap), grid-cols-2 md:grid-cols-4 gap-3, space-y-3 lg:space-y-4. | Diperbaiki |
| ADM-HOME-03 | page | typography | P3 | Tile master data memakai text-2xl font-bold. Judul seksi berupa h3 uppercase. Label 'GL Accounts' berbeda dari nama di hub. | Tile memakai CompactStatCard size sm di dalam Link (testid tile-* tetap). Judul seksi h2 text-base/lg semibold, ditambah tautan 'Lihat semua', label diganti 'Chart of Accounts'. | Diperbaiki |
| ADM-HOME-04 | page | card | P3 | Kartu shortcut (Bulk Import, Operations, Integrations, Tour Analytics) memakai p-5 dan ikon 48px, terpecah di dua seksi, badge 'New' berbahasa Inggris. | Disatukan dalam satu grid LinkTile p-3 dengan ikon 36px. Badge diganti 'Baru'. Bulk Import kini menuju hub /admin/setup?tab=bulk-import. | Diperbaiki |
| ADM-HOME-05 | page | ia | P3 | Tile master data tidak mencakup Bank Accounts dan Tax Codes. | Tidak diperbaiki: hitungan berasal dari hooks/useAdminDashboard.js yang di luar kepemilikan saya. | Terbuka |

## `/admin/users` — Users

- **File:** `frontend/src/portals/admin/Users.jsx`, `frontend/src/portals/admin/UsersAdmin/index.jsx`, `frontend/src/portals/admin/UsersAdmin/UserDialog.jsx`, `frontend/src/portals/admin/UsersAdmin/ResetPwdDialog.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 6 → 1
- **Dialog/pop-up:** User Baru (6 field)
- **Sisa sinyal otomatis (heuristik):** Isi dialog terpotong/scroll vertikal

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-USR-01 | page | title | P2 | Rute mandiri tidak punya judul halaman. | Ditambah PageHeader 'Users' dengan aksi 'Tambah User'. Prop embedded ditambahkan: di dalam hub judul tidak tampil dan tombol pindah ke toolbar. | Diperbaiki |
| ADM-USR-02 | page | button | P2 | Tombol 'User Baru' memakai override rounded-full pill-active h-10 px-4. Input cari h-10 tanpa label. | Tombol diganti Button default 'Tambah User'. Input cari jadi h-9 dengan aria-label. | Diperbaiki |
| ADM-USR-03 | page | a11y | P2 | Aksi baris (edit, reset password, nonaktifkan) berupa raw <button> ikon tanpa aria-label. | Diganti Button ghost icon-sm dengan aria-label dan title. | Diperbaiki |
| ADM-USR-06 | dialog:User Baru | form | P2 | 6 field tanpa label terhubung (Label tanpa htmlFor), label uppercase, 'Phone' berbahasa Inggris, select dengan override h-10. | Ditambah htmlFor/id, label text-xs md:text-sm font-medium, 'Telepon', ariaLabel di select, tinggi h-9. Judul seksi diganti h3 text-sm semibold. | Diperbaiki |
| ADM-USR-07 | dialog:User Baru | layout | P2 | Dialog panjang (override max-h 92vh) sehingga Simpan tidak terlihat tanpa scroll. Tombol Simpan memakai pill-active. | Override dihapus, footer Batal + Simpan dibuat sticky, pill-active dihapus, aria-pressed ditambah di tombol level akses. | Diperbaiki |
| ADM-USR-09 | page | ia | P2 | Duplikat: /admin/users memakai komponen yang sama dengan tab 'All users' di /admin/user-management, dan nav matchPaths mengarah ke hub. | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| ADM-USR-04 | page | button | P3 | Pagination memakai raw button 'Prev/Next' rounded-full. | Diganti Button outline sm 'Sebelumnya/Berikutnya'. | Diperbaiki |
| ADM-USR-05 | page | language | P3 | Kolom 'Last Login' berbahasa Inggris di tengah kolom berbahasa Indonesia. | Diganti 'Login Terakhir'. | Diperbaiki |
| ADM-USR-08 | dialog:Reset Password | form | P3 | Label tidak terhubung. Tombol berlabel 'Reset' dan '…'. | Label dihubungkan dan diberi tanda wajib. Tombol jadi 'Reset Password', status simpan 'Menyimpan…'. | Diperbaiki |
| ADM-USR-10 | page | card | P3 | Kolom Status memakai map lokal status-active/status-disabled. Kode role di dialog tampil sebagai teks biasa. | Kolom Status diganti StatusPill. Kode role memakai font-medium tabular-nums. | Diperbaiki |

## `/admin/roles` — Roles & Permissions

- **File:** `frontend/src/portals/admin/Roles.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 7 → 0
- **Dialog/pop-up:** Role Baru (3 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-ROL-01 | page | title | P2 | Rute mandiri tidak punya judul halaman. | Ditambah PageHeader 'Roles & Permissions' dengan aksi 'Tambah Role'. Mode embedded tanpa judul. | Diperbaiki |
| ADM-ROL-02 | page | a11y | P2 | 17 tombol ikon edit/hapus tanpa aria-label, tinggi h-7, hanya muncul saat hover. Role sistem menampilkan tombol edit yang disabled. | Diganti Button icon-sm yang selalu terlihat dengan aria-label. Role sistem tanpa tombol, ada keterangan di baris info. Tombol 'Role Baru' rounded-full pill-active jadi Button default. | Diperbaiki |
| ADM-ROL-03 | dialog:Role Baru | form | P2 | Label tidak terhubung dan uppercase. Label 'Code' berbahasa Inggris, tombol 'Toggle all', kode permission memakai font-mono. | Field Kode dan Nama dibuat 2 kolom, label dihubungkan lewat htmlFor, 'Pilih/lepas semua', font Inter. | Diperbaiki |
| ADM-ROL-04 | dialog:Role Baru | layout | P2 | Daftar permission panjang sehingga footer keluar layar. | Footer Batal + Simpan dibuat sticky, override max-h dan pill-active dihapus. | Diperbaiki |
| ADM-ROL-06 | page | ia | P2 | Duplikat dengan tab 'Roles & permissions' di /admin/user-management. | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| ADM-ROL-05 | page | flow | P3 | Role sistem tidak bisa dibuka untuk melihat daftar permission-nya (tidak ada mode lihat). | Tidak diperbaiki: butuh mode baca-saja di RoleDialog. | Terbuka |
| ADM-ROL-07 | page | typography | P3 | Kode role di kartu dan kode permission di dialog tampil sebagai teks biasa. | Memakai font-medium tabular-nums. | Diperbaiki |

## `/admin/user-management` — Users & Roles

- **File:** `frontend/src/portals/admin/UserManagementHub.jsx`, `frontend/src/portals/admin/AuditLog.jsx`
- **State diperiksa:** halaman + 2 tab, 1 dialog
- **Temuan otomatis (crawler):** 14 → 1
- **Tab:** Roles & permissions, Activity log
- **Dialog/pop-up:** User Baru (6 field)
- **Sisa sinyal otomatis (heuristik):** Isi dialog terpotong/scroll vertikal

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-UMH-05 | tab:Activity Log | typography | P1 | ID user dan entitas memakai font-mono (font selain Inter). | Diganti tabular-nums Inter, ID lengkap dimasukkan ke title. | Diperbaiki |
| ADM-UMH-01 | page | title | P2 | Header berupa h2 'User Management' font-bold, ditambah breadcrumb di dalam halaman. Nama tidak sama dengan menu 'Users & Roles'. | Diganti PageHeader 'Users & Roles', breadcrumb dalam halaman dihapus. | Diperbaiki |
| ADM-UMH-02 | page | tabs | P2 | Tab garis-bawah custom (raw button role=tab, tinggi baris 43px). | Diganti Tabs/TabsList/TabsTrigger standar dengan label sentence case. Testid user-mgmt-tab-* dan user-mgmt-hub-* tetap. | Diperbaiki |
| ADM-UMH-03 | page | title | P2 | Halaman anak berisiko menampilkan judul ganda. | Users, Roles, dan AuditLog dirender dengan prop embedded sehingga tidak ada h1 kedua. | Diperbaiki |
| ADM-UMH-04 | tab:Activity Log | form | P2 | 2 filter tanpa label (placeholder 'Filter entity_type'), tinggi h-10. Tombol 'Refresh' berbahasa Inggris dengan pill-active, dan filter hanya jalan lewat tombol. | Ditambah aria-label dan placeholder berbahasa Indonesia, Enter kini menerapkan filter, tombol jadi 'Terapkan & muat ulang' (outline). Kolom diganti Entitas/Aksi. | Diperbaiki |
| ADM-UMH-06 | tab:Activity Log | ia | P3 | Kolom User hanya menampilkan 8 karakter ID, bukan nama user. | Tidak diperbaiki: butuh lookup data users. | Terbuka |
| ADM-UMH-07 | tab:Activity Log | button | P3 | Pagination memakai raw button 'Prev/Next'. | Diganti Button outline sm 'Sebelumnya/Berikutnya'. | Diperbaiki |

## `/admin/setup` — Setup & Numbering

- **File:** `frontend/src/portals/admin/AdminSetupHub.jsx`, `frontend/src/portals/admin/NumberSeries.jsx`, `frontend/src/portals/admin/TaxConfig.jsx`, `frontend/src/portals/admin/BulkImportAdmin/index.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 8 → 2
- **Tab:** Tax config, Bulk Excel import
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 112px (standar 32/36/40); Tinggi tombol non-standar: 20px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-SET-01 | page | title | P2 | Header berupa h2 font-bold, ditambah breadcrumb di dalam halaman. | Diganti PageHeader 'Setup & Numbering', breadcrumb dihapus. | Diperbaiki |
| ADM-SET-02 | page | tabs | P2 | Tab garis-bawah custom dengan tinggi 43px. | Diganti Tabs standar dengan label sentence case. Testid setup-tab-* tetap. | Diperbaiki |
| ADM-SET-03 | tab:Tax Config | title | P2 | Tab menampilkan h1 kedua 'Tax / Pajak'. Tab Bulk Excel Import juga menampilkan h1 kedua. | Kedua halaman dirender embedded tanpa judul. Subtitle dan aksi pindah ke baris ringkas. | Diperbaiki |
| ADM-SET-04 | tab:Bulk Excel Import | card | P2 | Kartu entitas p-5 dengan ikon 48px (tinggi tombol 204px). Stepper besar (32px, bold). | Kartu jadi p-3 dengan ikon 36px dan panah selalu terlihat. Stepper 28px, label stepper berbahasa Indonesia. | Diperbaiki |

## `/admin/master/:entity` — Master Data

- **File:** `frontend/src/portals/admin/MasterDataHub.jsx`, `frontend/src/portals/admin/MasterData.jsx`
- **State diperiksa:** halaman + 9 tab, 1 dialog
- **Temuan otomatis (crawler):** 43 → 0
- **Tab:** Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Item (6 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-02 | page | tabs | P1 | 10 tab garis-bawah custom dengan ikon meluap di 1280px: baris 49px dengan scroll horizontal, 'Bank Ac…' terpotong, Tax Codes tidak terlihat. | Diganti Tabs standar tanpa ikon (sekitar 870px, muat), label sentence case, COA diberi tooltip 'Chart of Accounts'. Testid md-tab-* dan master-data-tabs tetap. | Diperbaiki |
| ADM-MD-01 | page | title | P2 | Kartu header bespoke (h2 text-base, subtitle 11px) dipakai alih-alih PageHeader. Tombol 'Baru' (rounded-full pill-active) ada di toolbar. | Diganti PageHeader 'Master Data' dengan subtitle per entitas. Aksi utama 'Tambah <Entitas>' masuk ke header (testid master-new tetap). | Diperbaiki |
| ADM-MD-03 | page | a11y | P2 | Tombol edit/hapus baris berupa raw button ikon tanpa aria-label. | Diganti Button ghost icon-sm dengan aria-label dan title. | Diperbaiki |
| ADM-MD-04 | dialog:Baru | form | P2 | Label tidak terhubung dan uppercase, tanda '*' ditulis di dalam string label. Label campur Inggris dan Indonesia ('Code', 'Type', 'Department', 'Currency', 'Rate (e.g. 0.11)'). Select dengan override h-10. | FieldLabel memakai htmlFor/id, tanda * merah diambil dari flag required, label berbahasa Indonesia, select h-9 dengan ariaLabel, layout grid 2 kolom. | Diperbaiki |
| ADM-MD-05 | dialog:Baru | layout | P2 | Judul dialog janggal ('Employees Baru', 'GL Accounts (COA) Baru'). Footer tidak terlihat pada form panjang. Tombol Simpan memakai pill-active. | Judul jadi 'Tambah <singular>' / 'Edit <singular>', ditambah deskripsi kolom wajib, footer Batal + Simpan dibuat sticky. | Diperbaiki |
| ADM-MD-06 | page | typography | P2 | Header kolom berupa key mentah ('unit default', 'is direct purchase', 'full name', 'gaji pokok (salary master)'). | Header kolom diambil dari label field (bahasa sama dengan form). | Diperbaiki |
| ADM-MD-07 | page | runtime | P2 | Bug: kolom Active menampilkan 'Yes/No' karena tipe boolean dicek sebelum kolom 'active'. Nilai select tampil mentah ('active', 'liability'). | Urutan pengecekan diperbaiki: Aktif/Nonaktif untuk kolom active, Ya/Tidak untuk boolean lain, dan nilai select tampil sebagai label opsi. | Diperbaiki |
| ADM-MD-07 | page | runtime | P2 | Kolom Active menampilkan 'Yes/No' dan status tampil mentah (lanjutan dari laporan sebelumnya). | Kolom active dan status kini memakai StatusPill bersama (Active/Inactive, Leave, Terminated), menggantikan map status lokal. Boolean lain tetap Ya/Tidak. | Diperbaiki |
| ADM-MD-08 | page | button | P3 | Pagination memakai raw button 'Prev/Next'. Input cari h-10 tanpa label. | Diganti Button outline sm 'Sebelumnya/Berikutnya'. Input cari h-9 dengan aria-label dan jumlah data. | Diperbaiki |
| ADM-MD-09 | page | flow | P3 | Konfirmasi hapus generik. Toast singkat ('Dibuat', 'Dihapus'). Field kode yang disabled tanpa penjelasan. | Konfirmasi destructive dengan tombol 'Hapus'. Toast jadi '<Entitas> ditambahkan' / 'Data dihapus'. Field kode diberi hint 'tidak bisa diubah'. | Diperbaiki |
| ADM-MD-10 | page | typography | P3 | Kolom kode (code, account_number, sku) tampil sebagai teks biasa. | Memakai Inter font-medium tabular-nums sesuai konvensi lintas portal. | Diperbaiki |

## `/admin/configuration` — Business Rules

- **File:** `frontend/src/portals/admin/configuration/ConfigurationLayout.jsx`
- **State diperiksa:** halaman + 7 tab, 2 dialog
- **Temuan otomatis (crawler):** 6 → 9
- **Tab:** Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating, Brand, Outlet
- **Dialog/pop-up:** Konfirmasi (0 field); Buat Sales Schema (6 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-CFG-01 | page | title | P2 | Kartu header bespoke 'Konfigurasi Self-Service' (h2, ikon 40px, p-5) tidak sama dengan nama menu 'Business Rules'. | Diganti PageHeader 'Business Rules'. | Diperbaiki |
| ADM-CFG-02 | page | tabs | P2 | Subnav pill custom (motion, rounded-full). Label campur Indonesia dan Inggris ('Skema Penjualan', 'Kas Kecil', 'Anomaly Thresholds', 'Versi & Jadwal'). | Diganti Tabs standar dengan istilah ERP berbahasa Inggris sesuai rute (Sales schemas, Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating), hint di title. Testid config-tab-* tetap. | Diperbaiki |
| ADM-CFG-03 | page | flow | P2 | Bug: pindah tab menghapus query scope_type/scope_id sehingga scope kembali ke Group. | Navigasi tab kini mempertahankan location.search. | Diperbaiki |
| ADM-CFG-04 | page | card | P3 | Kartu ScopePicker memakai padding sm:p-4 yang tidak seragam. | Dibakukan p-3, halaman space-y-3. | Diperbaiki |
| ADM-CFG-05 | page | ia | P3 | Breadcrumb TopNav menampilkan 'Business Rules › Detail', bukan nama tab. | Diselesaikan di komponen bersama — TopNav/navigationSchema. | Diperbaiki (komponen shared) |

## `/admin/configuration/sales-schemas` — Business Rules — Sales Schemas

- **File:** `frontend/src/portals/admin/configuration/SalesSchemasPage.jsx`, `frontend/src/portals/admin/configuration/RuleListPage.jsx`, `frontend/src/portals/admin/configuration/RuleEditorShell.jsx`, `frontend/src/portals/admin/configuration/SalesSchemaEditor.jsx`, `frontend/src/portals/admin/configuration/configHelpers.js`
- **State diperiksa:** halaman + 7 tab, 2 dialog
- **Temuan otomatis (crawler):** 6 → 9
- **Tab:** Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating, Brand, Outlet
- **Dialog/pop-up:** Konfirmasi (0 field); Buat Sales Schema (6 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-CFG-SS-03 | page | typography | P1 | Badge versi memakai font-mono. | Diganti tabular-nums Inter. | Diperbaiki |
| ADM-CFG-SS-01 | page | button | P2 | Tombol 'Buat Aturan' size sm rounded-full. Tombol 'Seed Default' memakai istilah dev. 'Muat Ulang' memakai Title Case. | Ukuran default tanpa rounded-full, label 'Buat Default' (dengan title), 'Muat ulang'. Judul seksi h2 text-base/lg. | Diperbaiki |
| ADM-CFG-SS-02 | page | a11y | P2 | Tombol ikon edit/duplikat/arsip memakai override h-8 dan hanya punya title. Cari dan filter status tanpa label. | Diganti size icon-sm dengan aria-label. Cari dan filter diberi aria-label. | Diperbaiki |
| ADM-CFG-SS-04 | dialog:Buat Aturan | form | P2 | Label Mulai/Berakhir tanpa htmlFor. 'Nama Aturan' wajib tapi tanpa tanda *. Scope memakai font-mono. | Ditambah htmlFor/id, tanda *, label text-xs md:text-sm, font Inter. | Diperbaiki |
| ADM-CFG-SS-05 | dialog:Buat Aturan | layout | P2 | Sheet panjang dengan Simpan hanya di paling bawah. Batal memakai ghost, Simpan rounded-full. | Footer dibuat sticky di Sheet dan Dialog, Batal outline, Simpan default. | Diperbaiki |
| ADM-CFG-SS-06 | dialog:Buat Aturan | flow | P2 | Tambah channel dan metode bayar memakai window.prompt() bawaan browser. | Diganti input inline + tombol 'Tambah' (Enter didukung) dengan validasi kode duplikat. Testid sales-add-*-btn tetap. | Diperbaiki |
| ADM-CFG-SS-07 | dialog:Buat Aturan | a11y | P2 | Tombol 'Naik' memakai ikon GripVertical (terlihat seperti handle drag). Input dan switch baris tanpa label. | Diganti ArrowUp/ArrowDown (ditambah channel-down-*) dengan aria-label. Semua input, switch, dan select baris diberi aria-label, chip metode bayar diberi aria-pressed. | Diperbaiki |
| ADM-CFG-SS-08 | dialog:Buat Aturan | typography | P3 | Subjudul blok editor uppercase 12px. Nama aturan Indonesia ('Skema Penjualan') beda dari nama tab. | Subjudul jadi text-sm semibold. RULE_LABELS dan judul seksi memakai nama tab ('Sales Schema(s)'). | Diperbaiki |
| ADM-CFG-SS-09 | dialog:Buat Aturan | typography | P3 | Chip kode channel memakai font-mono. | Kode channel dan metode bayar memakai font-medium tabular-nums. | Diperbaiki |

## `/admin/configuration/petty-cash-policies` — Business Rules — Petty Cash Policies

- **File:** `frontend/src/portals/admin/configuration/PettyCashPoliciesPage.jsx`, `frontend/src/portals/admin/configuration/PettyCashPolicyEditor.jsx`, `frontend/src/portals/admin/configuration/RuleEditorShell.jsx`
- **State diperiksa:** halaman + 8 tab, 2 dialog
- **Temuan otomatis (crawler):** 7 → 10
- **Tab:** Sales schemas, Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating, Brand, Outlet
- **Dialog/pop-up:** Konfirmasi (0 field); Buat Petty Cash Policy (6 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-CFG-PC-01 | dialog:Buat Aturan | form | P2 | 4 field tanpa label terhubung, slider tanpa aria-label, nominal memakai font-mono. | Ditambah htmlFor/id di input, select, dan switch, aria-label di slider, nominal medium tabular-nums. | Diperbaiki |
| ADM-CFG-PC-02 | dialog:Buat Aturan | button | P2 | Varian dialog punya tombol X kedua di judul (selain X bawaan) dan override max-h 88vh. | X duplikat dan override dihapus, footer dibuat sticky. | Diperbaiki |
| ADM-CFG-PC-03 | page | title | P3 | Judul seksi 'Kebijakan Kas Kecil' tidak sama dengan nama tab. | Diganti 'Petty Cash Policies'. | Diperbaiki |

## `/admin/configuration/service-charge-policies` — Business Rules — Service Charge Policies

- **File:** `frontend/src/portals/admin/configuration/ServiceChargePoliciesPage.jsx`, `frontend/src/portals/admin/configuration/ServiceChargePolicyEditor.jsx`
- **State diperiksa:** halaman + 8 tab, 2 dialog
- **Temuan otomatis (crawler):** 7 → 10
- **Tab:** Sales schemas, Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating, Brand, Outlet
- **Dialog/pop-up:** Konfirmasi (0 field); Buat Service Charge Policy (8 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-CFG-SC-02 | dialog:Buat Aturan | typography | P1 | Preview perhitungan memakai font-mono. | Diganti Inter tabular-nums. X duplikat juga dihapus (lihat ADM-CFG-PC-02). | Diperbaiki |
| ADM-CFG-SC-01 | dialog:Buat Aturan | form | P2 | 6 field tanpa label terhubung, RadioGroup 'Metode Alokasi' tanpa label. | Ditambah htmlFor/id dan aria-labelledby di RadioGroup. | Diperbaiki |

## `/admin/configuration/incentive-schemes` — Business Rules — Incentive Schemes

- **File:** `frontend/src/portals/admin/configuration/IncentiveSchemesPage.jsx`, `frontend/src/portals/admin/configuration/IncentiveSchemeEditor.jsx`
- **State diperiksa:** halaman + 8 tab, 2 dialog
- **Temuan otomatis (crawler):** 7 → 10
- **Tab:** Sales schemas, Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating, Brand, Outlet
- **Dialog/pop-up:** Konfirmasi (0 field); Buat Incentive Scheme (7 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-CFG-INC-01 | dialog:Buat Aturan | form | P2 | 5 field tanpa label terhubung. Input baris tier hanya berplaceholder ('Min sales', 'Notes'). Tombol hapus tier tanpa aria-label. | Ditambah htmlFor/id, aria-label per input tier, 'Catatan', hapus tier memakai icon-sm dengan aria-label. | Diperbaiki |
| ADM-CFG-INC-02 | dialog:Buat Aturan | tabs | P3 | TabsList diberi override 'grid grid-cols-3'. Heading 'Eligibility' uppercase. | Override dihapus, heading jadi text-sm semibold. | Diperbaiki |

## `/admin/configuration/anomaly-thresholds` — Business Rules — Anomaly Thresholds

- **File:** `frontend/src/portals/admin/configuration/AnomalyThresholdsPage.jsx`, `frontend/src/portals/admin/configuration/AnomalyThresholdEditor.jsx`
- **State diperiksa:** halaman + 8 tab, 2 dialog
- **Temuan otomatis (crawler):** 6 → 10
- **Tab:** Sales schemas, Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating, Brand, Outlet
- **Dialog/pop-up:** Konfirmasi (0 field); Buat Anomaly Threshold (16 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-CFG-AT-01 | dialog:Buat Aturan | form | P2 | 14 field angka (NumField) tanpa label terhubung. Switch per seksi tanpa aria-label. | NumField diberi htmlFor/id dari testid. Switch diberi aria-label 'Aktifkan/Nonaktifkan <seksi>'. | Diperbaiki |
| ADM-CFG-AT-02 | page | ia | P2 | Jenis aturan ini tidak muncul di timeline Effective dating. | Ditambahkan ke RULE_TYPES timeline (lihat ADM-CFG-ED-03). | Diperbaiki |

## `/admin/configuration/effective-dating` — Business Rules — Effective Dating

- **File:** `frontend/src/portals/admin/configuration/EffectiveDatingTimelinePage.jsx`
- **State diperiksa:** halaman + 10 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 11
- **Tab:** Sales schemas, Petty cash, Service charge, Incentive schemes, Anomaly thresholds, Effective dating, Brand, Outlet, Sales Schema, Petty Cash Policy
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-CFG-ED-02 | page | runtime | P1 | Bug: peringatan '8 aturan bentrok' ikut menghitung rule_type yang tidak tampil di timeline, padahal hanya sekitar 2 bar yang terlihat bentrok. | Hitungan bentrok dan empty state kini hanya memakai jenis aturan yang ditampilkan. | Diperbaiki |
| ADM-CFG-ED-01 | page | tabs | P2 | Filter jenis aturan berupa tombol rounded-full size sm (28px). | Diganti Tabs standar. Testid timeline-filter-* (target tour) tetap. | Diperbaiki |
| ADM-CFG-ED-03 | page | ia | P2 | Anomaly Thresholds punya tab sendiri tetapi tidak ada di timeline maupun filter. | anomaly_threshold_policy ditambahkan. | Diperbaiki |
| ADM-CFG-ED-04 | page | title | P3 | Judul seksi 'Versi & Jadwal' tidak sama dengan nama tab. Tooltip versi memakai font-mono. | Diganti 'Effective Dating', tooltip versi memakai tabular-nums. | Diperbaiki |

## `/admin/workflows` — Approval Workflows

- **File:** `frontend/src/portals/admin/ApprovalWorkflows.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 4 → 1
- **Dialog/pop-up:** Tambah Workflow (8 field)
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 64px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-WF-01 | page | title | P2 | Tidak ada judul, hanya teks ringkasan. | Ditambah PageHeader 'Approval Workflows' dengan subtitle jumlah workflow dan aksi. | Diperbaiki |
| ADM-WF-02 | page | button | P2 | Tombol 'Reset to Defaults' dan 'Workflow Baru' memakai rounded-full h-9 pill-active, label berbahasa Inggris. | Diganti 'Reset ke Default' (outline) dan 'Tambah Workflow' (default). Testid tetap. | Diperbaiki |
| ADM-WF-03 | page | ia | P2 | Duplikat fungsi dengan /admin/approvals: keduanya mengedit business_rules rule_type=approval_workflow, dan menu 'Approval Matrix' memakai matchPaths /admin/workflows. Halaman ini punya 'Eskalasi ke (permission)' yang tidak ada di builder. | Ditambah banner dengan tautan 'Buka Approval Matrix'. Rute tidak dihapus. Saran: pindahkan field eskalasi ke builder, lalu redirect. | Terbuka |
| ADM-WF-04 | page | a11y | P2 | Tombol edit/hapus versi berupa raw button tanpa aria-label. Header grup accordion tanpa aria-expanded. Teks '1 version · active: 1' dan '(any)' berbahasa Inggris. | Diganti Button icon-sm dengan aria-label, ditambah aria-expanded, header jadi h3. Teks jadi '1 versi · 1 aktif' dan '(siapa saja)'. | Diperbaiki |
| ADM-WF-05 | dialog:Workflow Baru | form | P2 | 5 field tanpa label terhubung, label uppercase 11px. Input memakai override h-10/h-8. Label Inggris ('Entity Type', 'Amount Field', 'Min Amount'). | Ditambah htmlFor/id, label standar, 'Jenis Entitas *', 'Field Nominal', 'Nominal Min/Maks', input h-9. | Diperbaiki |
| ADM-WF-06 | dialog:Workflow Baru | button | P2 | Tombol 'Hapus Tier' dan 'Step' memakai rounded-full h-7/h-9 text-xs. Simpan berlabel 'Buat' dengan pill-active. Footer tidak terjangkau pada form panjang. | Tombol memakai size sm/default, 'Tambah Step', 'Simpan'. Footer Batal + Simpan dibuat sticky. | Diperbaiki |

## `/admin/approvals` — Approval Matrix

- **File:** `frontend/src/portals/admin/ApprovalMatrixBuilder.jsx`, `frontend/src/portals/admin/ApprovalMatrixBuilder/index.jsx`, `frontend/src/portals/admin/ApprovalMatrixBuilder/TierEditor.jsx`, `frontend/src/portals/admin/ApprovalMatrixBuilder/StepEditor.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 13 → 3
- **Tab:** Simulasi, Diagram
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 54, 74px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-AM-01 | page | title | P2 | h2 text-2xl custom 'Approval Matrix — Global Builder' (tidak sama dengan menu). Simpan memakai pill-active. | Diganti PageHeader 'Approval Matrix' dengan 'Simpan Workflow' di actions (testid tetap). State loading juga memakai PageHeader. | Diperbaiki |
| ADM-AM-02 | page | form | P2 | 21 input tanpa label terhubung (Min/Max Amount, label tier/step, deadline, chip multi-select). | Ditambah htmlFor/id dan aria-label. Chip multi-select bisa dibuka dengan keyboard (role=button). Label 'Nominal Min/Maks'. | Diperbaiki |
| ADM-AM-03 | page | button | P2 | Tombol urutan tier memakai teks '↑'/'↓' dengan size icon 36px. Toggle mode routing berupa tombol custom px-3 py-1.5. | Diganti ikon ArrowUp/ArrowDown dengan icon-sm. Toggle mode jadi segmented h-8 px-2.5 text-[13px] pill-active dengan aria-pressed. | Diperbaiki |
| ADM-AM-04 | page | layout | P3 | Rail entitas tidak ikut saat builder panjang (halaman lebih dari 3000px). Badge 'none' berbahasa Inggris. Item rail tanpa state a11y. | Rail dibuat sticky (md), badge 'belum ada', aria-pressed, judul 'Jenis Entitas'. Tombol 'Tambah Tier' tidak lagi w-full. | Diperbaiki |
| ADM-AM-05 | tab:Preview | language | P3 | Teks campuran: 'Amount (Rp)', '— None —', 'approver(s)', 'match', emoji ⚠️. Label select tidak terhubung. | Tab diganti 'Simulasi', 'Nominal (Rp)', '— Semua outlet/brand —', ikon AlertCircle, htmlFor/id di select. | Diperbaiki |
| ADM-AM-06 | tab:Diagram | language | P3 | Teks '(no label)' berbahasa Inggris. | Diganti '(tanpa label)'. | Diperbaiki |

## `/admin/bulk-import` — Bulk Excel Import

- **File:** `frontend/src/portals/admin/BulkImport.jsx`, `frontend/src/portals/admin/BulkImportAdmin/index.jsx`, `frontend/src/portals/admin/BulkImportAdmin/constants.js`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 112px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-BLK-02 | page | card | P2 | Komponen lokal StatCard (text-3xl font-bold) dipakai untuk hasil pratinjau dan import. | Diganti CompactStatCard (testid preview-*/result-* tetap), file BulkImportAdmin/StatCard.jsx dihapus. | Diperbaiki |
| ADM-BLK-03 | page | language | P2 | Label campur bahasa: 'Pilih Entity', 'Download Template', 'Upload & Preview', 'Commit Import', 'Unique key', 'Download Error CSV', toast 'Preview OK … invalid'. | Diganti 'Pilih entitas', 'Unduh template', 'Unggah & pratinjau', 'Konfirmasi import', 'Kunci unik', 'Unduh CSV Error', 'Jalankan Import', toast berbahasa Indonesia. | Diperbaiki |
| ADM-BLK-06 | page | ia | P2 | Duplikat dengan tab 'Bulk Excel import' di /admin/setup (nav matchPaths ke hub). | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| ADM-BLK-01 | page | title | P3 | Judul berupa h1 custom text-2xl font-bold (weight 700). | Diganti PageHeader dengan 'Mulai Ulang' di actions. Mode embedded hanya menampilkan baris subtitle + aksi. | Diperbaiki |
| ADM-BLK-04 | page | button | P3 | Tombol w-full raksasa. Footer menaruh Commit di kiri dan Batal di kanan. 'Lihat semua' berupa raw button. | Tombol ukuran default, footer Batal lalu 'Jalankan Import' rata kanan, Button variant link. | Diperbaiki |
| ADM-BLK-05 | page | a11y | P3 | Dropzone file berupa div klik tanpa role dan tanpa dukungan keyboard. | Ditambah role=button, tabIndex, aria-label, dan Enter/Space. | Diperbaiki |

## `/admin/number-series` — Number Series

- **File:** `frontend/src/portals/admin/NumberSeries.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-NUM-02 | page | typography | P1 | Format dan 'Current' memakai font-mono. Teks 'Current: N' dan 'Reset: monthly' berbahasa Inggris. | Diganti Inter, 'No. terakhir: N', reset 'bulanan/tahunan'. | Diperbaiki |
| ADM-NUM-02 | page | typography | P1 | Format nomor dan 'No. terakhir' perlu mengikuti konvensi kode/nomor dokumen. | Memakai Inter font-medium tabular-nums (bukan font-mono). | Diperbaiki |
| ADM-NUM-01 | page | title | P2 | Rute mandiri tidak punya judul. | Ditambah PageHeader 'Number Series'. Mode embedded tanpa judul. | Diperbaiki |
| ADM-NUM-03 | page | ia | P2 | Teks 'Edit format dan padding via Master Data' menunjuk fitur yang tidak ada (Master Data tidak punya entitas number series). | Teks diganti '(hanya-baca)'. UI edit memang belum tersedia. | Diperbaiki |
| ADM-NUM-05 | page | ia | P2 | Duplikat dengan tab Number series di /admin/setup. | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| ADM-NUM-04 | page | density | P3 | Kartu p-4 dalam 3 kolom banyak ruang kosong. | Kartu jadi p-3, 4 kolom di xl. | Diperbaiki |

## `/admin/audit-log` — Audit Log

- **File:** `frontend/src/portals/admin/AuditLog.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-AUD-01 | page | title | P2 | Rute mandiri tidak punya judul. | Ditambah PageHeader 'Audit Log'. Mode embedded tanpa judul. | Diperbaiki |
| ADM-AUD-02 | page | form | P2 | 2 input filter tanpa label, tinggi h-10, tombol 'Refresh' pill-active, font-mono di ID, pagination raw. | Lihat ADM-UMH-04, ADM-UMH-05, ADM-UMH-07. | Diperbaiki |
| ADM-AUD-03 | page | ia | P2 | Duplikat dengan tab 'Activity log' di /admin/user-management. | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/admin/integrations` — Integrations

- **File:** `frontend/src/portals/admin/Integrations.jsx`, `frontend/src/portals/admin/integrations/TelegramTestPanel.jsx`, `frontend/src/portals/admin/integrations/WhatsAppTestPanel.jsx`, `frontend/src/portals/admin/integrations/LlmTestPanel.jsx`
- **State diperiksa:** halaman + 5 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Tab:** WhatsApp 1/7, Email 1/4, AI / LLM 0/7, Branding 0/3, Lainnya 8/16
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 21px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-INT-05 | page | typography | P1 | Input token/URL dan nama provider memakai font-mono. | Di panel diganti Inter. Kode key di daftar setting adalah komponen shared. | Diperbaiki |
| ADM-INT-01 | page | title | P2 | Kartu header bespoke 'Integrations Hub' (h2, ikon 40px, p-5) tidak sama dengan nama menu. | Diganti PageHeader 'Integrations'. Wrapper testid admin-integrations-header tetap. | Diperbaiki |
| ADM-INT-02 | page | tabs | P2 | Tab berupa raw button rounded-full dengan badge hitungan font-mono. | Diganti Tabs standar berbasis rute, badge tabular-nums dengan title. Testid integration-tab-* dan admin-integrations-tabs tetap. | Diperbaiki |
| ADM-INT-03 | page | language | P2 | Panel tes berlabel Inggris ('Verify saved token', 'Test Saved Token', 'Test (don't save)', 'Setup Webhook', 'Send Test WhatsApp', 'Test Saved Config', '✓ OK/✗ Failed') dan memakai emoji 💡. | Semua label dan tombol diterjemahkan ke Bahasa Indonesia, emoji dan simbol dihapus. | Diperbaiki |
| ADM-INT-04 | page | form | P2 | 2 input tanpa label terhubung (token sementara, URL webhook). | Ditambah htmlFor/id. Input sementara di panel WA/LLM diberi aria-label. | Diperbaiki |
| ADM-INT-06 | page | language | P2 | Daftar setting (IntegrationSettingsList) menampilkan pill 'Not Configured' bersama teks 'Belum dikonfigurasi' (duplikat), tombol 'Set/Update', dan key font-mono. | Diselesaikan di komponen bersama — components/shared/IntegrationSettingsList.jsx. | Diperbaiki (komponen shared) |
| ADM-INT-07 | page | flow | P2 | Saat URL kosong, 'Daftarkan Webhook' memakai window.prompt(). Ada juga bug: URL hasil prompt hanya di-set ke state, sementara request tetap mengirim state lama (kosong), jadi URL yang diketik tidak pernah terkirim. | Diperbaiki terpusat: window.prompt diganti promptDialog (UX-G-48). | Diperbaiki |
| ADM-INT-05 | page | typography | P3 | Mengikuti koreksi konvensi: font-mono dipertahankan untuk token/secret. | font-mono dikembalikan di input token Telegram, API key Resend sementara, dan key LLM sementara. URL dan nomor telepon tetap Inter. | Diperbaiki |
| ADM-INT-07 | page | flow | P3 | 'Daftarkan Webhook' dengan URL kosong masih memakai window.prompt sebagai fallback. | Diperbaiki terpusat: window.prompt diganti promptDialog (UX-G-48). | Diperbaiki |

## `/admin/integrations/:tab` — Integrations (tab Email/WhatsApp/AI/Branding/Lainnya)

- **File:** `frontend/src/portals/admin/Integrations.jsx`, `frontend/src/portals/admin/integrations/EmailTestPanel.jsx`
- **State diperiksa:** halaman + 6 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Tab:** Telegram 0/2, WhatsApp 1/7, Email 1/4, AI / LLM 0/7, Branding 0/3, Lainnya 8/16
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 21px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-INTT-01 | page | language | P2 | Panel email berlabel Inggris ('Test Resend Email', 'Recipient (To)', 'Send Test (Saved Config)', 'Test ephemeral key (no save)'), toast 'MOCKED', emoji 💡. | Diganti 'Tes Email (Resend)', 'Penerima (To)', 'Kirim Tes (Konfigurasi Tersimpan)', 'Tes API key sementara', 'Mode simulasi …', emoji dihapus. | Diperbaiki |
| ADM-INTT-02 | page | form | P2 | 3 input tanpa label terhubung. | Ditambah htmlFor/id dan aria-label. Font-mono dihapus. | Diperbaiki |
| ADM-INTT-03 | page | ia | P3 | Breadcrumb menampilkan 'Integrations › Detail', bukan nama tab. | Diselesaikan di komponen bersama — TopNav/navigationSchema. | Diperbaiki (komponen shared) |

## `/admin/tax` — Tax Config

- **File:** `frontend/src/portals/admin/TaxConfig.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 20px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-TAX-01 | page | title | P2 | Judul 'Tax / Pajak' tidak sama dengan nama tab 'Tax Config'. Di hub, judul ini menjadi h1 kedua. | Diganti PageHeader 'Tax Config' dengan aksi 'Buka Finance → Pajak'. Mode embedded tanpa judul. | Diperbaiki |
| ADM-TAX-02 | page | card | P2 | Kartu ad-hoc rounded-2xl border-2 p-5 bg-*-50 (gray-50 tidak mendukung dark mode). Banner info berisi label dev 'Sprint 1 — Compliance Indonesia 2026'. Kartu 'Konfigurasi Lengkap' menduplikasi isi banner. | Diganti glass-card p-4 dengan ring saat aktif. Banner dan kartu digabung menjadi satu banner ringkas, label dev dihapus. Testid tax-* tetap. | Diperbaiki |
| ADM-TAX-03 | page | a11y | P2 | Toggle custom (button h-7 w-14) tanpa label. | Diganti Switch shadcn dengan aria-label dan label klik. Testid tax-toggle-* tetap. | Diperbaiki |
| ADM-TAX-05 | page | ia | P2 | Duplikat dengan tab Tax config di /admin/setup. | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| ADM-TAX-04 | page | language | P3 | Badge 'ON/OFF' dan toast 'Diaktifkan ✓'. | Badge jadi 'Aktif/Nonaktif' (status-active/disabled), toast tanpa simbol, ditambah 'Tarif N%'. | Diperbaiki |
| ADM-TAX-04 | page | language | P3 | Badge status per jenis pajak memakai map lokal. | Diganti StatusPill (Active/Inactive). | Diperbaiki |

## `/admin/settings` — System Settings

- **File:** `frontend/src/portals/admin/SystemSettings.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-SYS-01 | form | form | P2 | 7 input tanpa label terhubung, label uppercase, pemilih warna h-10 tanpa label. | Ditambah htmlFor/id, label text-xs md:text-sm medium, aria-label di pemilih warna, tinggi h-9. | Diperbaiki |
| ADM-SYS-02 | form | button | P2 | 6 tombol 'Simpan' primer rounded-full h-10 tampil bersamaan (banyak aksi primer dalam satu area). | Tombol outline secara default. Jadi primer dan aktif hanya bila nilai berubah atau belum pernah disimpan, ditambah aria-label per baris. | Diperbaiki |
| ADM-SYS-03 | page | ia | P2 | Tautan 'Konfigurasi Lainnya' mengarah ke rute duplikat (/admin/tax, /admin/number-series, /admin/workflows) dengan label beda dari menu ('API Keys & Integrations', 'Operations & Monitoring'). Kartu tautan ditaruh di atas pengaturan utama. | Diarahkan ke rute hub kanonik (/admin/setup?tab=…, /admin/approvals) dengan nama menu, dan dipindah ke bawah pengaturan utama. | Diperbaiki |
| ADM-SYS-04 | page | language | P3 | Label 'Default Digest Time', 'Default Locale/Timezone' dan toast 'Setting KEY disimpan' berbahasa Inggris atau memakai key mentah. | Diganti label Indonesia, toast memakai nama label. | Diperbaiki |
| ADM-SYS-05 | page | card | P3 | Kartu p-5 dan judul seksi h3. | Kartu jadi p-4, judul seksi h2 text-base/lg semibold. | Diperbaiki |

## `/admin/master/vendors` — Master Data — Vendors

- **File:** `frontend/src/portals/admin/MasterData.jsx`, `frontend/src/portals/admin/MasterDataHub.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 47 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Vendor (8 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-VEN-01 | dialog:Baru | form | P2 | 8 field tanpa label terhubung. Label 'Contact Person' dan 'Payment Terms (hari)' berbahasa Inggris. Email memakai type text. | Label dihubungkan, diganti 'Nama Kontak' dan 'Termin Pembayaran (hari)', Email jadi type=email. Lihat ADM-MD-04. | Diperbaiki |
| ADM-MD-VEN-02 | page | a11y | P2 | 12 tombol ikon tanpa label, header 'default payment terms days' mentah, dan tab bersama ikut meluap. | Lihat ADM-MD-02, ADM-MD-03, ADM-MD-06. | Diperbaiki |

## `/admin/master/employees` — Master Data — Employees

- **File:** `frontend/src/portals/admin/MasterData.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 47 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Employee (8 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-EMP-01 | page | runtime | P2 | Kolom Status menampilkan nilai mentah 'active'. Header kolom 'gaji pokok (salary master)' huruf kecil. | Status ditampilkan sebagai label opsi (Aktif/Cuti/Terminated). Header diganti 'Gaji Pokok'. | Diperbaiki |
| ADM-MD-EMP-02 | dialog:Baru | form | P2 | Judul 'Employees Baru'. 8 field tanpa label terhubung, label 'Department' berbahasa Inggris, select Outlet dengan override h-10. Kotak gaji berlabel uppercase 'read-only'. | Judul jadi 'Tambah Employee', label diganti 'Departemen', select h-9 dengan ariaLabel, kotak gaji berlabel 'hanya-baca', footer sticky. | Diperbaiki |
| ADM-MD-EMP-03 | page | a11y | P2 | 40 tombol ikon tanpa aria-label, pagination berupa raw button. | Lihat ADM-MD-03 dan ADM-MD-08. | Diperbaiki |

## `/admin/master/outlets` — Master Data — Outlets

- **File:** `frontend/src/portals/admin/MasterData.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 46 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Outlet (6 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-OUT-01 | page | runtime | P2 | Kolom Active menampilkan 'Yes'. Header 'open time' dan 'close time' mentah. | Tampil 'Aktif/Nonaktif', header diganti 'Jam Buka' dan 'Jam Tutup'. | Diperbaiki |
| ADM-MD-OUT-02 | dialog:Baru | form | P2 | 4 field tanpa label terhubung, dan switch Aktif tanpa id. | Label dihubungkan lewat htmlFor dan Switch diberi id. Lihat ADM-MD-04. | Diperbaiki |

## `/admin/master/brands` — Master Data — Brands

- **File:** `frontend/src/portals/admin/MasterData.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 46 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Brand (3 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-BRD-02 | dialog:Baru | form | P2 | 2 field tanpa label. Label 'Color (hex)' berbahasa Inggris. | Label dihubungkan dan diganti 'Warna (hex)'. | Diperbaiki |
| ADM-MD-BRD-01 | page | typography | P3 | Kode warna dirender dalam <code> (monospace). Kolom Active menampilkan 'Yes'. | Kode warna memakai Inter tabular-nums dengan swatch ber-border. Kolom tampil 'Aktif'. | Diperbaiki |

## `/admin/master/categories` — Master Data — Categories

- **File:** `frontend/src/portals/admin/MasterData.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 46 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Category (3 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-CAT-02 | dialog:Baru | form | P2 | 3 field tanpa label. Label 'Type *' berbahasa Inggris. | Diganti 'Tipe' dengan tanda * dari flag required, label dihubungkan. | Diperbaiki |
| ADM-MD-CAT-01 | page | runtime | P3 | Kolom tipe menampilkan nilai mentah 'item' atau 'expense'. | Ditampilkan sebagai label opsi. | Diperbaiki |

## `/admin/master/chart-of-accounts` — Master Data — Chart of Accounts

- **File:** `frontend/src/portals/admin/MasterData.jsx`, `frontend/src/portals/admin/AdminHome.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 46 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Akun COA (5 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-COA-01 | page | language | P2 | Nama entitas tidak konsisten: tile 'GL Accounts', tab 'COA', judul 'GL Accounts (COA)'. Placeholder cari 'Cari gl accounts (coa)…'. | Nama dibakukan 'Chart of Accounts', tab tetap 'COA' dengan tooltip, singular 'Akun COA'. | Diperbaiki |
| ADM-MD-COA-02 | page | runtime | P2 | Kolom 'is postable' dan 'active' menampilkan Yes/No. Tipe tampil mentah 'liability'. | Tampil Ya/Tidak dan Aktif/Nonaktif, tipe memakai label opsi, header diganti 'Bisa Diposting (leaf)' dan 'Saldo Normal'. | Diperbaiki |
| ADM-MD-COA-03 | dialog:Baru | form | P2 | 5 field tanpa label. Label 'Normal Balance' dan 'Credit' berbahasa Inggris. | Label dihubungkan, diganti 'Saldo Normal' dan 'Kredit (Cr)'. | Diperbaiki |

## `/admin/master/payment-methods` — Master Data — Payment Methods

- **File:** `frontend/src/portals/admin/MasterData.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 46 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Payment Method (3 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-PM-02 | dialog:Baru | form | P2 | 3 field tanpa label terhubung. | Lihat ADM-MD-04. | Diperbaiki |
| ADM-MD-PM-01 | page | runtime | P3 | Tipe tampil mentah ('cash', 'qris'). | Ditampilkan sebagai label opsi (Cash/QRIS/…), opsi 'Other' diganti 'Lainnya'. | Diperbaiki |

## `/admin/master/bank-accounts` — Master Data — Bank Accounts

- **File:** `frontend/src/portals/admin/MasterData.jsx`, `frontend/src/portals/admin/MasterDataHub.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 46 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Bank Account (5 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-BA-01 | page | tabs | P1 | Tab 'Bank Ac…' terpotong di tepi kanan sehingga sulit ditemukan. | Lihat ADM-MD-02: semua tab kini muat dalam satu baris. | Diperbaiki |
| ADM-MD-BA-02 | dialog:Baru | form | P2 | 5 field tanpa label. Label 'Currency' berbahasa Inggris. | Label dihubungkan dan diganti 'Mata Uang'. | Diperbaiki |

## `/admin/master/tax-codes` — Master Data — Tax Codes

- **File:** `frontend/src/portals/admin/MasterData.jsx`, `frontend/src/portals/admin/MasterDataHub.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 46 → 0
- **Tab:** Items, Vendors, Employees, Outlets, Brands, Categories, COA, Payment methods, Bank accounts, Tax codes
- **Dialog/pop-up:** Tambah Tax Code (3 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADM-MD-TC-01 | page | tabs | P1 | Tab Tax Codes berada di luar layar (overflow) sehingga tidak terlihat. | Lihat ADM-MD-02. | Diperbaiki |
| ADM-MD-TC-02 | dialog:Baru | form | P2 | 3 field tanpa label. Label 'Rate (e.g. 0.11)' berbahasa Inggris dan ambigu. | Diganti 'Tarif (mis. 0.11 = 11%)' dan label dihubungkan. | Diperbaiki |

## Catatan reviewer

Semua file yang diedit lolos jsxcheck. ESLint no-undef pada salinan file tidak menemukan identifier yang tidak terdefinisi; satu-satunya error adalah komentar eslint-disable react-hooks yang sudah ada sebelumnya. python3 scripts/audit_tours.py = 0 missing. Hal yang perlu diketahui lead: (1) AdminPortal tidak lagi merender PageHeader 'Admin Platform'; judul sekarang ada di AdminHome ('Admin Overview'). Perubahan AdminPortal ini ternyata sudah ikut ter-commit di e7b5d1f. (2) Users, Roles, AuditLog, NumberSeries, TaxConfig dan BulkImport menerima prop `embedded`. Hub mengirim embedded agar tidak ada h1 ganda; rute mandiri tetap punya PageHeader sendiri. (3) MasterData menerima prop `tabs` dari MasterDataHub. Tab entitas sekarang Tabs standar tanpa ikon dan muat di 1280px. (4) BulkImportAdmin/StatCard.jsx dihapus (diganti CompactStatCard). (5) Testid baru: admin-master-see-all, approval-workflows-page, config-tabs, master-form-cancel, user-form-cancel, user-form-phone, wf-cancel, wf-dialog, wf-matrix-hint, wf-open-matrix, select-preview-outlet/brand, telegram-webhook-url, wa-test-message, channel-down-*, step-*-*-deadline, master-field-*, sales-add-*-input. Testid tile-*, sales-add-*-btn dan tax-toggle-* tetap dirender, hanya kini lewat prop. (6) Perilaku yang berubah: Roles tidak lagi merender tombol edit disabled untuk role sistem, jadi role-edit/role-delete hanya ada untuk role custom. Tombol Simpan di System Settings disabled sampai nilainya berubah (atau key belum pernah disimpan). SalesSchemaEditor tidak lagi memakai window.prompt (input inline + Tambah). Pindah tab di /admin/configuration mempertahankan query scope. Timeline Effective dating kini memuat anomaly_threshold_policy dan menghitung bentrok hanya untuk jenis yang ditampilkan. (7) Label tab dan nama jenis aturan di Configuration (RULE_LABELS) diganti ke istilah ERP Inggris (Sales Schema, Petty Cash Policy, …), sehingga judul dialog menjadi mis. 'Buat Sales Schema'. (8) Rute duplikat yang diverifikasi dan TIDAK dihapus: /admin/users, /admin/roles, /admin/audit-log ≈ tab /admin/user-management; /admin/number-series, /admin/tax, /admin/bulk-import ≈ tab /admin/setup; /admin/workflows ≈ /admin/approvals (data sama: business_rules approval_workflow, tetapi hanya /admin/workflows yang punya 'Eskalasi ke permission'). Rekomendasi: redirect ke hub setelah fitur setara.  ADDENDUM: ADDENDUM untuk laporan JSON sebelumnya, setelah FYI dari lead. (1) confirmDialog tetap dipakai apa adanya; konfirmasi hapus di Master Data memakai {destructive:true, confirmText:'Hapus'}. (2) window.prompt terakhir di area saya (TelegramTestPanel) sudah diganti promptDialog, sekaligus memperbaiki bug URL webhook tidak terkirim. SalesSchemaEditor sudah memakai input inline. (3) Konvensi kode diterapkan: Inter font-medium tabular-nums untuk kode/nomor di MasterData, NumberSeries, Roles, kode role di UserDialog, ID di AuditLog, kode channel/metode bayar, dan value entitas di rail Approval Matrix. font-mono dipertahankan untuk token/secret integrasi. (4) Status lokal (status-active/disabled) di MasterData, Users, dan TaxConfig diganti StatusPill. Akibatnya label status kini 'Active/Inactive' (Inggris, sesuai kamus StatusPill), bukan 'Aktif/Nonaktif'. (5) Semua file yang diubah lolos jsxcheck dan ESLint no-undef; audit_tours tetap 0 missing. Selebihnya laporan sebelumnya tetap berlaku.
