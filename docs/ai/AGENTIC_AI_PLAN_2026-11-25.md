# Rencana Pengembangan AI Agentic — FnB Group ERP (25 Nov 2026)

Dokumen acuan sebelum pembangunan. Disusun dari diskusi dengan pemilik (25 Nov 2026), audit kode, dan riset
(sumber di Lampiran). Status: **disetujui; D1–D9 diputuskan 25 Nov. R1 (T1–T3) & R2 (T4–T5) selesai — lihat §13.1.**

---

## 0. Ringkasan

ERP akan memiliki **asisten AI agentic** berbasis **Claude Opus 5.5** yang:

- menjawab, menganalisis, dan **menyintesis data lintas modul**, lengkap dengan **grafik** dan **laporan Excel/PDF**;
- **menjalankan semua aksi ERP** (input, ubah, hapus, setujui, posting) **atas nama pengguna dan sesuai izinnya**,
  lewat usulan yang disetujui manusia;
- bekerja di **web (panel Asisten AI)** dan **WhatsApp** (owner & manager), menerima **foto/PDF/Excel/teks**;
- **mengimpor data mentah** dari sumber mana pun (sales, mutasi bank, price list, dll.) — memetakan, membersihkan,
  mengecek duplikasi, dan memberi **pratinjau**;
- membantu **rekonsiliasi Finance**, **foto → jurnal**, **tutup buku**;
- punya **agen spesialis** (Purchasing, Finance, Inventory, Outlet, HR, Analis, Auditor, Pemandu, Data Steward);
- **riset sumber luar** (web) dengan sitasi, dan **memantau** kondisi bisnis secara terjadwal.

Fondasi pertama: **mengganti ketergantungan Emergent** — semua fitur AI sekarang memakai paket
`emergentintegrations` + `EMERGENT_LLM_KEY`, sehingga tidak berjalan di deployment pemilik.

---

## 1. Kemampuan yang dibangun

| # | Kemampuan | Ringkas |
|---|---|---|
| K1 | Asisten AI (web) | Panel di semua halaman; paham halaman, brand/toko, peran; lampiran file |
| K2 | Aksi ERP | Semua aksi lewat katalog API; persetujuan bertingkat; batalkan bila masih draf |
| K3 | Analis data | Analisis lintas tabel, grafik interaktif, Dashboard AI, ekspor data |
| K4 | Laporan | Excel (ringkasan + data + grafik) & PDF (narasi + grafik + tabel); terjadwal |
| K5 | Impor Cerdas | File apa pun → pemetaan, pembersihan, cek duplikasi, pratinjau → draf |
| K6 | Detail transaksi | Simpan transaksi & baris menu; master menu + alias per sumber |
| K7 | Bot WhatsApp | Owner & manager: tanya, grafik, file, foto, persetujuan tombol, notifikasi |
| K8 | AI Finance | Foto → jurnal, rekonsiliasi (bank, kanal bayar, marketplace, kas, AP, stok), tutup buku |
| K9 | AI Purchasing | Riset harga pasar, analisis price list (DB/foto/dokumen), restock & RFQ |
| K10 | AI Data Steward | Input & rapikan master data, cegah duplikat, impor massal |
| K11 | AI Auditor | Deteksi kejanggalan transaksi → kasus tindak lanjut |
| K12 | AI Pemandu | "Bagaimana cara…", tour, diagnosa masalah, onboarding, SOP |
| K13 | Riset luar | Web search/fetch dengan sumber & tanggal; Catatan Riset |
| K14 | Monitor & otomasi | Kondisi terjadwal → notifikasi; instruksi terjadwal → hasil/aksi usulan |
| K15 | Memori & pengetahuan | Preferensi, target KPI, aturan bisnis; dokumen SOP/kontrak dengan kutipan |

---

## 2. Keputusan yang sudah diambil

| Tanggal | Keputusan |
|---|---|
| 25 Nov | Model: **Claude Opus 5.5** (`claude-opus-5-5`) |
| 25 Nov | **Semua aksi ERP** bisa dijalankan AI (dengan pengaman §8) |
| 25 Nov | Agen spesialis per domain, contoh utama **AI Purchasing** (riset harga, analisis price list, data entry, kejanggalan) |
| 25 Nov | **Bot WhatsApp** untuk **owner & manager** |
| 25 Nov | WA MVP lewat **gateway open-source gratis (tidak resmi)** dulu |
| 25 Nov | Kemampuan **analis data, visualisasi, laporan, ambil data**; **AI pemandu**; **riset sumber luar** |
| 25 Nov | **Impor data mentah** dengan bantuan AI (pemetaan, cleanup, format, pratinjau) |
| 25 Nov | **Simpan detail per transaksi**; sumber luas, AI yang mencocokkan |
| 25 Nov | Tanggal sudah ada → **AI menilai duplikasi** |
| 25 Nov | **Rekonsiliasi Finance** dengan bantuan AI |
| 25 Nov | (Sebelumnya) Harga PO di atas acuan cukup peringatan; API harga lama dihapus; Outlet/Inventory Manager dapat akses Sourcing |
| 25 Nov | D1 **B (Messages API)**, D2 Evolution API, D3 PIN + > Rp 10 jt via aplikasi, D4 riset web terbuka, D5 pengecualian aksi, D6 peringatan 80%, D9 semua Opus — **disetujui** |
| 25 Nov | D7 **data gaji boleh dibaca AI** oleh peran yang berhak; D8 **semua brand** sekaligus (tanpa pilot) |
| 25 Nov | Semua yang ada di sistem harus bisa dilakukan & diketahui AI, termasuk modul baru (mis. reservasi; kelak menu & resep + analisis/riset resep) |

---

## 3. Keputusan (D1–D9 — semua sudah diputuskan 25 Nov, lihat §2)

