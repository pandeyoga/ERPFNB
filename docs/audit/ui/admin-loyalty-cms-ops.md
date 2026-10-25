# Audit UI/UX — Admin — Loyalty, CMS, Monitoring

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/admin/loyalty` — Loyalty Program

- **File:** `frontend/src/portals/admin/loyalty/LoyaltyHub.jsx`, `frontend/src/portals/admin/loyalty/LoyaltyAdminHome.jsx`
- **State diperiksa:** halaman + 4 tab, 0 dialog
- **Temuan otomatis (crawler):** 19 → 2
- **Tab:** Customers, Rewards catalog, Redemptions, CRM analytics
- **Sisa sinyal otomatis (heuristik):** 3 baris tab bertumpuk dalam satu layar

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LOY-HUB-01 | page | title | P2 | Judul hub berupa h2 'Loyalty Program' text-xl font-bold (tidak ada <h1>) plus breadcrumb mini di dalam halaman 'Loyalty › …' yang menduplikasi breadcrumb TopNav | Diganti PageHeader (ikon Star, judul 'Loyalty Program', subtitle). Breadcrumb di dalam halaman dihapus | Diperbaiki |
| LOY-HUB-02 | page | tabs | P2 | Baris tab buatan sendiri (button border-b-2, tinggi 43px, label pendek terpisah untuk mobile) | Diganti Tabs/TabsList/TabsTrigger terpadu (testid loyalty-hub-tabs/loyalty-tab-* tetap ada), label sentence case: Overview, Customers, Rewards catalog, Redemptions, CRM analytics | Diperbaiki |
| LOY-HUB-03 | tab:Overview | card | P2 | StatCard lokal (text-3xl font-bold, ikon gradient) dipakai untuk 4 KPI | Diganti CompactStatCard (grid-cols-2 md:grid-cols-4 gap-3), komponen StatCard lokal dihapus | Diperbaiki |
| LOY-HUB-04 | tab:Overview | ia | P2 | Kartu 'Navigasi Cepat' membuka route terpisah /admin/loyalty/customers\|rewards\|redemptions (keluar dari hub, tab hilang); juga pola <Link><Button> (elemen interaktif bersarang) | Link diarahkan ke tab hub (/admin/loyalty?tab=…), memakai Button asChild + Link (testid link-admin-loyalty-* tetap). Padding p-5 -> p-4, judul jadi h3 | Diperbaiki |
| LOY-HUB-05 | tab:Overview | language | P3 | State error memakai tombol 'Coba Lagi' dan kartu p-8; skeleton 8 kotak untuk 4 KPI | Tombol 'Muat ulang', padding p-4, skeleton disamakan dengan 4 tile | Diperbaiki |
| LOY-HUB-06 | tab:CRM Analytics | tabs | P3 | Dua baris tab bertumpuk (tab hub + sub-tab CRM analytics) | tidak diperbaiki: sub-tab CRM (7 tampilan) memang view berbeda; kedua baris kini memakai gaya Tabs terpadu yang sama | Terbuka |

## `/admin/loyalty/customers` — Customers

- **File:** `frontend/src/portals/admin/loyalty/LoyaltyAdminCustomers.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LOY-CUS-01 | page | title | P2 | Route mandiri tanpa judul halaman (<h1>), langsung kartu filter | Tambah prop embedded: saat route mandiri render PageHeader 'Customers'; saat di dalam hub tidak ada judul kedua | Diperbaiki |
| LOY-CUS-02 | page | form | P2 | Input cari dan select Tier/Status memakai override h-10 dan tidak punya label | Override h-10 dihapus (h-9 default), ditambah aria-label 'Cari customer', 'Filter tier', 'Filter status' | Diperbaiki |
| LOY-CUS-03 | page | a11y | P2 | Tombol ikon aktifkan/nonaktifkan customer tanpa aria-label; 'Detail' berupa <Link><Button> bersarang | Tombol jadi size icon-sm + aria-label; Detail memakai Button asChild + Link (testid view-customer-* dipindah ke anchor) | Diperbaiki |
| LOY-CUS-04 | page | ia | P3 | Route ini duplikat tab Customers di /admin/loyalty | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| LOY-CUS-05 | page | button | P3 | Tinggi tombol 20px berasal dari tombol sort header DataTable | Diselesaikan di komponen bersama — DataTable | Diperbaiki (komponen shared) |

## `/admin/loyalty/customers/:customerId` — Detail Customer (nama customer)

