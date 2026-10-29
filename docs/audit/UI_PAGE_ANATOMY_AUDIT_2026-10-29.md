# Audit anatomi halaman — judul, kartu, letak aksi, simpan & bahasa (29 Okt 2026)

**Concern user (dirangkum)**
1. Judul blok kadang di luar kartu, kadang di dalam kartu, sehingga hierarki halaman tidak terbaca.
   Contoh Budget: KPI tanpa judul, "Ringkasan P&L" di luar kartu, "Detail per COA" di dalam kartu, dan
   satu slot grid kosong.
2. Tombol simpan jauh dari yang diedit. Contoh Approval Matrix: user mengedit di bawah, simpan ada di atas,
   sehingga mudah lupa menyimpan.
3. Aksi kadang di samping judul halaman, kadang di bawahnya. Kalau levelnya sama, mengapa letaknya tidak konsisten?
4. Kapan konten pantas dikotakkan (kartu) dan kapan tidak; terlalu banyak kotak juga buruk.
5. Bahasa: tetap campur. Istilah teknis memakai bahasa Inggris (aturannya di §1.5).

**Metode**
- `scripts/ui_metrics/anatomy.js` membuka 170 URL ERP dan 560 state (halaman + tab), viewport 1280×800, super admin.
  Setelah ID dan query digabung, hasilnya **121 halaman unik**.
- Dari setiap state, crawler membaca:
  - kerangka halaman (urutan header, tab, judul, kartu & jenis isinya);
  - letak setiap judul (di luar kartu / di atas kartu / di tengah kartu);
  - letak setiap tombol aksi (zona);
  - posisi tombol simpan relatif terhadap field form;
  - grup KPI;
  - semua teks UI (label, kolom, tab, tombol, status, placeholder).
- Kategori temuan diverifikasi lewat screenshot. Ringkasan: `python3 scripts/ui_metrics/anatomy_report.py`.
- Bagian 1 adalah **draf standar** yang diusulkan. Bagian 2 mengukur aplikasi saat ini terhadap draf itu.
  Lampiran berisi tabel per halaman.

---

## Bagian 1 — Draf standar "anatomi halaman"

Standar disetujui 29 Okt 2026 dan kini menjadi **`docs/DESIGN_SYSTEM.md` §10**. Bagian 2 di bawah mengukur aplikasi (sebelum perbaikan) terhadap standar tersebut
(§1.x di bawah = §10.x di DESIGN_SYSTEM).

## Bagian 2 — Hasil audit terhadap draf standar

### 2.1 Judul di luar vs di dalam kartu

| Gaya judul (layar awal tiap halaman) | Halaman |
|---|---|
| Semua judul di dalam kartu | 65 |
| Tanpa judul blok (mis. hanya 1 tabel) | 48 |
| Campur luar + dalam | 6 |
| Hanya di luar | 2 |

Halaman campuran adalah halaman dashboard.

*Budget (Budget vs Actual)*
- 5 KPI tanpa judul.
- "Ringkasan P&L" di luar kartu.
- "Detail per COA" di dalam kartu.
- 3 KPI total di bawah tabel tanpa judul.
- Grid 4 kolom lalu 3 kolom.
- 1 KPI yatim (kotak merah di screenshot Anda).

*Owner Overview*
- Judul bagian "Approval Pending" → kartu "Approval Pending (Top 5)": judul ganda.
- "Cash & Digest" → kartu "Digest Preview".

*Sales Analytics*
- 2 grup KPI tanpa judul.
- Bagian "Brand & Cash" / "Trend & AI Insights" / "Monitoring" (judul luar).
- Tabel dengan judul dalam.

*Antar halaman*
- Strip KPI Owner berjudul "KPI Utama".
- Strip KPI Sales Analytics tanpa judul.

**Blok tanpa judul di antara blok berjudul** (16 halaman):
- Form create/edit: PR Baru, Daily Sales new/edit, Opname detail, PO/PR detail. Kartu field pertama tanpa
  judul, kartu "Item" dan "Catatan" berjudul.
- Budget, Approval Matrix, Outlet Budget, Owner Cash, Payments › Cash position, Manual journal, Owner briefing.

### 2.2 Penggunaan kartu

