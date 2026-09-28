# Torado ERP — Deep UI/UX & Information Architecture Audit
**Tanggal:** 2026-06-17 · **Auditor:** Neo (AI Full-Stack Engineer)
**Metode:** Live walkthrough (login sebagai `admin@torado.id`) + analisis visual screenshot per-halaman pada viewport 1920×800, light mode + grounding ke source code (komponen & token).
**Status:** DRAFT untuk REVIEW USER. Belum ada perubahan kode yang dieksekusi.
**Catatan:** Sesuai instruksi user — **tema/visual TIDAK diubah**. Fokus audit = ukuran elemen, kepadatan (density), efisiensi ruang, konsistensi antar-halaman, struktur menu (IA), dan interaksi yang membingungkan.

---

## 1. Ringkasan Eksekutif

Backend & data Torado solid; masalah ada murni di **lapisan presentasi (UI/UX & IA)**. Tiga akar masalah sistemik:

1. **Bloat ukuran komponen** — kartu KPI, header halaman, sidebar, search bar, dan "action tiles" memakai padding/font yang terlalu besar. Akibatnya density rendah: 1 layar 1920×800 hanya memuat sedikit informasi yang sebenarnya bisa muat 2× lipat.
2. **Inkonsistensi komponen** — KPI/stat ditampilkan dengan **≥5 gaya kartu berbeda** dan tab dalam-halaman dengan **≥4 gaya berbeda**. Metrik yang sama (Cash, Rev MTD, AP) tampil raksasa di satu halaman dan mungil di halaman lain.
3. **IA berantakan & redundan** — banyak item sidebar yang sebenarnya hanya tab di dalam halaman (Finance Reports 8 item, Procurement Vendors 4 item), banyak "single-item section" (parent + 1 anak), plus bug visual **double-active** (parent & anak sama-sama menyala). Sidebar Finance/Admin sampai overflow → user terpaksa collapse.

**Skor severity:** P0 (kritis) = 4 tema · P1 (tinggi) = 7 tema · P2 (sedang) = 4 tema.

Target hasil refactor: sidebar tiap portal ≤ ~12 item (tanpa perlu collapse), satu komponen KPI/stat tunggal, satu komponen tab tunggal, density naik ~30–40%, dan nol bug double-active / cross-nav tak terduga.

---

## 2. Metodologi

| Langkah | Yang dilakukan |
|---|---|
| Inventarisasi rute & IA | Memetakan 8 portal + seluruh item dari `src/lib/navigationSchema/*.js` & router `App.js`. |
| Capture sistematis | Login lalu screenshot ~27 halaman kunci (semua dashboard + halaman tabel/hub/list representatif) di viewport tetap 1920×800. |
| Analisis visual | Inspeksi tiap tangkapan: density, sizing, konsistensi, IA, interaksi, rasio info/ruang. |
| Grounding kode | Verifikasi nilai aktual di `Sidebar.jsx`, `KpiCard.jsx`, `KpiSnapshotStrip.jsx`, `PageHeader.jsx`, `PortalSubNav.jsx`, `StatusPill.jsx`, `AppShell.jsx`, `index.css`. |

**Kredensial uji:** `admin@torado.id` / `Torado@2026` (Super Admin, akses `*` ke semua portal).

---

## 3. Temuan Sistemik (Lintas-Halaman)

> Format: **[ID] Judul — Severity** · Bukti (halaman) · Akar penyebab (file) · Rekomendasi.

### F1 — Bug "Double-Active" pada Sidebar · **P0**
- **Bukti:** TERLIHAT di SEMUA halaman. Saat anak menu aktif, tombol **parent section** juga ikut menyala kotak terang **dan** item anak menyala penuh. Contoh: Owner `Cockpit`+`Executive Summary`; Finance `Reports`+`Reports Hub`; Procurement `Vendors`+`All Vendors`.
- **Akar penyebab:** `src/components/layout/Sidebar.jsx`
  - L57 `isSectionActive()` → true jika ada anak yang path-nya match.
  - L104–106: saat `isActive`, parent diberi `text-foreground bg-foreground/[0.07]` (kotak highlight) — bertabrakan visual dengan highlight anak di L163–164 (`bg-foreground/[0.08] border-l-2`).