- **File:** `frontend/src/portals/admin/loyalty/LoyaltyAdminCustomerDetail.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 8 → 0
- **Tab:** Transaksi (26), Redemption (0)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LOY-CDT-01 | page | title | P2 | Tidak ada <h1>: nama customer berupa h2 berdampingan dengan tombol Kembali, dan tombol Kembali mengarah ke route mandiri (bukan hub) | Satu tombol ghost '← Kembali ke Customers' (ke /admin/loyalty?tab=customers) + PageHeader (judul = nama, subtitle = email, badge tier/status sebagai children, aksi 'Sesuaikan Poin') | Diperbaiki |
| LOY-CDT-02 | page | card | P2 | 4 kartu statistik buatan sendiri (Card p-4 text-2xl font-bold) | Diganti CompactStatCard dengan ikon; testid stat-* dan customer-total-points/lifetime/tx/redemption-count dipertahankan | Diperbaiki |
| LOY-CDT-03 | form | form | P2 | 4 input profil (Nama, Email, Telepon, Tanggal Lahir) tanpa label terhubung | Label htmlFor + id untuk semua field; gap form gap-3 | Diperbaiki |
| LOY-CDT-06 | tab:Transaksi (26) | tabs | P2 | Label tab aktif tidak terlihat saat di-hover (teks hitam di pill hitam) | Diselesaikan di komponen bersama — components/ui/tabs.jsx, sudah diperbaiki lead | Diperbaiki (komponen shared) |
| LOY-CDT-04 | dialog:Adjust Poin | language | P3 | Label tombol/dialog campur bahasa ('Adjust Poin'); field wajib tanpa tanda *; label tidak terhubung | Jadi 'Sesuaikan Poin' / 'Sesuaikan Poin Customer', field Jumlah & Deskripsi diberi * dan htmlFor, grup Tambah/Kurangi diberi role=group | Diperbaiki |
| LOY-CDT-05 | tab:Transaksi / Redemption | density | P3 | Empty state p-10 teks polos; TabsContent memakai override mt-4; kode voucher memakai font-mono | Pakai EmptyState ringkas (Belum ada transaksi/redemption), override mt-4 dihapus, kode voucher jadi Inter font-medium tabular-nums | Diperbaiki |

## `/admin/loyalty/rewards` — Rewards Catalog

- **File:** `frontend/src/portals/admin/loyalty/LoyaltyAdminRewards/index.jsx`
- **State diperiksa:** halaman + 0 tab, 2 dialog
- **Temuan otomatis (crawler):** 6 → 0
- **Dialog/pop-up:** Reward Baru (7 field); Edit Reward (7 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LOY-RWD-01 | page | title | P2 | Route mandiri tanpa <h1> | Prop embedded: route mandiri render PageHeader 'Rewards Catalog' dengan aksi 'Reward Baru'; di hub tombol tetap di toolbar | Diperbaiki |
| LOY-RWD-02 | page | card | P2 | SummaryCard lokal untuk 4 ringkasan | Diganti CompactStatCard (Stok Rendah tone warning bila >0); komponen SummaryCard dihapus | Diperbaiki |
| LOY-RWD-03 | page | a11y | P2 | Tombol refresh, restock dan toggle aktif ikon-saja tanpa aria-label; override h-8/h-9/text-xs/px-2 | size icon/icon-sm + aria-label ('Muat ulang', 'Tambah stok', 'Nonaktifkan reward'); override dihapus; input cari/select diberi aria-label | Diperbaiki |
| LOY-RWD-04 | dialog:Reward Baru / Edit | form | P2 | 4 field tanpa label terhubung; tab URL/Upload File berupa button custom; tombol hapus gambar ikon tanpa label | Label htmlFor+id di semua field (Poin diberi *), tab sumber gambar memakai Tabs terpadu (testid reward-image-tab-*), tombol X diberi aria-label 'Hapus gambar', dropzone diberi role=button + dukungan keyboard | Diperbaiki |
| LOY-RWD-05 | dialog:Nonaktifkan Reward | button | P3 | Konfirmasi destruktif memakai override bg-red-600 | Pakai buttonVariants({variant:'destructive'}) | Diperbaiki |
| LOY-RWD-06 | page | ia | P3 | Route duplikat tab Rewards catalog di hub | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/admin/loyalty/redemptions` — Redemptions