| Temuan | Halaman | Contoh |
|---|---|---|
| **Daftar homogen dijadikan kartu per baris** | 12 | **Pusat Persetujuan: 35 kartu** (7 item per layar, masing-masing dengan tombol Setujui hijau) · Integrations (25 key, 1 kartu per key) · CMS: brand/outlet/berita/karier per kartu |
| **Data seragam dijadikan grid kartu**, padahal semestinya tabel | 3 | Setup & Numbering: 18 kartu number series (kode, format, no. terakhir, padding, reset) yang jelas tabel 5 kolom · Roles (9 kartu) · Job listings |
| **Kartu konteks "Outlet aktif" di atas judul halaman** | 18 (semua halaman outlet) | Petty Cash, End of Day, Daily Sales, Transfers, … Judul halaman tidak lagi menjadi hal pertama; "Semua Outlet (5)" tampil 2× + badge "Agregat" |
| **Filter terpisah dari tabelnya** (kartu filter, lalu kartu tabel) | 17 | Payments, PO, PR, GR, RFQ, Journals, Low stock, Operations › Logs |
| **Filter tingkat halaman dikotakkan** (berbobot sama dengan konten) | 38 (termasuk 18 outlet) | Budget, Reports P&L, Budget monitor, Anomaly, Inventory balance/valuation, Vendor scorecard |
| **Kartu tipis** (pesan/progress satu baris) | ±20 setelah disaring | banner "Sehat — runway…" (Cash position), kartu "PROGRESS 0/4" (End of Day), status Trial Balance |
| **Bingkai 3 lapis** | Approval Matrix, End of Day, Period Closing | kartu Tier › kotak Kondisi › kotak Step; kartu langkah › bingkai filter › bingkai tab › bingkai empty state |
| **Kartu yang ternyata tombol filter** | Pusat Persetujuan | "Semua 35 / Purchase Request 9 / …" tampil persis seperti KPI, padahal bisa diklik (filter). Di halaman lain KPI tidak bisa diklik |

Distribusi jumlah kartu per state:
- 176 state hanya punya 1 kartu (wajar: halaman tabel);
- 24 state punya ≥ 15 kartu (Pusat Persetujuan, Sales Analytics, Admin Overview, Setup, Roles, Integrations, CRM).

Jadi masalah "terlalu banyak kotak" terkonsentrasi di daftar yang dikartukan dan di dashboard. Halaman umumnya tidak.

### 2.3 Letak aksi

Zona tombol per jenis aksi (layar awal tiap URL):

| Aksi | Samping judul | Baris intro (bawah tab) | Lepas di luar kartu | Atas kartu | Bawah kartu | Kartu filter |
|---|---|---|---|---|---|---|
| Buat/Tambah | 17 | 16 | 10 | 7 | 9 | 3 |
| Ekspor | 11 | 3 | 3 | — | 15 | 2 |
| Muat ulang | 23 | 8 | 6 | 7 | — | 7 |
| Simpan | 8 | — | 2 | 1 | 5 | 2 |

- **Aksi pembuatan dokumen ada di 6 tempat berbeda.** Ini jawaban untuk pertanyaan Anda soal Payments vs
  Sales Analytics: levelnya sama (aksi layar), letaknya tidak sama.
- **Hub**: aksi milik tab aktif berada di baris intro (217 state), lepas (97), bawah kartu (87), atas kartu (16),
  dan kartu filter (14). Tidak ada yang di samping judul.
- **Penamaan aksi membuat** (jumlah label di seluruh halaman):

| Pola | Jumlah | Contoh |
|---|---|---|
| "Tambah …" | 55 | |
| "… Baru" | 35 | |
| "Buat …" | 33 | |
| "New" | 1 | |
| ganda | — | "Buat Payment Run Baru", "Tambah Customer AR Baru", "Buat Template Baru" |

- Tombol "Buat Payment" membuka halaman berjudul "New Payment".

### 2.4 Simpan

- **Tidak ada peringatan "perubahan belum disimpan" di seluruh aplikasi.**
  - Di Approval Matrix, mengklik entitas lain di kiri **membuang editan tanpa peringatan**
    (`ApprovalMatrixBuilder` memuat ulang workflow saat `selectedEntity` berubah).
  - Menutup tab atau berpindah menu juga membuang editan.
- **Simpan jauh di atas form panjang** (6 halaman):
  - Approval Matrix: field sampai ±3.400px, simpan di header.
  - Daily Sales new/edit: form sampai ±1.000px.
  - Opname detail, Smart SEO, Budget Allocation: matriks sampai ±820px.
- **Konvensi form create tidak seragam**:
  - PR Baru, PO Baru, Daily Sales: simpan/ajukan di **header atas**.
  - New Payment: simpan hanya di **bawah**, di luar layar awal (y≈970px).
- **Simpan per baris**: System Settings (6 tombol "Simpan", sebagian hitam, sebagian pudar).

### 2.5 Bahasa (terhadap aturan §1.5)

**Kata umum EN yang sebaiknya ID** (istilah teknis dan nama fitur dibiarkan):

