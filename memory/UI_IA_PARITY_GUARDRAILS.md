# 🛡️ UI/UX · IA · PARITY GUARDRAILS — Torado Group ERP
**Versi:** 1.0 · **Tanggal:** 2026-06-17 · **Pemilik:** Tim Frontend/Platform
**Status:** WAJIB dipatuhi. Pelengkap dari `ENGINEERING_GUARDRAILS.md` (yang fokus backend/data).
**Sumber pembelajaran:** `UI_UX_AUDIT_2026-06-17.md`, `design_guidelines.md`, `PARITY_AUDIT_2026-06-17.md`.

---

## 0. Inti masalah (1 kalimat)
UI Torado sempat **bloated, tidak konsisten, dan IA-nya redundan** karena tidak ada **token desain kanonik**, audit dilakukan di **viewport yang salah (1920)**, dan tidak ada **gate parity backend↔frontend** — sehingga keputusan ukuran/penempatan/menu dibuat ad-hoc per halaman.

> Aturan emas: **Tema TIDAK boleh diubah** (aurora/glassmorphism + Inter). Semua perbaikan hanya menyangkut **ukuran, spacing, density, konsistensi komponen, IA, discoverability, dan flow**.

---

## 1. Root Causes baru (UI-RC & PAR-RC) — WAJIB dikenali

### 🔴 UI-RC-1 — Komponen tidak ter-tokenisasi → bloat & inkonsistensi
- Gejala: ≥5 varian kartu KPI/stat & ≥4 gaya tab; metrik sama tampil beda ukuran antar-halaman.
- Mitigasi: **satu** komponen kanonik (`CompactStatCard`, satu `Tabs` pill) + **token tipografi/spacing** dari `design_guidelines.md`. Dilarang membuat varian kartu/tab baru tanpa alasan terdokumentasi.

### 🔴 UI-RC-2 — Audit/desain di viewport salah → understate di layar 15"
- Gejala: terlihat "muat" di 1920, padahal raksasa di layar 15".
- Mitigasi: **viewport acuan = 1280×800** (sanity 1366×768). Setiap screenshot QA UI WAJIB di 1280×800 light **dan** dark.

### 🔴 UI-RC-3 — Sidebar "double-active" (parent + child sama-sama menyala)
- Akar: parent section diberi background aktif saat child aktif.
- Mitigasi: **leaf-only active model** — hanya route terdalam yang dapat background; parent maksimal indikator subtle (warna teks), tanpa background.

### 🔴 UI-RC-4 — IA redundan & gemuk
- Gejala: item sidebar yang sebenarnya tab in-page (Finance Reports 8, Procurement Vendors 4); "single-item section" (parent + 1 anak); sidebar overflow → terpaksa collapse.
- Mitigasi (aturan keras):
  - **Consolidation rule:** jika destinasi = sub-view dari entity/hub yang sama → jadikan **tab**, hapus dari sidebar.
  - **Flatten rule:** section dengan **1 item** → render item langsung (tanpa parent collapsible).
  - **Limit:** **≤12 leaf item per portal**; sidebar harus *usable tanpa collapse* di 1280×800.
  - **Ordering:** urut by *frekuensi-pakai × kritikalitas × urutan workflow*; operasional di atas, konfigurasi/admin di bawah.

### 🟠 UI-RC-5 — Whole-card clickable → navigasi "nyasar"
- Mitigasi: kartu interaktif punya **satu** target klik utama; aksi sekunder = tombol/link eksplisit. Dilarang membungkus seluruh container dengan navigasi bila ada kontrol lain di dalamnya.

### 🟠 UI-RC-6 — Shortcut cross-portal tanpa afford
- Mitigasi: tile/aksi yang **pindah portal** wajib pakai ikon `ArrowUpRight` + **label portal** (mis. "Finance"); konfirmasi via toast setelah pindah.

### 🟠 UI-RC-7 — Header/hero berlebihan & berulang
- Gejala: hero gradient besar di tiap halaman; "Admin Platform" hero berulang di sub-halaman.
- Mitigasi: `PageHeader` compact (h1 `text-xl/2xl`, icon `h-6/7`, `mb-3/4`); hero besar hanya untuk landing dashboard utama, tidak di sub-halaman.

### 🔴 PAR-RC-1 — Drift parity backend↔frontend (fitur backend tanpa UI)
- Mitigasi: setiap endpoint backend baru WAJIB salah satu: (a) punya pemicu UI, (b) ditandai eksplisit `internal`/`webhook`/`export-only` di docstring router. Jalankan `audit_parity.py` sebelum klaim selesai. **ORPHAN MODULE = blocker.**

### 🟠 PAR-RC-2 — Endpoint duplikat/usang
- Gejala: `/ai/extract-receipt` vs `/ai/ocr/receipt`; `/master/coa` vs `/master/chart-of-accounts`; `/budget/import-csv` vs `import-excel`.
- Mitigasi: **satu endpoint kanonik** per fungsi; yang lama tandai `# DEPRECATED -> <kanonik>` dan masuk registry deprecate.

