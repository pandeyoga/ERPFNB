# Audit UI/UX — Procurement

Bagian dari [Laporan Audit UI/UX 2026-10-24](../UI_UX_AUDIT_2026-10-24.md). Setiap halaman: file sumber, state yang diperiksa (halaman, tab, dialog), jumlah temuan otomatis crawler sebelum → sesudah, lalu temuan review visual + perbaikannya.

## `/procurement` — Procurement Overview

- **File:** `frontend/src/portals/procurement/ProcurementHome.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 91px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-HOME-01 | page | title | P2 | Tidak ada <h1>; judul berupa kartu welcome bespoke (h2 text-xl font-bold, p-6). | Diganti PageHeader (testId procurement-welcome dipertahankan) dengan aksi Buka Kanban / Bandingkan vendor / PR Baru. | Diperbaiki |
| PRC-HOME-02 | page | button | P2 | Tombol pintasan berupa <button> mentah rounded-full text-xs yang dibungkus <Link> (button di dalam anchor). | Button asChild variant outline (testid qa-kanban/qa-vc tetap). | Diperbaiki |
| PRC-HOME-03 | page | ia | P2 | Tile KPI ke-4 'Quick Actions' tanpa nilai (tombol 114px) dan memakai window.location.assign (reload penuh). | Tile dihapus; aksi 'PR Baru' pindah ke PageHeader. | Diperbaiki |
| PRC-HOME-04 | page | card | P3 | KpiCard dipakai tanpa delta/sparkline; tile tidak bisa diklik ke daftar terkait. | CompactStatCard (3 kolom) yang membuka /procurement/pr?status=submitted, /procurement/po?status=sent, /procurement/gr (daftar PR/PO kini membaca ?status=). | Diperbaiki |
| PRC-HOME-05 | page | card | P3 | Kartu 'Recent' p-5 dengan baris berupa kartu glass-input di dalam kartu; spacing space-y-6/gap-5. | Kartu p-4, daftar divide-y, space-y-3 lg:space-y-4 & gap-3 lg:gap-4. | Diperbaiki |
| PRC-HOME-06 | page | language | P3 | Campuran istilah: 'Recent Purchase Requests', 'PR Pending', 'PO Open', 'All-time'. | 'Purchase Requests terbaru', 'PR menunggu approval', 'PO terkirim (open)', 'Sepanjang waktu'. | Diperbaiki |

## `/procurement/kanban` — PO Kanban Board

- **File:** `frontend/src/portals/procurement/KanbanWorkboard.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-KAN-02 | page | layout | P1 | Board lg:grid-cols-7 di area ~1000px: kolom ±130px, nomor dokumen terpotong 'PR-…', tanggal patah 3 baris, halaman 9.494px karena kolom PO Received berisi 46 kartu. | Kolom lebar tetap 248px dengan scroll horizontal (snap) + scroll vertikal per kolom (max-h viewport); header kolom h3 11px uppercase; judul kartu font-mono text-xs tidak lagi terpotong. | Diperbaiki |
| PRC-KAN-01 | page | title | P2 | Tidak ada <h1>; judul h2 text-lg font-bold di dalam kartu filter. | PageHeader 'PO Kanban Board' (testId wb-header), jumlah kartu & waktu refresh di subtitle (wb-meta/wb-total-count tetap). | Diperbaiki |
| PRC-KAN-03 | page | a11y | P2 | Link 'Buka detail' 24px tanpa nama dokumen; label filter <label htmlFor> tidak terhubung ke SimpleSelect. | Button icon-sm dengan aria-label 'Buka detail {doc}' (stopPropagation pointer agar tidak memicu drag); filter memakai ariaLabel. | Diperbaiki |
| PRC-KAN-04 | page | button | P3 | Refresh size sm + h-9 rounded-full override; tombol empty state pill-active rounded-full. | Button outline default 'Muat ulang' di header; empty state Button default/outline. | Diperbaiki |
| PRC-KAN-05 | page | language | P3 | Legend bahasa Inggris ('Approve PR/PO', 'Send to Vendor', 'Receive (open GR form)'), '(kosong)', 'lines', toast 'Gagal load workboard'; legend di kartu terpisah di bawah board 9.000px. | Teks Indonesia; legend dipindah ke baris filter. | Diperbaiki |
| PRC-KAN-06 | page | ia | P3 | Nama nav 'PO Kanban Board' padahal board juga berisi kolom PR (Draft/Pending/Approved). | Nama menu & judul 'Procurement Kanban' (UX-G-41). | Diperbaiki |

## `/procurement/vendor-comparison` — Vendor Comparison