| Di mana | Sekarang → usulan |
|---|---|
| Form New Payment | Payee Type → Tipe Payee · Request Date → Tanggal Pengajuan · Amount Bruto (Rp) → Nominal Bruto (Rp) · Invoice No → No. Invoice · Invoice Date → Tanggal Invoice · Description → Deskripsi · Notes (internal) → Catatan (internal) |
| Kolom tabel | Date → Tanggal · Description → Deskripsi · Amount / Total Amount → Nominal · Name → Nama · Code → Kode · Type → Tipe · Source → Sumber · Count → Jumlah · Phone → Telepon · Day → Hari · Last Update → Terakhir Diperbarui · Payment Date → Tanggal Payment · Last Cost → Cost Terakhir · Retention (days) → Retensi (hari) |
| Form lain | Entry Date → Tanggal Entry (Manual journal) · Tanggal request → Tanggal Pengajuan · Source → Sumber (PR) |
| Label KPI | Inventory Value → Nilai Inventory · Total Value → Nilai Total · Days runway → Runway (hari) · Item Count → Jumlah Item · Avg/Day → Rata-rata/Hari · Active Sessions → Sesi Aktif |
| Tombol | Refresh → Muat ulang · Submit → Ajukan · Preview / Preview Digest → Pratinjau / Pratinjau Digest · Generate / Generate Payroll → Buat / Buat Payroll · Tambah Category → Tambah Kategori |
| Judul | Recent Runs → Run Terbaru · Quick Export / Opsi Export → Ekspor Cepat / Opsi Ekspor · Goods Receipt Summary → Ringkasan Goods Receipt · Digest Preview → Pratinjau Digest · Insights & Actions → Insight & Aksi · By Status Code / By Method → Per Status Code / Per Method |

**Status**

| Arah | Sekarang → usulan |
|---|---|
| Status umum yang masih EN → ID | KPI "Approved (siap bayar)" → "Disetujui (siap bayar)" · "Paid 2026-10" → "Dibayar 2026-10" · "Confirmed (siap eksekusi)" → "Dikonfirmasi (siap eksekusi)" · "Pending Validation" → "Menunggu Validasi" · "KDO/BDO pending" → "KDO/BDO menunggu" · tab CMS "Pending reviews" → "Review Menunggu" |
| Status akuntansi yang masih ID → EN | Terlambat → **Overdue** · Sebagian → **Partial** · Dihapusbukukan → **Written Off** · Susut Penuh → **Fully Depreciated** · Direvaluasi → **Revalued** · Dilepas → **Disposed** · Memposting → **Posting** |
| Perlu keputusan | "Jatuh Tempo" (Due) dan "Lunas" (Settled): kata sehari-hari yang sudah sangat dikenal · "Diterima Sebagian" pada PO (procurement, bukan akuntansi) · "Published" vs "Terbit" (CMS) |
| Status ganda 2 bahasa | Integrations: pill "Not Configured" + teks "Belum dikonfigurasi" sekaligus |

**Satu konsep, banyak kata**

| Konsep | Variasi (jumlah halaman) |
|---|---|
| Tanggal | 60 · Date 6 · Tgl 1 |
| Deskripsi | 4 · Description 6 |
| Uang | Nominal 4 · Jumlah 10 (dipakai juga untuk hitungan) · Amount 3 |
| Catatan | 17 · Notes 1 |
| Tipe | 8 · Jenis 8 · Type 4 |
| Edit / Ubah | Edit 7 · Ubah 3 |
| Muat ulang | 37 · Refresh 1 |

---

## Bagian 3 — Usulan urutan perbaikan (setelah standar disetujui)

1. **Primitive dulu** (sekali ubah, berlaku di banyak halaman):
   - `PageHeader` menerima aksi & subtitle per tab hub.
   - Komponen `FormActionBar` (sticky + penanda perubahan + peringatan keluar).
   - `ListToolbar` di dalam kartu tabel.
   - Selector outlet masuk ke header.
   - `Alert` untuk pesan satu baris.
2. **Simpan**: Approval Matrix (termasuk peringatan saat ganti entitas), System Settings (satu bar),
   PR/PO/Payment/Daily Sales/Opname/Budget Allocation memakai `FormActionBar`.
3. **Kartu**:
   - Pusat Persetujuan, Setup & Numbering, Integrations, Roles, dan baris CMS menjadi daftar/tabel dalam satu kartu.
   - Filter tabel masuk ke kartu tabel.
   - Filter halaman tanpa kartu.
4. **Judul & grid**: Budget, Owner Overview, Sales Analytics, form create (kartu pertama diberi judul).
5. **Bahasa**: kamus di standar §1.5 dan §2.5 setelah keputusan "Perlu keputusan".
6. Aturan dimasukkan ke `docs/DESIGN_SYSTEM.md` + `CLAUDE.md`. Crawler `anatomy.js` dipakai sebagai penjaga
   regresi (temuan baru = gagal).

---

## Lampiran — per halaman

**Cara membaca**
- **Kerangka**: urutan blok di layar awal.
- **Aksi utama @ letak**: tombol utama/aksi membuat dan zona letaknya.
- **Temuan**: gabungan audit anatomi ini dan audit komposisi (`UI_LAYOUT_AUDIT_2026-10-29.md`).
- ✓ = tidak ada temuan.

Halaman detail ditulis dengan `:id`. Jumlah tab = state yang diperiksa.

