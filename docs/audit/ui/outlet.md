# Audit UI/UX — Outlet

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/outlet` — Overview

- **File:** `frontend/src/portals/outlet/OutletHome.jsx`, `frontend/src/portals/outlet/OutletBudgetMiniWidget.jsx`, `frontend/src/portals/outlet/OutletScopeHeader.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-HOME-01 | page | title | P2 | Halaman tanpa <h1>. Judulnya berupa banner sambutan besar (glass-card p-6/p-8, h2 text-xl font-bold) yang memakan banyak ruang | Diganti PageHeader 'Overview' (ikon LayoutDashboard). Sapaan, tanggal & scope outlet dipindah ke subtitle, badge 'Data digabung'/'Live' ke actions (testid outlet-welcome tetap) | Diperbaiki |
| OUT-HOME-03 | page | ia | P2 | Quick action 'Daily Close' mengarah ke rute deprecated /outlet/daily-close. KDO/BDO lewat redirect /outlet/kdo\|bdo | Tile jadi 'End of Day' → /outlet/end-of-day (testid qa-dc tetap). KDO/BDO langsung ke /outlet/daily-orders?type=kdo\|bdo | Diperbaiki |
| OUT-HOME-05 | page | a11y | P2 | Widget Budget berupa Card dengan onClick (div, tidak bisa difokus keyboard). Label bucket memakai font-mono | Dibungkus <Link to=/outlet/budget> sebagai satu target klik dengan fokus terlihat. font-mono dihapus, judul 'Outlet Budget · Bulan Ini' | Diperbaiki |
| OUT-HOME-07 | page | runtime | P2 | Progress bar budget dengan nilai 0% tergambar sebagai garis hitam yang keluar dari kartu hingga ke sidebar | Diselesaikan di komponen bersama — components/ui/progress.jsx | Diperbaiki (komponen shared) |
| OUT-HOME-02 | page | card | P3 | KPI strip memakai KpiCard tanpa delta/tren | Diganti CompactStatCard (sesuai rubric: tanpa delta → CompactStatCard). Testid kpi-sales-hari-ini dst. dipertahankan lewat testId | Diperbaiki |
| OUT-HOME-04 | page | typography | P3 | Judul seksi berupa h3 uppercase kecil. Kartu tugas memakai h4 dan p-5. Tile saldo memakai glass-input bersarang dan font-bold. Ikon h-4.5 (kelas tidak ada) | Seksi jadi h2 'Aksi Cepat' / 'Saldo Petty Cash per Outlet'. Kartu tugas p-4 + h3, tile saldo dengan border ringan dan font-semibold, ikon h-4, spacing space-y-3 lg:space-y-4 | Diperbaiki |
| OUT-HOME-06 | page | layout | P3 | Bar 'Outlet Aktif' (OutletScopeHeader) memakai mb-4 dan picker-nya tanpa aria-label | mb-3, radius token, aria-label 'Pilih outlet aktif'. Posisi bar konteks di atas PageHeader dipertahankan | Diperbaiki |

## `/outlet/crm` — CRM & Reservations

