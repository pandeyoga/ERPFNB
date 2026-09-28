# Torado ERP — Backend ↔ Frontend Parity Audit
**Tanggal:** 2026-06-17 · **Auditor:** Neo · **Status:** DRAFT analisis (belum eksekusi)
**Pertanyaan user:** *"Apakah ada kode backend yang fiturnya sudah ada namun belum ada implementasi frontend-nya?"* (+ apakah fitur sesuai intent & match dengan UI/flow).

## Metode
- Ekstraksi otomatis **617 endpoint** backend (60 router, prefix `/api/...`) vs **638 literal path** di frontend (`/app/frontend/src`).
- Skrip diff: `/tmp/parity_audit2.py` (modul & endpoint) + `/tmp/route_nav_diff.py` (route vs sidebar).
- **Caveat penting:** banyak panggilan frontend dibangun dinamis (hook `usePaginatedList("…")`, URL variabel `/finance/payments/${id}/${action}`, konstanta `API_URL` untuk app pelanggan). Karena itu daftar mentah "139 orphan" **tidak akurat** → setiap kandidat **diverifikasi manual** sebelum disimpulkan.

## Headline
**Tidak ada modul backend besar yang benar-benar tanpa frontend.** Setelah verifikasi, mayoritas endpoint "yatim" ternyata SUDAH terpakai via URL dinamis. Yang tersisa = **beberapa aksi kecil yang belum ada tombol UI**, **endpoint backend usang/duplikat**, dan **sedikit isu discoverability**. Rincian:

---

## Kategori A — Fitur backend yang BELUM ada UI (gap nyata, terverifikasi)
| Fitur backend | Endpoint | Dampak | Prioritas |
|---|---|---|---|
| **Ganti password staff** | `POST /auth/change-password` | App staff tak punya menu ganti password (hanya app loyalty pelanggan yang punya). | P1 |
| **AR: edit customer & invoice** | `PUT /ar/customers/{}`, `PUT /ar/invoices/{}` | Customer/invoice AR bisa dibuat tapi tak bisa diedit dari UI. | P1 |
| **AR: kirim reminder** | `POST /ar/invoices/{}/remind` | Tak ada tombol "Kirim Pengingat" pembayaran. | P2 |
| **AR: daftar channel** | `GET /ar/channels` | Tidak disurface (mungkin untuk dropdown). | P3 |
| **Cash account: edit/hapus/rekonsiliasi** | `PATCH/DELETE /finance/cash/accounts/{}`, `POST …/reconcile` | Akun kas bisa dibuat & update saldo, tapi tak bisa edit/hapus/rekonsiliasi per-akun dari UI. | P2 |
| **AI Exec Q&A: riwayat sesi** | `GET/DELETE /ai/exec-qa/sessions`, `GET /ai/exec-qa/tools` | Riwayat percakapan AI tidak ditampilkan/dikelola. | P2 |
| **Export Excel keuangan tertentu** | `/reports/finance/trial-balance.xlsx`, `pl-torado.xlsx`, `journal-ledger.xlsx`, `ap-aging.xlsx` | Tabel tampil di layar, tapi tombol unduh Excel untuk laporan finance ini belum jelas terhubung (perlu konfirmasi per-halaman). | P2 |
| **Diagnostik admin (low value)** | `GET /ai/ocr/cache-stats`, `GET /anomalies/thresholds/resolve` | Endpoint diagnostik tanpa UI. | P3 |

## Kategori B — Endpoint backend USANG / DUPLIKAT (kandidat cleanup, kebalikan dari gap)
Frontend memakai versi lain → endpoint ini kemungkinan **dead code**:
| Endpoint usang | Versi yang dipakai frontend |
|---|---|
| `POST /ai/extract-receipt` | `POST /ai/ocr/receipt` (ReceiptCapture) |
| `GET /master/coa` | `GET /master/chart-of-accounts` (di semua tempat) |
| `POST /budget/import-csv` | `POST /budget/import-excel` (BudgetImportDialog) |
| `GET /reports/inventory/valuation.xlsx` | `/reports/inventory-valuation/excel` (InventoryValuationReport) |
| `GET /executive/kpi-summary`, `GET /approvals/pending` | kemungkinan digantikan endpoint lain (perlu konfirmasi) |

> Rekomendasi: jangan langsung hapus; verifikasi pemakaian (bisa jadi dipakai script/integrasi) lalu tandai deprecated.

## Kategori C — Discoverability (frontend ADA tapi sulit ditemukan)
- Mayoritas "route tanpa item sidebar" adalah **tab/detail/create** yang memang sengaja (trial-balance, payroll, kdo/bdo, `*/new`) → konsisten dengan tujuan konsolidasi. **Bukan gap.**
- Perlu dicek apakah masuk sidebar atau hanya via link: **`JobApplications`** (review pelamar — file ada & routed di `HRPortal`), **`CRMAnalytics`** (cohorts/retention — ada di `admin/loyalty`). Keduanya fitur "berat" yang sebaiknya punya entry-point jelas.
- `closing-wizard` kini redirect ke `/finance/periods` (deprecation rapi, bukan halaman mati). Ada sisa `ClosingWizardPlaceholder` di `PeriodClosingHub` (kosmetik).

## Apakah fitur "sesuai intent" & match dengan UI/flow?
- Sudah ada infrastruktur audit nilai: `backend/scripts/intent_audit_5portals.py` & `intent_audit_remaining.py` (assert KPI == total detail, sum breakdown == headline, API == DB). Ini menjawab "implemented as intended" di level **data/nilai**.
- Rekomendasi: jalankan ulang kedua skrip ini sebagai bagian audit (read-only) untuk memverifikasi konsistensi nilai antar-endpoint setelah kita paham peta fitur. (Catatan recurring: skrip pytest mencemari demo DB — isu B8, belum diperbaiki.)

## Rekomendasi tindak lanjut (analisis → keputusan user)
1. **Gap UI** Kategori A: mana yang ingin diimplementasikan? (rekomendasi minimal: ganti-password staff [P1], AR edit + reminder [P1/P2]).
2. **Cleanup** Kategori B: setuju tandai endpoint usang sebagai deprecated?
3. **Discoverability**: tambahkan entry-point jelas untuk JobApplications & CRMAnalytics?
4. Jalankan `intent_audit_*` (read-only) untuk verifikasi nilai?