### /admin

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/admin` | Header › 4 KPI › judul «Master Data» › judul «Import & System » › Kartu tipis ×3 | — | grup KPI berjudul & tidak, kartu tipis (pesan/progress) |
| `/admin/approvals` (3 tab) | Header+aksi › Kartu menu+judul › Kartu form › Tab › Kartu form ×3 | Simpan Workflow @ samping judul | aksi ganda, aksi header turun baris, bingkai 3 lapis, blok tanpa judul di antara blok berjudul, kartu tipis (pesan/progress), simpan di header, simpan jauh di atas form |
| `/admin/cms/analytics` (9 tab) | Header › Tab hub › Intro › Tab › 4 KPI › Kartu tipis | — | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/brands` (9 tab) | Header › Tab hub › Intro › Tab › Kartu+judul ×5 | Tambah Brand @ baris intro | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/careers` (9 tab) | Header › Tab hub › Intro › grid 8 kartu | Lowongan Baru @ baris intro | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/media` (9 tab) | Header › Tab hub › Kartu tipis | Unggah @ lepas | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/menu` (9 tab) | Header › Tab hub › Intro › Tab › Kartu tabel | Tambah Item @ lepas | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/news` (9 tab) | Header › Tab hub › Intro › Tab › Kartu+judul ×6 | Tambah Artikel @ baris intro | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/outlets` (9 tab) | Header › Tab hub › Intro › Tab › grid 8 kartu | Tambah Outlet @ baris intro | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/pages` (9 tab) | Header › Tab hub › Intro › Kartu tipis | Buat Halaman Baru @ baris intro | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/cms/reviews` (9 tab) | Header › Tab hub › Intro › Tab › Kartu tipis | — | daftar dijadikan kartu per baris, intro bertumpuk, tab > 6, tinggi kontrol beda, toolbar terlipat |
| `/admin/configuration/sales-schemas` (6 tab) | Header › Tab hub › Kartu filter › judul «Sales Schemas» › Intro › Kartu filter › Kartu tabel › Kartu tipis+judul | Buat Aturan @ lepas | filter halaman dikotakkan, filter terpisah dari tabelnya, tab berbingkai di kartu |
| `/admin/integrations` (6 tab) | Header › Tab hub › grid 2 kartu › Kartu form+judul | Tes Token Tersimpan @ dalam kartu | daftar dijadikan kartu per baris, kartu tipis (pesan/progress) |
| `/admin/integrations/email` (6 tab) | Header › Tab hub › grid 4 kartu › Kartu form+judul | Kirim Tes (Konfigurasi @ dalam kartu | daftar dijadikan kartu per baris, kartu tipis (pesan/progress) |
| `/admin/loyalty` (5 tab) | Header › Tab hub › 4 KPI › grid 2 kartu › Kartu tipis+judul | — | intro bertumpuk, kartu tipis (pesan/progress), tab > 6, tab berbingkai di kartu, toolbar terlipat |
| `/admin/loyalty/customers/:id` (3 tab) | Header+aksi › 4 KPI › Tab › Kartu filter | Sesuaikan Poin @ samping judul | filter halaman dikotakkan |
| `/admin/master/items` (10 tab) | Header+aksi › Tab hub › Kartu tabel | Tambah Item @ samping judul | nominal rata kiri, tab > 6 |
| `/admin/operations` (8 tab) | Header › Tab hub › Intro › 4 KPI › grid 2 kartu ×2 | — | aksi ganda, filter terpisah dari tabelnya, grid yatim, intro bertumpuk, kartu tipis (pesan/progress), tab > 6, tombol utama bersaing |
| `/admin/operations/data-management` (8 tab) | Header › Tab hub › Intro › 3 KPI › Tab › Kartu+judul › grid 2 kartu | Ekspor @ bawah kartu | aksi ganda, filter terpisah dari tabelnya, grid yatim, intro bertumpuk, kartu tipis (pesan/progress), tab > 6, tombol utama bersaing |
| `/admin/operations/report-schedules` (8 tab) | Header › Tab hub › Intro › Tab › Kartu tipis | Tambah Jadwal @ baris intro | aksi ganda, filter terpisah dari tabelnya, grid yatim, intro bertumpuk, kartu tipis (pesan/progress), tab > 6, tombol utama bersaing |
| `/admin/operations/tour-analytics` (8 tab) | Header › Tab hub › Intro › 5 KPI › grid 2 kartu › Kartu tipis+judul | — | aksi ganda, filter terpisah dari tabelnya, grid yatim, intro bertumpuk, kartu tipis (pesan/progress), tab > 6, tombol utama bersaing |
| `/admin/settings` | Header › Kartu form+judul › Kartu+judul | Simpan @ dalam kartu | aksi ganda, simpan per baris, tombol utama bersaing, toolbar terlipat |
| `/admin/setup` (3 tab) | Header › Tab hub › grid 18 kartu | — | data seragam jadi grid kartu, intro bertumpuk, kartu tipis (pesan/progress) |
| `/admin/smart-seo` | Header+aksi › Kartu menu › grid 5 kartu | Optimasi Semua @ samping judul | kartu tipis (pesan/progress), simpan jauh di atas form, tombol utama bersaing |
| `/admin/user-management` (3 tab) | Header › Tab hub › Kartu tabel | Tambah User @ lepas | data seragam jadi grid kartu, intro bertumpuk, kartu tipis (pesan/progress), tinggi kontrol beda, toolbar terlipat |

### /executive

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/executive/ai-qa` | Header › Kartu | Kirim @ bawah kartu | ✓ |
| `/executive/analytics` (4 tab) | Header+aksi › Kartu menu › 4 KPI ×2 › judul «Brand & Cash» › Kartu chart+judul › Kartu › Kartu+judul › judul «Trend & AI Insig» › … | Ekspor PDF @ samping judul | blok tanpa judul di antara blok berjudul, judul campur luar/dalam kartu, judul ganda, kartu kosong, kartu tipis (pesan/progress), tab berbingkai di kartu, toolbar terlipat |
| `/executive/analytics-hub` (3 tab) | Header › Tab hub › Intro › 3 KPI › Kartu chart+judul › grid 5 kartu | — | blok tanpa judul di antara blok berjudul, kartu tipis (pesan/progress), toolbar terlipat |
| `/executive/anomaly` | Header+aksi › 5 KPI › Kartu filter › Kartu | Jalankan Scan @ samping judul | filter halaman dikotakkan, toolbar terlipat |
| `/executive/brand/:id` (3 tab) | Header+aksi › 4 KPI › Tab › Kartu tipis | — | kartu tipis (pesan/progress) |
| `/executive/budget-approvals` | Header › Kartu+judul | — | ✓ |
| `/executive/budget-increase-requests` (3 tab) | Header+aksi › Tab hub › Kartu+judul | Setujui @ bawah kartu | kartu tipis (pesan/progress) |
| `/executive/budget-monitor` (4 tab) | Header+aksi › Kartu filter › 5 KPI › Tab › Kartu tabel+judul | — | filter halaman dikotakkan, nominal rata kiri |
| `/executive/outlet-budgets` (2 tab) | Header+aksi › Kartu filter › 5 KPI › Kartu tabel+judul › Kartu | Simpan Budget @ kartu filter | aksi header turun baris, angka terpotong, blok tanpa judul di antara blok berjudul, filter halaman dikotakkan, simpan jauh di atas form, tab berbingkai di kartu, tabel melebar, toolbar terlipat |
| `/executive/outlet/:id` (4 tab) | Header+aksi › 4 KPI › Tab › 6 KPI › Kartu chart+judul | — | kolom KPI berubah |
| `/executive/reservations` | Header+aksi › Kartu filter › 4 KPI › grid 2 kartu | — | filter halaman dikotakkan |

