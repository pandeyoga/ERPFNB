# Audit UI/UX — Executive & Owner

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/executive` — Overview

- **File:** `frontend/src/portals/executive/OwnerHome/index.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-OV-02 | page | ia | P1 | Link 'Lihat semua' di panel Persetujuan, tile KPI 'Pending Approval', shortcut 'Approvals' dan fallback ApprovalRow masih ke /executive/approvals (sudah dihapus, sekarang redirect) | Semua link sekarang langsung ke /my-approvals | Diperbaiki |
| EXE-OV-03 | page | runtime | P1 | Panel 'Performa Outlet' menampilkan Rp 0 untuk semua outlet. Kode membaca o.revenue, padahal /executive/home → summary.top_outlets[] memakai field 'total' | Pakai o.revenue ?? o.total. Baris sekarang jadi link ke /executive/outlet/:id | Diperbaiki |
| EXE-OV-01 | page | title | P2 | Judulnya banner sapaan besar (h1 bold 700, 'Selamat sore, Owner 👋', p-6 rounded-2xl) dan tidak sama dengan nama nav 'Overview' | Diganti PageHeader 'Overview' (ikon Crown + InlineHelp). Sapaan + tanggal dipindah ke subtitle, emoji dihapus | Diperbaiki |
| EXE-OV-04 | page | density | P2 | 6 KPI dalam 1 baris (lg:grid-cols-6) membuat nilai terpotong ('Rp 5…', 'Rp 2…'). Subteks 'vs kemarin' muncul tanpa angka pembanding | KpiTile lokal dihapus, diganti CompactStatCard langsung (testIdPrefix owner-kpi) dengan grid 2/3 kolom gap-3. Subteks diganti 'Daily sales tervalidasi' | Diperbaiki |
| EXE-OV-06 | page | button | P2 | Tombol 'Semua/Lihat semua/Detail' berupa <Button> di dalam <Link> (elemen interaktif bersarang) dengan override h-7 text-xs. 'Refresh' dan 'Full Analytics' dalam bahasa Inggris dan tidak sesuai nama nav | Button ghost sm asChild + Link. Label jadi 'Muat ulang' dan 'Sales Analytics' (testid dipertahankan) | Diperbaiki |
| EXE-OV-07 | page | ia | P2 | Shortcut Profit Walk / Period Compare / Brand Mix membuka halaman standalone, padahal di nav ketiganya adalah tab Performance Analytics | Link diarahkan ke /executive/analytics-hub?tab=… | Diperbaiki |
| EXE-OV-08 | page | ia | P2 | Dashboard duplikat. KPI Revenue hari ini/WTD/MTD + AP Exposure dan daftar top outlet juga ada di /executive/analytics. Ringkasan approval + anomali juga ada di /owner. 'Akses Cepat' (16 tile) menduplikasi sidebar | tidak diperbaiki: keputusan IA (lihat notes). Shortcut dipertahankan karena jadi target tour 'owner-shortcuts', tapi diringkas | Terbuka |
| EXE-OV-05 | page | card | P3 | Panel lokal memakai rounded-2xl border shadow-sm px-5 py-4. ShortcutCard tinggi p-4 rounded-2xl. Pembungkus halaman p-4 md:p-6 max-w-screen-xl mx-auto + space-y-6 menyisakan ruang kosong di sisi | Panel → glass-card dengan header px-4 dan judul h3 text-sm/base. Shortcut jadi tile ringkas (ikon + label, p-2.5, 8 kolom). max-w/padding dihapus, spasi jadi space-y-3 lg:space-y-4 | Diperbaiki |

## `/executive/analytics` — Sales Analytics

- **File:** `frontend/src/portals/executive/ExecutiveHome.jsx`
- **State diperiksa:** halaman + 9 tab, 0 dialog
- **Temuan otomatis (crawler):** 8 → 10
- **Tab:** 7d, 14d, 30d, 60d, 14d, 30d, 14d, 30d, Transaksi
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 24, 44, 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-SA-01 | page | title | P2 | h1 kustom 'Executive Dashboard' (text-3xl bold) tidak sesuai nama nav 'Sales Analytics' | PageHeader 'Sales Analytics' (wrapper data-testid=executive-header dipertahankan) | Diperbaiki |
| EXE-SA-02 | page | layout | P2 | Panel AI (ConversationalQA) diletakkan paling atas di atas filter. Saat dibuka tingginya 460px (~57% viewport) | Panel dipindah ke bawah KPI; tinggi mode terbuka 340px / maks 45vh (ConversationalQA). | Diperbaiki |
| EXE-SA-03 | page | button | P2 | Tombol filterbar memakai override rounded-full h-9 glass-input. Link Profit Walk/Period Compare berupa <Button> di dalam <Link>. Label campur bahasa ('Live Off', 'Export PDF', 'Exporting…'). Reset filter berupa <button> mentah | Live & Ekspor PDF dipindah ke actions PageHeader (variant standar, aria-pressed). Profit Walk/Period Compare → Button outline asChild ke tab hub. Reset → Button ghost sm. Label diganti 'Live aktif/mati', 'Ekspor PDF', 'Mengekspor…' | Diperbaiki |
| EXE-SA-04 | page | card | P2 | KpiCard dipakai tanpa delta/tren. Tile 'Buka P&L' adalah Link kustom berbeda gaya. Klik tile memakai window.location.assign (full reload) | Diganti CompactStatCard (testIdPrefix kpi, testid exec-pl-link). Navigasi pakai navigate(). Subteks diterjemahkan | Diperbaiki |
| EXE-SA-05 | page | tabs | P3 | Rentang Sales Trend 7d/14d/30d/60d berupa <button> mentah px-3 py-1 text-xs | Diganti Tabs standar (testid exec-range-* dipertahankan) | Diperbaiki |
| EXE-SA-06 | page | layout | P3 | max-w-7xl mx-auto, mb-5/mb-6, gap-5, glass-card p-5, h3 tanpa ukuran. Teks izin 'Cash Position requires permission.' dalam bahasa Inggris | space-y-3 lg:space-y-4, gap-3 lg:gap-4, p-4, h3 text-sm/base. Teks izin diterjemahkan | Diperbaiki |
| EXE-SA-07 | page | runtime | P3 | pageerror 'Error parsing CSS component value' (kemungkinan dari html2canvas/komponen widget shared) | tidak diperbaiki: bukan dari kode halaman ini | Terbuka |

