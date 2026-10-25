# Audit UI/UX — HR & Halaman Sistem

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/hr` — HR Overview

- **File:** `frontend/src/portals/hr/HRHome.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 2
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| HR-HOME-01 | page | title | P2 | Tidak ada <h1>. Header berupa glass-card p-6 dengan h2 text-xl font-bold. | Diganti PageHeader "HR Overview" (ikon + subtitle periode aktif). Wrapper data-testid hr-home-header dan span hr-home-period dipertahankan. | Diperbaiki |
| HR-HOME-02 | page | card | P2 | Strip KPI memakai KpiCard tanpa delta/tren, dan onClick memakai window.location.assign sehingga halaman reload penuh. | Diganti CompactStatCard (sub = hint), klik memakai navigate() dari react-router. Wrapper hr-kpi-* tetap. | Diperbaiki |
| HR-HOME-03 | page | ia | P2 | ActionTile "Approval Center" dan ApprovalWidget masih menaut ke /hr/approvals (halaman sudah dihapus, kini hanya redirect). | Keduanya ditautkan ke /my-approvals, label tile "Pusat Persetujuan". | Diperbaiki |
| HR-HOME-06 | page | layout | P2 | Halaman melebar 1291px sehingga muncul scroll horizontal 11px. Penyebabnya KpiCard (pola yang sama terlihat di semua halaman yang memakai KpiCard). | Di halaman ini KpiCard diganti CompactStatCard. Sumber masalah di KpiCard → shared_requests. | Diperbaiki |
| HR-HOME-04 | page | layout | P3 | Jarak tidak standar: space-y-6, kartu p-5/p-6, dan judul seksi h3 uppercase "Quick Actions". ActionTile lebih besar dari tile statistik. | space-y-3 lg:space-y-4, kartu p-4, judul seksi h2 text-base md:text-lg "Aksi Cepat". ActionTile dipadatkan (p-3, badge ikon 36px, satu target klik Link) agar seragam dengan CompactStatCard. | Diperbaiki |
| HR-HOME-05 | page | language | P3 | Copy campur bahasa: "unredeemed", "Hitung Service", "Cuti Karyawan". | Diganti "belum ditukar", "Hitung Service Charge", "Kelola Cuti". | Diperbaiki |
| HR-HOME-07 | page | button | P3 | ApprovalWidget: tombol "Lihat Semua" memakai override h-7 text-xs, judul "Pending Approval" berbahasa Inggris, dan default approvalCenterPath masih /approvals. | Diselesaikan di komponen bersama — components/shared/ApprovalWidget.jsx | Diperbaiki (komponen shared) |

## `/hr/compensation` — Compensation