- **File:** `frontend/src/portals/procurement/VendorComparison.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-VC-01 | page | title | P2 | Tidak ada <h1> (h2 di dalam kartu); select periode memanjang full-width di samping judul. | PageHeader + select periode w-[170px] di actions. | Diperbaiki |
| PRC-VC-02 | page | button | P2 | Chip item <button> mentah text-xs, tombol 'Clear' h-6 text-[11px] rounded-full; teks 'selected', 'Selected:', 'Clear', 'Max 10 item'. | Button size sm outline/default + aria-pressed; 'dipilih', 'Dipilih:', 'Hapus semua', 'Maksimal 10 item'; tombol hapus chip punya aria-label nama item. | Diperbaiki |
| PRC-VC-04 | form | form | P2 | Input cari item tanpa label terhubung dan override h-10. | Label htmlFor + id, tinggi default h-9. | Diperbaiki |
| PRC-VC-05 | page | ia | P2 | Halaman tidak ada di sidebar (hanya via pill di Vendors/Overview) dan breadcrumb hanya 'Beranda › Procurement'. | Diperbaiki global oleh lead (breadcrumb/sidebar via matchPaths). | Diperbaiki |
| PRC-VC-06 | page | ia | P2 | Duplikasi: panel 'Scorecard performa vendor' tumpang tindih dengan /procurement/vendor-scorecard dan /finance/vendor-scorecard; perbandingan harga per item juga ada di PO Comparison dan tab Perbandingan RFQ. | Butuh keputusan. Rekomendasi: Vendor Comparison fokus ke perbandingan harga per item; panel scorecard diganti tautan ke Procurement › Vendor Scorecard. | Terbuka |
| PRC-VC-03 | page | card | P3 | Tile scorecard lokal (rounded-xl p-4, text-2xl font-extrabold); kartu p-5/p-10. | CompactStatCard dengan tone success/warning/danger; kartu p-4; judul seksi h2 text-base md:text-lg. | Diperbaiki |

## `/procurement/vendor-recommend` — Vendor Recommendation

- **File:** `frontend/src/portals/procurement/VendorRecommendPage.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-VR-02 | page | flow | P1 | Link 'Detail vendor' ke /admin/vendors/:id; route tidak ada (redirect ke /admin). | Diganti 'Katalog vendor' ke /procurement/vendor-catalog?vendor=<id> (katalog kini membaca param). | Diperbaiki |
| PRC-VR-01 | page | title | P2 | h1 18px bold di kartu hero bespoke (ikon 48px rounded-2xl, p-5); nama 'Rekomendasi Vendor (AI)' tidak konsisten dengan istilah ERP. | PageHeader 'Vendor Recommendation' (testId vrec-header), 'Salin link' di actions. | Diperbaiki |
| PRC-VR-03 | page | flow | P2 | 'Buat PO' mengirim ?vendor_id=&item_id= tapi POForm tidak membacanya, jadi vendor kosong. | POForm kini memilih vendor dari ?vendor_id; ?item_id masih diabaikan. | Diperbaiki |
| PRC-VR-04 | page | language | P2 | Empty state teknis ('buka link dengan parameter ?item_id= / ?pr_id='); 'Copy Link', 'Top Vendor', 'Avg/Last/Last receipt'. | EmptyState berbahasa Indonesia; 'Salin link', 'Vendor teratas', 'Rata-rata/Terakhir/Terakhir diterima'. | Diperbaiki |
| PRC-VR-06 | form | a11y | P2 | Input cari item (ItemAutocomplete) tanpa label terhubung/aria-label. | Diselesaikan di komponen bersama — ItemAutocomplete meneruskan id/ariaLabel ke Input. | Diperbaiki (komponen shared) |
| PRC-VR-05 | page | card | P3 | Kartu kandidat glass-input rounded-2xl di dalam kartu; p-5/p-8; label 'CARI ITEM' uppercase; tombol rounded-full. | Kandidat border rounded-lg p-3, kartu p-4, label text-xs md:text-sm, Button tanpa override. | Diperbaiki |

## `/procurement/price-intelligence` — Price Intelligence

- **File:** `frontend/src/portals/procurement/PriceIntelligence.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-PI-02 | page | card | P2 | 4 tile Card lokal (border-l-4, text-2xl bold, tanpa ikon). | CompactStatCard grid-cols-2 md:grid-cols-4 dengan tone (testid tile & nilai dipertahankan). | Diperbaiki |
| PRC-PI-03 | page | a11y | P2 | Tombol refresh ikon tanpa aria-label. | Button outline icon dengan aria-label 'Muat ulang data'. | Diperbaiki |
| PRC-PI-04 | page | layout | P2 | grid-cols-4/grid-cols-3 tetap (tidak responsif), gap-6/mb-6; warna hardcoded gray/bg-red-50/bg-orange-50 rusak di dark mode. | Grid responsif gap-3 lg:gap-4; token muted-foreground dan warna /5 /15 dengan varian dark. | Diperbaiki |
| PRC-PI-05 | page | runtime | P2 | Ganti filter kategori mengganti seluruh halaman dengan spinner (layout melompat); error API tidak ditangani. | Loading di tabel & tile, toast error. | Diperbaiki |
| PRC-PI-01 | page | title | P3 | h1 bespoke text-2xl font-bold text-gray-900 dan wrapper p-6 (padding ganda dengan shell). | PageHeader (testId price-intel-header, price-intel-quarter tetap di subtitle); p-6 dihapus. | Diperbaiki |
| PRC-PI-06 | page | form | P3 | Select kategori custom tanpa label; empty state ad-hoc (ikon 48px opacity-30). | SimpleSelect + ariaLabel; EmptyState. | Diperbaiki |

## `/procurement/vendor-catalog` — Vendor Item Catalog

- **File:** `frontend/src/portals/procurement/VendorCatalog.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 56, 57px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-CAT-02 | page | layout | P2 | grid-cols-4 tetap (tidak responsif), gap-6; warna hardcoded (bg-blue-50, text-gray-*, bg-red-50) tidak mendukung dark mode. | grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4; token tema & warna transparan dengan varian dark. | Diperbaiki |
| PRC-CAT-03 | page | a11y | P2 | Aksi baris (Histori/Toggle ketersediaan) ikon-saja hanya dengan title; tombol paging ikon tanpa label; input cari tanpa label. | Button icon-sm + aria-label; input aria-label. | Diperbaiki |
| PRC-CAT-04 | page | ia | P2 | Tidak bisa membuka katalog vendor tertentu lewat link. | ?vendor=<id> memilih vendor otomatis dan URL diperbarui saat memilih vendor. | Diperbaiki |
| PRC-CAT-01 | page | title | P3 | h1 bespoke text-2xl bold + p-6; tombol refresh ikon tanpa label. | PageHeader + Button outline 'Muat ulang'. | Diperbaiki |
| PRC-CAT-05 | page | card | P3 | State kosong ad-hoc (h-64, ikon besar); error histori harga tidak ditangani; toast 'Gagal' tanpa konteks. | EmptyState; toast error yang jelas. | Diperbaiki |