### /finance

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/finance/assets` | Header+aksi › 3 KPI › Kartu filter › Kartu tabel | Tambah Aset @ samping judul | filter terpisah dari tabelnya |
| `/finance/assets/:id` | Header+aksi › 4 KPI › Kartu+judul › Kartu tabel+judul | — | ✓ |
| `/finance/budget-hub` (3 tab) | Header › Tab hub › Kartu filter › 5 KPI › judul «Ringkasan P&L» › 3 KPI › Kartu tabel+judul › 3 KPI | — | angka terpotong, blok tanpa judul di antara blok berjudul, filter halaman dikotakkan, grid yatim, grup KPI berjudul & tidak, intro bertumpuk, kolom KPI berubah, toolbar terlipat |
| `/finance/coa` | Header+aksi › grid 2 kartu | — | toolbar terlipat |
| `/finance/journals` | Header+aksi › Kartu filter › Kartu tabel | Buat Manual Journal @ samping judul | aksi header turun baris, filter terpisah dari tabelnya, kolom sempit |
| `/finance/journals/:id` | Header+aksi › Kartu tipis › Kartu tabel+judul | — | grid yatim, kartu tipis (pesan/progress) |
| `/finance/manual-journal` | Header+aksi › Kartu+judul › Kartu form › Kartu tabel+judul | Posting jurnal @ samping judul | blok tanpa judul di antara blok berjudul, tinggi kontrol beda |
| `/finance/payment-run-templates/:id` | Kartu tipis | — | ✓ |
| `/finance/payment-runs/:id` | Header › Kartu tipis+judul › 4 KPI › Kartu tipis+judul › Kartu+judul | — | kartu tipis (pesan/progress) |
| `/finance/payments-hub` (8 tab) | Header › Tab hub › Intro › 4 KPI › Kartu filter › Kartu tabel | Buat Payment @ baris intro | blok tanpa judul di antara blok berjudul, filter halaman dikotakkan, filter terpisah dari tabelnya, intro bertumpuk, istilah EN/ID campur, kartu kosong, kartu tipis (pesan/progress), kolom sempit, tab > 6, tab berbingkai di kartu, tab terpotong, tabel melebar, toolbar terlipat |
| `/finance/payments/:id` | Header › Kartu › Kartu tipis | — | kartu tipis (pesan/progress) |
| `/finance/payments/new` | Header › Kartu form | Simpan & ajukan approv @ bawah kartu | simpan hanya di bawah lipatan |
| `/finance/period-closing` | Header+aksi › grid 4 kartu | Lanjut @ bawah kartu | grid yatim, kartu tipis (pesan/progress), toolbar terlipat |
| `/finance/period-closing/:id` | Header+aksi › 4 KPI › Kartu+judul › Kartu menu+judul › grid 2 kartu | Kunci periode @ samping judul | kartu tipis (pesan/progress) |
| `/finance/reports` (8 tab) | Header+aksi › Tab hub › grid 3 kartu | — | aksi ganda, angka terpotong, filter halaman dikotakkan, grid yatim, kartu kosong, kartu tipis (pesan/progress), tab terpotong, toolbar terlipat |
| `/finance/tax` (6 tab) | Header › Tab hub › grid 2 kartu | — | filter halaman dikotakkan, kartu tipis (pesan/progress), toolbar terlipat |
| `/finance/validation` (3 tab) | Header › Tab hub › Kartu tipis | — | ✓ |
| `/finance/vendor-scorecard` | Header+aksi › Kartu filter › 4 KPI › grid 2 kartu | — | filter halaman dikotakkan, kartu tipis (pesan/progress), kolom sempit |

### /hr

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/hr/compensation` (7 tab) | Header+aksi › Tab hub › Tab › Intro › Kartu tabel | Generate Payroll @ lepas | kolom sempit, tab > 6, tabel melebar, tinggi kontrol beda, tombol utama bersaing |
| `/hr/job-applications` | Header+aksi › Kartu filter › Kartu tipis | — | filter halaman dikotakkan, tinggi kontrol beda |
| `/hr/job-listings` | Header+aksi › grid 8 kartu | Tambah Lowongan @ samping judul | data seragam jadi grid kartu |
| `/hr/leaves` (2 tab) | Header+aksi › 4 KPI › Tab › Kartu tabel | Ajukan Cuti @ samping judul | kolom sempit, tinggi kontrol beda, tombol utama bersaing |