| # | Keputusan | Default sementara | Catatan |
|---|---|---|---|
| D1 | Platform agen: **A Managed Agents** (Anthropic menjalankan loop & sandbox, beta, biaya runtime sesi, riwayat sesi disimpan di Anthropic sampai dihapus) vs **B Messages API** (loop di server ERP, GA) | **B** | Alasan: persetujuan, izin, WA, dan penjadwal sudah ada di ERP; data tidak disimpan sebagai sesi; tidak ada biaya runtime. Web search, sandbox kode, tool search tetap tersedia di B. A dipertimbangkan bila ingin jadwal/multi-agen/sandbox dikelola Anthropic. |
| D2 | Gateway WA | **Evolution API** (self-hosted, Apache-2.0) | Mendukung juga API resmi Meta → bisa pindah tanpa bangun ulang. Butuh **nomor khusus bot**. |
| D3 | Persetujuan lewat WA | **Semua butuh PIN**; **> Rp 10 jt wajib di aplikasi** | |
| D4 | Riset web | **Terbuka**, hasil diberi label sumber & "eksternal"; situs prioritas: bi.go.id, badanpangan.go.id, data.go.id, bps.go.id, pajak.go.id, kemnaker.go.id | Data internal tidak pernah dikirim ke situs luar |
| D5 | Pengecualian aksi | **Dikecualikan**: login/token/password, pengaturan AI, peran & izin | |
| D6 | Batas biaya AI | **Peringatan** di 80% anggaran bulanan; anggaran awal diisi pemilik di pengaturan | Tanpa batas keras sampai diputuskan |
| D7 | Data gaji | **Tidak dapat dibaca AI** di MVP | Bisa dibuka untuk peran berhak |
| D8 | Pilot | **1 brand** dipilih pemilik | |
| D9 | Model murah untuk ekstraksi massal (ribuan baris/foto) | **Tidak** — semua Opus | Opsi penghematan, hanya atas izin pemilik |

---

## 4. Kondisi saat ini (hasil audit kode)

**Fitur AI yang ada** (semua via `emergentintegrations`, model hardcode — Gemini 2.5 Flash; Smart SEO GPT-4.1 mini):
Executive Q&A (9 alat baca, 1 alat per pertanyaan), Daily Briefing owner, AI Insights, OCR struk (Petty Cash, Urgent
Purchase), kategori GL, generator jurnal, rekomendasi vendor, penjelasan selisih opname, Smart SEO. Pengaturan
"LLM provider" di Admin hanya dipakai tombol Test LLM.

**Non-LLM (tetap jalan)**: forecast (linear/EWMA/hybrid), Forecast Guard, deteksi anomali (sales, harga vendor,
lead time, kas/AP), autocomplete item/vendor.

**Aset yang dipakai ulang**: RBAC terkonfigurasi (`core/perms_registry.py`), scope brand/toko (`core/scope.py`),
approval matrix, audit log, scheduler (APScheduler), notifikasi, uploads (object storage), impor Excel master
(`excel_import_service`), WhatsApp kirim-saja (`whatsapp_service`: fonnte/twilio/meta), Telegram (webhook), Sourcing
(acuan, penawaran, skor), tour (465 langkah) & bantuan inline, kontrak API POS (`docs/pos`).

**Penyimpanan file** juga bergantung pada Emergent (`core/object_storage.py` → `integrations.emergentagent.com`), sehingga
upload, foto struk, slip setoran, dan gambar CMS gagal di luar Emergent. **Diperbaiki di T1**: disk lokal (default) atau
S3-compatible.

**Ukuran API**: 698 endpoint — **362 baca, 336 tulis**; **164 endpoint tulis** menerima `dict` tanpa skema.

**Data penjualan**: hanya rekap harian per toko (`daily_sales`: channel, metode bayar, food/beverage, pajak, service,
total, jumlah transaksi). Belum ada detail transaksi/menu; master menu hanya untuk CMS website.

---

## 5. Prinsip desain

1. **AI bertindak sebagai pengguna yang meminta** — semua aksi lewat API yang sama dengan layar; izin, scope toko,
   validasi, approval matrix, periode tutup buku, audit berlaku persis sama. AI tidak pernah melebihi hak pengguna.
2. **Baca langsung; tulis lewat usulan** yang disetujui (bertingkat §8). Usulan menampilkan sebelum → sesudah.
3. **Angka dihitung mesin, bukan model** — query & sandbox menghitung; AI menyusun narasi dan menyebut sumber,
   filter, dan rumus ("cara menghitung").
4. **Konten luar = data, bukan perintah** — isi file impor, halaman web, pesan WA tidak bisa memerintah AI.
5. **Semua tercatat** — permintaan, langkah, data yang dibaca, usulan, perubahan pengguna, persetujuan, hasil, biaya.
6. **Saluran & penyedia bisa diganti** — WA, model, storage lewat adaptor.
7. **Deterministik untuk data besar** — AI menyusun *resep* (pemetaan, pembersihan, aturan cocok); mesin data
   menjalankannya berulang & bisa diaudit.

---

## 6. Arsitektur

### 6.1 Gambaran

```
Saluran:  Panel Asisten AI (web) · WhatsApp (Evolution API) · Telegram · Email/folder masuk · Jadwal
                                   │
                  ┌────────────────▼─────────────────┐
                  │ Orkestrator (Claude Opus 5.5)    │  memori perusahaan · kebijakan AI per peran
                  │ rencana → alat → cek → jawab     │  batas langkah & biaya · antrian pekerjaan panjang
                  └───┬──────────┬──────────┬────────┘
        Agen spesialis: Purchasing · Finance · Inventory · Outlet · HR · Analis · Auditor · Pemandu · Data Steward
                                   │
  Alat bersama:
  ├─ Katalog aksi ERP (698 endpoint, disaring izin)  ── usulan → persetujuan → eksekusi via API sebagai pengguna
  ├─ Query data + data mart + kamus metrik
  ├─ Sandbox kode (analisis, grafik, file Excel/PDF)
  ├─ Web search / web fetch (sitasi)
  ├─ Baca foto/PDF/Excel/teks (vision, dokumen)
  ├─ Mesin Impor Cerdas · Mesin Rekonsiliasi · Mesin Kejanggalan
  └─ Notifikasi (app, WA, Telegram) · Penjadwal (monitor & otomasi)
```

### 6.2 Lapisan model

- **SDK resmi Anthropic (Python)**, model `claude-opus-5-5`, *adaptive thinking*, `effort` diatur per rute
  (tanya-jawab ringan lebih rendah, analisis/aksi lebih tinggi; default model Opus 5.5 = `medium`, diset eksplisit).
- **Streaming** untuk respons panjang; **prompt caching** (system prompt & katalog alat stabil di depan).
- **Refusal fallback** server-side diaktifkan sesuai rekomendasi Anthropic untuk Opus 5.5.
- **Server tools**: `web_search_20260209`, `web_fetch_20260209` (batas domain, sitasi), code execution (sandbox),
  **tool search** (katalog besar dimuat sesuai kebutuhan), **programmatic tool calling** (AI menulis kode yang
  memanggil banyak alat ERP lalu mengolah hasilnya tanpa membanjiri konteks).
