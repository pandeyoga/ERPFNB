# Audit UI/UX — Finance — Pelaporan & Kontrol

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/finance/reports` — Reports

- **File:** `frontend/src/portals/finance/FinanceReportsHub.jsx`, `frontend/src/portals/finance/TrialBalance.jsx`, `frontend/src/portals/finance/ProfitLoss.jsx`, `frontend/src/portals/finance/BalanceSheet.jsx`, `frontend/src/portals/finance/CashflowReport.jsx`, `frontend/src/portals/finance/Comparatives.jsx`, `frontend/src/portals/finance/ReportBuilder.jsx`, `frontend/src/portals/finance/PivotReport.jsx`, `frontend/src/portals/finance/ProcurementReportsTab.jsx`
- **State diperiksa:** halaman + 7 tab, 0 dialog
- **Temuan otomatis (crawler):** 27 → 1
- **Tab:** Profit & Loss, Balance Sheet, Cashflow, Period compare, Custom reports, Pivot analysis, Procurement reports
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 71px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-RPT-15 | page | typography | P1 | Font non-Inter (ui-monospace) pada kode akun/dokumen | font-mono → font-medium tabular-nums (konvensi lintas portal) | Diperbaiki |
| FIN-RPT-01 | page | title | P2 | Tidak ada <h1>; judul bespoke h2 'Financial Reports' (font-bold) tidak sama dengan nama nav 'Reports' | PageHeader title 'Reports' + subtitle, InlineHelp dipindah ke actions | Diperbaiki |
| FIN-RPT-03 | page | tabs | P2 | Tab bar custom (button underline text-aurora, tinggi 43px); tab ke-8 'Procurement Reports' terpotong di luar layar 1280px | Diganti Tabs/TabsList/TabsTrigger unified tanpa override (lebih ringkas, muat 8 tab), label sentence case ('Period compare', 'Custom reports', 'Pivot analysis', 'Procurement reports'); testid reports-tab-* dipertahankan | Diperbaiki |
| FIN-RPT-04 | tab:Trial Balance | form | P2 | Label 'Period'/'Cari COA' tidak terhubung ke input, select outlet tanpa nama aksesibel; tombol 'CSV' rounded-full h-10 | Label htmlFor/ariaLabel, Button default h-9 'Ekspor CSV' (disabled saat data belum ada), filter card p-3 | Diperbaiki |
| FIN-RPT-06 | tab:Profit & Loss | card | P2 | SummaryCard lokal (text-2xl font-bold) — nilai Revenue membungkus 2 baris; kartu seksi p-5; header kolom campur 'Code / Akun / Jumlah' | SummaryCard dihapus → shared KpiCard (delta % + 'vs bulan lalu · Margin x%'), kartu p-4 + h3 14/16px, header 'Kode' | Diperbaiki |
| FIN-RPT-08 | tab:Balance Sheet | runtime | P2 | Teks tidak seimbang menampilkan 'Rp Rp …' (fmtRp sudah berprefiks Rp); status Inggris 'Balanced — Asset = Liability + Equity'; nominal membungkus di kolom sempit | Prefiks ganda dihapus, teks 'Seimbang — Aset = Liabilitas + Ekuitas', nominal whitespace-nowrap, judul seksi jadi h3, label 'Per tanggal' + htmlFor, tombol 'Ekspor CSV' standar | Diperbaiki |
| FIN-RPT-09 | tab:Cashflow | card | P2 | KpiTile lokal; judul seksi label uppercase 11px; 'In/Out/txn' & caption sumbu Inggris; teks SVG 9px (24 teks < 11px) | KpiTile → CompactStatCard (tone success/danger), judul h3 'Per kategori' / 'Saldo harian berjalan' / 'Transaksi terbaru (50 teratas)', 'Masuk/Keluar/transaksi', font SVG 11px, caption Indonesia, aria-expanded pada baris kategori | Diperbaiki |
| FIN-RPT-10 | tab:Period Compare | card | P2 | KpiCard & DeltaCard lokal (p-5, text-3xl font-bold); toggle MOM/YOY grad-aurora rounded-full; select metrik menampilkan key mentah 'sales' | Diganti CompactStatCard (Δ dengan tone/ikon), toggle segmented h-8 13px pill-active (aria-pressed), label metrik ringkas, filter label Indonesia | Diperbaiki |
| FIN-RPT-11 | tab:Custom Reports | layout | P2 | Action bar sticky transparan menimpa chip filter Brand (teks tembus di belakang tombol); tombol rounded-full h-10 grad-aurora; 'Run Report/Save/CSV/Excel' campur bahasa; form simpan tanpa Batal | Bar sticky glass-card p-2, Button standar 'Jalankan laporan' (primer) + outline 'Simpan/Ekspor CSV/Ekspor Excel', form simpan: Label htmlFor + * + Batal | Diperbaiki |
| FIN-RPT-12 | tab:Custom Reports | a11y | P2 | Chip metrik berisi label teknis '(validated daily_sales grand_total)'; tombol hapus laporan tersimpan ikon tanpa aria-label; header kolom hasil = key mentah; 'Saved Reports / Belum ada saved report' | Label ringkas + title lengkap, chip h-8 13px pill-active aria-pressed, Button icon-sm aria-label, header kolom pakai label, 'Laporan tersimpan' + empty state berpanduan; kartu p-5 → p-4 | Diperbaiki |
| FIN-RPT-14 | tab:Procurement Reports | card | P2 | ReportCard ad-hoc (rounded-xl border bg-card p-5); h3 uppercase 'Laporan Pengadaan' menduplikasi label tab + catatan footer berulang; input date mentah tanpa label terhubung; 'Export Excel' | glass-card p-4, satu kalimat keterangan + InlineHelp, Input + Label htmlFor/ariaLabel, 'Ekspor Excel' (disabled saat mengunduh), 'Source' → 'Sumber' | Diperbaiki |
| FIN-RPT-02 | page | ia | P3 | Breadcrumb in-page 'Reports › Trial Balance' menduplikasi breadcrumb TopNav | Breadcrumb in-page dihapus | Diperbaiki |
| FIN-RPT-05 | tab:Trial Balance | language | P3 | Pesan status Inggris 'Period activity balanced (Dr = Cr).' dan toast 'Gagal load TB' | 'Aktivitas periode seimbang (Dr = Cr).' / 'Periode belum seimbang: selisih …', toast 'Gagal memuat Trial Balance' | Diperbaiki |
| FIN-RPT-07 | tab:Profit & Loss | card | P3 | Delta Operating Expense yang naik akan tampil hijau (KpiCard selalu menganggap naik = baik) | Diselesaikan di komponen bersama — prop invertDelta di KpiCard | Diperbaiki (komponen shared) |
| FIN-RPT-13 | tab:Pivot Analysis | layout | P3 | Tombol CSV turun sendirian ke baris kedua (grid 5 kolom); label 'Y-axis (rows)/X-axis (cols)/Metric' campur dengan 'Dari/Hingga'; judul tabel key mentah 'outlet × month — sales' | Grid 6 kolom, label 'Baris (sumbu Y)/Kolom (sumbu X)/Metrik' + htmlFor/ariaLabel, judul & header pakai label dimensi/metrik, 'Ekspor CSV' | Diperbaiki |

## `/finance/tax` — Tax & Compliance

- **File:** `frontend/src/portals/finance/FinanceTaxHub.jsx`, `frontend/src/portals/finance/TaxCenterPkg/index.jsx`, `frontend/src/portals/finance/TaxCenterPkg/constants.js`, `frontend/src/portals/finance/TaxCenterPkg/PPh21Calculator.jsx`, `frontend/src/portals/finance/TaxCenterPkg/WithholdingComponents.jsx`, `frontend/src/portals/finance/EFakturExport.jsx`, `frontend/src/portals/finance/EBupotExport.jsx`
- **State diperiksa:** halaman + 5 tab, 0 dialog
- **Temuan otomatis (crawler):** 10 → 8
- **Tab:** PPh 21, PPh 23, PPh 4(2), e-Faktur, e-Bupot
- **Sisa sinyal otomatis (heuristik):** 1 tombol ikon tanpa label/aria-label; Tinggi tombol non-standar: 20, 80px (standar 32/36/40); Tinggi tombol non-standar: 20px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-TAX-02 | page | tabs | P1 | Tab bertumpuk: hub (Tax Center/e-Faktur/e-Bupot) + tab PPN/PPh di Tax Center + tab Export/Preview/Riwayat di e-Bupot (2–3 baris tab) | Satu baris Tabs unified: PPN · PPh 21 · PPh 23 · PPh 4(2) · e-Faktur · e-Bupot; TaxCenter dirender embedded per section tanpa judul/tab; ?tab=tax tetap = PPN (alias ?tab=ppn), testid tax-tab-tax & tax-tab-efaktur dipertahankan | Diperbaiki |
| FIN-TAX-03 | tab:Tax Center | title | P1 | Hero banner gelap 'Pusat Pajak' (h2 text-2xl) = judul kedua di dalam hub; chip status 'PPh 21: OFF' dicoret & opacity 40% tidak terbaca | Banner & chip dihapus; status aktif ada di switch tiap kartu (standalone: dot status di tab) | Diperbaiki |
| FIN-TAX-08 | tab:e-Bupot | title | P1 | <h1> kedua 'e-Bupot PPh 23' (font-bold) + wrapper p-6 ganda di dalam hub; tab Export/Preview/Riwayat bertumpuk di bawah tab hub; tombol refresh ikon tanpa aria-label | Alur satu halaman: kartu Buat CSV (masa pajak → Preview → Unduh CSV + ringkasan CompactStatCard) → kartu Preview data → kartu Riwayat; PageHeader hanya standalone; tombol 'Muat ulang' berteks | Diperbaiki |
| FIN-TAX-01 | page | title | P2 | Tidak ada <h1>; h2 bespoke font-bold + breadcrumb in-page 'Tax › Tax Center' | PageHeader 'Tax & Compliance' + subtitle; breadcrumb in-page dihapus | Diperbaiki |
| FIN-TAX-04 | tab:Tax Center | card | P2 | Kartu rounded-2xl border bg-white p-6, teks text-gray-* & kotak info bg-*-50 hard-coded (rusak di dark mode); h3 text-lg font-bold | glass-card p-4, catatan info tint /10 dark-safe (InfoNote), h3 14/16px semibold, grid 1 kolom di mobile | Diperbaiki |
| FIN-TAX-05 | tab:Tax Center | a11y | P2 | ToggleSwitch custom tanpa label dan data-testid tidak diteruskan (ppn-toggle dll. tidak pernah ter-render) | Diganti Switch shadcn + Label htmlFor 'Aktif/Nonaktif'; testid {pajak}-toggle kini ter-render; ToggleSwitch/colMap/badgeColor dihapus dari constants | Diperbaiki |
| FIN-TAX-06 | tab:PPh 21 | card | P2 | Kalkulator & panel e-SPT memakai box ungu bg-purple-50, input mentah tanpa label, tile ringkasan lokal text-2xl, 'Lihat Summary/Download CSV'; tombol Hitung diam saat input kosong | glass-card p-4, Label htmlFor, CompactStatCard untuk ringkasan SPT, 'Lihat ringkasan/Unduh CSV', toast bila input kosong (juga kalkulator PPh 23/4(2)) | Diperbaiki |
| FIN-TAX-07 | tab:e-Faktur | title | P2 | h2 'e-Faktur / Coretax Export' text-2xl tampil di dalam hub; dua tombol primer (Preview & Generate Export); teks/toast Inggris ('Loading...', 'Preview loaded', 'Failed to…') | Judul hanya di standalone (PageHeader); Preview outline + ikon, 'Buat file ekspor' primer + helper saat disabled; semua toast Indonesia; Card spacing 3/4 | Diperbaiki |

## `/finance/tax-center` — Tax Center

- **File:** `frontend/src/portals/finance/TaxCenter.jsx`, `frontend/src/portals/finance/TaxCenterPkg/index.jsx`, `frontend/src/portals/finance/TaxCenterPkg/constants.js`, `frontend/src/portals/finance/TaxCenterPkg/PPh21Calculator.jsx`, `frontend/src/portals/finance/TaxCenterPkg/WithholdingComponents.jsx`
- **State diperiksa:** halaman + 3 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 8
- **Tab:** PPh 21 (nonaktif), PPh 23 (nonaktif), PPh 4(2) (nonaktif)
- **Sisa sinyal otomatis (heuristik):** 1 tombol ikon tanpa label/aria-label; Tinggi tombol non-standar: 20, 80px (standar 32/36/40); Tinggi tombol non-standar: 20px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-TXC-01 | page | ia | P2 | Duplikat: komponen yang sama dengan tab PPN–PPh 4(2) di /finance/tax (sidebar sudah memetakan ke Tax & Compliance) | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| FIN-TXC-02 | page | title | P2 | Tidak ada <h1>; hero banner gelap dipakai sebagai judul | PageHeader 'Tax Center' (testid tax-center-header dipertahankan) | Diperbaiki |
| FIN-TXC-03 | page | tabs | P2 | Tab PPN/PPh custom (border-b-0, warna colMap); ikon selalu Receipt karena bug t.Icon | Tabs unified + ikon per pajak + dot status aktif/nonaktif (sr-only teks); testid tax-center-tabs/tax-tab-* dipertahankan | Diperbaiki |
| FIN-TXC-04 | page | card | P2 | Sama seperti FIN-TAX-04/05/06 (kartu bg-white p-6, toggle tanpa label) | Diperbaiki bersama komponen TaxCenterPkg | Diperbaiki |

## `/finance/efaktur` — e-Faktur Export

- **File:** `frontend/src/portals/finance/EFakturExport.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-EFK-01 | page | title | P2 | Tidak ada <h1> (h2 text-2xl 'e-Faktur / Coretax Export') | PageHeader 'e-Faktur Export' saat standalone; tersembunyi saat embedded di hub | Diperbaiki |
| FIN-EFK-02 | page | button | P2 | Dua tombol primer berdampingan; 'Generate Export' disabled tanpa penjelasan | Lihat FIN-TAX-07 (Preview outline, helper teks) | Diperbaiki |
| FIN-EFK-03 | page | ia | P3 | Duplikat tab e-Faktur di /finance/tax | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/finance/ebupot` — e-Bupot PPh 23

- **File:** `frontend/src/portals/finance/EBupotExport.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 9 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-EBP-02 | tab:Preview Data | tabs | P2 | Hasil tombol Preview tersembunyi di tab lain ('Klik Preview di tab Export'); 3 sub-tab untuk alur linear | Sub-tab dihapus: ringkasan + tabel preview tampil langsung di bawah form, riwayat di kartu terpisah | Diperbaiki |
| FIN-EBP-03 | tab:Preview Data | a11y | P2 | Tombol refresh ikon-saja tanpa aria-label | Button sm 'Muat ulang' berteks; Label Masa Pajak terhubung (htmlFor) | Diperbaiki |
| FIN-EBP-01 | page | typography | P3 | h1 font-bold 700 bespoke + wrapper p-6 (padding ganda dengan shell) | PageHeader (semibold) + spacing standar | Diperbaiki |
| FIN-EBP-04 | page | ia | P3 | Duplikat tab e-Bupot di /finance/tax | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/finance/assets` — Fixed Assets

- **File:** `frontend/src/portals/finance/FixedAssetList.jsx`
- **State diperiksa:** halaman + 0 tab, 1 dialog
- **Temuan otomatis (crawler):** 3 → 0
- **Dialog/pop-up:** Tambah Aset Tetap (10 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-AST-07 | page | typography | P1 | Kode aset font-mono | font-medium tabular-nums | Diperbaiki |
| FIN-AST-01 | page | title | P2 | Tidak ada <h1>; h2 'Aset Tetap' tidak sama dengan nama nav 'Fixed Assets' | PageHeader 'Fixed Assets' + action 'Tambah Aset' (testid add-asset-btn) | Diperbaiki |
| FIN-AST-02 | page | card | P2 | Kartu ringkasan Card ad-hoc; Progress bar keluar dari kartu dan menimpa kartu sebelahnya | CompactStatCard ×3 dengan sub persentase; Progress dihapus (lihat shared_requests progress.jsx); testid asset-summary-*/asset-total-* dipertahankan | Diperbaiki |
| FIN-AST-03 | page | form | P2 | Dua Select filter tanpa label, melebar penuh di kartu terpisah | aria-label, lebar w-60/w-52, kartu p-3 | Diperbaiki |
| FIN-AST-05 | dialog:Tambah Aset | form | P2 | 4 field tanpa label terhubung (select kategori/metode, dll.) | Semua field Label htmlFor + id, grid 1 kolom di mobile | Diperbaiki |
| FIN-AST-04 | page | language | P3 | Status enum mentah 'active' (badge hitam) & opsi filter Inggris berbeda gaya dari portal lain | StatusPill + statusLabel (kamus global) | Diperbaiki |
| FIN-AST-06 | page | density | P3 | Empty state custom (py-12) | EmptyState shared dengan aksi 'Tambah Aset Pertama' (testid dipertahankan) dan pesan khusus saat filter aktif | Diperbaiki |

## `/finance/assets/:id` — (nama aset) — detail Fixed Asset

- **File:** `frontend/src/portals/finance/FixedAssetDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-ASD-01 | page | title | P2 | Tidak ada <h1> (h2 + tombol back ikon-saja) | Ghost '← Kembali ke Fixed Assets' + PageHeader (nama, kode, StatusPill, aksi); testid asset-detail-* dipertahankan | Diperbaiki |
| FIN-ASD-02 | page | card | P2 | 4 Card KPI ad-hoc; Progress akumulasi keluar kartu menimpa teks 'Tanggal: 2025-08-…'; 'Sisa: 5 tahun' menyesatkan (nilai = total masa manfaat) | CompactStatCard ×4 (testid nilai dipertahankan), sub 'x% dari harga perolehan', 'Masa manfaat: n tahun' | Diperbaiki |
| FIN-ASD-04 | dialog:Posting/Revaluasi/Pelepasan | form | P2 | Label tanpa htmlFor, field wajib tanpa *, kotak peringatan bg-red-50 tidak dark-safe | Label htmlFor + *, warning tint red-500/10; loading & not-found kini punya tombol kembali | Diperbaiki |
| FIN-ASD-03 | page | button | P3 | Aksi halaman size sm; label campur 'Post Depresiasi / Dispose' | Button default; 'Posting Depresiasi', 'Revaluasi', 'Lepas Aset' (destructive), dialog 'Pelepasan Aset' | Diperbaiki |