### /inventory

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/inventory/balance` (2 tab) | Header+aksi › Tab hub › grid 2 kartu | — | filter halaman dikotakkan |
| `/inventory/low-stock` | Header+aksi › 4 KPI › Kartu filter › Kartu tabel | Buat PR (0) @ kartu filter | filter terpisah dari tabelnya, kolom sempit, toolbar terlipat |
| `/inventory/market-list` | Header+aksi › 4 KPI › Kartu form › Kartu tabel | Buat Quarter @ samping judul | ✓ |
| `/inventory/movements-hub` (3 tab) | Header+aksi › Tab hub › grid 2 kartu | — | intro bertumpuk, kolom sempit, tombol utama bersaing |
| `/inventory/opname` | Header+aksi › Kartu tabel | Mulai Opname @ samping judul | kolom sempit |
| `/inventory/opname/:id` | Header+aksi › Kartu tipis › Kartu+judul › Kartu filter › Kartu tabel | Ajukan opname @ samping judul | blok tanpa judul di antara blok berjudul, filter terpisah dari tabelnya, kartu tipis (pesan/progress), simpan di header, simpan jauh di atas form |
| `/inventory/transfers/:id` | Header › 4 KPI › Kartu tipis+judul › Kartu tabel+judul › Kartu tipis+judul | — | kartu tipis (pesan/progress) |
| `/inventory/valuation` | Header+aksi › Kartu filter › KPI ×3 › Kartu+judul | — | filter halaman dikotakkan |

### /my-approvals

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/my-approvals` (2 tab) | Header+aksi › Tab hub › 5 KPI › grid 35 kartu | — | daftar dijadikan kartu per baris, intro bertumpuk |

