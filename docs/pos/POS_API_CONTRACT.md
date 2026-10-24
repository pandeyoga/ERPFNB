# Kontrak API Integrasi POS Mobile ↔ ERP — v1 (draft siap implementasi)

**Versi dokumen:** 1.0 · 2026-10-24 · **Base path baru:** `/api/pos/v1` · **Spesifikasi mesin:** [`pos-api-v1.openapi.yaml`](pos-api-v1.openapi.yaml)
**Latar belakang & rencana:** [Laporan audit](../audit/AUDIT_REPORT_2026-10-24.md) (Fase 2–3)

Status per endpoint:

| Tanda | Arti |
|---|---|
| ✅ **Ada** | sudah tersedia di ERP sekarang, sudah diverifikasi |
| 🟡 **Ada, dengan catatan** | bisa dipakai sementara (interim) dengan batasan yang disebut |
| 🔴 **Harus dibangun** | kontrak final; implementasi di Fase 2/3 |

Aplikasi POS **sebaiknya dibangun langsung ke kontrak `/api/pos/v1`**. Untuk prototipe atau pilot, gunakan endpoint
✅/🟡 yang tercantum di §11 (jalur interim).

---

## 1. Prinsip desain

1. **Offline-first.** POS harus tetap berjualan tanpa internet. Semua transaksi diberi ID oleh klien (UUID v7),
   disimpan lokal, lalu dikirim ulang sampai server menjawab "diterima". Mengirim ulang **tidak boleh** membuat
   data ganda.
2. **Server adalah sumber kebenaran untuk uang.** POS mengirim *apa yang dijual*. Server menghitung ulang
   subtotal, diskon, service charge, PB1, dan poin dari master yang berlaku, lalu mengembalikan angka final.
   Selisih di atas toleransi berarti order ditolak dengan alasan jelas, tidak "dibenarkan diam-diam".
3. **Satu kontrak, satu envelope, satu format error** (§3). Tidak ada respons tanpa envelope.
4. **Struk = unit transaksi.** ERP mengagregasi order menjadi `daily_sales` per outlet per hari bisnis dan
   memakai alur validasi finance dan jurnal yang sudah ada. Jadi POS tidak menulis jurnal maupun daily sales langsung.
5. **Cakupan outlet ketat.** Token perangkat terikat ke tepat satu outlet dan satu terminal.

---

## 2. Transport, waktu, dan uang

| Aspek | Aturan |
|---|---|
| Transport | HTTPS saja. JSON UTF-8. `Content-Type: application/json`. Kompresi gzip didukung (respons ≥ 1 KB). |
| Header wajib | `Authorization: Bearer <token>`, `X-Request-ID: <uuid>` (opsional, dikembalikan di respons), `Idempotency-Key: <uuid>` untuk semua `POST`/`PATCH` yang mengubah data, `X-POS-Device-Id`, `X-POS-App-Version` |
| Waktu | Timestamp ISO-8601 **dengan offset**, mis. `2026-10-24T19:05:11+07:00`. Server menyimpan UTC. |
| Hari bisnis | `business_date` = `YYYY-MM-DD` menurut zona outlet (default `Asia/Jakarta`) **dan jam cut-off outlet** (mis. 04:00). Penjualan jam 01:30 masuk ke hari bisnis sebelumnya. Server yang memutuskan; POS mengirim `closed_at`, server mengembalikan `business_date`. |
| Jam perangkat | Setiap respons menyertakan `meta.server_time`. POS wajib mengoreksi skew > 2 menit. Order dengan `closed_at` > 5 menit di masa depan ditolak. |
| Uang | **Integer Rupiah** (tanpa desimal), mis. `52000`. Server menyimpan sampai sen, tapi kontrak POS memakai Rupiah bulat. Persentase dalam **fraksi** (`0.10` = 10%). |
| Kuantitas | Desimal maksimal 3 digit (`0.250` kg). |
| ID | `id` server = UUID string. ID buatan klien = UUID v7 (urut waktu). |

