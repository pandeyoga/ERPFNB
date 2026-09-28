/** Procurement portal tour definitions — Full coverage including all pages. */

// ─── Procurement Home ────────────────────────────────────────────
const procurementHomeTour = {
  name: "Procurement Home",
  description: "Overview pembelian: PR → PO → GR.",
  steps: [
    {
      target: "[data-testid='procurement-welcome']",
      title: "Procurement Overview",
      content: "Pusat pengelolaan **pembelian** dari outlet ke vendor. Alur utama: **PR → PO → GR**.",
      placement: "bottom",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='qa-kanban']",
      title: "Workboard Kanban",
      content: "**Drag & drop** untuk pindahkan PR/PO antar status. Cocok untuk view operational sehari-hari.",
      placement: "bottom",
    },
    {
      target: "[data-testid='qa-vc']",
      title: "Bandingkan Vendor",
      content: "Pilih item, bandingkan vendor berdasarkan **harga, lead time, on-time delivery, defect rate**. Rekomendasi vendor terbaik otomatis.",
      placement: "bottom",
    },
    {
      target: "[data-testid='procurement-kpi-strip']",
      title: "KPI Procurement",
      content: "Ringkasan: **PR Pending**, **PO Open**, **GR Posted**. Quick Action di kanan untuk buat PR baru.",
      placement: "bottom",
    },
  ],
};

