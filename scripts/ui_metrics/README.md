# UI metrics — audit ukuran komponen (runtime)

Mengukur ukuran **terhitung** (computed style) di setiap halaman & tab ERP, lalu membandingkannya dengan
`docs/DESIGN_SYSTEM.md`. Yang diukur: tombol, input/select, tab, kartu (padding, radius, card-in-card),
kartu KPI, heading, ukuran teks, kontras WCAG, tabel, status pill, ikon.

Pelengkap `scripts/ux_audit.py` (statis): audit ini menangkap hal yang hanya terlihat saat dirender,
misalnya tinggi pill yang mengikuti line-height induk, atau kontras teks di atas kartu kaca.

## Menjalankan

Prasyarat: aplikasi berjalan (lihat `docs/LOCAL_SETUP.md`), data demo, Node + `playwright` (Chromium).

```bash
cd scripts/ui_metrics
python3 routes.py                                  # perbarui routes.json dari router React
node sizes.js out/sizes_light_0.json 0 2 light & node sizes.js out/sizes_light_1.json 1 2 light & wait
node sizes.js out/sizes_dark_0.json 0 2 dark & node sizes.js out/sizes_dark_1.json 1 2 dark & wait
cd out && python3 ../report.py sizes_light && python3 ../report.py sizes_dark
```

Env opsional: `UI_BASE` (default `http://localhost:3000`), `UI_EMAIL`, `UI_PASSWORD` (default akun demo
super admin). Route berparameter (`/x/:id`) hanya diukur bila ada `params.json`
(`{"/procurement/po/:id": "<id>"}`).

Laporan menampilkan persentase "sesuai spec" per komponen dan daftar halaman/elemen yang menyimpang
(dengan potongan `className` untuk menemukan sumbernya).

## Audit komposisi (layout.js)

Cek per elemen bisa lolos semua, tetapi layarnya tetap terasa salah: toolbar yang terlipat jadi dua baris
setengah kosong, tab hub yang terpotong, kalimat pengantar bertumpuk, istilah Inggris & Indonesia campur di
satu layar, angka uang terpotong "…", tombol utama berjajar di setiap baris tabel. `layout.js` membuka setiap
route + tab dan menjalankan heuristik komposisi tersebut; screenshot disimpan hanya untuk state yang punya temuan.

```bash
cd scripts/ui_metrics
for i in 0 1 2 3; do node layout.js out/layout_$i.json out/shots $i 4 & done; wait
cd out && python3 ../layout_report.py 6          # ringkasan per jenis + fakta penempatan lintas halaman
ONLY='^/finance/payments-hub$' node ../layout.js layout_0.json shots   # ulang satu halaman saja
```

Temuan bersifat heuristik: konfirmasi lewat screenshot sebelum memperbaiki. Hasil terakhir:
`docs/audit/UI_LAYOUT_AUDIT_2026-10-29.md`.

## Audit anatomi halaman (anatomy.js)

Membaca **kerangka** tiap halaman/tab:
- urutan header, tab, judul, kartu & jenis isinya;
- letak judul (di luar / di dalam kartu);
- zona setiap tombol aksi;
- posisi tombol simpan relatif terhadap form;
- grup KPI;
- semua teks UI (untuk audit bahasa).

Dipakai untuk menilai konsistensi "anatomi halaman": judul, kartu, letak aksi, dan simpan.

```bash
cd scripts/ui_metrics
for i in 0 1 2 3; do node anatomy.js out/an_$i.json out/shots $i 4 & done; wait   # out/shots: screenshot per state (atau "-")
cd out && python3 ../anatomy_report.py
```

Hasil terakhir: `docs/audit/UI_PAGE_ANATOMY_AUDIT_2026-10-29.md`.
