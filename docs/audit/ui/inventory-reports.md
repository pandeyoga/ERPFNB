# Audit UI/UX — Inventory & Report Center

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/inventory` — Inventory Overview

- **File:** `frontend/src/portals/inventory/InventoryHome.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-HOME-01 | page | title | P2 | Tidak ada <h1>. Judul berupa kartu hero glass-card p-6 dengan h2 font-bold. | Diganti PageHeader (ikon Package, judul, subtitle). OutletScopePicker dipindah ke actions. Wrapper testid inventory-welcome dipertahankan. | Diperbaiki |
| INV-HOME-03 | page | ia | P2 | Quick actions berupa kartu besar yang seluruhnya bisa diklik. Transfer/Adjustment menuju URL duplikat /inventory/transfers dan /inventory/adjustments. | Diganti tombol outline eksplisit. Transfer/Adjustment kini menuju tab di Stock Movements hub. | Diperbaiki |
| INV-HOME-04 | page | button | P2 | CTA widget 'Lihat & Buat PR' dan 'Review Now' berupa Link custom rounded-full bg-foreground. 'Review Now' berbahasa Inggris. | Diganti Button size sm. Label jadi 'Lihat & buat PR' dan 'Tinjau sekarang'. | Diperbaiki |
| INV-HOME-05 | page | flow | P2 | Link ke /inventory/market-list?ml_status=pending_review tidak memfilter apa pun, karena query param diabaikan. | MarketListPage kini menginisialisasi filter status dari ?ml_status. | Diperbaiki |
| INV-HOME-02 | page | card | P3 | KPI memakai KpiCard tanpa delta/tren, dan menampilkan '…' saat loading. | Diganti CompactStatCard (sub + skeleton loading, tone danger untuk Low Stock). Grid gap-3. | Diperbaiki |
| INV-HOME-06 | page | layout | P3 | Spasi dan padding di atas standar (space-y-6, p-5, gap-5). Heading widget berupa h3 tanpa skala standar. | Diubah ke space-y-3 lg:space-y-4, p-4, gap-3 lg:gap-4. Heading jadi h2 text-sm md:text-base. | Diperbaiki |
| INV-HOME-07 | page | ia | P3 | 'Lihat semua' Recent Movements menuju /inventory/movements (redirect). Widget 'Valuation per Outlet' menduplikasi Stock Valuation tanpa link. | Link langsung ke hub?type=history. Ditambah link 'Lihat detail' ke /inventory/valuation. | Diperbaiki |

## `/inventory/balance` — Stock Balance

- **File:** `frontend/src/portals/inventory/StockBalance.jsx`, `frontend/src/portals/inventory/StockBalanceMatrix.jsx`
- **State diperiksa:** halaman + 1 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 2
- **Tab:** Matrix
- **Sisa sinyal otomatis (heuristik):** 1 tombol ikon tanpa label/aria-label; Tinggi tombol non-standar: 16, 34, 56px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-BAL-01 | page | title | P2 | Halaman tanpa judul/<h1>. | Ditambah PageHeader 'Stock Balance' + aksi outline 'Ekspor Excel' ke /reports/stock-balance (hanya bila user punya izin Report Center). | Diperbaiki |
| INV-BAL-02 | page | tabs | P2 | Toggle List/Matrix berupa tombol rounded-full custom (30px), padahal fungsinya mengganti tampilan. | Diganti Tabs/TabsList/TabsTrigger standar; testid dipertahankan. Akses localStorage dibungkus try/catch. | Diperbaiki |
| INV-BAL-03 | page | flow | P2 | List memuat per_page=100 tanpa pager, sehingga baris setelah 100 tidak bisa diakses. | Ditambah pager Sebelumnya/Berikutnya. | Diperbaiki |
| INV-BAL-04 | page | form | P2 | Label filter 11px uppercase tanpa htmlFor. Select Outlet tidak terhubung ke label. | Label diubah ke ukuran standar. Input cari memakai htmlFor, select memakai aria-label (htmlFor butuh perubahan shared SimpleSelect). Ref doc di drilldown kini Inter font-medium tabular-nums (bukan font-mono). | Diperbaiki |
| INV-BAL-05 | tab:Matrix | button | P2 | Chip outlet dan tombol Reset berupa <button> mentah. Checkbox native. Link 'cell di bawah par' berupa chip custom. | Chip jadi Button sm toggle + aria-pressed. Reset jadi Button ghost. Checkbox diganti shadcn Checkbox + Label. Link jadi Button outline sm. | Diperbaiki |
| INV-BAL-06 | page | ia | P2 | Duplikat dengan /reports/stock-balance (on-screen vs Excel). | Ditautkan dua arah. Tidak dihapus; konsolidasi butuh keputusan lead. | Terbuka |
| INV-BAL-07 | page | flow | P3 | Pencarian item hanya memfilter halaman yang sedang dimuat (client-side). | Tidak diperbaiki: perlu parameter search di API. Catatan ditampilkan di pager. | Terbuka |