- **File:** `frontend/src/portals/hr/CompensationHub.jsx`
- **State diperiksa:** halaman + 8 tab, 0 dialog
- **Temuan otomatis (crawler):** 19 → 9
- **Tab:** Service Charge, Incentive, Voucher, FOC, Advances, LB Fund, tab7, tab8
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| COMP-01 | page | title | P2 | Hub tidak punya <h1>. Yang ada h2 "Compensation & Benefits" di dalam glass-card besar, dan tidak sama dengan nama nav "Compensation". | PageHeader "Compensation" dengan ikon dan subtitle dari deskripsi tab aktif. InlineHelp dipindah ke actions. | Diperbaiki |
| COMP-02 | page | tabs | P2 | Tab kustom (raw button + underline framer-motion, tinggi baris 57px) tidak memakai Tabs standar. | Diganti Tabs/TabsList/TabsTrigger/TabsContent tanpa override. testid comp-tabs, comp-tab-*, comp-content-* tetap. | Diperbaiki |
| COMP-03 | page | title | P2 | Halaman yang ditanam sebagai tab tidak punya judul, padahal versi standalone-nya juga butuh judul. Harus dicegah judul ganda di dalam hub. | Semua list (Payroll, Service Charge, Incentive, Voucher, FOC, Advances, LB Fund) kini menerima prop `embedded`. Hub mengoper embedded sehingga tidak muncul PageHeader kedua. Aksi utama pindah ke baris toolbar. | Diperbaiki |
| COMP-04 | tab:LB Fund | language | P2 | Deskripsi tab LB Fund salah: "Lebaran & bonus fund ledger". LB = Loss & Breakage. | Diganti "Buku besar dana Loss & Breakage". Semua deskripsi tab sekarang berbahasa Indonesia. | Diperbaiki |
| COMP-06 | tab:Incentive | tabs | P2 | Label tab aktif tidak terbaca saat di-hover: hover:text-foreground menimpa warna teks pill-active (teks gelap di atas pill gelap). Terlihat di screenshot Salary Master, Schemes, dan Pending Persetujuan. | Diselesaikan di komponen bersama — components/ui/tabs.jsx | Diperbaiki (komponen shared) |
| COMP-05 | tab:Payroll | tabs | P3 | Tab Payroll (Siklus Payroll/Salary Master) dan Incentive (Runs/Schemes) memunculkan baris tab kedua di bawah tab hub. | tidak diperbaiki: keduanya sub-view sungguhan. Baris tab kedua digabung dengan tombol aksi dalam satu toolbar agar ringkas. | Terbuka |
| COMP-07 | page | typography | P3 | Font non-Inter (ui-monospace) pada Doc No/period lewat kelas font-mono. | Token font-mono → Inter tabular-nums (UX-G-34). | Diperbaiki |

## `/hr/advances` — Advances

- **File:** `frontend/src/portals/hr/AdvancesList.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 3 → 0
- **Dialog/pop-up:** Buat Kasbon Karyawan (7 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| ADV-02 | page | flow | P1 | Tombol "Approve" muncul di baris status draft, padahal backend approve_advance hanya menerima submitted/awaiting_approval. Klik selalu gagal dengan error "submit dulu". | Setujui/Tolak hanya tampil untuk submitted/awaiting_approval. Baris draft hanya menampilkan "Ajukan". | Diperbaiki |
| ADV-01 | page | title | P2 | Halaman standalone tanpa <h1>, langsung dibuka dengan filter. | PageHeader "Advances" dengan aksi "Buat Kasbon" (testid hr-adv-create tetap). Saat embedded, tombol tetap di toolbar. | Diperbaiki |
| ADV-03 | page | flow | P2 | Reject memakai window.prompt() native: tidak bergaya, tanpa label, tanpa tombol destructive. | Dialog "Tolak Kasbon" (testid hr-adv-reject-dialog/-reason/-confirm) dengan Textarea berlabel wajib, Batal outline, dan konfirmasi variant destructive. | Diperbaiki |
| ADV-04 | page | form | P2 | Filter status tidak punya opsi "Menunggu Approval"/"Ditolak" padahal status itu muncul di tabel. Select tanpa label. | Opsi awaiting_approval dan rejected ditambah, aria-label ditambah. | Diperbaiki |
| ADV-05 | page | density | P2 | Doc No dan Principal terpotong jadi 3 baris ("EA-/2610-/0011", "Rp/1.000.000"), baris tabel jadi tinggi. | whitespace-nowrap pada Doc No, Tanggal, Principal, dan Cicilan/Bln. | Diperbaiki |
| ADV-06 | page | button | P2 | Override rounded-full/mr-* di semua tombol. Label baris campur bahasa: Submit/Approve/Reject. | Override dihapus, ukuran lewat prop. Label jadi "Ajukan"/"Setujui"/"Tolak". Konfirmasi ajukan memakai confirmDialog berjudul. | Diperbaiki |
| ADV-07 | dialog:Kasbon Baru | form | P2 | 5 field tanpa label terhubung (Label tanpa htmlFor), Tenor wajib tanpa *, Batal berupa ghost, ringkasan cicilan memakai glass-card-hover. | htmlFor/id di semua field, tanda * pada Tenor, Batal outline, ringkasan jadi kotak bordered. Judul jadi "Buat Kasbon Karyawan". Jadwal cicilan memakai kotak bordered, bukan card-in-card. | Diperbaiki |

## `/hr/service-charge` — Service Charge

- **File:** `frontend/src/portals/hr/ServiceChargeList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| SC-01 | page | title | P2 | Judul hanya h2 "Service Charge Distribution", tidak ada <h1>. | PageHeader "Service Charge" dengan aksi "Hitung Service Charge" (embedded: tombol di toolbar). | Diperbaiki |
| SC-02 | page | form | P2 | Filter input type=month tanpa label (placeholder tidak tampil, hanya terlihat "--------- ----"). Tombol "Clear" berbahasa Inggris. | Label "Periode" (htmlFor), tombol "Reset" (testid hr-sc-period-reset). InlineHelp dipindah ke toolbar. | Diperbaiki |
| SC-03 | dialog:Detail Service Charge | card | P2 | Komponen lokal SummaryTile (font-bold, ring) di dialog detail. | Diganti CompactStatCard size sm (tone success untuk Distributable). SummaryTile dihapus. | Diperbaiki |
| SC-04 | page | language | P2 | WorkflowButton (dipakai Service Charge dan Incentive) berlabel "Approve"/"Post" dengan rounded-full. Footer dialog "Post ke Journal". | Label "Setujui"/"Posting" dan "Posting ke Jurnal", override rounded-full dihapus. | Diperbaiki |
| SC-05 | dialog:Hitung Service Charge | form | P3 | Label tanpa htmlFor, "Notes" berbahasa Inggris, Batal ghost. Di dialog detail, footer ikut ter-scroll. | htmlFor/id, "Catatan", Batal outline. Dialog detail: body scroll, footer selalu terlihat. | Diperbaiki |
| SC-06 | page | ia | P3 | Empty state tanpa aksi. | Tombol "Hitung Service Charge" ditambah di EmptyState. | Diperbaiki |