## `/executive/brand/:brandId` — Brand drilldown (nama brand)

- **File:** `frontend/src/portals/executive/BrandDrilldown.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 9 → 1
- **Tab:** Cost structure, Trends
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 85px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-BD-02 | page | flow | P2 | Tombol kembali berlabel 'Dashboard' selalu ke /executive (Overview), padahal user biasanya datang dari Brand Mix/Sales Analytics | 'Kembali' → navigate(-1), fallback ke /executive/analytics-hub?tab=brand | Diperbaiki |
| EXE-BD-03 | tab:Outlets | tabs | P2 | TabsList dioverride glass-card p-1 mb-4. Isi tab p-5. Baris outlet glass-input di dalam glass-card (card-in-card) | Override TabsList dihapus. TabsContent p-4. Baris jadi border tipis, tidak lagi kartu bersarang | Diperbaiki |
| EXE-BD-05 | tab:Cost Structure | tabs | P2 | Saat tab aktif di-hover, teksnya hilang (gelap di atas pill gelap). Juga terlihat di tab Trends | Sudah diperbaiki global oleh lead di components/ui/tabs.jsx | Diperbaiki |
| EXE-BD-07 | page | runtime | P2 | Data tidak konsisten. GP% brand The Coffeeshop 95.9% (COGS Rp 7.282.000), sedangkan drilldown outletnya (1 outlet, revenue sama) GP 65.1% (COGS Rp 62.487.000) | tidak diperbaiki: kalkulasi backend | Terbuka |
| EXE-BD-01 | page | title | P3 | Header kustom h1 bold 700 + ikon + tombol rounded-full glass-input | PageHeader (judul = nama brand + chip kode). Actions: 'Kembali' (ghost) + PeriodPicker | Diperbaiki |
| EXE-BD-04 | page | card | P3 | KpiCard dipakai tanpa delta | Diganti CompactStatCard (testIdPrefix kpi) | Diperbaiki |
| EXE-BD-06 | page | ia | P3 | Breadcrumb TopNav hanya 'Beranda › Executive' | Sudah diperbaiki global oleh lead (matchPaths) | Diperbaiki |

## `/executive/outlet/:outletId` — Outlet drilldown (nama outlet)

- **File:** `frontend/src/portals/executive/OutletDrilldown.jsx`
- **State diperiksa:** halaman + 3 tab, 0 dialog
- **Temuan otomatis (crawler):** 11 → 2
- **Tab:** P&L, Inventory, Staff
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-OD-02 | tab:Daily Ops | card | P2 | 6 kotak glass-input di dalam glass-card (card-in-card), angka bold dengan format berbeda-beda | Diganti grid CompactStatCard (sm). KDO/BDO pending bisa diklik ke /outlet/kdo dan /outlet/bdo. Tren 30 hari dalam glass-card p-4. Status daily sales tetap memakai StatusPill | Diperbaiki |
| EXE-OD-03 | tab:Inventory | card | P2 | KpiCard di dalam glass-card p-5 (card-in-card), juga di tab Staff | TabsContent tanpa kartu pembungkus, tile CompactStatCard langsung + link di bawah | Diperbaiki |
| EXE-OD-04 | page | tabs | P2 | TabsList dioverride glass-card p-1 mb-4 flex-wrap. Teks tab aktif hilang saat di-hover (P&L, Inventory, Staff) | Override dihapus. Bug hover sudah diperbaiki global oleh lead di tabs.jsx | Diperbaiki |
| EXE-OD-01 | page | title | P3 | Header kustom h1 bold + tombol 'Kembali' rounded-full glass-input | PageHeader (nama + kode, subtitle brand·alamat·jam). Actions: Kembali (ghost, fallback ke /executive/analytics) + PeriodPicker | Diperbaiki |
| EXE-OD-05 | tab:P&L | typography | P3 | font-bold di baris P&L | Diganti font-semibold, p-4 | Diperbaiki |

## `/executive/profit-walk` — Profit Walk

- **File:** `frontend/src/portals/executive/ProfitWalk.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-PW-01 | page | title | P2 | Tidak ada <h1>. Judul berupa h2 bold di dalam kartu kontrol p-5 | Mode standalone: PageHeader 'Profit Walk' dengan select + 'Muat ulang' di actions. Mode embedded (tab hub): toolbar glass-card p-3 tanpa h1. testid profit-walk-controls dipertahankan | Diperbaiki |
| EXE-PW-04 | page | typography | P2 | Label nilai/sumbu WaterfallChart 10px (14 teks <11px) | Diselesaikan di komponen bersama — components/shared/charts/WaterfallChart.jsx | Diperbaiki (komponen shared) |
| EXE-PW-02 | page | form | P3 | Select pembanding terpotong ('Last Month (LMTI…'). Select tanpa label | Lebar jadi 180px + aria-label 'Periode' / 'Periode pembanding' | Diperbaiki |
| EXE-PW-03 | page | layout | P3 | space-y-6, gap-4, p-5, h3 tanpa ukuran, 'Refresh', toast 'Gagal load' | space-y-3/4, gap-3, p-4, h3 text-sm/base. Label 'Muat ulang', toast diterjemahkan | Diperbaiki |
| EXE-PW-05 | page | ia | P3 | Halaman standalone menduplikasi tab di /executive/analytics-hub | Link internal diarahkan ke tab hub. Route tetap ada (tour). Breadcrumb sudah diperbaiki global | Diperbaiki |

