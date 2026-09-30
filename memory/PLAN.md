# PLAN — Tindak lanjut AUDIT_2026-09-27_PHASE2
Repo: `pandeyoga/ERPFNB` @ `1dc4112` → dilanjutkan 2026-09-28 · Sumber: `/app/memory/AUDIT_2026-09-27_PHASE2.md`

## 0. Metode validasi
1. 13 skrip reproduksi dari auditor (`/app/tests/audit_regression/t_*.py`) dijalankan terhadap kode **asli**. Semua 13 mereproduksi temuannya, jadi temuan [V] **terkonfirmasi**.
2. Temuan [K] divalidasi dengan membaca jalur kode yang disebut auditor. Semua yang dikerjakan di Fase 2b terbukti benar.
3. Setelah diperbaiki, perilaku yang benar dikunci dengan regression test pytest `tests/audit_regression/test_audit_fixes.py` (13 test, **13 PASS**):
   `cd /app/tests/audit_regression && ERP_BACKEND=/app/backend python -m pytest -q test_audit_fixes.py`
4. Smoke test ke API live: legacy payment-request → 410, quick-action tanpa izin → 403, add-points tanpa `order_ref` → 400, TB/P&L OK (TB balance), list PR outlet lain oleh outlet manager → 403.

Legenda: ✅ Diperbaiki · 🟡 Sebagian · ⏳ Direncanakan (fase) · 🔍 Perlu konsultan pajak · ✔️ Valid, tidak perlu aksi

---

## 1. P0 (17): semua sudah ditangani
| ID | Validasi | Status | Perbaikan |
|---|---|---|---|
| P0-01 | [V] terkonfirmasi | ✅ | JE payroll: Cr Utang Gaji = take_home − variabel; ada baris Utang BPJS (karyawan+perusahaan) dan Dr Beban BPJS perusahaan; PPh21 lewat `gl_mapping.withholding_pph21`. COA 2115/5413 + mapping dibuat otomatis saat startup (`gl_mapping.ensure_default_accounts`). |
| P0-02 | [V] | ✅ | Porsi SC/insentif tidak dibiayakan lagi (sudah di Utang Gaji). |
| P0-03 | [V] | ✅ | Cek duplikat juga mencakup `posted` dan tumpang-tindih ALL vs per-outlet. Unique index dipindah ke `payroll_cycles`. `to_list(500)` dihapus (FIN-18). |
| P0-04 | [V] | ✅ | Modul lama dipensiunkan: endpoint tulis `/api/finance/payment-requests/*` → **410**. UI: tab/route lama diarahkan ke modul Payments. |
| P0-05 | [V] | ✅ | `source_id = receipt.id`; akun lewat `gl_mapping` / `bank_accounts.gl_account_id`; JE gagal = transaksi gagal (A6). Receipt hanya untuk invoice sent/partial/overdue. |
| P0-06 | [V] | ✅ | `source_id = asset:period` (disposal/revaluasi punya id event); straight-line di-cap ke nilai sisa. |
| P0-07 | [V] | ✅ | GR divalidasi terhadap PO: status approved/sent/partial, vendor & outlet sama, qty > 0, sisa per baris (anti over-receipt), harga/pajak/diskon dari PO (A4). Status PO dihitung per baris (A2). JE dibuat dulu lalu kompensasi jika gagal (A5). AP menyimpan `ppn_amount`/`dpp_amount`/`period`. |
| P0-08 | [V] | ✅ | Transfer: qty > 0; `unit_cost` dihitung server dari outlet asal. |
| P0-09 | [V] | ✅ | TB & P&L memfilter outlet (`lines.dim_outlet` atau `outlet_id` JE manual). `_post_journal` kini mengisi `outlet_id`/`brand_id` top-level (SSOT-05). |
| P0-10 | [V] | ✅ | Varians = counted − on-hand **saat submit**; urutan JE → klaim status atomik → movement (retry aman); cek period lock; item tanpa histori bisa ditambahkan. |
| P0-11 | [V] | ✅ | Status PR hanya draft/submitted dari server; `skip_budget_check` klien diabaikan; `create_po` hanya menerima PR `approved`. |
| P0-12 | [V] | ✅ | Approve/reject kasbon wajib `hr.advance.approve` (router + service) dan SoD; approve harus dari status submitted. |
| P0-13 | [K] valid | ✅ | Settlement PPN membaca **saldo GL** `input_vat`/`output_vat` per periode (SSOT = GL). Hard-code 0,12 dihapus. |
| P0-14 | [K] valid | ✅ | JE PPh gagal → seluruh run dibatalkan (JE yang sudah terposting di-void, tidak ada PAY yang paid). Link JE per PAY benar. Settlement AP tidak lagi ditelan. |
| P0-15 | [V] | ✅ | Helper `is_debit_normal()` (Dr/debit/D) dipakai di TB, P&L, Balance Sheet. |
| P0-16 | [V] | ✅ | e-Faktur memakai field kanonik (`sales_date`, revenue buckets, `tax_amount`, `unit_cost`, `tax_amount` baris). Preview **tidak** membakar nomor. Faktur masukan memakai nomor vendor (`invoice_no`). e-Bupot membaca `wh_type/payee_id/gross_amount/wh_rate/wh_amount`. |
| P0-17 | [K] valid | ✅ | `auto_approve` template dipaksa `False` (PAY dibuat `submitted` → approval engine). `wh_rate` disimpan sebagai fraksi (legacy persen dikonversi). |