- **Dokumen & gambar**: PDF dan foto langsung ke model; Files API untuk file berulang.
- **Structured outputs** untuk resep impor, usulan aksi, hasil ekstraksi.
- **Compaction / context editing** untuk percakapan panjang; **Batch API** (±50% lebih murah) untuk pekerjaan malam.
- Kunci: `ANTHROPIC_API_KEY` di Admin → Integrations (sudah ada di katalog setting). Pengaturan baru: model agen,
  effort per rute, anggaran.
- **Migrasi 9 fitur AI lama** ke klien ini (termasuk Smart SEO), lalu `emergentintegrations` dihapus.

### 6.3 Orkestrator & agen spesialis

| Agen | Tanggung jawab |
|---|---|
| Orkestrator | Memahami tugas, memilih/menggabungkan spesialis, menjaga kebijakan, merangkum |
| Purchasing | Riset harga, analisis price list, RFQ, restock, rekomendasi supplier |
| Finance | Foto → jurnal, rekonsiliasi, tutup buku, AP/AR, analisis budget |
| Inventory | Reorder, transfer antar toko, selisih opname, waste |
| Outlet | Sales harian, petty cash, closing, food cost per toko |
| HR | Cuti, absensi, (payroll bila diizinkan D7) |
| Analis | Pertanyaan lintas modul, grafik, Dashboard AI, laporan |
| Auditor | Kejanggalan transaksi, kasus |
| Pemandu | Cara pakai, tour, diagnosa, onboarding, SOP |
| Data Steward | Master data, duplikat, impor massal |

Spesialis = paket instruksi + pengetahuan domain (aturan akun, PPN, SOP) + subset alat; dimuat sesuai kebutuhan
(pola *skills* / tool search) agar konteks tetap kecil.

### 6.4 Katalog aksi

- Dibangun **otomatis** dari route FastAPI: method, path, parameter, docstring, dan **izin yang dibutuhkan**
  (diintrospeksi dari dependensi `require_perm`/`require_any_perm`). Disaring per pengguna.
- **164 endpoint tulis tanpa skema** diberi skema isian + contoh + deskripsi bahasa Indonesia, bertahap per domain
  (Finance & Procurement dulu).
- Setiap aksi diberi **tingkat risiko** (§8) dan **jenis** (baca/buat/ubah/hapus/setujui/posting).
- **Dikecualikan** (D5): auth/token/password, pengaturan AI, peran & izin.

### 6.5 Eksekusi aksi

- Usulan aksi disimpan (`ai_actions`): permintaan asli, payload usulan, pratinjau dampak, risiko, status.
- Disetujui → dieksekusi **lewat API internal sebagai pengguna yang menyetujui** (token internal berumur pendek),
  dengan **kunci idempotensi** (tidak dobel saat pesan WA terkirim ulang).
- Perubahan pengguna pada usulan tercatat (usulan asli vs final).
- **Batalkan**: aksi yang menghasilkan draf bisa dibatalkan; yang sudah posted memakai mekanisme resmi
  (reverse/batal), bukan hapus.
- Aksi massal (mis. 15 jurnal, 300 baris price list) = satu batch dengan persetujuan sekaligus + rincian per item.

### 6.6 Data & analitik

- **Kamus metrik**: definisi tunggal (Net Sales, HPP, food cost %, gross margin, AP aging, dll.) dipakai AI,
  laporan, dan dashboard.
- **Data mart**: ringkasan harian/mingguan per toko, channel, metode bayar, menu, vendor, item — dibangun terjadwal
  dari transaksi agar analisis cepat walau detail transaksi jutaan baris.
- **Query aman**: dataset terdaftar dengan izin, scope toko, kolom yang boleh (kolom sensitif disaring).
- Analisis berat & grafik dikerjakan di **sandbox kode**; hasil (tabel, gambar, file) dikembalikan ke aplikasi.

### 6.7 Memori & basis pengetahuan

- **Memori perusahaan**: preferensi owner, target KPI, aturan bisnis, supplier favorit, koreksi pengguna
  (mis. akun GL, alias menu). Bisa dilihat & dihapus di AI Hub.
- **Basis pengetahuan**: SOP, kontrak supplier, kebijakan (unggah) → jawaban dengan kutipan; plus pengetahuan
  sistem (tour, bantuan inline, dokumentasi).

### 6.8 Saluran

- **Web**: panel Asisten AI (Sheet di TopNav) + **AI Hub** (Percakapan, Persetujuan AI, Dashboard AI, Pustaka
  Laporan, Impor Cerdas, Rekonsiliasi, Monitor & Otomasi, Kasus Auditor, Memori & Pengetahuan, Pengaturan & Biaya).
  Hub mengikuti aturan maks. 6 kelompok tab (HubTabs).
- **WhatsApp**: adaptor Evolution API (D2), §7.4.
- **Telegram**: tetap sebagai saluran cadangan notifikasi.
- **Email/folder masuk** (Rilis 4): kotak email khusus invoice supplier; folder bersama untuk file ekspor.

### 6.9 Penjadwalan, monitor, pekerjaan panjang

- **Monitor**: kondisi atas data (stok < min, harga > acuan +x%, sales turun y%, AP jatuh tempo) dicek terjadwal →
  notifikasi (prioritas, ringkasan, jam tenang).
- **Otomasi**: instruksi terjadwal ("tiap Senin 07:00 laporan sales minggu lalu") berjalan dengan izin pemiliknya;
  aksi tulis → antrian persetujuan.
- **Antrian pekerjaan panjang** (impor besar, rekonsiliasi, riset): latar belakang, progres, notifikasi selesai.
- Memakai APScheduler yang ada (job baru `ai_jobs`).

---

## 7. Modul kemampuan

### 7.1 Asisten AI & Pemandu (K1, K12)

- Panel di semua halaman; konteks otomatis: halaman, brand/toko (TopNav), peran; saran pertanyaan per halaman.
- Jawaban berisi teks, tabel, grafik, kartu usulan aksi, tautan laporan, tautan halaman.
- **Pemandu**: "bagaimana cara…" → langkah + tautan + menjalankan tour/menyorot tombol; menjelaskan istilah dengan
  data sendiri; **diagnosa** ("kenapa PO tidak bisa dikirim?" → cek status, approval, periode, izin); bantu isi form
  dari foto/dokumen & cek form sebelum simpan; jalur belajar per peran.
