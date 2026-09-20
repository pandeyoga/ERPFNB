> 🏷️ **STATUS: 🟢 AKTIF / SSOT ATURAN (WAJIB).** Koleksi kanonik diverifikasi ke KODE + DB (2026-06-17).
> Status fitur "selesai vs belum": `memory/GROUND_TRUTH_2026-06-17.md`.

# 🛡️ ENGINEERING GUARDRAILS — Torado Group ERP

> **WAJIB DIBACA** sebelum development baru ATAU fix bug. Dokumen ini = cacat produksi nyata yang
> berulang di codebase ini + akar masalah + mitigasi + pola fix siap-pakai. Hukum hidup; selalu dipatuhi.
>
> ⚠️ **ATURAN KEJUJURAN MUTLAK.** Bug belum fixed → lapor **"BELUM SELESAI"** dengan bukti.
> DILARANG klaim "fixed/selesai" tanpa verifikasi **data + render nyata**.
> "Layanan berjalan" ≠ fixed. "Status 200" ≠ fixed. "Testing agent lulus" ≠ fixed jika tes tak
> menyentuh jalur data & render nyata.

---

## 1. Inti masalah (1 kalimat)

ERP multi-portal (React + FastAPI + MongoDB). Bug **bukan** karena framework, tapi **desync antar lapisan**:

```
 SEED ──tulis──► KOLEKSI MONGO ◄──baca── SERVICE ◄── ROUTER ──JSON──► FRONTEND
   │                  │                    │           │                 │
nama koleksi      nama field          signature      /api/          import &
  SALAH             SALAH             berubah        prefix          parsing
```

Tiap "sambungan" = titik gagal. Agent sering **menebak** nama koleksi/field/bentuk respons alih-alih
**memverifikasi ke pembaca sebenarnya** → tabel kosong, "Rp 0", layar putih, 404/500. **Verify, don't assume.**

---

## 2. ✅ KOLEKSI KANONIK (terverifikasi ke kode + DB) — JANGAN pakai nama lain

> Sumber kebenaran eksekutabel: `scripts/verify_data_integrity.py` (CONCEPTS registry, gate 21/21).
> "Legacy WAJIB kosong" — jika terisi = **ACTIVE DRIFT** (seed/app nulis koleksi salah).

| Domain | KANONIK (dibaca app) | Legacy/SALAH (harus KOSONG) | Catatan kritis |
|---|---|---|---|
| Procurement | `purchase_requests` | `prs`, `pr_requests` | |
| Procurement | `purchase_orders` | `pos`, `po_orders` | |
| Procurement | `goods_receipts` | `gr`, `grn` | |
| Finance — Jurnal | `journal_entries` | `journals`, `journal_lines` | **Baris jurnal di-EMBED** sbg `journal_entries.lines[]` (Dr/Cr). Tidak ada koleksi `journal_lines` terpisah. |
| Finance — AP | `ap_ledgers` | `ap_invoices`, `accounts_payable` | `/api/finance/ap-invoices` **baca `ap_ledgers`** (field `balance`). Koleksi `ap_invoices` TIDAK ada. |
| Finance — Period lock | `accounting_periods` | `fiscal_periods` | Period **locking** (journal posting) pakai `accounting_periods`. `periods` = display UI saja. `_ensure_period_open()` auto-create `accounting_periods`. |
| Finance — Petty cash | `petty_cash_transactions` | `petty_cash`, `petty_cash_entries` | Akses kadang via `db["petty_cash_transactions"]` (bracket) → audit regex bisa buta. |
| Master — CoA | `chart_of_accounts` | `coa`, `accounts` | Revenue codes nyata = `4000`/`4001` (BUKAN `4101`). AR=`1201`, PPN keluaran=`2110`. |
| Master | `number_series` | `counters`, `sequences` | SSOT nomor dok; lihat RC-5. |
| Master | `employees` | `employee`, `staff` | Filter aktif = `active: True` (BUKAN `employment_status`). |
| HR — Payroll | `payroll_cycles` | `payroll_runs`, `payroll` | `/api/hr/payroll` **baca `payroll_cycles`**. |
| HR — Service charge | `service_charge_periods` | `service_charge_runs`, `service_charge` | Kanonik = `..._periods`. |
| HR — Advances | `employee_advances` | — | |
| Inventory — Stok | `inventory_movements` | `stock_movements`, `stock_balances` | `/api/inventory/balance` & `/movements` baca `inventory_movements`. **Saldo dihitung real-time** dari agregasi. |
| Inventory — Transfer | `transfers` | `stock_transfers` | |
| Sales | `daily_sales` | — | |
| AI | `anomaly_events` | `anomalies`, `anomaly` | |
| System | `audit_log` | `audit_logs`, `audits` | |
| CRM/Loyalty | `customers` | — | CRM/loyalty (≈250). **Beda** dgn `ar_customers` (pelanggan AR/piutang) — keduanya by-design. |