### 🟠 PAR-RC-3 — Halaman ada tapi tak discoverable
- Mitigasi: jalankan bagian "discoverability" di `audit_ui_ia.py`. Fitur berat (mis. JobApplications, CRMAnalytics) WAJIB punya entry-point di nav/hub, bukan hanya deep-link.

---

## 2. Prinsip inti (non-negotiable)
1. **Theme-lock:** dilarang ubah palette/gradient/font. (Lihat `design_guidelines.md > non_negotiables`.)
2. **Token-first:** ukuran/spacing/tipografi konsumsi token, bukan angka ajaib per halaman.
3. **One canonical component:** satu `CompactStatCard`, satu `Tabs`, satu `StatusPill`, satu `PageHeader`.
4. **15-inch first:** semua keputusan density divalidasi di 1280×800.
5. **IA disiplin:** ≤12 item/portal, flatten single-item, konsolidasi tab, ordering best-practice.
6. **Flow aman:** tidak ada navigasi tanpa afford; shortcut cross-portal diberi tanda.
7. **Parity wajib:** tidak ada fitur backend "menggantung" tanpa UI atau tanda internal.

---

## 3. ✅ Checklist WAJIB (pre-merge untuk perubahan UI/IA)
- [ ] Tidak menambah varian kartu/tab baru (pakai `CompactStatCard` & `Tabs` kanonik).
- [ ] Tidak ada kelas oversized baru di halaman (`p-5/p-6`, `text-3xl/4xl`, `py-8`, `gap-6/8`, `w-[280px]`) kecuali pada landing/detail yang disepakati.
- [ ] Sidebar: tidak ada double-active; tidak ada single-item section; ≤12 item/portal.
- [ ] Tidak ada whole-card navigation yang ambigu; shortcut cross-portal diberi ikon+label.
- [ ] Screenshot QA di **1280×800 light + dark** dilampirkan.
- [ ] `audit_parity.py` → **0 ORPHAN MODULE**; endpoint baru punya UI atau ditandai internal.
- [ ] `audit_ui_ia.py` → portal tidak melebihi limit (atau alasan didokumentasikan).
- [ ] FE compile bersih: `esbuild src/ --loader:.js=jsx --bundle --outfile=/dev/null`.

---

## 4. Definition of Done (UI/IA/Parity)
Boleh klaim "selesai" bila SEMUA terbukti:
1. `bash /app/scripts/audit_all.sh` hijau (FE compile OK, 0 orphan module, IA dalam batas).
2. Screenshot 1280×800 (light+dark) untuk halaman yang diubah, sesuai arketipe `design_guidelines.md`.
3. Frontend testing agent PASS untuk perubahan struktur navigasi/IA.
4. Bila menyentuh data/aggregasi: `intent_audit_5portals.py` + `intent_audit_remaining.py` tetap PASS.
5. Tidak ada regresi tema (warna/gradient/font tidak berubah).

---

## 5. 🤖 Gate Eksekutabel (mitigasi otomatis)
Skrip read-only, taruh sebagai kebiasaan/CI:

| Skrip | Fungsi | Hard-gate |
|---|---|---|
| `python3 /app/scripts/audit_parity.py [--strict]` | Diff endpoint backend vs literal frontend; deteksi ORPHAN MODULE & low-coverage | ORPHAN MODULE = FAIL (`--strict`) |
| `python3 /app/scripts/audit_ui_ia.py [--strict]` | Hitung item sidebar/portal, single-item section, kelas oversized, route-vs-nav | portal > 12 item = FAIL (`--strict`) |
| `bash /app/scripts/audit_all.sh [--strict]` | FE compile + 2 audit di atas | gabungan |

**Baseline saat guardrail dibuat (2026-06-17)** — target turun seiring eksekusi plan:
- Parity: ORPHAN MODULE = **0** (OK). Low-coverage modules: efaktur, payment-run-templates, loyalty/rewards, daily-close, public/menu, seo, uploads, vendor-items.
- IA leaf items/portal: finance=**32**, admin=**27**, procurement=**15**, executive=**13**, outlet=**12**, inventory=8, owner=6, hr=6. (Target semua ≤12.)
- Density (di `src/portals`): `p-5`=228, `p-6`=78, `py-8`=25, `text-3xl`=16, `w-[280px]`=5. (Target turun signifikan.)

---

## 6. Cara pakai
1. Sebelum mulai kerja UI: baca `design_guidelines.md` (token & arketipe) + dokumen ini.
2. Selama kerja: pakai komponen kanonik; jangan bikin varian.
3. Sebelum klaim selesai: `bash /app/scripts/audit_all.sh` + screenshot 1280×800 (light+dark).
4. Saat menambah endpoint backend: pastikan ada UI atau tandai internal; jalankan `audit_parity.py`.
5. Update baseline angka di §5 bila sudah membaik (jadi tren, bukan sekali jalan).
