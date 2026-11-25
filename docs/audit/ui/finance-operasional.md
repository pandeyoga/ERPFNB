# Audit UI/UX — Finance — Operasional

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/finance` — Finance Overview

- **File:** `frontend/src/portals/finance/FinanceHome.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 2
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-HOME-03 | page | ia | P1 | ApprovalWidget menautkan ke /finance/approvals (Approval Center per portal sudah dihapus) | approvalCenterPath diarahkan ke /my-approvals | Diperbaiki |
| FIN-HOME-01 | page | title | P2 | Tidak ada <h1>. Judul 'Finance Overview' berupa h2 text-xl font-bold di dalam kartu hero glass-card p-6 | Diganti PageHeader (ikon LayoutDashboard, subtitle periode aktif). Wrapper data-testid finance-welcome dipertahankan | Diperbaiki |
| FIN-HOME-02 | page | card | P2 | Strip KPI memakai KpiCard tanpa delta/tren. Kartu Journal dan AP Exposure tidak bisa diklik | Diganti CompactStatCard dengan testId kpi-* lama. Journal → /finance/journals, AP exposure → tab AP aging di hub. Rejected DS memakai tone danger bila > 0 | Diperbaiki |
| FIN-HOME-05 | page | ia | P2 | Teks 'Period locking akan tersedia di Phase 6' sudah usang | Diganti teks bantuan dengan tautan ke /finance/period-closing | Diperbaiki |
| FIN-HOME-07 | page | runtime | P2 | KPI 'Pending validation' = 0, padahal antrian /finance/validation berisi 303 daily sales (field submitted_validations) | KPI benar (0 menunggu). Bug ada di antrean: kini default 'Menunggu validasi' dengan filter status Tervalidasi/Ditolak; tombol Validasi/Tolak hanya untuk yang menunggu; API meneruskan status & period. Finance home kini mengirim submitted_validations/rejected_count/je_this_period. | Diperbaiki |
| FIN-HOME-04 | page | language | P3 | Label quick action berbeda dari nama nav ('Validate Sales', 'Manual JE'). Tautan TB/P&L lewat route redirect. Belum ada pintasan ke Payments dan Period Closing | Label disamakan dengan nav ('Sales Validation', 'Manual Journal'). Tautan langsung ke /finance/reports?tab=…. Ditambah tile Payments dan Period Closing (grid 3 kolom) | Diperbaiki |
| FIN-HOME-06 | page | layout | P3 | space-y-6, glass-card p-5/p-6, judul section h3 uppercase | space-y-3 lg:space-y-4, kartu p-4/p-3, judul section h2 text-base md:text-lg | Diperbaiki |

## `/finance/validation` — Sales Validation