**Sebelum nulis seed/kode**, grep koleksi yang BENAR dari handler yang membacanya:
```bash
grep -rn "db[\.\[][a-z_\"]*" backend/routers/<file>.py | grep -E "find|aggregate|count"
```

---

## 3. Akar masalah (RC-1 … RC-15) — semua WAJIB dikenali

### 🔴 RC-1 — Drift Nama Koleksi
Seed nulis ke nama lama; API baca koleksi kanonik lain → tabel/dashboard kosong walau "seed sukses".
**Fix:** pakai tabel §2; grep pembaca asli; gate `verify_data_integrity.py` setelah seed.

### 🔴 RC-2 — Drift Nama Field/Skema
Data muncul tapi kolom kosong / "Rp 0". Seed pakai field A, app baca field B.

| SALAH | BENAR | Koleksi | Akibat |
|---|---|---|---|
| `employment_status:'active'` | `active: True` | employees | filter employee 0 |
| `password_hash` | `password` | users | auth gagal |
| `status:'aktif'` | `active: True` | berbagai | filter mati |
| `amount` saja | `total_amount`/`net_amount` | ap/ar | nilai Rp 0 |
| `deleted: True` | `deleted_at: <datetime>` | semua | soft-delete mati |
| `brand` (string) | `brand_id` (UUID) | outlets, daily_sales | join gagal |

**Fix:** baca model Pydantic + endpoint create utk skema kanonik; `.get('key', default)` utk field opsional.

### 🔴 RC-3 — Drift Bentuk Respons API
Envelope kanonik Torado: `{"success": true, "data": {"items": [...], "total": N}}`.
Detail → objek; action → `{"ok": true, "id": ...}`. **Curl dulu** sebelum nulis parsing. FE pakai pola (C).

### 🔴 RC-4 — Import JSX/Komponen Hilang → Layar Putih
Komponen/ikon dipakai di JSX tapi tak di-import ("X is not defined"). Nyata: `Tabs/TabsList`, `ScanLine`,
`<Table>` dipakai tanpa import. **Fix:** grep simbol; setelah edit → screenshot + console bersih.

### 🔴 RC-5 — Desync Number Series SSOT
Seed insert dok bernomor langsung → bentrok dgn nomor yang app generate via
`utils/number_series.next_doc_no(code)` (unique index → `E11000`).
Codes: `PR, PO, GR, JAE, PAY, KB, EA, ADJ, OPN`. **Fix:** sinkronkan counter pasca-seed → pola (D).

### 🔴 RC-6 — Linkage Antar-Dokumen Putus
Propagasi cocokkan via field yang bisa None. Wajib ada: `goods_receipts.po_id`,
`journal_entries.lines[].coa_id`, `stock/inventory_movements.outlet_id`. Validasi sebelum insert.

### 🔴 RC-7 — Bug Semantik/Kalkulasi
Mis. AP/AR aging dari `invoice_date` bukan `due_date` → band salah. **Bandingkan apple-to-apple**
(pra-pajak vs pra-pajak; jangan campur subtotal dgn total+PPN).

### 🟠 RC-8 — Nilai Hardcoded (tanggal/ID/string)
Seed `"period":"2025-01"` → dashboard "bulan ini" kosong. **Fix:** periode dinamis
`datetime.now(timezone.utc).strftime("%Y-%m")`.