- **Kriteria selesai**: 30 pertanyaan "cara pakai" uji terjawab benar ≥ 90%; tautan selalu ke halaman yang boleh
  dibuka pengguna (`canOpenPath`).

### 7.2 Analis data, visualisasi, laporan (K3, K4)

- Analisis: tren & musiman, perbandingan toko/brand/periode, Pareto, dekomposisi margin (harga × volume × mix),
  korelasi (termasuk data luar), forecast, simulasi what-if.
- Grafik interaktif di percakapan (garis, batang, pie, heatmap, waterfall, scatter) → **sematkan ke Dashboard AI**
  (diperbarui otomatis). Di WA: gambar.
- Laporan: **Excel** (ringkasan, sheet data, grafik) dan **PDF** (narasi, grafik, tabel); judul & nama file membawa
  konteks brand/toko; **Pustaka Laporan**; jadwal kirim (WA/email).
- **Ambil data**: tabel apa pun → Excel/CSV sesuai izin; gabung data internal + eksternal.
- **Kriteria selesai**: 40 pertanyaan analisis uji — angka cocok dengan laporan resmi 100% (kamus metrik), setiap
  jawaban punya "cara menghitung".

### 7.3 Impor Cerdas + detail transaksi (K5, K6)

**Alur**: Unggah (Excel/CSV multi-sheet, PDF, foto, teks WA, beberapa file) → **profil file** (baris judul asli,
kop/total/baris kosong/sel gabung, format tanggal & angka Indonesia, tebak sumber) → **pemetaan kolom** (dengan
tingkat keyakinan, bisa diubah) → **pemetaan nilai** (toko, channel, metode bayar, menu — fuzzy + alias tersimpan) →
**pembersihan** (spasi, duplikat baris, void/refund, cut-off hari bisnis lewat tengah malam, nilai negatif/janggal) →
**transformasi** (detail → rekap harian) → **validasi & rekonsiliasi** (total transaksi vs baris total & per metode
bayar; periode tutup; scope toko) → **pratinjau** (mentah / bersih / hasil; status per baris; perbandingan dengan data
yang ada) → **perintah bahasa biasa** untuk koreksi → **impor sebagai draf** (batch, progres, *batalkan impor*) →
**resep impor** tersimpan per sumber (bisa dipakai dari WA/folder).

**Cek duplikasi 4 lapis**: (1) sidik jari file; (2) sidik jari transaksi (toko + nomor struk + jam + total; tanpa
nomor: jam + nominal + item); (3) tanggal yang sudah ada → AI menilai **duplikat / lebih lengkap (ganti) /
pelengkap (gabung, mis. POS + GoFood) / konflik (tanya)** dengan bukti; (4) pesanan sama di dua sumber (ID order,
jam, nominal) agar tidak terhitung ganda.

**Penyimpanan baru**: transaksi penjualan + baris item; rekap `daily_sales` dihitung dari situ (jurnal tetap dari
rekap & alur validasi yang ada). **Master menu** + **alias per sumber** (siap disambung ke resep/BOM kelak).

**Target impor lain** (mesin sama): pembelian/GR historis, price list supplier, master data (menggantikan template
kaku), hasil opname, **mutasi bank**, input payroll/budget, **saldo awal migrasi**.

**Kriteria selesai**: 10 file contoh berbeda format (termasuk dari pemilik) terpetakan benar tanpa koreksi manual
≥ 80% kolom, total hasil = total file, duplikat terdeteksi 100% pada uji ulang file sama.

### 7.4 Bot WhatsApp (K7)

- **Pengguna**: owner & manager (terdaftar, nomor diverifikasi OTP dari aplikasi).
- **Kemampuan**: tanya apa saja (bahasa santai), ringkasan + **grafik gambar**, kirim **file laporan**, terima
  **foto/PDF/Excel** (struk, invoice, price list, ekspor POS, mutasi) → diproses; **persetujuan dengan tombol/balasan**
  (usulan AI + approval biasa); **notifikasi proaktif** (briefing pagi, kasus auditor, monitor, approval tertunda).
- **Keamanan**: izin = akun ERP; PIN untuk aksi (D3); sesi kedaluwarsa; cabut akses dari Admin; opsi samarkan data
  sensitif; log semua pesan.
- **Gateway** (D2): Evolution API self-hosted via adaptor; nomor khusus bot; tanpa broadcast; batas pesan per menit;
  fallback notifikasi app/Telegram. Tombol interaktif pada gateway tidak resmi bisa tidak selalu tampil → **fallback
  balasan teks** ("balas 1 untuk Setujui, 2 untuk Tolak").
- **Opsional**: voice note → speech-to-text open-source (Whisper self-host); Claude tidak menerima audio.
- **Kriteria selesai**: owner bisa menyelesaikan 10 skenario uji dari HP (tanya sales, minta PDF, kirim struk,
  setujui PO dengan PIN) tanpa membuka aplikasi.

### 7.5 AI Finance (K8)

**Foto → jurnal**: banyak foto sekaligus → baca tanggal, vendor, total, PPN, item → usul akun GL (aturan yang
dipelajari dulu) → draf jurnal (Dr beban/persediaan + PPN masukan, Cr kas/bank/hutang) → antrian review → posting.
Cek struk ganda (hash gambar + nomor/total/tanggal). Bukti foto **dilampirkan ke jurnal**. Dalam konteks toko bisa
menjadi petty cash / urgent purchase.

**Rekonsiliasi**:

| Jenis | Dicocokkan |
|---|---|
| Bank vs buku | mutasi ↔ pembayaran AP, penerimaan AR, setoran harian, settlement |
| Non-tunai | POS per metode bayar ↔ laporan EDC/QRIS ↔ bank (net MDR, jeda T+1/T+2) |
| Marketplace | penjualan GoFood/Grab/Shopee ↔ payout (komisi, promo merchant) ↔ bank |
| Kas | penjualan tunai ↔ slip setoran (daily close) ↔ bank |
| AP | statement vendor (foto/PDF) ↔ buku hutang; PO ↔ GR ↔ invoice (3-way) |
| Persediaan | kartu stok ↔ opname ↔ saldo GL; GR belum ditagih |
| Petty cash & antar toko | saldo ↔ struk; transfer antar toko |

Mesin pencocokan deterministik (persis/toleransi, rentang tanggal, teks referensi, **banyak-ke-satu** mis. 1 payout
untuk 7 hari) → **AI untuk sisanya**: baca keterangan mutasi, jelaskan yang tidak cocok, usulkan **jurnal
penyesuaian** (MDR, komisi, biaya admin), **belajar aturan** dari konfirmasi ("TRF GOTO…" = payout GoFood). Hasil:
lembar kerja cocok/usulan/belum cocok + keyakinan; persetujuan Finance; laporan rekonsiliasi PDF.

