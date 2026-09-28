# AUDIT FASE 2 — Full Coverage: Bug, Cacat Logika, SSOT, Duplikasi
Repo: `pandeyoga/ERPFNB` @ `1dc4112` (2026-09-21, pasca Fase 2a) · Tanggal audit: 2026-09-27
Mode: **LAPORAN SAJA — tidak ada kode yang diubah.**

Legenda severity
- **P0** — angka keuangan/stok salah, uang bisa keluar tanpa kontrol, atau fitur inti gagal.
- **P1** — celah kontrol/keamanan, inkonsistensi data yang pasti jadi bug, SSOT ganda yang aktif dipakai.
- **P2** — kualitas kode, duplikasi, konfigurasi mati, risiko minor.

Tanda bukti
- **[V]** = sudah **direproduksi** dengan menjalankan kode service asli (MongoDB in-memory, lihat Lampiran).
- **[K]** = terverifikasi dengan membaca kode (jalur eksekusi jelas, belum dieksekusi).
- **[R]** = race condition; logikanya jelas di kode tapi tidak bisa direproduksi di DB mock.

---

## 0. Ringkasan eksekutif

| Bagian | Jumlah temuan | Severity |
|---|---:|---|
| A. P0 (angka salah / uang keluar tanpa kontrol) | 14 | 12 direproduksi [V] (+3 P0 baru di §I) |
| B. Logika keuangan & operasional | 22 | P1 |
| C. Keamanan, RBAC & approval | 17 | 1 P0 (SEC-01), 12 P1, 4 P2 |
| D. SSOT | 16 | P1–P2 |
| E. Duplikasi & kode mati | 11 | P2 (DUP-01/02 P1) |
| F. Frontend | 6 | 3 P1, 3 P2 |
| G. Kepatuhan pajak | 5 | perlu konfirmasi konsultan |
| I. Temuan lanjutan (putaran 2) | 42 | 3 P0 (P0-15/16/17), 29 P1, sisanya P2 |
| **Total** | **133** | |

**10 hal yang paling mendesak:**
1. **Posting payroll gagal** setiap kali ada potongan BPJS karyawan (jurnal tidak balance), dan kalaupun lolos, **service charge + insentif dibiayakan dua kali**. [V]
2. **Dua modul "Payment Request" menulis ke koleksi yang sama** (`payment_requests`). Endpoint lama bisa menandai pembayaran "paid" **tanpa jurnal & tanpa mengurangi AP**. [V]
3. **Penerimaan AR parsial ke-2 dst. tidak pernah masuk GL**, dan **penyusutan aset tetap hanya bulan pertama yang masuk GL**. Keduanya karena kunci idempotensi jurnal (`source_type` + `source_id`) dipakai ulang. [V]
4. **Kasbon karyawan bisa di-approve dan dicairkan oleh user mana pun yang login**, karena tidak ada workflow default dan router hanya memakai `current_user`. [V]
5. **Status PR diambil dari payload.** Klien bisa membuat PR langsung `approved` sehingga approval dan budget guard terlewati. [V]
6. **GR tidak divalidasi terhadap PO.** GR diterima untuk PO yang sudah dibatalkan, dengan vendor/outlet berbeda, qty negatif, dan harga bebas. [V]
7. **Trial Balance dan P&L per outlet mengabaikan filter outlet**, sehingga yang tampil selalu angka konsolidasi. [V]
8. **Settlement PPN salah.** PPN Masukan selalu 0 (field `ppn_amount` tidak pernah ditulis), PPN Keluaran ikut menghitung sales yang belum divalidasi, dan penjualan restoran secara hukum adalah objek PBJT/PB1, bukan PPN. [K]
9. **Kasir mana pun bisa menambah poin loyalty dengan nominal bebas** tanpa terikat ke transaksi. Akun loyalty yang dibuat otomatis memakai password = nomor HP, dan login loyalty tidak dibatasi rate limit. [K]
10. **Refresh token di frontend tidak ikut dirotasi.** Setelah refresh pertama, refresh kedua pasti ditolak sehingga user ter-logout paksa. [K]

**Tambahan dari putaran 2 (§I) yang setara prioritasnya:** saldo akun normal-debit di Trial Balance **bertanda terbalik** [V]; **e-Faktur & e-Bupot selalu kosong** dan preview membakar nomor faktur [V]; **template payment run melewati approval** untuk nominal berapa pun [K]; **rate limiter bisa dimatikan** dengan header `X-Forwarded-For: 127.0.0.1` [V]; hampir semua **ekspor Excel keuangan/inventori/procurement kosong atau Rp 0** [V]; **digest pemilik & laporan terjadwal tidak pernah jalan** [K].

---

## 1. Metodologi & cakupan

- **Backend (≈74 rb baris Python)**: seluruh `core/`, semua router (60 file) disapu untuk guard auth/RBAC secara otomatis (AST). Service berikut dibaca penuh baris per baris: procurement, inventory, outlet (daily sales/petty cash/urgent purchase), payment, payment runs, AP settlement, journal (`_journal/*`, `_finance/journals`), period & tax settlement, AR, fixed asset, payroll/SC/insentif/kasbon, approval engine, loyalty/voucher/reward, bank recon, budget vs actual, cash position, data management, auth, dan leave. Service lain di-sweep dengan grep terarah untuk pola bug: nama koleksi/field, `$regex`, filter status, business date, `to_list(N)`, dan idempotensi.
- **Frontend (≈101 rb baris JS/JSX)**: oxlint (no-undef, rules-of-hooks, dupe-keys, jsx-no-undef) memberi **0 error nyata**. Kontrak FE↔BE diperiksa dengan `scripts/audit_fe_be_contract.py`: 670 panggilan, 7 "unmatched" yang semuanya path dinamis valid, jadi **0 mismatch nyata**. Logika di API client, form Daily Sales, RBAC FE, dan duplikasi juga diperiksa.
- **Statik**: ruff (F, B, ASYNC, PLE) dan skrip silang permission (router vs `perms_catalog` vs seed).
- **Putaran 2**: modul yang tadinya hanya disapu otomatis kini dibaca penuh: laporan & semua ekspor Excel, cashflow, balance sheet, profit walk, e-Faktur, e-Bupot, tax service, AR aging/write-off, executive & drilldown, owner digest, daily briefing, AI Q&A, forecast & forecast guard, anomaly, scheduler, periode (close/lock), budget, outlet budget, daily close, KDO/BDO, vendor item, market list, payment run template, master data, import Excel, CMS & sanitizer, CRM/admin loyalty, customer/loyalty ledger, upload, rate limiter, secrets. Frontend diperiksa per portal (finance, procurement, inventory, outlet, HR, executive, admin, publik) untuk kontrak field, kalkulasi yang diduplikasi, dan pola pemuatan data.
- **Dinamis**: 13 skrip memanggil kode asli (service + middleware) di atas MongoDB in-memory / TestClient untuk mereproduksi 22 temuan (Lampiran A).
- **Yang tetap di luar cakupan**: seed, skrip `scripts/`, test, isi komponen UI murni presentasional (styling/tour), serta perilaku runtime di DB & UI produksi.
- **Batasan**: tidak ada akses ke DB/preview live, jadi perilaku UI tidak di-screenshot. Race condition ditandai [R]. Poin perpajakan (§G) perlu dikonfirmasi konsultan pajak.

---

## 2. Status temuan Fase 1 (AUDIT_2026-09-20)

