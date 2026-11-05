# Analisis Fitur Market Price & Harga Supplier — untuk Sourcing (5 Nov 2026)

Cakupan: Market Price List, katalog harga vendor, Price Intelligence, Vendor Comparison, Vendor Scorecard,
Vendor Recommendation (AI), RFQ, dan pemakaian harga di PR/KDO/BDO/FDO/PO/GR. Dasar analisis:
- kode backend & frontend;
- data demo;
- tangkapan layar sebagai Procurement Manager;
- riset praktik pembelian F&B (sumber di §4).

---

## 0. Ringkasan

**Fondasinya sudah ada, tetapi saat ini belum membantu keputusan sourcing.**

- **Bahan sudah tersedia di sistem**:
  - harga acuan;
  - riwayat harga aktual per vendor dari PO/GR;
  - status ketersediaan;
  - deviasi harga di form PO;
  - perbandingan vendor;
  - scorecard;
  - RFQ;
  - rekomendasi AI.
- **Bahan itu terpecah di 8 halaman dan 2 portal, datanya kosong, dan modelnya belum cocok untuk bahan segar.**
  Data demo: 0 kuartal harga acuan, dan katalog harga vendor hanya 2 baris padahal ada 49 GR.
- **Tiga pertanyaan inti merchandiser belum bisa dijawab di satu tempat**:
  1. Berapa harga wajar minggu ini?
  2. Supplier mana yang terbaik untuk item ini, dari sisi harga, kualitas, kelengkapan, dan ketepatan?
  3. Apakah harga yang dibayar sudah sesuai kesepakatan?
- **Kualitas belum terukur sama sekali.** GR hanya punya catatan bebas. Yang disebut "defect rate" sebenarnya
  kekurangan qty, bukan barang rusak atau ditolak.

Lima rekomendasi utama, rinciannya di §5–6:
1. **Satu sumber harga supplier** (price list berlaku: harga, satuan, MOQ, lead time, masa berlaku, wilayah). Diisi
   dari RFQ, kontrak, atau impor. PO dan PR mengambil harga dari sini.
2. **Periode harga acuan fleksibel**: mingguan untuk bahan segar, bulanan atau kuartalan untuk bahan kering. Sumber
   acuan dicatat (survei pasar, PIHPS/Bapanas, median penawaran).
3. **Kualitas dicatat di GR**: qty ditolak + alasan terstruktur. Ini jadi dasar skor kualitas supplier.
4. **Satu halaman sourcing per item**: semua supplier item itu dalam satu tabel (harga penawaran, harga aktual, % vs
   acuan, fill rate, reject rate, on-time, lead time, skor) + tren harga.
5. **Peringatan di titik keputusan**: harga PO/GR di atas acuan atau kontrak, item sering kosong, single source, dan
   supplier lain yang lebih murah.

---

## 1. Untuk apa fitur ini (pekerjaan merchandiser)

| Pertanyaan merchandiser | Keputusan | Nilai bisnis |
|---|---|---|
| Berapa harga wajar item X minggu ini? | batas harga saat order / negosiasi | penghematan harga (PPV), cegah mark-up |
| Siapa supplier terbaik untuk X? | supplier utama + cadangan | harga + kualitas + kelengkapan, bukan termurah saja |
| Apakah yang ditagih sesuai harga sepakat? | tahan / setujui PO, GR, Payment | kebocoran harga, kontrol |
| Item mana yang naik/turun dan dampaknya ke food cost? | ganti supplier, sesuaikan menu/harga jual | margin menu |
| Item mana yang rawan (1 supplier, sering kosong)? | cari supplier cadangan | mencegah menu "habis" |
| Kapan tender ulang? | RFQ ke ≥ 3 supplier | harga kompetitif berkala |
| Supplier mana yang kualitasnya turun? | teguran / ganti | waste dapur, konsistensi rasa |

Ringkasnya, fitur ini bukan sekadar daftar harga. Ia adalah **alat keputusan beli** yang menyeimbangkan harga,
kualitas, kelengkapan, dan ketepatan, lalu menjaga kepatuhan harga saat order dan penerimaan barang.

---

## 2. Yang ada sekarang

### 2.1 Halaman