- **File:** `frontend/src/portals/finance/ValidationQueue.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-VAL-01 | page | title | P2 | Tidak ada <h1>. Judul berupa h3 'Sales Validation Queue' di kartu | PageHeader 'Sales Validation' + subtitle. Jumlah pending pindah ke pill di actions (vq-pending-count) | Diperbaiki |
| FIN-VAL-02 | page | button | P2 | Aksi baris Detail/Reject/Validate memakai override h-7, rounded-full, pill-active. Label masih English | Button size sm: Detail (ghost, asChild Link), Tolak (outline merah), Validasi (default). confirmDialog tetap dipakai (host sudah di-mount lead) | Diperbaiki |
| FIN-VAL-04 | dialog:Tolak daily sales | form | P2 | Textarea alasan tanpa label. Konfirmasi memakai pill-active, bukan destructive. Bisa dikirim kosong | Label htmlFor 'Alasan penolakan *'. Tombol variant destructive, disabled saat alasan kosong. Dialog tidak diganti promptDialog supaya testid fin-vq-reject-* tetap ada | Diperbaiki |
| FIN-VAL-03 | page | button | P3 | Pagination memakai <button> mentah 'Prev/Next' | Button outline sm 'Sebelumnya/Berikutnya' dengan ikon dan testid | Diperbaiki |

## `/finance/payments-hub` — Payments

- **File:** `frontend/src/portals/finance/FinancePaymentsHub.jsx`
- **State diperiksa:** halaman + 12 tab, 0 dialog
- **Temuan otomatis (crawler):** 31 → 7
- **Tab:** AP aging, Payments, Payment runs, Run templates, Bank reconciliation, Cash position, AR invoices, Reservation deposits, tab8, tab9, tab10, tab11
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 16px (standar 32/36/40); Tinggi tombol non-standar: 20px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PHUB-03 | tab:* | title | P1 | Halaman yang ditanam sebagai tab memunculkan judul besar kedua (AR Ledger text-2xl, h1 Deposit Reservasi, kartu judul Bank Reconciliation/Templates). Tombol 'New Payment' membungkus ke baris baru | Tiap halaman tab menerima prop `embedded`: tanpa PageHeader, hanya baris ringkas berisi deskripsi + aksi. Mode standalone tetap memakai PageHeader | Diperbaiki |
| FIN-PHUB-01 | page | title | P2 | Judul hub berupa h2 text-xl font-bold, ditambah breadcrumb lokal 'Payments › <tab>' yang dobel dengan TopNav | PageHeader 'Payments' + subtitle. Breadcrumb lokal dihapus | Diperbaiki |
| FIN-PHUB-02 | page | tabs | P2 | Tab custom <button> bergaris bawah (43px), label disingkat di mobile, tab terakhir terpotong, label Title Case campur Indonesia | Tabs/TabsList/TabsTrigger standar (testid payments-tab-<id> dan payments-hub-tabs tetap). Label sentence case: AP aging, Payments, Payment runs, Run templates, Bank reconciliation, Cash position, AR invoices, Reservation deposits | Diperbaiki |
| FIN-PHUB-04 | page | ia | P2 | /finance/cash-position ada di matchPaths Payments tetapi tidak punya tab/tautan di Finance | Ditambah tab 'Cash position' (?tab=cash-position) | Diperbaiki |
| FIN-PHUB-05 | page | ia | P2 | Tour 'Payments Hub' menunjuk tab payments-tab-payment-requests yang sudah tidak ada | Diselesaikan di komponen bersama — contexts/tour/tours/finance.js | Diperbaiki (komponen shared) |

## `/finance/payments` — Payments

- **File:** `frontend/src/portals/finance/PaymentList.jsx`
- **State diperiksa:** halaman + 7 tab, 0 dialog
- **Temuan otomatis (crawler):** 27 → 0
- **Tab:** Draft, Awaiting, Submitted, Approved, Paid, Rejected, Cancelled

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PAY-01 | page | title | P2 | Halaman standalone tanpa judul | PageHeader 'Payments' dengan aksi 'Buat Payment' (pay-new-btn). Mode embedded memakai baris ringkas | Diperbaiki |
| FIN-PAY-02 | page | card | P2 | Tile lokal KpiTile | Diganti CompactStatCard. testid pay-kpi-* dan *-value tetap. KpiTile dihapus | Diperbaiki |
| FIN-PAY-03 | tab:status | tabs | P2 | Filter status berupa <button> rounded-full 28px. Label 'All' tidak konsisten dengan 'Semua' | Tabs pill standar (testid pay-tab-*). 'All' → 'Semua' | Diperbaiki |
| FIN-PAY-04 | page | button | P2 | 'New Payment' memakai h-10 rounded-full bg-foreground dan membungkus ke baris kedua. Kolom search tanpa label | Pindah ke PageHeader actions dengan Button default. Search diberi aria-label | Diperbaiki |
| FIN-PAY-05 | page | flow | P2 | Tombol empty state tidak pernah tampil (props actionLabel/onAction tidak didukung EmptyState) | EmptyState `action` diisi Button 'Buat Payment' | Diperbaiki |
| FIN-PAY-06 | page | language | P3 | Link baris 'View' masih English | Button ghost sm 'Lihat detail'. Doc No tetap font-mono (konvensi yang diterima) | Diperbaiki |

## `/finance/payments/new` — New Payment

- **File:** `frontend/src/portals/finance/PaymentForm.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 44px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PAYNEW-01 | form | title | P2 | Tidak ada <h1>. Judul h2 'New Payment Request' (nama modul lama) | PageHeader 'New Payment' + subtitle. Kartu form p-4 (max-w-4xl) | Diperbaiki |
| FIN-PAYNEW-02 | form | form | P2 | 6+ kontrol tanpa label terhubung. Ada override h-10. Label 11px uppercase. Field wajib tidak ditandai | Field htmlFor/id untuk semua kontrol. h-10 dihapus. Label text-xs md:text-sm. Tanda * di field wajib | Diperbaiki |
| FIN-PAYNEW-03 | form | button | P2 | Tombol 'Save as Draft' / 'Save & Submit for Approval' / 'Cancel' berbahasa Inggris dan rounded-full | Footer: Batal (ghost, ke hub), 'Simpan draft' (outline), 'Simpan & ajukan approval' (primary) | Diperbaiki |
| FIN-PAYNEW-04 | form | card | P2 | Section PPh memakai warna terang hard-coded (bg-white, amber-50, gray-50), rusak di dark mode. Toggle tanpa aria-expanded | Diganti token transparan dengan varian dark. Ditambah aria-expanded dan testid pay-wh-toggle | Diperbaiki |