| ID | Temuan Fase 1 | Status sekarang |
|---|---|---|
| A1 | AP tidak berkurang saat bayar | 🟡 **Sebagian.** `ap_settlement.apply_gr_payment` sudah ada, tetapi (a) modul payment lama tetap bisa "paid" tanpa AP (P0-04), (b) Executive dashboard masih menghitung AP dari `goods_receipts` (P1-SSOT-03), (c) proses baca-ubah-tulis tidak atomik (P1-FIN-07). |
| A2 | Status PO kumulatif | 🟡 **Sebagian.** Qty sudah kumulatif, tetapi dijumlah total semua baris (bukan per baris), dan PO yang `cancelled` bisa "hidup lagi" (P0-07). |
| A3 | Diskon voucher | 🟡 **Sebagian.** Rumus grand total sudah benar, tetapi nilai diskon dikirim dari klien tanpa re-validasi, dan voucher persentase diperlakukan sebagai rupiah (P1-FIN-03, FE-02). |
| A4 | Pajak/diskon GR ≠ PO | 🔴 Masih terbuka (`post_gr` masih memakai satu `tax_rate` dari payload; diskon diabaikan; `discount_total: 0.0` hard-coded). |
| A5 | Post GR tidak atomik | 🔴 Masih terbuka (pola yang sama ditemukan juga di opname, lihat P0-10). |
| A6 | Kegagalan JE AR ditelan | 🔴 Masih terbuka (`_ar/receipt.py:62`, `_ar/journal.py`). |
| A7 | Toleransi balance 0,5 / 0,01 / 0,02 | 🔴 Masih terbuka. |
| A8 | Valuasi last-cost; transfer tanpa JE | 🔴 Masih terbuka. |
| A9 | `total_allowances` payroll | 🔴 Masih terbuka (ada masalah payroll yang jauh lebih besar, lihat P0-01/02/03). |
| B1 | Dua skema JE (`doc_no`/`dim_outlet` vs `je_number`/`outlet_id`) | 🔴 Masih terbuka, dan dampaknya meluas ke Budget vs Actual (P1-SSOT-05). |
| B2 | PPN 3 sumber | 🔴 Masih terbuka; sekarang ada **5 sumber** (P1-SSOT-06). |
| B3 | Number series `PAY`/`PR` dipakai lintas entitas | 🔴 Masih terbuka; ditambah `PR-YYMM-HHMMSS` dari modul payment lama (P0-04). |
| B4 | 47 permission tidak diberikan ke role | 🔴 Masih terbuka: **48** kode dipakai router tapi tidak diberikan ke role mana pun; 14 kode tidak ada di catalog; 40 kode catalog tidak pernah dicek. |
| B5 | `core/constants` tidak dipakai | 🔴 Masih terbuka (hanya 3 import; `ACCESS_TOKEN_DEFAULT_MINUTES=30` vs config `1440`). |
| B6 | Konfigurasi upload 4× | 🔴 Masih terbuka, ditambah akar direktori yang terbelah (P1-SSOT-09). |
| C1–C3 | Global search, path 404, DataTable | ✅ Sudah diperbaiki (kontrak FE↔BE kini bersih). |
| C4 | `alert()` | 🔴 Masih 11 pemakaian. |
| D | Duplikasi | 🔴 Masih: `_now` 35×, `_parse_date` 8×, `_ser` 7×, `_user_perms` 4×, pipeline stok 9×, formatter Rupiah FE 12×, status map FE 16×. |

---

## A. P0 — Angka salah / uang keluar tanpa kontrol

### P0-01 [V] Jurnal payroll tidak balance → payroll tidak bisa di-post
- **Lokasi**: `services/_journal/hr_payroll.py:114-157`, `services/_hr_payroll/cycle.py:103-104`
- **Masalah**: `take_home = gross − (BPJS karyawan + PPh21) − kasbon`. Jurnal memposting Dr Beban Gaji = `gross`, Cr Utang Gaji = `take_home − PPh21` (**PPh21 dikurangi dua kali**), Cr PPh21, Cr Kasbon. **Tidak ada baris utang BPJS.** Akibatnya selisih = BPJS karyawan, dan `_post_journal` menolak jurnal.
- **Bukti**: gaji pokok 4 jt dengan BPJS → `Journal tidak balance: Dr=4000000, Cr=3840000 (diff=160000)`.
- **Tambahan**: BPJS porsi perusahaan (`total_bpjs_employer`) tidak pernah dijurnal. COA PPh21 di-hard-code `code "2112"` (bypass `gl_mapping`); kalau COA itu tidak ada, barisnya hilang diam-diam.
- **Fix**: Cr Utang Gaji = `take_home`; tambah Cr Utang BPJS (karyawan + perusahaan) dan Dr Beban BPJS perusahaan; resolve PPh21 lewat `gl_mapping`.

### P0-02 [V] Service charge & insentif dibiayakan dua kali di payroll
- **Lokasi**: `cycle.py:95` (`gross = basic + tunjangan + sc_share + inc_share`) dan `_journal/hr_payroll.py` (SC: Dr Liabilitas SC / Cr Utang Gaji; insentif: Dr Beban Insentif / Cr Utang Gaji).
- **Masalah**: SC dan insentif sudah dikreditkan ke Utang Gaji saat posting masing-masing. Payroll membebankan lagi seluruh `gross` ke Beban Gaji, sehingga Beban dan Utang Gaji lebih besar sebesar SC + insentif.
- **Bukti**: SC 500 rb → JE payroll Dr 4.500.000 / Cr 4.500.000, padahal 500 rb sudah dicatat oleh JE SC.
- **Fix**: di JE payroll, porsi SC/insentif harus mendebit Utang Gaji (bukan beban), atau keluarkan dari `gross` saat membentuk beban.

### P0-03 [V] Payroll ganda untuk periode yang sama
- **Lokasi**: `cycle.py:42`, `core/db.py:177-184`
- **Masalah**: cek duplikat hanya untuk status `draft`/`approved`. Setelah `posted`, payroll periode yang sama bisa dibuat lagi. Run "semua outlet" (`outlet_id=None`) juga tumpang tindih dengan run per-outlet. Unique index "anti-concurrent" dipasang di koleksi **`payroll_runs`** (mati), bukan `payroll_cycles`.
- **Bukti**: payroll 2026-08/o1 sudah posted → payroll kedua untuk o1 tetap dibuat, dan run all-outlet juga memuat karyawan yang sama.

### P0-04 [V] Dua modul Payment Request pada koleksi yang sama; "mark-paid" tanpa jurnal
- **Lokasi**: `services/payment_service.py` (router `/api/finance/payments`) dan `services/payment_request_service.py` (router `/api/finance/payment-requests`). Keduanya aktif di UI (`FinancePaymentsHub` → `PaymentRequestList/Detail/Form`).
- **Masalah**:
  1. Keduanya membaca/menulis `payment_requests` dengan skema berbeda (single-payee `amount/gl_debit_id` vs multi-item `items[]`).
  2. `mark_payment_request_paid` hanya men-set `status: paid`: **tanpa JE, tanpa pengurangan AP/GR, tanpa cek period lock.** Endpoint ini bisa dipakai pada PAY milik modul baru yang sudah `approved`.
  3. Approval modul lama tidak memakai approval engine (placeholder `"_auto_approve_"`, bisa self-approve).
  4. Helper "open AP" memfilter `goods_receipts.status == "received"`, `total_amount`, dan `payments`. Ketiga field itu tidak ada (GR memakai `posted`/`grand_total`/`paid_amount`), jadi hasilnya **selalu kosong**.
  5. Nomor dokumen `PR-YYMM-HHMMSS` bentrok dengan prefix Purchase Request dan dengan dokumen lain yang dibuat pada detik yang sama.
- **Bukti**: PAY approved → mark-paid lewat modul lama → status `paid`, **0 JE**, saldo AP tetap 1.000.000; helper open-AP mengembalikan 0 baris.
- **Fix**: pensiunkan `payment_request_service` (atau jadikan wrapper modul baru); satu skema, satu state machine.

### P0-05 [V] Penerimaan AR parsial ke-2 dst. tidak masuk GL
- **Lokasi**: `services/_ar/receipt.py:49-63`
- **Masalah**: JE receipt memakai `source_id=invoice_id`. `_post_journal` idempoten per (source_type, source_id), jadi receipt kedua **mengembalikan JE receipt pertama** dan tidak ada JE baru. Subledger AR lunas, sementara GL masih menyisakan piutang. Error lain juga ditelan (`except Exception: logger.warning`).
- **Bukti**: invoice 1 jt, dibayar 400 rb + 600 rb → hanya 1 JE (400 rb), dan kedua receipt menunjuk ke JE yang sama.
- **Tambahan**: bank selalu COA `1111/1001` (hard-coded) dan mengabaikan `bank_account_id`.
- **Fix**: `source_id = receipt.id`; resolve akun lewat `gl_mapping`/`bank_accounts.gl_account_id`; gagalkan transaksi jika JE gagal.

### P0-06 [V] Penyusutan aset tetap hanya bulan pertama yang masuk GL
- **Lokasi**: `services/fixed_asset_service.py:253, 352, 417`
- **Masalah**: `source_id=asset_id` untuk penyusutan, disposal, dan revaluasi. Bulan ke-2 dst. mengembalikan JE bulan pertama, padahal `depreciation_entries` dan `accumulated_dep` aset terus bertambah. Revaluasi kedua pun tidak pernah terjurnal.
- **Bukti**: 3 bulan penyusutan → akumulasi aset 3 jt, **JE di GL hanya 1 (periode 2026-01)**.
- **Tambahan**: straight-line tidak di-cap di `book − salvage` (`calc_monthly_dep`), sehingga bulan terakhir bisa menembus nilai sisa.
- **Fix**: `source_id = f"{asset_id}:{period}"` (dan id event untuk disposal/revaluasi).