| Halaman | Portal / route | Isi | Kondisi di demo |
|---|---|---|---|
| Market Price List | Inventory `/inventory/market-list` | harga acuan **kuartalan** per item, review item baru dari KDO | kosong (0 kuartal); tidak ada di menu Procurement; hanya ekspor, tanpa impor |
| Price Intelligence | Procurement | deviasi harga vendor vs acuan, single-source risk | kosong; empty state menyuruh "buat PO/GR" padahal penyebabnya acuan belum ada; 1 baris tanpa nama |
| Vendors | Procurement | direktori vendor + tautan ke 4 halaman lain | kartu kontak saja |
| Vendor Item Catalog | Procurement | harga aktual per vendor (dari PO/GR) | 2 baris dari 49 GR |
| Vendor Comparison | Procurement | per item lintas vendor (dari GR 180 hari) & per PO | berfungsi bila item dipilih manual |
| Vendor Scorecard | Procurement **dan** Finance | skor on-time, lead time, "defect", stabilitas harga | dua implementasi berbeda |
| Vendor Recommendation (AI) | Procurement | ranking vendor per item | tidak terhubung ke halaman lain |
| RFQ | Procurement | permintaan penawaran, matriks perbandingan, terima → PO | vendor tampil sebagai UUID |

Ada juga hal yang sudah bagus:
- form PO menampilkan harga acuan dan % deviasi per baris;
- vendor bisa ditandai "tidak tersedia" langsung dari PO;
- KDO/BDO mengusulkan item baru ke review Market List.

### 2.2 Data harga — tiga penyimpanan paralel

| Koleksi | Arti | Diisi oleh | Dipakai oleh |
|---|---|---|---|
| `market_list_prices` | harga acuan kuartalan (manual) | admin/procurement | PO (deviasi), KDO/BDO/FDO (estimasi biaya), Price Intelligence |
| `vendor_items` + `vendor_item_price_history` | harga transaksi terakhir per vendor×item×satuan | hook PO & GR | katalog, PO (default harga), Price Intelligence |
| `item_pricings` | harga item per periode (dengan vendor) | API `/item-pricing` | **tidak dipakai UI** — sumber harga ketiga yang membingungkan |

Yang **tidak ada**:
- harga penawaran/kontrak supplier yang berlaku (masa berlaku, MOQ, lead time — kolomnya ada di `vendor_items` tetapi
  selalu 0 dan tidak bisa diisi dari UI);
- spesifikasi/grade item;
- konversi satuan;
- harga per wilayah;
- data kualitas;
- resep/BOM untuk dampak ke food cost.

---

## 3. Temuan

### 3.1 Konsep & model

1. **Kuartalan terlalu jarang untuk bahan segar.** Harga cabai, bawang, daging, ayam, dan telur berubah harian atau
   mingguan. Praktik hotel/restoran: *daily market quotation list* untuk perishable (≥ 3 penawaran per kategori),
   dan *master quotation list* mingguan/bulanan untuk bahan kering (§4). Acuan kuartalan membuat deviasi terlihat
   besar tanpa arti.
2. **Harga acuan tanpa sumber.** Tidak dicatat dari mana angkanya: survei pasar siapa, pasar mana, tanggal berapa.
   Tidak ada pembanding publik (PIHPS BI, Panel Harga Bapanas).
3. **"Harga supplier" = harga transaksi terakhir, bukan harga sepakat.**
   - Sebelum membeli, tidak ada harga penawaran yang berlaku untuk dibandingkan.
   - Setelah membeli, tidak ada harga kontrak untuk mengecek kepatuhan.
   - RFQ yang diterima tidak menjadi daftar harga.