## 2. Status temuan Fase 1 (A1–D)
| ID | Status | Catatan |
|---|---|---|
| A1 | 🟡 | P0-04 & FIN-07 selesai; SSOT-03 (AP Executive) ⏳ 2c |
| A2 | ✅ | Status PO per baris, PO cancelled tidak bisa "hidup" lagi |
| A3 | ✅ | FE persen (FE-02) + diskon dihitung ulang di server, voucher diklaim atomik saat validate (FIN-03) |
| A4 | ✅ | Pajak/diskon GR dari PO; `discount_total` PO dihitung |
| A5 | ✅ | GR: JE dulu + kompensasi; opname: klaim atomik |
| A6 | ✅ | Kegagalan JE AR tidak lagi ditelan |
| A7 | 🟡 | `_post_journal` pakai satu toleransi 0,01; toleransi lain (laporan/ap) ⏳ 2c |
| A8 | ✅ | Biaya transfer = rata-rata bergerak di outlet asal; JE Dr In-Transit/Cr Persediaan (kirim) & sebaliknya (terima); status diklaim atomik |
| A9 | ✅ | Diganti oleh perbaikan payroll P0-01/02 |
| B1 | 🟡 | JE manual kini juga punya `doc_no`; JE auto punya `outlet_id`; migrasi data lama ⏳ 2c |
| B2 | 🟡 | Settlement PPN = GL; 5 sumber tarif ⏳ 2c (SSOT-06) |
| B3/B4/B5/B6 | ⏳ 2c | Number series, grant permission, constants, upload config |
| C1–C3 | ✔️ | Sudah beres di Fase 2a |
| C4/D | ⏳ 2c | `alert()`, duplikasi helper |