## `/finance/budget-hub` — Budget

- **File:** `frontend/src/portals/finance/BudgetHub.jsx`, `frontend/src/portals/finance/BudgetVsActual.jsx`, `frontend/src/portals/finance/BudgetManagement.jsx`, `frontend/src/portals/finance/BudgetMgmtPkg/index.jsx`, `frontend/src/portals/finance/Forecasting.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 12 → 2
- **Tab:** Budget management, Forecasting

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-BGH-01 | page | title | P2 | Tidak ada <h1>; h2 font-bold + breadcrumb in-page | PageHeader 'Budget' + subtitle | Diperbaiki |
| FIN-BGH-02 | page | tabs | P2 | Tab custom underline; tiap tab merender judul besar kedua dengan ikon ('Budget vs Actual', 'Manajemen Budget') tepat di bawah tab | Tabs unified; halaman tab dirender embedded (tanpa judul; aksi Impor/Buat Budget tetap di toolbar kanan); testid budget-tab-* dipertahankan | Diperbaiki |
| FIN-BGH-03 | tab:Budget vs Actual | flow | P2 | 'Kelola Budget' / 'Buat Budget' keluar dari hub ke /finance/budget/manage | Pindah ke tab Budget management di hub (onSwitchTab); standalone → /finance/budget-hub?tab=manage | Diperbaiki |
| FIN-BGH-04 | tab:Forecasting | layout | P2 | Segmented 'Method' menimpa 'Months Ahead' ('Hybrid' menutupi '1M') di 1280px; deskripsi metode terjepit di kolom ke-6 | Filter flex-wrap, segmented h-8 13px pill-active (aria-pressed), deskripsi metode baris penuh | Diperbaiki |
| FIN-BGH-05 | tab:Forecasting | typography | P2 | 19 teks < 11px di chart SVG (9–10px), 'today', satuan 'M' | fontSize SVG 12 (≈11px render), 'hari ini', satuan 'jt' | Diperbaiki |

## `/finance/budget` — Budget vs Actual

- **File:** `frontend/src/portals/finance/BudgetVsActual.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-BVA-01 | page | title | P2 | Tidak ada <h1> (h2 + ikon) | PageHeader 'Budget vs Actual' + aksi 'Kelola Budget' (standalone saja) | Diperbaiki |
| FIN-BVA-02 | page | card | P2 | Kartu kategori Card + Progress; 'Ringkasan P&L' card-in-card; kartu total text-2xl | CompactStatCard grid (sub 'Budget · Var %', tone sesuai varians), Ringkasan P&L jadi section h2 + grid tile, total jadi 3 CompactStatCard | Diperbaiki |
| FIN-BVA-03 | page | form | P2 | Label filter tanpa htmlFor; 'Muat Data' tombol primer padahal filter auto-load; opsi Level Inggris 'COA Only/Category Only' | Label htmlFor, tombol outline 'Muat ulang', opsi 'COA + Kategori/COA saja/Kategori saja', placeholder outlet 'Semua outlet' | Diperbaiki |
| FIN-BVA-04 | page | card | P3 | Empty state custom; warna varians text-gray-600 tanpa dark mode | EmptyState + aksi 'Buat Budget'; warna muted/dark-safe | Diperbaiki |
| FIN-BVA-05 | page | ia | P3 | Duplikat tab Budget vs Actual di /finance/budget-hub | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/finance/budget/manage` — Budget Management

- **File:** `frontend/src/portals/finance/BudgetManagement.jsx`, `frontend/src/portals/finance/BudgetMgmtPkg/index.jsx`, `frontend/src/portals/finance/BudgetMgmtPkg/constants.js`, `frontend/src/portals/finance/BudgetMgmtPkg/BudgetImportDialog.jsx`
- **State diperiksa:** halaman + 0 tab, 2 dialog
- **Temuan otomatis (crawler):** 5 → 0
- **Dialog/pop-up:** Buat Budget Baru (6 field); Buat Budget Baru (6 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-BMG-01 | page | title | P2 | Tidak ada <h1>; h2 'Manajemen Budget' tidak sama dengan nama tab/nav | PageHeader 'Budget Management' + aksi Impor/Buat (standalone); toolbar ringkas saat embedded | Diperbaiki |
| FIN-BMG-02 | page | form | P2 | 2 input filter tanpa label terhubung; 'Filter Year / Approval Status' campur bahasa | Label htmlFor 'Periode/Tahun/Scope/Status approval', 'Reset filter' ghost | Diperbaiki |
| FIN-BMG-03 | page | runtime | P2 | Badge status memakai variant 'warning'/'success' yang tidak ada di Badge → Submitted/Approved tampil hitam | StatusPill (kamus global), opsi filter statusLabel; APPROVAL_STATUS_LABELS dihapus | Diperbaiki |
| FIN-BMG-04 | dialog:Buat Budget | flow | P2 | Dialog Edit tidak memuat scope/outlet/brand → field Scope kosong dan budget tersimpan tanpa scope | openEdit kini mengisi scope, outlet_id, brand_id | Diperbaiki |
| FIN-BMG-05 | dialog:Buat Budget | form | P2 | 3 field tanpa label (Catatan, cari COA, kategori/jumlah per baris); 'Amount (Rp)'; tombol ikon size icon 36px di baris tabel | Label htmlFor + *, aria-label per baris, 'Jumlah (Rp)', Button icon-sm, 'Submit' → 'Ajukan' | Diperbaiki |
| FIN-BMG-06 | dialog:Import Excel | form | P2 | 2 field tanpa label; footer 'Tutup' ghost + 'Import' rounded-full; 'Upload/Download/Import' Inggris | Label htmlFor + *, footer 'Batal' outline + 'Impor', 'Unduh Template Excel', judul 'Impor Budget dari Excel' | Diperbaiki |
| FIN-BMG-07 | page | ia | P3 | Duplikat tab Budget management di /finance/budget-hub | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/finance/forecasting` — Forecasting