---

## 3. Envelope, error, pagination

### 3.1 Envelope (sama dengan ERP sekarang)
```json
{ "success": true, "data": { }, "errors": null, "meta": { "request_id": "…", "server_time": "2026-10-24T12:00:00Z" } }
```
Error:
```json
{ "success": false, "data": null,
  "errors": [ { "code": "VALIDATION_ERROR", "message": "sales_date tidak boleh di masa depan", "field": "sales_date" } ],
  "meta": { "request_id": "…" } }
```
POS menampilkan `errors[0].message` (sudah berbahasa Indonesia) dan memutuskan tindakan berdasarkan `code`, bukan teks.

### 3.2 Katalog kode error

| HTTP | `code` | Arti untuk POS | Retry? |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | input salah (lihat `field`) | tidak, perbaiki data |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED` | token tidak valid/kedaluwarsa | refresh lalu ulangi |
| 403 | `INSUFFICIENT_PERMISSION`, `OUTLET_OUT_OF_SCOPE`, `DEVICE_REVOKED` | tidak berhak | tidak |
| 404 | `NOT_FOUND` | data tidak ada | tidak |
| 409 | `CONFLICT` | sudah diproses/duplikat (mis. klik ganda) | **anggap sukses** bila order yang sama sudah diterima; untuk lainnya muat ulang |
| 409 | `IDEMPOTENCY_MISMATCH` | `Idempotency-Key` sama dengan body berbeda | tidak; bug klien |
| 409 | `PERIOD_LOCKED`, `DAY_CLOSED` | periode/hari bisnis sudah ditutup | tidak; minta manager |
| 422 | `PRICE_MISMATCH`, `TAX_MISMATCH`, `TOTAL_MISMATCH` | hitungan POS beda dengan server di atas toleransi | sinkronkan master, lalu kirim ulang |
| 422 | `ITEM_UNAVAILABLE` | item non-aktif/86 | tidak |
| 429 | `RATE_LIMITED` | terlalu cepat (lihat `Retry-After`) | ya, backoff |
| 500 | `INTERNAL_ERROR` | kesalahan server (`meta.request_id` untuk support) | ya, backoff |
| 503 | `MAINTENANCE` | server sedang maintenance | ya |

Backoff yang disarankan: 1 s, 2 s, 4 s, 8 s, … maksimal 5 menit, dengan jitter. Untuk endpoint idempoten, retry
selalu aman.

### 3.3 Pagination
- **Daftar biasa:** `?page=1&per_page=50` (maks 200) → `meta: {page, per_page, total}`.
- **Sinkronisasi:** cursor `?since=<cursor>&limit=500` → `meta: {next_cursor, has_more, server_time}`. Cursor
  bersifat opaque dan disimpan POS apa adanya.

---

## 4. Idempotency (wajib untuk semua tulis)

- Header `Idempotency-Key` (UUID v4/v7) berlaku untuk satu operasi bisnis. Retry operasi yang sama memakai key yang sama.
- Server menyimpan `(device_id, key) → (hash body, status, response)` selama **7 hari**.
  - Key sama + body sama → respons asli diputar ulang (HTTP status yang sama).
  - Key sama + body beda → `409 IDEMPOTENCY_MISMATCH`.
- Selain header, setiap order juga unik pada `(outlet_id, order.id)` **dan** `(outlet_id, receipt_no)`. Ini lapis
  kedua, sama seperti unique index yang dipasang di sesi audit untuk daily sales, loyalty, dan daily close.
- Batch (`/orders/batch`) memproses tiap order secara independen dan idempoten per order.

---

## 5. Autentikasi & perangkat 🔴

### 5.1 Alur pairing perangkat
1. Manager outlet membuat **kode pairing** di ERP (`POST /api/pos/v1/admin/pairing-codes` → kode 8 karakter, berlaku 15 menit).
2. Aplikasi POS memanggil `POST /api/pos/v1/devices/register` dengan kode, nama perangkat, platform, dan versi
   aplikasi. Respons berisi `device_id`, `terminal_code`, `outlet_id`, `device_secret` (sekali tampil, simpan di
   secure storage/Keystore/Keychain), dan `refresh_token`.
3. POS menukar kredensial dengan **access token perangkat** (umur 15 menit) lewat
   `POST /api/pos/v1/auth/token` (`grant_type=device_refresh`).
4. **Login kasir di perangkat**: `POST /api/pos/v1/auth/staff-login` `{employee_code, pin}` → `staff_session_id`
   (umur sampai shift ditutup). Setiap order mencatat `staff_id` yang menjalankannya.
5. Admin bisa **mencabut** perangkat (`POST /api/pos/v1/admin/devices/{id}/revoke`). Request berikutnya akan
   mendapat `403 DEVICE_REVOKED`.

### 5.2 Permission (katalog baru di `core/perms_catalog.py`)
`pos.order.create`, `pos.order.void`, `pos.refund.create`, `pos.discount.manual`, `pos.price.override`,
`pos.shift.open`, `pos.shift.close`, `pos.cash.movement`, `pos.report.x`, `pos.report.z`, `pos.member.lookup`.
Void, refund, diskon manual, dan override harga mewajibkan **otorisasi supervisor** (`supervisor_pin`) di body.

### 5.3 Interim (✅ ada sekarang)
`POST /api/auth/login {email, password}` → `data.access_token` (JWT 24 jam), `data.refresh_token` (7 hari),
`data.user` (`outlet_ids`, `permissions`, `default_outlet_id`). Refresh: `POST /api/auth/refresh {refresh_token}`.
Untuk pilot, buat **satu user layanan per outlet** dengan role terbatas (sales + loyalty). Jangan memakai akun manager.

---

## 6. Sinkronisasi master data 🔴

### 6.1 `GET /api/pos/v1/sync/bootstrap`
Snapshot penuh untuk outlet milik perangkat. Respons:
```json
{
  "outlet": { "id": "…", "code": "CFS", "name": "The Coffeeshop", "brand_id": "…", "timezone": "Asia/Jakarta",
              "business_day_cutoff": "04:00", "receipt_header": "…", "receipt_footer": "…" },
  "terminal": { "id": "…", "code": "T01", "receipt_prefix": "CFS-T01" },
  "tax_policy": { "pb1_rate": 0.10, "service_charge_rate": 0.05, "price_includes_tax": false,
                  "sc_taxable": true, "rounding": { "mode": "nearest", "unit": 100 }, "effective_from": "2026-10-01" },
  "payment_methods": [ { "code": "CASH", "name": "Tunai", "type": "cash", "requires_reference": false, "opens_drawer": true },
                       { "code": "QRIS", "name": "QRIS", "type": "qris", "requires_reference": true, "opens_drawer": false } ],
  "categories": [ { "id": "…", "name": "Specialty Coffee", "sort_order": 1, "updated_at": "…" } ],
  "products": [ { "id": "…", "sku": "CFS-ESP-01", "name": "Signature Aeropress", "category_id": "…",
                  "price": 52000, "tax_category": "pb1", "service_charge": true, "revenue_bucket": "beverage",
                  "available": true, "image_url": "…", "modifier_group_ids": ["…"], "updated_at": "…" } ],
  "modifier_groups": [ { "id": "…", "name": "Milk", "min": 0, "max": 1,
                         "options": [ { "id": "…", "name": "Oat milk", "price_delta": 8000 } ] } ],
  "promotions": [ ],
  "staff": [ { "id": "…", "employee_code": "EMP-0012", "display_name": "Rina", "roles": ["cashier"] } ],
  "number_series": { "receipt": { "prefix": "CFS-T01-261024-", "next": 1, "block_size": 500 } },
  "sync_cursor": "c_01JB…"
}
```

### 6.2 `GET /api/pos/v1/sync/changes?since=<cursor>&limit=500`
```json
{ "changes": [ { "entity": "product", "op": "upsert", "id": "…", "data": { }, "version": 42 },
               { "entity": "product", "op": "delete", "id": "…", "version": 43 } ],
  "meta": { "next_cursor": "c_…", "has_more": false, "server_time": "…" } }