## `/procurement/rfq` — RFQ

- **File:** `frontend/src/portals/procurement/RFQList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-RFQ-02 | page | form | P2 | Input cari tanpa label; select status tanpa aria-label. | aria-label pada input & SelectTrigger; filter dalam glass-card p-3. | Diperbaiki |
| PRC-RFQ-03 | page | language | P2 | Map status lokal (Badge custom, label Indonesia 'Dikirim/Quotes Masuk/Diterima') berbeda dari kamus StatusPill global. | StatusPill untuk kolom status; opsi filter memakai statusLabel() (testid rfq-status-* tetap di wrapper). | Diperbaiki |
| PRC-RFQ-01 | page | title | P3 | h1 bespoke text-2xl font-bold; wrapper p-6 + space-y-6 (padding ganda); judul tidak sama dengan nav 'RFQ'. | PageHeader 'RFQ' (subtitle Request for Quotation), tombol 'Buat RFQ' di actions. | Diperbaiki |
| PRC-RFQ-04 | page | card | P3 | Empty state ad-hoc py-12 (juga muncul saat filter tanpa hasil); meta 'Menampilkan x dari y' di luar kartu. | EmptyState (varian 'Tidak ada RFQ yang cocok' saat filter aktif); meta jadi footer tabel. | Diperbaiki |
| PRC-RFQ-05 | page | button | P3 | Tombol 'Detail' outline di baris yang juga bisa diklik; header kolom 'Quotes'; 'Refresh daftar RFQ'. | Detail ghost sm; 'Penawaran'; 'Muat ulang'. | Diperbaiki |
| PRC-RFQ-06 | page | runtime | P3 | Pencarian memanggil API di setiap ketikan (tanpa debounce). | Pencarian RFQ di-debounce (terverifikasi 1 request untuk 6 karakter). | Diperbaiki |

## `/procurement/rfq/new` — RFQ Baru

- **File:** `frontend/src/portals/procurement/RFQDetail/index.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 5 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 38px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-RFQN-02 | form | form | P2 | 7 input tanpa label terhubung (Label tanpa htmlFor; baris item hanya placeholder). | Label htmlFor/id; aria-label per baris (nama, qty, unit, est. harga). | Diperbaiki |
| PRC-RFQN-01 | page | title | P3 | h1 bespoke xl bold; tombol kembali ikon-saja tanpa aria-label; wrapper p-6. | Ghost 'Kembali ke RFQ' + PageHeader 'RFQ Baru'. | Diperbaiki |
| PRC-RFQN-03 | form | a11y | P3 | Toggle vendor tanpa aria-pressed; ikon tombol dengan override mr-2. | aria-pressed; ikon mengikuti gap Button. | Diperbaiki |
| PRC-RFQN-04 | form | ia | P3 | Daftar vendor hanya 20 pertama dari halaman 1 /master/vendors, tanpa pencarian. | Form RFQ memuat semua vendor aktif (fetchAll) dengan kotak pencarian; vendor terpilih tetap tampil. | Diperbaiki |

## `/procurement/rfq/:id` — RFQ detail (No. RFQ)