## 3. B. Logika keuangan & operasional (P1)
| ID | Status | Catatan |
|---|---|---|
| FIN-01 | ✅ | Periode JE manual dari `entry_date`; validasi baris (dr/cr negatif/ganda); COA non-postable ditolak |
| FIN-02 | ✅ | `_journal/core.reverse_journal` kini delegasi ke satu implementasi `_finance.journals` |
| FIN-03 | ✅ | Diskon voucher dihitung server (persen/fixed + cap), satu voucher = satu daily sales, klaim atomik sebelum JE |
| FIN-04 | ✅ | Daily sales baru ditolak kalau sudah ada submitted/validated (unique index ⏳) |
| FIN-05/06 | ✅ | Pembelian PC wajib GL; replenish/adjustment (±) butuh approval + SoD + JE; UP butuh izin approve, SoD, semua item ber-GL, UP PETTY mengurangi subledger |
| FIN-07 | ✅ | AP settlement: `$inc` kondisional, idempoten per `payment_id`, overpayment ditolak |
| FIN-08 | ✅ | mark-paid: klaim status `approved→paying` atomik, rollback jika gagal |
| FIN-09 | ✅ | `gr_id` harus milik vendor payee, jumlah ≤ sisa hutang (dikurangi PAY lain yang terbuka), debit wajib AP; `wh_amount` 0 ≤ x < amount |
| FIN-10 | ✅ | SC/insentif/payroll hanya bisa diposting dari `approved` (+SoD payroll) |
| FIN-11 | ✅ | JE SC/insentif bertanggal akhir periode |
| FIN-12 | ✅ | Basis insentif = revenue buckets (tanpa pajak & SC) |
| FIN-13 | ✅ | Cicilan kasbon manual memposting JE Dr Kas / Cr Piutang |
| FIN-14 | ✅ | `mark_sent` hanya dari draft |
| FIN-15 | ✅ | Pencocokan bank recon memakai tanda; PAY dicocokkan net WHT; JE milik PAY tidak jadi kandidat ganda |
| FIN-16 | ⏳ 2c | Field digest report schedule |
| FIN-17 | ⏳ 2c | P&L outlet Executive → GL |
| FIN-18 | ✅ | Bagian dari P0-03 |
| INV-01/03 | 🟡 | INV-03 ✅ (stok reward & poin dengan `$inc` kondisional). INV-01: kirim/terima transfer & opname memakai klaim status atomik; guard stok negatif lintas dokumen tetap butuh transaksi Mongo (replica set) |
| INV-02 | ✅ | Cocokkan `code`/id/nik/npwp; nama hanya exact & unik (regex di-escape); sel tunjangan kosong tidak menimpa jadi 0 |
| INV-04 | ⏳ 2c | Reservasi publik |

## 4. C. Keamanan, RBAC & approval
| ID | Status | Catatan |
|---|---|---|
| SEC-01 | ✅ | add-points: `loyalty.transaction.create`, `order_ref` wajib & unik, batas nominal (`LOYALTY_CASHIER_MAX_AMOUNT`) |
| SEC-02 | ✅ | Lookup customer/voucher/claim/today butuh izin loyalty; klaim atomik; `/vouchers/today` memakai `outlet_ids` |
| SEC-03 | 🟡 | Password awal akun loyalty acak (bukan no. HP); `/api/loyalty/login*` masuk bucket rate limit login |
| SEC-04 | ✅ | Engine: SoD (pembuat ≠ approver, satu user satu step), approve tidak dari draft, reject mode role/user dicek |
| SEC-05 | ✅ | quick-action memakai permission yang sama dengan endpoint asli; stock_transfer/ar_invoice ditolak |
| SEC-06 | ✅ | Scoping outlet list PR/PO/GR tidak lagi melebar; IDOR `GET /prs/{id}`, `/pos/{id}`; create PR/post GR dicek scope |
| SEC-07 | ✅ | RFQ di-scope berdasarkan permission + `outlet_ids` |
| SEC-08 | ⏳ 2c | Permission payroll terpisah (butuh grant seed) |
| SEC-09 | ✅ | Tidak bisa memberi role/permission melebihi hak sendiri, tidak bisa mengubah role sendiri, id divalidasi |
| SEC-10 | ✅ | Cuti atas nama karyawan lain butuh izin HR (kecuali karyawan milik user sendiri) |
| SEC-11 | ✅ | `delete_many` (indeks tetap ada), `number_series` tidak ikut dihapus |
| SEC-12 | ✅ | Rotasi refresh atomik; reset/ganti password & disable me-revoke semua refresh token; counter lockout di-reset |
| SEC-13 | ✅ | `JWT_SECRET` wajib dari `.env` (fail-fast), ERP & loyalty satu secret |
| SEC-14 | ✅ | Webhook Telegram memvalidasi `TELEGRAM_WEBHOOK_SECRET` (jika diset) |
| SEC-15 | ✅ | `re.escape` di semua `$regex` dari input user (19 file) |
| SEC-16 | ✅ | `expires_at` refresh token rotasi = datetime (TTL berlaku) |
| SEC-17 | ✅ | Bypass XFF dihapus; IP diambil dari sisi kanan XFF (hop proxy tepercaya, `TRUSTED_PROXY_HOPS`); bucket API dikunci ke `sub` JWT terverifikasi |
| SEC-18..21 | ⏳ 2c | secrets key, upload MIME kosong, JSON-LD escape, CRM perms |
| RBAC | 🟡 | 7 kode ditambah ke catalog; `services/rbac_sync.py` (jalan saat startup) memberi 25 permission yatim ke role terkait. `admin.*`/`system.*` sengaja hanya SUPER_ADMIN |