### 🟠 RC-9 — RBAC Bukan Satu Sumber
Peta akses FE ≠ BE. Backend: `core/perms_catalog.py` + koleksi `roles`. **Ubah role/permission →
update BE + FE sekaligus.**

### 🔴 RC-10 — False-Positive Testing
"Lulus" tapi app crash/kosong. Sebelum klaim selesai WAJIB: (1) curl cek **isi** (jumlah items, nilai
field kunci) bukan status; (2) screenshot tabel terisi, console bersih; (3) alur end-to-end create→read→verify.

### 🔴 RC-11 — Service Layer Contract Drift
`Router → Service → DB`. Ubah signature service tak terdeteksi route → TypeError runtime.
**Fix:** sebelum ubah signature, `grep -rn "nama_fungsi" backend/routers backend/services`; update SEMUA caller;
param baru beri default (backward compatible).

### 🔴 RC-12 — React StrictMode Double-Invocation / Double-Submit
`"body stream already read"` krn effect dipanggil 2×. **Fix WAJIB di useEffect+fetch:**
```js
useEffect(() => { (async () => {
  const res = await fetch(url, { cache: 'no-store' });
  setData(await res.json());
})(); }, []);
```
**Anti double-submit (aksi tulis irreversible):** tombol post/confirm/send/receive/approve/pay WAJIB
disable saat in-flight. Pakai `components/shared/AsyncButton.jsx` (lock re-entrant + spinner) ATAU state
`saving/acting` + `disabled`. Mencegah dokumen ganda dari klik dobel.

### 🔴 RC-13 — Period Lock Guard
Posting jurnal/close → 400/422 krn periode terkunci (`accounting_periods`). `_ensure_period_open(period)`
melempar bila closed. Seed ke periode open atau buka dulu:
```python
p = await db.accounting_periods.find_one({"period": "2026-06"})
if p and p.get("status") == "closed":
    await db.accounting_periods.update_one({"period":"2026-06"}, {"$set":{"status":"open"}})
```

### 🔴 RC-14 — AppShell Navigation Blank Page
Layar putih saat navigasi client-side dalam portal. **Root cause ADA di `AppShell.jsx`** (route matching /
module registry / conditional render). ⛔ JANGAN fix di modul individu / supervisord / build. Investigasi dari AppShell.

### 🔴 RC-15 — Protokol Eskalasi Bug Persisten ⭐
Jujur jika tak selesai. Ikuti BERURUTAN:
1. **Attempt 1–2 self-debug:** reproduksi (curl/screenshot) → telusuri RC yang cocok → fix → verifikasi data+render.
2. **Attempt 3 `troubleshoot_agent`** dgn bukti lengkap (ISSUE, COMPONENT, ERROR_MESSAGES log penuh,
   RECENT_ACTIONS, PREVIOUS_FIX_ATTEMPTS, RELEVANT_FILES+baris) → implement → verifikasi.
3. **Attempt 4 `testing_agent`** perspektif segar (sertakan semua attempt + file + credentials; baca git diff).
4. **Attempt 5 `web_search`** ("error + stack + 2026") → pendekatan alternatif (bukan variasi kecil).
5. **Eskalasi model:** rekomendasikan user pakai model lebih kuat; berikan ringkasan attempt+evidence,
   hipotesis root cause, file/baris dicurigai, opsi rollback.

**Template BLOCKER (wajib ke user):** Bug · jumlah Attempts · Evidence · yang sudah dicoba (per attempt→hasil) ·
hipotesis root cause · file:baris dicurigai · opsi (a coba X / b rollback ke commit / c eskalasi model) · rekomendasi.

---

## 4. Prinsip inti
1. **Verify, don't assume** — baca handler/service asli sebelum nulis kode.
2. **Satu sumber kebenaran** — skema, akses role, format nomor.
3. **Seed mengikuti kontrak API**, bukan sebaliknya.
4. **Hormati invarian** — number-series SSOT, unique index, period locking, soft delete.
5. **Defensif di batas** — `.get()` field opsional; parsing FE defensif.
6. **Bandingkan setara** (apple-to-apple).
7. **DoD = data + render terbukti** (bukan 200/"service up").
8. **Jujur jika tak bisa** — lapor blocker + escalation path (RC-15).