## `/executive/period-compare` — Period Compare

- **File:** `frontend/src/portals/executive/PeriodCompare.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-PC-01 | page | title | P2 | Tidak ada <h1>. h2 bold 'Period Comparison' di dalam kartu kontrol, subtitle campur bahasa ('multi-metric across') | Standalone: PageHeader 'Period Compare' + 'Muat ulang'. Embedded: subtitle + tombol di kartu kontrol. Teks dan label 'Metrik/Periode' diterjemahkan | Diperbaiki |
| EXE-PC-02 | page | a11y | P2 | 12 checkbox (tombol Radix) tanpa aria-label. Chip text-xs py-1 | aria-label per checkbox. Chip h-8 text-[13px]. testid period-checkbox-* baru | Diperbaiki |
| EXE-PC-03 | page | layout | P3 | mb-5 di dalam space-y-6 (spasi ganda), p-5, tabel di dalam glass-card p-5 overflow-x-auto, warna delta tanpa varian dark | Spasi standar, p-4, tabel di glass-card overflow-hidden, ditambah dark:text-* | Diperbaiki |

## `/executive/reservations` — Reservations

- **File:** `frontend/src/portals/executive/ReservationSummary.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-RS-01 | page | title | P2 | h1 kustom 'Ringkasan Reservasi' bold, tidak sesuai nav 'Reservations'. Wrapper p-6 | PageHeader 'Reservations', padding wrapper dihapus | Diperbaiki |
| EXE-RS-02 | page | a11y | P2 | Tombol refresh hanya ikon tanpa aria-label. 2 input tanggal dengan <label> tidak terhubung | Tombol 'Muat ulang' (ikon + teks) di actions. Label htmlFor + id, filter dalam glass-card p-3 | Diperbaiki |
| EXE-RS-03 | page | card | P2 | Kartu KPI lokal (text-3xl bold, center), warna hard-coded gray-*, map warna status lokal | Diganti CompactStatCard dengan tone. Status breakdown memakai StatusPill (label Indonesia lewat prop label), map warna lokal dihapus. gray-* → token muted, plus LoadingState/EmptyState | Diperbaiki |

## `/executive/budget-approvals` — Budget Approvals