**Tutup buku**: status checklist, usulan accrual, analisis fluktuasi akun dengan penjelasan.

**Kriteria selesai**: rekonsiliasi bank 1 bulan pilot — ≥ 85% mutasi cocok otomatis; semua yang tidak cocok punya
penjelasan; jurnal penyesuaian hanya lewat persetujuan.

### 7.6 AI Purchasing (K9)

- **Riset harga pasar**: web (PIHPS BI, Bapanas, marketplace, berita) + data internal (GR, penawaran, acuan) →
  rentang harga wajar, sumber & tanggal, tren → usul jadikan acuan (persetujuan).
- **Analisis price list**: dari DB atau impor foto/PDF/Excel/WA → cocokkan item & satuan ("dus isi 12×1L" → per L),
  tandai item baru → bandingkan acuan/supplier lain/harga terakhir/price list lama → tangkap kenaikan diam-diam, isi
  kemasan mengecil, MOQ berubah → **dampak rupiah/bulan** → rekomendasi terima/negosiasi/pindah + draf pesan negosiasi
  → simpan ke price list (persetujuan).
- **Restock & RFQ**: stok < minimum → PR → bandingkan penawaran & skor → draf PO per vendor; RFQ → baca balasan
  (foto/PDF) → tabel perbandingan & rekomendasi pemenang.
- Keputusan pemenang & pengecualian bernilai besar tetap manusia.

### 7.7 AI Data Steward (K10)

Buat/lengkapi item & vendor dari dokumen (kartu nama, NPWP, rekening, katalog); cegah duplikat (nama mirip);
rapikan satuan & kategori; impor massal dengan pratinjau; bersihkan duplikat lama (usulan merge).

### 7.8 AI Auditor (K11)

Harian + saat transaksi baru. Pemeriksaan: duplikat (invoice/struk lintas vendor-nomor-nominal-tanggal; foto sama
dipakai dua kali); **pecah pembelian** di bawah batas approval; harga PO > acuan/penawaran; invoice ≠ PO; pembuat =
penyetuju; vendor baru langsung dibayar besar; rekening vendor berubah lalu dibayar; jurnal manual di luar jam
kerja/libur, angka bulat tanpa dokumen, akun sensitif, reverse menjelang tutup buku; pola Benford per toko; nilai
menyimpang dari pola normal; selisih opname berulang. Detektor anomali yang ada dipakai ulang. Setiap temuan →
**kasus** (risiko, bukti, penjelasan, usulan tindakan, status tindak lanjut).

### 7.9 Riset sumber luar (K13)

Web search/fetch dengan sumber & tanggal; jenis: harga pasar, supplier baru, regulasi (PPN/PPh, UMK, BPJS, halal,
BPOM), tren & kompetitor (data publik, patuhi aturan situs), berita pasokan. Digabung dengan data internal. Disimpan
sebagai **Catatan Riset**. Label "eksternal" + tingkat keyakinan.

### 7.10 Agen domain lain

Inventory (reorder, transfer, opname, waste), Outlet (sales, petty cash, closing, food cost), HR (cuti, absensi;
payroll sesuai D7).

---

## 8. Keamanan, privasi, tata kelola

**Tingkat risiko aksi**

| Tingkat | Contoh | Perlakuan |
|---|---|---|
| Rendah | baca, analisis, laporan, notifikasi, draf internal AI | otomatis |
| Sedang | buat/ubah draf PR/PO, master data, price list, impor draf | persetujuan (boleh massal) |
| Tinggi | posting jurnal, approve, GR, pembayaran, payroll | selalu persetujuan; via WA butuh PIN |
| Kritis | hapus, perubahan massal besar | persetujuan + catatan khusus; tidak bisa otomatis |

- **Kebijakan AI per peran** (apa yang boleh diusulkan/dijalankan), tersimpan berversi; **tombol darurat** (matikan
  AI / aksi tulis seketika).
- **Prompt injection**: file, web, WA = data; alat tulis tetap lewat persetujuan; AI tidak menuruti instruksi dari
  konten.
- **Audit**: siapa meminta, data yang dibaca, usulan asli, perubahan pengguna, siapa menyetujui, hasil, waktu, versi
  kebijakan.
- **WA**: nomor terverifikasi, PIN, sesi kedaluwarsa, cabut akses, opsi samarkan data sensitif.
- **UU PDP**: data diproses penyedia AI di luar negeri. PP 33/2026 (transfer lintas negara) **efektif 16 Jan 2027**.
  Rencana: DPIA, pemberitahuan/persetujuan karyawan & pelanggan, minimisasi (samarkan nama/telepon pelanggan sebelum
  dikirim ke AI), retensi riwayat AI terbatas (default 180 hari), hak hapus. Dikonfirmasi ke konsultan hukum.
- **Data gaji** tidak dapat dibaca AI di MVP (D7).

---

## 9. Biaya

- **Claude Opus 5.5**: $4 / 1 jt token input, $20 / 1 jt token output (cache read lebih murah).
  Perkiraan kasar: tugas analisis beberapa langkah ±$0,3–0,4 (±Rp 5–7 rb) sebelum caching; tanya-jawab sederhana jauh
  lebih murah. Riset web & sandbox ditagih terpisah.
- **WhatsApp MVP**: gateway open-source gratis (biaya server sendiri). Jalur resmi kelak: per pesan (utilitas
  ±Rp 357, marketing ±Rp 586 per pesan menurut penyedia; dicek ulang ke tarif Meta).
- **Kendali**: anggaran per pengguna & fitur, peringatan 80% (D6), caching, Batch API untuk pekerjaan malam,
  dashboard biaya per pengguna/fitur/agen.

---

## 10. Kualitas & evaluasi

- **Kumpulan uji per agen** (pertanyaan + jawaban/angka benar dari data demo/pilot); dijalankan setiap rilis.
- Skor: akurasi angka (vs laporan resmi), ketepatan aksi (payload benar), akurasi impor (kolom & total),
  rekonsiliasi (% cocok benar), pemandu (jawaban benar).
- **👍/👎 + komentar** di setiap jawaban → antrian perbaikan.
- **Mode latihan (dry-run)**: AI menjalankan semua langkah tanpa menyimpan — untuk pelatihan & uji.

