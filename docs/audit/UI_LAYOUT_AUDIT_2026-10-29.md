# Audit komposisi UI ("benar per elemen, salah secara garis besar") — 29 Okt 2026

Pemicu: toolbar Payments: setiap elemennya sudah sesuai design system (tab, input, tombol), tetapi susunannya
membuat layar terasa salah. Audit ini mencari masalah sejenis di seluruh aplikasi.

**Metode**
1. Crawler komposisi `scripts/ui_metrics/layout.js` membuka 170 halaman ERP dan 559 state
   (halaman + tab), viewport 1280×800, super admin. Heuristiknya: toolbar terlipat, tab terpotong, aksi header
   turun baris, kalimat pengantar bertumpuk, istilah campur, angka terpotong, tombol utama bersaing, bingkai
   di dalam bingkai, grid yatim, kartu kosong, kolom sempit, dan tabel melebar.
2. Setiap kategori diverifikasi lewat screenshot. Temuan palsu dibuang dan heuristiknya diperbaiki, misalnya
   tombol overlay header fase di Period Closing yang sengaja ditumpuk, atau container halaman yang terhitung
   sebagai toolbar.
3. Pengamatan manual untuk hal yang tidak bisa dideteksi otomatis: pola antar-halaman, form, dialog,
   informasi ganda, dan konsistensi istilah.