### P0-07 [V] Goods Receipt tidak divalidasi terhadap PO
- **Lokasi**: `services/procurement_service.py:322-476`
- **Masalah**: `vendor_id`, `outlet_id`, `unit_cost`, dan qty seluruhnya diambil dari payload. Tidak ada cek status PO (cancelled/draft/belum approved), kecocokan vendor/outlet, over-receipt, harga vs PO, maupun `qty_received > 0`. Status PO lalu di-update jadi `partial`/`received`, termasuk untuk PO yang **cancelled**. Perhitungan "received" memakai total qty semua baris, bukan per baris.
- **Bukti**: PO dibatalkan → GR vendor `v2` outlet `o2` harga 999.999 diterima, PO berubah jadi `received`; GR `qty_received=-5` menghasilkan grand total **−5.000** (AP negatif, stok negatif, JE terbalik).
- Ditambah A4/A5 Fase 1 yang masih terbuka.

### P0-08 [V] Transfer stok dengan qty negatif menciptakan stok dari nol
- **Lokasi**: `services/inventory_service.py:203-296`
- **Masalah**: tidak ada validasi `qty > 0`. Guard stok negatif mengabaikan `qty ≤ 0`, lalu movement ditulis `-(-5)=+5` di outlet asal dan `-5` di tujuan.
- **Bukti**: transfer `qty=-5` → o1 **+5**, o2 **−5**.
- **Tambahan**: `unit_cost` transfer diambil dari payload (valuasi bisa dimanipulasi); tidak ada JE antar outlet (A8).

### P0-09 [V] Trial Balance & P&L: filter outlet diabaikan
- **Lokasi**: `services/_finance/reports.py:10-22, 66-88`, `balances.py:_aggregate_balance`
- **Masalah**: parameter `outlet_id`/`dim_outlet` diterima tetapi tidak diteruskan ke agregasi. Laporan per outlet menampilkan angka **konsolidasi**.
- **Bukti**: TB untuk `outlet_id="o-nonexistent"` = TB semua outlet (9.994.990).

### P0-10 [V] Stock opname: varians dari snapshot basi + submit tidak atomik
- **Lokasi**: `inventory_service.py:462-560`
- **Masalah**: `system_qty` di-snapshot saat opname **dimulai**, dan varians = counted − snapshot. Movement yang terjadi selama opname (GR, transfer) ikut dihitung lagi. Movement varians juga ditulis **sebelum** JE. Kalau JE gagal, status tetap `in_progress`, dan retry menulis movement lagi.
- **Bukti**: stok 100, GR +50 saat opname, fisik 150 → sistem jadi **200**; setelah JE gagal lalu retry → **250**.
- **Tambahan**: opname "submit" langsung memposting tanpa approval (permission `inventory.opname.approve` tidak pernah dipakai) dan tanpa cek period lock. Item tanpa histori movement tidak bisa dihitung.

### P0-11 [V] Status PR diambil dari payload → bypass approval & budget
- **Lokasi**: `procurement_service.py:55-82`
- **Masalah**: `"status": payload.get("status", "submitted")`. Klien bisa mengirim `status: "approved"`. Budget guard hanya jalan untuk status None/submitted/awaiting_approval, dan flag `skip_budget_check` juga diterima dari klien.
- **Bukti**: PR dibuat langsung `approved` dengan `approval_chain: []`.
- **Tambahan**: `create_po` mengonversi PR apa pun (tanpa cek approved) menjadi `converted`.

### P0-12 [V] Kasbon karyawan di-approve & dicairkan oleh user tanpa izin
- **Lokasi**: `routers/hr.py:105-117` (`Depends(current_user)`), `services/_hr/advances.py:188`
- **Masalah**: tidak ada workflow default `employee_advance`, sehingga jalur "legacy" langsung mencairkan dan memposting JE tanpa cek permission. Endpoint `/approvals/quick-action` juga terbuka.
- **Bukti**: user dengan permission tunggal `outlet.daily_sales.read` → kasbon 5 jt berstatus `repaying` + JE kas keluar.

### P0-13 [K] Settlement PPN salah secara sistemik
- **Lokasi**: `services/_period/tax_settlement.py`, `_journal/procurement.py:10`, `_journal/outlet.py:83-87`
- **Masalah**:
  1. PPN Masukan = `sum(ap_ledgers.ppn_amount)`, tetapi **tidak ada kode yang menulis `ppn_amount`**, jadi selalu 0. Padahal JE GR mendebit `input_vat` sebesar `tax_total`, sehingga saldo PPN Masukan menumpuk selamanya dan PPN terutang dilebihkan.
  2. PPN Keluaran = `sum(daily_sales.tax_amount)` **tanpa filter status**, jadi draft dan rejected ikut terhitung (padahal JE hanya dibuat saat validated). PPN dari AR invoice (akun 2110) tidak ikut.
  3. Pajak penjualan restoran diposting sebagai "PPN Keluaran" (lihat §G).
- **Fix**: settlement sebaiknya membaca **saldo GL** akun `input_vat`/`output_vat` per periode (SSOT = GL), bukan subledger.

### P0-14 [K] Payment Run: pembayaran ditandai paid walau JE PPh-nya gagal
- **Lokasi**: `services/_finance/payment_runs.py:377-436`
- **Masalah**: kegagalan JE withholding di-`continue`, tetapi loop berikutnya menandai **semua** PAY `paid` dan mengurangi AP. Uang keluar tanpa jurnal. Selain itu `pay_je_id = next(jid for jid in all_je_ids if jid != batch_je_id)` selalu mengambil JE WHT **pertama** untuk semua PAY WHT, sehingga link JE salah.
- **Tambahan**: posting tidak atomik (gagal di tengah → sebagian PAY paid, run tidak bisa di-retry); `update_payment_run` tidak menghitung ulang `net_amount`, tidak cek `gl_account_id` bank, dan tidak cek period lock.

---

## B. P1 — Cacat logika keuangan & operasional