---

## 11. Operasional

- **Antrian pekerjaan** untuk tugas panjang (progres, notifikasi selesai, bisa dibatalkan).
- **Ketahanan**: bila model/gateway WA gagal → antrian & coba ulang; fungsi inti ERP tidak terpengaruh; status
  "AI sedang tidak tersedia".
- **Observabilitas**: log per langkah (alat, durasi, token, error), dashboard kesehatan AI & WA.
- **Notifikasi**: prioritas, ringkasan, jam tenang, preferensi per pengguna.
- **Uji coba bertahap**: 1 brand pilot (D8) → ukur (waktu hemat, error tertangkap, kepuasan) → perluas.

---

## 12. Model data baru (MongoDB)

| Koleksi | Isi |
|---|---|
| `ai_sessions`, `ai_messages` | percakapan per saluran (web/WA), lintas saluran per pengguna |
| `ai_actions` | usulan aksi, status, payload asli/final, persetujuan, hasil, idempotensi, batch |
| `ai_policies` | kebijakan AI per peran (berversi), tombol darurat |
| `ai_usage` | token, biaya, durasi per permintaan/fitur/agen |
| `ai_reports`, `ai_dashboards` | spesifikasi & data laporan; grafik tersemat |
| `ai_jobs`, `ai_job_runs` | monitor & otomasi, riwayat jalan |
| `ai_memories`, `ai_kb_documents`, `ai_kb_chunks` | memori perusahaan; basis pengetahuan |
| `ai_research_notes` | catatan riset (sumber, tanggal, kesimpulan) |
| `ai_feedback`, `ai_eval_runs` | umpan balik; hasil evaluasi |
| `import_batches`, `import_recipes` | batch impor (file, resep, hasil, rollback); resep per sumber |
| `sales_transactions`, `sales_lines` | detail transaksi & baris menu |
| `menu_items`, `menu_aliases` | master menu + alias per sumber |
| `recon_sessions`, `recon_items`, `recon_rules` | lembar kerja, hasil cocok, aturan yang dipelajari |
| `audit_cases` | temuan auditor & tindak lanjut |
| `wa_links`, `channel_messages` | nomor ↔ pengguna (verifikasi, PIN), log pesan |
| `metric_definitions`, `mart_*` | kamus metrik; ringkasan analitik |
| `attachments` (ada) | bukti foto/dokumen ditautkan ke jurnal/transaksi |

Izin baru (layar Peran): Pakai Asisten AI · Persetujuan aksi AI · Impor Cerdas · Rekonsiliasi · Monitor & otomasi ·
Kasus auditor · Kelola AI (kebijakan, memori, biaya) · Akses WA bot.

---

## 13. Tahapan

| Rilis | Tahap | Isi | Bergantung pada |
|---|---|---|---|
| **R1 Fondasi & Asisten** | T1 | Klien Claude (SDK resmi), migrasi 9 fitur lama, hapus Emergent, pencatatan biaya, kebijakan AI & tombol darurat | `ANTHROPIC_API_KEY` |
| | T2 | Orkestrator, katalog aksi (introspeksi izin), usulan & persetujuan, eksekusi via API, panel Asisten AI, Pemandu dasar | T1 |
| | T3 | Analis data: query aman, kamus metrik, data mart dasar, grafik, Dashboard AI, laporan Excel/PDF, ekspor | T2 |
| **R2 Data masuk & HP** | T4 | Impor Cerdas, master menu + alias, detail transaksi, cek duplikasi, resep impor | T2 |
| | T5 | WA MVP (Evolution API): verifikasi nomor, PIN, tanya-jawab, grafik, file, foto, persetujuan, briefing | T2–T3 |
| **R3 Finance & Purchasing** | T6 | Foto → jurnal, rekonsiliasi (bank, kanal bayar, marketplace, kas, AP), tutup buku | T4 |
| | T7 | AI Purchasing (riset, price list, restock/RFQ), riset luar, AI Auditor + kasus | T2–T4 |
| **R4 Lengkap** | T8 | Skema 164 endpoint tulis sisa, agen Inventory/Outlet/HR, memori, basis pengetahuan, monitor & otomasi penuh, email/folder masuk, voice note (opsional) | R1–R3 |
| | T9 | Kumpulan uji per agen, dashboard kualitas & biaya, mode latihan, kesiapan UU PDP | berjalan sejak R1 |

Setiap tahap selesai bila: gate (`ux_audit --strict`, `audit_tours`, `audit_ui_ia`) lolos, tes backend tahap itu
lolos, kriteria selesai modul (§7) tercapai di data uji, dan dokumentasi diperbarui.

---

### 13.1 Status implementasi (25 Nov 2026)

**R1 selesai** (commit a7ef9b5, 195d11c, 3d90b97, 07f556c di branch `claude/bold-newton-uplp38`):

| Tahap | Yang jadi | Lokasi |
|---|---|---|
| T1 | Satu klien Claude (`claude-opus-5-5`, fallback server-side, pencatatan biaya `ai_usage`, kebijakan & tombol darurat, peringatan anggaran), 9 fitur lama dimigrasi, Emergent dihapus, storage lokal/S3 | `backend/services/ai/client.py`, `core/object_storage.py`, `routers/ai.py` |
| T2 | Katalog aksi otomatis dari route FastAPI (±640 aksi, izin dibaca dari `require_perm`), usulan → persetujuan/edit → eksekusi sebagai pengguna (izin & validasi route tetap berlaku), audit log, anti-dobel; loop agen (riwayat append-only, web search, lampiran foto/PDF/Excel via Files API); panel **Asisten AI** di TopNav; halaman `/ai` (Percakapan, Persetujuan AI, Pemakaian & Pengaturan); Pemandu dari tour & navigasi | `backend/services/ai/agent/`, `routers/ai_agent.py`, `frontend/src/components/ai/`, `frontend/src/portals/ai/`, `scripts/gen_ai_guide.py` |
| T3 | 24 dataset analitik whitelisted (`query_data`: filter, group_by tanggal/toko/item/akun, metrik, batas toko otomatis, ekspor xlsx/csv), kamus metrik resmi, grafik di chat, **Dashboard AI** (`/ai/dashboard`, diperbarui otomatis dari sumber query), laporan Excel (grafik native) & PDF | `services/ai/agent/datasets.py`, `reports.py` |