- **File:** `frontend/src/portals/procurement/RFQDetail/index.jsx`
- **State diperiksa:** halaman + 2 tab, 0 dialog
- **Temuan otomatis (crawler):** — → 0
- **Tab:** Penawaran (0), Perbandingan

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-RFQD-01 | page | title | P2 | h1 bespoke; tombol kembali dan refresh ikon-saja tanpa aria-label; wrapper p-6. | PageHeader (No. RFQ, subtitle status + judul), ghost 'Kembali ke RFQ', aria-label pada refresh. | Diperbaiki |
| PRC-RFQD-02 | page | language | P2 | Badge status menampilkan enum mentah (`quotes_received`, `accepted`); tab 'Overview/Quotes'; 'Quoted', 'Edit Quote/Masukkan Quote'. | StatusPill global (testid rfq-detail-status tetap); tab 'Ringkasan/Penawaran/Perbandingan'; 'Sudah menawar', 'Ubah/Input penawaran'. | Diperbaiki |
| PRC-RFQD-03 | page | flow | P2 | Badge 'PO Dibuat' tidak menautkan ke PO hasil accept. | Tombol outline 'Lihat PO' ke /procurement/po/{po_id}. | Diperbaiki |
| PRC-RFQD-04 | dialog:Penawaran | form | P2 | Label dialog input penawaran tanpa htmlFor. | id/htmlFor per field; judul dialog 'Penawaran — {vendor}'. | Diperbaiki |
| PRC-RFQD-05 | tab:Perbandingan | card | P3 | Empty state ad-hoc; loading spinner custom; 'RFQ tidak ditemukan' teks polos; semua tombol 'Terima {vendor}' primary. | EmptyState/LoadingState (dengan tombol kembali); tombol terima jadi outline. | Diperbaiki |

## `/procurement/pr` — Purchase Requests

- **File:** `frontend/src/portals/procurement/PRList.jsx`
- **State diperiksa:** halaman + 5 tab, 0 dialog
- **Temuan otomatis (crawler):** 13 → 0
- **Tab:** Draft, Submitted, Approved, Rejected, Converted

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-PR-01 | page | title | P2 | Tidak ada judul halaman; halaman dimulai dengan kartu filter. | PageHeader 'Purchase Requests' dengan aksi 'Ekspor Excel' (outline) + 'PR Baru'. | Diperbaiki |
| PRC-PR-02 | page | language | P2 | Kolom status menampilkan enum mentah `converted_to_po`. | Teratasi oleh kamus StatusPill global ('Converted to PO'); tidak ada map lokal. | Diperbaiki |
| PRC-PR-03 | page | ia | P2 | Sel Outlet kosong untuk sebagian PR (mis. PR-2610-0022): peta nama hanya dari scopedOutlets, dengan fallback outlet_id kosong/UUID. | Peta dari allOutlets + scoped, fallback outlet_name lalu '—'. | Diperbaiki |
| PRC-PR-04 | page | tabs | P2 | Filter status berupa pill <button> custom (text-xs px-3 py-1.5) di luar kartu, berbeda dari Tabs. | Tabs/TabsList/TabsTrigger tanpa override, satu toolbar dengan filter outlet/source (testid pr-status-tabs/pr-tab-* & pr-filters-card tetap). | Diperbaiki |
| PRC-PR-05 | page | button | P2 | Tombol h-10 rounded-full pill-active px-5; Prev/Next <button> mentah 26px; link 'Detail' 20px. | Button default/outline, paging outline sm 'Sebelumnya/Berikutnya', Detail ghost sm. | Diperbaiki |
| PRC-PR-08 | tab:Converted | runtime | P2 | Tab Converted kosong padahal ada 5 PR seed berstatus `converted_to_po`; filter mengirim status=converted (nilai yang dipakai service). | Diperbaiki terpusat: status converted_to_po → converted (UX-G-43). | Diperbaiki |
| PRC-PR-06 | page | language | P3 | 'Export Excel' di samping verb Indonesia; source mentah 'manual'; kolom 'Lines'. | 'Ekspor Excel', label source 'Manual/KDO/BDO', kolom 'Item'. | Diperbaiki |
| PRC-PR-07 | tab:Converted | flow | P3 | Saat tab filter tanpa hasil, empty state 'Belum ada PR — Buat PR' (menyesatkan). | Empty state 'Tidak ada PR yang cocok' saat ada filter. | Diperbaiki |

## `/procurement/pr/new` — PR Baru