- **File:** `frontend/src/portals/outlet/CRMHub/index.jsx`
- **State diperiksa:** halaman + 3 tab, 0 dialog
- **Temuan otomatis (crawler):** 17 → 8
- **Tab:** Menunggu, Dikonfirmasi, Selesai

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-CRM-04 | tab:Selesai | runtime | P1 | Empty state menampilkan 'Tidak ada reservasi dengan status "done"' (key internal bocor ke UI) | Peta label RES_TAB_LABEL. Empty state memakai EmptyState ringkas dengan label yang benar | Diperbaiki |
| OUT-CRM-06 | page | runtime | P1 | 'Member Terbaru' selalu kosong padahal Total Member 252. Respons /admin/loyalty/customers berbentuk {items,total} tanpa envelope | Parsing fallback membersRes.data?.data ?? membersRes.data, lalu ambil .items | Diperbaiki |
| OUT-CRM-01 | page | title | P2 | Halaman tanpa <h1>. Header bespoke h2 'CRM & Reservasi Hub' font-bold tidak sesuai nama nav | PageHeader 'CRM & Reservations' + subtitle tanggal. Actions: 'Muat ulang' (outline) + 'Buat Reservasi' (primary) | Diperbaiki |
| OUT-CRM-02 | page | card | P2 | 5 KPI memakai komponen lokal KpiCard (p-5, text-3xl font-bold) | Diganti CompactStatCard (testid kpi-reservasi-* tetap) dan KpiCard lokal dihapus | Diperbaiki |
| OUT-CRM-03 | page | layout | P2 | Quick Actions 6 kolom di lebar 1280px membuat label patah per kata | Grid 2/3 kolom, tile p-3, seksi h2 'Aksi Cepat' dengan data-testid crm-quick-actions (target tour yang sebelumnya tidak ada) | Diperbaiki |
| OUT-CRM-05 | tab:Konfirmasi | tabs | P2 | Tabs memakai override h-7/h-6/text-xs. Label 'Konfirmasi' berbeda dengan status 'Dikonfirmasi'. Teks tab aktif hilang saat di-hover | Override dihapus, label jadi 'Dikonfirmasi', testid crm-res-tab-*. Bug hover sudah diperbaiki global di tabs.jsx | Diperbaiki |
| OUT-CRM-07 | page | flow | P2 | Tombol 'Lihat Detail' hanya membuka daftar karena state.openId diabaikan. Tombol ikon (→, mata, grafik) tanpa aria-label | ReservationList kini membuka dialog detail dari state.openId. Semua tombol ikon diberi aria-label dan size icon-sm | Diperbaiki |
| OUT-CRM-09 | dialog:Batalkan Reservasi | form | P2 | Dialog alasan ad-hoc dengan textarea mentah tanpa label | Diganti promptDialog global (label 'Alasan pembatalan', opsional, destruktif, 'Kembali'/'Batalkan Reservasi') | Diperbaiki |
| OUT-CRM-10 | page | runtime | P2 | Reservasi Hari Ini selalu 0 karena seed memakai field date/guest_name | Diperbaiki terpusat: seed + migrasi field reservasi (UX-G-43). | Diperbaiki |
| OUT-CRM-08 | page | language | P3 | Emoji medali di distribusi tier dan chip member, simbol ⚑, tombol baris h-7 text-xs | Diganti titik warna tier dan ikon Flag. Tombol size sm, panel p-4, judul h3 seragam | Diperbaiki |

## `/outlet/daily-sales` — Daily Sales

- **File:** `frontend/src/portals/outlet/DailySalesList.jsx`
- **State diperiksa:** halaman + 4 tab, 0 dialog
- **Temuan otomatis (crawler):** 16 → 0
- **Tab:** Draft, Submitted, Validated, Rejected

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-DS-03 | page | flow | P1 | Klik baris memakai window.location.assign sehingga seluruh aplikasi reload | Diganti navigate() react-router | Diperbaiki |
| OUT-DS-01 | page | title | P2 | Halaman dimulai dari kartu filter tanpa judul | PageHeader 'Daily Sales' + aksi 'Daily Sales Baru' (testid ds-new). Prop embedded menyembunyikan header saat dipakai di End of Day | Diperbaiki |
| OUT-DS-02 | tab:Draft | tabs | P2 | Filter status berupa tombol rounded-full bespoke | Tabs standar (testid ds-tab-* tetap) | Diperbaiki |
| OUT-DS-04 | page | button | P2 | Tombol pill h-10, 'Semua Tanggal' dan Prev/Next memakai tombol mentah, input h-10, label 11px uppercase | Button standar, 'Sebelumnya'/'Berikutnya', input h-9, label text-xs/sm, toolbar p-3 | Diperbaiki |

## `/outlet/daily-sales/new` — Daily Sales Baru