Angka per kategori ada di [Lampiran A](#lampiran-a--angka-crawler). Ringkasan pola di bawah diurutkan
berdasarkan dampaknya bagi pengguna.

---

## Ringkasan: 14 pola

| # | Pola | Contoh nyata | Cakupan | Akar masalah |
|---|---|---|---|---|
| 1 | Toolbar daftar tanpa pola baku | Payments, Purchase Orders, Stock Transfer | toolbar terlipat di 34 halaman; pola beda di semua daftar | tiap halaman merakit toolbar sendiri |
| 2 | Tab hub terpotong / terlalu banyak | Payments & Reports (tab terakhir tak terlihat), Master Data 10 tab | 19 halaman | `TabsList` tanpa overflow |
| 3 | Kalimat pengantar bertumpuk | Payments, Operations, CMS, Stock Movements | 20 halaman | subtitle hub + intro tab |
| 4 | Istilah campur untuk hal yang sama | KPI "Approved / Paid" vs tab "Disetujui / Dibayar" | 2 halaman + form | label KPI/form tidak memakai kamus status |
| 5 | Angka uang terpotong "…" | Budget Allocation "Rp 425.00…" | 5 halaman | KPI 5 kolom + `truncate` |
| 6 | Kolom kanan/aksi hilang, kolom sempit | Compensation (tombol Ajukan/Tolak terpotong) | 3 halaman / 11 halaman | lebar kolom tidak diatur |
| 7 | Tombol utama berjajar di tabel | Transfer (Kirim/Terima ×11), Scheduler (Jalankan ×12) | 10 halaman | aksi baris memakai varian `default` |
| 8 | Bingkai di dalam bingkai | Status tabs di dalam kartu filter; Approval Matrix 3 lapis | 9 halaman | TabsList berbingkai + kartu |
| 9 | Aksi header turun ke baris sendiri | Approval Matrix ("Simpan Workflow" sendirian), Budget Allocation | 8 halaman | `PageHeader` `flex-wrap` + subtitle panjang |
| 10 | Grid/form tidak seimbang | Budget: 5 KPI di grid 4 kolom; form label 2 baris | 8 halaman | jumlah kolom ≠ jumlah item |
| 11 | Aksi berulang tanpa hierarki | System Settings: 6 tombol "Simpan" | 10 halaman | simpan per baris |
| 12 | Kartu tinggi tapi kosong | Forecast guard (28% terisi), Cash position | 6 halaman | grid `stretch` |
| 13 | Informasi ganda di satu layar | Cash position: runway 63 hari ×3 | manual | KPI + banner + subtitle |
| 14 | Format input ≠ format tampilan | input "110000000" di samping "Rp 425.000.000"; tanggal "10/29/2026" vs "24 Okt 2026" | 116 input tanggal di 77 file | input native tanpa format |

---

## 1. Toolbar daftar tidak punya pola baku

Masalah ini sama dengan screenshot Payments.

**Yang terlihat**

*Payments*
- 8 tab status mengisi baris pertama.
- Kolom cari sendirian di baris kedua, rata kanan, sehingga kedua baris setengah kosong.
- Tab status berbingkai di dalam kartu (lihat pola 8).

*Purchase Orders*
- Polanya sama: 8 tab status.
- Baris kedua berisi chip "Semua" yang maknanya tidak jelas, lalu dua select.
- Tidak ada kolom cari.

*Stock Transfer*
- Select outlet dan tombol "Transfer Baru" bertumpuk vertikal di kanan.
- Judul bagian "Stock Transfers" plus subtitle muncul di bawah h1.

**Tidak konsisten antar halaman** (fakta crawler):

| Elemen | Variasi yang ditemukan |
|---|---|
| Filter status | **tab** (4 halaman: Payments, PO, Payment runs, …), **select "Semua status"** (22 file), **chip** (beberapa) |
| Kolom cari | kiri 28 halaman / kanan 6; di dalam kartu 19 / di luar 15 |
| Tombol buat baru | di header 19 halaman / di kartu 11 / di tempat lain 21 |
| Tombol ekspor | di header (PO), di kartu filter (P&L), per kartu (Procurement reports) |

**Mengapa salah**
- Pengguna ERP berpindah antar puluhan daftar setiap hari.
- Bila letak cari, filter, dan tombol berubah-ubah, setiap halaman harus "dibaca ulang" (hukum Jakob, konsistensi internal).
- Baris setengah kosong memecah pengelompokan (gestalt *proximity*): cari tampak bukan bagian dari filter.

**Usulan: `ListToolbar` (primitive baru) + aturan**

```
[🔍 Cari …          ] [Semua·Draft·Menunggu·Disetujui·Dibayar] [Status lain ▾]   [filter…]   [Ekspor]
```

- Satu baris pada lebar ≥ 1024px:
  - cari di kiri, lebar tetap 280px;
  - status di tengah: maksimal 5 tab + menu "Status lain";
  - filter tambahan dan aksi sekunder di kanan.
- Tanpa bingkai tambahan. Toolbar menempel di atas tabel, di dalam kartu tabel yang sama.
- **Tombol buat baru selalu di `PageHeader`.** Ekspor selalu di ujung kanan toolbar.
- Status memakai tab bila ≤ 5 status utama; bila lebih, gunakan select.
- Migrasi kira-kira 35 halaman daftar. Polanya mekanis setelah primitive tersedia.

**Pertanyaan "Diajukan" vs "Menunggu Approval" (sudah dicek di backend)**
- `payment_service.submit_payment` menetapkan status `submitted` bila **tidak ada** workflow approval, dan
  `awaiting_approval` bila ada.
- Bagi pengguna keduanya tahap yang sama (menunggu disetujui). KPI "Menunggu Approval" juga sudah menjumlahkan keduanya.
- Usulan: satu tab **"Menunggu Approval"** yang memfilter kedua status. Tab status Payments menjadi:
  Semua · Draft · Menunggu Approval · Disetujui · Dibayar · [Ditolak, Dibatalkan di "Status lain"].

## 2. Tab hub terpotong / terlalu banyak tab

**Yang terlihat**
- **Payments hub & Reports hub**: tab ke-8 ("Reservation deposits", "Procurement reports") terpotong di tepi
  kanan pada 1280px. Saat tab itu aktif, bar ter-scroll dan tab pertama yang terpotong ("…ce").
- Tidak ada tanda bahwa masih ada tab lain.
- Terlalu banyak tab dalam satu bar:

| Halaman | Jumlah tab |
|---|---|
| Master Data | 10 |
| CMS | 9 |
| Operations | 8 |
| Compensation | 7 |
| CRM analytics | 7 |

**Mengapa salah**
- Tab yang tidak terlihat = fitur yang tidak ditemukan.
- Lebih dari 7 tab melampaui kemampuan pindai sekilas.

**Usulan**
- `TabsList` hub: bila overflow, beri gradasi tepi dan tombol ‹ ›, atau pindahkan tab sisa ke menu
  "Lainnya ▾" (prioritas: tab aktif selalu terlihat).
- Master Data (10) dan CMS (9) lebih cocok memakai navigasi sekunder vertikal (daftar di kiri) daripada tab horizontal.

## 3. Kalimat pengantar bertumpuk

**Yang terlihat**
- Payments: subtitle hub ("Hutang (AP), pembayaran, payment run, rekonsiliasi bank, …") lalu langsung kalimat
  intro tab ("Pembayaran ke vendor, karyawan, dan pihak lain — …").
- Pola yang sama muncul di setiap tab Operations, CMS, Budget management, User management, Delegasi
  (3 kalimat), dan Bulk import.
- Stock Movements › Transfer:
  - h1 + subtitle;
  - lalu h2 "Stock Transfers" + subtitle kedua yang isinya hampir sama.

**Mengapa salah**
- Dua paragraf pembuka sebelum konten mendorong data ke bawah lipatan layar.
- Pengguna berhenti membaca keduanya (*banner blindness*).

**Usulan**
- Hub meneruskan deskripsi tab aktif ke `PageHeader.subtitle`, yaitu satu kalimat yang berganti sesuai tab.
- Intro di dalam tab dihapus, atau dipindah ke `InlineHelp`.
- Judul bagian (h2) yang mengulang nama tab dihapus.

## 4. Istilah campur untuk konsep yang sama

**Yang terlihat**

*Payments*
- KPI "APPROVED (SIAP BAYAR)" dan "PAID 2026-10" bersebelahan dengan tab "Disetujui" dan "Dibayar".
- Tombol "Buat Payment" membuka halaman berjudul "New Payment".

*Form New Payment*
- Label campur bahasa: "Payee Type", "Request Date", "Amount Bruto (Rp)", "Bank Account (dari mana dibayar)", "Description".
- Placeholder justru berbahasa Indonesia ("Alasan/keperluan pembayaran…").

*Tempat lain*
- Payment runs: KPI "Confirmed (siap eksekusi)".
- Legenda Period Closing: "Terbuka dapat diposting · Ditutup soft-close · Dikunci hard-lock".

**Mengapa salah**
- Pengguna mengira "Approved" dan "Disetujui" adalah dua hal berbeda.
- Ini pola yang membuat ERP terasa "tambal sulam".

**Usulan**
- Label KPI status diambil dari kamus status yang sama dengan `StatusPill`.
- Label form dalam Bahasa Indonesia; istilah ERP (COA, GL, Invoice, AP/AR) tetap boleh.
- Judul halaman mengikuti label tombol yang membukanya ("Buat Payment" → "Buat Payment").

## 5. Angka uang terpotong "…"

**Yang terlihat**
- Budget Allocation: 5 KPI dalam satu baris, nilainya terpotong ("Rp 425.00…", "Rp 137.50…", "Rp 590.00…").
- AP aging: "Rp 52.264.704" terpotong. Petty cash: "Rp 43.351.169" terpotong.
- Subtitle KPI P&L terpotong ("Margin 6…").
- Cash position: nama akun terpotong ("Petty Cash The Bi…").

**Mengapa salah**
- Untuk aplikasi keuangan, angka yang terpotong lebih buruk daripada tidak ditampilkan: pengguna bisa salah membaca.

**Usulan**
- `CompactStatCard`: nilai **tidak pernah** di-`truncate`. Bila sempit, font turun satu tingkat atau memakai
  format ringkas ("Rp 425 jt") dengan nilai penuh di tooltip.
- Grid KPI maksimal 4 kolom pada 1280px.

## 6. Kolom aksi hilang & kolom sempit

**Yang terlihat**
- Compensation › Advances: tombol "Ajukan" dan "Tolak" terpotong di tepi kanan, sehingga aksi utama tidak terlihat
  tanpa scroll horizontal.
- AR invoices dan matriks Budget Allocation: kolom terakhir terpotong.
- 11 halaman: tanggal terlipat ("24 Okt / 2026"), nama karyawan terlipat, nomor dokumen terlipat
  ("TRF-RST-261020- / 12"), padahal kolom deskripsi masih lega.

**Usulan** (di `DataTable`)
- Kolom tanggal, nomor dokumen, dan nominal `whitespace-nowrap`.
- Kolom aksi `sticky right-0`.
- Kolom teks panjang (deskripsi) yang menyerap sisa lebar.

## 7. Tombol utama berjajar di tabel

**Yang terlihat**
- Transfer: tombol hitam "Kirim/Terima" di 11 baris.
- Scheduler: "Jalankan" ×12.
- Compensation: "Setujui" hitam di setiap baris.
- Period Closing: 3 tombol outline × 12 baris membentuk dinding tombol. "Tutup" tanpa ikon, sementara "Wizard"
  dan "Kunci" berikon.

**Mengapa salah**
- Tombol utama (hitam) menandai *satu* aksi terpenting di layar.
- Bila ada 12, tidak ada yang menonjol, dan tombol "Buat …" di header kalah bersaing.

**Usulan**
- Aksi baris memakai `variant="outline" size="sm"` (maksimal 1 aksi kontekstual per baris).
- Aksi lain masuk ke menu "⋯".
- Varian `default` (hitam) hanya untuk satu aksi utama halaman.

## 8. Bingkai di dalam bingkai

**Yang terlihat**
- TabsList berbingkai di dalam kartu filter: Payments, Payment runs, Cash position, widget Sales Analytics.
- Approval Matrix: kartu Tier › kotak "Kondisi" › kotak "Step", tiga lapis bingkai.
- New Payment: kotak abu-abu di dalam kartu form.
- Period Closing: kartu fase › bingkai filter + bingkai tabel.

**Usulan**
- Maksimal 2 lapis bingkai.
- Di dalam kartu, tab status tanpa bingkai (segmented tanpa border).
- Pengelompokan dalam form memakai judul kecil + garis pemisah, bukan kotak.

## 9. Aksi header turun ke baris sendiri

**Yang terlihat**
- Approval Matrix: "Simpan Workflow" sendirian di baris di bawah judul.
- Budget Allocation: "1 permintaan menunggu · Budget Monitor".
- Halaman lain: Journals, Owner Cash, Digest settings, Report Center AP aging & P&L group.

**Akar masalah & usulan**
- Akarnya: `PageHeader` memakai `flex-wrap`. Bila subtitle panjang, blok judul memakan seluruh lebar dan aksi turun.
- Perbaikannya satu baris di `PageHeader`: blok judul `flex-1 min-w-0` (subtitle boleh 2 baris), aksi
  `shrink-0`, tanpa wrap pada ≥ md. Semua halaman ikut terperbaiki.

## 10. Grid & form tidak seimbang

**Yang terlihat**
- Budget vs Actual:
  - 5 KPI di grid 4 kolom, sehingga "Marketing" sendirian di baris kedua;
  - tepat di bawahnya 3 KPI P&L dengan lebar berbeda.
- Pivot (6 item di 5 kolom), Rate limits (4 di 3).
- Dialog Tambah Item: "Satuan" sendirian setengah lebar.
- Approval Matrix: label "Nominal Maks (kosong = tanpa batas)" terlipat 2 baris, sehingga input di sebelahnya tidak sejajar.
- Budget: semua ikon KPI memakai ikon "tren turun" yang sama apa pun datanya (dekorasi yang tampak bermakna).

**Usulan**
- Jumlah kolom grid = jumlah item (≤ 4), atau `auto-fit`.
- Baris form `items-end`; penjelasan pindah ke helper text di bawah input.
- Ikon KPI netral atau mengikuti arah tren sebenarnya.

## 11. Aksi berulang tanpa hierarki

**Yang terlihat**
- System Settings: 6 tombol "Simpan" (satu per baris). Sebagian hitam (aktif), sebagian pudar (nonaktif), sehingga
  pola terang-gelap tampak acak.
- Procurement reports: "Ekspor Excel" ×4.
- Approval Matrix: "Tambah Step" ×3.
- EOD: "Muat ulang" ×2.

**Usulan**
- Form pengaturan memakai satu bar simpan (sticky) dengan deteksi perubahan.
- Label ekspor spesifik ("Ekspor PR", "Ekspor PO").

## 12. Kartu tinggi tapi kosong

**Yang terlihat**
- Sales Analytics: kartu Forecast guard hanya terisi 28%.
- Cash position: kartu Bank 55% (2 akun, sementara kartu Petty Cash di sebelahnya berisi 4 akun).
- Balance Sheet: Equity 50%.
- Procurement reports: kartu PO.

**Usulan**
- Grid kartu memakai `items-start`, atau isi disusun ulang (2 kolom/masonry) agar tidak ada blok kosong.

## 13. Informasi ganda di satu layar

**Yang terlihat**
- Cash position: runway 63 hari tampil tiga kali, di KPI "Days runway", di banner hijau
  ("Sehat — runway > 45 hari … 63 hari"), dan di subtitle KPI "Sehat".
- Sales Analytics: aksi tersebar di dua tempat (Live/Ekspor di header, Profit Walk/Period Compare di bar filter).

**Usulan**
- Satu informasi, satu tempat. Banner hanya untuk kondisi yang menuntut tindakan (peringatan), bukan untuk menegaskan "Sehat".

## 14. Format input ≠ format tampilan

**Yang terlihat**
- Budget Allocation: input nominal "110000000" tanpa pemisah ribuan, di samping KPI "Rp 425.000.000".
- Input tanggal native (116 input di 77 file) tampil "10/29/2026" atau "October 2026" mengikuti bahasa browser,
  sementara tabel menampilkan "24 Okt 2026".

**Usulan**
- `MoneyInput` (format ribuan saat mengetik).
- Untuk tanggal: `DatePicker` berbasis kalender lokal id-ID, atau minimal dokumentasikan bahwa format input
  mengikuti bahasa browser.

---

## Temuan otomatis yang dibuang (bukan masalah)

- "Elemen bertumpuk" di Period Closing & End of Day: header fase memakai tombol overlay `absolute inset-0`
  dengan ikon bantuan di atasnya. Ini disengaja; heuristik sudah dikecualikan.
- "Elemen bertumpuk" di Integrations › Email: input berada di dalam `<details>` yang tertutup, jadi tidak tampil.
- "Toolbar terlipat" pada container halaman/`page-header`: heuristik sekarang hanya menilai baris kontrol.
- Tombol "… Baru" di header + tombol yang sama di empty state: pola umum yang wajar (CTA kosong).

## Rencana perbaikan (usulan, menunggu persetujuan)

| Tahap | Isi | Dampak |
|---|---|---|
| **A — primitive (1 perubahan → banyak halaman)** | `PageHeader` tanpa wrap (9) · `CompactStatCard` tanpa truncate + grid maks 4 (5) · `TabsList` overflow ‹ › / "Lainnya" (2) · `DataTable` nowrap tanggal/nomor + kolom aksi sticky (6) · subtitle hub ikut tab + hapus intro tab (3) | cepat, risiko rendah |
| **B — pola baru + migrasi** | `ListToolbar` (1) di ±35 daftar · konvensi aksi baris outline + "⋯" (7) · kamus status untuk label KPI & form (4) · tab "Menunggu Approval" gabungan | sedang |
| **C — per halaman** | System Settings bar simpan (11) · Approval Matrix (8, 10) · Budget grid (10) · Cash position (13) · `MoneyInput` (14) · Master Data/CMS navigasi sekunder (2) | per halaman |

Setelah disetujui, aturan komposisinya ditambahkan ke `docs/DESIGN_SYSTEM.md` dan `CLAUDE.md`. Aturannya:
- 1 tombol utama per layar;
- pola toolbar daftar baku;
- maksimal 7 tab;
- satu kalimat pengantar;
- angka tidak boleh terpotong;
- maksimal 2 lapis bingkai.

`layout.js` dipakai sebagai penjaga regresinya.

---

## Lampiran A — angka crawler

| Jenis (heuristik) | Temuan | Halaman | Contoh halaman |
|---|---|---|---|
| Toolbar terlipat → baris setengah kosong (`toolbar-wrap`) | 74 | 34 | /admin/cms/analytics, /admin/cms/brands, /admin/cms/careers, /admin/cms/media |
| Kalimat pengantar bertumpuk sebelum konten (`intro-stacking`) | 162 | 20 | /admin/cms/analytics, /admin/cms/brands, /admin/cms/careers, /admin/cms/media |
| Teks terpotong (ellipsis) (`clipped-text`) | 125 | 19 | /admin, /admin/approvals, /admin/operations, /admin/operations/data-management |
| Terlalu banyak tab (> 6) dalam satu bar (`tabs-too-many`) | 37 | 18 | /admin/cms/analytics, /admin/cms/brands, /admin/cms/careers, /admin/cms/media |
| Tinggi kontrol berbeda dalam satu baris (`mixed-control-height`) | 28 | 18 | /admin/cms/analytics, /admin/cms/brands, /admin/cms/careers, /admin/cms/media |
| Kolom tabel terlalu sempit (isi terlipat) (`narrow-columns`) | 42 | 11 | /finance/journals, /finance/payments-hub, /finance/vendor-scorecard, /hr/compensation |
| >= 3 tombol utama bersaing (`many-primary`) | 30 | 10 | /admin/operations, /admin/operations/data-management, /admin/operations/report-schedules, /admin/operations/tour-analytics |
| Kontrol ganda (label sama 2x) (`duplicate-control`) | 13 | 10 | /admin/approvals, /admin/operations, /admin/operations/data-management, /admin/operations/report-schedules |
| Bingkai di dalam bingkai (TabsList berbingkai di dalam kartu) (`frame-in-frame`) | 42 | 9 | /admin/configuration/sales-schemas, /admin/loyalty, /executive/analytics, /executive/outlet-budgets |
| Grid dengan 1 item yatim di baris terakhir (`grid-orphan`) | 11 | 8 | /admin/operations, /admin/operations/data-management, /admin/operations/report-schedules, /admin/operations/tour-analytics |
| Aksi header turun ke baris sendiri (`header-actions-wrap`) | 9 | 8 | /admin/approvals, /executive/outlet-budgets, /finance/journals, /owner/cash |
| Kartu tinggi tapi sebagian besar kosong (`card-empty-space`) | 14 | 6 | /executive/analytics, /finance/payments-hub, /finance/reports, /outlet/crm |
| Angka terpotong (ellipsis) (`clipped-number`) | 18 | 5 | /executive/outlet-budgets, /finance/budget-hub, /finance/reports, /outlet/budget |
| Tabel butuh scroll horizontal (`table-h-scroll`) | 18 | 3 | /executive/outlet-budgets, /finance/payments-hub, /hr/compensation |
| Bar tab terpotong (tab tersembunyi di luar layar) (`tabs-overflow`) | 20 | 2 | /finance/payments-hub, /finance/reports |
| Istilah campur untuk konsep sama (EN vs ID) di satu layar (`term-mix`) | 20 | 2 | /finance/payments-hub, /procurement/kanban |
| Nominal rata kiri di tabel (`money-left`) | 2 | 2 | /admin/master/items, /executive/budget-monitor |

Temuan dihitung unik per halaman (state = halaman + setiap tab). Jalankan ulang: lihat `scripts/ui_metrics/README.md`.
