/** Executive and Owner portal tour definitions — Full coverage.
 * Phase D Hardening: replaced body targets with stable data-testid anchors.
 */

// ─── Executive Home ──────────────────────────────────────────────────
const executiveHomeTour = {
  name: "Executive Dashboard",
  description: "Real-time KPI, trends, dan AI insights untuk seluruh group.",
  steps: [
    {
      target: "[data-testid='executive-header']",
      title: "Executive Dashboard",
      content: "**Top-level overview** untuk owner & GM. KPI realtime + AI insights + drilldown ke brand/outlet.",
      placement: "bottom",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='exec-filterbar']",
      title: "Filter Bar",
      content: "Pilih **periode** (Today/Week/Month/Quarter/YTD/Custom), filter **brand** & **outlet** multi-select. URL akan auto-update untuk share/deep-link.",
      placement: "bottom",
    },
    {
      target: "[data-testid='exec-link-profit-walk']",
      title: "Profit Walk",
      content: "**Waterfall chart** profit period-over-period. Klik untuk lihat kontribusi tiap komponen ke laba.",
      placement: "bottom",
    },
    {
      target: "[data-testid='exec-live-toggle']",
      title: "Live Mode",
      content: "Aktifkan untuk auto-refresh setiap 60 detik. Cocok untuk pantau realtime di TV display.",
      placement: "left",
    },
    {
      target: "[data-testid='exec-export-pdf']",
      title: "Export PDF",
      content: "Export snapshot dashboard ke PDF untuk meeting. Includes filter context & timestamp.",
      placement: "left",
    },
    {
      target: "[data-testid='exec-kpi-strip-primary']",
      title: "KPI Primary Strip",
      content: "**Sales Hari Ini / WTD / MTD** + **Inventory Value**. Klik untuk drill ke source page.",
      placement: "bottom",
    },
  ],
};