Terverifikasi dengan Claude sungguhan (data demo): kategori GL, OCR struk, generator jurnal, daily briefing, SEO,
rekomendasi vendor, reservasi end-to-end lewat panel (usul → setujui → tersimpan → AI melanjutkan), analisis revenue
30 vs 30 hari per toko + grafik + PDF (angka cocok dengan dashboard resmi). Biaya contoh: analisis lengkap ± $0,26.

Batas verifikasi: MongoDB sungguhan tidak tersedia di sandbox (dipakai mongomock); `web_fetch` ditolak jaringan sandbox
(otomatis dilepas — web search tetap jalan); belum diuji beban.

Perbaikan di luar AI yang ditemukan sepanjang jalan: rate limit memakai kunci IP untuk pengguna browser (cookie) →
kini per pengguna; polling GET `/api/ai/*` tidak lagi memakan kuota LLM; daily briefing tidak pernah memanggil LLM
(argumen hilang); generator jurnal tanpa tanggal hari ini & hanya 100 akun COA; SEO memakai brand demo hardcode;
upload bergantung pada storage Emergent.

**UI**: halaman `/ai` bergaya chatbot layar penuh (mirip Claude: riwayat di kiri, kolom percakapan di tengah, layar
sambutan, mode Layar penuh); panel samping tetap ada di semua halaman.

**R2 selesai** (commit c5f7ff6, a57941d, fedc338, c02fe92):

| Tahap | Yang jadi | Lokasi |
|---|---|---|
| T4 | **Impor Cerdas** `/ai/import`: CSV/TXT/XLSX/XLS/HTML-as-xls; deteksi header, kop, baris total, sel gabung, encoding; angka & tanggal Indonesia/Inggris; pemetaan kolom berdasar nama + isi (kamus ID/EN → AI bila ragu → resep tersimpan per sumber); format lebar (channel/bayar per kolom); payout aplikasi delivery dideteksi dari angka; cut-off hari bisnis; void/refund; peringatan waktu di masa depan & total tidak konsisten. Cek duplikasi 4 lapis (file, transaksi, hari yang sudah ada: baru/sama/ganti/gabung/konflik/terkunci, pesanan ganda POS vs aplikasi). Simpan detail per struk & per item (`sales_transactions`, `sales_lines`) + rekap ke Daily Sales DRAF lewat validasi yang ada; rollback; master menu otomatis + alias (`/api/menu/items`). Mutasi bank → sesi rekonsiliasi (unggah di layar Rekonsiliasi Bank kini memakai parser yang sama). | `services/smart_import/`, `routers/smart_import.py`, `routers/menu_master.py` |
| T5 | **Bot WhatsApp** (Evolution API): tautan nomor dengan kode dari aplikasi, tanya-jawab lewat agen yang sama, lampiran foto/PDF/Excel, laporan & grafik PNG dikirim balik, persetujuan "SETUJUI 1" setelah PIN (15 menit; > Rp10 jt via aplikasi), notifikasi penting, log pesan, cabut akses oleh admin. Halaman `/ai/whatsapp`. | `services/wa_bot/`, `services/whatsapp_service.py`, `routers/whatsapp_bot.py` |

Riset format (T4): vendor POS/aplikasi delivery/bank tidak memublikasikan daftar kolom ekspor & formatnya berubah antar
versi — karena itu mesin memetakan berdasarkan nama + isi kolom (bukan posisi), dengan 13 contoh format berbeda sebagai
uji (`backend/tests/smart_import_samples.py`). Tambahkan contoh nyata dari pemilik ke kumpulan uji saat tersedia.

**Memasang WhatsApp (Evolution API)**: jalankan Evolution API v2 (Docker) dengan nomor khusus bot → buat instance &
scan QR → di ERP (Admin → Integrations/System settings, kategori whatsapp) isi `WHATSAPP_PROVIDER=evolution`,
`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WHATSAPP_BOT_NUMBER`, `WHATSAPP_WEBHOOK_SECRET` →
set webhook instance ke `https://<app>/api/wa/webhook?token=<WHATSAPP_WEBHOOK_SECRET>` dengan event `MESSAGES_UPSERT`
(opsional `webhook_base64: true`). Gateway tidak resmi: risiko blokir nomor oleh WhatsApp — pakai nomor khusus,
tanpa broadcast.

**R3 selesai** (commit 39cf14e, cf8207b, 7856380 + UI):

| Tahap | Yang jadi | Lokasi |
|---|---|---|
| T6 | **Foto/PDF struk → jurnal**: OCR (Claude), akun beban dari aturan kategorisasi → AI, PPN masukan opsional, cek bukti ganda (hash file, vendor+no struk, vendor+total+tanggal, kas kecil), jurnal manual menyimpan dimensi toko/brand/vendor + lampiran + referensi bukti, akun vendor dipelajari. **Rekonsiliasi bank dengan AI** (tombol *Analisis AI* di sesi rekonsiliasi): payout GoFood/Grab/Shopee banyak-ke-satu (1–7 hari, komisi otomatis), settlement QRIS/EDC − MDR, setoran tunai per toko, biaya/bunga/pajak bunga; sisa baris dijelaskan Claude + alasan bila belum cocok; usulan terpilih dibukukan & mutasi ditandai cocok; pola dipelajari (`recon_rules`). **Asisten tutup buku** (kartu *Kesiapan tutup buku* di Period Closing): checklist Daily Sales/GRNI/AP/rekonsiliasi/kas kecil/payroll/penyusutan + fluktuasi akun + ringkasan AI. | `services/ai_finance/`, `routers/ai_finance.py`, `portals/finance/AIReconPanel.jsx`, `CloseAssistantCard.jsx` |
| T7 | **AI Purchasing**: analisis price list supplier (foto/PDF/Excel/teks) — cocokkan ke master item, normalisasi kemasan (dus 12×1 L → per liter), banding harga GR terakhir, penawaran vendor lain & acuan wilayah, deteksi kenaikan/shrinkflation, dampak per bulan, draf negosiasi, payload penawaran; saran restock (PR per toko, PO per vendor). **AI Auditor** (terjadwal 03:30 + tombol Scan anomali): invoice ganda, bukti ganda, pemecahan pembelian di bawah batas, maker = checker, jurnal di luar jam/angka bulat/reversal dekat tutup buku, pola kas kecil (Benford, pencilan), harga PO di atas acuan → masuk Anomaly Feed. | `services/ai_purchasing/`, `services/ai_audit/`, `routers/ai_ops.py` |
| Menu | **Menu & Resep** `/outlet/menu`: master menu per brand (termasuk dari impor penjualan), resep/BOM dengan konversi satuan & susut, HPP per porsi dari harga GR 90 hari/penawaran, food cost % (peringatan > 35%), simulasi saat mengedit, versi resep, riset/analisis resep lewat Asisten AI. | `services/menu_recipe_service.py`, `routers/menu_master.py`, `portals/outlet/MenuRecipePage.jsx` |