## 5. D. SSOT
| ID | Status | Catatan |
|---|---|---|
| SSOT-01 | ✅ | `ENGINEERING_GUARDRAILS.md` dikoreksi (`password_hash`, `status:"active"`) + addendum aturan baru |
| SSOT-02 | ✅ | = P0-04 |
| SSOT-05 | 🟡 | JE baru punya `outlet_id`; Budget vs Actual & backfill data lama ⏳ 2c |
| SSOT-07 | 🟡 | Actual outlet budget memakai `unit_cost` atau `est_cost` |
| SSOT-11 | ✅ | 45 tanggal bisnis di 26 file kini memakai `core.clock` (WIB) |
| SSOT-13 | ✅ | Aturan `source_id = id event` (AR, FA, cicilan kasbon) |
| SSOT-14 | 🟡 | AR & PPh21 lewat `gl_mapping`; invalidasi cache lintas worker ⏳ |
| SSOT-15 | 🟡 | `to_list(500)` di TB/P&L/payroll dihapus |
| SSOT-17/18/19 | ✅ | normal_balance helper · wh_rate fraksi · status `converted` dihitung |
| SSOT-03/04/06/08/09/10/12/16/20/21/22 | ⏳ 2c | |

## 6. E. Duplikasi & F. Frontend
| ID | Status |
|---|---|
| DUP-01..14 | ⏳ 2c (DUP-03: helper `scoped_outlet_ids`/`enforce_outlet_scope` kini dipakai di procurement; DUP-09: unique index `payroll_runs` dihapus) |
| FE-01 | ✅ Refresh token baru disimpan |
| FE-02 | ✅ Voucher persentase dihitung dari revenue |
| FE-03/04/05/06 | ⏳ 2c |
| CTL-14 (GRForm) | ✅ Prefill qty = sisa, PO diambil langsung jika tidak ada di 100 pertama, tax_rate dibawa |

## 7. G. Pajak: 🔍 perlu keputusan konsultan
PBJT/PB1 vs PPN (akun utang terpisah), DPP 11/12, PPh21 TER, batas upah BPJS JP ke setting, e-Bupot dari AP. **Tidak diubah** sampai ada konfirmasi konsultan pajak (perubahan akun & tarif berdampak hukum).

## 8. I. Temuan lanjutan
| ID | Status |
|---|---|
| RPT-01 | ✅ `profit_loss` mengembalikan `sections`; Excel P&L terisi |
| RPT-02 | ✅ TB mengembalikan `type/opening/closing` + totals opening/closing |
| RPT-03 | ✅ Excel PO/GR memakai field kanonik |
| RPT-04 | ✅ Excel stok menjumlah `qty`, filter `deleted_at`, valuasi rata-rata dari movement |
| RPT-05 | ✅ Excel payroll memakai `total_take_home`, `total_bpjs_*`, `total_pph21` |
| RPT-06..10 | ⏳ 2c |
| CTL-01 | ✅ `current_user` mengisi `user["permissions"]` (6 router ikut benar) |
| CTL-04 | ✅ Job `owner_digest` 06:00 WIB didaftarkan; "kemarin" dihitung dalam WIB |
| CTL-05 | ✅ Job `report_schedules` tiap menit, jam WIB |
| CTL-06 | ✅ Status `converted` ikut dihitung di actual |
| CTL-07/08/09/12/13 | ✅ | CTL-07: budget approved/locked tak bisa dihapus, unlock hanya dari locked, vs-actual hanya 1 budget approved. CTL-08: sales belum divalidasi = blocker, periode ditutup berurutan, gagal settlement membatalkan close, tanggal > 1 tahun ke depan ditolak. CTL-09: baca bank/number-series butuh izin, data sensitif karyawan disamarkan, COA yang sudah berjurnal tak bisa dihapus/diubah tipenya, counter number series tak bisa diturunkan. CTL-12: scope KDO/BDO. CTL-13: ledger loyalty atomik, penyesuaian admin bukan `earn` |
| CTL-10 | ✅ | Outlet wajib; karyawan `leave` (Cuti) tetap digaji; Salary Master = satu-satunya sumber gaji (migrasi otomatis saat startup, field gaji di employees dihapus & ditolak API, form karyawan read-only) |
| CTL-02/03/11/15 | ⏳ 2c | Scoping executive/AI Q&A, import Excel, pola `per_page` |