- **File:** `frontend/src/portals/finance/Forecasting.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-FC-01 | page | title | P2 | Tidak ada <h1> | PageHeader 'Forecasting' saat standalone | Diperbaiki |
| FIN-FC-02 | page | card | P2 | KpiCard/GrowthCard/AccuracyCard lokal (text-2xl, nilai 'Rp 3.224.787.000' 2 baris); kartu p-5 | CompactStatCard ×4 (tone pertumbuhan/akurasi), kartu p-4; komponen lokal dihapus | Diperbaiki |
| FIN-FC-03 | page | language | P2 | Label/grade campur ('Months Ahead', 'History (days)', 'Excellent/Volatile', 'active', 'Per-Outlet Forecast Summary'); judul 'Method Comparison (3-month…)' hard-coded walau horizon 1/6 bulan | Teks Indonesia ('Horizon', 'Histori (hari)', 'Sangat akurat/Baik/Cukup/Volatil', 'aktif'), judul perbandingan memakai horizon terpilih | Diperbaiki |
| FIN-FC-05 | page | layout | P2 | Segmented Method/Months bertumpuk (lihat FIN-BGH-04) | Diperbaiki (flex-wrap + segmented standar) | Diperbaiki |
| FIN-FC-04 | page | form | P3 | Select target terpotong 'Sales (validated d…'; select & input tanpa nama aksesibel | Label target ringkas, ariaLabel/htmlFor | Diperbaiki |
| FIN-FC-06 | page | ia | P3 | Duplikat tab Forecasting di /finance/budget-hub | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/finance/anomalies` — Anomaly Feed