## `/inventory/low-stock` — Low Stock Alert

- **File:** `frontend/src/portals/inventory/LowStockAlert.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-LOW-01 | page | title | P2 | Judul berupa h2 custom (tidak ada <h1>). Tombol 'Refresh' size sm dan berbahasa Inggris. | Diganti PageHeader. Tombol jadi aksi outline 'Muat ulang'. | Diperbaiki |
| INV-LOW-02 | page | card | P2 | Tile lokal SummaryTile (text-2xl). | Diganti CompactStatCard tone danger/warning. SummaryTile dihapus. Testid low-tile-* dipertahankan. | Diperbaiki |
| INV-LOW-03 | page | a11y | P2 | 20 tombol checkbox ikon tanpa label. | Ditambah role=checkbox, aria-checked, aria-label, dan focus ring. | Diperbaiki |
| INV-LOW-04 | page | button | P2 | Filter Severity berupa tombol custom 26px. 'Buat PR' memakai override pill-active. | Severity diganti Button sm toggle + aria-pressed. Override dihapus. | Diperbaiki |
| INV-LOW-05 | page | language | P3 | Empty state 'Stok aman 🎉' memakai emoji dan tidak membedakan kosong karena filter. | Emoji dihapus. Ditambah empty state terpisah untuk hasil filter. | Diperbaiki |
| INV-LOW-06 | page | form | P3 | Label 11px uppercase. Input Cari tanpa htmlFor. Select outlet tanpa label terhubung. | Label standar. Input memakai htmlFor, select memakai aria-label. | Diperbaiki |

## `/inventory/movements-hub` — Stock Movements

- **File:** `frontend/src/portals/inventory/StockMovementsHub.jsx`, `frontend/src/portals/inventory/Movements.jsx`, `frontend/src/portals/inventory/TransferList.jsx`, `frontend/src/portals/inventory/AdjustmentList.jsx`, `frontend/src/portals/inventory/ListHeader.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 8 → 0
- **Tab:** Transfer, Adjustment

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-MOV-05 | tab:Transfer | ia | P1 | Tidak ada jalan ke halaman detail /inventory/transfers/:id: halaman detail yatim. | Ditambah tombol ikon 'Lihat detail' per baris (testid trf-view-<id>). | Diperbaiki |
| INV-MOV-01 | page | title | P2 | Judul h2 di dalam kartu hero, plus tab underline custom dengan baris tab 57px. | Diganti PageHeader 'Stock Movements' + Tabs standar. Testid movements-tabs dan mov-tab-* dipertahankan. | Diperbaiki |
| INV-MOV-02 | tab:Transfer | title | P2 | Tab Transfer/Adjustment menampilkan kartu judul kedua (h3): judul ganda dan kartu bertumpuk. | Ditambah ListHeader: mode embedded memakai baris seksi h2 ringkas; route mandiri memakai PageHeader. | Diperbaiki |
| INV-MOV-03 | tab:Riwayat | button | P2 | Pagination memakai <button> mentah 'Prev/Next' (20–26px). | Diganti Button outline sm 'Sebelumnya/Berikutnya' di ketiga tab. | Diperbaiki |
| INV-MOV-04 | tab:Transfer | button | P2 | Kirim/Terima memakai h-7 rounded-full pill-active. 'Transfer Baru' memakai h-10 rounded-full. Doc No memakai font-mono. | Override dihapus, ukuran standar. Doc No kini Inter font-medium tabular-nums. | Diperbaiki |
| INV-MOV-06 | tab:Adjustment | a11y | P2 | Tombol Eye mentah tanpa aria-label. 'Approve'/'Reject' berbahasa Inggris dengan override h-7. Doc No memakai font-mono. | Eye jadi Button icon-sm + aria-label. Label 'Setujui'/'Tolak'. Toast Bahasa. Doc No Inter tabular-nums. | Diperbaiki |
| INV-MOV-07 | dialog:Tolak adjustment | form | P2 | Dialog reject ad-hoc: textarea tanpa label, konfirmasi pill-active (bukan destructive). Dialog Approval Detail tanpa tombol tutup. | Reject diganti promptDialog global (label 'Alasan penolakan', wajib, destructive, 'Tolak'); dialog lokal dan testid adj-reject-reason/confirm dihapus, dialog global punya testid prompt-dialog-input/confirm-ok. Dialog approval diberi footer 'Tutup'. | Diperbaiki |
| INV-MOV-09 | tab:Riwayat | ia | P2 | Tab Riwayat menduplikasi /reports/stock-movement. | Ditambah 'Ekspor Excel' (tab Riwayat, dengan cek izin) ke Report Center; laporan menautkan balik. | Terbuka |
| INV-MOV-08 | tab:Riwayat | form | P3 | Label 11px uppercase ('Type', 'Sejak Tanggal'). Select tanpa label terhubung. | Label standar + htmlFor/aria-label. Empty state diberi deskripsi. | Diperbaiki |

