# Audit ukuran komponen UI — terukur (29 Okt 2026)

Metode: crawler Playwright (`scripts/ui_metrics/sizes.js`) membuka setiap route ERP dan setiap tab di halaman,
lalu membaca ukuran **terhitung** (computed style) dari elemen yang tampil: tombol, input/select, tab, kartu,
kartu KPI, heading, teks, tabel, status pill, ikon, dan kontras warna teks terhadap latar sebenarnya
(latar kaca dikomposisikan ke token `--background`). Viewport 1280×800, login super admin, mode terang & gelap.
Cakupan: halaman: 170  state (halaman + tab): 549  error: 0.

Spesifikasi acuan: `docs/DESIGN_SYSTEM.md`. Angka "sesuai" = persentase elemen yang ukurannya tepat sesuai spec;
angka dalam kurung = jumlah elemen terukur.

## 1. Kepatuhan per komponen (mode terang)

| Komponen | Spec | Sebelum | Sesudah |
|---|---|---|---|
| Tombol teks — tinggi | 32 / 36px (sm / default) | 94.5% (2691) | 95.7% (2701) |
| Tombol teks — font | 13 / 14px | 94.8% (2691) | 95.7% (2701) |
| Tombol ikon — tinggi | 32 / 36px | 97.5% (2583) | 100.0% (2599) |
| Tombol — radius | 12px (rounded-md) | 100.0% (5274) | 100.0% (5300) |
| Tile pilihan (<button>) — radius | 12px | 82.7% (104) | 100.0% (104) |
| Ikon bantuan (?) — area klik | ≥ 24px (WCAG 2.2) | 0.0% (182) | 100.0% (182) |
| Input / select — tinggi | 36px (32 sm) | 99.1% (920) | 99.1% (920) |
| Input / select — font | 14px | 99.0% (920) | 99.0% (920) |
| Tab — tinggi | 32px | 100.0% (3458) | 100.0% (3449) |
| Kartu — padding | 12 / 16px (0 = pembungkus tabel) | 92.4% (2559) | 100.0% (2546) |
| Kartu — radius | 18px | 100.0% (2559) | 100.0% (2546) |
| Kartu di dalam kartu | tidak ada | 99.1% (2559) | 100.0% (2546) |
| Judul kartu — font | 16px | 99.7% (878) | 99.7% (873) |
| Kartu KPI — tinggi | 72 / 88px | 100.0% (753) | 100.0% (741) |
| H1 — font | 24px, 1 per halaman | 100.0% (548) | 100.0% (548) |
| H3 — font | 16px | 94.8% (901) | 96.5% (896) |
| Header tabel — font | 11px uppercase | 92.1% (1473) | 100.0% (1474) |
| Sel tabel — font | 14px | 100.0% (10690) | 100.0% (10657) |
| Status pill — tinggi | 20px | 99.9% (1639) | 100.0% (1642) |

## 2. Keterbacaan & kontras

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Teks 11px bukan uppercase (atau < 11px) | 3209 elemen | 0 elemen |
| Teks di bawah WCAG AA — mode terang | 2361 elemen | 9 elemen |
| Teks di bawah WCAG AA — mode gelap | 548 elemen | 30 elemen |

Distribusi ukuran teks sebelum: 11px:7472 (19.5%), 12px:9342 (24.4%), 13px:5331 (13.9%), 14px:13890 (36.2%), 16px:1164 (3.0%), 18px:191 (0.5%), 20px:415 (1.1%), 24px:559 (1.5%)

Distribusi ukuran teks sesudah: 11px:2634 (6.9%), 12px:14104 (36.8%), 13px:5357 (14.0%), 14px:13851 (36.2%), 16px:1190 (3.1%), 18px:187 (0.5%), 20px:403 (1.1%), 24px:559 (1.5%)

Catatan: kontras dihitung per elemen teks (maks. 400 elemen/halaman) dengan mengomposisikan latar semi-transparan
ke warna `--background`. Teks di atas gambar/gradien dapat terukur kurang akurat.

## 3. Akar masalah yang ditemukan & perbaikannya

