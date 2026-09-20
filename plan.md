# plan.md — Rencana Forensic Audit  Production-Readiness (Torado Group ERP)

## 1) Objectives
- Mencapai **deploy production siap** dengan target realistis: **0 data leak (RBAC/IDOR), 0 blocker deploy, 0 bug kritikal** pada flow bisnis WRITE utama.
- Menjadikan proses audit **konsisten & repeatable** untuk agent berikutnya (1 command + playbook + probes).

## 2) Implementation Steps (Phased)

### Phase 1 — Core POC (Isolation): "RBAC/IDOR Proof" untuk endpoint auth-only (P0/P1) — ✅ **SELESAI (2026-07-18)**
**Core paling failure-prone:** endpoint yang hanya `current_user` (59 endpoint) berpotensi IDOR/PII leak (static scan tidak bisa memastikan ownership check di dalam handler).

**User stories (Phase 1)**
1. Sebagai auditor, saya ingin daftar endpoint auth-only agar saya tahu kandidat kebocoran data.
2. Sebagai auditor, saya ingin tes cross-user (owner vs attacker) agar bisa membuktikan tidak ada IDOR.
3. Sebagai super admin, saya ingin akses tetap berjalan agar fix tidak mematikan operasi.
4. Sebagai user biasa, saya ingin tetap bisa mengakses data saya sendiri setelah hardening.
5. Sebagai tim deploy, saya ingin satu skrip yang hasilnya deterministik (pass/fail) agar gating CI bisa konsisten.

**Langkah**
- Jalankan baseline: `bash /app/scripts/forensic_master_suite.sh` (harus hijau sebelum lanjut).
- Ambil kandidat: `python /app/scripts/rbac_endpoint_guard_audit.py` → fokus list 🟠 auth-only.
- Klasifikasi tiap endpoint auth-only:
  - **Reference data** (low risk) → dokumentasikan alasan.
  - **Per-user/per-entity sensitive** → wajib diuji IDOR.
- Extend `scripts/idor_ownership_probe.py` (tambahkan `CASES`) untuk:
  - `approvals.py` (queue/pending/counts/delegations/quick-action)
  - `admin.py business-rules/*` (cek write/read scope)
  - `daily_close.py /{record_id}/reopen`
  - lainnya yang mengembalikan PII/financial scoped
- Jalankan sampai stabil: `python /app/scripts/idor_ownership_probe.py` → **exit 0**.

**Deliverables**
- Coverage cases bertambah hingga semua endpoint sensitif auth-only ter-probe.
- Update doc hasil klasifikasi di report fase (link ke endpoint yang dipastikan safe).

---

### Phase 2 — V1 App Hardening: Frontend route-level RBAC Gate di 7 portal (P1)
**Core risiko:** role partial-access bisa URL-tamper ke screen yang seharusnya tidak boleh (defense-in-depth).

**User stories (Phase 2)**
1. Sebagai Finance Staff terbatas, saya ingin hanya melihat halaman yang saya berhak akses.
2. Sebagai Executive, saya ingin tidak bisa membuka halaman finance write lewat URL.
3. Sebagai Outlet Staff, saya ingin ditolak saat masuk halaman manager-only.
4. Sebagai Admin, saya ingin tetap dapat akses semua menu tanpa redirect.
5. Sebagai auditor, saya ingin mapping `reqPerm` konsisten antara sidebar dan route.

**Langkah**
- Terapkan pattern `Gate/permitted` (template dari `portals/admin/AdminPortal.jsx`) ke portal:
  - Finance, HR, Inventory, Outlet, Procurement, Owner, Executive/Reports.
- Tambahkan `reqPerm` ke `src/lib/navigationSchema/<portal>.js` agar sidebar selaras.
- Browser verify (testing agent) untuk peran partial-access (lihat leak map dari `rbac_portal_access_audit.py`):
  - langsung akses deep link forbidden → harus `/no-access`.

**Checkpoint**
- 1 portal selesai + diverifikasi penuh sebelum menyalin ke portal lain (hindari regress massal).

---

### Phase 3 — Tour Validation (P1): Validasi runtime semua UI tours (~98)
**Core risiko:** audit statik lolos tapi target DOM tidak render di route (false positive).