---

## 5. Pola fix standar (siap pakai)

**(A) Verifikasi koleksi yang dibaca endpoint sebelum seed**
```bash
grep -oE "api/[a-zA-Z0-9_/{}.$-]+" frontend/src/portals/<Portal>/*.jsx | sort -u   # endpoint dipakai FE
grep -rn "db[\.\[][a-z_\"]*" backend/routers/<handler>.py | grep -E "find|aggregate|count"  # koleksi dibaca
grep -rn "from services\." backend/routers/<handler>.py                             # service layer
```

**(B) Probe pasca-seed (deteksi kosong/404/500)**
```bash
API=$(grep REACT_APP_BACKEND_URL frontend/.env | cut -d= -f2)
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@torado.id","password":"Torado@2026"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('data') or d)['access_token'])")
for ep in /api/procurement/prs /api/inventory/balance /api/finance/journal-entries /api/anomalies; do
  curl -s -o /dev/null -w "[%{http_code}] $ep\n" "$API$ep" -H "Authorization: Bearer $TOKEN"; done
```

**(C) Parsing respons FE defensif**
```js
const d = res.data;
const items = Array.isArray(d) ? d : (d?.data?.items || d?.items || d?.data || d?.rows || []);
const total = d?.data?.total ?? d?.total ?? items.length;
```

**(D) Sinkronisasi Number Series SSOT pasca-seed**
```python
await db.number_series.update_one({"code": "PR"}, {"$max": {"current_value": max_pr}})  # max nomor di-seed
```

**(E) Idempoten upsert by natural key** (re-run seed tak menggandakan)
```python
await db.vendors.update_one({"code": code},
    {"$set": {...}, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now()}}, upsert=True)
```

**(F) Serialisasi MongoDB — WAJIB**
```python
from core.db import serialize
result = serialize(await db.collection.find_one({"id": id_}))   # atau projection {"_id": 0}
# ❌ return await db...find_one(...)  → ObjectId tak JSON-serializable → crash
```

**(G) Soft delete + UTC**
```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc).isoformat()        # ✅ (jangan datetime.utcnow())
q = {"deleted_at": None}                              # query aktif
await db.col.update_one({"id": i}, {"$set": {"deleted_at": now}})  # soft delete
```

---

## 6. ✅ Checklist wajib

**SEED / UBAH SEED**
- [ ] `grep` koleksi yang dibaca API (bukan asumsi) — pakai §2. (RC-1)
- [ ] Field dokumen = field kanonik app/model. (RC-2)
- [ ] Tanggal/periode **dinamis** `datetime.now()`. (RC-8)
- [ ] Dok bernomor: Number Series SSOT disinkronkan, tak bentrok. (RC-5)
- [ ] Linkage pakai kunci yang dijamin ada. (RC-6)
- [ ] Soft delete `deleted_at: None` (bukan `deleted: False`). (RC-2)
- [ ] **Idempoten** (upsert / wipe+reseed), re-run aman. (RC-5)
- [ ] Jurnal seimbang per-entry via `_post_journal`; posting ke periode OPEN. (RC-13)
- [ ] Jalankan `python scripts/verify_data_integrity.py` → 21/21 PASS. (RC-1/RC-10)

**FRONTEND**
- [ ] Cek bentuk respons via curl; parsing defensif (C). (RC-3)
- [ ] Semua simbol JSX/ikon ter-import. (RC-4)
- [ ] `useEffect`+fetch: async IIFE + `cache:'no-store'`. (RC-12)
- [ ] `data-testid` (kebab-case) di tiap elemen interaktif/teks penting.
- [ ] Smoke render (screenshot) + console bersih. JANGAN `// eslint-disable react-hooks/...` (mematahkan build).