## `/inventory/transfers` — Stock Transfers

- **File:** `frontend/src/portals/inventory/TransferList.jsx`, `frontend/src/portals/inventory/ListHeader.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 3 → 0
- **Dialog/pop-up:** Transfer Baru (8 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-TRF-01 | page | title | P2 | Tidak ada <h1>; header berupa kartu h3. | PageHeader saat route mandiri. Wrapper trf-header-card dipertahankan. | Diperbaiki |
| INV-TRF-02 | dialog:Transfer Baru | form | P2 | 4 field baris tanpa label. Select h-10, label uppercase, opsi '--'. Hapus baris berupa <button> mentah. Simpan menampilkan '…'. | Ditambah aria-label per field. Select h-9, label standar + '*', opsi 'Pilih outlet …'. Hapus baris jadi Button ghost icon 'Hapus baris'. Tombol 'Simpan draft'. | Diperbaiki |
| INV-TRF-04 | page | ia | P2 | Route /inventory/transfers merender komponen yang sama dengan tab Transfer di hub (URL duplikat). | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| INV-TRF-03 | dialog:Transfer Baru | a11y | P3 | Field 'Cari item…' (ItemAutocomplete) tidak bisa diberi label. | Diselesaikan di komponen bersama — ItemAutocomplete menerima id/ariaLabel. | Diperbaiki (komponen shared) |

## `/inventory/transfers/:id` — Transfer <doc_no>

- **File:** `frontend/src/portals/inventory/TransferDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-TRFD-01 | page | flow | P2 | Tombol 'Kembali' dan redirect saat gagal load menuju URL duplikat /inventory/transfers. | Diganti 'Kembali ke daftar transfer', menuju hub?type=transfers. | Diperbaiki |
| INV-TRFD-02 | page | layout | P2 | Aksi Kirim/Terima di baris terpisah di atas judul (rounded-full pill-active). | Dipindah ke PageHeader actions bersama StatusPill. | Diperbaiki |
| INV-TRFD-04 | page | runtime | P2 | Timeline 'Dikirim'/'Diterima' tampil tidak aktif padahal status Received (sent_at/received_at kosong). | Langkah aktif kini diturunkan dari status. | Diperbaiki |
| INV-TRFD-03 | page | card | P3 | Tile lokal SummaryCard dan peta status lokal statusLabel(). | Diganti CompactStatCard. Tile Status memakai StatusPill (kamus global). Komponen lokal dihapus. | Diperbaiki |
| INV-TRFD-05 | page | layout | P3 | Wrapper max-w-5xl mx-auto, p-5/px-5, total font-bold. Link movement ke redirect. | Wrapper dihapus. Padding p-4/px-3, semibold. Link langsung ke hub?type=history. | Diperbaiki |

## `/inventory/adjustments` — Stock Adjustments

- **File:** `frontend/src/portals/inventory/AdjustmentList.jsx`, `frontend/src/portals/inventory/ListHeader.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 3 → 0
- **Dialog/pop-up:** Adjustment Baru (8 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-ADJ-01 | page | title | P2 | Tidak ada <h1>; kartu h3. Tombol 'Adjustment Baru' memakai h-10 rounded-full. | PageHeader saat route mandiri. Tombol standar. Testid dipertahankan. | Diperbaiki |
| INV-ADJ-02 | dialog:Adjustment Baru | form | P2 | 5 field tanpa label. Select h-10, 'Reason' berbahasa Inggris, tombol 'Submit'. Hapus baris berupa <button> mentah. | Ditambah aria-label per field. Label standar + '*' ('Alasan'), select h-9, tombol 'Ajukan', Button ghost icon 'Hapus baris'. | Diperbaiki |
| INV-ADJ-03 | page | ia | P2 | Route menduplikasi tab Adjustment di hub. | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/inventory/opname` — Stock Opname