---

## 9. Roadmap sisa
**Fase 2b-3: integritas dokumen (berikutnya, ±3–5 hari)**
FIN-03 (re-validasi voucher di server), FIN-05/06 (petty cash & UP → JE), FIN-09, FIN-12, FIN-15, SEC-02, INV-02, CTL-07 (budget), CTL-08 (close periode), CTL-09 (master data read/COA lock), CTL-12/13, A8 (valuasi & JE transfer), unique index daily sales.

**Fase 2c: SSOT & kebersihan (±5–7 hari)**
RBAC catalog/seed/FE sync + permission payroll · SSOT-03/04/06/08/09/10/12 · sweep tanggal WIB (81 tempat) · `re.escape` $regex · RPT-06..10 · FE-03..06 · duplikasi §E · FIN-02, FIN-16/17 · CTL-02/03 (scoping executive & AI Q&A).

**Jurnal koreksi historis (wajib sebelum go-live)**
Skrip one-off untuk data lama: AR receipt ke-2+ yang tidak punya JE, depresiasi bulan ke-2+, payroll dobel/SC ganda, AP GR lama tanpa `ppn_amount`. Perlu review finance sebelum dijalankan.

## 10. Tambahan: upload file → Emergent Object Storage
Upload lama disimpan di disk pod (hilang saat deploy). Sekarang upload CMS, media library + varian, gambar/PDF menu, gambar loyalty, dan lampiran (`/api/uploads`) masuk ke object storage (`core/object_storage.py`).
- Aset publik disajikan lewat `GET /api/files/{path}`.
- Lampiran privat tetap lewat `GET /api/uploads/{id}` (dengan auth).
- File lama di `/uploads` masih bisa dibaca (legacy).

## 11. Konfigurasi baru (.env / env)
- `JWT_SECRET` (**wajib**, sudah ditambahkan ke backend/.env)
- `EMERGENT_LLM_KEY` (object storage, sudah ditambahkan)
- Opsional: `TRUSTED_PROXY_HOPS` (default 1), `RATE_LIMIT_BYPASS_LOOPBACK` (default false), `LOYALTY_CASHIER_MAX_AMOUNT` (default 50.000.000), `TELEGRAM_WEBHOOK_SECRET`


## 12. Iterasi 2 (lanjutan) — 2026-09-28
- Fase 2b-3 selesai (lihat status baris di atas). Regression suite `tests/audit_regression/test_audit_fixes.py`: **18 PASS**.
- Koreksi data historis: `cd /app/backend && python -m scripts.audit_data_correction` (dry-run) / `--apply`. Hanya AR receipt tanpa JE yang di-auto-fix; celah penyusutan, payroll logika lama, petty cash tanpa JE, dan payroll ganda **dilaporkan** untuk jurnal koreksi yang direview Finance. Dry-run pada data demo: 25 aset dengan selisih penyusutan, 28 petty cash tanpa JE.
- Sisa: CTL-02/03/10/11/15, SEC-08/18..21, SSOT-03/04/06/08..10/12/16/20..22, RPT-06..10, FE-03..06, DUP-*, INV-04, FIN-16/17. Pajak (PBJT/PPN, TER) menunggu konsultan.

- 2026-09-28: Petty cash — tombol 'Transaksi Baru' pada mode Semua Outlet membuka dialog pilih outlet.


## 13. Iterasi 3 — Analisis gap (kedalaman & keandalan), 2026-09-28
Fokus: mempertajam fitur yang sudah ada, bukan menambah modul. Regression suite: **24 PASS** (6 test baru).