- **File:** `frontend/src/portals/finance/AnomalyFeed.jsx`, `frontend/src/portals/finance/AnomalyFeed/index.jsx`, `frontend/src/portals/finance/AnomalyFeed/ThresholdSettingsDialog.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-ANM-02 | page | runtime | P1 | Sheet detail memakai <SelectItem value=""> ('Unassigned') — Radix Select melempar error saat ada daftar assignee | SimpleSelect (memetakan "" ↔ sentinel), label 'Belum ditugaskan' | Diperbaiki |
| FIN-ANM-01 | page | title | P2 | Tidak ada <h1>; header glass-card bespoke (h2 + ikon) 'Anomaly Detection Feed' + tile di dalamnya | PageHeader 'Anomaly Feed' (standalone) / baris aksi saja saat embedded di Period Closing Fase 2; tile dipisah | Diperbaiki |
| FIN-ANM-03 | page | runtime | P2 | Data memakai severity high/medium: badge 'HIGH' tampil hijau, tile Severe/Mild menghitung 0, sort severity salah | sevBucket() memetakan critical/high→severe, medium→mild untuk warna, hitungan, dan sort | Diperbaiki |
| FIN-ANM-04 | page | card | P2 | SummaryTile & ResultTile lokal (text-2xl font-bold); DetailStat tidak terpakai; fungsi exportCSV mati (import.meta.env) | CompactStatCard; SummaryTile/ResultTile/DetailStat/exportCSV dihapus | Diperbaiki |
| FIN-ANM-05 | page | flow | P2 | Link 'Suggested Next Steps' mati: /procurement/pos, /procurement/goods-receipts, /procurement/vendors/:id, /outlet/:id, /finance/journal-entries | Diganti route valid: /procurement/po, /procurement/gr, /procurement/vendors, /procurement/vendor-scorecard, /finance/reports?tab=comparatives, /finance/journals | Diperbaiki |
| FIN-ANM-06 | page | language | P2 | Status campur ('Baru' + Acknowledged/Investigating…; filter 'Open' vs badge 'BARU'); heading sheet Inggris ('What Happened', 'Key Numbers', 'Assign To', 'Will assign on next action'); sort 'Newest First'; 'Previous/Next'; tombol 'Run Scan/Reload/Export Excel/Analytics' | Status via StatusPill/statusLabel (satu kamus), teks lain Indonesia ('Jalankan Scan', 'Ekspor Excel', 'Analitik', 'Terbaru', 'Sebelumnya/Berikutnya', 'Tandai ditinjau/Selidiki/Selesaikan/Bukan anomali') | Diperbaiki |
| FIN-ANM-07 | page | a11y | P2 | Tombol threshold ikon Filter (ikon salah) tanpa aria-label; baris anomali <li onClick> tidak bisa diakses keyboard; 2 input filter tanpa label | SlidersHorizontal + aria-label, Reload jadi icon button ber-aria-label; li role=button tabIndex + Enter/Space; Label htmlFor/ariaLabel | Diperbaiki |
| FIN-ANM-08 | dialog:Threshold | tabs | P2 | Tab scope custom (bg-foreground, rounded-t); checkbox detektor di dalam header yang juga toggle expand (dua aksi satu klik); input h-8; 'modified' | Tabs unified; Checkbox + tombol expand terpisah (aria-expanded); input h-9 + htmlFor; 'diubah' | Diperbaiki |
| FIN-ANM-09 | page | button | P3 | Tombol Resolve override bg-emerald; aksi header size sm | Default variant (satu primer di footer); aksi header size default | Diperbaiki |
| FIN-ANM-10 | page | ia | P3 | Halaman sama dengan Period Closing Fase 2; dipertahankan karena deep-link ?id= dari notifikasi | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/finance/periods` — Periods