```
Entitas yang disinkronkan: `product`, `category`, `modifier_group`, `price`, `tax_policy`, `payment_method`,
`promotion`, `staff`, `availability` (86/habis), `outlet`. Penghapusan dikirim sebagai **tombstone** (`op: delete`).
Polling setiap 60 detik saat online, ditambah *push hint* lewat §10.

### 6.3 Status master di ERP saat ini

| Data | Sumber sekarang | Status |
|---|---|---|
| Outlet | `GET /api/master/outlets` (`id, code, name, brand_id, address, phone, open_time, close_time`) | 🟡 tanpa timezone/cut-off/terminal, tanpa `updated_since` |
| Metode bayar | `GET /api/master/payment-methods` (`id, code, name, type, bank_account_id`) | 🟡 belum ada flag `allowed_for_sales`, MDR, maupun akun clearing |
| Produk/menu | `GET /api/public/menu/brands/{slug}/items` (`id, name, price, category, is_available…`) dari koleksi `brand_menu_items` | 🟡 **hanya untuk tampilan**: tanpa SKU, harga per outlet, kategori pajak, modifier, atau `updated_at` (temuan POS-15) |
| Pajak | `GET /api/tax/config` (PPN/PPh saja) | 🔴 belum ada kebijakan PB1 dan SC per outlet (temuan POS-13) |
| Staff | `GET /api/master/employees` | 🟡 tanpa PIN kasir; berisi data sensitif, jangan disinkronkan apa adanya |

---

## 7. Order & penjualan 🔴

### 7.1 Model order
```json
{
  "id": "0192f7a2-…",                        // UUID v7 buatan POS (kunci idempotensi kedua)
  "receipt_no": "CFS-T01-261024-0042",        // dari blok number series milik terminal
  "outlet_id": "…", "terminal_id": "…", "shift_id": "…", "staff_id": "…",
  "order_type": "dine_in",                    // dine_in | takeaway | delivery
  "channel": "walk_in",                       // walk_in | gofood | grabfood | shopeefood | reservation
  "table_no": "12", "pax": 2, "reservation_id": null,
  "opened_at": "2026-10-24T18:40:02+07:00", "closed_at": "2026-10-24T19:05:11+07:00",
  "customer": { "member_id": null, "phone": "+6281392847589" },
  "lines": [
    { "line_id": "l1", "product_id": "…", "sku": "CFS-ESP-01", "name": "Signature Aeropress",
      "qty": 2, "unit_price": 52000,
      "modifiers": [ { "option_id": "…", "name": "Oat milk", "price_delta": 8000, "qty": 1 } ],
      "discount": { "type": "percent", "value": 0.10, "reason": "promo_happy_hour", "promotion_id": "…" },
      "note": "less ice" }
  ],
  "order_discounts": [ { "type": "voucher", "voucher_code": "3ESDB4Q95V" } ],
  "service_charge": 6000, "tax": 13200, "rounding": -200,
  "total": 145000,                            // total yang dicetak di struk (klaim POS)
  "payments": [ { "method_code": "CASH", "amount": 150000, "tendered": 150000, "change": 5000 },
                { "method_code": "QRIS", "amount": 0, "reference": "QR-REF-…" } ],
  "status": "closed"                          // closed | voided
}
```

### 7.2 Aturan server saat menerima order
1. Validasi struktural (§3.2) dan cakupan perangkat → outlet.
2. Hitung ulang dari master yang berlaku pada `closed_at`: harga + modifier, diskon promo/voucher (voucher diklaim
   **atomik** untuk `order.id`), SC, PB1, dan pembulatan. Toleransi **Rp 1 per baris, Rp 100 per order**. Di luar
   toleransi → `422 PRICE_MISMATCH`/`TAX_MISMATCH`/`TOTAL_MISMATCH`, dengan `data.server_breakdown` agar POS bisa
   menampilkan perbedaannya.
3. `Σ payments.amount` harus sama dengan `total` server, tanpa memperhitungkan kembalian.
4. Order disimpan dengan `business_date` dari cut-off outlet. Jika hari tersebut sudah di-close → `409 DAY_CLOSED`.
5. Efek samping berjalan asinkron setelah order disimpan:
   - poin loyalty dihitung server dari order, satu kali per `order.id`;
   - stok berkurang per resep (`inventory_movements` tipe `sale`);
   - `daily_sales` outlet+hari di-*upsert* sebagai agregat (§7.5).

### 7.3 Endpoint

| Method & path | Fungsi | Status |
|---|---|---|
| `POST /api/pos/v1/orders` | kirim 1 order yang sudah ditutup | 🔴 |
| `POST /api/pos/v1/orders/batch` | maksimal 200 order (upload offline). Respons berisi hasil per order: `accepted` \| `duplicate` \| `rejected{code,message}` | 🔴 |
| `GET /api/pos/v1/orders/{id}` | status dan angka final server | 🔴 |
| `GET /api/pos/v1/orders?business_date=&shift_id=` | daftar untuk reprint/rekonsiliasi | 🔴 |
| `POST /api/pos/v1/orders/{id}/void` | void (`reason`, `supervisor_pin`); hanya pada hari bisnis yang masih terbuka | 🔴 |
| `POST /api/pos/v1/refunds` | refund penuh/parsial atas order (baris, qty, metode refund, alasan, otorisasi) | 🔴 |
| `POST /api/pos/v1/orders/quote` | hitung harga/pajak/poin tanpa menyimpan (dipakai saat online untuk preview) | 🔴 |

Respons `POST /orders` (201 bila baru, 200 bila duplikat yang diputar ulang):
```json
{ "success": true,
  "data": { "id": "0192f7a2-…", "status": "accepted", "business_date": "2026-10-24",
            "server_totals": { "subtotal": 128000, "discount": 0, "service_charge": 6400, "tax": 13440,
                               "rounding": -40, "total": 147800 },
            "loyalty": { "member_id": "…", "points_earned": 14 },
            "receipt_no": "CFS-T01-261024-0042" },
  "meta": { "server_time": "…" } }