- **File:** `frontend/src/portals/procurement/PRForm.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-PRN-02 | form | runtime | P1 | Dropdown Brand selalu kosong karena state brands tidak pernah dimuat (setBrands tidak dipanggil). | Muat /master/brands (active) dengan fetchAll. | Diperbaiki |
| PRC-PRN-01 | page | title | P2 | Tidak ada <h1> (h2 text-xl font-bold). | Ghost 'Kembali' + PageHeader 'PR Baru' dengan aksi 'Simpan draft' (outline) + 'Ajukan PR'. | Diperbaiki |
| PRC-PRN-03 | form | form | P2 | 8 input tanpa label terhubung; label uppercase muted; 'Needed By', 'Est. Cost'. | Label htmlFor/id, ariaLabel di SimpleSelect, aria-label input baris; label text-xs md:text-sm font-medium; 'Dibutuhkan tanggal', 'Est. harga'. | Diperbaiki |
| PRC-PRN-04 | form | a11y | P2 | Tombol hapus baris <button> ikon tanpa aria-label. | Button ghost icon-sm + aria-label 'Hapus baris n'. | Diperbaiki |
| PRC-PRN-05 | form | button | P3 | Override rounded-full/pill-active; verb 'Submit'; card p-5, space-y-5. | Button tanpa override, 'Ajukan PR', 'Tambah item'; card p-4, space-y-3 lg:space-y-4. | Diperbaiki |
| PRC-PRN-06 | form | a11y | P3 | Input item (ItemAutocomplete) tanpa label/aria-label. | Diselesaikan di komponen bersama — ItemAutocomplete meneruskan id/ariaLabel. | Diperbaiki (komponen shared) |

## `/procurement/pr/:id` — Detail PR (No. PR)

- **File:** `frontend/src/portals/procurement/PRDetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-PRD-02 | page | flow | P1 | 'Buat PO dari PR' membuka /procurement/pos/new; route itu tidak ada, jadi pengguna dilempar ke Overview. | Path diperbaiki ke /procurement/po/new?pr=<id>. | Diperbaiki |
| PRC-PRD-03 | page | flow | P1 | Tombol Approve & Reject tampil pada PR berstatus Approved (state workflow seed belum complete). | Approve/Reject & info 'Tahap saat ini' hanya untuk status submitted/awaiting_approval. | Diperbaiki |
| PRC-PRD-01 | page | title | P2 | Tidak ada <h1>; h2 'PR PR-SEED-0001' (prefix ganda). | PageHeader dengan judul No. PR (testid pr-detail-doc-no), subtitle status + outlet, ghost 'Kembali'. | Diperbaiki |
| PRC-PRD-04 | page | button | P2 | Tombol konversi bergradien emerald custom; pill-active/rounded-full; konfirmasi reject bukan destructive; label 'Approve/Reject'. | Button default, Tolak outline teks destructive; dialog 'Tolak PR' variant destructive; 'Setujui/Tolak' + toast Indonesia. | Diperbaiki |
| PRC-PRD-05 | dialog:Tolak PR | form | P2 | Textarea alasan tanpa label terlihat dan tanpa tanda wajib. | Label htmlFor 'Alasan penolakan *' (dialog dipertahankan, bukan promptDialog, agar testid pr-reject-* tetap). | Diperbaiki |
| PRC-PRD-06 | page | ia | P3 | 'Converted to PO' menampilkan potongan UUID <code> tanpa link. | Link 'Lihat PO …' ke detail PO. | Diperbaiki |
| PRC-PRD-07 | page | card | P3 | Kartu p-5/gap-5; judul seksi campur ('Approval Progress', 'Line Items', 'Approval Timeline'); 'PR tidak ditemukan' teks polos. | p-4, h3 text-sm md:text-base; 'Progres approval', 'Item', 'Riwayat approval'; EmptyState dengan tombol kembali. | Diperbaiki |

## `/procurement/po` — Purchase Orders

- **File:** `frontend/src/portals/procurement/POList.jsx`
- **State diperiksa:** halaman + 7 tab, 0 dialog
- **Temuan otomatis (crawler):** 13 → 0
- **Tab:** Draft, Awaiting approval, Approved, Sent, Partial, Received, Cancelled

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-PO-01 | page | title | P2 | Tidak ada judul halaman; halaman dimulai dengan kartu filter. | PageHeader 'Purchase Orders' + 'Ekspor Excel' (outline) + 'PO Baru'. | Diperbaiki |
| PRC-PO-02 | page | tabs | P2 | Filter status pill custom; status valid 'awaiting_approval' dan 'approved' tidak punya filter. | Tabs tanpa override dalam toolbar filter; tambah tab 'Awaiting approval' & 'Approved' (label sejalan StatusPill). | Diperbaiki |
| PRC-PO-03 | page | button | P2 | Tombol h-10 rounded-full pill-active; Prev/Next <button> mentah 26px; link Detail 20px. | Button default/outline, paging outline sm, Detail ghost sm. | Diperbaiki |
| PRC-PO-04 | page | language | P3 | 'Export Excel', 'Lines'; vendor fallback UUID; empty state 'Belum ada PO' juga muncul saat filter tab kosong. | 'Ekspor Excel', 'Item', fallback '—', empty state sadar filter. | Diperbaiki |
| PRC-PO-05 | page | a11y | P3 | Filter outlet (OutletScopePicker) tanpa aria-label/label terhubung. | Diselesaikan di komponen bersama — OutletScopePicker menerima ariaLabel/id. | Diperbaiki (komponen shared) |

## `/procurement/po/new` — PO Baru

