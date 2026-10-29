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