- **Rekomendasi:** Parent yang "mengandung" halaman aktif cukup ditandai **warna teks/ikon** (`text-foreground font-medium`) **tanpa background**. Hanya **anak** yang mendapat pill penuh. Hilangkan `bg-foreground/[0.07]` pada parent saat anak aktif.

### F2 — `KpiCard` terlalu besar & boros ruang horizontal · **P0**
- **Bukti:** Hampir semua dashboard (Owner, Outlet, Procurement, Inventory, Finance, HR). Nilai rata kiri + ikon kecil kanan-atas → sisi kanan kartu kosong melompong; tinggi kartu ~110–130px untuk 1 angka.
- **Akar penyebab:** `src/components/shared/KpiCard.jsx` → `p-5`, value `text-2xl lg:text-[28px]`, ikon `h-9 w-9`, `mb-3`, `mt-3`, blur accent `h-28 w-28`.
- **Pembanding:** `KpiSnapshotStrip.jsx` (dipakai di AI Q&A) sudah padat: `glass-card px-3 py-2.5`, value `text-sm`, ikon `h-7` — terbukti bisa jauh lebih ringkas.
- **Rekomendasi (token kompak):** `p-5 → p-4`, value `text-[28px] → text-[22px]` (atau `text-xl`), ikon `h-9 → h-8`, `mb-3 → mb-2`, `mt-3 → mt-2`, blur `h-28 → h-20`. Hilangkan ruang kosong kanan dengan layout label+ikon sebaris di atas, value besar di bawah (mengikuti gaya yang lebih efisien). Target tinggi kartu ≤ ~88px.

### F3 — Komponen KPI/Stat tidak konsisten (≥5 gaya) · **P1**
- **Bukti (gaya berbeda untuk fungsi sama):**
  1. `KpiCard` (value kiri, ikon kanan-atas, blur accent) — `/executive/analytics`, `/owner`, dll.
  2. Stat "centered icon-top" — `/executive` (Owner Home, 6 kartu).
  3. Stat "inline ikon+label atas, value bawah" — `/executive/brand`, `/executive/period-compare`.
  4. Stat "kuota" (label, angka, sub) — `/hr/leaves` (4 kartu cuti).
  5. `KpiSnapshotStrip` chip mungil — `/owner/ai-assistant`, `/executive/analytics`.
- **Dampak:** Metrik Cash/Rev MTD/AP tampil raksasa di Owner Home tetapi mungil di AI Q&A → terasa "acak".
- **Rekomendasi:** Standardisasi **satu** komponen `StatCard` dengan prop `size="sm|md"` & `density`. Migrasikan semua varian ke komponen ini. `KpiSnapshotStrip` dipertahankan sebagai mode "strip ringkas".

### F4 — Redundansi IA: item sidebar = tab dalam-halaman · **P0**
- **Bukti #1 (Finance Reports):** `/finance/reports` punya **tab dalam-halaman** (Trial Balance, P&L, Balance Sheet, Cashflow, Period Compare, Custom Reports, Pivot, Procurement Reports) **DAN** sidebar "Reports" mengulang 8 item yang sama (deep-link `?tab=`). Lihat `navigationSchema/finance.js` L97–110.
- **Bukti #2 (Procurement Vendors):** `/procurement/vendors` menampilkan pill in-page: *Vendor Comparison · Vendor Scorecard · AI Vendor Recommend · Vendor Item Catalog*, sementara sidebar punya item terpisah `Vendor Scorecard` & `Vendor Comparison` (`procurement.js` L98–106) **dan** `Vendor Item Catalog` + `AI Vendor Recommend` lagi di section "Smart Procurement" (L116–125). → duplikasi bahkan triplikasi.
- **Rekomendasi:** Pilihan **(a)** yang sudah Anda setujui — pindahkan ke tab dalam halaman, sidebar simpan **1 link induk**. Detail di **§5 Peta Konsolidasi IA**.

### F5 — "Single-item section" (parent + 1 anak) · **P1**
- **Bukti:** Section yang hanya berisi 1 item, jadi parent collapsible mubazir + memicu double-active:
  - Outlet: `CRM & Reservasi` (→ CRM & Reservasi Hub), `Daily Orders` (→ Kitchen/Bar/Floor), `End of Day` (→ Tutup Hari Workflow).
  - Owner: `Financial Health` (→ Cash Position), `AI Insights` (→ Business Q&A).
  - Executive: `Analytics` (→ Period Compare), `Reservasi` (→ Ringkasan Reservasi).