- **File:** `frontend/src/portals/admin/loyalty/LoyaltyAdminRedemptions.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LOY-RDM-01 | page | title | P2 | Tidak ada <h1>; judul seksi 'Redemption History' h3 menduplikasi tab | Embedded: baris toolbar (deskripsi + total + aksi); route mandiri: PageHeader 'Redemptions' | Diperbaiki |
| LOY-RDM-02 | page | language | P3 | Tombol 'Refresh'/'Export CSV' dan tombol baris 'Expired' (bahasa campur), override h-7/h-8 text-xs | Jadi 'Muat ulang', 'Ekspor CSV', 'Kedaluwarsa'; override ukuran dihapus (size default/sm), paginasi icon-sm + aria-label | Diperbaiki |
| LOY-RDM-03 | page | flow | P3 | 'Export CSV' tampak tidak berfungsi saat data kosong (hanya toast error) | Tombol Ekspor disabled bila tidak ada data | Diperbaiki |
| LOY-RDM-04 | dialog:Konfirmasi Expired | button | P3 | Konfirmasi kedaluwarsa memakai override bg-red-600; input cari/select tanpa label | variant destructive, judul 'Tandai Kedaluwarsa'; aria-label pada cari dan filter status | Diperbaiki |
| LOY-RDM-05 | page | typography | P3 | Kode voucher di tabel memakai <code> font-mono | Jadi span Inter font-medium tabular-nums (konvensi kode dokumen lintas portal) | Diperbaiki |
| LOY-RDM-06 | page | runtime | P3 | Paginasi memanggil load() manual sekaligus setPage, sehingga data dimuat dua kali | tidak diperbaiki: ini logika data, bukan UI | Terbuka |

## `/admin/loyalty/analytics` — CRM Analytics

- **File:** `frontend/src/portals/admin/loyalty/CRMAnalytics/index.jsx`
- **State diperiksa:** halaman + 8 tab, 0 dialog
- **Temuan otomatis (crawler):** 19 → 4
- **Tab:** Retention, Cohorts, Segments, Top customers, RFM, CLV, tab7, tab8
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| LOY-CRM-01 | page | title | P2 | Judul kedua 'CRM Advanced Analytics' (h3 text-xl font-bold) di dalam hub; route mandiri tanpa <h1> | Embedded: toolbar deskripsi + 'Muat ulang'; route mandiri: PageHeader 'CRM Analytics' | Diperbaiki |
| LOY-CRM-02 | page | tabs | P2 | TabsList dengan override (bg-muted, rounded-xl, text-xs, capitalize); label 'Rfm', 'Clv', 'Top customers' salah kapitalisasi | Override dihapus; label eksplisit: Overview, Retention, Cohorts, Segments, Top customers, RFM, CLV | Diperbaiki |
| LOY-CRM-03 | tab:Overview / Retention / Segments | card | P2 | 3 gaya tile KPI lokal berbeda (border rounded-xl bg-white text-2xl font-bold); bg-white juga rusak di dark mode | Semua diganti CompactStatCard (warna token aurora); wrapper chart/tabel jadi glass-card p-4 | Diperbaiki |
| LOY-CRM-04 | tab:Overview | density | P2 | Chart 'Monthly Acquisition' punya sumbu Y kanan kosong (tidak dipakai bar mana pun); legend default sekitar 16px berwarna | Sumbu kanan dihapus; semua chart pakai axisProps/gridProps chartKit dan Legend seragam 12px (LEGEND_PROPS) | Diperbaiki |
| LOY-CRM-05 | tab:Rfm | ia | P2 | Sumbu X 'RFM Score Distribution' terurut sebagai string (10,11,…,15,3,4,…9) | Data diurutkan numerik sebelum dirender | Diperbaiki |
| LOY-CRM-07 | tab:Retention / Top Customers | button | P2 | Tombol periode 3M/6M/12M dan urutan Spend/Visits/Points memakai Button h-6/h-7 text-xs | Diganti segmented control berbasis Tabs terpadu (h-8, 13px, pill-active); status 'Active/Inactive' jadi 'Aktif/Nonaktif'; 'No cohort data' dan 'Legend:' diterjemahkan | Diperbaiki |
| LOY-CRM-06 | tab:Clv | typography | P3 | Tooltip chart CLV memakai tooltip default Recharts (bukan GlassTooltip); heading h4/h5 tidak seragam | Pakai GlassTooltip; heading seksi h2 text-base md:text-lg, judul kartu h3 text-sm md:text-base | Diperbaiki |

## `/admin/cms/brands` — CMS Studio — Brands

- **File:** `frontend/src/portals/admin/CMSStudio.jsx`, `frontend/src/portals/admin/cms/CMSBrands.jsx`, `frontend/src/portals/admin/cms/SegmentedFilter.jsx`, `frontend/src/portals/admin/cms/BrandInstagramPosts.jsx`, `frontend/src/portals/admin/cms/CMSSEOFields.jsx`
- **State diperiksa:** halaman + 11 tab, 1 dialog
- **Temuan otomatis (crawler):** 28 → 5
- **Tab:** Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics, 7 Hari, 30 Hari, 90 Hari
- **Dialog/pop-up:** Tambah Brand (25 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; 2 field tanpa label; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-BRD-01 | page | title | P2 | Sub-halaman merender judul besar kedua 'Brands' (h3 text-xl font-bold) | Diganti toolbar: deskripsi + tombol 'Tambah Brand' (judul dari tab) | Diperbaiki |
| CMS-BRD-02 | page | tabs | P2 | Filter status Semua/Published/Draft memakai Button default/outline | Komponen baru cms/SegmentedFilter (gaya Tabs terpadu), testid filter-* tetap | Diperbaiki |
| CMS-BRD-03 | page | card | P2 | Baris brand 'border rounded-xl bg-white' (rusak di dark mode), nama 'font-bold text-lg'; checkbox berupa raw button tanpa label; empty state py-16 | glass-card p-4, nama jadi h3 text-sm md:text-base; checkbox dan 'Pilih semua' diberi aria-label/aria-pressed (testid brand-select-all); EmptyState | Diperbaiki |
| CMS-BRD-04 | dialog:Tambah Brand | form | P2 | 7 field tanpa label terhubung; input signature dish tanpa label; Batal ghost; tombol Preview menempel ikon tutup; slug/OG URL di field SEO memakai font-mono | htmlFor/id di semua field, aria-label untuk input hidangan dan color picker, Batal outline, pr-6 di judul dialog; tombol hapus pakai variant destructive; slug/OG URL pakai Inter | Diperbaiki |
| CMS-HUB-01 | page | title | P2 | Hub CMS Studio tanpa <h1> (kartu header h2 + subtitle 11px); berlaku untuk semua /admin/cms/* | Diganti PageHeader 'CMS Studio' + subtitle | Diperbaiki |
| CMS-HUB-02 | page | tabs | P2 | Baris tab Link custom setinggi 49px dengan underline framer-motion; 9 tab overflow horizontal (tab 'Pending Reviews' terpotong) | Tabs terpadu ter-route (onValueChange -> navigate), tanpa ikon agar 9 tab muat; label sentence case; testid cms-tabs/cms-tab-*/cms-content-* tetap | Diperbaiki |
| CMS-BRD-05 | dialog:Instagram Posts | button | P3 | Panel IG: judul ganda, tombol raw <button> gradient, modal custom framer, field tanpa label | Judul ganda dihapus, tombol utama dan footer jadi <Button> (outline/default/destructive), ikon overlay diberi aria-label, label form terhubung. Modal custom framer belum diganti Dialog | Diperbaiki |

## `/admin/cms/outlets` — CMS Studio — Outlets

- **File:** `frontend/src/portals/admin/cms/CMSOutlets.jsx`
- **State diperiksa:** halaman + 12 tab, 1 dialog
- **Temuan otomatis (crawler):** 30 → 5
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics, 7 Hari, 30 Hari, 90 Hari
- **Dialog/pop-up:** Tambah Outlet (15 field)
- **Sisa sinyal otomatis (heuristik):** 1 field tanpa label; 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-OUT-01 | page | title | P2 | Judul kedua 'Outlets / Lokasi' text-xl font-bold; filter brand bercampur dengan aksi utama di header | Toolbar deskripsi + 'Tambah Outlet'; filter brand dipindah ke baris filter (aria-label, testid outlet-brand-filter) | Diperbaiki |
| CMS-OUT-02 | page | language | P2 | Emoji 📞 📍 di baris outlet | Diganti ikon lucide Phone/MapPin | Diperbaiki |
| CMS-OUT-03 | page | tabs | P2 | Filter status 3 Button default/outline; baris outlet bg-white; empty state py-16 | SegmentedFilter (testid outlet-filter-*), glass-card, EmptyState | Diperbaiki |
| CMS-OUT-04 | dialog:Tambah Outlet | form | P2 | 8 field tanpa label terhubung; chip fasilitas tanpa status; Batal ghost | 12 label dihubungkan (htmlFor/id), chip aria-pressed, switch status berlabel, Batal outline, tombol hapus destructive | Diperbaiki |

## `/admin/cms/news` — CMS Studio — News & events

- **File:** `frontend/src/portals/admin/cms/CMSNews.jsx`, `frontend/src/portals/admin/cms/CMSNewsPreview.jsx`
- **State diperiksa:** halaman + 12 tab, 1 dialog
- **Temuan otomatis (crawler):** 32 → 6
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics, 7 Hari, 30 Hari, 90 Hari
- **Dialog/pop-up:** Tambah Artikel Preview (12 field)
- **Sisa sinyal otomatis (heuristik):** 1 field tanpa label; 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-NEW-01 | page | title | P2 | Judul kedua 'News & Events' text-xl font-bold | Toolbar deskripsi + 'Tambah Artikel' | Diperbaiki |
| CMS-NEW-02 | page | layout | P2 | Thumbnail yang gagal dimuat menumpahkan alt text ke luar kotak; badge brand kosong muncul bila brand tidak ditemukan | Thumbnail dibungkus kotak overflow-hidden bg-muted (alt kosong, disembunyikan saat error); badge brand hanya tampil bila namanya ada | Diperbaiki |
| CMS-NEW-03 | page | tabs | P2 | Filter status Button tanpa testid; select kategori terpotong ('Semua Kategor'); 7 tombol ikon/checkbox tanpa label | SegmentedFilter (news-filter-*), select w-44 + aria-label, checkbox aria-label/aria-pressed, baris glass-card | Diperbaiki |
| CMS-NEW-04 | dialog:Tambah Artikel | form | P2 | 8 field tanpa label; tombol Preview bertabrakan dengan ikon tutup; '— None —' bahasa Inggris | Label terhubung, pr-6 di judul dialog, '— Tidak ada —', Batal outline; h1 di preview publik diturunkan ke h2 | Diperbaiki |

## `/admin/cms/menu` — CMS Studio — Menu items

- **File:** `frontend/src/portals/admin/cms/CMSMenuAdmin/index.jsx`, `frontend/src/portals/admin/cms/CMSMenuAdmin/ItemsTab.jsx`, `frontend/src/portals/admin/cms/CMSMenuAdmin/CategoriesTab.jsx`, `frontend/src/portals/admin/cms/CMSMenuAdmin/PdfTab.jsx`
- **State diperiksa:** halaman + 12 tab, 1 dialog
- **Temuan otomatis (crawler):** 32 → 6
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics, 7 Hari, 30 Hari, 90 Hari
- **Dialog/pop-up:** Tambah Menu Item (8 field)
- **Sisa sinyal otomatis (heuristik):** 1 field tanpa label; 2 baris tab bertumpuk dalam satu layar; Isi dialog terpotong/scroll vertikal; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-MNU-01 | page | title | P2 | Judul kedua 'E-Menu Management' text-xl font-bold; label 'Brand:' tidak terhubung | Toolbar deskripsi + pemilih brand berlabel (htmlFor) | Diperbaiki |
| CMS-MNU-02 | page | tabs | P2 | Sub-tab Items/Kategori/PDF Menu dengan override grid grid-cols-3 w-full max-w-sm dan mr-1.5 | Override dihapus (Tabs terpadu); tetap 2 baris tab (hub + sub-view) karena tampilannya berbeda | Diperbaiki |
| CMS-MNU-03 | page | button | P2 | Tombol edit/hapus baris h-7 w-7 tanpa aria-label; badge tag h-4; tabel bg-white | size icon-sm + aria-label, badge tanpa h-4, glass-card; Kategori/PDF: tombol dan dialog dirapikan, 'Download' jadi 'Unduh', Batal outline, tombol hapus destructive | Diperbaiki |
| CMS-MNU-04 | dialog:Tambah Item | form | P2 | 5 field tanpa label; switch Tersedia/Featured tanpa id; chip dietary tanpa status | Label terhubung (7), switch berlabel, chip aria-pressed, space-y-3 | Diperbaiki |

## `/admin/cms/careers` — CMS Studio — Careers

- **File:** `frontend/src/portals/admin/cms/CMSCareers.jsx`
- **State diperiksa:** halaman + 9 tab, 2 dialog
- **Temuan otomatis (crawler):** 32 → 3
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics
- **Dialog/pop-up:** Lowongan Baru (9 field); Edit Lowongan (9 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-CAR-01 | page | title | P2 | Judul kedua 'Careers / Lowongan Kerja' h2 font-bold; tab hub berlabel 'Careers / Jobs' | Toolbar ringkasan + 'Lowongan Baru'; tab jadi 'Careers' | Diperbaiki |
| CMS-CAR-02 | page | a11y | P2 | 17 tombol ikon tanpa label (expand, toggle aktif, refresh); override h-7/h-9 text-xs | Expand dan toggle jadi icon-sm + aria-label/aria-expanded (testid expand-job-*), refresh size icon + aria-label (jobs-refresh); override dihapus | Diperbaiki |
| CMS-CAR-03 | dialog:Lowongan Baru / Edit | form | P2 | Field tanpa label terhubung; konfirmasi nonaktif memakai override bg-red-600; empty state p-10 | 8 label terhubung, variant destructive, EmptyState | Diperbaiki |

## `/admin/cms/media` — CMS Studio — Media library

- **File:** `frontend/src/portals/admin/cms/MediaLibrary.jsx`
- **State diperiksa:** halaman + 9 tab, 0 dialog
- **Temuan otomatis (crawler):** 29 → 3
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-MED-01 | page | title | P1 | Sub-halaman merender <h1> kedua 'Media Library' | Diganti toolbar ringkasan '{n} file tersimpan' + aksi | Diperbaiki |
| CMS-MED-02 | page | a11y | P2 | Tombol Upload berupa <label><Button asChild><span> (tidak bisa difokus keyboard); toggle grid/list h-7; tombol salin/hapus mode list tanpa label | Button biasa memicu input file via ref ('Unggah'), toggle icon-sm + aria-pressed, aria-label untuk salin/hapus | Diperbaiki |
| CMS-MED-03 | page | language | P3 | Hint 'Klik kanan gambar untuk salin URL' tidak sesuai perilaku; Prev/Next bahasa Inggris; empty state py-20 | Hint diperbaiki (ikon salin muncul saat hover), 'Sebelumnya/Berikutnya', EmptyState, tombol hapus destructive | Diperbaiki |

## `/admin/cms/reviews` — CMS Studio — Pending reviews

- **File:** `frontend/src/portals/admin/cms/CMSPendingReviews.jsx`
- **State diperiksa:** halaman + 12 tab, 0 dialog
- **Temuan otomatis (crawler):** 27 → 3
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics, 7 Hari, 30 Hari, 90 Hari
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-REV-01 | page | title | P2 | Judul kedua 'Pending Reviews' text-xl font-bold; tombol 'Refresh' | Toolbar deskripsi + badge jumlah + 'Muat ulang' | Diperbaiki |
| CMS-REV-02 | page | tabs | P2 | Filter tipe (Semua/Brand/News/Outlet/Menu) memakai Button default/outline dengan ikon Filter | SegmentedFilter (testid filter-type-* tetap) | Diperbaiki |
| CMS-REV-03 | page | language | P3 | Tombol 'Approve/Reject' bahasa Inggris; emoji ⚠️ di komentar review; empty state besar py-20 | 'Setujui/Tolak', ikon AlertTriangle, EmptyState; label alasan di dialog jadi Label htmlFor, Batal outline | Diperbaiki |

## `/admin/cms/analytics` — CMS Studio — Analytics

- **File:** `frontend/src/portals/admin/cms/CMSAnalytics.jsx`
- **State diperiksa:** halaman + 12 tab, 0 dialog
- **Temuan otomatis (crawler):** 28 → 3
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics, 7 Hari, 30 Hari, 90 Hari
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-ANA-01 | page | title | P2 | Judul kedua 'Content Analytics' text-xl font-bold | Toolbar deskripsi + periode + muat ulang | Diperbaiki |
| CMS-ANA-02 | page | card | P2 | Tile KPI lokal (border rounded-xl bg-white text-2xl font-bold) | CompactStatCard | Diperbaiki |
| CMS-ANA-03 | page | button | P2 | Tombol periode 7/30/90 Hari dan filter tipe (h-6 text-xs, 'All'); tombol refresh ikon tanpa label | SegmentedFilter, 'Semua', refresh size icon + aria-label | Diperbaiki |
| CMS-ANA-04 | page | typography | P3 | Chart memakai tooltip default dan grid #f0f0f0; empty state p-10 | GlassTooltip + axisProps/gridProps, EmptyState di glass-card | Diperbaiki |

## `/admin/cms/pages` — CMS Studio — Page builder

- **File:** `frontend/src/portals/admin/cms/PageBuilderAdmin/index.jsx`, `frontend/src/portals/admin/cms/PageBuilderAdmin/BlockCard.jsx`, `frontend/src/portals/admin/cms/PageBuilderAdmin/BlockEditors.jsx`
- **State diperiksa:** halaman + 9 tab, 1 dialog
- **Temuan otomatis (crawler):** 27 → 3
- **Tab:** Brands, Outlets, News & events, Menu items, Careers, Media library, Page builder, Pending reviews, Analytics
- **Dialog/pop-up:** Buat Halaman Baru (2 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 16, 84px (standar 32/36/40); Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| CMS-PGB-01 | page | title | P2 | Judul kedua 'Page Builder' text-xl font-bold | Toolbar deskripsi + 'Buat Halaman Baru'; EmptyState | Diperbaiki |
| CMS-PGB-02 | page | a11y | P2 | Tombol ikon edit/hapus/publish tanpa aria-label; <a><Button> bersarang untuk 'Lihat di publik' | aria-label di semua tombol ikon, Button asChild + <a> | Diperbaiki |
| CMS-PGB-03 | dialog:Buat Halaman Baru | tabs | P2 | Tab dialog underline custom (override rounded-none/border-b/bg-transparent); tab aktif putih di atas putih sehingga tak terbaca | Override dihapus (Tabs terpadu, testid page-form-tabs), padding p-6 jadi p-5, label terhubung, 'Blok Konten' jadi h3, Batal outline, tombol hapus destructive | Diperbaiki |
| CMS-PGB-04 | page | typography | P3 | Slug halaman (di daftar dan input Slug URL) memakai font-mono | Jadi Inter (font-medium tabular-nums di daftar) sesuai konvensi kode lintas portal | Diperbaiki |

## `/admin/report-schedules` — Report Schedules

- **File:** `frontend/src/portals/admin/ReportSchedules.jsx`
- **State diperiksa:** halaman + 1 tab, 1 dialog
- **Temuan otomatis (crawler):** 9 → 0
- **Tab:** Riwayat Kirim (0)
- **Dialog/pop-up:** Tambah Jadwal Laporan (6 field)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-RPS-01 | page | title | P2 | h1 bespoke text-2xl font-bold tracking-tight + wrapper p-6 (padding ganda); judul tampil juga saat di-embed di hub Monitoring (2 judul) | Prop embedded: route mandiri pakai PageHeader 'Report Schedules'; di hub hanya toolbar. Wrapper p-6/space-y-6 dihapus | Diperbaiki |
| OPS-RPS-02 | page | ia | P2 | Duplikat dari /admin/operations/report-schedules (komponen sama, tanpa tab hub) | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| OPS-RPS-03 | page | a11y | P2 | Tombol refresh/edit/hapus ikon tanpa aria-label; switch aktif per kartu tanpa label | size icon/icon-sm + aria-label, switch diberi aria-label; empty state jadi EmptyState dengan aksi | Diperbaiki |
| OPS-RPS-04 | dialog:Tambah Jadwal | form | P2 | 4 field tanpa label terhubung; switch 'Aktifkan jadwal' tidak terhubung | 7 label htmlFor/id + switch berlabel | Diperbaiki |
| OPS-RPS-05 | tab:Riwayat Kirim (0) | tabs | P3 | TabsContent memakai override mt-4 | Override dihapus | Diperbaiki |

## `/admin/smart-seo` — Smart SEO

- **File:** `frontend/src/portals/admin/SmartSEOAdmin/index.jsx`, `frontend/src/portals/admin/SmartSEOAdmin/BulkOptimizeDialog.jsx`, `frontend/src/portals/admin/SmartSEOAdmin/PreviewComponents.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 6 → 3
- **Sisa sinyal otomatis (heuristik):** Font non-Inter: ui-sans-serif; Tinggi tombol non-standar: 24px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| SEO-01 | page | title | P2 | Tidak ada <h1>: hero glass-card p-6 dengan h2 'Smart SEO Optimization' (tidak sama dengan nama nav 'Smart SEO') | PageHeader 'Smart SEO' dengan badge AI + tombol 'Optimasi Semua' di actions (size default) | Diperbaiki |
| SEO-02 | form | form | P2 | 8 input SEO tanpa label terhubung; input memakai font-mono | Label htmlFor/id (8 field); font-mono dihapus dari field teks dan seed dialog bulk; path halaman dan penghitung karakter pakai Inter tabular-nums | Diperbaiki |
| SEO-03 | page | card | P3 | Kartu p-5, heading campur (font-semibold text-sm / p font-semibold), spasi space-y-6 | p-4, judul halaman terpilih jadi h2, judul kartu h3 text-sm md:text-base, spasi 3/4; chip JSON-LD '✓' jadi ikon Check | Diperbaiki |
| SEO-04 | page | a11y | P3 | Tombol hapus focus keyword ikon tanpa label; toggle Preview/Analisis tanpa aria-expanded; daftar halaman tanpa aria-current | aria-label, aria-expanded, aria-current, testid seo-preview-toggle | Diperbaiki |