- **File:** `frontend/src/portals/inventory/OpnameList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-OPN-01 | page | title | P2 | Tidak ada <h1>; kartu h3 'Opname Sessions' tidak sama dengan nav 'Stock Opname'. Tombol 'Mulai Opname' memakai h-10 rounded-full. | Diganti PageHeader 'Stock Opname' dengan aksi standar. Doc No Inter tabular-nums (bukan font-mono). | Diperbaiki |
| INV-OPN-04 | dialog:Mulai sesi opname | form | P2 | Label uppercase tanpa htmlFor. Periode berupa teks bebas. Select h-10. | Ditambah Label htmlFor. Periode memakai Input type=month. Select h-9. Tombol 'Mulai opname'. | Diperbaiki |
| INV-OPN-02 | page | flow | P3 | Empty state tanpa aksi. | Ditambah tombol 'Mulai Opname' di empty state. | Diperbaiki |
| INV-OPN-03 | page | button | P3 | 'Buka' berupa link teks polos. Pagination memakai <button> mentah. | Diganti Button ghost sm dan Button outline sm. | Diperbaiki |
| INV-OPN-05 | dialog:Mulai sesi opname | flow | P3 | Setelah mulai, window.location.href memicu full reload. | Diganti navigate SPA ke sesi baru. | Diperbaiki |

## `/inventory/opname/:id` — Opname <doc_no>

- **File:** `frontend/src/portals/inventory/OpnameSession.jsx`, `frontend/src/portals/inventory/AIVariancePanel.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** — → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-OPS-01 | page | title | P2 | Judul h2 text-xl font-bold. Tombol kembali outline rounded-full; aksi rounded-full pill-active. | Diganti PageHeader (outlet · periode, StatusPill + aksi) + ghost 'Kembali ke Stock Opname'. | Diperbaiki |
| INV-OPS-03 | page | a11y | P2 | Input qty fisik, catatan per baris, dan pencarian tanpa label. | Ditambah aria-label. | Diperbaiki |
| INV-OPS-02 | page | language | P3 | Label campur Inggris: 'Simpan Progress', 'Submit', 'Counted/Note/Variance Value'. | Diganti 'Simpan progres', 'Ajukan opname', 'Fisik/Catatan/Nilai variance'. | Diperbaiki |
| INV-OPS-04 | page | flow | P3 | 'Sesi tidak ditemukan' tanpa jalan kembali. | Diganti EmptyState + tombol kembali. | Diperbaiki |
| INV-OPS-05 | page | layout | P3 | Wrapper max-w-6xl mx-auto, space-y-5, p-5. Panel AI memakai tombol rounded-full pill-active. | Diubah ke layout standar. Label 'Analisis ulang'. (Hanya review kode — tidak ada seed data.) | Diperbaiki |

## `/inventory/valuation` — Stock Valuation