- **File:** `frontend/src/portals/outlet/DailySalesFormPkg/index.jsx`, `frontend/src/portals/outlet/DailySalesFormSteps.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-DSF-02 | form | runtime | P1 | Master Brand & metode pembayaran tidak pernah dimuat. Dropdown Brand kosong dan langkah 4 Payment tidak bisa dilewati | Memuat /master/brands & /master/payment-methods lewat fetchAll saat mount | Diperbaiki |
| OUT-DSF-01 | page | title | P2 | Halaman tanpa <h1> (memakai h2 font-bold). Tombol 'Kembali' bulat | Tombol ghost '← Kembali ke Daily Sales' + PageHeader. Status & autosave di children, Simpan Draft/Submit di actions | Diperbaiki |
| OUT-DSF-03 | form | layout | P2 | Input Gross/Discount pada tabel Channel tidak sejajar dengan header numerik | Input diberi ml-auto, header jadi 'Diskon' | Diperbaiki |
| OUT-DSF-04 | form | form | P2 | 14 input tanpa label terhubung, SimpleSelect h-10 | Label htmlFor/id atau aria-label di semua input, ariaLabel di SimpleSelect, tinggi default | Diperbaiki |
| OUT-DSF-05 | form | typography | P2 | Input voucher font-mono, border-amber/30 tidak valid, tombol 'Validate', tombol hapus voucher tanpa label | font-mono dihapus, border-amber-500/30, tombol 'Validasi', aria-label 'Hapus voucher' | Diperbaiki |
| OUT-DSF-06 | form | button | P3 | Navigasi langkah memakai pill rounded dan teks 'Step x / 5'. Hapus pembayaran memakai <button> mentah | Button standar, 'Langkah x / 5', Button ikon + aria-label (testid ds-pay-remove-*) | Diperbaiki |
| OUT-DSF-07 | form | form | P3 | SimpleSelect tidak meneruskan id sehingga <Label htmlFor> tidak bisa terhubung | Diselesaikan di komponen bersama — SimpleSelect terima prop id (sementara pakai ariaLabel) | Diperbaiki (komponen shared) |

## `/outlet/daily-sales/:id` — Daily Sales <tanggal>

- **File:** `frontend/src/portals/outlet/DailySalesDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-DSD-01 | page | title | P2 | Halaman tanpa <h1>. Tombol Kembali memakai navigate(-1) dan bentuk bulat | Tombol ghost '← Kembali ke Daily Sales' (testid ds-back) + PageHeader dengan StatusPill di children | Diperbaiki |
| OUT-DSD-02 | page | runtime | P2 | Payment Breakdown menampilkan UUID metode pembayaran | Nama metode diambil dari /master/payment-methods | Diperbaiki |
| OUT-DSD-04 | dialog:Tolak Daily Sales | form | P2 | Dialog alasan ad-hoc, textarea tanpa label, konfirmasi memakai tombol primary | Diganti promptDialog global (label 'Alasan penolakan' wajib, destruktif, 'Tolak') | Diperbaiki |
| OUT-DSD-03 | page | language | P3 | Tombol Edit/Reject/Validate, 'Rejected:', Journal ID dengan font mono, 'Trx Count'/'Tax' | Ubah/Tolak/Validasi, 'Ditolak:', 'Jurnal dibuat · ID', 'Jumlah Transaksi'/'Pajak', toast Bahasa, kartu p-4 | Diperbaiki |

## `/outlet/daily-sales/:id/edit` — Edit Daily Sales