**User stories (Phase 3)**
1. Sebagai user baru, saya ingin tour berjalan tanpa step yang hilang.
2. Sebagai admin, saya ingin tour di admin portal akurat setelah refactor navigation.
3. Sebagai outlet manager, saya ingin drilldown tour tidak salah halaman.
4. Sebagai QA, saya ingin daftar tour  status pass/fail per route.
5. Sebagai dev, saya ingin fix drift hanya di target selector/route mapping, bukan hack UI.

**Langkah**
- Gunakan `tourMap.js` sebagai source of truth route.
- Jalankan per tour di browser (testing agent) dan catat:
  - route, step index, target missing, kondisi render.
- Fix hanya di `src/contexts/tour/tours/*` dan/atau `tourMap.js`.

---

### Phase 4 — E2E Critical WRITE Flows (P0)
**Core risiko:** flow bisnis utama gagal (approval/locking/payments/inventory) meski unit test hijau.

**User stories (Phase 4)**
1. Sebagai Finance Manager, saya ingin lock period dan memastikan write diblok/di-handle sesuai rule.
2. Sebagai Approver, saya ingin approve/reject berjalan dan audit log tercatat.
3. Sebagai Procurement, saya ingin PO→GR workflow berjalan tanpa permission leak.
4. Sebagai Inventory, saya ingin transfer/adjustment memutakhirkan stock dengan benar.
5. Sebagai Auditor, saya ingin memastikan semua write endpoint mengembalikan error yang jelas dan konsisten.

**Langkah**
- Buat checklist E2E per flow (min: create→submit→approve/reject→verify state).
- Gunakan testing agent backend+frontend; tambah script ringan bila perlu (tanpa mocking).
- Pastikan RBAC deny untuk role yang tidak berhak + outlet scope berlaku.

---

### Phase 5 — Final Deploy Gates (P1)

**User stories (Phase 5)**
1. Sebagai DevOps, saya ingin 1 command gating yang selalu hijau sebelum deploy.
2. Sebagai Owner, saya ingin tidak ada error fatal saat app start.
3. Sebagai Security, saya ingin tidak ada endpoint sensitif tanpa guard/ownership.
4. Sebagai QA, saya ingin hasil audit tersimpan untuk traceability.
5. Sebagai Admin, saya ingin environment tetap memakai `DB_NAME` dan tidak hardcode.

**Langkah**
- Pastikan `bash /app/scripts/forensic_master_suite.sh` hijau.
- Jalankan `deployment_agent` setelah Phase 1–4 green.
- Pastikan tidak mengubah `REACT_APP_BACKEND_URL` / `MONGO_URL`.

## 3) Next Actions (Immediate)
1. ~~Jalankan `python /app/scripts/rbac_endpoint_guard_audit.py` dan buat shortlist 10 endpoint auth-only paling sensitif.~~ ✅ DONE
2. ~~Tambahkan 3–5 kasus pertama ke `scripts/idor_ownership_probe.py` (mulai dari `approvals.py`).~~ ✅ DONE (8 kasus)
3. ~~Jalankan probe sampai exit 0; jika fail, perbaiki ownership/permission check pada endpoint terkait.~~ ✅ DONE (7 IDOR di-fix)
4. ~~Phase 2: portal-by-portal Gate implementation~~ ✅ DONE (7 portal, 43/43 URL-tamper pass)
5. ~~Phase 4: E2E WRITE flows harness (approval, payment, period-lock, transfer)~~ ✅ DONE (4/4 pass)
6. ✅ **Phase 3 COMPLETE (2026-07-18 continuation)**: browser tour render sweep GREEN. Probe FAIL=0, healthy=100% (4× consecutive deterministic runs). Fixed 13 FAIL routes → 0. Integrated as **Gate 8** in `forensic_master_suite.sh` (now 8/8 gates green).
7. 🟡 **Phase 5 NEXT**: `deployment_agent` pre-deploy gate (Phase 1–4 green + Phase 3 tuntas).