| ID | Lokasi | Masalah |
|---|---|---|
| FIN-01 [K] | `_finance/journals.py:106` | JE manual: `period` diambil dari payload sehingga tanggal di periode terkunci bisa diposting ke periode terbuka (bypass lock). Tidak ada validasi per baris (dr/cr negatif, dr & cr sekaligus). |
| FIN-02 [K] | `_journal/core.py:9` vs `_finance/journals.py:135` | Dua `reverse_journal` dengan semantik bertentangan: satu set `status:"reversed"` (laporan yang filter `posted` akan menghitung reversal tanpa aslinya), satu set flag `reversed:True`. Versi `_journal` mati tapi masih diekspor `journal_service`, dan crash `orig["doc_no"]` untuk JE manual. |
| FIN-03 [K] | `outlet_service.py:106`, FE `DailySalesFormPkg:209` | Diskon voucher adalah angka dari klien, tidak divalidasi ulang saat submit/validate. Satu voucher bisa dipakai di dua daily sales (consume gagal hanya di-log). Voucher `percentage` dipakai sebagai rupiah. |
| FIN-04 [K] | `outlet_service.py:83-88` | Daily sales ganda per outlet+tanggal: draft baru dibuat jika yang ada sudah `submitted/validated` → revenue dobel. Tidak ada unique index. `submit` tanpa cek scope outlet. |
| FIN-05 [K] | `outlet_service.py:269-330`, `_journal/outlet.py:102-121` | Petty cash: `replenish`/`adjustment` menambah saldo subledger tanpa JE dan tanpa approval; `purchase` tanpa `gl_account_id` mengurangi saldo tanpa JE. GL petty cash ≠ subledger. `adjustment` hanya bisa positif. |
| FIN-06 [K] | `_journal/outlet.py:124-160` | Urgent purchase dibayar PETTY: GL petty cash dikredit tetapi `petty_cash_transactions` tidak berkurang. Item tanpa GL dilewati sehingga JE < total UP. Approval tanpa cek SoD. |
| FIN-07 [K][R] | `_finance/ap_settlement.py` | Baca-ubah-tulis (bukan `$inc`), tanpa idempotensi per `payment_id`, overpayment di-clamp diam-diam (GR `paid_amount` bisa > total sementara AP 0). |
| FIN-08 [K][R] | `payment_service.py:mark_paid` | Update status tidak kondisional (`{"status":"approved"}`); double-click → JE idempoten tetapi `apply_gr_payment` jalan 2× → AP berkurang dua kali. |
| FIN-09 [K] | `payment_service.py:create/update` | `gr_id` tidak dicek terhadap payee/vendor, jumlah tidak dicek terhadap outstanding, beberapa PAY bisa untuk satu GR, `gl_debit_id` bebas walau `gr_id` diisi (AP subledger turun, GL AP tidak). `wh_amount` tidak dihitung/dibatasi (bisa > amount). `update_payment` tidak validasi `gr_id`/COA. |
| FIN-10 [K] | `_hr/service_charge.py:206`, `incentive.py:208`, `cycle.py:161` | Post SC/insentif/payroll diizinkan langsung dari `calculated`/`draft`, sehingga approval bisa dilewati. |
| FIN-11 [K] | `_journal/hr_payroll.py:79,98` | JE SC & insentif bertanggal **hari ini**, bukan akhir periode (SC Agustus masuk September). Pembulatan alokasi SC tidak direkonsiliasi. |
| FIN-12 [K] | `_hr/incentive.py:108` | Basis insentif = `grand_total` (termasuk pajak & service charge), bukan revenue. |
| FIN-13 [K] | `_hr/advances.py:250` | "Mark installment paid" manual tanpa JE → piutang kasbon di GL tidak pernah turun. |
| FIN-14 [K] | `_ar/invoice.py:143` | `mark_sent` tanpa cek status/`deleted_at`: invoice **paid** kembali jadi `sent` [V]. Nomor invoice bisa dari payload (duplikat). |
| FIN-15 [K] | `_bank_recon/matcher.py:27` | Pencocokan memakai `abs(amount)`, sehingga uang masuk bisa cocok dengan uang keluar. PAY dan JE-nya sama-sama jadi kandidat (event ganda). PAY dengan WHT (gross) tak pernah cocok dengan mutasi bank (net). |
| FIN-16 [K] | `report_schedule_service.py:79-84,219-222` | Digest terjadwal membaca `daily_sales.date` / `total_revenue` / `covers`, field yang tidak ada (kanonik `sales_date`/`grand_total`) → selalu Rp 0; `to_list(10)` memotong outlet. |
| FIN-17 [K] | `_exec_drilldown/outlet_drilldown.py:45-55` | "P&L outlet" di Executive: revenue = `grand_total` (termasuk pajak & SC), COGS = `grand_total` GR (pembelian + PPN, bukan pemakaian). Hasilnya berbeda dari P&L GL. |
| FIN-18 [K] | `_hr_payroll/cycle.py:52` | Salary master hanya dimuat untuk 500 karyawan pertama (`to_list(500)`); sisanya digaji `basic_salary` tanpa tunjangan. |
| INV-01 [K] | `inventory_service.py:_assert_can_decrement` | Guard stok negatif check-then-insert tanpa lock [R]. |
| INV-02 [K] | `_hr_payroll/salary_master.py:127-137` | Import gaji: kolom `employee_code` dicocokkan ke `employees.employee_id/id/npwp` (field kode sebenarnya `code`), lalu fallback ke **regex nama tanpa escape**. "Budi" bisa cocok ke "Budiman", sehingga gaji tertimpa ke orang yang salah. Kolom tunjangan kosong menimpa jadi 0. |
| INV-03 [K] | `reward_service.py:287-330` | Redeem reward check-then-act: redeem bersamaan bisa membuat poin negatif dan stok < 0 [R]. |
| INV-04 [K] | `_reservation/crud.py` | Reservasi publik: outlet tidak divalidasi (kalau tidak ditemukan, cek kapasitas di-skip); kapasitas hanya per jam persis; form publik membuat member CRM otomatis. |

---

## C. Keamanan, RBAC & kontrol approval

| ID | Sev | Lokasi | Masalah |
|---|---|---|---|
| SEC-01 | P0 | `routers/outlet.py:517` | `/outlet/loyalty/cashier/add-points`: hanya `current_user`, nominal bebas, `order_ref` tidak idempoten, tidak terikat daily sales → fabrikasi poin. |
| SEC-02 | P1 | `routers/outlet.py:206-515` | Voucher claim/verify, lookup PII customer, dan daftar voucher customer terbuka untuk semua user login. Claim TOCTOU (bisa klaim ganda) [R]. `/vouchers/today` memakai `user.get("outlet_id")` (field tidak ada → semua outlet). |
| SEC-03 | P1 | `customer_service.py:183`, `routers/loyalty.py:161`, `core/middleware.py:167` | Akun loyalty otomatis: password awal = nomor HP. Rate-limit "login" hanya untuk `/api/auth/login`, sehingga `/api/loyalty/login-phone` bisa di-brute-force (dengan password yang mudah ditebak). |
| SEC-04 | P1 | `_approval/runtime.py`, `permissions.py:52` | Tidak ada SoD: pembuat dokumen bisa approve sendiri [V]. Satu user bisa menyetujui beberapa step berturut-turut. Step mode `role`/`user` tidak punya `any_of_perms`, sehingga **siapa pun bisa reject**. Approve diizinkan dari status `draft`. Step "Executive/GM" memakai `executive.dashboard.read` (permission baca) sebagai otoritas approval. |
| SEC-05 | P1 | `routers/approvals.py:320-383` | `/approvals/quick-action` hanya `current_user`: memanggil `budget_service.approve_budget`, leave, stock_transfer, dan ar_invoice lewat engine. Guard router asli (mis. `executive.budget.approve`, `hr.leave.approve`) terlewati. Approve leave lewat engine tidak menjalankan efek samping `leave_service`. Approve AR invoice mengeset status `approved`, yang tidak dikenal state machine AR. |
| SEC-06 | P1 | `routers/procurement.py:20-240` | Scoping outlet terbalik: filter outlet tak berizin di-set `None`, sehingga yang dikembalikan **semua outlet**. User multi-outlet tanpa filter juga melihat semua. Di list PR, user terbatas bisa mengirim `outlet_id` mana pun. `GET /prs/{id}`, `/pos/{id}`, dan export xlsx tanpa cek scope (IDOR). `create_pr`/`post_gr` tanpa cek outlet milik user. |
| SEC-07 | P1 | `routers/rfq.py:33`, `rfq_service.py:38` | Scoping memakai `user.get("role")` dan `user.get("outlet_id")`, dua field yang tidak ada di dokumen user (`role_ids`, `outlet_ids`) → kode mati, RFQ tidak pernah di-scope. |
| SEC-08 | P1 | `routers/hr.py:299-349` | Semua endpoint payroll (lihat, buat, approve, post) dijaga `hr.advance.approve`; `hr.payroll.read` di catalog tidak dipakai. Tidak ada pemisahan pembuat vs approver. |
| SEC-09 | P1 | `routers/admin.py:131`, `:214-257` | Privilege escalation: pemegang `admin.user.update` bisa memberi dirinya role SUPER_ADMIN; `admin.role.manage` bisa membuat role berisi `"*"`. `role_ids`/`outlet_ids` tidak divalidasi. |
| SEC-10 | P1 | `services/leave_service.py:107` | `create_leave` menerima `employee_id` bebas, jadi user bisa mengajukan cuti atas nama karyawan lain. Identitas user ↔ karyawan tidak terhubung (self-service memakai `users.id` sebagai `employee_id`). |
| SEC-11 | P1 | `routers/data_management.py` | RBAC paralel (`require_role` berbasis kode role). Mode `replace` memakai `drop()` sehingga **unique index hilang** sampai restart. Kategori "master" menghapus `number_series` (counter kembali ke 0 → bentrok nomor dokumen). |
| SEC-12 | P1 | `core/security.py`, `auth_service.py` | `enforce_outlet_scope` tidak pernah dipakai (scoping ad-hoc di tiap router). Rotasi refresh: `find` lalu `update` tidak atomik [R]. Ganti/reset password dan disable user tidak me-revoke refresh token. Setelah lockout berakhir, 1 salah password langsung mengunci lagi (counter tidak di-reset). |
| SEC-13 | P2 | `core/config.py:24`, `routers/loyalty.py:40` | Default secret JWT hard-coded (dan berbeda antara ERP vs loyalty); tidak ada fail-fast kalau env kosong. |
| SEC-14 | P2 | `routers/telegram.py:21` | Header `X-Telegram-Bot-Api-Secret-Token` diterima tapi tidak divalidasi. |
| SEC-15 | P2 | 30+ tempat (`payment_service`, `reward_service`, `search_service`, `master`, dst.) | `$regex` dari input user tanpa `re.escape` (risiko ReDoS; hasil pencarian salah untuk karakter khusus). |
| SEC-16 | P2 | `auth_service.py:127` | Refresh token hasil rotasi menyimpan `expires_at` sebagai string, sehingga TTL index tidak berlaku dan koleksi terus membesar. |
| RBAC | P1 | lintas | **48** kode dipakai router tapi tidak diberikan ke role mana pun (mis. `hr.read`, `admin.user.*`, `tax.efaktur.*`, `system.*`), **14** tidak ada di catalog (`admin`, `cms`, `loyalty`, `hr.read/write`, `inventory.item.*`, dst.), **40** kode catalog tidak pernah dicek (termasuk `outlet.daily_sales.create`, `inventory.opname.approve`, `finance.journal_entry.post`). FE memakai prefix `admin.users`/`admin.roles`/`admin.master_data.write`, yang tidak cocok dengan catalog `admin.user.*`/`admin.role.manage`. |

