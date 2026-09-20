# Torado ERP — UX Usability Standard (Baku)

> **Status:** MANDATORY baseline for all frontend development.
> Complements `ENGINEERING_GUARDRAILS.md`. Last updated: 2026-06-14.
>
> Enforced by: `python3 scripts/ux_audit.py --strict` (run before every feature `finish`).

---

## 0. Why this exists (Case Study — Juni 2026)

A full-app audit (9 portal, 283 halaman) found that usability problems reported on a
single screen ("Detail per Stage" tidak bisa diklik) were in fact **systemic**, not isolated.
Evidence collected by scanning the codebase:

| Temuan | Bukti (hasil scan) | Dampak |
|---|---|---|
| Tabel tanpa **drill-down** | hanya **1 dari ~100** tabel (`APAging`) punya expand baris asli | user tak bisa lihat rincian; "expand" lain hanya `colSpan` baris kosong |
| Tabel tanpa **sort kolom** | hanya **4 dari ~100** tabel | mustahil mengurutkan data padat (TB, P&L, AP Aging, Stock) |
| **Sticky header** absen | ±8 dari ~100 tabel | header hilang saat scroll tabel panjang |
| **3 mesin tabel** berbeda | RAW `<table>` ~70%, shadcn ~20%, `DataList` ~10% | tampilan & perilaku tidak konsisten; RAW table tak responsif mobile |
| Chart tooltip **default Recharts** | **5 dari 10** chart | kotak putih polos tabrakan dgn tema glass |
| Chart tanpa **empty-state** | 4 dari 10 chart | render kosong/aneh saat tak ada data |
| Waterfall **palsu** | Profit Walk = BarChart dari 0 | salah secara finansial |
| `KpiCard` basic | 20 halaman, tanpa sparkline/delta chip | informasi tren tidak terbaca cepat |

**Akar masalah:** tidak ada standar usability minimum + tidak ada primitive bersama, sehingga
tiap halaman dibangun ulang ad-hoc. Standar di bawah + primitive bersama mencegah hal ini terulang.

---

## 1. The Usability Baseline (bare minimum)

Setiap layar baru / yang disentuh **WAJIB** memenuhi ini. Pelanggaran level **ERROR**
memblokir `finish`; level **WARN** adalah utang teknis yang harus dicatat.

### 1.1 Tabel data (ERROR-level)
1. **Loading state** — skeleton/`LoadingState`, bukan layar kosong.
2. **Empty state** — `EmptyState` dengan judul + deskripsi + (idealnya) CTA. Jangan tabel kosong tanpa pesan.
3. **Angka rata-kanan + `tabular-nums`** untuk semua kolom numerik/uang.
4. **Responsif** — di < `sm` harus tetap terbaca (kartu, bukan tabel meluap). `DataTable` sudah menangani ini.

### 1.2 Tabel data (SHOULD / WARN-level)
5. Gunakan **`DataTable`** (`components/shared/DataTable.jsx`) — jangan `<table>` mentah baru.
6. **Sortable** untuk kolom yang relevan pada halaman list/report.
7. **Sticky header** untuk tabel yang bisa > ~10 baris.
8. **Drill-down** (`renderExpanded`) bila baris punya rincian (akun, item, breakdown). Jangan paksa pindah halaman untuk info yang bisa di-inline.

### 1.3 Chart / visualisasi (ERROR-level)
1. **Tooltip wajib di-styling** — gunakan `GlassTooltip` dari `charts/chartKit`. **DILARANG** memakai `<Tooltip/>` default Recharts.
2. **Empty state** — `ChartEmpty` saat tak ada data.
3. **Warna semantik** — gunakan `SEMANTIC`/`CATEGORICAL` dari `chartKit` (positif=emerald, negatif=merah, dst). Jangan hardcode warna acak.
4. **Visualisasi jujur** — bentuk chart harus merepresentasikan data dengan benar (mis. waterfall = floating bars, bukan bar dari 0).

### 1.4 Chart (SHOULD / WARN-level)
5. **Value label** pada bar untuk dashboard eksekutif (jangan andalkan hover saja).
6. Axis pakai `axisProps`/`gridProps` dari `chartKit` agar konsisten.

### 1.5 KPI / Card
1. Gunakan **`KpiCard`** (`components/shared/KpiCard.jsx`) untuk metrik. Jangan bikin stat-card baru ad-hoc.
2. Sertakan **delta/tren** bila ada pembanding (`delta`, `deltaLabel`, `series` untuk sparkline).
3. Card yang bisa di-klik → `onClick` + hover affordance (sudah built-in).

### 1.6 Form
1. Gunakan **shadcn `Select`** (bukan `<select>` native) untuk dropdown.
2. Validasi inline + pesan error jelas; tombol submit disable saat invalid/loading.

### 1.7 State & A11y (berlaku semua)
- Setiap elemen interaktif & data penting punya **`data-testid`** (kebab-case, deskriptif).
- Loading, empty, **error** state harus eksplisit.
- Fokus keyboard terlihat; baris yang bisa diklik bisa di-`Enter`.