- **Rekomendasi:** Di `Sidebar.jsx`, jika `section.items.length === 1`, render header section **sebagai Link langsung** (bukan toggle collapsible). Hilangkan baris anak & double-active sekaligus → sidebar lebih pendek.

### F6 — Sidebar terlalu panjang (overflow) · **P1**
- **Bukti:** **Finance** sidebar paling panjang (Overview + Transactions 3 + Payments 8 + Reports 8 + Tax 3 + Assets/Budget + Period + Config) → melebihi tinggi viewport. **Admin** juga panjang (Operations & Monitoring 8 item, Loyalty 5 item, Configuration 6 item).
- **Dampak:** User "terpaksa" collapse — bertentangan dengan target Anda (sidebar ramping tanpa perlu collapse).
- **Rekomendasi:** Konsolidasi via hub+tabs (§5). Target Finance & Admin ≤ ~12 item.

### F7 — Cross-navigation tak terduga ("klik malah pindah menu") · **P1**
- **Bukti:** `/executive` (Owner Home) punya blok **"Akses Cepat"** berisi ~16 tile besar (Analytics, Anomali, Approvals, **Finance**, AP Invoice, AR Invoice, **Procurement**, **Inventory**, **HR**, **Outlet**, **Admin**, dll). Klik tile seperti *Finance/Admin/HR* **melompat ke portal lain** tanpa konteks jelas → persis keluhan "navigasi nyasar". Pola serupa: "Quick Actions" tile di Outlet/Inventory/Procurement/Finance/HR.
- **Rekomendasi:** (1) Beri penanda visual jelas bahwa tile = pindah portal (mis. ikon panah keluar + label portal). (2) Kurangi jumlah tile ke yang benar-benar sering dipakai. (3) Pastikan tidak ada elemen non-navigasi (mis. KpiCard `onClick`) yang diam-diam pindah halaman tanpa afirmasi.

### F8 — Header halaman tidak konsisten + hero berulang · **P2**
- **Bukti:** Sebagian halaman pakai `PageHeader` (ikon + judul + subtitle), sebagian pakai **hero gradient besar** custom (mis. `/owner`, `/outlet`, `/executive`), sebagian langsung kartu tanpa header (`/owner/cash`). Di **Admin**, hero "Admin Platform / Master data, users..." **berulang di tiap sub-halaman** (master-data, configuration, loyalty) → ±80px ruang terbuang tiap halaman.
- **Akar penyebab:** `PageHeader.jsx` h1 `text-3xl`, ikon `h-11`, `mb-6` — relatif besar; dan portal-portal tidak seragam memakainya.
- **Rekomendasi:** Satu pola header: `PageHeader` dengan h1 `text-2xl`, ikon `h-9`, `mb-4`. Hilangkan hero "Admin Platform" pada sub-halaman (tampilkan hanya di `/admin`). Hero gradient hanya untuk landing dashboard utama, bukan semua halaman.

### F9 — Elemen oversized: search bar, vendor cards, action tiles · **P1**
- **Bukti:** Search bar konten tinggi (mis. `/procurement/vendors`, `/finance/reports`); **vendor cards** dengan avatar lingkaran besar + banyak whitespace (6 kartu makan 2 baris untuk info 3 baris); "Quick Actions"/"Akses Cepat" tile blok tinggi.
- **Rekomendasi:** Search bar `h-11/h-12 → h-9`. Vendor card → list/row padat atau kartu lebih kecil (avatar `h-10`), tampilkan lebih banyak per baris. Action tiles → ikon+label lebih ringkas, tinggi turun ~30%.

### F10 — Gaya tab dalam-halaman beragam (≥4) · **P2**
- **Bukti:** Pill terisi (Outlet `Daily Sales`: Semua/Draft/…), underline teks (Finance `Reports`, Admin `Master Data`, HR `Compensation`), pill outline (Procurement `Vendors`), chip toggle (Executive `Period Compare`). Komponen `PortalSubNav.jsx` ada (pill `grad-aurora-soft`) tapi tidak dipakai konsisten.
- **Rekomendasi:** Standardisasi ke **satu** komponen tab (disarankan `PortalSubNav` atau Shadcn `Tabs`) untuk semua hub.