---

## D. SSOT — sumber kebenaran ganda / salah

| ID | Topik | Temuan |
|---|---|---|
| SSOT-01 | **Dokumen guardrails salah** | `memory/ENGINEERING_GUARDRAILS.md` (§RC-2) menyebut kanonik `users.password` dan `employees.active: True`, padahal kode + seed memakai `password_hash`, dan payroll/SC/dashboard HR memfilter `status: "active"` (seed kebetulan mengisi keduanya lewat `doc()`, tapi karyawan yang dibuat tanpa `status` tidak ikut payroll, lihat SSOT-20). Agent yang patuh dokumen akan mematahkan login dan payroll. **Perbaiki dokumen dulu.** |
| SSOT-02 | Payment request | Dua modul, satu koleksi (P0-04). |
| SSOT-03 | Saldo AP | `ap_ledgers.balance` (AP aging, cash position, digest) vs `goods_receipts.grand_total` tanpa `paid_amount` (Executive, `executive_service.py:142`) vs `grand_total − paid_amount` (`list_unpaid_grs`). |
| SSOT-04 | Revenue | `grand_total` (termasuk pajak + SC) di briefing/digest/executive/insentif vs revenue buckets di GL. Filter status tidak seragam: briefing `validated+submitted`, digest `validated`, tax settlement tanpa filter, report schedule field salah. |
| SSOT-05 | Dimensi outlet di JE | Auto-JE: `lines[].dim_outlet`; JE manual: `outlet_id` top-level. Budget vs Actual (`_budget/vs_actual.py:27`), `list_journals`, index `journal_entries.outlet_id` hanya melihat `outlet_id`, sehingga **actual budget per outlet/brand ≈ 0**. TB/P&L tidak memfilter sama sekali. |
| SSOT-06 | Tarif PPN (5 sumber, 2 satuan) | `core/constants.PPN_DEFAULT_RATE` (0,12) · setting `TAX_PPN_RATE` (fraksi) · setting `DEFAULT_PPN_RATE` (**persen "12"**, `SystemSettings.jsx:20`) · hard-code 0,12 di `tax_settlement.py:139,142` · FE AR dialog mengirim `ppn_rate: 0.12` per baris. AR memakai konstanta/baris dan mengabaikan setting. |
| SSOT-07 | Harga baris PR | FE/approval engine/workboard memakai `est_cost`; KDO/BDO & outlet budget guard memakai `unit_cost`. Nominal approval KDO/BDO = 0 (tier terendah). Budget guard untuk PR manual = 0 (tidak pernah memblokir kecuali ada harga market list). |
| SSOT-08 | Koleksi non-kanonik yang masih dipakai | Index: `petty_cash`, `stock_transfers`, `payroll_runs` (`core/db.py`). Approval: `stock_transfer → stock_transfers` (kanonik `transfers`, jadi approve transfer = NotFound). Data management: `payroll_runs`, `service_charge_runs`, `journal_lines`, `ap_invoices`, `periods`, `petty_cash`, `stock_transfers`, `stock_adjustments`, `loyalty_users`. "Hapus data finance" tidak menyentuh `ap_ledgers`, `ar_*`, `accounting_periods` → orphan. |
| SSOT-09 | Upload | `core/config.upload_dir=/app/uploads` (tidak dipakai), `upload_service` → `/app/uploads`, static mount + 4 router → `/app/backend/uploads`. File dari `upload_service` tidak tersaji lewat `/uploads`. Whitelist MIME & batas ukuran berbeda di 5 tempat. |
| SSOT-10 | Kas & bank | `bank_accounts` (dipakai payment, punya `gl_account_id`) vs `cash_accounts` (saldo **diinput manual**, dipakai Cash Position/briefing/digest). Pembayaran tidak mengubah `cash_accounts`, sehingga posisi kas tidak terhubung ke GL. Komentar "AR mocked-zero" sudah basi (AR ledger ada). |
| SSOT-11 | Tanggal bisnis | 81 tempat memakai `datetime.now(timezone.utc).strftime("%Y-%m-%d")`; `settings.timezone="Asia/Jakarta"` tidak pernah dipakai. Antara 00:00–06:59 WIB, "hari ini" = kemarin; di awal bulan, JE default jatuh ke periode lalu (yang mungkin sudah terkunci). `number_series` memakai `datetime.now()` naif. |
| SSOT-12 | Penomoran dokumen | `number_series.reset: monthly` tidak pernah diterapkan (counter tidak pernah reset; `{YY}{MM}` hanya teks). Leave memakai counter `count_documents + 1` sendiri (race/duplikat). SC/insentif memakai `f"SC-{period}-{code}"`. `PAY` dipakai PAY + payroll; `PR` dipakai purchase request + urgent purchase + modul payment lama. |
| SSOT-13 | Kunci idempotensi JE | `(source_type, source_id)` dipakai ulang untuk event berulang (AR receipt, depresiasi, revaluasi), lihat P0-05/06. Butuh aturan tunggal: **`source_id` = id event**, bukan id induk. |
| SSOT-14 | COA hard-coded vs `gl_mapping` | AR (`1201/1111/1001/4101/4000/4001/2110`) dan PPh21 (`2112`) melewati `gl_mapping`. Cache `gl_mapping` per-proses tanpa invalidasi lintas worker. |
| SSOT-15 | Toleransi & batas | Balance JE 0,5 / 0,01 / 0,02; `per_page` literal `le=100/200/500`; `to_list(500)` diam-diam memotong (COA di TB/P&L, unpaid GR, salary master). |
| SSOT-16 | Tanggal voucher | `claimed_at` datetime (claim outlet) vs ISO string (consume dari daily sales) → query "voucher hari ini" melewatkan yang dari daily sales. |

---

## E. Duplikasi & kode mati

| ID | Temuan |
|---|---|
| DUP-01 | `reverse_journal` 2 implementasi (FIN-02); `journal_service` dan `finance_service` mengekspor fungsi senama dengan perilaku berbeda. |
| DUP-02 | Status posting ditulis ulang di tiap modul (payroll/SC/insentif/advance/adjustment) dengan aturan berbeda (ada yang boleh dari draft, ada yang tidak). Kandidat state machine bersama. |
| DUP-03 | Scoping outlet: ±15 implementasi ad-hoc (`user.get("outlet_ids")` + cek `*`) padahal ada `enforce_outlet_scope` yang tak terpakai. |
| DUP-04 | Helper: `_now` 35×, `_parse_date` 8×, `_ser`/`serialize_doc` 7×, `_user_perms` 4×. |
| DUP-05 | Agregasi stok dari `inventory_movements`: 9 pipeline terpisah. |
| DUP-06 | Pola "resolve target kas dari payment method" disalin di `post_for_daily_sales`, `post_for_urgent_purchase`, `post_for_employee_advance`. |
| DUP-07 | 14 fasad `*_service.py` + paket `_*` (mis. `payment_runs_service` 11 baris re-export). Wajar, tapi `approval_service` mengekspor simbol privat (`_check_delegation`, `_user_matches_step`). |
| DUP-08 | 15 skrip test ad-hoc di `backend/*_test.py` + 3 di root (`backend_test.py`, `phase3_backend_test.py`) di luar pytest. |
| DUP-09 | Kode mati: `enforce_outlet_scope`, `loyalty_service.award_points_for_daily_sales` (tak lagi dipanggil), `get_open_ap_for_pr` (selalu kosong), unique index `payroll_runs`, variabel tak terpakai (`fixed_asset_service.accum`, `vendor_item_service.price_changed`, `market_list_service.last_quarter_price`, `loyalty_service.outlet_id`, `report_schedule_service.today`). |
| DUP-10 | FE: 12 formatter Rupiah lokal, 16 peta status lokal, 11 `alert()`; `DailySalesForm.jsx` (2 baris) + `DailySalesFormSteps.jsx` + `DailySalesFormPkg`. |
| DUP-11 | Async handler membuka file secara blocking (`open()` di 7 router upload), sehingga event loop tertahan saat upload. |