## `/hr/incentive` — Incentive

- **File:** `frontend/src/portals/hr/IncentiveList.jsx`
- **State diperiksa:** halaman + 1 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 2
- **Tab:** Schemes
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INC-01 | page | title | P2 | Halaman standalone tanpa <h1>. | PageHeader "Incentive" dengan aksi kontekstual per sub-tab. Saat embedded, aksi berada di baris tab. | Diperbaiki |
| INC-03 | dialog:Detail Incentive Run | card | P2 | Tile lokal (glass-card-hover/ring, font-bold) untuk Base Sales/Total. | CompactStatCard size sm. Dialog: body scroll, footer tetap. | Diperbaiki |
| INC-04 | dialog:Incentive Scheme Baru | form | P2 | Label tanpa htmlFor. Field Target/Flat tanpa testid. Seluruh dialog ter-scroll sehingga footer tidak terlihat. | htmlFor/id di semua field, testid baru hr-inc-scheme-scope/-outlet/-target/-flat, picker karyawan role=group, body scroll + footer tetap, Batal outline. | Diperbaiki |
| INC-05 | tab:Schemes | tabs | P2 | Label tab aktif tidak terbaca saat di-hover (bug pill-active + hover di Tabs). | Diselesaikan di komponen bersama — components/ui/tabs.jsx | Diperbaiki (komponen shared) |
| INC-02 | page | language | P3 | Tombol "New Scheme"/"Run Calculation", detail "Approve"/"Post ke Journal", empty state memakai kode rule mentah. | "Tambah Scheme", "Hitung Insentif", "Setujui", "Posting ke Jurnal". Empty state Schemes diberi aksi. | Diperbaiki |
| INC-06 | page | tabs | P3 | Override mt-4 di TabsContent. | Override dihapus. | Diperbaiki |