### F11 — Bug tampilan data: UUID, bukan nama · **P1**
- **Bukti:** `/inventory` → panel "Valuation per Outlet" menampilkan **UUID mentah** (`ff533af3-3b58-…`) alih-alih nama outlet.
- **Rekomendasi:** Map `outlet_id → outlet_name` sebelum render. (Polish data-display; bukan tema.)

### F12 — Sidebar: font & padding terlalu besar · **P1**
- **Akar penyebab:** `Sidebar.jsx` lebar `w-[280px]`; section `px-3 py-2 text-sm`; item `px-3 py-1.5 text-sm`.
- **Rekomendasi:** Lebar `w-[280px] → w-[240px]`; section `py-2 → py-1.5`, `text-sm → text-[13px]`; item `py-1.5 → py-1`, `text-sm → text-[13px]`; rapatkan `space-y-1 → space-y-0.5`. Header section uppercase tracking kecil untuk hierarki.

### F13 — AI Assistant card menciptakan void besar · **P1**
- **Bukti:** `/executive/analytics` — kartu "Asisten AI Eksekutif" memakan ~½ viewport dengan area kosong besar di tengah (sebelum KPI muncul di bawah fold). `/owner/ai-assistant` juga void besar.
- **Rekomendasi:** Untuk halaman dashboard, jadikan AI assistant **collapsible / lebih ringkas** (atau pindah ke drawer) sehingga KPI tampil di atas fold. Halaman khusus Q&A boleh tetap, tapi tinggikan density konten di sekitarnya.

### F14 — Status badge tidak konsisten (solid vs tinted) · **P2**
- **Bukti:** `StatusPill.jsx` + `index.css` (L294–305) sudah benar memakai warna **tinted** (`bg-emerald-500/15`, dll). Tapi `/hr/leaves` memakai badge **solid hijau/merah** custom (Disetujui/Ditolak) → menyimpang dari sistem & dari guideline (hindari hijau/merah pekat).
- **Rekomendasi:** Pakai `StatusPill` di mana-mana; ganti badge solid custom HR Leaves.

---

## 4. Temuan Per-Halaman (ringkas)

| Portal | Halaman | Temuan utama | Severity |
|---|---|---|---|
| Owner | `/owner` | Hero gradient + Layout switcher; 4 `KpiCard` besar; double-active | P0/P1 |
| Owner | `/owner/cash` | 4 `KpiCard` besar, tanpa `PageHeader`; double-active | P1 |
| Owner | `/owner/ai-assistant` | `KpiSnapshotStrip` (padat, BAGUS) tapi void chat besar | P1 |
| Exec | `/executive/analytics` | AI card raksasa (½ layar) + `KpiCard` besar + Layout switcher | P0/P1 |
| Exec | `/executive` | 6 stat "centered" (gaya beda) + "Akses Cepat" 16 tile cross-portal | P1 |
| Exec | `/executive/outlet-budgets` | Matrix budget PADAT (BAGUS); 5 summary card besar | P2 |
| Exec | `/executive/brand` | 3 stat inline (gaya beda) + void besar (empty data) | P1/P2 |
| Exec | `/executive/period-compare` | Chips + bar chart + tabel komparasi (PADAT, BAGUS) | P2 |
| Outlet | `/outlet/crm` | Single-item section; scope bar; 6 `KpiCard` + 6 action card | P0/P1 |
| Outlet | `/outlet` | Scope bar + hero + 4 `KpiCard` + quick-actions grid | P1 |
| Outlet | `/outlet/daily-sales` | Pill tabs + tabel PADAT (BAGUS) | P2 |
| Outlet | `/outlet/daily-orders` | Single-item section; tabs Kitchen/Bar/Floor; empty state | P1 |
| Outlet | `/outlet/end-of-day` | Single-item section; workflow accordion | P1 |
| Proc | `/procurement` | 3 `KpiCard` besar + quick-action card | P1 |
| Proc | `/procurement/po` | Filters + pill tabs + tabel PADAT (BAGUS) | P2 |
| Proc | `/procurement/vendors` | **Redundansi tab vs sidebar**; search tinggi; vendor card besar | P0/P1 |
| Proc | `/procurement/kanban` | Kanban PADAT (BAGUS) | P2 |
| Inv | `/inventory` | 4 `KpiCard` + 5 action tile + **UUID bug** (Valuation) | P0/P1 |
| Inv | `/inventory/balance` | List/Matrix + tabel PADAT (BAGUS) | P2 |
| Fin | `/finance` | 4 `KpiCard`; **sidebar terpanjang** | P1 |
| Fin | `/finance/reports` | **Redundansi terparah**: 8 tab = 8 item sidebar | P0 |
| Fin | `/finance/journals` | Tabel PADAT (BAGUS) | P2 |
| Fin | `/finance/coa` | Tabel PADAT (BAGUS) | P2 |
| HR | `/hr` | 4 `KpiCard` + quick actions | P1 |
| HR | `/hr/compensation` | **Hub+tabs GOLD STANDARD** (7 tab) + tabel padat | ✅ acuan |
| HR | `/hr/leaves` | 4 stat "kuota" (gaya beda) + **badge solid** custom | P2 |
| Admin | `/admin` | Hero + 4 stat + master tiles + system ops | P1/P2 |
| Admin | `/admin/master-data` | **Hub+tabs BAGUS** (10 tab); hero "Admin Platform" berulang | P2 |
| Admin | `/admin/loyalty` | 4 `KpiCard` + tier dist (BAGUS) | P2 |
| Admin | `/admin/configuration` | **Hub+tabs BAGUS** (6 tab); hero berulang | P2 |