| Temuan (terukur) | Akar masalah | Perbaikan |
|---|---|---|
| Tinggi status pill 18 / 20 / 24px tergantung halaman | `text-[11px]` tanpa tinggi & line-height → mengikuti elemen induk | `StatusPill` h-5 + `leading-none`, 12px |
| 19,5% teks berukuran 11px, kebanyakan kalimat biasa | `text-[11px]` dipakai sebagai "teks kecil" di 128 file (spec: hanya label uppercase) | 330 pemakaian → `text-xs` (12px); label uppercase & badge angka tetap 11px; label chart 12px |
| Teks hijau/merah/kuning < 4,5:1 di mode terang | warna status `-500/-600` + tanpa varian dark | 507 kelas → `-700` (amber/orange `-800`) + `dark:-400`; di atas latar berwarna `-800` |
| Teks sekunder 4,3–4,49:1 di atas kartu kaca | `--muted-foreground` 44% hanya 4,77:1 di latar polos | token 40% (≥ 4,66:1 di latar berwarna); teks merah `--destructive` 48% |
| Tombol Setujui putih di atas hijau 3,3–3,8:1 | 6 implementasi manual `bg-emerald-600`/`bg-green-600` | varian `Button variant="success"` (emerald-700) |
| Chip berbeda-beda (26 / 28 / 30 / 36px, 12 atau 13px) | chip `rounded-full` dibuat ulang per halaman | standar chip = `Button size="sm"` + `aria-pressed` |
| Tombol 20–40px, `rounded-full`, `pill-active` | override `h-*`/bentuk di `className` Button | override dihapus; ukuran lewat `size` |
| Ikon bantuan "?" 14–16px & pucat | target klik kecil, warna `foreground/40` | area klik 24px (tata letak sama), warna muted |
| Padding kartu 8 / 10 / 20px | `px-3 py-2`, `px-4 py-2.5`, `p-5` per halaman | p-3 / p-4 |
| Kartu di dalam kartu (End of Day, Q&A) | halaman di-embed di dalam kartu langkah | `.nested-cards` → kartu anak datar |
| Header tabel 14px normal di sub-tabel | `<th>` mentah tanpa gaya, `TableHead` beda dengan DataTable | aturan dasar `th` = gaya DataTable; `TableHead` diselaraskan |
| Tile pilihan radius 12 & 14px | `rounded-lg` vs `rounded-md` | `rounded-md` |
| Judul bagian 14px uppercase (CollapsibleSection) | gaya di luar skala tipografi | 16px semibold (tier judul kartu) |
| Heatmap: teks putih di atas gradien oranye/kuning | gradien pada elemen kecil + teks putih | isi solid berwarna + teks gelap |
| Legenda chart berwarna seri (2,2–4,3:1) | default Recharts | teks legenda = warna teks (penanda warna tetap) |
| Warna netral hard-coded (`text-gray-*`, `bg-white`) di 25 file | tidak ikut mode gelap | token tema |

## 4. Sisa yang disengaja / di luar spec

- **Tombol teks 16px (117)** — tombol berbentuk link inline (`variant="link"`, mis. "Update saldo" di Cash Position); secara visual teks link, bukan tombol.
- **Kontras: 9 (terang) / 30 (gelap) elemen tersisa** — pratinjau SERP Google di Smart SEO (sengaja meniru tampilan Google), legenda kustom di beberapa chart budget, dan beberapa angka berwarna data. Tercatat untuk putaran berikut.
- **Baris tabel lebih tinggi dari 56px** — sel berisi dua baris (nama + email, nominal + keterangan). Tergantung konten, bukan gaya.
- **H2 16px** — `h2` yang menjadi judul kartu (mis. kartu "Filter" di Report Center) memakai tier judul kartu 16px; secara semantik tetap h2.
- **Label uppercase 11px** (label KPI, header tabel, badge angka) — tier micro label, sesuai spec.
- **Halaman sistem** (403/404/coming soon) memakai kartu hero `p-6/p-8` — dikecualikan.
- **Situs publik & aplikasi member loyalty** — gaya brand berbeda, di luar design system ERP.

## 5. Pencegahan drift

- `docs/DESIGN_SYSTEM.md` = acuan tunggal; `design_guidelines.md/json` ditandai sekunder, aturan yang bertentangan dihapus.
- `CLAUDE.md` di root repo: aturan UI ringkas yang otomatis dibaca agen AI (Claude Code) saat vibe coding.
- `scripts/ux_audit.py --strict`: aturan `ds.*` (font minimum, 11px, kontras, override Button, warna netral, padding kartu).
- `scripts/ui_metrics/`: crawler runtime ini, untuk diulang setelah perubahan UI besar.

## Lampiran — distribusi lengkap (sesudah, mode terang)