### /outlet

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/outlet/budget` (2 tab) | Kartu filter › Header+aksi › Tab hub › Kartu tipis › grid 3 kartu › Kartu tipis+judul › Kartu tabel+judul | — | angka terpotong, blok tanpa judul di antara blok berjudul, filter halaman dikotakkan, kartu konteks di atas judul, kartu tipis (pesan/progress) |
| `/outlet/crm` (4 tab) | Kartu filter › Header+aksi › 5 KPI › judul «Aksi Cepat» › Kartu form+judul › grid 3 kartu | Buat Reservasi @ samping judul | filter halaman dikotakkan, kartu konteks di atas judul, kartu kosong, kartu tipis (pesan/progress), tab berbingkai di kartu |
| `/outlet/daily-orders` (3 tab) | Kartu filter › Header › Tab hub › grid 2 kartu | KDO Baru @ atas kartu | aksi ganda, filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/daily-sales` (5 tab) | Kartu filter › Header+aksi › Kartu filter › Tab › Kartu tabel | Daily Sales Baru @ samping judul | filter halaman dikotakkan, kartu konteks di atas judul, toolbar terlipat |
| `/outlet/daily-sales/:id` | Kartu filter › Header › Kartu tipis ×2 › Kartu tipis+judul › grid 2 kartu › Kartu tipis+judul | — | blok tanpa judul di antara blok berjudul, filter halaman dikotakkan, kartu konteks di atas judul, kartu tipis (pesan/progress) |
| `/outlet/daily-sales/:id/edit` | Kartu filter › Header+aksi › Kartu menu › Kartu filter › Kartu form+judul › Kartu tabel › Kartu tipis | Submit @ samping judul | blok tanpa judul di antara blok berjudul, filter halaman dikotakkan, kartu konteks di atas judul, kartu tipis (pesan/progress), simpan di header, simpan jauh di atas form, tinggi kontrol beda |
| `/outlet/daily-sales/new` | Kartu filter › Header+aksi › Kartu menu › Kartu filter › Kartu form+judul › Kartu tabel › Kartu tipis | Submit @ samping judul | blok tanpa judul di antara blok berjudul, filter halaman dikotakkan, kartu konteks di atas judul, kartu tipis (pesan/progress), simpan di header, simpan jauh di atas form, tinggi kontrol beda |
| `/outlet/end-of-day` | Kartu filter › Header+aksi › Kartu tipis › grid 4 kartu | Kembali ke Overview @ bawah kartu | aksi ganda, filter halaman dikotakkan, kartu konteks di atas judul, kartu tipis (pesan/progress), toolbar terlipat |
| `/outlet/inventory/stock-check` | Kartu filter › Header+aksi › 3 KPI › Kartu tabel | — | filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/inventory/transfers` (4 tab) | Kartu filter › Header+aksi › 3 KPI › Tab › Kartu tabel | Transfer Baru @ samping judul | filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/inventory/usage` (5 tab) | Kartu filter › Header+aksi › 3 KPI › Tab › Kartu tabel | — | filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/loyalty/input-poin` | Kartu filter › Header › Kartu filter | Cari @ kartu filter | filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/petty-cash` | Kartu filter › Header+aksi › 6 KPI › Kartu tabel | Transaksi Baru @ samping judul | filter halaman dikotakkan, kartu konteks di atas judul, kolom sempit |
| `/outlet/reservations` | Kartu filter › Header+aksi › 5 KPI › Kartu filter › Kartu tabel | Buat Reservasi @ samping judul | filter terpisah dari tabelnya, kartu konteks di atas judul |
| `/outlet/reservations/:id/edit` | Kartu filter › Header › Kartu filter ×2 › Kartu form+judul › Kartu filter ×2 | Simpan Perubahan @ lepas | filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/reservations/new` | Kartu filter › Header › Kartu filter ×2 › Kartu form+judul › Kartu filter ×2 | Buat Reservasi @ lepas | filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/urgent-purchase` (4 tab) | Kartu filter › Header+aksi › Tab hub › Kartu tabel | Urgent Purchase Baru @ samping judul | aksi ganda, filter halaman dikotakkan, kartu konteks di atas judul |
| `/outlet/voucher-redeem` | Kartu filter › Header › Kartu form › Kartu filter › Kartu tipis+judul | Verifikasi @ atas kartu | filter halaman dikotakkan, kartu konteks di atas judul, kartu tipis (pesan/progress) |