| ID | Temuan | Dampak | Status |
|---|---|---|---|
| GAP-01 | Payroll, Service Charge, Insentif: backend mewajibkan `approved` sebelum post (FIN-10), tapi UI tidak punya tombol Approve → alur macet di UI | P0 | ✅ Tombol Approve/Post sesuai status di list & detail |
| GAP-02 | Post payroll/SC/insentif tidak atomik → double click bisa menandai cicilan kasbon / ledger L&B dua kali | P0 | ✅ Klaim status `approved→posting` atomik + rollback bila JE gagal; ledger L&B idempoten |
| GAP-03 | Payroll draft salah tidak bisa dibatalkan, dan cek duplikat memblokir generate ulang | P1 | ✅ `POST /api/hr/payroll/{id}/cancel` (draft/approved, alasan wajib) + tombol Batalkan |
| GAP-04 | SC/insentif di-post setelah payroll dibuat → porsi karyawan diakru di Utang Gaji tapi tidak pernah dibayar | P1 | ✅ Snapshot `source_refs`; approve/post payroll ditolak bila berubah. SC/insentif ditolak di-post jika payroll periode itu sudah approved/posted |
| GAP-05 | Post payroll menandai lunas SEMUA kasbon karyawan periode itu, termasuk kasbon yang disetujui setelah payroll dibuat (tidak dipotong) | P1 | ✅ `advance_lines` per karyawan; hanya baris itu yang ditandai; cicilan yang sudah dibayar tunai → post ditolak; bayar tunai ditolak jika sudah dijadwalkan di payroll |
| GAP-06 | Cicilan kasbon > gaji bersih → take-home negatif | P1 | ✅ Tidak dipotong periode itu + peringatan di payroll |
| GAP-07 | Karyawan tanpa Salary Master ikut payroll dengan gaji 0 secara diam-diam | P1 | ✅ Generate diblokir dengan daftar nama |
| GAP-08 | Karyawan yang join setelah periode ikut payroll; insentif dialokasikan ke karyawan terminated | P2 | ✅ Filter `join_date`; alokasi insentif hanya karyawan aktif/cuti (`excluded_employee_ids`) |
| GAP-09 | Tidak ada user demo HR → SoD payroll tidak bisa diuji | P2 | ✅ `hr.manager@` & `hr.officer@` di seed |
| GAP-10 | Payroll N+1 query (SC/insentif/kasbon per karyawan) | P2 | ✅ Diambil sekali per run |

**Sisa / butuh keputusan**
- Proporsional gaji karyawan yang join/keluar di tengah bulan (pro-rata) — perlu kebijakan HR.
- SoD untuk approve SC/insentif (saat ini hanya payroll) — perlu keputusan apakah pembuat boleh approve.
- SC untuk karyawan Cuti: alokasi SC tetap hanya karyawan aktif (berbasis hari kerja).
- Budget `unlock` & RFQ `cancel` ada di backend tapi belum ada tombol UI.
- Item Fase 2c di atas (SEC-08 permission payroll terpisah, SSOT-*, RPT-06..10) belum dikerjakan.

## 14. Iterasi 4 — Penutupan temuan AUDIT_2026-09-27_PHASE2 (2026-09-28)
Input user (`memory/audit_inputs/AUDIT_2026-09-27_PHASE2_1.md` + `audit_verification_scripts_1.zip`) **identik** dengan `memory/AUDIT_2026-09-27_PHASE2.md` & `tests/audit_regression/t_*.py` (diverifikasi `diff`). Regression suite: **28 PASS**.