**BACKEND ROUTER/SERVICE**
- [ ] Ubah signature service → grep + update SEMUA caller (default param). (RC-11)
- [ ] Serialisasi `serialize()` / `{"_id":0}`. (RC-2/RC-6)
- [ ] Semua route ber-prefix `/api`.
- [ ] Posting finance: `_ensure_period_open` dipanggil bila relevan. (RC-13)
- [ ] Pengurang stok (transfer/issue/adjustment-): panggil `inventory_service._assert_can_decrement` (cegah stok negatif). (RC-7)
- [ ] `.get()` utk field opsional.

**FIX BUG**
- [ ] **Reproduksi dulu** (curl/screenshot). [ ] Telusuri rantai seed→koleksi→service→API→FE.
- [ ] Klasifikasi RC-1…RC-14. [ ] Verifikasi data+render. [ ] Regression test di `backend/tests/`.
- [ ] Gagal 2+× → jalankan eskalasi RC-15. [ ] **Jujur** jika belum selesai (template BLOCKER).

**INTEGRASI PIHAK-3 / AUTH**
- [ ] `integration_playbook_expert_v2` SEBELUM nulis kode.
- [ ] Auth: `hash_password` dari `core.security`; field = **`password`** (bukan `password_hash`).
- [ ] Kredensial dari `.env` saja.

---

## 7. Definition of Done (boleh klaim "selesai" bila SEMUA terbukti)
1. **Jalur data nyata** — curl cek isi (jumlah items, nilai field kunci), bukan 200.
2. **Render nyata** — layar terbuka tanpa crash, tabel terisi, tak ada "Rp 0" tak disengaja (screenshot/testing_agent).
3. **Regression test** ada di `backend/tests/` & lulus.
4. **Tak ada regresi** pada flow terkait.
5. Memori diperbarui: `PRD.md`/`plan.md`/`GROUND_TRUTH`; kredensial → `test_credentials.md`.

> ⚠️ "Testing agent lulus" saja tak cukup bila tes tak menyentuh data+render. Fitur kritis: drive end-to-end.

---

## 8. Gate eksekutabel (jadikan kebiasaan / CI)
```bash
bash scripts/seed_reset.sh                       # reset+seed clean DB (19 langkah)
python scripts/verify_data_integrity.py          # INTEGRITY GATE 21/21 (drift, gap, KPI==detail, BS balanced)
python backend/scripts/intent_audit_5portals.py  # invariant lintas-endpoint 25/25 (Owner/Exec/Admin/CRM/Public)
python backend/scripts/intent_audit_remaining.py  # invariant Fixed Assets·Tax·Payment Runs·Bank Recon (21/21; write-path + rollback)
python scripts/health_check.py                   # 25/25 endpoint
python3 scripts/ux_audit.py --strict             # UX gate (0 ERROR) — lihat docs/UX_USABILITY_STANDARD.md
bash scripts/audit_all.sh --strict               # UI density + IA (≤12 item/portal) + parity BE↔FE — lihat memory/UI_IA_PARITY_GUARDRAILS.md
cd backend && python -m pytest -q                 # 215 passed
```

