# AUDIT FASE 1 — Bug, Duplikasi, SSOT Ganda, Cacat Logika
Tanggal: 2026-09-20 · Mode: **LAPORAN SAJA (tidak ada perubahan kode)** · Cakupan: backend + frontend
Alat: `scripts/audit_routes_dup.py`, `scripts/audit_fe_be_contract.py`, oxlint, query DB seed, inspeksi manual service finansial.

Legenda severity: **P0** = salah angka/keuangan atau fitur mati · **P1** = inkonsistensi yang akan jadi bug · **P2** = kualitas kode/duplikasi

---

## A. CACAT LOGIKA FINANSIAL / INTEGRITAS DATA

### A1. [P0] AP punya dua "sumber kebenaran" yang tidak pernah disinkronkan
- `ap_ledgers.balance` dibuat saat GR di-post (`services/procurement_service.py:423-438`) dan **tidak pernah dikurangi** oleh pembayaran. Tidak ada satupun `ap_ledgers.update_one` di seluruh backend (di luar seed).
- Pembayaran (`services/payment_service.py:408-423` dan `services/_finance/payment_runs.py:437-446`) hanya meng-update `goods_receipts.paid_amount / payment_status`.
- Dampak: **AP Aging** (`_finance/ap.py`, membaca `ap_ledgers`), **Cash Position** (`cash_position_service.py:298,347`), **Owner Digest** (`owner_digest_service.py:135`), **Daily Briefing** (`daily_briefing_service.py:173`) menampilkan hutang yang sudah dibayar sebagai masih outstanding. Sementara **Executive dashboard** (`executive_service.py:143-144`) menghitung AP dari `goods_receipts` → angka AP berbeda antar layar.
- Guardrails di `memory/ENGINEERING_GUARDRAILS.md` menyebut `ap_ledgers` sebagai kanonik, tapi write-path pembayaran tidak mengikutinya.

### A2. [P0] Status PO "received" salah untuk pengiriman bertahap
- `procurement_service.post_gr` (`:453-463`) membandingkan qty **GR ini saja** dengan total qty PO. Jika PO 100 pcs diterima 60 lalu 40, GR kedua menghitung 40 < 100 → status tetap `partial` selamanya. Harus akumulasi semua GR untuk PO tersebut.

### A3. [P0] Diskon voucher daily sales tidak masuk perhitungan
- `outlet_service._calc_grand_total` (`:234-237`) = revenue + service charge + tax. `voucher_discount_amount` disimpan (`:106`) tapi tidak dikurangkan.
- Validasi `:146-149` menuntut total pembayaran = grand_total (toleransi Rp1). Jika ada diskon voucher, kasir tidak bisa validasi (pembayaran < grand total) atau terpaksa memalsukan angka. Jurnal `post_for_daily_sales` juga tidak punya baris diskon meski docstring menjanjikannya (`_journal/outlet.py:11`).

### A4. [P1] Nilai GR bisa berbeda dari PO (pajak & diskon hilang)
- PO menghitung pajak **per baris** dan diskon per baris (`create_po :166-178`), tetapi GR memakai satu `tax_rate` dari payload (default 0) dan **mengabaikan diskon** (`post_gr :350-370`). AP dan jurnal dibuat dari nilai GR → hutang bisa lebih besar/kecil dari PO yang disetujui.
- `create_po` menulis `"discount_total": 0.0` hard-coded meski diskon per baris ada (`:191`).

### A5. [P1] Post GR tidak atomik
- Urutan: insert GR → insert movements → insert AP → post JE → update GR. Jika JE gagal (mis. GL mapping kosong, period lock lolos), GR/AP/stok sudah tersimpan tanpa jurnal dan tanpa `journal_entry_id`. Tidak ada rollback/kompensasi.

### A6. [P1] AR: JE gagal ditelan, receipt tetap tercatat
- `_ar/receipt.py:62-63` — `except Exception: logger.warning(...)`, lalu receipt tetap di-insert dan invoice di-update. Subledger AR akan lari dari GL tanpa peringatan ke user.

### A7. [P1] Toleransi balance jurnal tidak seragam
- `_journal/_common._post_journal`: **0.5** (`:89`) · `_finance/journals.post_manual_journal`: **0.01** (`:97`) · trial balance: **0.02** (`_finance/reports.py:63`). Auto-posting boleh selisih sampai 50 sen per jurnal → trial balance bisa "tidak balance" padahal tiap JE lolos.

### A8. [P1] Valuasi inventori ≠ GL inventori
- `inventory_service.stock_balance` memakai **last-cost** (`$last unit_cost`, `:71,97`), sementara GL memposting inventori pada **harga aktual GR**. `$last` bisa mengambil `unit_cost` = 0 dari movement transfer/opname (transfer_out menulis `unit_cost` dari payload yang boleh 0) → valuasi item jadi Rp0.
- Transfer antar outlet (`inventory_service.py:239,272`) membuat movement tetapi **tidak ada JE** padahal akun inventori di-resolve per outlet (`gl_mapping.resolve("inventory", scope_outlet_id=...)`) → saldo GL inventori per outlet tidak pindah.