**Pola positif yang sudah ada (jadikan acuan):** `/hr/compensation`, `/admin/master-data`, `/admin/configuration` (hub+tabs), tabel `DataTable` di Journals/COA/PO/Stock Balance (padat), `KpiSnapshotStrip` (chip ringkas).

---

## 5. Peta Konsolidasi IA (Menu → Tab)

Prinsip: sidebar hanya berisi **destinasi tingkat-atas**; varian/laporan/turunan jadi **tab dalam halaman**. Target tiap portal ≤ ~12 item & tanpa perlu collapse.

### Finance (≈30 → ≈12)
- **Reports** 8 item → **1** (`Reports` → `/finance/reports`, tab sudah ada). Hapus: Trial Balance, P&L, Balance Sheet, Cashflow, Period Compare, Custom Reports, Pivot dari sidebar.
- **Payments** 8 item → jadikan **"Payments Hub"** dengan tabs (Payment Requests · AP Aging · Payments · Payment Runs · Run Templates · Bank Recon · AR Invoices · Deposit Reservasi). Sidebar: 1–2 item.
- **Tax & Compliance** 3 item → tab dalam "Tax Center" (Tax · e-Faktur · e-Bupot). Sidebar: 1 item.
- Pertahankan: Overview, Approval Center, Sales Validation, Journals, Manual JE, Assets, Budget, Period Closing, CoA.

### Procurement
- **Vendors**: simpan `All Vendors` saja; jadikan Scorecard/Comparison/AI Recommend/Item Catalog **tab** (sudah ada in-page). Hapus `Vendor Scorecard` & `Vendor Comparison` dari sidebar.
- **Smart Procurement**: `Vendor Item Catalog` & `AI Vendor Recommend` sudah jadi tab di Vendors → hapus dari sidebar; sisakan `Price Intelligence`.

### Outlet
- Flatten single-item sections: `CRM & Reservasi`, `Daily Orders`, `End of Day` → link langsung (tanpa parent collapsible).

### Owner
- Flatten: `Financial Health`→Cash Position, `AI Insights`→Business Q&A (link langsung).

### Executive
- Flatten/merge: `Analytics`(Period Compare) & `Reservasi` → masuk ke section terdekat atau link langsung.
- Pertimbangkan rename untuk hilangkan tabrakan "Owner Home" (di Executive) vs "Executive Summary" (di Owner).

### Admin (≈24 → ≈14)
- **Operations & Monitoring** 8 item → "Operations Hub" dengan tabs.
- **Loyalty Program** 5 item → hub dengan tabs (Overview sudah punya "Navigasi Cepat").
- Hilangkan hero "Admin Platform" berulang di sub-halaman.

### HR
- Sudah ramping & benar (acuan). Tidak perlu konsolidasi.