- **File:** `frontend/src/portals/executive/BudgetApprovals.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 1 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-BA-01 | page | title | P2 | Tidak ada <h1> (h2 text-2xl kustom) | PageHeader 'Budget Approvals' | Diperbaiki |
| EXE-BA-02 | page | language | P2 | Tombol/toast/kolom campur bahasa: Approve/Reject/Lock, 'Submitted By/At', 'Approved At', 'di-approve/di-lock' | Setujui/Tolak/Kunci, 'Diajukan oleh', 'Tgl diajukan/disetujui', toast dalam Bahasa Indonesia. Tolak jadi outline (aksi sekunder), Setujui primary | Diperbaiki |
| EXE-BA-03 | dialog:Tolak Budget | form | P2 | Dialog alasan penolakan buatan lokal: label tidak terhubung, Batal varian ghost | Dialog lokal dihapus, diganti promptDialog global (label, wajib diisi, destructive, 'Tolak Budget'). Konfirmasi Setujui/Kunci tetap memakai confirmDialog (host sudah di-mount lead) | Diperbaiki |
| EXE-BA-04 | page | density | P3 | Empty state kustom py-12 | Diganti EmptyState shared (testid budget-approvals-empty dipertahankan) | Diperbaiki |

## `/executive/outlet-budgets` — Budget Allocation

- **File:** `frontend/src/portals/executive/OutletBudgetAllocation.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 10 → 3
- **Tab:** Mingguan, Bulanan
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 28px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-AL-02 | form | form | P1 | Input matrix KDO/FDO/BDO terlalu sempit sehingga nominal terpotong (110.000.000 tampil '11000', 3.000.000 tampil '30000(') dan rawan salah input. 20 input tanpa label | Lebar input 132px + aria-label 'Budget KDO <outlet>' dst. Total per baris whitespace-nowrap | Diperbaiki |
| EXE-AL-01 | page | title | P2 | Tidak ada <h1>. Judul 'Outlet Operational Budget' tidak sesuai nav 'Budget Allocation' | PageHeader 'Budget Allocation'. Tombol '{n} permintaan menunggu' dan 'Budget Monitor' di actions | Diperbaiki |
| EXE-AL-03 | page | card | P2 | SummaryCard lokal (text-xl bold berwarna) di dalam kartu 'Mode Budget' (card-in-card). Kartu 'Periode Budget' punya header besar yang boros ruang | SummaryCard dihapus, diganti baris CompactStatCard. Periode jadi toolbar glass-card p-3 (Tabs periode + navigasi + Salin + Simpan). Tombol bulk-mode pindah ke header kartu Matrix | Diperbaiki |
| EXE-AL-04 | form | button | P2 | Toggle mode per baris berupa button text-[11px] dengan ikon, menumpuk 2 baris ('Per-\nBucket'), aktif bg-foreground. Tombol Simpan override pill-active | Segmented h-7 px-2.5 text-[13px] nowrap, aktif pill-active, aria-pressed (testid mode-* dipertahankan). Override pill-active pada Simpan dihapus | Diperbaiki |

## `/executive/budget-monitor` — Budget Monitor

- **File:** `frontend/src/portals/executive/OutletBudgetMonitor.jsx`
- **State diperiksa:** halaman + 3 tab, 0 dialog
- **Temuan otomatis (crawler):** 19 → 0
- **Tab:** Stacked bar, Pace, Detail

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-BM-01 | page | title | P2 | Tidak ada <h1> (h2 kustom) | PageHeader 'Budget Monitor', action 'Budget Allocation' (dulu 'Set Budget') | Diperbaiki |
| EXE-BM-02 | page | tabs | P2 | Dua baris tab bertumpuk (Mingguan/Bulanan di kartu + Heatmap/Stacked/Pace/Detail) | Tipe periode jadi Select (aria-label, testid monitor-period-type) di toolbar glass-card p-3 bersama navigasi periode + 'Muat ulang'. Tinggal satu baris tab | Diperbaiki |
| EXE-BM-03 | page | card | P2 | KpiBox lokal ('Rp\n590.000.000' turun baris, ruang kosong besar) | Diganti CompactStatCard sm dengan ikon + tone, KpiBox dihapus | Diperbaiki |
| EXE-BM-06 | tab:Mingguan | tabs | P2 | Teks tab aktif hilang saat di-hover | Sudah diperbaiki global oleh lead di components/ui/tabs.jsx | Diperbaiki |
| EXE-BM-04 | tab:Stacked Bar | typography | P3 | Sumbu/legend chart memakai ukuran default (besar), tinggi 400px. Icon tab dioverride h-4 mr-1 | tick/legend 12px, tinggi 340px, override ikon tab dihapus, TabsContent mt-4 dihapus | Diperbaiki |
| EXE-BM-05 | tab:Pace | ia | P3 | LineChart menghubungkan outlet (kategori) dengan garis, menyesatkan. Lebih cocok bar chart ideal vs aktual | tidak diperbaiki: perubahan visualisasi, perlu keputusan produk | Terbuka |

## `/executive/budget-increase-requests` — Increase Requests