```
pages measured: 170  states: 549  errors: 0

## Tombol teks — tinggi (px): n=2701  sesuai spec 95.7%
   distribusi: 32:1796, 36:788, 16:117
   halaman terbanyak off-spec: /owner/cash(27), /finance/payments-hub?tab=cash-position(18), /finance/payments-hub(9), /finance/payments-hub?tab=payment-runs(9), /finance/payments-hub?tab=bank-recon(9), /finance/payments-hub?tab=payments(9), /finance/payments-hub?tab=ap-aging(9), /finance/payments-hub?tab=deposits(9)
   - 16 @ /finance/payments-hub [tab:Cash position] 'cash-update-BANK-BCA-OPS' :: inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:ou

## Tombol ikon — tinggi (px): n=2599  sesuai spec 100.0%
   distribusi: 32:2002, 36:597

## Tombol teks — font-size: n=2701  sesuai spec 95.7%
   distribusi: 13:1796, 14:788, 12:117
   halaman terbanyak off-spec: /owner/cash(27), /finance/payments-hub?tab=cash-position(18), /finance/payments-hub(9), /finance/payments-hub?tab=payment-runs(9), /finance/payments-hub?tab=bank-recon(9), /finance/payments-hub?tab=payments(9), /finance/payments-hub?tab=ap-aging(9), /finance/payments-hub?tab=deposits(9)
   - 12 @ /finance/payments-hub [tab:Cash position] 'cash-update-BANK-BCA-OPS' :: inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:ou

## Tombol — radius: n=5300  sesuai spec 100.0%
   distribusi: 12:5155, 10:122, 9999:23

## Kartu/baris pilihan (<button>) — radius: n=104  sesuai spec 100.0%
   distribusi: 12:104

## Ikon bantuan (?) — ukuran target: n=182  sesuai spec 100.0%
   distribusi: 24:182

## Input/select — tinggi: n=920  sesuai spec 99.1%
   distribusi: 36:893, 32:19, 1:8
   halaman terbanyak off-spec: /outlet/reservations/new(4), /outlet/reservations/7e557f21-e3b5-483e-b792-f9bcfb593292/edit(4)
   - 1 @ /outlet/reservations/new [page] 'The BakeryThe BistroThe CoffeeshopThe Lo' :: 

## Input/select — font-size: n=920  sesuai spec 99.0%
   distribusi: 14:911, 16:8, 12:1
   halaman terbanyak off-spec: /outlet/reservations/new(4), /outlet/reservations/7e557f21-e3b5-483e-b792-f9bcfb593292/edit(4), /finance/period-closing?phase=1(1)
   - 16 @ /outlet/reservations/new [page] 'The BakeryThe BistroThe CoffeeshopThe Lo' :: 
   - 12 @ /finance/period-closing?phase=1 [page] 'anomaly-sort' :: flex items-center justify-between whitespace-nowrap border border-input bg-transparent py-2 shadow-sm ring-off

## Tab — tinggi: n=3449  sesuai spec 100.0%
   distribusi: 32:3449

## Kartu — padding: n=2546  sesuai spec 100.0%
   distribusi: 12:1168, 16:762, 0:616

## Kartu — radius (di luar .nested-cards): n=2546  sesuai spec 100.0%
   distribusi: 18:2513, 14:33

## Kartu bersarang (card-in-card): n=2546  sesuai spec 100.0%
   distribusi: False:2546

## Judul kartu — font-size: n=873  sesuai spec 99.7%
   distribusi: 16:843, 14:20, 18:7, 12:3
   halaman terbanyak off-spec: /finance/reports(3)
   - 12 @ /finance/reports [tab:Balance Sheet] 'bs-section-asset' :: glass-card overflow-hidden

## Kartu KPI — tinggi: n=741  sesuai spec 100.0%
   distribusi: 90:409, 88:214, 72:118

## H1 — font-size: n=548  sesuai spec 100.0%
   distribusi: 24:548

## H2 — font-size: n=79  sesuai spec 72.2%
   distribusi: 18:57, 16:22
   halaman terbanyak off-spec: /inventory/transfers/a4148de5-4b02-4c10-871a-e6e7e27a53f1(3), /reports/daily-sales(2), /reports/pl-group(2), /owner/digest-settings(2), /reports/stock-balance(1), /reports/gr-summary(1), /reports/ap-aging(1), /reports/stock-movement(1)
   - 16 @ /reports/stock-balance [page] 'Filter' :: 

## H3 — font-size: n=896  sesuai spec 96.5%
   distribusi: 16:865, 14:21, 11:7, 12:3
   halaman terbanyak off-spec: /finance/reports(7), /procurement/kanban(7), /admin/configuration/sales-schemas(5), /admin/integrations(4), /admin/integrations/email(4), /owner/digest-settings(1), /finance/period-closing?phase=1(1), /finance/period-closing/2026-09(1)
   - 12 @ /finance/reports [tab:Balance Sheet] 'ASET' :: 
   - 14 @ /finance/reports [tab:Procurement reports] 'Purchase Request (PR)' :: 
   - 11 @ /procurement/kanban [page] 'PR Draft' :: 

## Jumlah H1 per halaman: {1: 169, 0: 1}

## Header tabel — font-size: n=1474  sesuai spec 100.0%
   distribusi: 11:1474

## Sel tabel — font-size: n=10657  sesuai spec 100.0%
   distribusi: 14:10657

## Baris tabel — tinggi: n=2375  sesuai spec 84.4%
   distribusi: 36:685, 44:352, 56:347, 52:207, 37:169, 48:150, 58:114, 100:110, 38:88, 80:80
   halaman terbanyak off-spec: /finance/payments-hub?tab=ar-invoices(41), /finance/payments-hub(25), /finance/payments-hub?tab=payments(25), /finance/payments-hub?tab=payment-runs(22), /finance/payments-hub?tab=bank-recon(22), /finance/payments-hub?tab=ap-aging(22), /finance/payments-hub?tab=cash-position(22), /finance/payments-hub?tab=deposits(22)
   - 76 @ /finance/payments-hub [page] '' :: 
   - 100 @ /finance/payments-hub [tab:AR invoices] '' :: 
   - 80 @ /finance/payments-hub [tab:AR invoices] '' :: 
   - 112 @ /finance/vendor-scorecard [page] '' :: 
   - 72 @ /finance/vendor-scorecard [page] '' :: 
   - 92 @ /finance/vendor-scorecard [page] '' :: 
   - 64 @ /inventory/low-stock [page] '' :: 
   - 90 @ /admin/user-management?tab=users [page] '' :: 
   - 58 @ /admin/cms/brands [tab:Menu items] '' :: 

## Status pill — tinggi: n=1642  sesuai spec 100.0%
   distribusi: 20:1642

## Ukuran teks (elemen pemilik teks): 11px:2634 (6.9%), 12px:14104 (36.8%), 13px:5357 (14.0%), 14px:13851 (36.2%), 16px:1190 (3.1%), 18px:187 (0.5%), 20px:403 (1.1%), 24px:559 (1.5%)

## Teks < 11px, atau 11px bukan uppercase (bukan badge): n=0  sesuai spec 0.0%
   distribusi: 

## Teks kontras di bawah WCAG AA: n=9  sesuai spec 0.0%
   distribusi: 4.35:2, 2.25:1, 3.63:1, 3.91:1, 2.18:1, 1.1:1, 1.04:1, 2.54:1
   halaman terbanyak off-spec: /admin/smart-seo(5), /executive/budget-monitor(3), /executive/budget-increase-requests(1)
   - 2.25 @ /executive/budget-monitor [tab:Detail] 'KDO Budget / Actual / %' :: 
   - 3.63 @ /executive/budget-monitor [tab:Detail] 'FDO Budget / Actual / %' :: 
   - 3.91 @ /executive/budget-monitor [tab:Detail] 'BDO Budget / Actual / %' :: 
   - 2.18 @ /executive/budget-increase-requests [page] 'Rp 5.000.000' :: text-lg font-semibold tabular-nums
   - 1.1 @ /admin/smart-seo [page] 'Optimasi Semua' :: inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colo
   - 1.04 @ /admin/smart-seo [page] 'Generate' :: ml-1.5 hidden sm:inline
   - 2.54 @ /admin/smart-seo [page] 'Meta description belum diisi...' :: text-gray-400 italic
   - 4.35 @ /admin/smart-seo [page] 'fnbgroup.id' :: text-[11px] text-gray-500 uppercase
   - 4.35 @ /admin/smart-seo [page] '...' :: text-xs text-gray-500 mt-0.5 line-clamp-2

## Ikon dalam tombol (lebar px): 16:5177, 14:2315, 12:728, 18:109, 11.2:10, 10.2:10, 9.7:4, 11.4:4, 8.5:2, 9.4:1
```