// ─── Executive Owner Home (landing /executive — Sprint E16 owner-focused) ──
// NOTE: /executive (index) renders portals/executive/OwnerHome/index.jsx, which
// uses owner-* test ids. The ExecutiveHome (executive-header / exec-filterbar)
// now lives at /executive/analytics and keeps the `executive-home` tour.
const executiveOwnerHomeTour = {
  name: "Dashboard Eksekutif",
  description: "Ringkasan harian owner/GM: KPI, anomali, approvals, akses cepat.",
  steps: [
    {
      target: "[data-testid='owner-home']",
      title: "Dashboard Eksekutif",
      content: "**Ringkasan harian owner & GM** dalam satu layar: revenue, AP exposure, anomali, dan approval tertunda. Mulai hari dari sini.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='owner-kpi-row']",
      title: "KPI Utama",
      content: "**Revenue Hari Ini / Minggu / Bulan**, **AP Exposure**, **Anomali Aktif**, dan **Pending Approval**. Klik tiap kartu untuk drill-down ke sumbernya.",
      placement: "bottom",
    },
    {
      target: "[data-testid='owner-home-full-analytics']",
      title: "Full Analytics",
      content: "Buka **Executive Dashboard** lengkap: filter periode + brand/outlet multi-select, profit walk, brand mix, dan trend.",
      placement: "bottom",
      variant: "tip",
    },
    {
      target: "[data-testid='owner-shortcuts']",
      title: "Akses Cepat",
      content: "Pintasan ke modul yang paling sering dipakai eksekutif — Analytics, Anomali, Approvals, Finance, Procurement, Inventory, dan lainnya.",
      placement: "top",
    },
    {
      target: "[data-testid='owner-home-refresh']",
      title: "Segarkan Data",
      content: "Klik **Refresh** untuk memuat angka terbaru tanpa reload halaman penuh.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Executive AI Q&A ─────────────────────────────────────────────────
const executiveAIQATour = {
  name: "Executive AI Q&A",
  description: "Tanya AI tentang performa bisnis dalam Bahasa Indonesia.",
  steps: [
    {
      target: "[data-testid='executive-qa-page']",
      title: "AI Business Q&A",
      content: "Tanya **pertanyaan bisnis** dalam Bahasa Indonesia dan AI akan menjawab berdasarkan data aktual ERP. Tidak perlu tahu cara query database.",
      placement: "top",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='qa-suggestion']",
      title: "Contoh Pertanyaan",
      content: "\u2022 'Sales The Coffeeshop bulan ini berapa?'\n\u2022 'Vendor mana yang paling sering terlambat?'\n\u2022 'Outlet mana yang paling profitable Q1?'\n\u2022 'Item apa yang paling banyak diorder?'",
      placement: "bottom",
    },
    {
      target: "[data-testid='qa-input']",
      title: "AI Tool Calling",
      content: "AI secara otomatis memilih **tool** yang tepat (sales, inventory, finance, procurement) dan mengambil data real-time dari sistem untuk menjawab.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Executive Anomaly Detection ───────────────────────────────────────────────
const executiveAnomalyTour = {
  name: "Anomaly Detection",
  description: "AI mendeteksi pola anomali di data bisnis dan keuangan.",
  steps: [
    {
      target: "[data-testid='executive-anomaly-page']",
      title: "Anomaly Detection",
      content: "Sistem **AI** secara otomatis mendeteksi anomali di data bisnis: penjualan tidak wajar, stok jeblok tiba-tiba, hutang melonjak, dan lainnya.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='anomaly-scan-btn']",
      title: "Scan Manual",
      content: "Klik **Scan** untuk jalankan deteksi anomali sekarang. Scan otomatis berjalan via scheduler malam hari.",
      placement: "bottom",
    },
    {
      target: "[data-testid='executive-anomaly-page']",
      title: "Filter Anomali",
      content: "Filter berdasarkan **severity** (Critical/High/Medium), **status**, **tipe anomali**, dan **rentang hari**.",
      placement: "top",
    },
    {
      target: "[data-testid='executive-anomaly-page']",
      title: "Tindak Lanjut",
      content: "Klik anomali untuk lihat **AI explanation** dan rekomendasi tindakan. Klik **Resolve** setelah ditangani atau **Ignore** jika sudah acceptable.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Brand Mix Overview ──────────────────────────────────────────────────
const executiveBrandMixTour = {
  name: "Brand Mix Overview",
  description: "Analisis kontribusi dan performa masing-masing brand.",
  steps: [
    {
      target: "[data-testid='brand-mix-overview']",
      title: "Brand Mix Analysis",
      content: "Analisis **kontribusi setiap brand** (The Coffeeshop, The Bakery, The Bistro, The Restaurant, The Lounge) terhadap total revenue dan profit group.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='brand-mix-period']",
      title: "Pilih Periode",
      content: "Filter per bulan untuk lihat mix brand di periode tertentu. Bandingkan dua periode berbeda untuk lihat pergeseran kontribusi.",
      placement: "bottom",
    },
    {
      target: "[data-testid='brand-mix-overview']",
      title: "Baca Brand Mix",
      content: "\u2022 **Donut chart** — proporsi revenue per brand\n\u2022 **Table** — revenue, growth, margin per brand\n\u2022 Klik brand untuk **drill-down** ke detail outlet\n\u2022 **Warna merah** = brand underperforming",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Profit Walk ────────────────────────────────────────────────────
const executiveProfitWalkTour = {
  name: "Profit Walk — Analisis Laba",
  description: "Waterfall chart kontribusi tiap komponen ke laba bersih.",
  steps: [
    {
      target: "[data-testid='profit-walk-page']",
      title: "Profit Walk",
      content: "**Waterfall chart** yang menunjukkan bagaimana Revenue dikurangi berbagai komponen biaya menjadi Net Profit. Cocok untuk presentasi ke investor.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='profit-walk-controls']",
      title: "Pilih Periode & Pembanding",
      content: "Pilih periode dan pembanding (bulan lalu atau tahun lalu). Chart menampilkan delta di tiap komponen untuk analisis mendalam.",
      placement: "bottom",
    },
    {
      target: "[data-testid='profit-kpi-cards']",
      title: "KPI Summary",
      content: "KPI cards di atas chart: **Revenue**, **COGS**, **Gross Profit**, dan **Net Profit** dengan persentase perubahan vs pembanding.",
      placement: "bottom",
    },
    {
      target: "[data-testid='profit-walk-page']",
      title: "Interpretasi Profit Walk",
      content: "\u2022 **Bar hijau** — kontribusi positif (revenue)\n\u2022 **Bar merah** — komponen pengurang (biaya)\n\u2022 Klik bar untuk drill-down ke kategori beban",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Period Compare ───────────────────────────────────────────────────
const executivePeriodCompareTour = {
  name: "Period Compare — Perbandingan Periode",
  description: "Bandingkan KPI bisnis antar periode secara visual.",
  steps: [
    {
      target: "[data-testid='period-compare-page']",
      title: "Period Compare",
      content: "Bandingkan **KPI bisnis** antar 2 periode: sales, gross profit, COGS, opex, net profit. Berguna untuk evaluasi bulanan/kuartalan.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='period-compare-controls']",
      title: "Pilih Periode",
      content: "Pilih 2 periode untuk dibandingkan. Bisa berupa bulan berbeda, kuartal, atau year-over-year.",
      placement: "bottom",
    },
    {
      target: "[data-testid='period-compare-metrics']",
      title: "Pilih Metrik",
      content: "Centang metrik yang ingin ditampilkan. Bisa pilih **Sales, Gross Profit, Net Profit, COGS, OPEX**, dan lainnya.",
      placement: "bottom",
    },
    {
      target: "[data-testid='period-compare-page']",
      title: "Baca Perbandingan",
      content: "Kolom **Delta** menunjukkan selisih: positif = membaik, negatif = memburuk. Klik baris untuk drill-down ke breakdown per brand/outlet.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Performance Analytics Hub (Brand Mix · Profit Walk · Period Compare) ─────
const executiveAnalyticsHubTour = {
  name: "Performance Analytics Hub",
  description: "Brand Mix, Profit Walk, dan Period Compare kini menyatu dalam satu workspace.",
  steps: [
    {
      target: "[data-testid='executive-analytics-hub']",
      title: "Performance Analytics",
      content: "Tiga analisis eksekutif kini **digabung jadi tabs** di satu halaman, tidak lagi menu terpisah di sidebar.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='exec-analytics-tab-brand']",
      title: "Brand Mix",
      content: "Kontribusi tiap brand (The Coffeeshop, The Bakery, The Bistro, The Restaurant, The Lounge) ke revenue & profit group.",
      placement: "bottom",
    },
    {
      target: "[data-testid='exec-analytics-tab-profit-walk']",
      title: "Profit Walk",
      content: "**Waterfall chart** dari Revenue → komponen biaya → Net Profit. Cocok untuk presentasi.",
      placement: "bottom",
    },
    {
      target: "[data-testid='exec-analytics-tab-period-compare']",
      title: "Period Compare",
      content: "Bandingkan KPI antar 2 periode (bulan/kuartal/YoY) untuk evaluasi performa.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Executive Reservasi Summary ──────────────────────────────────────
const executiveReservationsTour = {
  name: "Ringkasan Reservasi",
  description: "Pantau reservasi & deposit lintas outlet dari sudut pandang eksekutif.",
  steps: [
    {
      target: "[data-testid='reservation-summary-page']",
      title: "Ringkasan Reservasi",
      content: "Rekap reservasi semua outlet: jumlah booking, pax, dan nilai deposit dalam satu layar.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='reservation-kpi-cards']",
      title: "KPI Reservasi",
      content: "Kartu metrik: total reservasi, tamu (pax), dan deposit terkumpul untuk periode terpilih.",
      placement: "bottom",
    },
    {
      target: "[data-testid='reservation-filters']",
      title: "Filter Periode",
      content: "Saring berdasarkan **rentang tanggal** untuk fokus ke minggu/bulan tertentu.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Budget Approvals (Executive) ─────────────────────────────────────
const executiveBudgetApprovalsTour = {
  name: "Budget Approvals",
  description: "Setujui atau tolak pengajuan budget outlet dari satu antrean.",
  steps: [
    {
      target: "[data-testid='budget-approvals']",
      title: "Budget Approvals",
      content: "Antrean **persetujuan budget outlet** (KDO/FDO/BDO) yang menunggu keputusan eksekutif.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='budget-approval-list']",
      title: "Daftar Pengajuan",
      content: "Tiap baris menampilkan outlet, periode, dan jumlah. **Approve** untuk mengaktifkan budget, atau **Reject** dengan alasan.",
      placement: "top",
    },
    {
      target: "[data-testid='approved-budgets-card']",
      title: "Riwayat Disetujui",
      content: "Budget yang sudah disetujui terekam di sini untuk audit & referensi.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Set Budget Outlet (Allocation) ───────────────────────────────────
const executiveOutletBudgetsTour = {
  name: "Set Budget Outlet",
  description: "Alokasikan budget operasional per outlet & periode (mingguan/bulanan).",
  steps: [
    {
      target: "[data-testid='outlet-budget-allocation']",
      title: "Alokasi Budget Outlet",
      content: "Tetapkan plafon budget operasional (KDO/FDO/BDO) untuk tiap outlet per periode.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='tab-weekly']",
      title: "Periode Mingguan / Bulanan",
      content: "Pilih granularitas alokasi: per **minggu** atau per **bulan** sesuai kebijakan.",
      placement: "bottom",
    },
    {
      target: "[data-testid='budget-matrix']",
      title: "Matriks Budget",
      content: "Isi nominal per outlet × bucket. Gunakan **Bulk** untuk mengisi cepat, lalu **Simpan**.",
      placement: "top",
    },
    {
      target: "[data-testid='btn-save']",
      title: "Simpan Alokasi",
      content: "Klik **Simpan** untuk mengaktifkan budget. Outlet langsung melihatnya di 'Budget Saya'.",
      placement: "left",
      variant: "tip",
    },
  ],
};

// ─── Budget Monitor ───────────────────────────────────────────────────
const executiveBudgetMonitorTour = {
  name: "Budget Monitor",
  description: "Pantau realisasi vs budget outlet secara visual (heatmap, pace, tabel).",
  steps: [
    {
      target: "[data-testid='outlet-budget-monitor']",
      title: "Budget Monitor",
      content: "Lihat **serapan budget** tiap outlet vs plafon — deteksi over/under-spending lebih awal.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='tab-heatmap']",
      title: "Heatmap",
      content: "Visual warna: merah = mendekati/over budget, hijau = aman. Cepat lihat outlet berisiko.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-pace']",
      title: "Pace",
      content: "Bandingkan kecepatan belanja vs sisa hari periode — apakah serapan on-track.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Budget Increase Requests ─────────────────────────────────────────
const executiveBudgetIncreaseTour = {
  name: "Request Penambahan Budget",
  description: "Tinjau & putuskan permintaan penambahan budget dari outlet.",
  steps: [
    {
      target: "[data-testid='budget-increase-requests']",
      title: "Request Penambahan Budget",
      content: "Outlet yang budget-nya menipis dapat mengajukan penambahan — keputusan ada di sini.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='tab-pending']",
      title: "Menunggu Keputusan",
      content: "Tab **Pending** berisi pengajuan baru. Tetapkan jumlah disetujui + catatan, lalu submit.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-approved']",
      title: "Disetujui & Ditolak",
      content: "Tab **Approved / Rejected** menyimpan riwayat keputusan untuk audit.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Outlet Drilldown (/executive/outlet/:outletId) ──────────────────
const executiveOutletDrilldownTour = {
  name: "Detail Outlet",
  description: "KPI, P&L, inventory, dan staff untuk satu outlet.",
  steps: [
    {
      target: "[data-testid='outlet-drilldown-page']",
      title: "Detail Outlet",
      content: "Analisis mendalam **satu outlet**: performa harian, P&L, inventory, dan staff. Buka dari kartu outlet di dashboard.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='outlet-kpi-strip']",
      title: "KPI Outlet",
      content: "Ringkasan **revenue, GP%, net, dan transaksi** outlet ini untuk periode aktif.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-daily']",
      title: "Tab Analisis",
      content: "Pindah antar tab: **Daily Ops**, **P&L**, **Inventory**, dan **Staff** untuk melihat detail per area.",
      placement: "bottom",
    },
    {
      target: "[data-testid='outlet-back']",
      title: "Kembali ke Dashboard",
      content: "Klik untuk kembali ke Executive Dashboard dan pilih outlet/brand lain.",
      placement: "right",
      variant: "tip",
    },
  ],
};

// ─── Brand Drilldown (/executive/brand/:brandId) ─────────────────────
const executiveBrandDrilldownTour = {
  name: "Detail Brand",
  description: "KPI brand, struktur biaya, outlet, dan trend.",
  steps: [
    {
      target: "[data-testid='brand-drilldown-page']",
      title: "Detail Brand",
      content: "Analisis mendalam **satu brand**: KPI, outlet di bawahnya, struktur biaya, dan trend.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='brand-drilldown-kpi']",
      title: "KPI Brand",
      content: "**Revenue MTD, GP%, Net, dan jumlah outlet aktif** untuk brand ini.",
      placement: "bottom",
    },
    {
      target: "[data-testid='tab-outlets']",
      title: "Tab Analisis",
      content: "Pindah antar tab: **Outlets**, **Cost Structure**, dan **Trends** untuk detail per area.",
      placement: "bottom",
    },
    {
      target: "[data-testid='brand-back']",
      title: "Kembali ke Dashboard",
      content: "Klik untuk kembali ke Executive Dashboard dan pilih brand/outlet lain.",
      placement: "right",
      variant: "tip",
    },
  ],
};

export {
  executiveHomeTour,
  executiveOwnerHomeTour,
  executiveOutletDrilldownTour,
  executiveBrandDrilldownTour,
  executiveAIQATour,
  executiveAnomalyTour,
  executiveBrandMixTour,
  executiveProfitWalkTour,
  executivePeriodCompareTour,
  executiveAnalyticsHubTour,
  executiveReservationsTour,
  executiveBudgetApprovalsTour,
  executiveOutletBudgetsTour,
  executiveBudgetMonitorTour,
  executiveBudgetIncreaseTour,
};