### /owner

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/owner` | Header+aksi › judul «KPI Utama» › 4 KPI › judul «Cash & Digest» › Kartu › Kartu+judul › judul «Approval Pending» › Kartu+judul › … | Kirim Digest @ samping judul | judul campur luar/dalam kartu, judul ganda, kartu tipis (pesan/progress), toolbar terlipat |
| `/owner/briefing` | Header+aksi › Kartu+judul › grid 4 kartu › Kartu tipis › judul «Tindakan Priorit» | — | blok tanpa judul di antara blok berjudul, kartu tipis (pesan/progress) |
| `/owner/cash` (3 tab) | Header+aksi › KPI ×4 › Kartu tipis › judul «Akun likuid» › grid 3 kartu › Kartu chart+judul | Akun Baru @ samping judul | aksi header turun baris, blok tanpa judul di antara blok berjudul, kartu kosong, kartu tipis (pesan/progress), tab berbingkai di kartu |
| `/owner/digest-settings` | Header+aksi › Kartu tipis+judul › Kartu+judul ×2 | Kirim Sekarang @ samping judul | aksi header turun baris |

### /procurement

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/procurement/consolidation` | Header+aksi › Kartu filter › grid 2 kartu | Buat PO @ samping judul | filter halaman dikotakkan, kartu kosong, toolbar terlipat |
| `/procurement/gr` | Header+aksi › Kartu filter › Kartu tabel | Posting GR @ samping judul | filter terpisah dari tabelnya, tinggi kontrol beda |
| `/procurement/gr/new` | Header+aksi › Kartu filter › Kartu tabel+judul › Kartu form | Posting GR @ samping judul | filter terpisah dari tabelnya |
| `/procurement/kanban` | Header+aksi › Kartu filter | — | aksi header turun baris, filter halaman dikotakkan, istilah EN/ID campur, toolbar terlipat |
| `/procurement/po` (8 tab) | Header+aksi › Kartu filter › Kartu tabel | PO Baru @ samping judul | filter halaman dikotakkan, filter terpisah dari tabelnya, kolom sempit, tab > 6, tab berbingkai di kartu, toolbar terlipat |
| `/procurement/po/:id` | Header+aksi › Kartu › Kartu+judul › Kartu tabel+judul | — | blok tanpa judul di antara blok berjudul |
| `/procurement/po/new` | Header+aksi › grid 3 kartu › Kartu tipis+judul | Simpan PO @ samping judul | kartu tipis (pesan/progress), simpan di header |
| `/procurement/pr` (6 tab) | Header+aksi › Kartu filter › Kartu tabel | PR Baru @ samping judul | filter terpisah dari tabelnya, kolom sempit, tab berbingkai di kartu, tinggi kontrol beda |
| `/procurement/pr/:id` | Header+aksi › Kartu tipis › Kartu tipis+judul › Kartu tabel+judul › grid 2 kartu | Buat PO dari PR @ samping judul | blok tanpa judul di antara blok berjudul, kartu tipis (pesan/progress) |
| `/procurement/pr/new` | Header+aksi › Kartu filter › Kartu tabel+judul › Kartu form | Ajukan PR @ samping judul | filter terpisah dari tabelnya, simpan di header |
| `/procurement/price-intelligence` | Header+aksi › 4 KPI › Kartu+judul › Kartu tipis+judul | — | angka terpotong, kartu tipis (pesan/progress) |
| `/procurement/rfq` | Header+aksi › Kartu filter › Kartu tabel | Buat RFQ @ samping judul | filter terpisah dari tabelnya |
| `/procurement/rfq/:id` (3 tab) | Header+aksi › Tab hub › grid 2 kartu | Tandai dikirim @ samping judul | kartu tipis (pesan/progress), tombol utama bersaing |
| `/procurement/rfq/new` | Header › Kartu form+judul › Kartu filter › Kartu form+judul | Buat RFQ @ lepas | filter halaman dikotakkan |
| `/procurement/vendor-catalog` | Header+aksi › Kartu filter › Kartu tipis | — | filter halaman dikotakkan |
| `/procurement/vendor-comparison` (2 tab) | Header+aksi › Tab hub › grid 3 kartu | — | kartu tipis (pesan/progress), toolbar terlipat |
| `/procurement/vendor-recommend` | Header › Kartu filter › Kartu | — | filter halaman dikotakkan |
| `/procurement/vendor-scorecard` | Header+aksi › Kartu tabel | — | ✓ |
| `/procurement/vendors` | Header+aksi › Kartu filter › grid 6 kartu | — | filter halaman dikotakkan, kartu tipis (pesan/progress) |

### /reports

| Halaman | Kerangka (layar awal) | Aksi utama @ letak | Temuan |
|---|---|---|---|
| `/reports/ap-aging` | Header+aksi › Kartu+judul | Ekspor Excel @ bawah kartu | aksi header turun baris, toolbar terlipat |
| `/reports/daily-sales` | Header+aksi › Kartu+judul › Kartu tabel+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/fdo-history` | Header+aksi › Kartu form+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/gr-summary` | Header+aksi › Kartu+judul | Ekspor Excel @ bawah kartu | toolbar terlipat |
| `/reports/inventory-valuation` | Header+aksi › Kartu+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/journal-ledger` | Header+aksi › Kartu form+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/outlet-performance` | Header+aksi › Kartu+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/pl-group` | Header+aksi › Kartu form+judul › Kartu+judul | Ekspor Excel @ bawah kartu | aksi header turun baris |
| `/reports/po-summary` | Header+aksi › Kartu form+judul | Ekspor Excel @ bawah kartu | toolbar terlipat |
| `/reports/stock-balance` | Header+aksi › Kartu+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/stock-movement` | Header+aksi › Kartu form+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/trial-balance` | Header+aksi › Kartu form+judul | Ekspor Excel @ bawah kartu | ✓ |
| `/reports/vendor-performance` | Header+aksi › Kartu+judul | Ekspor Excel @ bawah kartu | toolbar terlipat |