## `/admin/data-management` — Data Management

- **File:** `frontend/src/portals/admin/DataManagement/index.jsx`, `frontend/src/portals/admin/DataManagement/constants.js`, `frontend/src/portals/admin/DataManagement/ExportTab.jsx`, `frontend/src/portals/admin/DataManagement/ImportTab.jsx`, `frontend/src/portals/admin/DataManagement/DeleteTab.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 1
- **Tab:** Impor data, Hapus data
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-DM-01 | page | title | P2 | Judul h2 'Manajemen Data Sistem' (tanpa <h1>), tombol Refresh berupa raw <button>; judul juga muncul saat di-embed di Monitoring | Prop embedded: route mandiri PageHeader 'Data Management' + 'Muat ulang' (testid dm-refresh); di hub hanya toolbar | Diperbaiki |
| OPS-DM-02 | page | card | P2 | StatsBar lokal (bg-white rounded-xl border) | Diganti CompactStatCard (testid dm-stats/dm-stat-* tetap); StatsBar.jsx dihapus | Diperbaiki |
| OPS-DM-03 | page | tabs | P2 | Tab Export/Import/Hapus berupa button segmented custom bg-gray-100; label campur bahasa | Tabs terpadu (testid dm-tabs/dm-tab-* tetap), label 'Ekspor data / Impor data / Hapus data' | Diperbaiki |
| OPS-DM-04 | tab:Export | button | P2 | Tombol aksi utama raw <button> (Export/Import/Hapus), tombol preview ikon tanpa label, 9 checkbox tanpa label, kartu bg-white p-5; nama koleksi dan frasa konfirmasi memakai font-mono | <Button> (default/destructive, testid tetap), label 'Ekspor/Impor', preview icon-sm + aria-label, checkbox aria-label, glass-card p-4, input konfirmasi hapus berlabel; nama koleksi dan frasa konfirmasi pakai Inter font-medium tabular-nums | Diperbaiki |
| OPS-DM-06 | page | ia | P2 | Duplikat dari /admin/operations/data-management | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |
| OPS-DM-05 | tab:Export | card | P3 | Daftar 'Quick Export' masih raw <button>; warna text-gray-*/bg-gray-* tidak adaptif dark mode | tidak diperbaiki: butuh refactor visual lebih besar | Terbuka |

## `/admin/tour-analytics` — Tour Analytics

- **File:** `frontend/src/portals/admin/TourAnalytics/index.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-TA-01 | page | title | P2 | Hero glass-card p-6 dengan h2 font-bold (tanpa <h1>); judul ganda saat di-embed di hub | Prop embedded: route mandiri PageHeader 'Tour Analytics' (aksi periode + 'Muat ulang'); di hub hanya toolbar | Diperbaiki |
| OPS-TA-02 | page | card | P2 | KpiCard dan MiniStat lokal (text-2xl font-bold) | Diganti CompactStatCard (grid-cols-2 md:grid-cols-5 gap-3; di dialog size sm); komponen lokal dihapus | Diperbaiki |
| OPS-TA-03 | page | language | P2 | Emoji ikon tour (📊 dari tourMap) di tabel, kartu performer dan dialog; 'Last N days' bahasa Inggris | Diganti ikon lucide seragam; '{n} hari terakhir'. Emoji di tourMap butuh perubahan shared | Diperbaiki |
| OPS-TA-04 | page | ia | P2 | Duplikat dari /admin/operations/tour-analytics | Diperbaiki (25 Okt): halaman duplikat dihapus — URL lama di-redirect ke tab hub, query ikut, tab sesuai izin (UX-G-50). | Diperbaiki |