> 🎨 **UI/UX · IA · Parity:** lihat guardrail khusus `memory/UI_IA_PARITY_GUARDRAILS.md` (UI-RC-1..7, PAR-RC-1..3) + skrip `scripts/audit_parity.py`, `scripts/audit_ui_ia.py`, `scripts/audit_all.sh`. Aturan emas: **tema tidak diubah**, viewport acuan **1280×800 (layar 15")**, sidebar **≤12 item/portal & no double-active**, **0 ORPHAN MODULE**.

---

## 9. Registry bug yang sudah diperbaiki (rujukan)

| # | Bug | RC | Fix | Status |
|---|-----|----|----|--------|
| 1 | `Tabs/TabsList` tak di-import → crash | RC-4 | HREmployeeModule | FIXED |
| 2 | `ScanLine` tak di-import → crash | RC-4 | WMSModule | FIXED |
| 3 | Token key `localStorage` salah | RC-2 | 5 modul | FIXED |
| 4 | `body stream already read` (StrictMode) | RC-12 | HRAssetModule | FIXED |
| 5 | Tab nav → render DEFAULT_MODULE | RC-4/14 | PortalShell | FIXED |
| 6 | Announcements 403 superadmin | RC-9 | routes/announcements | FIXED |
| 7 | Payroll count salah (`employment_status`) | RC-2 | payroll_automation | FIXED |
| 8 | AnomalyFeed missing state vars | RC-4 | AnomalyFeed/index | FIXED |
| 9 | Users endpoint salah (`/users`→`/admin/users`) | RC-1 | AnomalyFeed/index | FIXED |
| 10 | `PeriodCompare` SyntaxError → no compile | RC-4 | PeriodCompare | FIXED |
| 11 | AR JE skip (revenue CoA `4101` tak ada) → subledger≠GL | RC-1/RC-7 | services/_ar/journal.py (fallback `4101→4000→4001`) | FIXED |
| 12 | Seed nulis ke DB `aurora_fnb` (bukan `test_database`) → public **news** kosong, tax-sprint1 hilang | RC-1 | core/config.py (load_dotenv@import, override=False) | FIXED |
| 13 | Fixed asset register/list "Total Cost" Rp 0 (field `acquisition_value` ≠ `purchase_cost`) | RC-2 | seed/seed_fixed_asset_normalize.py | FIXED |
| 14 | Loyalty tier-distribution Σ < total (None→bronze ditimpa explicit bronze, `=` bukan `+=`) | RC-7 | admin_loyalty_service.py | FIXED |
| 15 | ClosingWizard stub "Coming Soon" (duplikasi /finance/periods) | — | dihapus dari nav + redirect → /finance/periods | DONE |
| 16 | Transfer/adjustment bisa bikin stok **negatif** (tak ada guard) | RC-7 | inventory_service `_assert_can_decrement` (send_transfer + negative adjustment) | FIXED |
| 17 | Action button irreversible bisa **double-submit** (klik 2×) | RC-10/RC-12 | `components/shared/AsyncButton.jsx` (lock + spinner) di transfer send/receive, adjustment approve | FIXED |

**Regression tests (`backend/tests/`):** `test_auth`, `test_approval`, `test_finance_ar`, `test_inventory`,
`test_journal`, `test_procurement`, `test_period`, `test_bank_recon`, `test_anomaly_feed_regression`,
`test_payment_runs`, `test_threshold_wht_p2`, `test_write_off`.

---

## 10. Env / Infra (jangan diubah)
- Backend bind `0.0.0.0:8001`; semua route `/api`. FE pakai `REACT_APP_BACKEND_URL`.
- **JANGAN ubah** protected keys di `.env` (`MONGO_URL`, `DB_NAME`, `REACT_APP_BACKEND_URL`). DB dari `.env` (jangan hardcode).
- ⚠️ **Wrong-DB seed bug (RC-1):** script standalone yang `import core.*` **sebelum** `load_dotenv` akan baca default `DB_NAME="aurora_fnb"` → nulis ke DB salah (data "hilang" dari app). Dicegah di `core/config.py` (load `.env` saat import, `override=False`). Seed baru: tetap `load_dotenv("/app/backend/.env")` di paling atas, sebelum import `core`.
- Restart hanya setelah ubah `.env`/deps: `sudo supervisorctl restart backend|frontend`.
- Rate-limit `/api/auth/login` ~10 req/60s/IP — beri jeda antar batch login.
- Login demo/bypass: `admin@torado.id / Torado@2026` (SUPER_ADMIN). Token key FE = `aurora_access_token`.

---

## 11. Cara pakai
1. Task baru / fix bug → baca §2 (koleksi) + §3 (cari RC cocok) + jalankan checklist §6.
2. Sebelum klaim selesai → penuhi DoD §7 + jalankan gate §8 + update memori.
3. Bug gagal 2+× → eskalasi RC-15 (§3), jangan diam-diam.
4. Temuan bug baru berpola → tambah ke registry §9 + RC baru di §3.

> Tujuan: tiap sambungan (seed↔koleksi↔service↔API↔FE↔akses) **diverifikasi**, bukan diasumsikan. Dan jika tak bisa — **jujur**.