- **File:** `frontend/src/portals/outlet/DailySalesFormPkg/index.jsx`, `frontend/src/portals/outlet/DailySalesFormSteps.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-DSE-01 | page | title | P2 | Masalah sama dengan form baru: tanpa <h1>, tombol ikon tanpa label, 14 input tanpa label | Perbaikan sama dengan /new. Tombol kembali di mode edit → '← Kembali ke detail' | Diperbaiki |
| OUT-DSE-02 | form | runtime | P2 | Pilihan Brand kosong | Brand kini dimuat dari master (lihat OUT-DSF-02) | Diperbaiki |

## `/outlet/petty-cash` — Petty Cash

- **File:** `frontend/src/portals/outlet/PettyCashList.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 3 → 0
- **Dialog/pop-up:** Pilih Outlet (0 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-PC-01 | page | title | P2 | Halaman tanpa judul. Saldo ditampilkan di kotak yang mirip input | PageHeader 'Petty Cash' + 'Transaksi Baru' (testid pc-new). Prop embedded untuk End of Day | Diperbaiki |
| OUT-PC-02 | page | card | P2 | Tile saldo per outlet bespoke di dalam kartu | Strip CompactStatCard: total (warning bila rendah) + per outlet. Testid pc-balance tetap | Diperbaiki |
| OUT-PC-04 | dialog:Transaksi Baru | flow | P2 | Dialog Pilih Outlet tanpa tombol Batal | Footer 'Batal' ditambahkan | Diperbaiki |
| OUT-PC-05 | dialog:Transaksi Petty Cash | form | P2 | Label uppercase tidak terhubung, label berbahasa Inggris, tombol tipe tanpa role | Label htmlFor, 'Nominal *'/'Catatan'/'Akun GL *', radiogroup + aria-checked | Diperbaiki |
| OUT-PC-03 | page | button | P3 | Tombol 'Menunggu · Approve' h-7, status 'Posted' teks polos, kolom 'Amount', Prev/Next mentah | Tombol 'Setujui' sm outline, StatusPill, kolom 'Nominal', pagination Button | Diperbaiki |

## `/outlet/daily-orders` — Daily Orders

- **File:** `frontend/src/portals/outlet/DailyOrdersHub.jsx`, `frontend/src/portals/outlet/KdoBdoList.jsx`, `frontend/src/portals/outlet/FdoPage.jsx`
- **State diperiksa:** halaman + 2 tab, 1 dialog
- **Temuan otomatis (crawler):** 11 → 0
- **Tab:** Bar, Floor
- **Dialog/pop-up:** KDO Baru (7 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-DO-02 | tab:Floor | title | P1 | Tab Floor merender <h1> kedua (text-2xl font-bold, p-6, warna gray/indigo hard-code) | FdoPage memakai toolbar h2 yang sama dengan KDO/BDO, Button standar, StatusPill, EmptyState, warna token | Diperbaiki |
| OUT-DO-03 | tab:Bar | runtime | P1 | Pindah Kitchen↔Bar tidak memuat ulang data (effect tidak bergantung pada kind) | KdoBdoList diberi key={kind} (di hub dan di End of Day) | Diperbaiki |
| OUT-DO-05 | dialog:KDO Baru | runtime | P1 | 'Simpan Draft' tetap mengirim status submitted karena memakai closure lama | submit menerima status sebagai argumen | Diperbaiki |
| OUT-DO-01 | page | title | P2 | Halaman tanpa <h1>. Judul h2 ada di dalam kartu dengan tab underline bespoke | PageHeader 'Daily Orders' + Tabs standar (testid daily-orders-tabs dan tab-* tetap) | Diperbaiki |
| OUT-DO-04 | tab:Kitchen | card | P2 | Banner gradien besar + kartu filter status full-width yang terpisah | Satu toolbar ringkas: h2 + deskripsi + select status (aria-label) + tombol 'KDO/BDO Baru' | Diperbaiki |
| OUT-DO-06 | dialog:KDO Baru | form | P2 | 3 field tanpa label, input h-10 | Label htmlFor / aria-label, tinggi default | Diperbaiki |
| OUT-DO-07 | tab:Floor | flow | P2 | 'Buat FDO' disabled tanpa penjelasan. Submit tanpa toast. 3 tombol ikon tanpa label | Tombol diaktifkan (outlet dipilih di form) + hint, toast sukses, aria-label | Diperbaiki |
| OUT-DO-08 | tab:Floor | ia | P3 | FDO tidak punya filter status seperti KDO/BDO | tidak diperbaiki: dukungan parameter status di /outlet/fdo perlu dicek | Terbuka |

## `/outlet/urgent-purchase` — Urgent Purchase

- **File:** `frontend/src/portals/outlet/UrgentPurchaseList.jsx`
- **State diperiksa:** halaman + 3 tab, 1 dialog
- **Temuan otomatis (crawler):** 15 → 2
- **Tab:** Menunggu Approval, Approved, Rejected
- **Dialog/pop-up:** Urgent Purchase Baru (11 field)
- **Sisa sinyal otomatis (heuristik):** 1 field tanpa label; Isi dialog terpotong/scroll vertikal

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-UP-01 | page | title | P2 | Halaman tanpa <h1>. Kartu hanya berisi kalimat info dan tombol pill | PageHeader 'Urgent Purchase' + 'Urgent Purchase Baru' (testid up-new) | Diperbaiki |
| OUT-UP-02 | tab:Menunggu Approval | tabs | P2 | Filter status berupa tombol bespoke | Tabs standar (testid up-tab-* tetap) | Diperbaiki |
| OUT-UP-04 | dialog:Urgent Purchase Baru | form | P2 | 5 field tanpa label, label berbahasa Inggris, tombol hapus baris tanpa label | Label/aria-label, label Bahasa, Button ikon + aria-label, 'Submit dengan alasan' | Diperbaiki |
| OUT-UP-03 | page | button | P3 | Tombol Approve per baris pill h-8. Doc No memakai font-mono | Tombol 'Setujui' sm outline. Kolom 'No. Dokumen' memakai font-medium tabular-nums | Diperbaiki |
| OUT-UP-05 | dialog:Urgent Purchase Baru | form | P3 | Autocomplete Item/Vendor tidak menerima id sehingga tidak bisa dihubungkan ke label | Diselesaikan di komponen bersama — ItemAutocomplete/VendorAutocomplete terima id/ariaLabel | Diperbaiki (komponen shared) |

## `/outlet/daily-close` — Daily Close

- **File:** `frontend/src/portals/outlet/DailyClose.jsx`, `frontend/src/portals/outlet/OutletPortal.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-DC-01 | page | ia | P1 | Duplikat: /outlet/daily-close merender komponen DailyClose yang sama persis dengan Langkah 4 'Daily Close' di End of Day | Rute dipertahankan. Banner deprecated + tombol 'Buka End of Day' (/outlet/end-of-day?step=3) ditambahkan, quick action Overview dialihkan ke End of Day, komentar di OutletPortal | Diperbaiki |
| OUT-DC-02 | page | title | P2 | Halaman tanpa <h1>. Outlet aktif ditampilkan seperti input palsu | PageHeader 'Daily Close' (hanya saat berdiri sendiri, prop embedded). Outlet tampil sebagai teks read-only | Diperbaiki |
| OUT-DC-03 | page | flow | P2 | Mode agregat: checklist tidak muncul tanpa penjelasan | Hint 'Pilih satu outlet di header…', tombol Muat ulang disabled tanpa outlet | Diperbaiki |
| OUT-DC-04 | page | button | P3 | Tombol Refresh mentah 16px, link ke /outlet/kdo\|bdo, judul seksi uppercase | Button 'Muat ulang', link ke /outlet/daily-orders?type=…, judul h3 | Diperbaiki |

## `/outlet/end-of-day` — End of Day

- **File:** `frontend/src/portals/outlet/EndOfDayWorkflow.jsx`
- **State diperiksa:** halaman + 4 tab, 0 dialog
- **Temuan otomatis (crawler):** 22 → 5
- **Tab:** Draft, Submitted, Validated, Rejected
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16, 95px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-EOD-02 | page | title | P1 | Komponen langkah yang di-embed membawa judul sendiri (FDO memakai <h1>) | Prop embedded di DailySalesList/PettyCashList/DailyClose. FDO kini h2 | Diperbaiki |
| OUT-EOD-01 | page | title | P2 | h1 bespoke 'Tutup Hari (End-of-Day)' font-bold dengan ikon 48px | PageHeader 'End of Day' (testId eod-title), InlineHelp & badge di actions, progress jadi kartu p-3 | Diperbaiki |
| OUT-EOD-03 | tab:Draft | tabs | P2 | Sub-tab Kitchen/Bar/Floor dan tab status bespoke | Tabs standar (testid eod-orders-* tetap) + key={tab} | Diperbaiki |
| OUT-EOD-04 | page | button | P2 | Tombol pill, '← Sebelumnya' memakai karakter panah, 'Kembali ke Dashboard' berupa Link bergaya manual | Button standar, ikon ArrowLeft, Button asChild 'Kembali ke Overview' (testid eod-finish) | Diperbaiki |
| OUT-EOD-05 | page | flow | P3 | Langkah 1 memuat daftar Daily Sales 14 hari (71 entri), padahal tujuannya sales hari ini | tidak diperbaiki: butuh keputusan produk (default filter hari ini di mode embedded) | Terbuka |

## `/outlet/inventory/stock-check` — Stock Check

- **File:** `frontend/src/portals/outlet/inventory/StockCheck.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-SC-03 | page | typography | P1 | Kolom angka memakai font-mono. Pencarian h-10 tanpa label | tabular-nums tanpa mono. Search max-w-md + aria-label | Diperbaiki |
| OUT-SC-02 | page | card | P2 | Tile KPI bespoke | CompactStatCard (testid stock-kpi-* tetap) | Diperbaiki |
| OUT-SC-01 | page | title | P3 | h1 bespoke font-bold di dalam kartu p-5/p-6 | PageHeader 'Stock Check' + 'Muat ulang' & 'Mulai Opname' | Diperbaiki |

## `/outlet/inventory/transfers` — Stock Transfers

- **File:** `frontend/src/portals/outlet/inventory/StockTransfers.jsx`
- **State diperiksa:** halaman + 3 tab, 1 dialog
- **Temuan otomatis (crawler):** 6 → 0
- **Tab:** Draft, Sent, Received
- **Dialog/pop-up:** Transfer Baru (4 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-ST-02 | page | card | P2 | Tile KPI bespoke, filter tombol bespoke, badge status lokal | CompactStatCard (testid transfers-kpi-*), Tabs standar (testid transfers-filter-*), StatusPill (label tab mengikuti kamus StatusPill) | Diperbaiki |
| OUT-ST-04 | dialog:Transfer Baru | form | P2 | 4 field tanpa label, tombol Tambah h-7, tombol hapus tanpa aria-label | Label htmlFor + id trigger, aria-label, Button sm outline, tanda wajib * | Diperbaiki |
| OUT-ST-01 | page | title | P3 | h1 bespoke font-bold di dalam kartu besar | PageHeader 'Stock Transfers' + 'Muat ulang'/'Transfer Baru' | Diperbaiki |
| OUT-ST-03 | page | ia | P3 | Rute transfer satu arah memakai ikon dua arah. No. transfer memakai font-mono | Ikon ArrowRight, no. transfer font-medium tabular-nums | Diperbaiki |
| OUT-ST-05 | dialog:Detail transfer | form | P3 | Aksi primer berada sebelum 'Tutup' | 'Tutup' (outline) dulu, lalu Kirim/Terima | Diperbaiki |

## `/outlet/inventory/usage` — Usage Log

- **File:** `frontend/src/portals/outlet/inventory/UsageLog.jsx`
- **State diperiksa:** halaman + 4 tab, 0 dialog
- **Temuan otomatis (crawler):** 6 → 0
- **Tab:** Terjual, Waste/Rusak, Transfer Keluar, Penyesuaian

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-UL-03 | page | typography | P1 | Qty/Nilai font-mono, search tanpa label | Mono dihapus, search diberi aria-label | Diperbaiki |
| OUT-UL-02 | page | runtime | P2 | Baris tipe 'Penyesuaian' tampil tetapi tidak ada filternya | Filter dibangun dari semua tipe yang ada di data, memakai Tabs standar | Diperbaiki |
| OUT-UL-01 | page | title | P3 | h1 bespoke dan tile KPI bespoke | PageHeader 'Usage Log' + CompactStatCard (testid usage-kpi-*) | Diperbaiki |
| OUT-UL-04 | page | density | P3 | Hingga 200 baris dalam satu tabel tanpa paginasi | tidak diperbaiki: butuh paginasi | Terbuka |

## `/outlet/voucher-redeem` — Voucher Redemption

- **File:** `frontend/src/portals/outlet/VoucherRedemptionPkg/index.jsx`, `frontend/src/portals/outlet/VoucherRedemptionPkg/LookupComponents.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-VR-01 | page | title | P2 | Halaman tanpa <h1>. Panel Log Hari Ini kosong setinggi halaman | PageHeader 'Voucher Redemption'. Layout grid main + 18rem, tinggi log mengikuti isi | Diperbaiki |
| OUT-VR-02 | page | form | P2 | Input kode dan input cari customer tanpa label, h-11, kode memakai font-mono | <label htmlFor>, tinggi standar, mono dihapus | Diperbaiki |
| OUT-VR-03 | page | a11y | P2 | Tombol '×' tanpa label, hasil pencarian & kartu voucher berupa div onClick, bg-white rusak di dark mode | Button ikon + aria-label, elemen jadi <button>, bg-popover/bg-card | Diperbaiki |
| OUT-VR-04 | page | button | P3 | Tombol h-13/h-14, tombol klaim hijau custom, Batal berada di bawah tombol utama | size lg standar. Batal (outline) + Konfirmasi Klaim (primary) berdampingan | Diperbaiki |

## `/outlet/loyalty/input-poin` — Loyalty Points Entry

- **File:** `frontend/src/portals/outlet/LoyaltyPointsEntry.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-LP-01 | page | title | P2 | Tampilan ala situs publik: kolom sempit terpusat max-w-lg py-8, h1 bespoke, kartu rounded-2xl p-6 | PageHeader 'Loyalty Points Entry', konten max-w-2xl, Card p-4 | Diperbaiki |
| OUT-LP-02 | form | button | P2 | Input/tombol mentah h-12 dengan inline style, warna hard-code #7FAE7A, angka text-5xl | Input/Button/Label standar, token emerald, text-3xl. Testid cashier-* tetap | Diperbaiki |
| OUT-LP-03 | form | runtime | P2 | Menekan Enter memicu pencarian dua kali | onKeyDown dihapus, cukup submit form | Diperbaiki |
| OUT-LP-04 | form | language | P3 | Emoji tier, label berupa <p>, tidak ada tombol Batal | Ikon Crown, Label htmlFor + *, tombol 'Batal' (testid cashier-cancel-button) | Diperbaiki |

## `/outlet/reservations` — Reservations

- **File:** `frontend/src/portals/outlet/ReservationListPkg/index.jsx`, `frontend/src/portals/outlet/ReservationListPkg/DepositPanel.jsx`, `frontend/src/portals/outlet/ReservationListPkg/RescheduleDialog.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 7 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-RL-07 | page | runtime | P1 | Kolom Tamu & Jadwal kosong di semua baris (seed memakai guest_name/date/time) | Diperbaiki terpusat: seed + migrasi startup legacy_seed_field_names (UX-G-43). | Diperbaiki |
| OUT-RL-02 | page | ia | P2 | Picker outlet kedua menduplikasi picker global | Dihapus (testid outlet-scope-select tidak dirujuk di mana pun) | Diperbaiki |
| OUT-RL-03 | page | card | P2 | Strip status bespoke | CompactStatCard sm (testid reservation-kpi-*) | Diperbaiki |
| OUT-RL-04 | page | form | P2 | 3 filter tanpa label, tidak ada reset, tombol refresh ikon tanpa label | aria-label, tombol 'Reset', tombol 'Muat ulang' berteks | Diperbaiki |
| OUT-RL-05 | dialog:Detail Reservasi | flow | P2 | Tidak ada jalan ke halaman edit atau tombol tutup. Tombol h-7 dengan warna custom | Footer Hapus \| Tutup + Ubah, menu baris 'Ubah', tombol sm, warna /10 untuk dark mode | Diperbaiki |
| OUT-RL-06 | dialog:Batalkan/Jadwal Ulang/DP | form | P2 | Dialog alasan batal ad-hoc, Label tanpa htmlFor, Batal ghost, tombol indigo/emerald custom | Batal reservasi memakai promptDialog global. Jadwal Ulang/DP: htmlFor/id, Batal outline, tombol primary standar | Diperbaiki |
| OUT-RL-01 | page | title | P3 | h1 bespoke 'Manajemen Reservasi' font-bold, wrapper p-6 | PageHeader 'Reservations' + 'Muat ulang'/'Buat Reservasi' | Diperbaiki |
| OUT-RL-08 | page | density | P3 | Angka per status dihitung dari halaman yang tampil, sedangkan Total dari seluruh hasil | tidak diperbaiki: butuh agregasi per status dari backend | Terbuka |
| OUT-RL-09 | page | language | P3 | Badge status reservasi masih komponen lokal (label Bahasa + ikon) | StatusPill sudah punya 'waitlist', tetapi halaman ini memakai label status Bahasa Indonesia yang sama dengan tab filternya; migrasi ke StatusPill (label Inggris) menunggu keputusan bahasa status reservasi. | Terbuka |

## `/outlet/reservations/new` — Buat Reservasi

- **File:** `frontend/src/portals/outlet/ReservationForm.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 7 → 2
- **Sisa sinyal otomatis (heuristik):** 4 input tanpa label terhubung

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-RF-02 | form | form | P2 | 13 input tanpa label terhubung | Label htmlFor + id di semua field, grid responsif | Diperbaiki |
| OUT-RF-03 | form | button | P2 | Tombol '-'/'+' mentah tanpa label, toggle tanpa aria-pressed, submit selebar penuh | Button ikon Minus/Plus + aria-label, aria-pressed, aksi rata kanan Batal + Buat Reservasi | Diperbaiki |
| OUT-RF-01 | page | title | P3 | h1 bespoke, tombol kembali berupa ikon tanpa label, wrapper p-6 | Tombol ghost '← Kembali ke Reservations' + PageHeader, form max-w-3xl | Diperbaiki |

## `/outlet/reservations/:id/edit` — Edit Reservasi

- **File:** `frontend/src/portals/outlet/ReservationForm.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 7 → 2
- **Sisa sinyal otomatis (heuristik):** 4 input tanpa label terhubung

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-RE-01 | form | form | P2 | Masalah sama dengan form baru | Perbaikan sama dengan /new | Diperbaiki |
| OUT-RE-02 | form | runtime | P2 | Nama, HP, tanggal & waktu kosong (field seed berbeda) | Diperbaiki terpusat: seed + migrasi field reservasi (UX-G-43). | Diperbaiki |

## `/outlet/budget` — Outlet Budget

- **File:** `frontend/src/portals/outlet/OutletBudgetTracker.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 10 → 0
- **Tab:** Mingguan, Bulanan

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OUT-BUD-03 | page | typography | P1 | Bucket & Doc No memakai font-mono, angka font-bold besar, format periode mentah | Doc No font-medium tabular-nums, angka semibold, periode 'DD MMM YYYY – DD MMM YYYY' | Diperbaiki |
| OUT-BUD-01 | page | title | P2 | Halaman tanpa <h1>. Judul 'Budget Saya' tidak sesuai nama nav | PageHeader 'Outlet Budget' + 'Muat ulang' | Diperbaiki |
| OUT-BUD-02 | tab:Mingguan | tabs | P2 | Teks tab aktif hilang saat di-hover | diperbaiki global di components/ui/tabs.jsx | Diperbaiki |
| OUT-BUD-05 | page | runtime | P2 | Progress bar 0% tergambar sebagai garis hitam di luar kartu | Diselesaikan di komponen bersama — components/ui/progress.jsx | Diperbaiki (komponen shared) |
| OUT-BUD-04 | page | language | P3 | 'Request Penambahan', kolom Source/Doc No, status teks mentah | 'Ajukan Penambahan', 'Pengajuan Penambahan Saya', 'Sumber'/'No. Dokumen', StatusPill | Diperbaiki |

## Catatan reviewer

Laporan final, menggantikan laporan sebelumnya. Tambahan dari FYI lead: (a) Dialog alasan ad-hoc diganti promptDialog di Daily Sales Detail (Tolak), CRM Hub (Batalkan Reservasi) dan Reservations (Batalkan). Akibatnya testid ds-reject-reason, ds-reject-confirm dan btn-confirm-cancel hilang; ketiganya tidak dirujuk di repo dan diganti testid global prompt-dialog-input/confirm-ok. (b) Status di Stock Transfers kini StatusPill. (c) Sudah tidak ada font-mono di portal outlet; doc number memakai font-medium tabular-nums. (d) Shared request untuk tabs dan breadcrumb ditarik karena sudah diperbaiki global. Dua testid lain ikut hilang: outlet-scope-select (picker duplikat di Reservations, tidak dirujuk di repo) dan dc-history-refresh tetap ada. Testid lama dari tile/header lokal kini lewat prop testId CompactStatCard/PageHeader. Validasi: 27 file lolos jsxcheck dan eslint no-undef/rules-of-hooks dengan 0 error; audit_tours tetap 0 missing. Perbaikan perilaku (bug UI yang terbukti): master Brand/metode pembayaran kini dimuat di form Daily Sales; 'Simpan Draft' KDO/BDO benar-benar menyimpan draft; key={kind} di KdoBdoList; klik baris Daily Sales tanpa reload penuh; parsing 'Member Terbaru' di CRM; Reservations membuka detail dari state.openId; nama metode pembayaran di detail Daily Sales; Enter di input poin kasir tidak lagi mencari dua kali. Daily Close (/outlet/daily-close) adalah duplikat 1:1 dari Langkah 4 End of Day; rute dipertahankan dengan banner ke /outlet/end-of-day?step=3. Untuk menilai ulang Reservations/CRM perlu perbaikan seed. State embedded bisa dilihat di /outlet/end-of-day langkah 1–4.