4. **Perbandingan belum apples-to-apples.** Tidak ada spesifikasi/grade (mis. "fillet dada, 200–250 g, segar, bukan
   beku") dan tidak ada konversi satuan (kg vs pack 500 g vs ekor).
5. **Kualitas tidak terukur.**
   - GR hanya punya `condition_note` (teks bebas), tanpa qty ditolak, alasan, atau foto.
   - "Defect rate" di scorecard = (qty order − qty diterima) / qty order, yang sebenarnya kekurangan kirim.
6. **Tidak tersambung ke food cost.** Tidak ada resep/BOM, sehingga kenaikan harga bahan tidak bisa diterjemahkan
   ke HPP per menu.
7. **Tidak per wilayah.** Toko di Bandung dan Jabodetabek memakai satu harga acuan.

### 3.2 Bug logika (lokasi kode)

| # | Masalah | Lokasi | Akibat |
|---|---|---|---|
| 1 | Acuan dicocokkan per item **tanpa satuan** | `vendor_item_service.get_price_intelligence` + `market_list_service.get_ref_prices_bulk` | deviasi salah bila satuan vendor ≠ satuan acuan (kg vs pack) |
| 2 | Single-source dihitung per kombinasi vendor×satuan, termasuk vendor nonaktif/tak tersedia; item tanpa nama tetap tampil | `get_price_intelligence` | risiko salah; baris kosong di UI |
| 3 | `recent_increases` sebenarnya "di atas acuan", bukan kenaikan terbaru | idem | label menyesatkan |
| 4 | KDO/BDO mengambil acuan terbaru menurut `created_at` lintas kuartal | `kdo_bdo_service._latest_unit_cost` | bisa memakai kuartal draft/lama → estimasi budget salah |
| 5 | "Harga sebelumnya" = kuartal lain mana pun yang terbaru, bukan kuartal sebelumnya | `market_list_service.get_market_list` | variance tidak bermakna |
| 6 | Riwayat harga per item diurutkan menurut string label "Q1-2026" | `get_all_quarter_prices_for_item` | urutan salah lintas tahun (Q4-2025 > Q1-2026) |
| 7 | Skor vendor tidak dinormalisasi bila komponen kosong | `_reports_analytics/vendor_scorecard.py` | vendor tanpa data on-time maksimal 60 |
| 8 | Dua implementasi scorecard berbeda definisi | `vendor_comparison_service.vendor_scorecard` vs `_reports_analytics/vendor_scorecard` | angka bisa beda di Procurement vs Finance |
| 9 | Subtitle scorecard: "kualitas & daya saing harga", padahal yang diukur kekurangan qty & stabilitas harga | `VendorScorecardList` | klaim tidak sesuai data |
| 10 | Tandai item vendor tidak tersedia (aksi tulis) cukup izin `procurement.view` (dimiliki Outlet Manager) | `routers/vendor_items.py` | perubahan data oleh peran baca |
| 11 | Outlet Manager punya `procurement.market_list.manage` | seed role | bisa menetapkan harga acuan — perlu keputusan |
| 12 | RFQ detail menampilkan vendor yang sudah tidak ada sebagai UUID mentah (pola sama dengan Payment yang sudah diperbaiki) | `RFQDetail` | tidak terbaca |
| 13 | Seed demo memasukkan PO/GR langsung tanpa hook; Market List tidak di-seed | `seed_phase7b_demo.py` | demo tidak bisa menunjukkan nilai fitur |
| 14 | Empty state Price Intelligence: "Buat PO atau GR", padahal penyebabnya acuan belum ada | `PriceIntelligence.jsx` | pengguna salah langkah |
| 15 | `item_pricings` tanpa UI | `item_pricing_service` | sumber harga ganda |

### 3.3 UI/UX

- **Terpecah.** 8 halaman di 2 portal. Market Price List ada di Inventory, sehingga Procurement Manager (pemilik
  prosesnya) tidak melihatnya di sidebar. Scorecard ada di Procurement dan Finance.
- **Bukan berpusat pada item.** Cara berpikir merchandiser: "Ayam fillet — siapa yang jual, berapa, mana yang
  bagus". UI sekarang memaksa pengguna:
  - memilih vendor dulu (katalog), atau
  - memilih item manual tanpa konteks (comparison), atau
  - membaca deviasi tanpa tindakan (Price Intelligence).
- **Tidak ada lembar kerja pembelian.** Tidak ada satu tabel berisi acuan minggu lalu, harga pasar, 3 penawaran, dan
  supplier terpilih yang berujung tombol "Tetapkan" atau "Buat PO".
- **Setup awal tanpa panduan.** Harus membuat kuartal → mengisi harga satu per satu; tidak ada impor Excel/CSV.
- **Tidak ada peringatan di titik keputusan.** Form PO sudah menampilkan deviasi, tetapi tidak ada ambang yang
  mewajibkan alasan atau approval. GR tidak membandingkan harga diterima dengan harga PO/kontrak.

---

## 4. Riset — praktik & sumber data

- **Tiga penawaran untuk perishable.**
  - Restoran umumnya memakai minimal 3 supplier per kategori perishable (ikan, daging, sayur, susu) untuk menilai
    harga terbaik. Penawaran harian dicatat di *market quotation list*.
  - Hotel menetapkan minimal 3 penawaran sebagai kebijakan.
  - Bahan periodik (kering) memakai *master quotation list* mingguan/bulanan.
  ([ckbk — perishable foods](https://app.ckbk.com/reference/fund22556c26s001ss001sss002e001/perishable-foods),
  [Purchasing Control](https://gyansanchay.csjmu.ac.in/wp-content/uploads/2022/04/Purchasing-Control...pdf),
  [Marriott — purchasing assistant](https://careers.marriott.com/temporary-purchasing-assistant/job/427F4070F2F4542D407AAB5FCDC7EFC3))
- **Acuan harga publik Indonesia.**
  - **PIHPS Nasional (Bank Indonesia)**: harga harian komoditas pangan strategis per provinsi/kota dari pasar
    tradisional, pasar modern, pedagang besar, dan produsen. Situs: bi.go.id/hargapangan.
    ([BI — siaran pers](https://www.bi.go.id/id/publikasi/ruang-media/news-release/Pages/sp_2517423.aspx),
    [BI — FAQ PIHPS](https://www.bi.go.id/hargapangan/Informasi/FAQ),
    [Metro TV](https://www.metrotvnews.com/read/N6GC8BLJ-bi-perkuat-keamanan-data-pangan-nasional))
  - **Panel Harga Bapanas**: harga eceran nasional beberapa kali sehari untuk beras, cabai, bawang, daging sapi,
    ayam, telur, minyak goreng, dan tepung. ([Antara — contoh laporan](https://jambi.antaranews.com/berita/587551/harga-pangan-kamis-fluktuatif-beras-premium-stabil-rp15520-per-kg))
  - **Catatan:** saya tidak menemukan dokumentasi API resmi untuk keduanya. Tahap awal sebaiknya impor manual/CSV;
    integrasi otomatis setelah izin/ketentuan pemakaian dicek.
- **KPI scorecard supplier.**
  - Fill rate (qty diterima / dipesan), OTIF dengan on-time dan in-full dilaporkan terpisah, price variance
    = (harga aktual − harga kontrak) / harga kontrak, rejection rate, dan lead time.
  - Contoh bobot: kelengkapan 25%, ketepatan 20%, stabilitas harga 20%, kualitas 15%, lead time 10%,
    komunikasi 10%.
  ([Supy — supplier scorecard](https://supy.io/blog/learn-restaurant-supplier-evaluation-scorecard),
  [Racklify — in-full](https://racklify.com/encyclopedia/how-retailers-calculate-and-improve-in-full-performance-steps-for-measurement-and-remediation/),
  [Evaluations Hub](https://evaluationshub.com/?p=13377))
- **Pola software restoran.** Alert saat harga invoice/penerimaan ≠ harga kontrak, dan biaya resep/margin menu
  dihitung ulang otomatis saat harga bahan berubah.
  ([RaftLabs](https://www.raftlabs.com/industries/restaurants/inventory-management),
  [xtraCHEF](https://xtrachef.com/food-cost-management-solution/),
  [KitchenNMBRS](https://kitchennmbrs.app/en/knowledge-base/inventory-management-stock-control/how-does-kitchennmbrs-help-me-monitor-my-recipe-cost-price-in-relation-to-my-inventory))

Sebagian sumber adalah materi pelatihan atau situs vendor, sehingga angka bobot di atas adalah praktik umum,
bukan standar baku.

---

## 5. Desain target — "Sourcing" sebagai satu alur

### 5.1 Data

| Objek | Isi | Sumber |
|---|---|---|
| **Spesifikasi item** | grade, ukuran, kondisi (segar/beku), merek setara, satuan beli + konversi ke satuan stok | master item |
| **Price list supplier** (SSOT harga supplier) | supplier × item × satuan: harga, MOQ, lead time, berlaku dari/sampai, wilayah/toko, sumber (RFQ, kontrak, WA/telepon, impor) | RFQ diterima, input, impor Excel |
| **Harga acuan pasar** | per item per periode (mingguan untuk segar, bulanan/kuartalan untuk kering), wilayah, sumber + bukti | survei pasar, PIHPS/Bapanas (impor), median penawaran |
| **Harga aktual** | sudah ada (`vendor_items` + riwayat dari GR) | GR |
| **Kualitas penerimaan** | per baris GR: qty diterima, qty ditolak, alasan (busuk/layu, ukuran, suhu, kemasan, kadaluarsa), foto | GR |

`item_pricings` dilebur ke price list atau dihapus. `market_list_prices` menjadi "harga acuan" dengan periode
fleksibel.

### 5.2 Layar (satu hub "Sourcing" di Procurement)

1. **Halaman item (pusat keputusan).** Header: spesifikasi, satuan, acuan minggu ini, tren. Isi:
   - Tabel semua supplier untuk item ini: harga penawaran berlaku, harga aktual terakhir, % vs acuan, fill rate,
     reject rate, on-time, lead time, MOQ, skor, status.
   - Aksi: Jadikan utama, Minta penawaran (RFQ), Buat PO.
   - Grafik 12 minggu: acuan vs aktual vs PIHPS.
2. **Market list mingguan (lembar kerja).**
   - Grid per kategori segar dengan kolom: acuan minggu lalu, harga pasar/PIHPS, 3 penawaran, terpilih, selisih.
   - Tombol "Tetapkan minggu ini" → menjadi price list aktif & harga default PR/KDO/PO.
   - Ada impor Excel dan salin dari minggu lalu.
3. **Peringatan.**
   - Harga PO/GR > acuan/kontrak X% wajib alasan atau approval.
   - Supplier sering kosong.
   - Item single-source.
   - Penawaran supplier lain lebih murah ≥ Y% (peluang penghematan).
4. **Scorecard terpadu (satu implementasi).**
   - Komponen: Harga (daya saing vs median penawaran/acuan), Kualitas (reject rate), Kelengkapan (fill rate),
     Ketepatan (on-time), Stabilitas.
   - Bobot bisa diatur; komponen kosong dinormalisasi.
5. **Penghematan.** PPV vs acuan/kontrak per bulan, per kategori, per supplier; dampak ke food cost bila resep
   tersedia.

### 5.3 Titik sambung ke alur yang sudah ada

- **PR/KDO/BDO**: estimasi biaya dari price list aktif (bukan acuan kuartal terbaru).
- **PO**: supplier & harga default dari supplier utama + peringatan deviasi berambang.
- **GR**: kualitas + price variance vs PO/kontrak.
- **RFQ**: penawaran diterima → price list berlaku.
- **Payment**: harga tagihan vs GR (sudah sebagian lewat GR-link).

---

## 6. Rencana bertahap

| Tahap | Isi | Dampak |
|---|---|---|
| **0 — Perbaikan cepat** | bug §3.2 no. 1–10, 12, 14; Market Price List masuk menu Procurement; satu scorecard; seed demo market list + jalankan hook GR → katalog | angka benar, demo bisa dipakai |
| **1 — Harga supplier yang berlaku** | price list (masa berlaku, MOQ, lead time, wilayah); RFQ → price list; impor Excel/CSV; periode acuan mingguan/bulanan | bisa membandingkan *sebelum* membeli |
| **2 — Kualitas** | qty ditolak + alasan + foto di GR; skor kualitas & fill rate di scorecard | supplier dinilai bukan dari harga saja |
| **3 — Workbench** | halaman item, market list mingguan, peringatan berambang di PO/GR | keputusan cepat di satu layar |
| **4 — Benchmark & food cost** | impor PIHPS/Bapanas; resep/BOM → dampak HPP; dashboard penghematan | negosiasi berbasis data, margin menu |

---

## 7. Keputusan yang dibutuhkan

1. **Periode harga acuan**: mingguan untuk segar & bulanan untuk kering, atau tetap kuartalan?
2. **Harga per wilayah** (Bandung vs Jabodetabek)?
3. **Siapa menetapkan market list**: Procurement, cost controller, atau dengan approval? Apakah Outlet Manager tetap
   boleh mengubah harga acuan?
4. **Benchmark publik** (PIHPS/Bapanas): mulai dengan impor manual?
5. **Resep/BOM**: sudah ada di POS (bisa diimpor) atau perlu dibuat di ERP?
6. **Tahap 0** langsung dikerjakan?