## `/admin/operations/logs` — Monitoring — Logs

- **File:** `frontend/src/portals/admin/Operations.jsx`, `frontend/src/portals/admin/operations/LogsView.jsx`
- **State diperiksa:** halaman + 8 tab, 0 dialog
- **Temuan otomatis (crawler):** 25 → 3
- **Tab:** Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-HUB-01 | page | title | P2 | Hub tanpa <h1> (kartu header h2 'Operations & Monitoring'), tidak cocok dengan nama nav 'Monitoring'; berlaku untuk semua /admin/operations/* | PageHeader 'Monitoring' + subtitle | Diperbaiki |
| OPS-HUB-02 | page | tabs | P2 | Tab Link custom 49px + underline framer, overflow (Tour Analytics terpotong); label campur bahasa ('Laporan Terjadwal', 'Manajemen Data') | Tabs terpadu ter-route, tanpa ikon, label English sentence case (Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics); testid operations-tab-*/operations-content-* lama dipertahankan | Diperbaiki |
| OPS-LOG-01 | page | title | P2 | Judul kedua 'Recent Logs' h2 dengan ikon | Toolbar deskripsi + 'Muat ulang' | Diperbaiki |
| OPS-LOG-02 | page | form | P2 | 3 input filter tanpa label; tombol 'Apply' memakai override rounded-full pill-active; 'All levels' dan Prev/Next bahasa Inggris | aria-label di semua filter (testid baru logs-filter-user), 'Terapkan' Button default (testid logs-apply), 'Semua level', 'Sebelumnya/Berikutnya' | Diperbaiki |
| OPS-LOG-03 | page | typography | P3 | Kolom route/request ID di tabel memakai font-mono | Jadi Inter font-medium tabular-nums; font-mono hanya dipertahankan di blok JSON baris yang di-expand | Diperbaiki |
| OPS-LOG-04 | page | runtime | P3 | EmptyState dipanggil dengan prop 'hint' yang tidak ada, sehingga deskripsi tidak tampil | Diganti prop description | Diperbaiki |
| OPS-LOG-05 | page | flow | P3 | Filter teks memanggil API setiap ketikan (tanpa debounce), sehingga tombol Terapkan redundan | tidak diperbaiki: ini perubahan logika fetch | Terbuka |