- **File:** `frontend/src/portals/finance/PeriodList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PER-07 | page | typography | P1 | Kode periode font-mono | font-semibold tabular-nums | Diperbaiki |
| FIN-PER-01 | page | title | P2 | Tidak ada <h1> (halaman langsung mulai dengan kartu filter) | PageHeader 'Periods' saat standalone; tanpa judul saat embedded di Period Closing Fase 1 | Diperbaiki |
| FIN-PER-02 | page | language | P2 | Emoji 🔒/🔐 di kolom Locked/Closed; tombol 'Refresh/Close/Lock/Reopen' & toast Inggris | Ikon lucide Lock/CheckCircle2; 'Muat ulang/Tutup/Kunci/Buka kembali'; toast Indonesia | Diperbaiki |
| FIN-PER-03 | page | button | P2 | Override rounded-full h-8/h-10; tombol Lock pill-active primer di setiap baris (12 tombol hitam); <Link> membungkus <Button> (a>button) | Button sm outline tanpa override, Button asChild untuk Wizard | Diperbaiki |
| FIN-PER-04 | dialog:Reopen | form | P2 | Dialog alasan ad-hoc, label tanpa htmlFor | Diganti promptDialog (alasan wajib, multiline) | Diperbaiki |
| FIN-PER-06 | page | ia | P2 | Duplikat: PeriodList sama persis dengan Period Closing Fase 1 (Review Periods) | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| FIN-PER-05 | page | card | P3 | Legenda status chip lokal (warna beda dari StatusPill di tabel) | Legenda memakai StatusPill | Diperbaiki |

## `/finance/period-closing` — Period Closing

- **File:** `frontend/src/portals/finance/PeriodClosingHub.jsx`, `frontend/src/portals/finance/PeriodList.jsx`, `frontend/src/portals/finance/AnomalyFeed/index.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16, 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PCH-02 | page | title | P2 | Fase 2 merender header besar 'Anomaly Detection Feed' kedua di dalam fase | AnomalyFeed & PeriodList dirender embedded (tanpa judul) | Diperbaiki |
| FIN-PCH-03 | page | flow | P2 | Placeholder Fase 3/4 mengarah ke /finance/periods (duplikat Fase 1, keluar dari hub) dengan link pill-active | EmptyState + tombol 'Ke Fase 1: Review Periods' yang membuka fase di halaman yang sama | Diperbaiki |
| FIN-PCH-05 | page | flow | P2 | Hub menimpa seluruh query string saat set ?phase → ?id= anomali (deep link) hilang | setSearchParams fungsional mempertahankan param lain; localStorage dibungkus try/catch | Diperbaiki |
| FIN-PCH-01 | page | title | P3 | h1 bespoke font-bold 700 di hero glass-card + wrapper max-w-6xl mx-auto (ruang kosong kiri-kanan) | PageHeader 'Period Closing' + progress bar sebagai children (role=progressbar); max-w dihapus | Diperbaiki |
| FIN-PCH-04 | page | button | P3 | Override rounded-full/pill-active pada Lanjut/Tandai Selesai; panah teks '←' | Button standar (Lanjut primer, Tandai Selesai outline), ikon ArrowLeft/Right | Diperbaiki |
| FIN-PCH-06 | page | card | P3 | Konten fase (kartu PeriodList/AnomalyFeed) bersarang di dalam glass-card fase (card-in-card) | Isi fase dirender datar (utilitas .nested-cards) — tidak ada lagi kartu di dalam kartu. | Diperbaiki |

