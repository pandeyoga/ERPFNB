/** Inventory portal tour definitions — Full specific coverage. */

// ─── Inventory Home ───────────────────────────────────────────────
const inventoryHomeTour = {
  name: "Inventory Home",
  description: "Overview stok, low stock alert, transfer, dan opname.",
  steps: [
    {
      target: "[data-testid='inventory-welcome']",
      title: "Inventory Overview",
      content: "Pantau **stok semua outlet**, lakukan transfer, adjustment, atau jalankan opname dari sini.",
      placement: "bottom",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='inventory-outlet-picker']",
      title: "Pilih Outlet",
      content: "Filter inventory berdasarkan outlet. Jika user punya akses penuh, bisa lihat seluruh outlet sekaligus.",
      placement: "bottom",
    },
    {
      target: "[data-testid='inventory-kpi-strip']",
      title: "KPI Inventory",
      content: "**Total Inventory Value** (moving average), **Item Count**, **Low Stock count**, dan **Opname session aktif**.",
      placement: "bottom",
    },
    {
      target: "[data-testid='inventory-quick-actions']",
      title: "Quick Actions",
      content: "Akses cepat ke:\n\n• **Cek Stock** — balance matrix\n• **Low Stock** — items below par\n• **Transfer** — pindah stok antar outlet\n• **Adjustment** — koreksi qty\n• **Opname** — stock count fisik",
      placement: "top",
    },
    {
      target: "[data-testid='low-stock-widget']",
      title: "Low Stock Alert",
      content: "Items di bawah par level. **Aksi cepat**: klik tombol untuk raise PR ke procurement.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Stock Balance ────────────────────────────────────────────────
const inventoryBalanceTour = {
  name: "Stock Balance — Matrix Stok",
  description: "Lihat stok per item per outlet dalam format list atau matrix.",
  steps: [
    {
      target: "[data-testid='stock-balance-page']",
      title: "Stock Balance",
      content: "Lihat posisi **stok real-time** per item per outlet. Tersedia dua tampilan: **List** (per item) dan **Matrix** (item × outlet).",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='bal-view-toggle']",
      title: "Toggle View: List vs Matrix",
      content: "**List** — lebih mudah untuk cari satu item spesifik.\n**Matrix** — lihat semua outlet sekaligus, ideal untuk perbandingan cepat.",
      placement: "bottom",
    },
    {
      target: "[data-testid='bal-filters']",
      title: "Filter Stok",
      content: "Filter berdasarkan **outlet** dan **nama item**. Centang **Tampilkan Low Stock Only** untuk focus ke items yang perlu replenishment.",
      placement: "bottom",
    },
    {
      target: "[data-testid='bal-table-card']",
      title: "Nilai Moving Average",
      content: "Kolom **Value** = qty × harga moving average. Klik baris untuk lihat **history movement** item tersebut.",
      placement: "top",
    },
    {
      target: "[data-testid='bal-table-card']",
      title: "Stok Negatif",
      content: "Qty negatif ditandai **merah**. Ini bisa terjadi jika sales dicatat sebelum GR masuk. Segera lakukan adjustment untuk koreksi.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Movements ────────────────────────────────────────────────────
const inventoryMovementsTour = {
  name: "Movement Journal — Riwayat Pergerakan",
  description: "Timeline keluar-masuk barang per item dan outlet.",
  steps: [
    {
      target: "[data-testid='inventory-movements-page']",
      title: "Movement Journal",
      content: "Seluruh **pergerakan stok** tercatat di sini: masuk (GR, transfer in) dan keluar (DS usage, transfer out, adjustment).",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='movements-filters']",
      title: "Filter Movement",
      content: "Filter berdasarkan:\n\n• **Outlet** — lokasi pergerakan\n• **Tipe** — IN/OUT/TRANSFER/ADJUSTMENT\n• **Tanggal** — rentang waktu",
      placement: "bottom",
    },
    {
      target: "[data-testid='movements-table-card']",
      title: "Baca Movement Journal",
      content: "Setiap baris menunjukkan:\n\n• **Tipe** pergerakan (masuk/keluar)\n• **Qty** dan **unit**\n• **Harga** saat pergerakan\n• **Referensi** (GR no / DS no)",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Opname ───────────────────────────────────────────────────────
const inventoryOpnameTour = {
  name: "Stock Opname — Hitung Stok Fisik",
  description: "Jalankan sesi opname dan rekonsiliasi variance.",
  steps: [
    {
      target: "[data-testid='opname-list-page']",
      title: "Stock Opname",
      content: "**Stock count fisik** untuk verifikasi stok sistem vs aktual. Variance yang ditemukan otomatis dicatat sebagai adjustment.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='opn-header-card']",
      title: "Buat Sesi Opname Baru",
      content: "Klik **+ Opname Baru**. Pilih outlet dan tanggal. Satu outlet hanya boleh punya 1 sesi opname aktif di waktu yang sama.",
      placement: "bottom",
    },
    {
      target: "[data-testid='opn-table-card']",
      title: "Daftar Sesi Opname",
      content: "Status sesi:\n\n• **In Progress** — sedang berjalan, bisa input qty fisik\n• **Submitted** — menunggu approval\n• **Finalized** — adjustment ter-apply ke stok",
      placement: "top",
    },
    {
      target: "[data-testid='opn-table-card']",
      title: "AI Variance Explainer",
      content: "Setelah input qty fisik, klik **Analisis AI** untuk penjelasan otomatis penyebab variance. Berguna untuk laporan ke manajemen.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Transfers ───────────────────────────────────────────────────
const inventoryTransfersTour = {
  name: "Transfer Stok Antar Outlet",
  description: "Pindahkan stok dari outlet A ke B dengan traceability.",
  steps: [
    {
      target: "[data-testid='transfer-list-page']",
      title: "Transfer Stok",
      content: "Pindahkan stok antar outlet. Setiap transfer tercatat di movement journal kedua outlet (keluar di asal, masuk di tujuan).",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='trf-header-card']",
      title: "Buat Transfer Baru",
      content: "Klik **+ Transfer**. Isi outlet asal, outlet tujuan, item, qty. Setelah submit, status menjadi **In Transit** — stok sudah dikurangi dari asal.",
      placement: "bottom",
    },
    {
      target: "[data-testid='trf-table-card']",
      title: "Status Transfer",
      content: "**In Transit** → stok sedang dalam perjalanan.\n**Received** → outlet tujuan sudah konfirmasi penerimaan.\n\nOutlet tujuan harus klik **Terima** untuk finalize transfer.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Adjustment ──────────────────────────────────────────────────
const inventoryAdjustmentTour = {
  name: "Inventory Adjustment — Koreksi Stok",
  description: "Cara melakukan koreksi stok karena kerusakan, expired, atau koreksi fisik.",
  steps: [
    {
      target: "[data-testid='inventory-adjustment-page']",
      title: "Stock Adjustment",
      content: "Koreksi **stok manual** untuk:\n\n• **Kerusakan** (damage)\n• **Expired**\n• **Kehilangan** (loss/theft)\n• **Koreksi** (physical count variance)",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='adj-outlet-filter']",
      title: "Pilih Outlet",
      content: "Pilih **outlet** tempat stok akan di-adjust.",
      placement: "bottom",
    },
    {
      target: "[data-testid='adj-new']",
      title: "Buat Adjustment Baru",
      content: "Isi item, qty, tipe (plus/minus), alasan, dan upload foto bukti. Adjustment perlu **approval** sebelum stok berubah.",
      placement: "bottom",
    },
    {
      target: "[data-testid='adj-table']",
      title: "Status Adjustment",
      content: "**Draft** → **Pending** → **Approved** (stok ter-update) atau **Rejected**.",
      placement: "top",
      variant: "tip",
    },
  ],
};

// ─── Stock Movements Hub ─────────────────────────────────────────
const inventoryMovementsHubTour = {
  name: "Stock Movements Hub",
  description: "Satu halaman untuk semua pergerakan stok: history, transfers, adjustments.",
  steps: [
    {
      target: "[data-testid='stock-movements-hub']",
      title: "Stock Movements Hub",
      content: "Satu halaman untuk semua **pergerakan stok**:\n\n• **History** — movement journal lengkap\n• **Transfers** — perpindahan antar outlet\n• **Adjustments** — koreksi stok manual",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='movements-tabs']",
      title: "Navigasi Antar Modul",
      content: "Klik tab untuk beralih antar modul. Semua data ter-refresh saat ganti tab. Filter di tiap tab independen.",
      placement: "bottom",
    },
    {
      target: "[data-testid='movements-tabs']",
      title: "Tips Penggunaan",
      content: "• Gunakan tab **History** untuk audit trail lengkap\n• Tab **Transfers** untuk monitor stok dalam perjalanan\n• Tab **Adjustments** untuk approve koreksi yang pending",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Low Stock Alert ─────────────────────────────────────────────
const inventoryLowStockTour = {
  name: "Low Stock Alert",
  description: "Monitor item di bawah par level dan buat PR otomatis.",
  steps: [
    {
      target: "[data-testid='low-table-card']",
      title: "Low Stock Alert",
      content: "Daftar semua **item di bawah par level** di setiap outlet. Diurutkan berdasarkan severity (Critical → High → Medium → Low).",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='low-toolbar']",
      title: "Filter & Aksi",
      content: "Filter berdasarkan outlet dan severity. Centang items yang ingin di-PR, lalu klik **Buat PR** untuk raise Purchase Request ke procurement otomatis.",
      placement: "bottom",
    },
    {
      target: "[data-testid='low-create-pr']",
      title: "Create PR dari Low Stock",
      content: "Klik **Buat PR** untuk generate PR langsung ke procurement. PR akan mengisi qty berdasarkan selisih stok saat ini vs par level.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Market List ─────────────────────────────────────────────────
const inventoryMarketListTour = {
  name: "Market List — Harga Acuan",
  description: "Pantau harga pasar referensi dan approve harga kwartal.",
  steps: [
    {
      target: "[data-testid='market-list-page']",
      title: "Market List",
      content: "Daftar **harga pasar acuan** untuk semua item. Digunakan sebagai benchmark saat membandingkan harga dari vendor.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='market-list-stats']",
      title: "Overview Harga",
      content: "Statistik harga: total items terdaftar, **pending approval** (harga baru yang belum dikonfirmasi), dan quarter aktif.",
      placement: "bottom",
    },
    {
      target: "[data-testid='market-list-create-quarter-btn']",
      title: "Buat Quarter Baru",
      content: "Di awal kuartal, klik **Buat Quarter** untuk generate harga acuan baru. Tim procurement akan input harga pasar terkini untuk di-approve.",
      placement: "bottom",
    },
    {
      target: "[data-testid='market-list-export']",
      title: "Export & Report",
      content: "Export market list ke Excel untuk dibagikan ke vendor saat negosiasi harga tahunan/kuartalan.",
      placement: "bottom",
      variant: "tip",
    },
  ],
};

// ─── Inventory Valuation ──────────────────────────────────────────────
const inventoryValuationTour = {
  name: "Inventory Valuation",
  description: "Nilai stok (asset value) per outlet pada tanggal tertentu.",
  steps: [
    {
      target: "[data-testid='inventory-valuation-page']",
      title: "Inventory Valuation",
      content: "Lihat **nilai persediaan** (rupiah) seluruh outlet — basis aset lancar di neraca.",
      placement: "center",
      disableBeacon: true,
      variant: "hero",
    },
    {
      target: "[data-testid='val-kpi-strip']",
      title: "Ringkasan Nilai",
      content: "KPI total: **nilai stok**, jumlah item, dan outlet tercakup pada tanggal valuasi.",
      placement: "bottom",
    },
    {
      target: "[data-testid='val-asof']",
      title: "As-of Date",
      content: "Pilih **tanggal valuasi** untuk lihat nilai stok historis (mis. akhir bulan untuk closing).",
      placement: "bottom",
    },
    {
      target: "[data-testid='val-by-outlet-card']",
      title: "Breakdown per Outlet",
      content: "Rincian nilai stok **per outlet** + kontribusi persentase. Klik untuk drill ke detail item.",
      placement: "top",
      variant: "tip",
    },
  ],
};

export {
  inventoryHomeTour,
  inventoryBalanceTour,
  inventoryMovementsTour,
  inventoryOpnameTour,
  inventoryTransfersTour,
  inventoryAdjustmentTour,
  inventoryMovementsHubTour,
  inventoryLowStockTour,
  inventoryMarketListTour,
  inventoryValuationTour,
};