## `/admin/operations/scheduler` — Monitoring — Scheduler

- **File:** `frontend/src/portals/admin/operations/SchedulerView.jsx`
- **State diperiksa:** halaman + 8 tab, 0 dialog
- **Temuan otomatis (crawler):** 24 → 3
- **Tab:** Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-SCH-01 | page | title | P2 | Judul kedua 'Background Jobs' h2; tombol 'Refresh'; spasi space-y-5 | Toolbar deskripsi + 'Muat ulang' (testid scheduler-refresh); spasi 3/4; 'Recent Runs' jadi h2 seksi | Diperbaiki |
| OPS-SCH-02 | page | button | P3 | Tombol 'Run' memakai override rounded-full, label bahasa Inggris | Button sm standar, 'Jalankan' / 'Menjalankan…'; Prev/Next jadi Sebelumnya/Berikutnya; 'Page' jadi 'Halaman' | Diperbaiki |
| OPS-SCH-03 | page | typography | P3 | Job ID dan tanggal memakai font-mono | Job ID/tanggal jadi Inter tabular-nums; font-mono hanya untuk ekspresi cron (trigger) dan output result/error | Diperbaiki |

## `/admin/operations/archival` — Monitoring — Archival

- **File:** `frontend/src/portals/admin/operations/ArchivalView.jsx`
- **State diperiksa:** halaman + 8 tab, 0 dialog
- **Temuan otomatis (crawler):** 25 → 3
- **Tab:** Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-ARC-03 | page | flow | P1 | Konfirmasi 'Jalankan Archival' (confirmDialog) tidak pernah muncul karena host belum di-mount | Diselesaikan di komponen bersama — ConfirmDialogHost, sudah di-mount lead di App.js | Diperbaiki (komponen shared) |
| OPS-ARC-01 | page | title | P2 | Judul kedua 'Data Archival' h2 | Toolbar deskripsi + aksi | Diperbaiki |
| OPS-ARC-02 | page | button | P2 | Tombol refresh ghost ikon tanpa aria-label; 'Run Archival' rounded-full; campur bahasa ('Dry Run', 'Best practice', 'Last Run Result') | Refresh icon outline + aria-label (archival-refresh), Button standar 'Jalankan Archival', 'Dry run', 'Saran:', 'Hasil Run Terakhir'; nama koleksi Inter tabular-nums, JSON hasil tetap mono | Diperbaiki |