### A9. [P2] Payroll `total_allowances` tidak termasuk tunjangan tetap
- `_hr_payroll/cycle.py:122` hanya menjumlah `sc_share + inc_share`; `allowances_total` (tunjangan tetap) masuk gross tapi tidak ke `total_allowances`. Label di UI menyesatkan. `pph21_method` dibaca tapi tidak memengaruhi perhitungan (`:46,104`).

---

## B. SSOT GANDA / INKONSISTENSI KONTRAK

### B1. [P1] Dua "poster" jurnal dengan skema dokumen berbeda
| | `_journal/_common._post_journal` (auto) | `_finance/journals.post_manual_journal` |
|---|---|---|
| nomor | `doc_no` (`JAE-`) | `je_number` (`JE-`) |
| dimensi outlet | `lines[].dim_outlet` | top-level `outlet_id` |
| toleransi | 0.5 | 0.01 |
| period guard | `_ensure_period_open` (auto-create period) | `_period.assert_period_unlocked` |
- Dampak nyata: `list_journals` filter `outlet_id` dan search `je_number` (`_finance/journals.py:51,62-65`) **tidak menemukan jurnal otomatis** (mereka pakai `doc_no` + `dim_outlet`). Di DB: 105 referensi `doc_no` vs 1 `je_number`.

### B2. [P1] Tarif PPN punya 3 sumber
- `core/constants.PPN_DEFAULT_RATE` (0.12) · system setting `TAX_PPN_RATE` (dibaca `tax_service.py:36`) · hard-coded `0.12` di `_period/tax_settlement.py:139,142`.
- `_ar/invoice.py:46,187` memakai konstanta langsung, **melewati system setting** → jika admin ubah tarif di Settings, AR invoice tetap 12%.

### B3. [P1] Number series dipakai lintas entitas
- `PAY` dipakai oleh **payment_requests** (`payment_service.py:154`), **payroll_cycles** (`_hr_payroll/cycle.py:126`), dan **payment_run_templates** (`:211`). `PR` dipakai purchase_requests dan **urgent purchase** (`outlet_service.py:378`, ada komentar "sharing PR series for now"). Nomor dokumen tidak unik per jenis; audit trail/pencarian rancu.

### B4. [P1] Permission codes: 47 kode dipakai router tapi tidak diberikan ke role manapun
- Hasil query DB seed: hanya `SUPER_ADMIN (*)` yang bisa mengakses endpoint dengan permission: `hr.read`, `hr.write`, `inventory.item.read/update`, `admin.cms.*`, `admin.loyalty.*`, `admin.master_data.write`, `finance.asset.dispose/revalue/delete`, `tax.efaktur.*`, `tax.ebupot.*`, `report_schedules.manage`, `system.*`, dll.
- Contoh terverifikasi: user EXECUTIVE → `GET /api/hr/home` **403**, `GET /api/hr/employees` **403**. Role HR_MANAGER/HR_OFFICER juga tidak punya `hr.read` → HR portal home & daftar karyawan **tidak bisa dibuka oleh HR sendiri**.
- 14 kode dipakai router tapi **tidak ada di `core/perms_catalog.py`** (SSOT RBAC): `admin`, `cms`, `loyalty`, `hr.read`, `hr.write`, `inventory.item.read/update`, `admin.view`, `finance.view`, `admin.dashboard.view`, `settings.manage`, `audit.view`, `admin.loyalty.manage`, `admin.master_data.write`.
- Ejaan ganda untuk hal yang sama: `admin.master_data.manage` (3 router) vs `admin.master_data.write` (4 router).
- 37 permission diberikan ke role tapi tidak pernah dicek di router manapun (dead perms), mis. `procurement.pr.approve`, `finance.journal_entry.post`, `outlet.daily_sales.create`.

### B5. [P2] `core/constants.py` dimaksudkan sebagai SSOT tapi hanya dipakai 3 file
- `ACCESS_TOKEN_DEFAULT_MINUTES = 30` di constants vs default aktual `1440` di `core/config.py:25` — dua nilai berbeda untuk hal yang sama.
- Batas `per_page` (`le=100` 44×, `le=500` 46×) ditulis literal di router, tidak pakai `MAX_PAGE_SIZE`.

### B6. [P2] Config upload didefinisikan 4 kali
- `UPLOAD_DIR` / `ALLOWED_TYPES` / `MAX_SIZE` diduplikasi di `routers/admin_menu.py`, `routers/admin_loyalty.py`, `routers/_cms_advanced/_common.py`, `routers/_admin_cms/_common.py`, dan `services/upload_service.py` — dengan whitelist MIME yang **berbeda-beda** (gif diizinkan di satu, tidak di lainnya). *(Catatan: sesuai keputusan Anda, storage tetap lokal — poin ini hanya soal duplikasi konfigurasi.)*

---

## C. BUG FUNGSIONAL (TERVERIFIKASI DI PREVIEW)