## `/finance/period-closing/:period` — Closing Wizard · {period}

- **File:** `frontend/src/portals/finance/PeriodClosingWizard.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 49px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PCW-01 | page | title | P2 | Tidak ada <h1> (h2 font-bold); tombol 'Kembali' kembali ke /finance/periods | Ghost '← Kembali ke Period Closing' + PageHeader 'Closing Wizard · {period}' + StatusPill | Diperbaiki |
| FIN-PCW-02 | page | card | P2 | ProgressTile lokal di glass-card p-5; kartu p-5/p-6 (padding 12/20/24 bervariasi) | CompactStatCard ×4 (Cek OK/Peringatan/Blocker/Status), semua kartu p-4; ProgressTile dihapus | Diperbaiki |
| FIN-PCW-03 | page | button | P2 | 'Run Checks/Close Period/Lock Period/Re-check' Inggris + rounded-full/pill-active; <Link> membungkus <Button>; emoji ✅ | 'Jalankan cek/Tutup periode/Kunci periode/Cek ulang', Button asChild, emoji dihapus, langkah 'Step x of y' → 'Langkah x dari y' | Diperbaiki |
| FIN-PCW-04 | page | flow | P2 | Link JE '/finance/journal/:id' mati; fix_link backend '/procurement/prs' mati (redirect ke beranda Procurement) | Link → /finance/journals/:id; alias UI /procurement/prs → /my-approvals (perbaikan backend di shared_requests) | Diperbaiki |
| FIN-PCW-05 | dialog:Kunci/Tutup periode | form | P3 | Dialog konfirmasi + catatan ad-hoc (label tanpa htmlFor, tombol pill-active) | Diganti promptDialog (catatan opsional); tombol dinonaktifkan saat proses | Diperbaiki |

## `/finance/coa` — Chart of Accounts

- **File:** `frontend/src/portals/finance/COABrowser.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 2
- **Sisa sinyal otomatis (heuristik):** 1 tombol ikon tanpa label/aria-label; Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-COA-03 | page | typography | P1 | Kode akun font-mono (ui-monospace) | font-medium tabular-nums | Diperbaiki |
| FIN-COA-01 | page | title | P2 | Tidak ada <h1>; link 'Kelola di Admin' kecil di ujung kartu filter | PageHeader 'Chart of Accounts' + subtitle jumlah akun + aksi Button outline 'Kelola di Admin' (testid coa-edit-link) | Diperbaiki |
| FIN-COA-02 | page | form | P2 | Checkbox native 'Postable saja'; label 'Type' (Inggris) vs 'Cari COA'; input cari tanpa label terhubung | Checkbox shadcn + Label htmlFor, 'Tipe' + ariaLabel, Label htmlFor untuk pencarian | Diperbaiki |