---

## F. Frontend

| ID | Sev | Lokasi | Masalah |
|---|---|---|---|
| FE-01 | P1 | `lib/api.js:84-93` | Refresh menyimpan `access_token` baru tapi **tidak menyimpan `refresh_token` baru**. Backend sudah me-revoke token lama (rotasi), jadi refresh berikutnya pasti `REFRESH_REVOKED` → logout paksa (±48 jam dengan TTL 24 jam). |
| FE-02 | P1 | `DailySalesFormPkg/index.jsx:209` | `voucher_discount_amount = discount_value` tanpa melihat `discount_type`; voucher 10% dihitung sebagai Rp 10. |
| FE-03 | P1 | `SystemSettings.jsx:20` vs `TaxCenterPkg` | Dua kunci tarif PPN dengan satuan berbeda (lihat SSOT-06). |
| FE-04 | P2 | `AdminHome.jsx:28`, `HRPortal.jsx:31` | Prefix permission tidak cocok dengan catalog (`admin.users` vs `admin.user.*`, `hr.read`), sehingga menu/statistik tersembunyi untuk admin non-super. |
| FE-05 | P2 | lintas | Duplikasi formatter/status/`alert()` (DUP-10). |
| FE-06 | P2 | `lib/api.js` | Token di `localStorage` (terekspos XSS). Pertimbangkan cookie httpOnly untuk refresh token. |
| — | ✅ | — | oxlint: 0 undefined symbol / rules-of-hooks / dupe-keys. Kontrak API: 0 mismatch nyata. |

---