## `/finance/payments/:id` — Payment detail (PAY-…)

- **File:** `frontend/src/portals/finance/PaymentDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PAYDET-01 | page | title | P2 | Tidak ada <h1>. Doc no berupa h2 | Tombol ghost '← Kembali ke Payments' (ke tab hub) + PageHeader (doc no, meta, StatusPill) | Diperbaiki |
| FIN-PAYDET-02 | page | card | P2 | Kartu 'Actions' tampil kosong saat status paid/rejected | Kartu aksi hanya dirender bila ada aksi | Diperbaiki |
| FIN-PAYDET-03 | page | button | P2 | Tombol aksi rounded-full dengan warna custom. Label English | Button standar dengan label 'Ajukan approval', 'Setujui', 'Tolak', 'Tandai dibayar', 'Batalkan PAY'. Toast diterjemahkan | Diperbaiki |
| FIN-PAYDET-04 | dialog:Tolak/Tandai dibayar/Batalkan | form | P2 | Label tidak terhubung. Select h-10. Konfirmasi destruktif memakai bg-red-600 manual | Label htmlFor + tanda *. ariaLabel di SimpleSelect. Konfirmasi memakai variant destructive | Diperbaiki |
| FIN-PAYDET-05 | page | flow | P3 | Tautan GR/JE memakai <a href> (reload halaman). State not-found hanya teks 'Not found' | <Link>. EmptyState + tombol kembali | Diperbaiki |

## `/finance/payment-runs` — Payment Runs

- **File:** `frontend/src/portals/finance/PaymentRunList.jsx`
- **State diperiksa:** halaman + 4 tab, 0 dialog
- **Temuan otomatis (crawler):** 13 → 0
- **Tab:** Draft, Confirmed, Posted, Cancelled

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PRN-01 | page | title | P2 | Halaman standalone tanpa judul | PageHeader 'Payment Runs' dengan aksi Templates + 'Buat Payment Run'. Mode embedded memakai baris ringkas | Diperbaiki |
| FIN-PRN-02 | page | card | P2 | Tile lokal KpiTile. Tile 'Posted' dan 'Total bulan ini' menampilkan nominal yang sama | CompactStatCard: Posted = jumlah run, Total dibayar = nominal. testid tetap. KpiTile dihapus | Diperbaiki |
| FIN-PRN-03 | tab:status | tabs | P2 | Filter status berupa <button> rounded-full. Tombol toolbar rounded-full | Tabs pill standar (prn-tab-*). Tombol pindah ke header | Diperbaiki |
| FIN-PRN-05 | page | typography | P2 | Status mentah lowercase di badge lokal. Teks '1 items'. Aksi baris berupa <button> mentah. Tombol empty state tidak muncul | StatusPill. '1 PAY'. Button ghost sm 'Lihat detail'. EmptyState action | Diperbaiki |
| FIN-PRN-06 | dialog:Buat Payment Run | form | P2 | Label tanpa htmlFor. Search dan checkbox tanpa label | htmlFor/id + aria-label | Diperbaiki |
| FIN-PRN-04 | page | ia | P3 | Tombol 'Templates' di dalam hub membuka halaman standalone (keluar dari hub) | Mode embedded → /finance/payments-hub?tab=run-templates | Diperbaiki |

## `/finance/payment-runs/:id` — Payment run detail (PRN-…)

- **File:** `frontend/src/portals/finance/PaymentRunDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PRNDET-01 | page | title | P2 | Tidak ada <h1>. Doc no berupa h2 dengan badge status lokal. Tombol back hanya ikon | Ghost 'Kembali ke Payment Runs' (ke tab hub) + PageHeader (doc no, tanggal/bank, StatusPill, aksi Batalkan/Konfirmasi/Eksekusi) | Diperbaiki |
| FIN-PRNDET-02 | page | card | P2 | Tile lokal SummaryCard | CompactStatCard (testid prn-* tetap). SummaryCard dihapus | Diperbaiki |
| FIN-PRNDET-03 | page | button | P2 | Status payment mentah lowercase. Tautan JE memakai <a href>. Tombol Eksekusi hijau custom. Kartu p-5 | StatusPill, <Link>, Button standar, kartu p-4. Toast diterjemahkan | Diperbaiki |
| FIN-PRNDET-04 | page | runtime | P3 | 'Daftar Payment (0)', padahal pay_count = 1 (payments[] kosong dari API) | Bukan bug aplikasi: PRN-2610-0002 adalah data uji yang tertinggal dari skrip intent_audit (pay_count tanpa dokumen payment). | Tidak perlu perubahan |