| ID | Status | Perbaikan |
|---|---|---|
| A1 / SSOT-03 | ✅ | AP Executive & cash position = saldo `ap_ledgers` (sama dengan AP aging) |
| A7 | ✅ | Toleransi balance seragam 0,01 (Balance Sheet 0,5 → 0,01) |
| B1 / RPT-10 / SSOT-05 | ✅ | Migrasi startup: semua JE punya `doc_no`=`je_number` + `outlet_id`; FE menampilkan fallback |
| B2 / SSOT-06 / FE-03 | ✅ | Satu sumber tarif PPN `get_ppn_rate()` (persen legacy dinormalisasi); AR mengabaikan tarif dari klien; setting `DEFAULT_PPN_RATE` dihapus dari UI |
| B3 / SSOT-12 | ✅ | Seri terpisah `PAYR`/`UP`/`LR`; reset monthly/yearly diterapkan (hanya bila format punya token periode); cuti pakai counter atomik |
| B4 / RBAC | ✅ | Kode yang tidak ada di catalog diganti; grant `executive.view`, `hr.payroll.*`, `reservations.reports`, dll. `admin.*`/`system.*` sengaja SUPER_ADMIN |
| B5 | ✅ | `ACCESS_TOKEN_DEFAULT_MINUTES` = config (1440), config membaca konstanta |
| B6 / SSOT-09 | ✅ | Satu root upload `settings.upload_dir` (static mount, 4 router, public menu); batas ukuran dari `MAX_UPLOAD_SIZE_MB` |
| C4 / FE-05 | ✅ | `alert()` → `toast.error` (11 tempat) |
| FIN-16 | ✅ | Digest: `sales_date`/`grand_total`/`transaction_count`, status validated, tanpa `to_list(10)` |
| FIN-17 / RPT-08 | ✅ | P&L outlet Executive = P&L GL per outlet; profit walk filter `deleted_at` |
| INV-01 | ✅ | Mutex per outlet+item (`stock_locks`) untuk kirim transfer & adjustment keluar |
| INV-04 | ✅ | Reservasi: outlet wajib valid, kapasitas menghitung seating yang overlap (default 120 menit), form publik tidak membuat member CRM |
| SEC-03 | ✅ | (sudah di 2b) password acak + rate-limit login loyalty |
| SEC-08 | ✅ | Permission `hr.payroll.read/manage/approve` + SoD |
| SEC-18 | ✅ | Gagal enkripsi → error (tidak menyimpan plaintext) |
| SEC-19 | ✅ | `content_type` kosong ditebak dari nama file lalu tetap wajib lolos whitelist + magic bytes |
| SEC-20 | ✅ | JSON-LD di-escape (`<` → `\u003c`) |
| SEC-21 | ✅ | CRM analytics: `crm.view`/`loyalty.read` (bukan kode fiktif) |
| SSOT-01 / SSOT-20 | ✅ | Guardrails dikoreksi (`password_hash`, filter `status`) + addendum |
| SSOT-04 | ✅ | Briefing memakai status `validated` saja (sama dengan digest/GL) |
| SSOT-08 | ✅ | Approval transfer → `transfers`; index & data management memakai koleksi kanonik |
| SSOT-10 | ✅ | Cash position menampilkan saldo kas GL + selisih vs saldo manual |
| SSOT-14 | ✅ | Write-off AR & akun PPh lewat `gl_mapping`; cache mapping TTL 30 dtk (lintas worker) |
| SSOT-16 | ✅ | Query voucher hari ini membaca datetime & ISO, dari outlet redeem & daily sales |
| SSOT-21 | ✅ | Poin FE = BE (`floor`), tier platinum di FE, `PTKP_OPTIONS`/`STD_COMPONENTS` satu sumber `lib/payroll.js` |
| SSOT-22 | ✅ | Daily sales menyimpan `service_charge_expected` (policy) & `service_charge_variance` |
| RPT-06 | ✅ | Report builder memakai `total_cost`; AP exposure = sisa belum dibayar |
| RPT-07 | ✅ | Cashflow memetakan payment_run/ar_receipt/tax_settlement/fixed asset; deteksi akun kas berbasis kode + mapping |
| RPT-09 | ✅ | Selisih stok lebih (opname/adjustment) → kontra HPP, bukan pendapatan |
| CTL-02 | ✅ | Tampilan grup/brand eksekutif hanya bila scope outlet mencakup semua outlet; drilldown outlet dicek scope |
| CTL-03 | ✅ | AI Q&A butuh `executive.dashboard.read`; sesi milik user lain tidak bisa dibaca/ditimpa; rate-limit `ai` aktif |
| CTL-11 | ✅ | Import Excel: karyawan kanonik (`code/full_name/outlet_code/status`), COA ke `chart_of_accounts` |
| CTL-15 | 🟡 | Opname diambil per id (bukan cari di 50 terakhir). Pola dropdown `per_page` 100–500 lain belum disapu |
| FE-04 | ✅ | Prefix permission AdminHome sesuai catalog |
| FE-06 | ⏳ | Token di localStorage → cookie httpOnly: perubahan auth, perlu playbook integrasi auth & uji login menyeluruh (belum dikerjakan) |
| DUP-01..14 | 🟡 | Konstanta payroll FE disatukan, helper scope/number series dipakai ulang; duplikasi formatter/status lain belum disapu |
| SSOT-07 / SSOT-15 | 🟡 | Sebagian (lihat §5) |
| G. Pajak | 🔍 | Menunggu konsultan pajak (PBJT/PPN, TER) — tidak diubah |