### 1.8 Angka & uang
- Format via `lib/format` (`fmtRp`, `fmtNumber`, `fmtPct`). Jangan format manual.
- `tabular-nums` di mana pun angka berjajar (tabel, KPI, chart label).

---

## 2. Shared primitives (pakai ini, jangan bikin ulang)

| Primitive | File | Untuk |
|---|---|---|
| `DataTable` | `components/shared/DataTable.jsx` | semua tabel: sort, sticky, expand, responsif, loading/empty |
| `KpiCard` | `components/shared/KpiCard.jsx` | kartu metrik (delta chip + sparkline) |
| `Sparkline` | `components/shared/Sparkline.jsx` | mini-tren inline |
| `WaterfallChart` | `components/shared/charts/WaterfallChart.jsx` | waterfall finansial sejati |
| `chartKit` | `components/shared/charts/chartKit.jsx` | `GlassTooltip`, `ChartEmpty`, `SEMANTIC`, `CATEGORICAL`, `axisProps`, `gridProps`, `fmtCompact` |

### Contoh — DataTable dengan drill-down
```jsx
<DataTable
  columns={[
    { key: "name", label: "Akun", primary: true },
    { key: "amount", label: "Jumlah", numeric: true, sortable: true,
      render: (r) => <span className="font-mono">{fmtRp(r.amount)}</span> },
  ]}
  rows={rows}
  keyField="id"
  rowTestIdPrefix="coa"
  renderExpanded={(r) => <AccountBreakdown row={r} />}   // klik baris → rincian
  loading={loading}
  empty={<EmptyState title="Belum ada data" description="…" />}
/>
```

### Contoh — chart dengan tooltip & empty standar
```jsx
import { GlassTooltip, ChartEmpty, SEMANTIC, axisProps, gridProps } from "@/components/shared/charts/chartKit";

if (!data.length) return <ChartEmpty message="Belum ada data periode ini." />;
<BarChart data={data}>
  <CartesianGrid {...gridProps} />
  <XAxis dataKey="label" {...axisProps} />
  <YAxis {...axisProps} />
  <Tooltip content={<GlassTooltip valueFormatter={fmtRp} />} />
  <Bar dataKey="value" fill={SEMANTIC.neutral} />
</BarChart>
```

### Contoh — KpiCard dengan tren
```jsx
<KpiCard label="Sales MTD" value={fmtRp(mtd)} icon={Wallet}
         color="aurora-1" delta={deltaPct} deltaLabel="vs LMTD" series={trend7d} />
```

---

## 3. Definition of Done — UX checklist (tempel di PR)

- [ ] Tabel: ada loading + empty state; angka `tabular-nums` rata-kanan; pakai `DataTable`.
- [ ] Tabel list/report: kolom relevan **sortable**; sticky header bila panjang; **drill-down** bila ada rincian.
- [ ] Chart: pakai `GlassTooltip` (bukan default), ada `ChartEmpty`, warna `SEMANTIC`/`CATEGORICAL`.
- [ ] Metrik: pakai `KpiCard` + delta/tren bila ada pembanding.
- [ ] Form: dropdown pakai shadcn `Select`; submit disable saat loading/invalid.
- [ ] `data-testid` pada semua elemen interaktif & data penting.
- [ ] `python3 scripts/ux_audit.py --strict` lulus (0 ERROR).

---

## 4. Enforcement

```bash
# Laporan lengkap + backlog migrasi
python3 scripts/ux_audit.py

# Mode strict (exit 1 bila ada ERROR) — jalankan sebelum finish / di CI
python3 scripts/ux_audit.py --strict

# Hanya berkas yang diubah
python3 scripts/ux_audit.py --files src/portals/finance/TrialBalance.jsx
```

**Kebijakan:** berkas BARU wajib 0 ERROR. Berkas lama yang tersentuh harus diperbaiki ke baseline
(boundary "Boy Scout rule"). Sisanya tercatat sebagai **migration backlog** di output script.

---

## Aksi tulis: anti double-submit (WAJIB)

Tombol untuk aksi **irreversible / tulis** (post jurnal, confirm/post payment run, kirim/terima transfer,
approve, bayar, settle) WAJIB mencegah klik-dobel:
- Pakai `components/shared/AsyncButton.jsx` — `onClick` async otomatis disable + spinner + lock re-entrant
  selama request berjalan. Drop-in: ganti `<Button onClick={fn}>` → `<AsyncButton onClick={fn}>`.
- ATAU state lokal `saving/acting` + `disabled={saving}` bila tombol custom.
- Selalu surface error API ke toast (`e.response?.data?.errors?.[0]?.message`).

## Guard data: cegah stok negatif

Form/aksi yang mengurangi stok (transfer kirim, issue, adjustment turun) mengandalkan guard backend
`inventory_service._assert_can_decrement` (HTTP 422 + pesan jelas). FE cukup menampilkan pesan error;
jika ada, tampilkan juga hint on-hand di samping input qty.