- **File:** `frontend/src/portals/inventory/Valuation.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-VAL-01 | page | title | P2 | Halaman tanpa judul/<h1>. | Ditambah PageHeader 'Stock Valuation' + 'Ekspor Excel' ke /reports/inventory-valuation (dengan cek izin). | Diperbaiki |
| INV-VAL-04 | page | ia | P2 | Duplikat /reports/inventory-valuation dan widget Overview. | Ditautkan; tidak dihapus. | Terbuka |
| INV-VAL-02 | page | card | P3 | KPI memakai KpiCard tanpa delta. | Diganti CompactStatCard dengan label Bahasa. | Diperbaiki |
| INV-VAL-03 | page | layout | P3 | Saat loading, seluruh halaman (termasuk filter) hilang. Kartu p-5, nilai font-bold, label 'As of'. | Header dan filter tetap tampil saat loading. p-4, semibold, 'Per:'. | Diperbaiki |

## `/inventory/market-list` — Market Price List

- **File:** `frontend/src/portals/inventory/MarketListPage/index.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 6 → 0
- **Dialog/pop-up:** Buat Quarter Baru (2 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| INV-ML-01 | page | title | P2 | Judul 'Market List' tidak sama dengan nav 'Market Price List'. h1 bespoke text-2xl font-bold; wrapper p-6 dan mb-6. | Diganti PageHeader 'Market Price List'; wrapper standar. | Diperbaiki |
| INV-ML-02 | page | button | P2 | Tombol biru/hijau menimpa brand. Refresh ikon tanpa aria-label. 'Export Excel' berbahasa Inggris. | Diganti Button standar, aria-label 'Muat ulang', label 'Ekspor Excel'. | Diperbaiki |
| INV-ML-03 | page | card | P2 | 4 stat Card lokal border-l-4 text-2xl font-bold. Badge status lokal (StatusBadge) berwarna hardcode. | Stat diganti CompactStatCard ('Tinjau sekarang →' sebagai sub). Status item diganti StatusPill (kamus global). | Diperbaiki |
| INV-ML-05 | page | a11y | P2 | Tombol ikon baris dan pager tanpa aria-label. Search dan select tanpa label. | Ditambah aria-label. Tombol 'Approve' jadi 'Setujui'. | Diperbaiki |
| INV-ML-06 | dialog:Buat Quarter | form | P2 | Field memakai <label> mentah tanpa htmlFor; tombol biru. Dialog Set Harga, Approve, dan Histori sama; Histori tanpa tombol tutup. | Diganti Label htmlFor + '*' dan DialogDescription. Tombol standar. 'Tutup' di Histori. | Diperbaiki |
| INV-ML-08 | page | runtime | P2 | Ekspor tidak cek res.ok, sehingga error terunduh sebagai .xlsx rusak. | Throw saat !res.ok, lalu toast error. | Diperbaiki |
| INV-ML-04 | page | card | P3 | Dua kartu terpisah; kartu quarter kosong saat belum ada quarter. Chip quarter biru custom. | Digabung jadi satu kartu filter dengan hint empty. Chip jadi Button sm toggle. | Diperbaiki |
| INV-ML-07 | page | language | P3 | Konfirmasi memakai emoji '⚠️'. 'Extreme Price Variance!' berbahasa Inggris. Tidak ada toast sukses. | Diganti Bahasa tanpa emoji. Ditambah toast sukses. | Diperbaiki |
| INV-ML-09 | page | typography | P3 | Warna hardcode gray/blue/yellow tidak mendukung dark mode. | Diganti token muted dan amber/emerald dengan varian dark. | Diperbaiki |
| INV-ML-10 | page | ia | P3 | Tile 'Pending review' menghitung item di halaman aktif saja. | Tidak diperbaiki: butuh count dari API. | Terbuka |

## `/reports` — Report Center

- **File:** `frontend/src/portals/reports/ReportsCatalog.jsx`, `frontend/src/portals/reports/reportCatalog.js`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-CAT-01 | page | title | P2 | Judul 'Reports Catalog' tidak sama dengan nav 'Report Center'. Header berupa kartu hero p-6. | Diganti PageHeader 'Report Center' (testid dipertahankan). | Diperbaiki |
| RPT-CAT-02 | page | a11y | P2 | Kartu laporan berupa div onClick yang tidak bisa difokus keyboard. | Diganti <Link> dengan ikon, panah, dan focus ring. | Diperbaiki |
| RPT-CAT-05 | page | flow | P2 | 'Report Builder' menuju redirect dan tampil untuk user tanpa izin, lalu berujung /no-access. | Link langsung ke /finance/reports?tab=report-builder. Kartu disembunyikan bila tidak permitted(). | Diperbaiki |
| RPT-CAT-06 | page | ia | P2 | Nama dan deskripsi kartu tidak sama dengan judul halaman laporan. | Dibuat satu metadata reportCatalog.js untuk katalog dan halaman. | Diperbaiki |
| RPT-CAT-07 | page | ia | P2 | Tumpang tindih dengan /finance/reports (TB, P&L, Procurement Reports, Custom) dan /finance/ap-aging. | Report Center = katalog ekspor Excel; Finance › Reports = analisis di layar; keduanya saling ditautkan (§8.1). | Keputusan: dipertahankan (§8.1) |
| RPT-CAT-03 | page | density | P3 | Badge 'Active' di semua kartu hanya menambah noise. | Badge dihapus. | Diperbaiki |
| RPT-CAT-04 | page | layout | P3 | space-y-6, ikon gradient 40px, deskripsi kategori Inggris. | Diubah ke space-y-4, h2 standar + ikon kecil, deskripsi Bahasa, gap-3. | Diperbaiki |

## `/reports/daily-sales` — Daily Sales Summary Report

- **File:** `frontend/src/portals/reports/DailySalesReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-DS-01 | page | title | P2 | Header berupa Card p-5 terpisah (h1 bespoke, ikon gradient). | Diganti ReportPage: PageHeader dari reportCatalog + ghost '← Report Center'. | Diperbaiki |
| RPT-DS-02 | form | button | P2 | Tombol full-width gradient emerald (30px) 'Download Excel Report'. | Diganti satu tombol primer 'Ekspor Excel' h-9 di footer kartu filter. | Diperbaiki |
| RPT-DS-03 | form | form | P2 | Input tanggal tanpa label terhubung. Chip outlet/brand berupa <button> mentah. | Ditambah ReportField htmlFor (grid 1/2/4 kolom) dan ChipMultiSelect (aria-pressed, 'n dipilih', Reset). | Diperbaiki |
| RPT-DS-04 | form | runtime | P2 | Error ekspor menampilkan 'Request failed…' (blob tidak dibaca). Toast Inggris. Tanpa validasi rentang. | useExcelExport mem-parse error blob. Toast Bahasa. Ditambah validRange. | Diperbaiki |
| RPT-DS-05 | page | density | P3 | Tidak ada pratinjau di layar. | Tidak diperbaiki: tidak ada API pratinjau. | Terbuka |

## `/reports/outlet-performance` — Outlet Performance Report

- **File:** `frontend/src/portals/reports/OutletPerformanceReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-OP-01 | page | title | P2 | Header berupa Card p-5 bespoke. | Diganti PageHeader via ReportPage. | Diperbaiki |
| RPT-OP-02 | form | button | P2 | Tombol gradient full-width 30px. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-OP-03 | form | form | P2 | Input tanpa label terhubung. Chip outlet berupa <button> mentah. | Ditambah ReportField dan ChipMultiSelect. | Diperbaiki |
| RPT-OP-04 | form | runtime | P2 | Pesan error tidak informatif; tanpa validasi rentang. | Ditambah useExcelExport + validRange. | Diperbaiki |

## `/reports/fdo-history` — FDO History Report

- **File:** `frontend/src/portals/reports/FdoHistoryReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-FDO-01 | page | title | P2 | Header berupa Card p-5 bespoke. | Diganti PageHeader. | Diperbaiki |
| RPT-FDO-02 | form | button | P2 | Tombol gradient full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-FDO-03 | form | form | P2 | Input tanpa label terhubung. Opsi status Inggris. | Ditambah ReportField htmlFor; opsi 'Semua status', 'Menunggu approval', 'Disetujui', 'Ditolak'. | Diperbaiki |
| RPT-FDO-04 | form | runtime | P2 | Pesan error tidak informatif; tanpa validasi rentang. | Ditambah useExcelExport + validRange. | Diperbaiki |

## `/reports/stock-balance` — Stock Balance Report

- **File:** `frontend/src/portals/reports/StockBalanceReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-SB-01 | page | title | P2 | Header Card p-5 bespoke. | Diganti PageHeader. | Diperbaiki |
| RPT-SB-02 | form | button | P2 | Tombol gradient biru full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-SB-03 | form | form | P2 | 'As of Date' lebar penuh tanpa label terhubung. Chip berupa <button> mentah. | Ditambah ReportField 'Per tanggal' dan ChipMultiSelect Outlet/Kategori. | Diperbaiki |
| RPT-SB-04 | page | ia | P2 | Duplikat /inventory/balance. | Ditambah 'Buka Stock Balance' (dengan cek izin); ditautkan dua arah. | Terbuka |

## `/reports/stock-movement` — Stock Movements Report

- **File:** `frontend/src/portals/reports/StockMovementReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-SM-01 | page | title | P2 | Header bespoke. Judul tidak selaras dengan nav 'Stock Movements'. | Diganti PageHeader 'Stock Movements Report'. | Diperbaiki |
| RPT-SM-02 | form | button | P2 | Tombol gradient full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-SM-03 | form | form | P2 | Input tanpa label terhubung. 'Movement Type'/'All Types'. | Ditambah ReportField htmlFor ('Tipe movement', 'Semua tipe'), ChipMultiSelect, validRange. | Diperbaiki |
| RPT-SM-04 | page | ia | P2 | Duplikat tab Riwayat hub. | Ditautkan dua arah. | Terbuka |

## `/reports/inventory-valuation` — Stock Valuation Report

- **File:** `frontend/src/portals/reports/InventoryValuationReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-IV-01 | page | title | P2 | Header bespoke. Judul tidak selaras dengan nav 'Stock Valuation'. | Diganti PageHeader 'Stock Valuation Report' (juga di katalog). | Diperbaiki |
| RPT-IV-02 | form | form | P2 | Berbeda dari laporan lain: <input> native, p-6, space-y-6. | Diseragamkan ke ReportPage/ReportField/ChipMultiSelect. | Diperbaiki |
| RPT-IV-03 | form | button | P2 | Tombol 'Download Excel'/'Generating...' gradient 30px. | Diganti 'Ekspor Excel'/'Mengekspor…' primer. | Diperbaiki |
| RPT-IV-04 | page | ia | P2 | Duplikat /inventory/valuation. | Ditautkan dua arah. | Terbuka |

## `/reports/po-summary` — PO Summary Report

- **File:** `frontend/src/portals/reports/POSummaryReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-PO-01 | page | title | P2 | Header Card p-5 bespoke. | Diganti PageHeader + 'Buka Purchase Orders' (dengan cek izin). | Diperbaiki |
| RPT-PO-02 | form | button | P2 | Tombol gradient ungu full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-PO-03 | form | form | P2 | Input tanpa label terhubung. Opsi status Inggris. Chip vendor berupa <button> mentah. | Ditambah ReportField, opsi Bahasa, ChipMultiSelect, validRange. | Diperbaiki |

## `/reports/gr-summary` — GR Summary Report

- **File:** `frontend/src/portals/reports/GRSummaryReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-GR-01 | page | title | P2 | Header bespoke. | Diganti PageHeader + 'Buka Goods Receipt'. | Diperbaiki |
| RPT-GR-02 | form | button | P2 | Tombol gradient full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-GR-03 | form | form | P2 | Input tanpa label terhubung. Chip vendor berupa <button> mentah. | Ditambah ReportField, ChipMultiSelect, validRange. | Diperbaiki |

## `/reports/vendor-performance` — Vendor Performance Report

- **File:** `frontend/src/portals/reports/VendorPerformanceReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-VP-01 | page | title | P2 | Header bespoke. | Diganti PageHeader + 'Buka Vendor Scorecard'. | Diperbaiki |
| RPT-VP-02 | form | button | P2 | Tombol gradient full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-VP-03 | form | form | P2 | Input tanpa label terhubung. Chip vendor berupa <button> mentah. | Ditambah ReportField, ChipMultiSelect, validRange. | Diperbaiki |
| RPT-VP-04 | page | ia | P3 | Tumpang tindih dengan /procurement/vendor-scorecard. | Ditautkan. | Terbuka |

## `/reports/journal-ledger` — Journal Ledger Report

- **File:** `frontend/src/portals/reports/JournalLedgerReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-JL-01 | page | title | P2 | Header bespoke. | Diganti PageHeader + 'Buka Journals'. | Diperbaiki |
| RPT-JL-02 | form | button | P2 | Tombol gradient amber full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-JL-03 | form | form | P2 | Input/select tanpa label terhubung. Opsi 'All Akun'/'All Source' campur bahasa. | Ditambah ReportField (4 field satu baris), 'Semua akun'/'Semua sumber', ChipMultiSelect, validRange. | Diperbaiki |

## `/reports/trial-balance` — Trial Balance Report

- **File:** `frontend/src/portals/reports/TrialBalanceReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-TB-01 | page | title | P2 | Header bespoke. | Diganti PageHeader + 'Buka Trial Balance'. | Diperbaiki |
| RPT-TB-02 | form | button | P2 | Tombol gradient amber full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-TB-03 | form | form | P2 | Periode tanpa label terhubung. Hint 'Contoh: 2026-04' berlebihan untuk input month. | Ditambah ReportField 'Periode *'. Hint dihapus. 'Semua outlet (konsolidasi)'. | Diperbaiki |
| RPT-TB-04 | page | ia | P2 | Duplikat tab Trial Balance di /finance/reports. | Report Center = katalog ekspor Excel; Finance › Reports = analisis di layar; keduanya saling ditautkan (§8.1). | Keputusan: dipertahankan (§8.1) |

## `/reports/ap-aging` — AP Aging Report

- **File:** `frontend/src/portals/reports/APAgingReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-AP-01 | page | title | P2 | Header bespoke. | Diganti PageHeader + 'Buka AP Aging'. | Diperbaiki |
| RPT-AP-02 | form | button | P2 | Tombol gradient amber full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-AP-03 | form | form | P2 | 'As Of Date' tanpa label terhubung. Chip vendor berupa <button> mentah. | Ditambah ReportField 'Per tanggal' + hint dan ChipMultiSelect. | Diperbaiki |
| RPT-AP-04 | page | ia | P3 | Tumpang tindih dengan /finance/ap-aging. | Ditautkan. | Terbuka |

## `/reports/pl-group` — P&L Report — FnB Group Format

- **File:** `frontend/src/portals/reports/PLGroupReport.jsx`, `frontend/src/portals/reports/reportKit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| RPT-PL-01 | page | title | P2 | Header bespoke dengan subtitle sangat panjang. | Diganti PageHeader + 'Buka Profit & Loss'. | Diperbaiki |
| RPT-PL-02 | form | form | P2 | Periode tanpa label terhubung ('Period From/To'). | Ditambah ReportField 'Periode awal/akhir *' + Outlet satu baris, validRange. | Diperbaiki |
| RPT-PL-04 | form | button | P2 | Tombol gradient amber full-width. | Diganti 'Ekspor Excel' primer. | Diperbaiki |
| RPT-PL-05 | page | ia | P2 | Tumpang tindih dengan tab Profit & Loss di /finance/reports. | Report Center = katalog ekspor Excel; Finance › Reports = analisis di layar; keduanya saling ditautkan (§8.1). | Keputusan: dipertahankan (§8.1) |
| RPT-PL-03 | page | card | P3 | Kartu 'Format Detail' berlatar amber custom p-5. | Diganti section glass-card p-4 'Struktur laporan'. | Diperbaiki |

## Catatan reviewer

UPDATED REPORT — menggantikan handback sebelumnya. FYI lead sudah ditindaklanjuti: (a) confirmDialog tetap dipakai apa adanya. (b) Dialog reject adjustment ad-hoc diganti promptDialog global (testid adj-reject-reason/adj-reject-confirm hilang; dipakai prompt-dialog-input/confirm-ok). (c) font-mono pada Doc No (Transfer, Adjustment, Opname) dan ref doc di drilldown Stock Balance diganti Inter font-medium tabular-nums; tidak ada font-mono tersisa di inventory/reports. (d) Status lokal diganti StatusPill: tile status TransferDetail dan status item Market List. (e) Request breadcrumb dari laporan sebelumnya dicabut karena sudah diperbaiki global.  Ringkasan pekerjaan: 1. 13 halaman laporan memakai satu layout baru di frontend/src/portals/reports/reportKit.jsx (ReportPage, ReportField, FilterGrid, ChipMultiSelect, useExcelExport, validRange). Metadata di frontend/src/portals/reports/reportCatalog.js dipakai katalog dan judul halaman. Endpoint dan param API tidak berubah. Tidak ada pratinjau (API hanya .xlsx). 2. 'Ekspor Excel' di halaman laporan sengaja di footer kartu Filter sebagai submit form. PageHeader berisi ghost '← Report Center' + outline 'Buka <halaman on-screen>' (cek izin via permitted()). Stock Balance, Stock Valuation, dan tab Riwayat Stock Movements punya outline 'Ekspor Excel' ke laporan terkait (REPORT_CENTER_PERMS). 3. Judul yang diganti: 'Market Price List', 'Stock Opname', 'Stock Valuation Report', 'Stock Movements Report', 'Report Center'. 4. Duplikasi IA (route tidak dihapus, sudah saling ditautkan): balance↔reports/stock-balance; hub Riwayat↔reports/stock-movement; valuation↔reports/inventory-valuation↔widget Overview; /inventory/transfers dan /inventory/adjustments = tab hub (usul: Navigate ke hub); reports TB/PL↔finance/reports; reports/ap-aging↔finance/ap-aging; reports/vendor-performance↔procurement/vendor-scorecard. 5. Komponen baru frontend/src/portals/inventory/ListHeader.jsx; TransferList dan AdjustmentList menerima prop `embedded`. 6. Perubahan perilaku untuk re-crawl: pager Stock Balance; Checkbox Radix di Matrix (testid tetap); quick actions Overview berupa tombol ke tab hub; Market List membaca ?ml_status; Mulai Opname memakai navigate SPA; timeline TransferDetail mengikuti status; Valuation menampilkan header saat loading; tombol 'Lihat detail' transfer (trf-view-<id>). 7. Semua testid tour dipertahankan: audit_tours 0 missing, 0 route drift. jsxcheck OK. eslint 0 error; yang tersisa hanya warning lama (variabel catch `e` tak terpakai, `abs` tak terpakai di Market List). 8. /inventory/opname/:id tidak punya seed data — hanya review kode.