### C1. [P0] Global Search (⌘K) mati total
- `components/shared/GlobalSearch.jsx:141` memanggil `api.get("/api/search")` padahal `api` sudah punya `baseURL = …/api` → request ke `/api/api/search` → **404** → UI selalu "Tidak ada hasil". Verifikasi: `/api/search?q=kopi` mengembalikan 1 item + 1 vendor; UI menampilkan kosong (screenshot).

### C2. [P1] Endpoint frontend yang tidak ada di backend (audit 671 call, 17 tidak cocok, 7 di antaranya nyata)
| File | Call | Status | Seharusnya |
|---|---|---|---|
| `components/shared/GlobalSearch.jsx` | `GET /api/search` | 404 | `/search` |
| `portals/reports/JournalLedgerReport.jsx:30` | `GET /finance/coa` | 404 | `/master/coa` (filter COA di laporan selalu kosong) |
| `portals/finance/BudgetVsActual.jsx:38`, `BudgetMgmtPkg/index.jsx:56` | `GET /admin/brands` | 404 (di-catch → dropdown brand kosong) | `/master/brands` |
| `hooks/useFinanceListQueries.js` | `GET /finance/ar-*` (5 endpoint) | 404 | `/ar/*` — hook ini **tidak dipakai siapa pun** (dead code) |
| `portals/inventory/OpnameList.jsx:138` | `GET /inventory/opname/{id}` | tidak ada route GET by id | — |
| `portals/finance/Forecasting.jsx` | `GET /forecasting/{x}` | perlu dicek nilai x | — |

### C3. [P1] `CRMAnalytics/index.jsx` — `DataTable` tidak di-import (sudah saya perbaiki di sesi sebelumnya; tab CRM Analytics sebelumnya crash).

### C4. [P2] `alert()` browser masih dipakai untuk error di beberapa halaman (mis. quarter/approve di portal finance) sementara standar app adalah `sonner` toast — inkonsistensi UX.

---

## D. DUPLIKASI KODE (P2)

- **Frontend formatter Rupiah**: `lib/format.js` sudah menyediakan `fmtRp/fmtNumber`, tetapi **13 file** mendefinisikan `fmt`/`formatRupiah`/`formatCurrency`/`fmtRp` lokal (`MarketListPage`, `VendorCatalog`, `POFormPkg`, `PriceIntelligence`, `FdoPage`, `LoyaltyPointsEntry`, `ReservationListPkg/constants.js`, `CMSMenuAdmin/helpers.js`, `CRMAnalytics`, dll.) dengan format yang tidak seragam (Rp 1,2jt vs Rp 1.200.000).
- **Frontend status badge map**: 18 file punya `STATUS_COLORS/STATUS_MAP` lokal padahal ada `components/shared/StatusPill.jsx`.
- **Backend serializer `_ser`**: 4 salinan (`admin_menu.py`, `public_menu.py`, `public_content.py`, `crm_analytics.py`) + `_admin_cms/_common._ser` padahal `core.db.serialize` ada.
- **Backend `_now()`**: didefinisikan di 32 modul.
- **`_parse_date`**: 5 salinan di service report/excel.
- **`_user_perms`**: 4 salinan (`daily_close_service`, `kdo_bdo_service`, `outlet_service`, `routers/admin.py`) — semuanya membungkus `core.security.get_user_permissions`.
- **Logika "GR lunas/partial"**: disalin identik di `payment_service.mark_paid` dan `_finance/payment_runs.post_payment_run` (dan keduanya melewatkan `ap_ledgers`, lihat A1).
- **Aggregasi stok dari `inventory_movements`**: 7 pipeline terpisah (`inventory_service` ×2, `inventory_matrix_service` ×2, `reports_excel_inventory_service` ×2, `_period/checks`, `daily_briefing_service`) — risiko tiap layar menghitung stok berbeda.
- **Test harness**: `main/print_summary/login/run_test` diduplikasi di 14 skrip test ad-hoc di `backend/*.py` (bukan pytest).

---

## E. HAL YANG SUDAH BERSIH (tidak ditemukan masalah)
- Tidak ada duplikasi registrasi route (679 route, 0 duplikat, 0 shadowing param).
- Semua path di navigation schema punya route React.
- Hanya satu instance axios (`lib/api.js`).
- oxlint (undef / dupe keys / rules-of-hooks): 0 error setelah fix `DataTable`.
- pytest backend: 229 passed.

---

## F. USULAN URUTAN PERBAIKAN (menunggu persetujuan Anda — belum dikerjakan)
1. **Fase 2a (P0, angka salah / fitur mati)**: A1 (AP balance sync), A2 (PO received kumulatif), A3 (diskon voucher), C1 (Global Search path), C2 (3 path 404 nyata).
2. **Fase 2b (P1 SSOT)**: B1 (unify skema JE: `doc_no`+`dim_outlet`, satu tolerance, satu period guard), B2 (PPN dari system setting), B3 (series `PAYR`, `UP`), B4 (grant permission ke role + sinkron perms_catalog), A4-A7.
3. **Fase 2c (P2 duplikasi)**: konsolidasi formatter/StatusPill/`_ser`/`_now`/aggregasi stok.

Setiap fase akan diverifikasi dengan testing agent + pytest sebelum dilaporkan.
