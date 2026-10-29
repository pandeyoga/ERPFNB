# Design System — FnB Group ERP

**Status: acuan tunggal (berlaku sejak 29 Okt 2026).** Jika ada aturan lain yang bertentangan, termasuk
`design_guidelines.md` (blueprint densitas & IA), `design_guidelines.json`, atau lampiran generik di
dalamnya, **dokumen ini yang berlaku**. `docs/UX_USABILITY_STANDARD.md` tetap berlaku untuk baseline
usability (loading/empty state tabel, chart, double-submit).

Konteks: aplikasi ERP padat-data, viewport target **1280×800**, font **Inter** saja, tema aurora/kaca
light + dark. Semua angka di bawah adalah ukuran terhitung (computed) pada lebar ≥ 768px.

---

## 1. Aturan emas (manusia & AI)

1. **Pakai primitive, jangan membuat ulang.** `Button`, `Input`, `Select`/`SimpleSelect`, `Tabs`/`SegmentedFilter`,
   `Card`/`.glass-card`, `DataTable`, `StatusPill`, `CompactStatCard`, `PageHeader`, `EmptyState`,
   `InlineHelp`, `Dialog`, `ConfirmDialog`. Lokasi: `frontend/src/components/ui` dan `components/shared`.
2. **Jangan override ukuran/bentuk primitive lewat `className`** (`h-*`, `rounded-full`, `text-*`, `pill-active`
   pada `Button`). Pilih `size` / `variant` yang ada. Bila benar-benar perlu, tulis komentar `ds-ok: alasan`
   tepat sebelum elemen. Audit akan menerima pengecualian yang terdokumentasi.
3. **Hanya token warna** untuk netral (`text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`,
   `bg-background`). Warna status: **`-700`** (amber/yellow/orange **`-800`**) + `dark:text-*-400`.
4. **Satu `<h1>` per halaman** (lewat `PageHeader`). Judul kartu memakai `CardTitle`/`h3` 16px.
5. **Minimal 12px** untuk teks yang dibaca. 11px hanya untuk label uppercase & badge angka.
6. **Tidak ada kartu di dalam kartu.** Halaman yang di-embed di kartu lain dibungkus `.nested-cards`.
7. Jalankan `python3 scripts/ux_audit.py --strict` sebelum selesai; harus **0 ERROR**.

---

## 2. Tipografi

| Tier | Kelas | Ukuran | Pakai untuk |
|---|---|---|---|
| Page title (h1) | `text-xl md:text-2xl font-semibold leading-[1.2] tracking-[-0.015em]` | 24px | hanya `PageHeader` |
| Section title (h2) | `text-base md:text-lg font-semibold` | 18px | judul bagian di luar kartu |
| Card title (h2/h3) | `text-sm md:text-base font-semibold leading-[1.3]` | 16px | `CardTitle`, judul panel, `CollapsibleSection` |
| Body | `text-sm` | 14px | teks isi, sel tabel, input |
| Control | `text-[13px]` | 13px | tombol `sm`, tab, chip |
| Caption / meta | `text-xs text-muted-foreground` | 12px | helper, keterangan, waktu relatif, status pill |
| Micro label | `text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground` | 11px | label KPI, header tabel (`tracking-[0.06em] font-semibold`) |
| KPI value | `text-lg md:text-xl font-semibold tabular-nums tracking-[-0.02em]` | 20px | `CompactStatCard` |

- Angka: `tabular-nums`; kolom uang rata kanan. `font-mono` dipetakan ke Inter tabular (bukan font lain).
- Dilarang: `text-[10px]` atau lebih kecil; `text-[11px]` tanpa `uppercase`; emoji sebagai ikon.

## 3. Spasi & layout

| Token | Nilai |
|---|---|
| Grid dasar | 4px |
| Jarak antar-bagian | `space-y-3 lg:space-y-4` / `gap-3 lg:gap-4` |
| Padding kartu | `p-3` (compact, 12px) · `p-4` (default, 16px) · `0` + `overflow-hidden` untuk pembungkus tabel |
| Header kartu | `px-4 pt-4 pb-2` (`CardHeader`) |
| Lebar sidebar | 248px |

## 4. Radius & permukaan

| Elemen | Radius |
|---|---|
| Kartu `.glass-card` | `calc(var(--radius) + 4px)` = 18px |
| Kontrol (button, input, select, tile pilihan) | `rounded-md` = 12px |
| Tab trigger | `calc(var(--radius) - 4px)` = 10px |
| Status pill, badge angka | `rounded-full` |

Permukaan kartu hanya `.glass-card` (`Card` sudah memakainya). Jangan menambah `shadow-*`, `rounded-xl`,
atau `bg-white` pada kartu.

## 5. Komponen — ukuran baku

