# Standar anatomi halaman — DRAF (menunggu persetujuan)

Status: **draf, 29 Okt 2026**. Setelah disetujui, isi dokumen ini dipindah ke `docs/DESIGN_SYSTEM.md` (acuan tunggal)
dan ringkasannya ke `CLAUDE.md`. Dasar & data pendukung: `docs/audit/UI_PAGE_ANATOMY_AUDIT_2026-10-29.md`.

Melengkapi `DESIGN_SYSTEM.md`: dokumen itu mengatur **ukuran komponen**; dokumen ini mengatur **susunan halaman** —
di mana judul, kartu, aksi, dan tombol simpan diletakkan.

## 1.1 Level & letak aksi: posisi = cakupan aksi

Aturan pokoknya: **letak tombol memberi tahu apa yang dikenainya.** Bila dua tombol berada di tempat
berbeda, cakupannya memang harus berbeda.

| Level | Judul | Letak aksi | Contoh |
|---|---|---|---|
| **Layar**: halaman, atau tab aktif pada hub | `h1` di `PageHeader`. Pada hub, subtitle mengikuti tab aktif | **Selalu di kanan judul halaman.** Maks. 1 tombol utama (hitam). Pada hub, aksi berganti mengikuti tab aktif | Buat PO, Buat Payment, Ekspor, Muat ulang |
| **Bagian**: kumpulan ≥ 2 kartu (hanya halaman dashboard) | judul bagian di luar kartu, 18px | kanan judul bagian (Lihat semua, Ciutkan) | Owner Overview: "KPI Utama" |
| **Kartu** | `CardTitle` di dalam kartu, kiri atas, 16px | kanan atas kartu (Ekspor tabel ini, Lihat detail, filter kartu) | "Detail per COA" + Ekspor |
| **Baris tabel** | — | kolom terakhir: maks. 1 aksi terlihat (outline/ghost, `sm`) + menu "⋯" | Kirim / Terima |
| **Form** (mengubah data) | judul halaman/dialog | **bar aksi sticky di bawah**: Batal · Simpan draft · Ajukan | Approval Matrix, PR Baru, Settings |

Akibat aturan ini:
- Pada hub, "Buat Payment" tidak lagi diletakkan di baris intro di bawah tab. Tombol itu naik ke kanan judul,
  karena judul + subtitle sudah mewakili tab aktif.
- Hanya ada **satu tempat** untuk mencari aksi utama layar.

## 1.2 Judul

1. **Judul blok konten berada di dalam kartu** (`CardTitle`). Ini pola mayoritas: 65 dari 121 halaman.
2. **Judul bagian di luar kartu** hanya dipakai di halaman dashboard, untuk mengelompokkan **≥ 2 kartu yang
   masing-masing sudah berjudul**. Contoh: "Brand & Cash" berisi kartu Brand Mix, Cash Position, AP Aging.
3. Judul bagian tidak boleh menaungi satu kartu saja, karena akan menjadi **judul ganda**. Contoh: "Approval
   Pending" lalu kartu "Approval Pending (Top 5)".
4. Dalam satu halaman, blok yang setingkat diberi judul dengan cara yang sama. Tidak boleh ada yang berjudul di
   luar, yang lain di dalam, dan sisanya tanpa judul.
5. **KPI**
   - Satu strip KPI di atas halaman tidak perlu judul, karena berfungsi sebagai ringkasan halaman.
   - Bila halaman punya ≥ 2 grup KPI: setiap grup diberi judul, atau digabung menjadi satu grup.
   - Jumlah kolom grid = jumlah KPI (maks. 4 per baris pada 1280px), sehingga tidak ada slot kosong.

## 1.3 Kapan dikotakkan (kartu), kapan tidak

Prinsip:
- Kotak berarti "ini satu unit tersendiri" (gestalt *common region*).
- Bila semua dikotakkan, kotak kehilangan makna. Semua tampak sama penting, setiap kotak menambah 24–32px
  (padding + jarak), dan mata harus melompat antar kotak.