- **File:** `frontend/src/portals/executive/BudgetIncreaseRequests.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 7 → 0
- **Tab:** Disetujui, Ditolak

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-IR-02 | page | button | P1 | Tombol Approve/Reject full-width (flex-1, pill-active + destructive merah besar) dan berbahasa Inggris di samping tab berbahasa Indonesia | Tombol size sm rata kanan: 'Tolak' (outline) + 'Setujui' (primary). testid btn-approve/reject dipertahankan | Diperbaiki |
| EXE-IR-01 | page | title | P2 | Judul h2 'Request Penambahan Budget' tidak sesuai nav 'Increase Requests', tidak ada <h1> | PageHeader 'Increase Requests', actions 'Muat ulang' + 'Budget Allocation' | Diperbaiki |
| EXE-IR-03 | tab:Disetujui | language | P2 | Empty state memakai kode status mentah ('status "approved"'). Riwayat 'Approved:/Rejected:/Approved amount'. Badge status lokal | EmptyState 'Tidak ada request berstatus Disetujui/Ditolak/Menunggu'. Teks riwayat diterjemahkan, loading pakai LoadingState. Badge lokal → StatusPill (label disamakan dengan tab) | Diperbaiki |
| EXE-IR-04 | dialog:Setujui/Tolak Request | form | P2 | Judul/tombol 'Approve Request/Reject', label 'Approved Amount (Rp)', 'Catatan (wajib)' tanpa tanda *, override pill-active | 'Setujui Request'/'Tolak Request', 'Jumlah disetujui (Rp) *', 'Alasan penolakan *'. Tolak memakai variant destructive, override dihapus. Dialog gabungan dipertahankan (bukan promptDialog) karena menampilkan konteks request + input jumlah | Diperbaiki |
| EXE-IR-05 | tab:Disetujui | tabs | P2 | Teks tab aktif hilang saat di-hover/fokus (screenshot Disetujui/Ditolak) | Sudah diperbaiki global oleh lead di tabs.jsx. Override ikon tab (h-4 mr-1) di halaman sudah dihapus | Diperbaiki |

## `/executive/ai-qa` — Executive Q&A

- **File:** `frontend/src/portals/executive/ExecutiveQA.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-QA-02 | form | a11y | P2 | Input pertanyaan tanpa label. Tombol Tanya override rounded-full pill-active h-10. Reset ghost tanpa state | aria-label pada input. Button standar. 'Mulai ulang' (outline, disabled bila belum ada chat, testid qa-reset). 'Sources' → 'Sumber' | Diperbaiki |
| EXE-QA-03 | page | ia | P2 | Ada 3 UI Q&A AI: halaman ini (/executive/qa), ConversationalQA di Sales Analytics, dan /owner/ai-assistant (/ai/exec-qa) | tidak diperbaiki: perlu penyatuan komponen/endpoint (lihat notes) | Terbuka |
| EXE-QA-01 | page | layout | P3 | max-w-4xl mx-auto membuat judul tidak sejajar dengan halaman lain | max-w dihapus. Tinggi chat calc(100vh-140px) min 420px | Diperbaiki |

## `/executive/anomaly` — Anomaly Detection

- **File:** `frontend/src/portals/executive/AnomalyDetection.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-AN-01 | page | form | P1 | 4 filter SimpleSelect melebar full-width dan bertumpuk vertikal (className menimpa tanpa lebar), tanpa label | Lebar tetap (160–200px) dalam satu baris + ariaLabel | Diperbaiki |
| EXE-AN-02 | page | runtime | P2 | Severity 'severe' dari backend tidak dihitung (Total 8 tetapi jumlah tile 7) dan badge SEVERE berwarna biru seperti 'low' | Ditambah normSeverity: severe diperlakukan sebagai critical untuk hitungan & warna. Tile 'Critical / Severe', opsi filter 'Severe' ditambah | Diperbaiki |
| EXE-AN-03 | page | card | P2 | Tile hitungan lokal (text-2xl bold) | Diganti CompactStatCard sm dengan ikon + tone | Diperbaiki |
| EXE-AN-04 | page | button | P2 | 'Run Scan' override rounded-full h-10 pill-active, label Inggris 'Scanning...' | Button standar 'Jalankan Scan'/'Memindai…'. max-w-6xl dihapus, baris list px-4 py-3 | Diperbaiki |

## `/executive/brand` — Brand Mix

- **File:** `frontend/src/portals/executive/BrandMixOverview.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 146px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-BX-01 | page | runtime | P1 | Halaman selalu kosong ('Belum ada data brand', Rp 0), padahal donut Sales Analytics berisi data. API /executive/brand-mix mengembalikan rows[] dengan total/trx/share_pct, kode membaca brands/items + revenue/transaction_count | Membaca rows (fallback brands/items), revenue ?? net_sales ?? total, trx, share_pct | Diperbaiki |
| EXE-BX-02 | page | flow | P2 | Tombol sort Revenue/GP% tidak berfungsi (grid memakai brands, bukan sortedBrands). Data tidak punya GP%, jadi bar GP% selalu 0 | Grid memakai sortedBrands. Sort (Tabs) dan seri GP% hanya tampil bila data gp_pct ada. Warna brand stabil | Diperbaiki |
| EXE-BX-03 | page | card | P3 | Kpi lokal, kartu brand p-5 font-bold, max-w-6xl, select h-10 glass-input | CompactStatCard, kartu p-4 semibold, max-w dihapus, select 130px + aria-label | Diperbaiki |

## `/executive/analytics-hub` — Performance Analytics

