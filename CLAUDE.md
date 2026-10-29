# FnB Group ERP — instruksi untuk agen AI

Stack: React 19 (CRA + craco) + Tailwind + shadcn/Radix di `frontend/`; FastAPI + MongoDB (motor) di `backend/`.
Jalankan lokal: `docs/LOCAL_SETUP.md`. Bahasa UI campur: istilah teknis EN, aksi/kalimat/status persetujuan ID (`DESIGN_SYSTEM.md` §10.5).

## UI — wajib (detail: `docs/DESIGN_SYSTEM.md`, acuan tunggal)

- Pakai primitive yang ada: `components/ui/*` (Button, Input, Select, Tabs, Card, Dialog) dan
  `components/shared/*` (PageHeader, DataTable, StatusPill, CompactStatCard, EmptyState, SegmentedFilter,
  SimpleSelect, InlineHelp, ConfirmDialog). Jangan membuat ulang tombol/pill/kartu/tabel sendiri.
- `Button`: pilih `size` (`default` 36px, `sm` 32px, `icon`, `icon-sm`) dan `variant`
  (`default`/`outline`/`ghost`/`secondary`/`destructive`/`success`/`link`). **Jangan** override `h-*`,
  `rounded-full`, atau `pill-active` lewat `className`. Chip = `<Button size="sm" variant="outline" aria-pressed>`.
- Teks minimal 12px (`text-xs`). `text-[11px]` hanya untuk label **uppercase** & badge angka.
- Warna netral hanya token (`text-muted-foreground`, `bg-muted`, `border-border`, `bg-background`);
  warna status `-700` (amber/orange `-800`) + `dark:text-*-400`. Jangan `text-gray-*`, `bg-white`, `opacity-*` pada teks.
- Satu `<h1>` per halaman lewat `PageHeader`; judul kartu `CardTitle`/h3 16px.
- Kartu: `.glass-card` / `Card`, padding `p-3` atau `p-4`. Tidak ada kartu di dalam kartu
  (bungkus konten embedded dengan `.nested-cards`). Status → `StatusPill`. KPI → `CompactStatCard`. Daftar data → `DataTable`.
- **Anatomi halaman** (`DESIGN_SYSTEM.md` §10):
  - Posisi tombol = cakupan aksi. Aksi layar di kanan judul (`PageHeader`); aksi kartu di kanan atas kartu;
    aksi baris di kolom terakhir (maks. 1 + "⋯").
  - Halaman di dalam hub tetap memakai `PageHeader` biasa — otomatis mengisi subtitle & aksi header hub.
  - Judul blok di dalam kartu (`CardTitle`); judul di luar kartu hanya untuk grup ≥ 2 kartu di dashboard; tanpa judul ganda.
  - Filter tabel di dalam kartu tabel (`ListToolbar`); filter halaman tanpa kartu; daftar sejenis = baris dalam
    1 kartu, bukan kartu per item; maks. 2 lapis bingkai; grid tanpa item yatim.
  - Form yang mengubah data: `FormActionBar` (sticky bawah) + `useUnsavedChanges(dirty)`.
  - Bahasa: istilah teknis EN (Payment, COA, Posted, Overdue, Partial); aksi, kalimat & status persetujuan ID
    (Simpan, Disetujui, Ditolak); label = kata umum ID + istilah EN ("Tanggal Invoice", "Nominal").
    Buat ‹dokumen› / Tambah ‹data›; uang = Nominal, hitungan = Jumlah.
- `data-testid` kebab-case untuk elemen interaktif; **jangan ganti testid yang dipakai tour**
  (`frontend/src/contexts/tour`).
- Pengecualian yang sah: tulis komentar `ds-ok: alasan` tepat sebelum elemen.

## Cek sebelum selesai

```bash
python3 scripts/ux_audit.py --strict   # usability + aturan design system (ds.*) — harus 0 ERROR
python3 scripts/audit_tours.py         # 0 missing target
python3 scripts/audit_ui_ia.py         # OK
```

Audit ukuran runtime (opsional, butuh app berjalan): `scripts/ui_metrics/README.md`.

## Backend

- Konfigurasi dari `backend/.env` (template lokal: `backend/env.local.example`). Jangan commit secret.
- Tes: `cd backend && python -m pytest -q tests/<file>`.