- **File:** `frontend/src/portals/procurement/POFormPkg/index.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-PON-02 | form | layout | P1 | Di 1280px kolom utama hanya 2/3: tabel item terpotong (Diskon/Pajak/Subtotal tersembunyi) dan picker Outlet meluber keluar kartu. | Panel Vendor Comparison baru jadi kolom kanan di 2xl (di bawah form untuk ≤1536px); picker outlet fleksibel. | Diperbaiki |
| PRC-PON-03 | form | flow | P1 | PR Consolidation mengirim ?prefill= (item gabungan + pr_ids) tapi POForm tidak membacanya, jadi form PO kosong. | POForm membaca ?prefill (lines, pr_ids, note) dan ?vendor_id. | Diperbaiki |
| PRC-PON-01 | page | title | P2 | Tidak ada <h1> (h2 'PO Baru'). | Ghost 'Kembali' + PageHeader 'PO Baru' dengan 'Simpan PO'. | Diperbaiki |
| PRC-PON-04 | form | a11y | P2 | 3 tombol aksi baris <button> ikon tanpa aria-label (hapus, tandai tidak tersedia, vendor alternatif); input baris tanpa label. | Button ghost icon-sm + aria-label; aria-label pada input qty/unit/harga/diskon/pajak. | Diperbaiki |
| PRC-PON-05 | form | form | P2 | Label uppercase tanpa htmlFor, bahasa Inggris ('Order Date', 'Expected Delivery', 'Payment Terms', 'Delivery Outlet'). | htmlFor/id; 'Tanggal order', 'Estimasi tiba', 'Termin pembayaran', 'Outlet tujuan'. | Diperbaiki |
| PRC-PON-06 | form | ia | P3 | 'Source PR' berupa potongan UUID <code>; 'Cari Alt. Vendor →' h-5 override. | Link ke tiap PR; tombol variant link 'Cari vendor alternatif'. | Diperbaiki |
| PRC-PON-07 | form | a11y | P3 | VendorAutocomplete/ItemAutocomplete dan OutletScopePicker tanpa label terhubung. | Diselesaikan di komponen bersama — (id/ariaLabel diteruskan). | Diperbaiki (komponen shared) |

## `/procurement/po/:id` — Detail PO (No. PO)

- **File:** `frontend/src/portals/procurement/PODetail.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-POD-01 | page | title | P2 | Tidak ada <h1>; h2 'PO PO-DEMO-0001' (prefix ganda). | PageHeader judul No. PO, subtitle status + vendor, ghost 'Kembali'. | Diperbaiki |
| PRC-POD-02 | page | button | P2 | rounded-full/pill-active di semua aksi; konfirmasi Cancel/Reject bukan destructive; label 'Cancel', 'Reject', 'Approve', 'Submit for Approval', 'Download PDF'. | Variant standar, dialog konfirmasi destructive; 'Batalkan PO', 'Tolak', 'Setujui', 'Ajukan approval', 'Unduh PDF', 'Kirim ke vendor', 'Terima barang (GR)'. | Diperbaiki |
| PRC-POD-03 | page | ia | P2 | PO berstatus Received tetap menampilkan 'Tahap saat ini: Procurement Manager'. | Info tahap hanya untuk status draft/awaiting_approval. | Diperbaiki |
| PRC-POD-04 | dialog:Batalkan PO | form | P2 | Textarea alasan cancel/reject tanpa label; dialog email memakai <label> mentah uppercase. | Label htmlFor 'Alasan … *' (dialog dipertahankan agar testid po-cancel-*/po-reject-* tetap); Label komponen di dialog email ('Kepada *', 'Subjek', 'Pesan'). | Diperbaiki |
| PRC-POD-05 | dialog:Email Purchase Order | language | P3 | Emoji 📎/📧 di riwayat email & dialog; 'Email Log'; label field Inggris ('Delivery To', 'Order Date', 'Sent At', 'Tax'). | Ikon FileDown/teks; 'Riwayat email', 'Kirim ke', 'Tanggal order', 'Dikirim', 'Pajak'. | Diperbaiki |
| PRC-POD-06 | page | card | P3 | Kartu p-5, total font-bold, vendor fallback UUID, 'PO tidak ditemukan' teks polos. | p-4, font-semibold, fallback '—', EmptyState dengan tombol kembali. | Diperbaiki |

## `/procurement/gr` — Goods Receipt

- **File:** `frontend/src/portals/procurement/GRList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 2 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 16px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-GR-01 | page | title | P2 | Tidak ada <h1>: kartu header dengan h3 'Goods Receipts' (beda dengan nav). | PageHeader 'Goods Receipt' (testId gr-list-header), InlineHelp & 'Posting GR' di actions. | Diperbaiki |
| PRC-GR-02 | page | button | P2 | Tombol h-10 rounded-full pill-active; Prev/Next <button> mentah tanpa aria-label. | Button default; paging outline sm dengan aria-label. | Diperbaiki |
| PRC-GR-04 | page | ia | P2 | Tidak ada filter (vendor/outlet/tanggal) dan tidak ada detail GR; penanda JE tidak bisa diklik padahal tour menyebut 'klik untuk lihat detail JE'. | Filter outlet/vendor/tanggal terima/cari no. GR atau invoice (server-side); baris GR bisa dibuka untuk melihat item, PO & termin; penanda JE menjadi tautan ke detail jurnal bagi user Finance. | Diperbaiki |
| PRC-GR-03 | page | ia | P3 | Kolom JE tanpa header; vendor/outlet fallback UUID. | Header 'Jurnal', tanda '—' bila kosong. | Diperbaiki |

## `/procurement/gr/new` — Posting Goods Receipt

- **File:** `frontend/src/portals/procurement/GRForm.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-GRN-02 | form | runtime | P1 | GR dari PO (?po=): field Vendor yang terkunci menampilkan UUID karena vendor_name tidak pernah diisi. | Nama vendor diambil dari /master/vendors/{id} saat prefill. | Diperbaiki |
| PRC-GRN-01 | page | title | P2 | Tidak ada <h1> (h2 xl bold); badge PO terpisah di baris judul. | Ghost 'Kembali' + PageHeader 'Posting Goods Receipt' (badge 'Dari PO …' sebagai children), aksi 'Posting GR'. | Diperbaiki |
| PRC-GRN-03 | form | form | P2 | 11 input tanpa label terhubung; label Inggris uppercase ('Receive Date', 'Invoice No', 'Tax Rate (e.g. 0.11)', 'Note'). | htmlFor/id + aria-label baris; 'Tanggal terima', 'No. invoice', 'Tarif pajak (desimal, mis. 0.11)', 'Catatan'. | Diperbaiki |
| PRC-GRN-04 | form | a11y | P2 | Tombol hapus baris ikon tanpa aria-label. | Button ghost icon-sm + aria-label. | Diperbaiki |
| PRC-GRN-05 | form | layout | P3 | OutletScopePicker (min-w 200px + badge) melebar keluar kolom; kartu p-5; 'Post GR'. | Trigger dibuat fleksibel di dalam kolom; p-4; 'Posting GR'. | Diperbaiki |