---

## 6. Rekomendasi Design Token "Compact Density" (tanpa ubah tema)

| Area | Sekarang | Usulan | File |
|---|---|---|---|
| Container main | `lg:py-8` | `lg:py-6` | `AppShell.jsx` |
| PageHeader h1 | `text-3xl`, ikon `h-11`, `mb-6` | `text-2xl`, ikon `h-9`, `mb-4` | `PageHeader.jsx` |
| KpiCard padding | `p-5` | `p-4` | `KpiCard.jsx` |
| KpiCard value | `text-[28px]` | `text-[22px]` | `KpiCard.jsx` |
| KpiCard ikon | `h-9 w-9` | `h-8 w-8` | `KpiCard.jsx` |
| KpiCard margin | `mb-3 / mt-3` | `mb-2 / mt-2` | `KpiCard.jsx` |
| Sidebar width | `w-[280px]` | `w-[240px]` | `Sidebar.jsx` |
| Sidebar section | `py-2 text-sm` | `py-1.5 text-[13px]` | `Sidebar.jsx` |
| Sidebar item | `py-1.5 text-sm` | `py-1 text-[13px]` | `Sidebar.jsx` |
| Sidebar spacing | `space-y-1` | `space-y-0.5` | `Sidebar.jsx` |
| Search bar height | `h-11/h-12` | `h-9` | per-halaman |
| Grid gap kartu | `gap-4/gap-6` | `gap-3` | per-halaman |

**Komponen yang distandarisasi:**
- `StatCard` tunggal (gantikan 5 varian) — prop `size`, `density`, layout label+ikon sebaris.
- Tab tunggal (`PortalSubNav`/Shadcn `Tabs`) — gantikan 4 gaya tab.
- `StatusPill` dipakai universal (gantikan badge solid HR Leaves).

---

## 7. Prioritas & Rencana Eksekusi Bertahap (USULAN — belum dijalankan)

**Fase 1 (P0 — dampak terbesar, risiko rendah):**
1. Fix double-active sidebar + flatten single-item sections (`Sidebar.jsx`).
2. Padatkan `KpiCard` (token compact).
3. Dedupe IA: Finance Reports (8→1) & Procurement Vendors (hapus item duplikat).

**Fase 2 (P1):**
4. Padatkan sidebar (width/font/padding) + PageHeader + container.
5. Standardisasi `StatCard` tunggal; migrasi dashboard utama.
6. Konsolidasi Payments/Tax/Operations/Loyalty jadi hub+tabs.
7. Perjelas/rapikan "Akses Cepat" cross-portal; fix UUID Inventory.

**Fase 3 (P2 — polish):**
8. Standardisasi komponen tab; AI card collapsible; StatusPill universal; hero Admin tidak berulang.

Setiap fase diverifikasi via screenshot tool (density & active-state) + (untuk perubahan struktur navigasi) testing agent frontend. **Tidak ada fungsionalitas yang diubah — murni presentasi/IA.**

---

## 8. Pertanyaan Terbuka untuk User (sebelum eksekusi)
1. Konsolidasi Payments (Finance) & Operations (Admin) jadi hub+tabs — setuju, atau pertahankan sebagai item terpisah?
2. "Akses Cepat" cross-portal — diperjelas (panah keluar + label) atau dikurangi drastis?
3. Lebar sidebar target `240px` — ok, atau lebih sempit lagi (`224px`)?
4. Urutan eksekusi — ikuti Fase 1→3 di atas?


---

# ADDENDUM (revisi 2) — kalibrasi layar 15" + analisis yang sebelumnya kurang

> Ditambahkan setelah feedback user: audit putaran-1 memakai viewport 1920×800 sehingga **understate** parahnya bloat. Bagian ini mengoreksi & melengkapi: **type scale (font), layout blueprint, wireframe paths, discoverability, IA ordering best-practice, dan user flow.** Spesifikasi implementasi token-level lengkap ada di **`/app/design_guidelines.md`**.