## `/hr/voucher` — Voucher

- **File:** `frontend/src/portals/hr/VoucherList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| VOU-01 | page | title | P2 | Halaman standalone tanpa <h1>. | PageHeader "Voucher" dengan aksi "Terbitkan Voucher" (testid hr-voucher-issue-btn tetap). | Diperbaiki |
| VOU-02 | page | form | P2 | Input cari dan select status tanpa label. Pencarian memanggil API di setiap ketikan. | aria-label, input type=search, debounce 300ms. | Diperbaiki |
| VOU-04 | dialog:Terbitkan Voucher | form | P2 | Label dialog Terbitkan/Tukarkan tanpa htmlFor, Batal ghost, tombol baris primary dengan rounded-full. | htmlFor/id dan testid untuk outlet/expire/notes, Batal outline, tombol baris outline size sm. Empty state diberi aksi. | Diperbaiki |
| VOU-03 | page | language | P3 | "Issue Voucher", "Redeem", "Issuing…" dan label Inggris (Quantity, Value, Purpose, Expire Date, Reference, Notes) bercampur dengan "Batal". | "Terbitkan", "Tukarkan", "Jumlah", "Nilai", "Tujuan", "Tanggal Kedaluwarsa", "Referensi", "Catatan". Toast juga diganti. | Diperbaiki |

## `/hr/foc` — FOC

- **File:** `frontend/src/portals/hr/FOCList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FOC-01 | page | title | P2 | Halaman standalone tanpa <h1>. | PageHeader "FOC" dengan aksi "Catat FOC". | Diperbaiki |
| FOC-02 | form | form | P2 | Filter tipe/outlet tanpa label. Label dialog tanpa htmlFor dan berbahasa Inggris (Type, Amount, Beneficiary, Notes). Batal ghost. | aria-label di filter. htmlFor/id dan label "Tipe", "Nominal", "Penerima", "Catatan". Tanggal/Tipe ditandai wajib. Batal outline. | Diperbaiki |
| FOC-03 | page | ia | P3 | Empty state tanpa aksi. | Tombol "Catat FOC" ditambah di EmptyState. | Diperbaiki |

## `/hr/lb-fund` — LB Fund