## `/procurement/consolidation` — PR Consolidation

- **File:** `frontend/src/portals/procurement/PRConsolidation.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 1
- **Sisa sinyal otomatis (heuristik):** Tinggi tombol non-standar: 79, 80px (standar 32/36/40)

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-CON-01 | page | runtime | P1 | Total PR dan harga satuan PO hasil konsolidasi selalu Rp 0: kode membaca `unit_cost`, padahal baris PR menyimpan `est_cost`. | lineCost() membaca est_cost (fallback unit_cost). | Diperbaiki |
| PRC-CON-02 | page | flow | P1 | 'Generate PO' membuka form PO kosong (param prefill diabaikan POForm). | POForm kini membaca prefill (lihat PRC-PON-03). | Diperbaiki |
| PRC-CON-03 | page | layout | P2 | Select filter status/outlet full-width bertumpuk; ikon Filter dekoratif; wrapper max-w-6xl. | Select w-[160px]/w-[180px] sebaris + ariaLabel; wrapper penuh. | Diperbaiki |
| PRC-CON-04 | page | button | P2 | 'Select All' <button> mentah bergaya link; 'Generate PO' h-8 text-xs rounded-full pill-active. | Button ghost sm 'Pilih semua'; aksi utama 'Buat PO dari N PR' di PageHeader actions (testid tetap). | Diperbaiki |
| PRC-CON-05 | page | language | P3 | Teks 'unique items', 'items', '•'; outlet fallback UUID. | 'Hasil konsolidasi (n item unik)', 'item', '·', '—'. | Diperbaiki |
| PRC-CON-06 | page | a11y | P3 | Baris PR berfungsi sebagai checkbox tanpa role/aria-checked. | role=checkbox + aria-checked. | Diperbaiki |

## `/procurement/po-comparison` — PO Comparison

- **File:** `frontend/src/portals/procurement/POComparison.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-POC-01 | page | layout | P2 | Select filter vendor/status full-width bertumpuk (2 baris 40px); ikon Filter dekoratif; wrapper max-w-7xl. | Select lebar tetap sebaris + ariaLabel; status 'Partial' ditambahkan. | Diperbaiki |
| PRC-POC-02 | page | button | P2 | Setiap baris PO punya tombol primary 'Bandingkan' (banyak primary) dengan override rounded-full h-8 text-xs. | Button outline/secondary sm dengan aria-pressed. | Diperbaiki |
| PRC-POC-04 | page | ia | P2 | Duplikasi parsial: membandingkan harga per item lintas PO tumpang tindih dengan Vendor Comparison (per item lintas vendor) dan tab Perbandingan di RFQ. | Butuh keputusan. Rekomendasi: jadikan PO Comparison tab 'Per PO' di Vendor Comparison (satu tempat perbandingan harga), RFQ tetap punya tab Perbandingan untuk penawaran. | Terbuka |
| PRC-POC-03 | page | language | P3 | 'items', 'Side-by-Side', 'Cell hijau … tsb'; vendor fallback UUID. | 'item', 'Perbandingan berdampingan', 'Sel hijau = harga terbaik …', fallback '—'. | Diperbaiki |

## `/procurement/vendors` — Vendors