- **File:** `frontend/src/portals/executive/ExecutiveAnalyticsHub.jsx`, `frontend/src/portals/executive/BrandMixOverview.jsx`, `frontend/src/portals/executive/ProfitWalk.jsx`, `frontend/src/portals/executive/PeriodCompare.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 12 → 2
- **Tab:** Profit Walk, Period Compare
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 146px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| EXE-PA-03 | tab:Brand Mix | runtime | P1 | Brand Mix kosong karena mismatch field API (lihat EXE-BX-01) | Diperbaiki di BrandMixOverview | Diperbaiki |
| EXE-PA-01 | page | title | P2 | Hub memakai h2 bold, lalu tab Brand Mix merender h1 'Brand Mix' (h1 halaman jadi nama tab), sedangkan tab Profit Walk/Period Compare tanpa h1 | PageHeader 'Performance Analytics'. Komponen tab menerima prop embedded (tanpa h1, pakai toolbar/subtitle) | Diperbaiki |
| EXE-PA-02 | page | tabs | P2 | Tab kustom bergaris bawah (border-b-2, py-2, tinggi 43px). Ada breadcrumb in-page 'Analytics › Brand Mix' di kanan | Diganti Tabs/TabsList/TabsTrigger/TabsContent standar (testid exec-analytics-tab-* dipertahankan). Breadcrumb in-page dihapus | Diperbaiki |
| EXE-PA-04 | tab:Period Compare | runtime | P3 | Chart Visual Overview tampak kosong saat screenshot (kemungkinan animasi recharts belum selesai; versi standalone tampil normal) | tidak diperbaiki: tidak bisa direproduksi tanpa server | Terbuka |

## `/owner` — Overview

- **File:** `frontend/src/portals/owner/OwnerCockpit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OWN-OV-02 | page | runtime | P1 | Widget Approval Pending tidak menampilkan judul dokumen (kode membaca it.describe, API /approvals/queue mengirim title/current_step_label). Cuti ditampilkan 'Rp 0' padahal satuannya hari | itemTitle() = title \|\| describe \|\| doc_no. Step label dari current_step_label. Nilai tampil '{days_count} hari' bila tanpa amount | Diperbaiki |
| OWN-OV-03 | page | ia | P1 | Link 'Buka semua' dan 'Buka Inbox' ke /owner/approvals (sudah dihapus) | Diarahkan ke /my-approvals | Diperbaiki |
| OWN-OV-01 | page | title | P2 | Tidak ada <h1>. Banner sapaan p-6 lg:p-8 grad (h2 bold + emoji) dipakai sebagai judul | PageHeader 'Overview' (wrapper testid owner-welcome dipertahankan). Sapaan + tanggal di subtitle. Aksi: 'AI Daily Briefing', 'Muat ulang', 'Kirim Digest' | Diperbaiki |
| OWN-OV-04 | page | ia | P2 | Kartu 'Pending Approvals' di Insights & Actions menampilkan 0 ('Semua approval sudah selesai'), padahal widget di atasnya berisi 5 item (duplikat + kontradiktif) | Kartu duplikat dihapus (seksi Approval Pending selalu tampil di preset yang punya bottomRow). Bottom row jadi Anomali + Business Q&A | Diperbaiki |
| OWN-OV-05 | page | button | P2 | Approve emerald min-h-[40px] berbahasa Inggris. Reject tombol ikon tanpa aria-label yang langsung menolak tanpa konfirmasi, dengan alasan hard-coded 'Owner reject from cockpit'. <Button> di dalam <Link>. Emoji ✨ di copy | 'Setujui' size sm. Reject icon-sm + aria-label, sekarang meminta alasan via promptDialog (destructive) sebelum dikirim. Button asChild + Link, emoji dihapus, EmptyState shared | Diperbaiki |
| OWN-OV-06 | page | card | P2 | KpiCard tanpa delta dengan color 'danger/warning/success' (CSS var tidak ada → ikon tanpa warna). Klik memakai window.location.assign. Kartu p-5, gap-5, space-y-6 | CompactStatCard (testid owner-kpi-*, warna aurora + tone), navigate(). p-4, gap-3/4, space-y-3/4. 'Digest Preview' memakai tabular-nums, bukan mono | Diperbaiki |
| OWN-OV-07 | page | runtime | P3 | Digest Preview menampilkan '0 txn' untuk semua outlet (field transactions kosong dari API), sementara briefing menampilkan 192 trx | Jumlah trx hanya ditampilkan bila > 0. Data backend perlu dicek | Terbuka |
| OWN-OV-08 | page | button | P3 | DashboardPresetSelector memakai Button h-7 text-xs (5 tombol ikon tanpa label menurut crawler) | Diselesaikan di komponen bersama — DashboardPresetSelector.jsx | Diperbaiki (komponen shared) |

## `/owner/cockpit` — Overview (duplikat /owner)