## `/admin/operations/rate-limits` — Monitoring — Rate limits

- **File:** `frontend/src/portals/admin/operations/RateLimitsView.jsx`
- **State diperiksa:** halaman + 8 tab, 0 dialog
- **Temuan otomatis (crawler):** 24 → 3
- **Tab:** Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-RL-03 | page | flow | P1 | 'Reset semua' (confirmDialog) tidak berfungsi karena host belum di-mount | Diselesaikan di komponen bersama — sudah diperbaiki lead (ConfirmDialogHost di App.js) | Diperbaiki (komponen shared) |
| OPS-RL-01 | page | title | P2 | Judul kedua 'Rate Limits' h2 | Toolbar deskripsi (Bahasa) + aksi | Diperbaiki |
| OPS-RL-02 | page | a11y | P2 | Tombol refresh ghost ikon tanpa aria-label; 'Reset All' bahasa Inggris; judul bucket uppercase tracking; key memakai font-mono | icon outline + aria-label (rl-refresh), 'Reset semua', judul kartu h3 standar, key Inter tabular-nums dengan tooltip title | Diperbaiki |

## `/admin/operations/report-schedules` — Monitoring — Report schedules

- **File:** `frontend/src/portals/admin/Operations.jsx`, `frontend/src/portals/admin/ReportSchedules.jsx`
- **State diperiksa:** halaman + 10 tab, 1 dialog
- **Temuan otomatis (crawler):** 28 → 4
- **Tab:** Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics, tab8, tab9
- **Dialog/pop-up:** Tambah Jadwal Laporan (6 field)
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-ORS-01 | page | title | P1 | Dua judul: <h1> 'Laporan Terjadwal' (font-bold 700) di bawah header hub + padding p-6 ganda | Dirender dengan embedded: tanpa h1, cukup toolbar deskripsi + aksi | Diperbaiki |
| OPS-ORS-03 | dialog:Tambah Jadwal | form | P2 | 4 field tanpa label terhubung | Sama dengan OPS-RPS-04 (label terhubung) | Diperbaiki |
| OPS-ORS-02 | page | tabs | P3 | 2 baris tab bertumpuk (hub + Jadwal/Riwayat Kirim) | tidak diperbaiki: sub-view berbeda; keduanya kini memakai gaya Tabs terpadu | Terbuka |