- **File:** `frontend/src/portals/procurement/AllVendors.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 3 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-VEN-02 | page | flow | P1 | Seluruh kartu vendor menaut ke /admin/master/vendors: perlu izin admin, tidak membuka vendor yang diklik, dan keluar dari portal. | Kartu (satu target klik) membuka /procurement/vendor-catalog?vendor=<id>. | Diperbaiki |
| PRC-VEN-03 | page | button | P2 | 'Kelola di Master' h-10 rounded-full pill-active dengan ikon Plus (terkesan 'tambah'). | Button outline + ikon ExternalLink 'Kelola di Master Data' (testid vendor-add-btn tetap). | Diperbaiki |
| PRC-VEN-05 | page | form | P2 | Input cari vendor tanpa label; ikon di luar input. | aria-label + ikon di dalam input; wrapper max-w-6xl dihapus. | Diperbaiki |
| PRC-VEN-01 | page | title | P3 | Judul 'All Vendors' tidak sama dengan nav 'Vendors'. | Judul 'Vendors' + subtitle cara pakai. | Diperbaiki |
| PRC-VEN-04 | page | button | P3 | Quick link berupa Link pill text-xs custom; label 'AI Vendor Recommend'. | Button outline sm dengan ikon; 'Vendor Recommendation (AI)'. | Diperbaiki |

## `/procurement/vendor-scorecard` — Vendor Scorecard

- **File:** `frontend/src/portals/procurement/VendorScorecardList.jsx`
- **State diperiksa:** halaman + 0 tab, 0 dialog
- **Temuan otomatis (crawler):** 4 → 0

| ID | Area | Kategori | Sev | Temuan | Perbaikan | Status |
|---|---|---|---|---|---|---|
| PRC-VS-01 | page | flow | P1 | Filter periode YTD/QTD/MTD tidak berpengaruh: dikirim sebagai `period`, padahal /reports/vendor-scorecard hanya menerima date_from/date_to. | Periode diterjemahkan ke rentang date_from/date_to (zona Jakarta). | Diperbaiki |
| PRC-VS-02 | page | language | P2 | On-time tampil '+100.0%' (fmtPct adalah formatter delta yang menambah tanda +). | Formatter persen absolut lokal. | Diperbaiki |
| PRC-VS-03 | page | runtime | P2 | Drilldown 'Quality/Defect' dan 'Avg Lead Time' selalu '—' (membaca defect_rate/avg_lead_time; backend mengirim defect_rate_pct/avg_lead_time_days). | Membaca field yang benar (fallback nama lama) + menambah 'Stabilitas harga'. | Diperbaiki |
| PRC-VS-05 | page | ia | P2 | Duplikat /finance/vendor-scorecard (endpoint sama). Link 'Detail' ke Finance butuh izin finance.ap.read, dan ?vendor_id diabaikan halaman Finance. | Finance Vendor Scorecard membuka detail vendor dari ?vendor_id=; daftar kanonis = Procurement. | Diperbaiki |
| PRC-VS-04 | page | form | P3 | Select periode h-10 dengan ikon Filter dekoratif dan label singkatan 'YTD'; kolom 'PO Count/Total Value'; link Detail 20px. | Select w-[200px] + ariaLabel, label deskriptif; 'Jumlah PO/Total nilai'; Detail jadi Button ghost sm. | Diperbaiki |

## Catatan reviewer

Laporan ini MENGGANTIKAN laporan sebelumnya (dikirim ulang setelah FYI lead). Penyesuaian terhadap FYI: (a) map status lokal dihapus — PR/Kanban/Consolidation/Overview kini memakai StatusPill langsung ('Converted to PO'); RFQ list & detail juga pindah dari Badge/STATUS_META lokal ke StatusPill (opsi filter memakai statusLabel()); (b) font-mono untuk kode dokumen dikembalikan (konvensi); (c) temuan breadcrumb/sidebar sub-route Vendors ditandai fixed (global); (d) confirmDialog tetap dipakai apa adanya. Dialog alasan Tolak PR/PO dan Batalkan PO TIDAK dimigrasi ke promptDialog karena promptDialog hanya punya testid generik, sehingga testid lama (pr-reject-*, po-cancel-*, po-reject-*) akan hilang. Dialognya sudah memenuhi standar (Label wajib *, Batal outline + aksi destructive); lihat shared_request promptDialog testId. Catatan lain: 1) Commit e7b5d1f lead ikut membawa versi PRList.jsx yang belum final; versi final ada di working tree. 2) Query param baru: PR/PO list membaca ?status=; POForm membaca ?prefill= (dari Consolidation) dan ?vendor_id= (dari Vendor Recommendation); VendorCatalog membaca/menulis ?vendor=. 3) Panggilan API baru (memperbaiki bug UI yang terbukti): PRForm fetchAll('/master/brands', {active:true}); GRForm GET /master/vendors/{id} untuk nama vendor terkunci; Vendor Scorecard kini mengirim date_from/date_to. 4) Tidak ada data-testid yang hilang (dicek terhadap 6e61e5a), semua target tour procurement masih ada, dan semua file lolos jsxcheck (tanpa import tak terpakai) serta eslint no-undef. audit_tours.py melaporkan '0 tour files', jadi skrip itu sendiri mungkin perlu dicek. 5) /procurement/rfq/:id tidak punya data seed; perubahannya hanya ditinjau dari kode. Butuh minimal 1 RFQ + quote untuk crawl. 6) Rekomendasi IA untuk duplikasi: (a) vendor-scorecard Procurement adalah subset /finance/vendor-scorecard (endpoint sama), jadi cukup satu halaman; (b) vendor-comparison (per item lintas vendor) dan po-comparison (per item lintas PO) tidak identik tetapi tumpang tindih dengan tab Perbandingan RFQ, jadi bisa digabung menjadi satu hub 'Price comparison' bertab; (c) panel scorecard di Vendor Comparison menduplikasi Vendor Scorecard. 7) PO form menaruh panel Vendor Comparison di bawah form pada lebar <1536px (kolom kanan hanya di 2xl), supaya tabel item tidak terpotong di 1280px.