- **File:** `frontend/src/portals/hr/LBFundLedger.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LBF-01 | page | title | P2 | Halaman standalone tanpa <h1>. | PageHeader "LB Fund" dengan subtitle Loss & Breakage. | Diperbaiki |
| LBF-02 | page | card | P2 | KpiCard dipakai tanpa delta/tren. Label "Total IN/OUT" menyiratkan nominal, padahal nilainya jumlah transaksi. | CompactStatCard (dengan loading). Label "Saldo Berjalan", "Mutasi Masuk", "Mutasi Keluar" dengan sub "transaksi". Wrapper testid tetap. | Diperbaiki |
| LBF-03 | page | layout | P2 | Halaman melebar 1291px (scroll horizontal) karena KpiCard. | Hilang setelah diganti CompactStatCard. | Diperbaiki |
| LBF-04 | page | language | P3 | Header kolom dan penanda arah IN/OUT berbahasa Inggris. | "Tanggal", "Sumber", "Keterangan", "Masuk/Keluar", "Jumlah", "Saldo". Nominal diberi nowrap. | Diperbaiki |

## `/hr/payroll` — Payroll

- **File:** `frontend/src/portals/hr/PayrollListPkg/index.jsx`, `frontend/src/portals/hr/PayrollListPkg/PayrollDetailDialog.jsx`, `frontend/src/portals/hr/PayrollListPkg/PayrollFormDialog.jsx`, `frontend/src/portals/hr/PayrollListPkg/SalaryDialogs.jsx`
- **State diperiksa:** halaman + 1 tab, 0 dialog
- **Temuan otomatis (crawler):** 6 → 2
- **Tab:** Salary Master
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PAY-01 | page | title | P2 | Halaman standalone tanpa <h1>. | PageHeader "Payroll" dengan aksi per sub-tab (Ekspor Excel + Generate Payroll / Impor). Saat embedded, aksi di baris sub-tab. | Diperbaiki |
| PAY-02 | tab:Salary Master | a11y | P2 | 25 tombol ikon edit tanpa aria-label. Ikon status BPJS tanpa teks. | Tombol size icon-sm dengan aria-label "Ubah salary master {nama}" dan title. Ikon BPJS diberi aria-label. | Diperbaiki |
| PAY-03 | page | button | P2 | "Export Excel"/"Import Excel/CSV" campur bahasa dengan override rounded-full/gap-2/mr-2. Aksi baris "Approve"/"Post". | "Ekspor Excel", "Impor Excel/CSV", "Setujui", "Posting". Override dihapus. Sub-tab diberi testid hr-payroll-tab-cycles/-salary. Empty state diberi aksi Generate. | Diperbaiki |
| PAY-04 | tab:Salary Master | tabs | P2 | Label tab aktif tidak terbaca saat di-hover (pill-active tertimpa hover:text-foreground). | Diselesaikan di komponen bersama — components/ui/tabs.jsx | Diperbaiki (komponen shared) |
| PAY-05 | dialog:Detail Payroll | card | P2 | Tile lokal (SalaryDialogs Tile), toggle BPJS berupa raw <button>, tombol payslip h-6 w-6, label alasan tanpa htmlFor. Footer ikut ter-scroll di max-h-85vh. Approve/Post tetap tampil saat form pembatalan terbuka. | CompactStatCard (tone warning/danger/success) dan Tile dihapus. Toggle jadi Button ghost dengan aria-expanded. Tombol payslip icon-sm dengan aria-label Bahasa. Body scroll + footer tetap. Label htmlFor. Saat batal: tombol "Batal" menutup form dan Setujui/Posting disembunyikan. Label "Setujui"/"Posting Payroll"/"Batalkan Payroll". | Diperbaiki |
| PAY-06 | dialog:Salary Master | form | P2 | Input tunjangan memakai override h-8 text-sm, label tanpa htmlFor dan berwarna muted, teks "✓ Format NPWP valid", Batal ghost, Switch BPJS tanpa label terhubung. | Input h-9 standar, fieldset/legend "Tunjangan Tetap", htmlFor/id di semua field, PTKP ditandai *, ikon CheckCircle2, Switch dihubungkan ke Label. Body scroll + footer tetap, Batal outline. | Diperbaiki |
| PAY-07 | dialog:Generate Payroll Cycle | language | P3 | Label tanpa htmlFor. Teks "Generating…", "Download Template CSV", "Import". Batal ghost. | htmlFor/id, "Memproses…", "Unduh Template CSV", "Impor", Batal/Tutup outline. | Diperbaiki |
| PAY-08 | page | runtime | P3 | Tiga file dialog meng-import puluhan simbol tak terpakai (jsPDF, Tabs, Switch, useAuth, dll.) beserta fungsi mati. | Import dibersihkan sesuai pemakaian, fungsi mati dihapus. | Diperbaiki |
| PAY-09 | page | density | P3 | Nominal Rupiah dan Doc No bisa terpotong ke baris baru. | whitespace-nowrap pada kolom angka dan Doc No. | Diperbaiki |

## `/hr/leaves` — Leave Requests

- **File:** `frontend/src/portals/hr/LeaveRequests.jsx`
- **State diperiksa:** halaman + 1 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 2
- **Tab:** Menunggu persetujuan 21
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LV-01 | page | title | P2 | Judul berupa h2 text-2xl "Leave Management" (bukan h1), tidak sama dengan nav "Leave Requests". | PageHeader "Leave Requests" dengan aksi InlineHelp + "Ajukan Cuti". | Diperbaiki |
| LV-02 | page | card | P2 | Kartu saldo cuti dibuat lokal (Card + text-xl font-bold). | CompactStatCard size sm ("used / quota hari", sub "Sisa"), testid leave-summary-{tipe}. Grid leave-summary tetap. | Diperbaiki |
| LV-03 | page | button | P2 | Tombol baris memakai override h-7 text-xs dan mr-1. | size sm tanpa override. Tolak memakai text-destructive. | Diperbaiki |
| LV-04 | page | a11y | P2 | Tombol ikon ChevronDown tanpa aria-label dan tanpa aksi (hanya title) untuk alasan penolakan. | Tombol mati dihapus. Alasan penolakan ditampilkan di bawah status (truncate + title). | Diperbaiki |
| LV-07 | dialog:Ajukan Cuti | form | P2 | Label dialog Ajukan Cuti dan Tolak Cuti tanpa htmlFor, tanpa DialogDescription. | htmlFor/id di semua field, deskripsi dialog, dialog max-w-md, testid leave-days-count dan leave-auto-submit. | Diperbaiki |
| LV-08 | tab:Pending Persetujuan | tabs | P2 | Label tab aktif tidak terbaca saat di-hover (bug Tabs shared). | Diselesaikan di komponen bersama — components/ui/tabs.jsx | Diperbaiki (komponen shared) |
| LV-05 | tab:Pending Persetujuan | language | P3 | "Pending Persetujuan" campur bahasa, label tab Title Case. Badge jumlah baru muncul setelah tab dibuka. | "Cuti saya" / "Menunggu persetujuan". Antrean di-prefetch diam-diam saat mount agar badge langsung tampil. | Diperbaiki |
| LV-06 | page | layout | P3 | space-y-6, empty state Card py-12 bespoke, spinner bespoke, tabel tanpa surface. | space-y-3 lg:space-y-4, EmptyState (dengan aksi) dan LoadingState, tabel dibungkus glass-card. TabsContent mt-4 dihapus. | Diperbaiki |

## `/hr/job-applications` — Job Applications

- **File:** `frontend/src/portals/hr/JobApplications.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| JA-01 | page | title | P2 | h1 bespoke "Lamaran Kerja", tidak sama dengan nav "Job Applications". Tombol Refresh size sm. | PageHeader "Job Applications" (subtitle jumlah lamaran) dengan aksi "Muat ulang" ukuran default. | Diperbaiki |
| JA-02 | page | a11y | P2 | Tombol cari ikon tanpa aria-label. Input cari dan dua select filter tanpa label. | aria-label di semua, tombol size icon (testid search-applications-submit), form role=search. | Diperbaiki |
| JA-03 | page | tabs | P3 | Chip filter status berupa raw button rounded-full dengan gaya sendiri. | Segmented pill (h-8, 13px, aktif = pill-active) dengan aria-pressed dan testid status-chip-*. Chip aktif tetap tampil. | Diperbaiki |
| JA-04 | page | form | P3 | Override h-9 text-sm di Input/SelectTrigger, kartu filter p-4. | Override dihapus, kartu filter p-3. | Diperbaiki |
| JA-05 | dialog:Detail lamaran | form | P3 | <Label> dipakai sebagai judul seksi, textarea catatan tanpa htmlFor, "Update Status" berbahasa Inggris. | Judul seksi jadi h3, "Ubah Status" dengan role=group dan aria-pressed, Label htmlFor untuk catatan. | Diperbaiki |
| JA-06 | page | language | P3 | "Refresh", "Semua Dept.", "Semua Status". | "Muat ulang", "Semua departemen", "Semua status". Tombol paginasi diberi testid. | Diperbaiki |