| Komponen | Spesifikasi | Catatan |
|---|---|---|
| Button `default` | h-9 (36px), px-3.5, 14px | aksi halaman/toolbar |
| Button `sm` | h-8 (32px), px-3, 13px | aksi di kartu/baris tabel, **chip** |
| Button `icon` / `icon-sm` | 36 / 32px persegi | ikon 16px (otomatis) |
| Button `lg` | h-10 (40px) | jarang; layar sistem saja |
| Varian | `default` `outline` `ghost` `secondary` `destructive` **`success`** (Setujui/Terima) `link` | jangan `bg-emerald-600 text-white` manual |
| Input / Select | h-9 (36px), 14px, rounded-md | `glass-input` untuk latar kaca |
| Tabs | trigger h-8 (32px), 13px, ikon 14px; list p-1 | satu gaya untuk tab halaman & filter (`SegmentedFilter`) |
| Chip (filter/saran/toggle) | `<Button size="sm" variant={on ? "default" : "outline"} aria-pressed>` | bukan `rounded-full` buatan sendiri |
| Status | `StatusPill` — h-5 (20px), 12px, rounded-full | label dari kamus status (Bahasa Indonesia) |
| KPI | `CompactStatCard` — sm 72px / md 88px | label micro + value KPI |
| Tabel | `DataTable` — header 11px uppercase semibold, sel 14px, baris ≥ 36px | `<th>` mentah otomatis bergaya sama |
| Bantuan | `InlineHelp` — ikon 14–16px, area klik 24px | |
| Ikon | 16px di tombol · 14px di tab/chip · 12px inline meta | lucide-react |

## 6. Kartu

- Struktur: judul (16px semibold) + aksi di kanan → isi → footer opsional (`border-t border-border/50`).
- **Tile pilihan** (opsi yang bisa diklik, berbentuk kartu kecil): `<button className="w-full text-left rounded-md border p-3">`.
- **Kartu klik penuh** hanya bila tidak berisi kontrol lain (pakai `glass-card-hover`).
- **Card-in-card dilarang.** Fase/step yang merender halaman lain: `<div className="nested-cards">…</div>`, sehingga
  kartu anak tampil datar (border tipis, tanpa blur/bayangan).
- KPI selalu `CompactStatCard`; strip ringkas: `KpiSnapshotStrip`.

## 7. Keterbacaan & aksesibilitas

- Kontras teks **≥ 4.5:1** (WCAG AA), ikon/border penting ≥ 3:1. Token `--muted-foreground` (light 40%) lolos AA
  juga di atas kartu kaca.
- Jangan meredupkan teks dengan `opacity-*` atau `text-*/60`; pakai `text-muted-foreground`.
- Teks di atas warna isi (avatar brand, tombol) harus dipilih berdasarkan luminans warna latar.
- Target klik ≥ 24px (WCAG 2.2). Kontrol standar sudah 32–36px.
- Fokus terlihat: `focus-visible:ring-2 ring-ring` (sudah ada di primitive).
- Bahasa: status, aksi, bantuan & pesan dalam Bahasa Indonesia; nama modul/halaman = istilah ERP.

## 8. Larangan → gantinya

| Jangan | Pakai |
|---|---|
| `text-[10px]`, `text-[11px]` untuk kalimat | `text-xs` |
| `text-gray-500`, `bg-white`, `border-gray-200` | `text-muted-foreground`, `bg-background`/`bg-muted`, `border-border` |
| `text-emerald-600`, `text-red-500`, `text-amber-600` | `text-emerald-700 dark:text-emerald-400`, `text-red-700 dark:text-red-400`, `text-amber-800 dark:text-amber-400` |
| `<Button className="h-7 rounded-full …">` | `<Button size="sm">` / `size="icon-sm"` |
| `bg-emerald-600 text-white` untuk Setujui | `<Button variant="success">` |
| chip `rounded-full px-3 py-1 text-xs` | `<Button size="sm" variant="outline" aria-pressed>` |
| `<span className="text-[11px] px-2 py-0.5 rounded-full …">` untuk status | `<StatusPill status="…" />` |
| `.glass-card` di dalam `.glass-card` | `.nested-cards` pada pembungkus, atau `border rounded-md p-3` |
| `glass-card p-5/p-6` | `p-4` (hero halaman sistem dikecualikan) |
| `<table>` mentah untuk daftar data | `DataTable` |
| `opacity-60` pada teks | `text-muted-foreground` |

## 9. Penjaga konsistensi (wajib dijalankan)

```bash
python3 scripts/ux_audit.py --strict      # usability + aturan design system (ds.*) — harus 0 ERROR
python3 scripts/audit_tours.py            # target tour (data-testid) tidak boleh hilang
python3 scripts/audit_ui_ia.py            # IA/route
```

Aturan `ds.*` di `ux_audit.py`: `ds.font-min`, `ds.font-11px`, `ds.contrast`, `ds.button-size` (ERROR),
`ds.token-color`, `ds.card-padding` (WARN). Pengecualian: komentar `ds-ok: alasan` tepat sebelum elemen.

Audit runtime (mengukur ukuran terhitung semua halaman, butuh aplikasi berjalan + Playwright) ada di
`scripts/ui_metrics/` — lihat README di folder tersebut. Hasil terakhir:
`docs/audit/UI_COMPONENT_METRICS_2026-10-29.md`.

### Checklist sebelum merge (UI)
- [ ] Hanya primitive + token; tidak ada override ukuran di `Button`.
- [ ] Teks ≥ 12px (11px hanya uppercase/badge); warna status -700/-800 + dark.
- [ ] Satu h1 (`PageHeader`); judul kartu 16px; tidak ada card-in-card.
- [ ] Status lewat `StatusPill`; KPI lewat `CompactStatCard`; tabel lewat `DataTable`.
- [ ] `data-testid` kebab-case pada elemen interaktif; testid tour tidak diganti.
- [ ] `ux_audit.py --strict` 0 ERROR; dicek di light **dan** dark.