## Catatan reviewer

Duplikat terverifikasi: /finance/tax-center = komponen TaxCenter yang sama dengan tab PPN–PPh di /finance/tax; /finance/periods = PeriodList yang sama dengan Period Closing Fase 1; /finance/anomalies = Fase 2; efaktur/ebupot/budget/budget-manage/forecasting = tab hub. Route tidak dihapus. Tax hub kini satu baris tab: ?tab=tax (PPN, default & kompatibel), pph21, pph23, pph42, efaktur, ebupot (?tab=ppn = alias). Halaman tab memakai prop embedded (BudgetVsActual/BudgetManagement/Forecasting/EFaktur/EBupot/TaxCenter/PeriodList/AnomalyFeed); standalone menampilkan PageHeader sendiri. Testid yang hilang karena dialog ad-hoc diganti promptDialog sesuai arahan lead: period-unlock-reason, period-unlock-confirm, wiz-action-dialog, wiz-action-reason, wiz-action-confirm (tidak dirujuk tour/test; host memakai prompt-dialog-input/confirm-ok). Semua testid lain dipertahankan; audit_tours 0 missing. Validasi: jsxcheck OK untuk 30 file; eslint (no-undef/jsx-no-undef/rules-of-hooks) 0 error pada salinan file; semua ikon lucide terverifikasi ada di v0.507. State yang perlu data untuk dicek ulang: e-Faktur/e-Bupot preview & riwayat (kosong), Budget Management list (tidak ada budget → hub Budget vs Actual menampilkan 'Budget: Rp 0'), sheet detail anomali dengan assignee (bug SelectItem "" kini aman). Catatan data (bukan UI): MAPE backtest 545% dan selisih total 'Forecast 3 bulan' vs 'Perbandingan metode' berasal dari backend (penjumlahan harian vs bulanan parsial).