// ─── Kanban ───────────────────────────────────────────────────────
const procurementKanbanTour = {
  name: "Workboard Kanban",
  description: "Drag & drop PR/PO antar status dengan visual pipeline.",
  steps: [
    {
      target: "[data-testid='wb-board']",
      title: "Kanban Workboard",
      content: "7 kolom pipeline dari **PR Draft → PR Approved → PO Sent → PO Received**. Drag card antar kolom untuk approve/send/post GR.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='wb-filter-outlet']",
      title: "Filter Outlet & Vendor",
      content: "Fokus ke outlet atau vendor tertentu. Cocok untuk manager outlet yang punya scope terbatas.",
      placement: "bottom",
    },
    {
      target: "[data-testid='wb-filter-days']",
      title: "Filter Periode",
      content: "Default 60 hari terakhir. Kurangi range untuk performa lebih cepat di koneksi lambat.",
      placement: "bottom",
    },
    {
      target: "[data-testid='wb-board']",
      title: "Cara Drag & Drop",
      content: "• **Drag** card dari kolom status satu ke berikutnya\n• Sistem otomatis update status dan buat JE jika diperlukan\n• Card berwarna = prioritas (merah = overdue)",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── PR List ────────────────────────────────────────────────────────
const procurementPRListTour = {
  name: "Purchase Requests — Daftar PR",
  description: "Kelola permintaan pembelian: buat, review, approve.",
  steps: [
    {
      target: "[data-testid='pr-list-page']",
      title: "Purchase Requests",
      content: "Daftar semua **Purchase Request (PR)** dari outlet, inventory alert, dan manual procurement. PR harus di-approve sebelum bisa dibuatkan PO.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='pr-filters-card']",
      title: "Filter PR",
      content: "Filter berdasarkan **outlet** dan **sumber** (outlet request, auto-inventory, manual). Lihat PR dari outlet tertentu saja.",
      placement: "bottom",
    },
    {
      target: "[data-testid='pr-status-tabs']",
      title: "Status PR",
      content: "Status PR:\n\n• **Draft** — belum disubmit\n• **Pending** — menunggu approval\n• **Approved** — siap dibuatkan PO\n• **Rejected** — ditolak",
      placement: "bottom",
    },
    {
      target: "[data-testid='pr-new']",
      title: "Buat PR Manual",
      content: "Klik **+ PR** untuk buat permintaan pembelian baru. Isi item, qty, dan outlet yang membutuhkan.",
      placement: "left",
    },
    {
      target: "[data-testid='pr-table-card']",
      title: "Approve & Convert ke PO",
      content: "Klik baris PR untuk detail. Dari detail: **Approve** PR lalu klik **Convert to PO** untuk buat PO ke vendor yang dipilih.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── PO List ────────────────────────────────────────────────────────
const procurementPOListTour = {
  name: "Purchase Orders — Daftar PO",
  description: "Buat, kirim, dan pantau purchase orders ke vendor.",
  steps: [
    {
      target: "[data-testid='po-list-page']",
      title: "Purchase Orders",
      content: "Daftar semua **Purchase Order (PO)**. PO bisa dibuat dari PR yang sudah approved, atau langsung tanpa PR.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='po-filters-card']",
      title: "Filter PO",
      content: "Filter berdasarkan **outlet** dan **vendor**. Berguna untuk cek semua PO ke satu vendor atau dari satu outlet.",
      placement: "bottom",
    },
    {
      target: "[data-testid='po-status-tabs']",
      title: "Status PO",
      content: "Status PO:\n\n• **Draft** — belum dikirim\n• **Sent** — sudah dikirim ke vendor\n• **Partial** — GR sebagian item\n• **Received** — semua item sudah diterima",
      placement: "bottom",
    },
    {
      target: "[data-testid='po-new']",
      title: "Buat PO Baru",
      content: "Klik **+ PO** untuk buat purchase order baru. Pilih vendor, isi item dan harga. Setelah sent, vendor menerima notifikasi.",
      placement: "left",
    },
    {
      target: "[data-testid='po-table-card']",
      title: "Kirim & GR",
      content: "Dari detail PO: klik **Kirim ke Vendor** untuk update status. Saat barang tiba, buat **GR (Goods Receipt)** untuk konfirmasi penerimaan.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── GR List ────────────────────────────────────────────────────────
const procurementGRTour = {
  name: "Goods Receipt — Penerimaan Barang",
  description: "Posting penerimaan barang dari PO dan auto-journal AP.",
  steps: [
    {
      target: "[data-testid='gr-list-page']",
      title: "Goods Receipt (GR)",
      content: "Konfirmasi **penerimaan barang** dari vendor. GR ter-link ke PO dan otomatis buat journal AP dan update stok inventory.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='gr-list-header']",
      title: "Posting GR Baru",
      content: "Klik **+ GR** lalu pilih PO yang diterima. Isi qty aktual yang diterima (boleh berbeda dengan PO jika barang partial).",
      placement: "bottom",
    },
    {
      target: "[data-testid='gr-table-card']",
      title: "Auto-Journal dari GR",
      content: "Setelah GR di-post:\n\n• **Stok** di inventory otomatis bertambah\n• **AP** ke vendor otomatis tercatat\n• **Journal entry** Dr: Persediaan/Beban | Cr: AP",
      placement: "top",
    },
    {
      target: "[data-testid='gr-table-card']",
      title: "Link ke JE",
      content: "Icon journal entry (📒) di kolom kanan menunjukkan GR sudah ter-journalkan. Klik untuk lihat detail JE yang dibuat otomatis.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Vendor Compare ──────────────────────────────────────────────
const procurementVendorCompareTour = {
  name: "Bandingkan Vendor",
  description: "Tool perbandingan vendor untuk pricing & performance.",
  steps: [
    {
      target: "body",
      title: "Vendor Comparison Tool",
      content: "Pilih **maksimal 10 item**, set periode, lalu sistem akan tampilkan:\n\n• **Matrix harga per vendor**\n• **Skor komposit** (harga 60% + recency 40%)\n• **Performance scorecard** (lead time, on-time, defect)",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "body",
      title: "Cara Pakai",
      content: "1. Cari item yang ingin dibandingkan\n2. Pilih periode pembelian terakhir\n3. Klik **Bandingkan**\n4. Review matrix harga & skor vendor\n5. Klik **Pilih** untuk auto-apply vendor ke PO baru",
      placement: "center",
      variant: "tip",
    },
  ],
};

// ─── All Vendors ──────────────────────────────────────────────────
const procurementVendorsTour = {
  name: "All Vendors — Daftar Vendor",
  description: "Lihat dan kelola semua vendor terdaftar.",
  steps: [
    {
      target: "[data-testid='procurement-vendors-page']",
      title: "All Vendors",
      content: "Daftar semua **vendor terdaftar** di sistem. Lihat profil vendor, riwayat transaksi, dan quick links ke tools analitik.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='vendor-search-bar']",
      title: "Cari Vendor",
      content: "Cari vendor berdasarkan nama, kode, atau kategori. Hasil pencarian real-time.",
      placement: "bottom",
    },
    {
      target: "[data-testid='vendor-quicklinks']",
      title: "Quick Links",
      content: "Akses cepat ke tool analitik vendor:\n\n• **Comparison** — bandingkan harga antar vendor\n• **Scorecard** — performa vendor berdasarkan historis\n• **AI Recommend** — rekomendasi vendor terbaik AI\n• **Catalog** — katalog item per vendor",
      placement: "bottom",
    },
    {
      target: "[data-testid='vendor-add-btn']",
      title: "Tambah Vendor Baru",
      content: "Klik **+ Vendor** untuk registrasi vendor baru. Isi nama, kontak, alamat, dan rekening bank. Vendor aktif langsung bisa dipilih di PO.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Vendor Scorecard ─────────────────────────────────────────────
const procurementVendorScorecardTour = {
  name: "Vendor Scorecard",
  description: "Peringkat performa vendor berdasarkan historis transaksi.",
  steps: [
    {
      target: "[data-testid='vendor-scorecard-page']",
      title: "Vendor Scorecard",
      content: "**Peringkat performa** semua vendor berdasarkan historis: nilai transaksi, ketepatan waktu, kualitas barang, dan harga kompetitif.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='scorecard-period']",
      title: "Pilih Periode",
      content: "Pilih periode analisis (3 bulan / 6 bulan / 1 tahun). Periode lebih panjang memberikan gambaran lebih akurat.",
      placement: "bottom",
    },
    {
      target: "[data-testid='scorecard-table-card']",
      title: "Baca Scorecard",
      content: "• **Rank** — peringkat keseluruhan\n• **PO Count** — jumlah PO\n• **Total Value** — nilai transaksi\n• **On-Time %** — persentase pengiriman tepat waktu\n• **Score** — skor komposit (0–100)",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── AI Vendor Recommend ─────────────────────────────────────────
const procurementVendorRecommendTour = {
  name: "AI Vendor Recommendation",
  description: "AI merekomendasikan vendor terbaik untuk item tertentu.",
  steps: [
    {
      target: "[data-testid='vrec-page']",
      title: "AI Vendor Recommendation",
      content: "AI **merekomendasikan vendor terbaik** untuk item yang Anda cari, berdasarkan historis harga, ketepatan waktu, dan kualitas.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='vrec-search-card']",
      title: "Cari Item",
      content: "Ketik nama item yang ingin diorder. AI akan mencari vendor yang pernah supply item tersebut dan menghitung skor terbaik.",
      placement: "bottom",
    },
    {
      target: "[data-testid='vrec-page-candidates']",
      title: "Kandidat Vendor",
      content: "Vendor diurutkan berdasarkan **skor AI**: kombinasi harga historis, on-time delivery, dan recency order terakhir. Klik untuk buat PO langsung.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── RFQ List ──────────────────────────────────────────────────────
const procurementRFQTour = {
  name: "RFQ — Request for Quotation",
  description: "Kirim permintaan penawaran harga ke vendor dan bandingkan respons.",
  steps: [
    {
      target: "[data-testid='rfq-list-page']",
      title: "Request for Quotation (RFQ)",
      content: "Kirim **RFQ** ke beberapa vendor sekaligus untuk item yang sama, lalu bandingkan penawaran harga yang masuk.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='rfq-filters']",
      title: "Filter RFQ",
      content: "Filter berdasarkan status (Draft/Sent/Closed) dan cari berdasarkan nomor atau item. Lihat RFQ aktif yang menunggu respons vendor.",
      placement: "bottom",
    },
    {
      target: "[data-testid='create-rfq-btn']",
      title: "Buat RFQ Baru",
      content: "Klik **+ Buat RFQ**. Isi item yang dibutuhkan, qty, dan pilih vendor-vendor yang ingin di-invite. RFQ otomatis dikirim via email.",
      placement: "bottom",
    },
    {
      target: "[data-testid='rfq-table-card']",
      title: "Bandingkan Penawaran",
      content: "Setelah vendor merespons, buka RFQ dan lihat tabel perbandingan harga. Pilih vendor terbaik dan konvert ke PO dengan satu klik.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── PR Consolidation ─────────────────────────────────────────────────
const procurementConsolidationTour = {
  name: "PR Consolidation",
  description: "Gabungkan banyak Purchase Request jadi PO efisien per vendor.",
  steps: [
    {
      target: "[data-testid='pr-consolidation-page']",
      title: "PR Consolidation",
      content: "Gabungkan beberapa **Purchase Request** menjadi PO yang efisien — kurangi PO kecil-kecil ke vendor sama.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='cons-pr-list-card']",
      title: "Pilih PR",
      content: "Centang PR yang ingin digabung. **Toggle All** untuk pilih semua dalam filter aktif.",
      placement: "top",
    },
    {
      target: "[data-testid='cons-preview-card']",
      title: "Preview & Generate",
      content: "Panel kanan menunjukkan **item ter-konsolidasi** & total. Klik **Generate PO** untuk membuat PO.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── PO Comparison ────────────────────────────────────────────────────
const procurementPOComparisonTour = {
  name: "PO Comparison",
  description: "Bandingkan PO antar vendor untuk pilih penawaran terbaik.",
  steps: [
    {
      target: "[data-testid='po-comparison-page']",
      title: "PO Comparison",
      content: "Bandingkan **Purchase Order** untuk item serupa antar vendor — temukan harga & term terbaik.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='po-cmp-table-card']",
      title: "Tabel Perbandingan",
      content: "Lihat harga, qty, dan total per vendor berdampingan. Baris **Totals** memudahkan keputusan cepat.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Price Intelligence ───────────────────────────────────────────────
const procurementPriceIntelligenceTour = {
  name: "Price Intelligence",
  description: "Pantau deviasi harga beli vs harga acuan pasar (market list).",
  steps: [
    {
      target: "[data-testid='price-intel-page']",
      title: "Price Intelligence",
      content: "Deteksi **deviasi harga** pembelian vs harga acuan pasar — cegah overpaying ke vendor.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='price-intel-summary']",
      title: "Ringkasan Deviasi",
      content: "Statistik: item dilacak, jumlah **di atas** vs **di bawah** acuan, dan item **berisiko**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='price-intel-quarter']",
      title: "Quarter Acuan",
      content: "Pilih **kuartal acuan harga**. Filter kategori untuk fokus ke grup item tertentu.",
      placement: "bottom",
    },
    {
      target: "[data-testid='price-intel-deviations-card']",
      title: "Daftar Deviasi",
      content: "Item dengan selisih signifikan muncul di sini — prioritas negosiasi ulang ke vendor.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Vendor Catalog ───────────────────────────────────────────────────
const procurementVendorCatalogTour = {
  name: "Vendor Catalog",
  description: "Katalog item per vendor + riwayat harga untuk referensi pembelian.",
  steps: [
    { target: "[data-testid='vendor-catalog-page']", title: "Vendor Catalog", content: "Telusuri **item yang ditawarkan tiap vendor** beserta harga terakhir — referensi cepat saat membuat PR/PO.", placement: "center", disableBeacon: true, variant: "hero" },
    { target: "[data-testid='vendor-catalog-vendor-search']", title: "Pilih Vendor", content: "Cari & pilih vendor dari daftar kiri untuk melihat katalog item-nya.", placement: "right" },
    { target: "[data-testid='vendor-catalog-item-search']", title: "Cari Item", content: "Cari item dalam katalog vendor terpilih; bandingkan harga antar vendor sebelum order.", placement: "bottom", variant: "tip" },
  ],
};

export {
  procurementHomeTour,
  procurementKanbanTour,
  procurementPRListTour,
  procurementPOListTour,
  procurementGRTour,
  procurementVendorCompareTour,
  procurementVendorsTour,
  procurementVendorScorecardTour,
  procurementVendorRecommendTour,
  procurementRFQTour,
  procurementConsolidationTour,
  procurementPOComparisonTour,
  procurementPriceIntelligenceTour,
  procurementVendorCatalogTour,
};