## `/hr/job-listings` — Job Listings

- **File:** `frontend/src/portals/hr/JobListings.jsx`
- **State diperiksa:** halaman + 0 tab, 2 dialog
- **Temuan otomatis (crawler):** 5 → 0
- **Dialog/pop-up:** Tambah Lowongan Baru (9 field); Ubah Lowongan (9 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| JL-01 | page | title | P2 | h1 bespoke "Kelola Lowongan Kerja", tidak sama dengan nav "Job Listings". | PageHeader "Job Listings" (subtitle jumlah lowongan aktif). | Diperbaiki |
| JL-02 | page | button | P2 | Aksi halaman memakai size sm, tombol primer di-override className pill-active, "Refresh" berbahasa Inggris. | Ukuran default, primary standar "Tambah Lowongan", outline "Lihat Lamaran", tombol ikon Muat ulang (aria-label, testid refresh-job-listings). | Diperbaiki |
| JL-03 | dialog:Tambah Lowongan | layout | P2 | Dialog Tambah/Edit terpotong: footer Batal/Simpan baru terlihat setelah scroll. | Header dan footer tetap, hanya body yang scroll. Deskripsi 3 baris dan resize-y. | Diperbaiki |
| JL-04 | dialog:Edit | form | P2 | Label tanpa htmlFor (2 field terdeteksi tanpa label), label muted text-xs dengan mt-1 manual. | htmlFor/id di semua field dengan gaya Label standar (space-y-1). Email lamaran diberi testid. | Diperbaiki |
| JL-05 | page | card | P3 | Kartu lowongan p-5, tombol h-8 text-xs, posisi tombol tidak sejajar antar kartu. | p-4, flex-col + mt-auto agar tombol sejajar, size sm tanpa override, judul kartu h3 text-sm md:text-base. | Diperbaiki |
| JL-06 | page | language | P3 | "Edit", "Update Lowongan", placeholder "e.g." bercampur dengan Bahasa. | "Ubah", "Ubah Lowongan", "Simpan Perubahan", "mis.". Empty state diberi aksi. | Diperbaiki |

## `/login` — Masuk

- **File:** `frontend/src/pages/Login.jsx`
- **State diperiksa:** halaman + —

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LOGIN-01 | page | typography | P1 | Inline fontFamily Cormorant Garamond/Azeret Mono, padahal index.html hanya memuat Inter. Akibatnya judul jatuh ke serif default dan label ke monospace. | Semua teks memakai Inter. Palet warna brand hangat (#1C1510/#F8F5EF) dipertahankan sebagai konstanta. | Diperbaiki |
| LOGIN-02 | form | a11y | P2 | Label Email/Password tidak terhubung ke input. Toggle password berupa ikon tanpa aria-label. Tidak ada autocomplete. | Label htmlFor/id dengan tanda *, toggle diberi aria-label + aria-pressed, autoComplete username/current-password, tombol demo diberi aria-label. | Diperbaiki |
| LOGIN-03 | form | button | P2 | Raw <input>/<button> h-10 dan chip demo raw button text-[11px]. | Komponen Input/Button/Label (h-9, size sm/icon-sm), warna brand lewat style. Submit menampilkan "Memproses…". Semua testid tetap. | Diperbaiki |
| LOGIN-04 | page | card | P3 | Kartu p-8 rounded-2xl, wrapper py-16 dan mb-8. | p-6 rounded-xl, py-10/mb-6. p-6 sengaja dipertahankan sebagai pengecualian kartu auth mandiri. | Diperbaiki |
| LOGIN-05 | page | language | P3 | "DEMO — password" dan tautan "FNBGROUP.ID" bergaya mono uppercase. | "Akun demo — password: Demo@2026", tautan "← fnbgroup.id" dengan Inter uppercase tracking. | Diperbaiki |

## `/no-access` — Akses Belum Tersedia

- **File:** `frontend/src/pages/NoAccess.jsx`
- **State diperiksa:** halaman + —

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| NA-02 | page | flow | P2 | Hanya satu raw <button> pill-active untuk logout. Tidak ada cara cek ulang akses setelah admin memberi izin, dan tidak jelas akun mana yang sedang login. | Button "Keluar & kembali ke Login" (primary) + "Muat ulang" (outline, ke /erp). Email akun ditampilkan. testid no-access-page/-logout/-reload ditambah. | Diperbaiki |
| NA-01 | page | title | P3 | h1 text-2xl font-bold, kartu p-10, ikon 64px rounded-2xl. | h1 text-xl md:text-2xl font-semibold, p-6, ikon 48px. | Diperbaiki |
| NA-03 | page | runtime | P3 | Import Sparkles dan Link tidak terpakai. | Import dihapus. | Diperbaiki |

## `404` — Halaman tidak ditemukan

- **File:** `frontend/src/pages/NotFound.jsx`
- **State diperiksa:** halaman + —

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| NF-02 | page | flow | P2 | "Kembali ke beranda" selalu menuju / (situs publik), termasuk untuk pengguna ERP yang sudah login. | Ke /erp bila sudah login, / bila belum. Ditambah tombol "Halaman sebelumnya" (navigate(-1)). | Diperbaiki |
| NF-01 | page | title | P3 | "404" sebagai h1 text-5xl font-bold, kartu p-10. | Angka 404 jadi label kecil, h1 "Halaman tidak ditemukan" semibold, kartu p-6, ikon SearchX 48px. | Diperbaiki |
| NF-03 | page | button | P3 | Link bergaya pill-active manual, bukan Button. | Button asChild + Link. testid not-found-page/-home/-back ditambah. | Diperbaiki |

## Catatan reviewer

1) Commit e7b5d1f (part 1) ikut membawa CompensationHub.jsx dan HRHome.jsx versi pass ini. Hub mengoper prop `embedded` ke 7 list, dan dukungan prop itu ada di working tree yang belum di-commit (AdvancesList, ServiceChargeList, IncentiveList, VoucherList, FOCList, LBFundLedger, PayrollListPkg/*), jadi commit keduanya bersamaan. Tanpa itu `embedded` diabaikan dengan aman. 2) Pola baru: setiap list Compensation menerima `embedded` (default false). Route standalone menampilkan PageHeader sendiri; di hub hanya ada satu h1 "Compensation". 3) Perubahan perilaku yang disengaja: Advances tidak lagi menampilkan Setujui untuk draft (backend memang menolak); reject kasbon memakai dialog (testid hr-adv-reject-dialog/-reason/-confirm); Leave Requests mem-prefetch antrean persetujuan untuk badge; pencarian Voucher di-debounce 300ms; 404 mengarah ke /erp bila login. 4) Nama opener untuk crawl berubah: "Kasbon Baru" → "Buat Kasbon", "Edit" (lowongan) → "Ubah", "Run Calculation" → "Hitung Insentif", "New Scheme" → "Tambah Scheme", "Issue Voucher" → "Terbitkan Voucher", "Redeem" → "Tukarkan", tab "Pending Persetujuan" → "Menunggu persetujuan". 5) Dialog panjang (Detail Payroll, Salary Master, Detail SC/Incentive, Scheme, Lowongan) memakai pola DialogContent `flex flex-col gap-0 p-0 overflow-hidden`: header px-5 pt-5, body `flex-1 min-h-0 overflow-y-auto px-5`, footer `px-5 py-3 border-t`, sehingga footer selalu terlihat. 6) Gate route hub /hr/compensation tidak mencakup `hr.advance`: pengguna yang hanya punya izin kasbon tidak bisa membuka hub. Tidak diubah karena hub tidak memfilter tab per izin. 7) Semua testid lama dipertahankan (dicek terhadap HEAD dan HEAD~1), sudah ditambah beberapa testid baru, audit_tours = 0 missing, dan jsxcheck OK untuk semua file yang diedit. Tidak ada file baru.