```

### 7.4 Penomoran struk
Format: `{OUTLET}-{TERMINAL}-{YYMMDD}-{seq:04d}`. Server mengalokasikan **blok nomor** per terminal (mis. 500)
lewat `POST /api/pos/v1/number-blocks`, sehingga POS bisa menomori struk saat offline tanpa bentrok. Blok yang
tidak terpakai dikembalikan saat shift ditutup. Implementasinya memakai `utils/number_series` dengan scope
outlet+terminal.

### 7.5 Pemetaan order → `daily_sales` (agregasi otomatis server)

| Field `daily_sales` | Diisi dari |
|---|---|
| `outlet_id`, `sales_date` | `order.outlet_id`, `business_date` |
| `revenue_buckets[]` | Σ nilai baris neto per `product.revenue_bucket` (`food`/`beverage`/`other`) |
| `payment_breakdown[]` | Σ `payments.amount` per `payment_method_id` |
| `service_charge`, `tax_amount` (+ `tax_type: "pb1"`) | Σ dari server_totals |
| `voucher_discount_amount` | Σ diskon voucher |
| `transaction_count` | jumlah order `closed` (tidak termasuk void) |
| `channels[]` | Σ per `order.channel` |

Status `daily_sales` menjadi `submitted` otomatis setelah **Z-report** semua terminal di outlet tersebut. Setelah
itu finance memvalidasi seperti biasa: jurnal dibuat lewat `post_for_daily_sales` dan PB1 diposting ke akun
2116 (perbaikan sesi ini). Daily sales tetap satu record per outlet+hari, dijamin unique index `ds_outlet_date_unique`.

---

## 8. Shift & cash drawer 🔴

| Method & path | Fungsi |
|---|---|
| `POST /api/pos/v1/shifts/open` | `{opening_float, staff_id}` → `shift_id`. Satu shift terbuka per terminal. |
| `POST /api/pos/v1/shifts/{id}/cash-movements` | pay-in / pay-out / drop: `{type, amount, reason, supervisor_pin?}` |
| `GET /api/pos/v1/shifts/{id}/x-report` | laporan berjalan tanpa menutup shift |
| `POST /api/pos/v1/shifts/{id}/close` | `{counted_cash, counted_by, blind: true}` → Z-report: penjualan per metode, void, refund, diskon, kas seharusnya vs terhitung, selisih |

Selisih kas di atas ambang (setting outlet) memicu notifikasi ke manager dan dicatat sebagai temuan di checklist
daily close. Perilakunya dibangun dengan pola yang sama seperti `petty_cash_transactions`.

---

## 9. Loyalty, voucher, reservasi

| Kebutuhan | Endpoint | Status |
|---|---|---|
| Cari member via HP | `GET /api/outlet/loyalty/cashier/lookup?phone=` → `{id, full_name, phone, loyalty_tier, total_points, multiplier}` atau `null` | ✅ butuh permission loyalty; HP dinormalisasi (`phone_key`) |
| Daftarkan member baru di kasir | dibuat otomatis saat earn bila HP belum terdaftar | 🟡 lewat add-points; di v1 tersedia `POST /api/pos/v1/members` 🔴 |
| Earn poin | **v1: otomatis dari order** (`order.customer`) | 🔴 · interim ✅ `POST /api/outlet/loyalty/cashier/add-points {phone, amount_idr, order_ref, outlet_id?}`, idempoten per (outlet, nomor struk), 409 bila struk sudah dipakai |
| Validasi voucher | `POST /api/outlet/vouchers/validate {code, outlet_id, sales_date, customer_phone}` | 🟡 nilai diskon masih default tetap Rp 10.000 (temuan POS-06, Fase 2) |
| Klaim voucher | v1: atomik di dalam `POST /orders` | 🔴 · interim `POST /api/outlet/vouchers/claim` ✅ |
| Reservasi hari ini | `GET /api/reservations?outlet_id=&date_from=&date_to=` | ✅ dibatasi ke outlet sendiri |
| Ubah status reservasi (seated/no-show) | `POST /api/reservations/{id}/status {status, reason}` | ✅ |

---

## 10. Event ERP → POS 🔴

`GET /api/pos/v1/events/stream` (Server-Sent Events) atau Web Push mengirim *hint*:
`catalog.changed`, `availability.changed` (86), `tax_policy.changed`, `device.revoked`, `day.closed`.
Event hanya memberi tahu. POS selalu menarik data lewat `/sync/changes`, sehingga event yang hilang tidak
menyebabkan data salah.

---

## 11. Jalur interim (bisa dipakai sekarang untuk pilot)

Untuk uji coba sebelum `/api/pos/v1` dibangun, POS bisa mengirim **ringkasan harian** lewat endpoint yang sudah
diperkuat di sesi ini:

1. `POST /api/auth/login` → token user layanan outlet.
2. `GET /api/master/payment-methods`, `GET /api/master/outlets`, `GET /api/public/menu/brands/{slug}/items` (katalog tampilan).
3. Di akhir hari: `POST /api/outlet/daily-sales/draft`
   ```json
   { "outlet_id": "…", "sales_date": "2026-10-24",
     "revenue_buckets": [ { "bucket": "food", "amount": 3200000 }, { "bucket": "beverage", "amount": 1800000 } ],
     "payment_breakdown": [ { "payment_method_id": "<CASH id>", "amount": 2750000 },
                            { "payment_method_id": "<QRIS id>", "amount": 2250000 } ],
     "service_charge": 0, "tax_amount": 0, "transaction_count": 142, "notes": "POS T01 Z-report #88" }
   ```
   - Draft bersifat idempoten per outlet+tanggal: simpan ulang akan memperbarui draft yang sama, dan simpan
     serentak tidak membuat duplikat.
   - Validasi: tanggal valid dan tidak di masa depan, angka ≥ 0, metode bayar harus terdaftar. Input yang salah
     mendapat `400` dengan `field`.
   - Isi `service_charge` dan `tax_amount` (PB1) sesuai struk. Pajak akan diposting ke akun PB1 2116.
4. `POST /api/outlet/daily-sales/{id}/submit` (permission `outlet.daily_sales.submit`). Syaratnya Σ pembayaran = grand total.
5. Finance memvalidasi di ERP. Validasi idempoten: klik ganda menghasilkan satu jurnal dan `409`.

Batasan jalur interim:
- Tidak ada rincian per struk, sehingga tidak ada stok per resep dan tidak ada poin otomatis.
- Pajak dan SC masih dipercaya dari klien.
- Tidak ada void/refund setelah validasi.

Gunakan jalur ini hanya untuk pilot.

---

## 12. Batas & kinerja

| Item | Nilai |
|---|---|
| Rate limit API | 1.000 request/menit per user (`X-RateLimit-*`, `Retry-After`); profil POS khusus per perangkat di v1 |
| Ukuran batch | ≤ 200 order atau ≤ 2 MB per request |
| Target latensi | p95 `POST /orders` < 300 ms (penyimpanan saja; efek samping berjalan asinkron) |
| Throughput | ≥ 1.000 order/jam per outlet, 20 outlet bersamaan |
| Retensi idempotency | 7 hari; batas umur order offline: 7 hari (di atas itu perlu approval manager) |

---

## 13. Uji kontrak (acceptance) sebelum go-live

1. Order sama dikirim 10× serentak (key sama) → 1 order, 1 klaim voucher, 1 earn poin, 9 respons replay.
2. Batch 200 order dikirim 2× → 200 `accepted`, lalu 200 `duplicate`. `daily_sales` sama dengan Σ order.
3. Order dengan harga lama setelah perubahan harga → `422 PRICE_MISMATCH` beserta `server_breakdown`.
4. Order jam 01:30 dengan cut-off 04:00 → masuk `business_date` hari sebelumnya.
5. Order untuk hari yang sudah di-close → `409 DAY_CLOSED`.
6. Perangkat yang dicabut → `403 DEVICE_REVOKED` di request berikutnya.
7. Token perangkat outlet A mengakses outlet B → `403 OUTLET_OUT_OF_SCOPE`.
8. Z-report: kas seharusnya = float + cash sales − cash refund + pay-in − pay-out.
9. Validasi finance atas daily sales hasil agregasi → jurnal seimbang; PB1 di 2116; tidak ada baris PPN.
10. Stok bahan berkurang sesuai resep; jurnal HPP dibuat; tidak ada stok negatif tanpa izin.

---

## 14. Versi & perubahan

- Versi ada di path (`/api/pos/v1`). Perubahan yang tidak kompatibel → `v2`. `v1` dipertahankan minimal 6 bulan
  setelah `v2` rilis.
- Field baru bisa ditambahkan kapan saja, jadi klien wajib mengabaikan field yang tidak dikenal.
- Endpoint deprecated diberi header `Deprecation` dan `Sunset`.
- Aplikasi mengirim `X-POS-App-Version`. Server bisa menjawab `426 Upgrade Required` untuk versi yang sudah tidak didukung.