## G. Kepatuhan pajak (perlu konfirmasi konsultan pajak)
1. **Penjualan makan-minum di restoran bukan objek PPN**, melainkan pajak daerah **PBJT makanan/minuman (dulu PB1)** ([DJP](https://www.pajak.go.id/en/node/81110), [DDTC](https://news.ddtc.co.id/berita/nasional/39211/ingat-makan-di-restoran-jadi-objek-pajak-daerah-tak-kena-ppn-11), [Ortax](https://ortax.org/pbjt-makanan-minuman)). Saat ini `daily_sales.tax_amount` diposting ke `output_vat` ("PPN Keluaran") lalu di-net dengan PPN Masukan di settlement. PBJT seharusnya punya akun utang terpisah, disetor ke Pemda, dan **tidak** dikreditkan dengan PPN Masukan. PPN Masukan atas pembelian bahan untuk penyerahan yang bukan objek PPN pada umumnya juga tidak dapat dikreditkan.
2. **Tarif PPN 12%**: sejak PMK 131/2024, barang/jasa non-mewah memakai DPP nilai lain 11/12, sehingga efektif 11% ([DJP](https://www.pajak.go.id/en/node/113453), [Ortax](https://ortax.org/resmi-pmk-131-2024-atur-ppn-12-persen-hanya-untuk-barang-mewah)). AR invoice memakai `dpp × 0.12` langsung. Label "Perpu 2/2024" di `core/constants.py` dan Tax Center juga perlu dicek ulang.
3. **PPh 21**: kode menyetahunkan gaji bulan berjalan ×12 (termasuk SC/insentif variabel) setiap bulan. Sejak 2024 (PP 58/2023) pemotongan Jan–Nov memakai **TER** dan Desember memakai tarif progresif tahunan ([ringkasan](https://www.talenta.co/blog/perhitungan-pph-21-tarif-efektif-rata-rata-ter/)). Iuran JHT/JP karyawan juga belum mengurangi penghasilan neto. Setting `TAX_PPH21_METHOD` dibaca tapi tidak dipakai.
4. **BPJS**: batas upah JP `9.559.600` hard-coded (nilai 2023; batas ini naik setiap tahun) → pindahkan ke setting yang bisa diperbarui.
5. **e-Bupot** membaca `ap_ledgers.period`/`pph23_amount` yang tidak pernah ditulis (yang terisi hanya jalur `withholding_transactions` dari payment).

---

## I. Temuan lanjutan (putaran 2: modul yang sebelumnya hanya disapu otomatis)

Putaran ini membaca penuh modul laporan & ekspor, pajak (e-Faktur/e-Bupot/tax service), dashboard eksekutif, digest, AI Q&A, forecast, periode, budget, outlet budget, daily close, KDO/BDO, payment run template, master data, import Excel, loyalty ledger, upload, rate limiter, secrets, CMS, dan frontend per portal.

### I.1 P0 tambahan

#### P0-15 [V] Trial Balance: saldo akun normal-debit bertanda terbalik
- **Lokasi**: `services/_finance/reports.py:37-41`
- **Masalah**: kode membandingkan `normal_balance == "debit"`, padahal seed COA memakai `"Dr"`/`"Cr"`. Semua akun Dr (kas, bank, persediaan, piutang, beban) dihitung `cr − dr`. Kosakata `normal_balance` sendiri terbelah tiga: seed `Dr/Cr`, import Excel memvalidasi `debit/credit`, Balance Sheet membandingkan `"Dr"`.
- **Bukti**: jurnal Dr Kas 1.000 / Cr Pendapatan 1.000 → TB menampilkan Kas **−1.000**.
- **Fix**: normalisasi (`lower()[:1] in ("d","c")`) di satu helper, lalu migrasikan data ke satu kosakata.

#### P0-16 [V] e-Faktur & e-Bupot selalu kosong; preview menghabiskan nomor faktur
- **Lokasi**: `services/efaktur_service.py:58-180`, `services/ebupot_service.py:45-90`, `models/tax.py:make_withholding_doc`
- **Masalah**:
  1. Faktur keluaran membaca `daily_sales.period`, `total_revenue`, `total_tax`, `sale_date`, keempatnya tidak ada (kanonik `sales_date`, revenue buckets, `tax_amount`).
  2. Faktur masukan membaca `goods_receipts.period` (tidak ada), `lines.unit_price` (kanonik `unit_cost`), dan PPN baris di-hard-code `× 0.12`.
  3. e-Bupot membaca `withholding_transactions.tax_type/vendor_id/dpp/rate/pph_amount/tx_date`, padahal penulisnya menyimpan `wh_type/payee_id/gross_amount/wh_rate/wh_amount`.
  4. `preview_dataset` (docstring: "no sequence increment") memanggil `next_faktur_no`, sehingga **setiap preview membakar nomor seri faktur** (celah nomor). Nomor faktur masukan juga di-generate sendiri, padahal nomor itu berasal dari vendor, dan sejak Coretax NSFP dialokasikan DJP. Sequence disimpan di koleksi `system_settings`.
- **Bukti**: sales validated + GR ber-PPN → preview keluaran 0 baris, masukan 0 baris. Setelah field lama disuntikkan ke data, preview menaikkan `EFAKTUR_SEQ_KELUARAN_2026` jadi 1.

#### P0-17 [K] Template payment run melewati approval engine
- **Lokasi**: `services/_finance/payment_run_templates.py:169-300`, `routers/payment_run_templates.py:25,59`
- **Masalah**: `auto_approve` default `True`. User yang hanya punya `finance.payment.create` bisa membuat template dan menjalankan `apply`, sehingga PAY langsung berstatus **`approved`** untuk nominal berapa pun (tier Executive/Owner di workflow terlewati) dan payment run draft ikut dibuat. Field approval yang dipakai `approvals` (bukan `approval_chain` engine). `wh_rate` template dalam **persen** (`/100`), sedangkan `payment_service`/FE PaymentForm memakai **fraksi**, sehingga satu koleksi berisi dua satuan (memo JE & e-Bupot menampilkan 200%).

### I.2 P1 tambahan — laporan & ekspor (angka salah / kosong)

| ID | Bukti | Lokasi | Masalah |
|---|---|---|---|
| RPT-01 | [V] | `_reports_excel_finance/pl_group.py:93` | Excel P&L membaca `pl["sections"]`, key yang tidak dikembalikan `profit_loss`, jadi **workbook P&L selalu kosong**. |
| RPT-02 | [V] | `_reports_excel_finance/trial_balance.py:78-115` | Excel TB membaca `type/opening/closing/opening_dr/closing_dr`, key yang tidak ada: semua baris masuk grup "OTHER", Opening & Closing selalu 0. |
| RPT-03 | [V] | `reports_excel_procurement_service.py` | Excel PO/GR summary memakai `po_no/po_date/total_amount/delivery_date/gr_no/gr_date` (kanonik `doc_no/order_date/grand_total/expected_delivery_date/receive_date`): nomor & tanggal kosong, total Rp 0, filter tanggal tidak pernah cocok. |
| RPT-04 | [V] | `reports_excel_inventory_service.py:59,231,290` | Excel stock balance/movement/valuation menjumlah `qty_change` (kanonik `qty`), sehingga **laporan kosong**. Unit cost diambil dari `items.cost`, tanpa filter `deleted_at`. |
| RPT-05 | [K] | `excel_reports_service.py:157-174` | Excel payroll membaca `total_nett` & `bpjs_tk_*`/`bpjs_kes_*` (tidak ada), sehingga nilai 0. |
| RPT-06 | [K] | `_reports_analytics/report_builder.py:113` | Report builder: split kategori memakai `ln["total"]` (kanonik `total_cost`), jadi nilai pembelian per kategori = 0. `ap_exposure` = full `grand_total` GR yang belum lunas. |
| RPT-07 | [K] | `cashflow_service.py:24-40` | Cashflow: `payment_run`, `ar_receipt`, `fixed_asset_*`, dan `tax_settlement` tidak dipetakan, sehingga masuk "Lainnya" (pembayaran vendor via payment run tidak tampil di Operasi). Investasi/Pendanaan tidak pernah terisi. Transfer antar akun kas dihitung bruto. Akun kas dideteksi lewat heuristik nama/kode. |
| RPT-08 | [K] | lintas | **P&L dihitung dengan 5 cara**: `profit_loss` (field `period` + substring kategori), `profit_walk` (`entry_date` + `type`, tanpa filter `deleted_at`, stage `service_charge/incentive/tax/opex` tidak pernah ada di COA), Net Income di Balance Sheet, P&L operasional di Executive drilldown, dan Excel P&L (kosong). |
| RPT-09 | [K] | `_journal/inventory.py`, alur inventori | Tidak ada alur pemakaian bahan/COGS. HPP hanya muncul dari varians opname negatif, sementara varians positif & adjustment plus masuk **pendapatan** (`adjustment_income`, tipe revenue). Pembelian bahan via petty cash/UP langsung ke beban `510x`, sedangkan via GR ke persediaan. Margin GL tidak sebanding antar outlet. |
| RPT-10 | [K] | `JournalList.jsx:129`, `PeriodClosingWizard.jsx:195` | FE menampilkan `doc_no` (JE manual hanya punya `je_number`, sehingga tampil UUID) dan `taxSettlement.je_number` (JE settlement hanya punya `doc_no`, sehingga kosong). Konsekuensi B1. |

### I.3 P1 tambahan — logika & kontrol

| ID | Lokasi | Masalah |
|---|---|---|
| CTL-01 | `routers/executive.py:48,64`, `routers/reports.py:47,60`, `routers/daily_sales.py:188`, `routers/outlet_budget.py:164` | Enam tempat mengecek `user["permissions"]`, padahal dokumen user dari `current_user` **tidak punya field itu**, sehingga "super" tidak pernah terdeteksi. Approver kenaikan budget hanya melihat outletnya sendiri; super admin tanpa `brand_ids` mendapat dashboard kosong. |
| CTL-02 | `routers/executive.py:12,139-200` | `/executive/home`, drilldown brand/outlet, AP aging, profit walk, dan period compare **tanpa scoping**: eksekutif yang dibatasi per brand tetap melihat semua. `kpis` multi-outlet mengabaikan filter untuk nilai persediaan. |
| CTL-03 | `services/ai_executive_qa_service.py:45-140,288` | AI Q&A hanya butuh `ai.chat.use`, tetapi tool-nya mengembalikan data keuangan seluruh perusahaan (KPI, AP aging, drilldown outlet mana pun). `_load_session` tidak mengecek pemilik, sehingga `session_id` orang lain bisa dibaca dan ditimpa. Endpoint `/executive/qa` (LLM) tidak masuk bucket rate-limit `ai`. |
| CTL-04 | `services/owner_digest_service.py:352`, `services/_scheduler/registry.py` | `send_digest_to_all_subscribers` ("scheduler entry point") **tidak pernah didaftarkan** ke scheduler, jadi digest harian 06:00 yang dijanjikan bot Telegram tidak pernah terkirim. `schedule_cron` per langganan tidak dipakai. "Kemarin" dihitung dalam UTC: pada 06:00 WIB hasilnya **2 hari lalu**. |
| CTL-05 | `services/report_schedule_service.py:430` | `run_due_schedules` **tidak pernah dipanggil**, sehingga laporan terjadwal tidak pernah jalan. Kalaupun dipanggil, `run_time` (WIB) dibandingkan dengan jam server UTC (selisih 7 jam), dan payload digest-nya membaca field yang salah (FIN-16). |
| CTL-06 | `_outlet_budget/actuals.py:29` vs `procurement_service.py:205` | Actual budget outlet menghitung status `converted_to_po`, padahal `create_po` mengeset `converted`. Begitu PR dikonversi ke PO, nilainya **hilang dari actual**, sehingga budget bisa dipakai ulang. |
| CTL-07 | `_budget/crud.py:116`, `_budget/approval.py:unlock_budget`, `_budget/vs_actual.py` | Budget yang approved/locked bisa dihapus. `unlock` tanpa cek status (draft bisa jadi approved). Tidak ada keunikan budget per scope+periode, jadi vs-actual menjumlah beberapa dokumen, termasuk `submitted` dan fallback ke draft. |
| CTL-08 | `_period/transitions.py:59-72`, `_period/checks.py` | Close periode: kegagalan JE settlement pajak ditelan lalu periode tetap ditutup. Sales yang belum divalidasi hanya "warn", dan setelah close sales itu tidak bisa divalidasi. Lock tidak kumulatif (periode lebih lama yang masih open tetap bisa diposting). Periode dibuat otomatis untuk tanggal apa pun (typo 2062 membuka periode baru). |
| CTL-09 | `routers/master.py` | Master data generik: **baca terbuka untuk semua user login**, termasuk gaji karyawan & rekening bank. Payload tanpa skema. `number_series` bisa diedit (reset counter → nomor bentrok). COA bisa di-soft-delete walau sudah diposting (saldo hilang dari TB → TB tidak balance). `type`/`normal_balance` COA bisa diubah setelah ada jurnal. |
| CTL-10 | `portals/admin/MasterData.jsx:50-64` | Form karyawan **tidak punya `outlet_id`**, sehingga karyawan baru tidak ikut payroll per-outlet maupun alokasi service charge. Status `leave` (Cuti) mengeluarkan karyawan dari payroll (tidak digaji). Gaji tersimpan di dua tempat (`employees.basic_salary` & `salary_masters`). |
| CTL-11 | `services/excel_import_service.py` | Import Excel: COA ditulis ke koleksi **`coa`** (legacy) dengan field `account_code/account_name/account_type`, sehingga tidak terlihat di `chart_of_accounts`. Karyawan diimpor dengan `name/salary/nik`, unik per email, tanpa `code/full_name/status/outlet_id`, sehingga tidak ikut payroll. Item memakai `category` (string) dan bukan `category_id`. |
| CTL-12 | `routers/kdo_bdo.py:28`, `kdo_bdo_service.py:24` | List KDO/BDO/FDO menerima `outlet_id` apa pun tanpa cek scope; user tanpa outlet melihat semua outlet. Create meneruskan `{**payload}` ke `create_pr`, jadi mass-assignment status juga berlaku (P0-11). |
| CTL-13 | `services/customer_service.py:227`, `loyalty_service.py:17`, `reward_service.redeem_reward` | Ledger loyalty: transaksi di-insert **sebelum** saldo dicek & diubah (baca-ubah-tulis). Kalau poin tidak cukup, transaksi yatim tetap tercatat. Redemption di-insert sebelum poin dipotong, jadi kegagalan menghasilkan voucher gratis. Penyesuaian admin positif dicatat sebagai `earn`, sehingga lifetime points & tier ikut naik. `customers.total_points` bisa berbeda dari jumlah `loyalty_transactions` [R]. |
| CTL-14 | `portals/procurement/GRForm.jsx:64-90` | Prefill GR dari PO: `tax_rate` PO tidak dibawa (default 0), sehingga AP & jurnal tanpa PPN. `qty_received` diisi **qty PO penuh**, bukan sisa setelah GR sebelumnya, sehingga penerimaan parsial kedua otomatis over-receipt. PO dicari dari 100 PO pertama (`per_page:100`); untuk PO lama prefill gagal diam-diam. |
| CTL-15 | `portals/inventory/OpnameSession.jsx:43`, 53 panggilan `per_page: 100/200/500` | Pola "ambil list lalu `.find(id)`" (opname: 50 terakhir) dan dropdown master dibatasi 100–500 → data lama/ekor list hilang tanpa pesan. |

### I.4 Keamanan tambahan

| ID | Sev | Bukti | Lokasi | Masalah |
|---|---|---|---|---|
| SEC-17 | P1 | [V] | `core/middleware.py:133-178` | **Rate limiter bisa dimatikan dari klien.** Header `X-Forwarded-For: 127.0.0.1` masuk `BYPASS_IPS` (semua limit dilewati); XFF yang diganti-ganti mem-bypass bucket login; bucket API dikunci dengan 16 karakter terakhir header Bearer (header acak = bucket baru). Store in-memory per proses. Bukti: limit login 3/menit → 6/6 request lolos dengan XFF 127.0.0.1 maupun XFF acak. |
| SEC-18 | P2 | [K] | `core/secrets.py` | Kunci enkripsi auto-generate di `/app/.app_secret`. Kalau file hilang (container baru), semua secret didekripsi menjadi `None` tanpa error keras; kegagalan enkripsi menyimpan plaintext. |
| SEC-19 | P2 | [K] | `services/upload_service.py:139-157` | `content_type` kosong melewati whitelist MIME & magic bytes, dan ekstensi diambil dari nama file. Cek akses lampiran longgar: siapa pun dengan permission berawalan domain (mis. `finance.*`) bisa membaca lampiran domain itu. |
| SEC-20 | P2 | [K] | `components/shared/PageSEO.jsx:273` | JSON-LD disisipkan dengan `JSON.stringify` tanpa escape `</`; isi SEO dari admin CMS bisa menutup tag `<script>` (stored XSS oleh admin CMS). |
| SEC-21 | P2 | [K] | `routers/crm_analytics.py` | `require_perm("admin","loyalty")`, dua kode yang tidak ada di catalog dan harus dimiliki keduanya, sehingga hanya super admin yang bisa membuka CRM analytics. |

### I.5 SSOT & duplikasi tambahan

| ID | Temuan |
|---|---|
| SSOT-17 | `normal_balance` 3 kosakata (P0-15). |
| SSOT-18 | Satuan `wh_rate` fraksi vs persen di koleksi `payment_requests` & `withholding_transactions` (P0-17). |
| SSOT-19 | Status PR `converted` vs `converted_to_po` (CTL-06). |
| SSOT-20 | Karyawan punya dua flag aktif: `seed doc()` mengeset `active: True` di semua dokumen, sementara kode payroll memfilter `status: "active"`. Guardrails menyebut `active: True`. Tetapkan satu (lihat SSOT-01). |
| SSOT-21 | Aturan poin loyalty: FE `Math.round(base × multiplier)` vs BE `int(...)` (preview kasir ≠ poin tercatat); FE tidak punya tier `platinum`. `PTKP_OPTIONS` disalin 3× di FE. |
| SSOT-22 | Service charge: kebijakan `service_charge_pct` di business rules tidak dipakai daily sales (SC diinput manual). |
| DUP-12 | Excel Market List: kolom PREVIOUS PRICE & VARIANCE selalu kosong (`last_quarter_price` dihitung lalu dibuang). |
| DUP-13 | Forecast guard: `_period_bounds` memakai tanggal 1 bulan berikutnya sebagai batas **inklusif**, sehingga untuk periode lampau ikut menghitung satu hari bulan berikutnya. |
| DUP-14 | Daily close: slip setoran boleh lampiran mana pun (tidak terikat outlet/tanggal); close tidak membekukan sales hari itu; reopen = soft delete record. |

---

## H. Urutan perbaikan yang disarankan

**Fase 2b-1 — hentikan kebocoran (1–2 hari)**
P0-12, SEC-01, SEC-05 (guard permission pada approve/quick-action/add-points) · P0-11 (abaikan `status`/`skip_budget_check` dari payload) · P0-04 (matikan endpoint mark-paid modul lama) · P0-17 (`auto_approve` template default `False` + lewat approval engine) · SEC-17 (hapus bypass XFF, pakai IP dari proxy tepercaya) · FE-01 (simpan refresh token baru).

**Fase 2b-2 — koreksi posting GL & laporan (4–6 hari)**
P0-15 (kosakata `normal_balance`) · P0-16 (e-Faktur/e-Bupot baca field kanonik, preview tanpa nomor) · RPT-01…05 (ekspor Excel) · P0-01/02/03 (payroll) · P0-05/06 + SSOT-13 (aturan `source_id` = id event) · P0-14 · FIN-07/08 (`$inc` + update kondisional + idempotensi `payment_id`) · P0-13 (settlement dari saldo GL) · SSOT-05 (satu dimensi outlet) lalu P0-09 dan Budget vs Actual.

**Fase 2b-3 — integritas dokumen (3–5 hari)**
P0-07/08/10 (validasi GR vs PO, qty > 0, opname vs on-hand saat submit, atomisitas lewat MongoDB transaction atau outbox) · FIN-03/04/05/06 · FIN-10 (state machine posting bersama).

**Fase 2c — SSOT & kebersihan**
SSOT-01 (perbaiki guardrails) · SSOT-06/07/08/09/10/11/12 · RBAC (grant + sinkron catalog FE/BE, SoD di engine) · duplikasi §E.

> **Catatan jurnal historis**: setelah P0-01/02/05/06 diperbaiki, data lama perlu jurnal koreksi (AR receipt yang hilang, depresiasi bulan ke-2+, payroll yang dobel), bukan hanya fix kode ke depan.

---

## Lampiran A — Skrip reproduksi
File `audit_verification_scripts.zip` (terpisah). Skrip memanggil service asli di atas MongoDB in-memory (`mongomock-motor`) tanpa menyentuh DB nyata. Jalankan dengan `ERP_BACKEND=/app/backend python3 t_payroll.py`, dst. Setelah perbaikan, output tiap skrip harus berubah ke perilaku yang benar; skrip ini bisa dijadikan regression test pytest.

| Skrip | Output aktual (bukti) |
|---|---|
| t_payroll | `Journal tidak balance: Dr=4000000.0, Cr=3840000.0 (diff=160000.0)` |
| t_payroll2 | JE payroll 4.500.000 termasuk SC 500 rb; payroll kedua & all-outlet tetap dibuat |
| t_pay | legacy mark-paid → `paid`, JE 0, AP tetap 1.000.000, open-AP 0 baris |
| t_ar | 2 receipt (1 jt) → 1 JE (400 rb); invoice paid → `sent` |
| t_fa | akumulasi 3 jt, JE depresiasi 1 |
| t_inv | GR atas PO cancelled diterima, PO → `received`; GR −5.000; transfer −5 → o1 +5 / o2 −5; TB outlet fiktif = TB total |
| t_opn | fisik 150 → sistem 250 setelah retry |
| t_pr | PR dibuat dengan status `approved`, chain kosong |
| t_adv | kasbon `repaying` + JE oleh user tanpa izin HR |
| t_reports | TB: Kas −1.000 (harusnya +1.000); `profit_loss` tanpa key `sections` → Excel P&L 0 sel angka; Excel TB baris "OTHER", Opening/Closing 0 |
| t_tax | preview e-Faktur 0 baris keluaran & masukan; setelah field lama disuntikkan, preview menaikkan sequence faktur |
| t_excel | Excel PO/GR: nomor & tanggal kosong, total 0,0; Excel stock balance tanpa baris |
| t_ratelimit | limit login 3 → IP sama: 3×200 lalu 429; XFF acak 6×200; XFF 127.0.0.1 6×200 |

## Lampiran B — Alat
ruff 0.15 (F, B, ASYNC, PLE) · Starlette TestClient (middleware) · oxlint (correctness) · `scripts/audit_fe_be_contract.py` · skrip AST untuk guard router · skrip silang permission (router × catalog × seed) · harness mongomock.