- **File:** `frontend/src/portals/owner/OwnerPortal.jsx`, `frontend/src/portals/owner/OwnerCockpit.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OWN-CK-01 | page | ia | P2 | Route duplikat: /owner (index) dan /owner/cockpit merender komponen yang sama. Index TIDAK di-gate, cockpit di-gate owner.cockpit.access (RBAC tidak konsisten) | Diperbaiki terpusat: /owner = Owner Cockpit (di-gate owner.cockpit.access), /owner/cockpit → redirect (UX-G-40). | Diperbaiki |
| OWN-CK-02 | page | title | P2 | Temuan sama dengan /owner (tanpa h1, link approvals mati, dll.) | Diperbaiki lewat OwnerCockpit.jsx (lihat OWN-OV-*) | Diperbaiki |

## `/owner/briefing` — AI Daily Briefing

- **File:** `frontend/src/portals/owner/DailyBriefing.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 2

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OWN-BR-01 | page | title | P2 | Tidak ada <h1>. Hero rounded-3xl p-8 gradient indigo/amber hard-coded (text-3xl) dipakai sebagai judul | PageHeader 'AI Daily Briefing' (tanggal + info AI di subtitle, aksi Putar Suara + ikon muat ulang dengan aria-label). Narasi dalam glass-card p-4 kompak (h2 sapaan). testid briefing-hero/briefing-text dipertahankan | Diperbaiki |
| OWN-BR-02 | page | card | P2 | StatTile lokal (text-2xl, bg-white/70, hover translate) dengan nilai turun baris ('Rp\n64.528.000'). Warna slate/white hard-coded tidak mendukung dark mode | StatTile dihapus, diganti KpiCard (delta + deltaLabel) dengan grid 2/4 kolom. slate/white → token tema | Diperbaiki |
| OWN-BR-03 | page | button | P2 | Baris Tindakan Prioritas adalah <Link> yang berisi <Button> (target klik ganda). Kartu Top Performer/Perlu Perhatian p-5 bg-emerald-50/rose-50 besar | Label aksi jadi span (satu target klik). Kartu outlet glass-card p-4 dengan aksen border-l | Diperbaiki |
| OWN-BR-04 | page | language | P3 | Emoji di heading (⚡ 📊) dan empty state (🎉). Footer 'Auto-refresh setiap 5 menit' padahal interval 10 menit. 'No briefing data' berbahasa Inggris. Kolom 'vs Week-ago' | Emoji → ikon lucide, footer '10 menit', EmptyState Indonesia + tombol Muat ulang, kolom 'Minggu lalu' | Diperbaiki |

## `/owner/cash` — Cash Position

- **File:** `frontend/src/portals/finance/CashPosition.jsx`
- **State diperiksa:** halaman + 2 tab, 1 dialog
- **Temuan otomatis (crawler):** 4 → 6
- **Tab:** 60 hari, 90 hari
- **Dialog/pop-up:** Tambah Akun Cash (8 field)
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 20px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OWN-CA-03 | dialog:Akun Baru | form | P1 | Field duplikat 'Opening Balance' dan 'Saldo Awal'. 4 field tanpa label terhubung, field wajib tidak bertanda * | Diselesaikan di komponen bersama — hapus salah satu field, Label htmlFor, tanda * | Diperbaiki (komponen shared) |
| OWN-CA-01 | page | title | P2 | Tidak ada <h1>/PageHeader. Halaman langsung dibuka dengan strip KPI. Aksi Refresh/Upload CSV/Akun Baru ada di tengah halaman ('Akun Likuid') | Diselesaikan di komponen bersama — PageHeader 'Cash Position' + aksi di actions | Diperbaiki (komponen shared) |
| OWN-CA-04 | dialog:Upload CSV | language | P2 | Input file native ('Choose File / No file chosen') di dalam dropzone. Tombol 'Download Template'/'Upload & Apply' berbahasa Inggris | Diselesaikan di komponen bersama — pakai FileDropZone, 'Unduh Template'/'Unggah & Terapkan' | Diperbaiki (komponen shared) |
| OWN-CA-02 | page | typography | P3 | Nominal akun turun baris ('Rp\n4.280.000'). Tombol 30d/60d/90d berupa tombol kustom, bukan Tabs | Diselesaikan di komponen bersama — whitespace-nowrap + Tabs | Diperbaiki (komponen shared) |

## `/owner/ai-assistant` — Business Q&A

- **File:** `frontend/src/portals/owner/OwnerPortal.jsx`, `frontend/src/components/shared/ConversationalQA.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 2
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 30px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OWN-AI-01 | page | title | P2 | Tidak ada <h1>. ConversationalQA (sudah glass-card p-5) dibungkus lagi glass-card p-5 (card-in-card) | Komponen OwnerBusinessQA di OwnerPortal: PageHeader 'Business Q&A' + ConversationalQA tanpa pembungkus | Diperbaiki |
| OWN-AI-02 | form | a11y | P2 | Input chat tanpa label. Tombol 'refresh' (huruf kecil, Inggris) tingginya 17px. Header internal 'Asisten AI Owner' jadi redundan dengan PageHeader | Diselesaikan di komponen bersama — ConversationalQA (aria-label, 'Muat ulang', prop hideHeader) | Diperbaiki (komponen shared) |
| OWN-AI-03 | page | runtime | P2 | Crawler mencatat 403 POST /api/ai/exec-qa untuk Super Admin saat chip saran diklik | Bukan bug: 403 berasal dari proxy statis crawler (cek CSRF same-origin); endpoint mengembalikan 200 lewat bearer token. | Tidak perlu perubahan |

## `/owner/digest-settings` — Alert Settings

- **File:** `frontend/src/portals/owner/DigestSettings.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OWN-DG-01 | page | title | P2 | Tidak ada <h1>. Kartu header h3 'Daily Digest Subscriptions' tidak sesuai nav 'Alert Settings' | PageHeader 'Alert Settings' (wrapper testid digest-header). Preview Digest + Kirim Sekarang dipindah ke actions | Diperbaiki |
| OWN-DG-02 | page | ia | P2 | Urutan kurang tepat: konfigurasi bot (admin) dan panduan Telegram muncul sebelum daftar subscription. Form 'Tambah Subscription' terpisah di kartu lain | Urutan baru: Subscription Aktif + Tambah (satu kartu), Preview, Panduan Telegram, lalu Telegram Bot Configuration. Teks panduan ('di atas/di bawah') disesuaikan | Diperbaiki |
| OWN-DG-03 | form | form | P2 | Label 'Channel'/'Target' tanpa htmlFor, tanpa tanda wajib. Tombol Batal setelah Simpan | Label htmlFor + id + '*', jadi <form> submit. Urutan Batal (outline) lalu Simpan | Diperbaiki |
| OWN-DG-04 | page | language | P3 | Badge 'Active/Paused', tombol 'Pause/Resume', 'Configured', 'Last sent'. Tombol hapus ikon tanpa aria-label. Error kirim/jeda/hapus tidak ditangani | 'Aktif/Dijeda', 'Jeda/Lanjutkan', 'Terkonfigurasi', 'Terakhir dikirim'. icon-sm + aria-label. Ditambah catch + toast error. Hapus tetap memakai confirmDialog (host sudah di-mount lead) | Diperbaiki |