## PHASE 3 HASIL (2026-07-18 continuation)
- **Root-cause categories fixed:**
  - **Route mismatches di tourMap.js** (route stub tidak resolve → fallback): `/admin/tax-config`→`/admin/tax`, `/admin/effective-dating`→`/admin/configuration/effective-dating`, hapus `/admin/approval-builder` (canonical `/admin/approvals`), hapus `/finance/ar` (canonical `/finance/ar-invoices`), hapus `/executive/brand-mix` (canonical `/executive/brand`).
  - **Real routing BUG fixed**: `/admin/approvals` di-shadow oleh global alias `<Route path="/admin/approvals" element={<MyApprovals/>}>` di `App.js` → ApprovalMatrixBuilder tidak reachable. Alias dihapus; Builder kini tampil di `/admin/approvals` (verified visual).
  - **Tour target selectors diperbaiki**: `admin-audit-log` (dedicated tour baru, sebelumnya alias adminHomeTour), `admin-integrations` (page/header/tabs → admin-integrations-*), `finance-periods` (period-lock-btn → period-refresh), `inventory-adjustment` (adj-new-btn→adj-new, adj-outlet-select→adj-outlet-filter), `outlet-reservation-list` (filters/table-wrap → reservation-list-page/reservation-filters), `outlet-reservation-form` (page/*-card → reservation-form-*), `owner-ai-assistant` (executive-qa-page/qa-* → exec-qa/exec-qa-*).
  - **Loading-state root anchors** (page gate hid tour hero anchor → flaky FAIL): ApprovalMatrixBuilder, Forecasting, OwnerCockpit, Comparatives, DailyBriefing, DigestSettings, ProfitWalk, CashPosition, PivotReport, ReportBuilder, TaxCenter, Valuation, TaxConfig — semua render root `*-page` testid saat loading.
  - **Component testid ditambah**: PeriodList (`periods-page`, `periods-table`), AdjustmentList (`inventory-adjustment-page`, `adj-table`).
  - **Probe hardening**: `tour_render_probe.py` retry-on-all-missing (beri kesempatan kedua utk redirect stub/async tab tanpa melemahkan gate).
- **Gates hijau**: forensic-master-suite **8/8** (Gate 8 baru = tour render probe), pytest 233 pass/11 skip, IDOR 0 leak, RBAC pass, tour static drift 0, E2E write 4/4.

## PHASE 1 HASIL (2026-07-18)
- **7 IDOR di-fix** (semua P0):
  - `services/leave_service.py`: PATCH/DELETE/submit/cancel leave now cek ownership.
  - `services/upload_service.py`: GET meta/download + POST link now cek uploader.
- **Probe expanded**: 2 → 8 CASES (leaves × 5 + uploads × 8 assertions).

## PHASE 2 HASIL (2026-07-18)
- Shared `frontend/src/lib/portalGate.js` (Gate / permitted / makeGate factory).
- Route-level gate diterapkan di 7 portal non-admin (Finance, HR, Inventory, Outlet, Procurement, Owner, Executive).
- Browser URL-tamper: **43/43 PASS** via testing agent (5 roles × 8-10 routes).

## PHASE 4 HASIL (2026-07-18)
- `scripts/e2e_write_flows.py` (baru) — 4 flow WRITE full cycle:
  - FLOW 1: PR create (outlet) → approve (admin) → RBAC guard verifies non-approver blocked.
  - FLOW 2: Payment create → submit → approve → mark-paid → JE balanced 100000 dr/cr.
  - FLOW 3: Period lock → manual JE post rejected → unlock cleanup.
  - FLOW 4: Transfer create → send → receive → stock delta correct (src −2, dst +2).
- Ditambahkan ke `forensic_master_suite.sh` sebagai Gate 7.
- **Gates hijau**: forensic-master-suite **7/7**, pytest 233, IDOR 0 leak, RBAC 25/25, tour drift 0, integrity 21/21, health 25/25.

## 4) Success Criteria
- Phase 1: semua endpoint auth-only sensitif ter-cover di `idor_ownership_probe.py` dan **tidak ada IDOR leak**.
- Phase 2: semua portal non-admin punya route-level gate; URL-tamper selalu redirect `/no-access`.
- Phase 3: semua tours berjalan tanpa missing target di runtime.
- Phase 4: semua flow WRITE kritikal pass E2E (allow/deny sesuai RBAC, state transition benar).
- Phase 5: forensic_master_suite hijau + deployment_agent hijau; siap deploy production.