Perbaikan akuntansi yang ditemukan: penerimaan QRIS/kartu/e-wallet di jurnal Daily Sales dulu masuk **Kas di tangan**
→ kini Piutang kartu/QRIS; penjualan GoFood/Grab/Shopee → Piutang marketplace (akun 1121, komisi 5431, biaya bank
5432, bunga 4031 dibuat otomatis); impor penjualan delivery dulu tanpa metode bayar (jurnal tidak seimbang) → metode
marketplace dibuat otomatis; jurnal manual dulu membuang dimensi toko/brand; unggah mutasi bank kini menerima XLSX/XLS.

Diuji: 41 tes AI tanpa jaringan + alur UI nyata (rekonsiliasi: 3 jurnal penyesuaian dibukukan & baris cocok; resep:
simulasi HPP; tutup buku dengan ringkasan Claude).

## 14. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Nomor WA diblokir (gateway tidak resmi) | Nomor khusus, tanpa broadcast, batas laju, adaptor siap pindah ke API resmi, fallback app/Telegram |
| AI salah aksi | Persetujuan bertingkat, pratinjau sebelum→sesudah, idempotensi, batalkan, audit |
| Angka keliru/halusinasi | Hitungan oleh mesin, kamus metrik, "cara menghitung", uji akurasi |
| Perintah tersembunyi di file/web/WA | Konten = data; aksi lewat persetujuan; alat tulis tidak dipicu konten |
| Biaya membengkak | Anggaran & peringatan, caching, Batch API, dashboard biaya |
| Data pribadi ke luar negeri (UU PDP) | Minimisasi, samarkan, DPIA, persetujuan, retensi terbatas |
| Kualitas data sumber buruk | Profil & pratinjau impor, rekonsiliasi total, resep tersimpan |
| Adopsi rendah | Pilot 1 brand, Pemandu, ukur manfaat |
| Lingkungan uji terbatas | Tes logika dengan model tiruan; uji nyata butuh kunci API & MongoDB |

---

## 15. Yang dibutuhkan dari pemilik

1. **`ANTHROPIC_API_KEY`** diisi di Admin → Integrations (jangan dikirim lewat chat).
2. **Nomor WhatsApp khusus bot** + server untuk Evolution API (Docker).
3. **Contoh file** ekspor POS, GoFood/Grab/Shopee, mutasi bank, price list supplier (boleh disamarkan).
4. **Brand pilot** (D8) dan **anggaran** AI bulanan (D6).
5. Konfirmasi keputusan terbuka D1–D9 (§3).
6. Konsultasi hukum untuk UU PDP (§8).

---

## Lampiran: sumber riset

- Agen procurement: [BCG](https://web-assets.bcg.com/6f/04/c31eeca24f70ac87dece17fd81a2/executive-perspectives-from-ai-assistance-to-agentic-orchestration-with-applied-ai-procurement.pdf),
  [IBM](https://www.ibm.com/think/topics/ai-agents-in-procurement),
  [McKinsey](https://www.mckinsey.com/capabilities/operations/our-insights/redefining-procurement-performance-in-the-era-of-agentic-ai),
  [IBISWorld](https://www.ibisworld.com/blog/ai-agents-in-procurement-workflows/1/1126/)
- Pengaman aksi AI di ERP: [CData](https://www.cdata.com/blog/secure-ai-agent-connections-erp-platforms),
  [SAPinsider](https://sapinsider.org/blogs/how-sap-teams-can-decide-which-ai-agent-actions-still-need-approval/),
  [DZone](https://dzone.com/articles/human-in-the-loop-approval-enterprise-ai-agents),
  [AWS](https://aws.amazon.com/blogs/awsforsap/aws-agentic-standard-operating-procedures-sops-for-erp-automation/)
- Kejanggalan transaksi: [Diligent](https://www.diligent.com/insights/fraud/identify-accounts-payable-fraud),
  [Singh & Best 2020](https://ideas.repec.org/a/ami/journl/v19y2020i2p379-404.html),
  [arXiv 1709.05254](https://arxiv.org/pdf/1709.05254)
- Harga pangan: [BI PIHPS](https://www.bi.go.id/hargapangan/Informasi/FAQ),
  [data.go.id](https://data.go.id/dataset/dataset/rata-rata-harga-pangan-bulanan-tingkat-konsumen-nasional-update-harga-februari-2026)
- WhatsApp: [Omnichat](https://blog.omnichat.ai/unofficial-whatsapp-business-api/),
  [Qiscus](https://www.qiscus.com/id/blog/whatsapp-gateway/),
  [Qontak tarif](https://help-center.qontak.com/hc/en-us/articles/48430892733465-Latest-WhatsApp-Message-Prices-October-2026),
  [Sleekflow](https://sleekflow.io/id-id/blog/simulasi-biaya-whatsapp-api-dalam-rupiah-tarif-ppn-dan-tagihan-bulanan),
  [Meta pricing](https://developers.facebook.com/docs/whatsapp/pricing),
  [Meta reply buttons](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages),
  [Meta list messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages),
  [Evolution API](https://raw.githubusercontent.com/evolution-foundation/evolution-api/main/README.md),
  [freeCodeCamp WAHA](https://www.freecodecamp.org/news/how-to-build-a-self-hosted-whatsapp-bot-with-n8n-and-waha),
  [risiko gateway tidak resmi](https://whatsapp.checkleaked.cc/es/blog/best-whatsapp-api-providers)
- Rekonsiliasi: [Stripe](https://stripe.com/resources/more/automated-reconciliation),
  [Adyen](https://www.adyen.com/knowledge-hub/payment-reconciliation),
  [Solvexia](https://www.solvexia.com/blog/payment-reconciliation-automation-fintech-retail)
- UU PDP: [hukumonline](https://www.hukumonline.com/berita/a/polemik-raperpres-badan-pdp-dan-ketidakpastian-transfer-data-pribadi-lintas-batas-lt69dc9986a7db1/),
  [Bisnis](https://teknologi.bisnis.com/read/20260908/84/2002386/uu-dan-pp-sudah-ada-pengamat-aturan-pdp-belum-efektif-tanpa-lembaga)