## A9 — Realita Layar 15" (PENTING)
- Bukti re-capture: pada **1280×800** (meniru 15" + display scaling, cocok dengan screenshot user di `/executive/profit-walk`), 4 KPI card memenuhi seluruh lebar dengan font sangat besar; pada **1366×768** sidebar Finance **tidak muat** (section Reports terpotong di bawah fold).
- **Konsekuensi:** semua rekomendasi density dikalibrasi ke **viewport acuan ~1280×800**, bukan 1920. Target: PageHeader + filter + KPI strip / tabel utama **terlihat tanpa scroll** di 1280×800.

## A10 — Audit Type Scale (font) — sebelumnya belum sistematis
Skala tipografi baru (Inter, tema tetap) — detail di `design_guidelines.md > typography_scale`:

| Token | Pakai | Sekarang | Usulan |
|---|---|---|---|
| h1 (judul halaman) | PageHeader | `text-3xl` (~30px) | `text-xl md:text-2xl` (20–24px) |
| h2 (judul panel) | section/panel | beragam | `text-base md:text-lg` |
| h3 (judul kartu) | card | beragam | `text-sm md:text-base` |
| body | teks default | `text-sm` | `text-sm/[0.9375rem]` |
| label / table header | label, th | beragam | `text-xs md:text-sm font-medium muted` |
| data-number (KPI) | nilai KPI | `text-[28px]` | `text-lg md:text-xl tabular-nums` |
| table-cell | sel tabel | beragam | `text-xs md:text-sm` |

## A11 — Layout Blueprint & Wireframe Paths (8 arketipe)
Wireframe per-arketipe untuk 1280×800 di `design_guidelines.md > archetype_wireframes_1280`:
1. KPI Dashboard (header + KPI strip + quick-actions + grid 8/4).
2. Data-table list (header + toolbar[search|status tabs|filter|density] + tabel sticky).
3. **Hub-with-tabs** (target konsolidasi — acuan: HR Compensation).
4. Kanban workboard.
5. Multi-step workflow (Outlet End-of-Day) — step rail + sticky footer.
6. Master-data CRUD/config — split list|detail.
7. AI assistant page — two-pane + sticky prompt.
8. Detail/record page — breadcrumb + header + summary strip + tabs.

## A12 — IA Ordering (best practice) — sebelumnya belum dinilai
Prinsip (`design_guidelines.md > navigation_and_ia.ordering_principle`):
1. Urut berdasarkan **frekuensi-pakai × kritikalitas × urutan workflow** (bukan struktur org).
2. Operasional harian di atas; analitik dipisah; **konfigurasi/admin paling bawah**.
3. Maks **≤10–12 item top-level/portal**; **flatten** section anak-tunggal; **konsolidasi** item yang sebenarnya tab.
- Contoh perlu dibenahi: di Outlet, "CRM & Reservasi" ada **paling atas** padahal "Today's Summary" lebih sering jadi entry → dashboard sebaiknya di atas.

## A13 — Discoverability — sebelumnya belum dinilai
(`design_guidelines.md > discoverability`)
- **Global search** (Ctrl/⌘K) sudah ada tapi kurang menonjol → trigger kecil di header + hasil per-portal + sinyal "pindah portal" (`ArrowUpRight`).
- **Breadcrumbs** belum ada di halaman dalam/detail → tambahkan.
- **Quick Actions** → tombol eksplisit (bukan seluruh kartu klik) → cegah F7 (nav nyasar).
- **Empty state** → tampilkan filter aktif + "Clear filters"/"Create".

## A14 — User Flow & Above-the-Fold (1280×800)
(`design_guidelines.md > user_flow_guidance`)
- Wajib tampil tanpa scroll: PageHeader compact + filter/tanggal + KPI strip / tabel utama.
- **AI assistant** maks **25–30% tinggi viewport** di dashboard; default **collapsed (≈44px)**, expand maks `320px` → menyelesaikan F13.

## A15 — Pemetaan pertanyaan user → jawaban
| Pertanyaan user | Dijawab di |
|---|---|
| Sudah nilai ukuran font? | A10 + `typography_scale` |
| Plan & analisis layout terbaik? | A11 + `archetype_wireframes_1280` |
| Cek semua jalur wireframing? | A11 (8 arketipe) |
| Analisis discovery? | A13 + `discoverability` |
| Urutan menu/submenu best practice? | A12 + `navigation_and_ia` |
| Analisis user flow? | A14 + `user_flow_guidance` |
| Beda ukuran (layar 15")? | A9 (re-kalibrasi 1280×800) |