## `/admin/operations/data-management` — Monitoring — Data management

- **File:** `frontend/src/portals/admin/Operations.jsx`, `frontend/src/portals/admin/DataManagement/index.jsx`
- **State diperiksa:** halaman + 11 tab, 0 dialog
- **Temuan otomatis (crawler):** 25 → 5
- **Tab:** Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics, tab8, tab9, tab10
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-ODM-01 | page | title | P2 | Judul kedua 'Manajemen Data Sistem' di bawah header hub | Dirender dengan embedded (tanpa judul); perbaikan lain lihat OPS-DM-02..05 | Diperbaiki |
| OPS-ODM-02 | page | tabs | P3 | 2 baris tab (hub + Ekspor/Impor/Hapus) | tidak diperbaiki: sub-view berbeda; gayanya kini seragam | Terbuka |

## `/admin/operations/tour-analytics` — Monitoring — Tour analytics

- **File:** `frontend/src/portals/admin/Operations.jsx`, `frontend/src/portals/admin/TourAnalytics/index.jsx`
- **State diperiksa:** halaman + 8 tab, 0 dialog
- **Temuan otomatis (crawler):** 24 → 3
- **Tab:** Metrics, Logs, Scheduler, Archival, Rate limits, Report schedules, Data management, Tour analytics
- **Sisa sinyal otomatis (heuristik):** 2 baris tab bertumpuk dalam satu layar; Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| OPS-OTA-01 | page | title | P2 | Hero card besar p-6 dengan judul kedua 'Tour Analytics' di bawah header hub | Dirender dengan embedded: toolbar ringkas (deskripsi + periode + Muat ulang); perbaikan lain lihat OPS-TA-02/03 | Diperbaiki |
| OPS-OTA-02 | page | card | P3 | Padding kartu bervariasi 16/20/24px | Semua kartu p-4 (PerformerCard p-5 jadi p-4, hero dihapus) | Diperbaiki |

## Catatan reviewer

Laporan ini MENGGANTIKAN laporan saya sebelumnya. Satu-satunya perubahan: koreksi konvensi font dari koordinator sudah diterapkan. Kode/ID yang tampil sebagai data (kode voucher, slug, path halaman SEO, request ID, route di tabel Logs/Metrics, job ID, rate-limit key, nama koleksi, frasa konfirmasi hapus, penghitung karakter SEO) kini Inter font-medium tabular-nums. font-mono hanya tersisa di 4 tempat: ekspresi cron di kartu Scheduler, kolom Result/Error Scheduler (output log/JSON), blok JSON baris Logs yang di-expand, dan JSON hasil archival. Pola baru: komponen yang punya route mandiri sekaligus di-embed di hub (LoyaltyAdminCustomers/Rewards/Redemptions, CRMAnalytics, ReportSchedules, DataManagement, TourAnalytics) menerima prop `embedded`. Hub (LoyaltyHub, Operations) mengirim `embedded` sehingga tidak ada <h1> kedua, sedangkan route mandiri merender PageHeader. Hub CMS Studio dan Monitoring kini PageHeader + Tabs terpadu ter-route; TabsTrigger tanpa ikon supaya 9 tab (CMS) dan 8 tab (Monitoring) muat di 1280px. Semua testid lama dipertahankan (cms-tabs, cms-tab-*, cms-content-*, operations-page, operations-tab-<label lama>, operations-content-*, loyalty-hub-tabs, loyalty-tab-*). File baru: frontend/src/portals/admin/cms/SegmentedFilter.jsx (filter status bergaya Tabs, dipakai CMS). File dihapus: frontend/src/portals/admin/DataManagement/StatsBar.jsx (diganti CompactStatCard). Kartu putih di SmartSEOAdmin/PreviewComponents.jsx sengaja dipertahankan karena meniru tampilan Google/Facebook; di file itu hanya font penghitung karakter yang diubah. Semua file yang diedit lolos jsxcheck; scripts/audit_tours.py: 0 target hilang. Masih terbuka (P3): modal IG Posts masih custom framer (belum Dialog), Quick Export dan warna gray-* di DataManagement, filter Logs tanpa debounce, paginasi Redemptions memuat dua kali. State yang butuh data untuk dicek: daftar Redemptions, Pending reviews dan Media library masih kosong; panel IG Posts belum bisa dibuka karena opener timeout di crawler.