- Kartu cocok untuk konten **heterogen** yang berdiri sendiri. Data **homogen** yang perlu dibandingkan atau
  dipindai lebih efisien sebagai tabel/daftar berbaris (NN/g, *Cards: UI-Component Definition*;
  Refactoring UI, *Use fewer borders*).

| Dikotakkan (kartu) | Tidak dikotakkan | Gantinya |
|---|---|---|
| Tabel + toolbar-nya, chart, widget, KPI, bagian form yang berjudul | **Filter milik satu tabel** | toolbar di bagian atas kartu tabel itu (satu kotak) |
| | **Filter tingkat halaman** (periode/outlet/scope yang mengubah semua blok) | baris kontrol polos di bawah header, tanpa kartu |
| | **Konteks outlet** ("Outlet aktif") | selector ringkas di area aksi header (atau topbar), bukan kartu di atas judul |
| | **Item daftar homogen**: antrean approval, number series, key integrasi, role, baris CMS | baris dalam satu kartu (tabel atau daftar bergaris pemisah) |
| | **Pesan/status satu baris** (banner "Sehat", progress) | `Alert` inline atau teks di header kartu terkait |
| | **Pengelompokan di dalam kartu** | sub-judul + garis/jarak, bukan kotak berborder lagi |

Batas: **maksimal 2 lapis bingkai** (kartu + satu lapis di dalamnya). Galeri bergambar (media library, menu
dengan foto) boleh tetap grid kartu.

## 1.4 Simpan & perubahan belum disimpan

- Form yang mengubah data memakai **bar aksi sticky di bawah**, yang selalu terlihat ke mana pun user scroll.
  Tombol Simpan hanya aktif bila ada perubahan.
- Penanda **"Perubahan belum disimpan"** di bar tersebut.
- **Peringatan saat meninggalkan halaman**, atau saat berpindah entitas/tab, bila ada perubahan yang belum disimpan.
- Form pengaturan memakai **satu** bar simpan, bukan tombol simpan per baris.
- Pengecualian: edit cepat satu field (inline) boleh menyimpan di tempat (✓).

## 1.5 Bahasa (disepakati 29 Okt 2026)

| Jenis teks | Bahasa | Contoh |
|---|---|---|
| Istilah teknis/domain (modul, dokumen, akuntansi, procurement) | **EN** | Payment, Purchase Order, COA, Payment run, AP aging, Variance, EBITDA, Lead time |
| Aksi & kalimat (tombol, bantuan, pesan, empty state) | **ID** | Simpan, Batal, Cari, Muat ulang, Ekspor |
| Status persetujuan/umum | **ID** | Draft, Diajukan, Menunggu Approval, Disetujui, Ditolak, Dibatalkan, Dibayar, Diterima |
| Status akuntansi teknis | **EN** | Posted, Void, Outstanding, Overdue, Partial |
| Label field/kolom | kata umum **ID** + istilah teknis **EN** | Tanggal Invoice, Nominal, Tipe Payee, Catatan |

Kamus tambahan yang diusulkan, agar satu konsep memakai satu kata:
- **Uang** → "Nominal". **Hitungan** → "Jumlah". Saat ini "Jumlah" dipakai untuk keduanya, misalnya
  "Jumlah Bruto (Rp)" dan "Jumlah PAY".
- Tanggal (bukan Date/Tgl) · Deskripsi (bukan Description) · Catatan (bukan Notes) · Tipe (bukan Type/Jenis) ·
  Muat ulang (bukan Refresh).
- **Aksi membuat**:
  - "**Buat** ‹dokumen›" untuk transaksi/dokumen (Buat PO, Buat Payment, Buat Transfer).
  - "**Tambah** ‹data›" untuk master data, baris, dan pengaturan (Tambah Item, Tambah User, Tambah Step).
  - Judul halaman form create: "‹Dokumen› Baru" (PO Baru).
  - Tombol tidak memakai akhiran "… Baru".

## 1.6 Grid
Kartu sejenis dalam satu baris memiliki lebar yang sama. Dua grid berurutan memakai jumlah kolom yang sama, atau
dipisah judul bagian. Tidak boleh ada item yatim di baris terakhir.