## `/finance/payment-run-templates` — Payment Run Templates

- **File:** `frontend/src/portals/finance/PaymentRunTemplateList.jsx`
- **State diperiksa:** halaman + 0 tab, 2 dialog
- **Temuan otomatis (crawler):** 3 → 0
- **Dialog/pop-up:** Buat Template Baru (5 field); Buat Template Baru (5 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-TPL-01 | page | title | P2 | Tidak ada <h1>. Judul hanya h2 kecil di kartu toolbar | PageHeader + 'Buat Template' di actions. Mode embedded memakai baris ringkas | Diperbaiki |
| FIN-TPL-02 | page | flow | P2 | Tombol 'Buat Template Pertama' di empty state tidak muncul | EmptyState `action` Button | Diperbaiki |
| FIN-TPL-03 | page | button | P2 | Kartu template p-5. Override h-8 text-xs. Tombol ikon tanpa aria-label | Kartu p-4, Button size sm/icon-sm + aria-label | Diperbaiki |
| FIN-TPL-04 | dialog:Buat Template | form | P2 | 2 field tanpa label terhubung | htmlFor/id/ariaLabel. Konfirmasi hapus memakai destructive-foreground | Diperbaiki |

## `/finance/payment-run-templates/:id` — Payment run template detail

- **File:** `frontend/src/portals/finance/PaymentRunTemplateDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 2
- **Sisa sinyal otomatis (heuristik):** Tidak ada judul halaman (<h1>) di area konten

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-TPLDET-01 | page | flow | P1 | Template 404 hanya menampilkan teks di tengah, tanpa judul dan tanpa jalan kembali | EmptyState + tombol 'Kembali ke Run Templates' | Diperbaiki |
| FIN-TPLDET-02 | page | title | P2 | Nama template berupa h2 font-bold. Back hanya ikon | Ghost back + PageHeader (Apply Template di actions, chip jadwal/bank) | Diperbaiki |
| FIN-TPLDET-03 | page | card | P2 | Tile lokal SummaryCard. Empty items custom. Aksi item berupa <button> tanpa aria-label | CompactStatCard, EmptyState, Button icon-sm + aria-label | Diperbaiki |
| FIN-TPLDET-04 | dialog:Tambah Item / Apply | form | P2 | Label tanpa htmlFor. Override h-9/rounded-lg/px-3 pada select | htmlFor/id/ariaLabel. Override dihapus | Diperbaiki |

## `/finance/payment-requests/:id` — Payment detail (redirect)

- **File:** `frontend/src/portals/finance/PaymentDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-PREQ-01 | page | ia | P3 | Route ini redirect ke /finance/payments/:id, jadi semua perbaikan PaymentDetail berlaku di sini. PaymentRequestList/Form/Detail.jsx tidak pernah di-import (dead code), tetapi testid-nya masih dipakai tour 'finance-payment-requests' | File PaymentRequest* mati dihapus; tour diselaraskan ke Payments (UX-G-38/39). | Diperbaiki |

## `/finance/journals` — Journals

- **File:** `frontend/src/portals/finance/JournalList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-JE-01 | page | title | P2 | Tidak ada judul. Tombol 'Manual JE'/'Excel' bercampur dengan filter | PageHeader 'Journals' dengan aksi 'Ekspor Excel' + 'Buat Manual Journal'. Filter jadi grid 4 kolom | Diperbaiki |
| FIN-JE-02 | page | button | P2 | <Button> di dalam <Link> (bersarang). Override rounded-full h-10 pill-active. Pagination berupa <button> mentah | Button asChild Link (je-new). Pagination Button outline sm | Diperbaiki |
| FIN-JE-03 | page | form | P2 | Label Source/Outlet htmlFor ke id yang tidak ada. Input h-10 | ariaLabel di SimpleSelect. h-10 dihapus | Diperbaiki |
| FIN-JE-04 | page | language | P3 | Label sumber hasil capitalize mentah ('Ar Invoice') | Map label sumber (AR Invoice, Payment, Payment Run, …) | Diperbaiki |

## `/finance/journals/:id` — Journal detail (JAE-…)

- **File:** `frontend/src/portals/finance/JournalDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-JEDET-01 | page | title | P2 | Judul h2 'JE JAE-…' (awalan dobel). Tombol Kembali rounded-full. Wrapper max-w-5xl | Ghost 'Kembali ke Journals' + PageHeader (StatusPill, Reverse JE di actions). max-w dihapus. Kartu p-4 | Diperbaiki |
| FIN-JEDET-02 | page | flow | P2 | Jika gagal load, skeleton tampil selamanya | State not-found + tombol kembali | Diperbaiki |
| FIN-JEDET-03 | dialog:Reverse Journal Entry | form | P2 | Textarea alasan tanpa label. Tombol pill-active bisa diklik saat kosong | Label 'Alasan reversal *'. Tombol destructive, disabled saat kosong | Diperbaiki |
| FIN-JEDET-04 | page | density | P3 | Kolom Dim menampilkan potongan UUID | Kolom 'Dimensi' menampilkan nama Outlet/Brand/Vendor/Karyawan (API detail jurnal memperkaya dimensi). | Diperbaiki |

## `/finance/manual-journal` — Manual Journal

- **File:** `frontend/src/portals/finance/ManualJournalForm.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-MJE-01 | form | title | P2 | Judul h2 bespoke + 'Kembali' (navigate(-1)) rounded-full. 'Post JE' memakai pill-active | PageHeader dengan aksi InlineHelp, Batal (outline, mje-back), 'Posting jurnal' | Diperbaiki |
| FIN-MJE-02 | form | form | P2 | 9 input baris tanpa label. Label header tanpa htmlFor | aria-label per kontrol baris. Label htmlFor + tanda * | Diperbaiki |
| FIN-MJE-03 | form | a11y | P2 | Tombol hapus baris berupa <button> ikon tanpa aria-label | Button ghost icon-sm + aria-label. Tombol 'Tambah baris' | Diperbaiki |
| FIN-MJE-04 | form | language | P3 | AI Journal Generator memakai emoji '💡'. Label tidak terhubung ke textarea | Diselesaikan di komponen bersama — components/finance/AIJournalGenerator.jsx | Diperbaiki (komponen shared) |

## `/finance/ar-invoices` — AR Invoices

- **File:** `frontend/src/portals/finance/ARInvoiceList/index.jsx`, `frontend/src/portals/finance/ARInvoiceDialogs/index.jsx`
- **State diperiksa:** halaman + 3 tab, 2 dialog
- **Temuan otomatis (crawler):** 14 → 1
- **Tab:** Customers, Aging report, Reconciliation
- **Dialog/pop-up:** Tambah Customer AR Baru (8 field); Buat Invoice AR Baru (18 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-AR-01 | page | title | P1 | Judul bespoke h2 text-2xl 'AR Ledger' (beda dengan nama tab) dan tampil sebagai judul kedua di dalam hub | PageHeader 'AR Invoices' saat standalone, baris ringkas saat embedded | Diperbaiki |
| FIN-AR-02 | page | card | P2 | KPI dan bucket aging berupa Card custom | Diganti CompactStatCard | Diperbaiki |
| FIN-AR-03 | tab:Invoices | density | P2 | 7 tombol ikon h-7 per baris membuat kolom sempit dan teks terlipat 2–3 baris. Tombol write-off tanpa aria-label | Inline: Detail, Kirim, Catat pembayaran. Sisanya pindah ke DropdownMenu 'Aksi lain' (testid tetap). Ukuran icon-sm | Diperbaiki |
| FIN-AR-04 | tab:Invoices | typography | P2 | Badge status lokal (STATUS_MAP) di daftar dan dialog detail | Diganti StatusPill. Opsi filter memakai statusLabel() | Diperbaiki |
| FIN-AR-05 | tab:Invoices | form | P2 | Filter tanpa label. Refresh ikon tanpa aria-label. Empty state custom | aria-label, Button icon, EmptyState + action | Diperbaiki |
| FIN-AR-07 | tab:Reconciliation | form | P2 | Input periode tanpa label terhubung. mb-6. Label tab campur bahasa | htmlFor, mb-3, tab 'Reconciliation' | Diperbaiki |
| FIN-AR-08 | dialog:Invoice Baru / Customer Baru | form | P2 | 13 dan 4 field tanpa label terhubung. Input baris h-7 | 37 label dihubungkan (htmlFor/id). aria-label pada input baris. h-7 dihapus. Tanda * merah | Diperbaiki |
| FIN-AR-06 | tab:Aging report | typography | P3 | 8 ukuran font berbeda. Total text-2xl. Tombol 'Refresh' | h2/total text-xl, 'Muat ulang' | Diperbaiki |
| FIN-AR-09 | dialog:Write Off Piutang | card | P3 | Banner bg-red-50 tidak cocok untuk dark mode | Diganti token red-500/10 dengan varian dark | Diperbaiki |

## `/finance/bank-recon` — Bank Reconciliation

- **File:** `frontend/src/portals/finance/BankRecon.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-BR-01 | page | title | P2 | Tidak ada <h1>. Judul hanya div text-lg di kartu | PageHeader + 'Unggah Statement' di actions. Mode embedded memakai baris ringkas. Detail standalone tetap punya h1 | Diperbaiki |
| FIN-BR-02 | page | flow | P2 | Tombol empty state tidak muncul. Detail gagal load menampilkan layar kosong | EmptyState action. State not-found + tombol kembali | Diperbaiki |
| FIN-BR-03 | dialog:Upload Statement | form | P2 | 4 field tanpa label terhubung. Select h-10 | htmlFor/id/ariaLabel, tanda *, label diterjemahkan | Diperbaiki |
| FIN-BR-04 | page | card | P2 | Tile lokal KpiTile + panel summary yang mengulang angka. Ikon aksi baris tanpa aria-label | CompactStatCard dengan nominal sebagai sub. Panel duplikat dihapus. icon-sm + aria-label | Diperbaiki |
| FIN-BR-05 | dialog:Pilih kandidat match | tabs | P3 | Filter tipe berupa <button> rounded-full. Input nominal mentah tanpa label | Tabs pill, Input + aria-label, tombol clear berlabel | Diperbaiki |

## `/finance/cash-position` — Cash Position

- **File:** `frontend/src/portals/finance/CashPosition.jsx`
- **State diperiksa:** halaman + 2 tab, 1 dialog
- **Temuan otomatis (crawler):** 4 → 6
- **Tab:** 60 hari, 90 hari
- **Dialog/pop-up:** Tambah Akun Cash (8 field)
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 20px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-CASH-01 | page | title | P2 | Tidak ada <h1> (juga di /owner/cash) | PageHeader generik 'Cash Position' + aksi Muat ulang/Unggah CSV/Akun Baru. Mode embedded (tab hub) tanpa h1 | Diperbaiki |
| FIN-CASH-02 | page | card | P2 | KpiCard tanpa delta dengan color='success/danger' (token tidak ada) | CompactStatCard dengan tone dan token aurora yang valid | Diperbaiki |
| FIN-CASH-03 | page | ia | P2 | Baris akun clickable sekaligus berisi tombol 'Update saldo' yang tersembunyi sampai di-hover | Tombol riwayat eksplisit (aria-label) dan 'Update saldo' selalu terlihat. Baris tidak lagi clickable | Diperbaiki |
| FIN-CASH-05 | dialog:Akun Baru / Upload CSV | form | P2 | Field tanpa label terhubung. Label English. Field 'Opening Balance' dan 'Saldo Awal' duplikat | Diselesaikan di komponen bersama — UpdateBalanceModal.jsx & CashCsvUploader.jsx | Diperbaiki (komponen shared) |
| FIN-CASH-04 | page | tabs | P3 | Toggle 30d/60d/90d berupa Button biasa. ReferenceLine memakai --danger yang tidak ada. space-y-6/p-5 | Tabs pill '30/60/90 hari'. ReferenceLine memakai --destructive. Spacing standar | Diperbaiki |

## `/finance/reservation-deposits` — Reservation Deposits

- **File:** `frontend/src/portals/finance/ReservationDeposits.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-DEP-01 | page | title | P1 | h1 bespoke text-2xl font-bold + wrapper p-6. Di dalam hub tampil sebagai h1 kedua | PageHeader 'Reservation Deposits' saat standalone, hanya deskripsi saat embedded | Diperbaiki |
| FIN-DEP-02 | page | card | P2 | Kartu ringkasan custom | CompactStatCard (testid deposits-card-*) | Diperbaiki |
| FIN-DEP-03 | page | a11y | P2 | Refresh ikon dan select periode tanpa label. Warna gray hard-coded | aria-label, token muted, EmptyState | Diperbaiki |

## `/finance/ap-aging` — AP Aging

- **File:** `frontend/src/portals/finance/APAging.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-AP-01 | page | title | P2 | Halaman standalone tanpa judul | PageHeader 'AP Aging'. Label tab hub disamakan menjadi 'AP aging' | Diperbaiki |
| FIN-AP-02 | page | card | P2 | Kartu 'AP Aging Buckets' kosong. BucketCard memakai kelas dinamis text-${accent}-700 | Kartu kosong dihapus (InlineHelp pindah ke toolbar). CompactStatCard + tone (testid tetap) | Diperbaiki |
| FIN-AP-03 | page | button | P2 | Tombol rounded-full h-10 dengan label campur bahasa. 'As of' tanpa label | Button outline 'Ekspor CSV'/'Ekspor Excel'. Label htmlFor 'Per tanggal' | Diperbaiki |

## `/finance/vendor-scorecard` — Vendor Scorecard

- **File:** `frontend/src/portals/finance/VendorScorecard.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| FIN-VSC-02 | page | runtime | P1 | Kolom peringkat (#) memakai urutan API sehingga tidak cocok dengan urutan tabel: baris teratas tertulis #6 | Rank dihitung dari composite score menurun | Diperbaiki |
| FIN-VSC-01 | page | title | P2 | Tidak ada judul. Tombol CSV rounded-full h-10 | PageHeader + 'Ekspor CSV' di actions. Filter berlabel | Diperbaiki |
| FIN-VSC-03 | page | card | P2 | Tile lokal SummaryCard dan Metric | Diganti CompactStatCard (Metric memakai size sm) | Diperbaiki |
| FIN-VSC-04 | page | ia | P2 | Halaman tidak bisa dicapai dari UI dan menduplikasi /procurement/vendor-scorecard | Dipertahankan sebagai halaman detail AP yang dibuka dari Procurement › Vendor Scorecard; kini mendukung ?vendor_id=. | Diperbaiki |

## Catatan reviewer

Laporan ini MENGGANTIKAN laporan sebelumnya. Sudah disesuaikan dengan pesan lead: (5) font-mono untuk kode dokumen dikembalikan di semua kolom Doc No/Invoice No; yang dihapus hanya font-mono pada nominal/teks biasa. (6) Status map lokal AR (STATUS_MAP/StatusBadge) diganti StatusPill + statusLabel(); Payment Runs juga memakai StatusPill. (1) confirmDialog tetap dipakai apa adanya. (2) Tidak ada window.prompt di file saya. Dialog alasan yang sudah ada dipertahankan (sekarang berlabel + destructive) agar testid tetap ada. (7) Dua permintaan shared lama (breadcrumb TopNav dan default ApprovalWidget) sudah dihapus karena sudah diperbaiki lead. Pola hub: halaman yang ditanam di /finance/payments-hub menerima prop `embedded`, sehingga hub hanya punya satu <h1>; saat standalone (termasuk /owner/cash) halaman memakai PageHeader sendiri. Tab baru 'Cash position' ditambahkan. Tombol kembali di halaman detail mengarah ke tab hub. Semua data-testid lama dipertahankan, termasuk *-value. audit_tours = 0 missing, semua file lolos jsxcheck, tidak ada import tak terpakai. Data yang perlu dicek: KPI Pending validation = 0 padahal antrian berisi 303; PRN-2610-0002 punya pay_count 1 tetapi payments[] kosong. PaymentRequest*.jsx tidak di-route (dead code).