## Catatan reviewer

Laporan ini menggantikan laporan saya sebelumnya. Isinya sudah disesuaikan dengan perbaikan global lead: - Bug hover tab dan breadcrumb/matchPaths sekarang berstatus fixed oleh lead, dan permintaan untuk tabs.jsx/TopNav dihapus dari shared_requests. - confirmDialog tetap dipakai apa adanya. Tombol Setujui/Kunci di Budget Approvals dan Hapus di Alert Settings bergantung pada host yang sekarang sudah di-mount. - promptDialog sekarang dipakai untuk alasan penolakan di BudgetApprovals (dialog lokal dihapus; testid reject-dialog/reject-reason-input/confirm-reject-btn masih ada di file lain dan tidak dipakai tour) dan untuk reject cepat di OwnerCockpit, yang sebelumnya menolak langsung dengan alasan hard-coded. - StatusPill dipakai di Increase Requests dan Reservations (label Indonesia lewat prop label agar sama dengan tab).  Verifikasi: - Semua file yang saya ubah (20 file di portals/executive/** dan portals/owner/**) lolos jsxcheck dan eslint no-undef/rules-of-hooks (0 error). - audit_tours.py: 0 missing, 0 route drift. - Saya tidak build, tidak commit, dan tidak mengedit file di luar kepemilikan saya.  Bug UI yang diperbaiki berdasarkan bentuk respons API: (a) Brand Mix kosong karena API mengirim rows/total/trx, bukan brands/revenue. (b) 'Performa Outlet' di Overview Rp 0 karena field top_outlets bernama total. (c) Widget approval di cockpit kehilangan judul karena field-nya title, bukan describe. (d) Severity 'severe' tidak terhitung di Anomaly Detection. (e) Input matrix Budget Allocation terlalu sempit sehingga nominal terpotong.  Dashboard duplikat (perlu keputusan IA): (1) /executive (Overview) dan /executive/analytics (Sales Analytics) sama-sama punya KPI revenue hari ini/WTD/MTD + AP Exposure dan top outlet. Saran: Overview jadi pusat aksi, Sales Analytics untuk analisis. (2) /executive (OwnerHome) dan /owner (OwnerCockpit) adalah dua 'landing owner' dengan sapaan, KPI, approval dan anomali. Saran: digabung atau dibedakan tegas (Owner = cash/digest/briefing; Executive = operasional/budget). Widget CashPosition muncul di /owner dan /executive/analytics. (3) 'Akses Cepat' 16 tile di /executive menduplikasi sidebar; dipertahankan karena target tour owner-shortcuts. (4) /executive/brand, /profit-walk, /period-compare adalah halaman standalone yang menduplikasi tab hub. Link internal sudah ke hub; route tetap ada karena tour. (5) Ada tiga UI Q&A AI dengan dua endpoint berbeda. (6) /owner dan /owner/cockpit duplikat, dengan gate RBAC yang berbeda (OWN-CK-01).  Temuan data/backend (belum diperbaiki): - GP% brand drilldown 95.9% vs outlet drilldown 65.1% untuk outlet/periode yang sama. - Digest yesterday_by_outlet.transactions = 0. - Anomali 24 jam di cockpit = 0, sementara anomali aktif di Overview = 12. - 403 POST /api/ai/exec-qa untuk Super Admin.  Perlu dicek saat re-crawl — testid baru: qa-reset, monitor-period-type, period-checkbox-*, owner-top-outlet-*, cockpit-*, digest-*, increase-*, anomaly-count-*. Testid KPI di halaman yang memakai KpiCard tetap kpi-<label> (CompactStatCard dengan testIdPrefix='kpi'). Di cockpit, tile kini owner-kpi-cash/-revenue/-ap/-anomalies.
