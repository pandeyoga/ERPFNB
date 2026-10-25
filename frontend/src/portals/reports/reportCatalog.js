/** reportCatalog — satu sumber metadata Report Center.
 *
 * Dipakai oleh katalog (/reports) DAN oleh setiap halaman laporan, sehingga nama kartu
 * di katalog, judul halaman (PageHeader), ikon, dan deskripsi selalu sama.
 *
 * `related` = halaman on-screen yang menampilkan data serupa (mis. Stock Balance di
 * Inventory). Ditampilkan sebagai tombol "Lihat di layar" hanya bila user punya izinnya
 * (`perms`, semantik OR seperti `permitted()` di lib/portalGate).
 */
import {
  TrendingUp, Store, Package, Banknote, Wand2,
  CalendarDays, FileText, Boxes, ArrowLeftRight, Calculator,
  ShoppingCart, PackageCheck, Award, BookOpen, Scale, Clock, FileSpreadsheet,
} from "lucide-react";

export const REPORT_CATEGORIES = [
  {
    id: "sales",
    name: "Sales & Outlet",
    description: "Penjualan harian, performa outlet, dan riwayat FDO.",
    icon: TrendingUp,
    reports: [
      {
        id: "daily-sales",
        name: "Daily Sales Summary",
        title: "Daily Sales Summary Report",
        description: "Penjualan harian per outlet dan brand, lengkap dengan subtotal.",
        icon: CalendarDays,
        route: "/reports/daily-sales",
      },
      {
        id: "outlet-performance",
        name: "Outlet Performance",
        title: "Outlet Performance Report",
        description: "Total sales, rata-rata harian, dan jumlah transaksi per outlet, dengan grafik perbandingan.",
        icon: TrendingUp,
        route: "/reports/outlet-performance",
      },
      {
        id: "fdo-history",
        name: "FDO History",
        title: "FDO History Report",
        description: "Riwayat Floor Daily Order beserta status approval.",
        icon: FileText,
        route: "/reports/fdo-history",
      },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Posisi stok, pergerakan stok, dan nilai persediaan.",
    icon: Package,
    reports: [
      {
        id: "stock-balance",
        name: "Stock Balance",
        title: "Stock Balance Report",
        description: "Posisi stok per item, outlet, dan kategori pada tanggal tertentu.",
        icon: Boxes,
        route: "/reports/stock-balance",
        related: { to: "/inventory/balance", label: "Stock Balance", perms: ["inventory.balance.read", "inventory.view"] },
      },
      {
        id: "stock-movement",
        name: "Stock Movements",
        title: "Stock Movements Report",
        description: "Riwayat pergerakan stok masuk/keluar per outlet beserta ringkasannya.",
        icon: ArrowLeftRight,
        route: "/reports/stock-movement",
        related: { to: "/inventory/movements-hub", label: "Stock Movements", perms: ["inventory.movement.read", "inventory.view"] },
      },
      {
        id: "inventory-valuation",
        name: "Stock Valuation",
        title: "Stock Valuation Report",
        description: "Nilai persediaan per outlet (moving average) pada tanggal tertentu.",
        icon: Calculator,
        route: "/reports/inventory-valuation",
        related: { to: "/inventory/valuation", label: "Stock Valuation", perms: ["inventory.valuation.read"] },
      },
    ],
  },
  {
    id: "procurement",
    name: "Procurement",
    description: "Purchase Order, Goods Receipt, dan performa vendor.",
    icon: Store,
    reports: [
      {
        id: "po-summary",
        name: "PO Summary",
        title: "PO Summary Report",
        description: "Ringkasan Purchase Order per vendor dan status.",
        icon: ShoppingCart,
        route: "/reports/po-summary",
        related: { to: "/procurement/po", label: "Purchase Orders", perms: ["procurement.po"] },
      },
      {
        id: "gr-summary",
        name: "GR Summary",
        title: "GR Summary Report",
        description: "Ringkasan Goods Receipt dengan analisis selisih PO vs GR.",
        icon: PackageCheck,
        route: "/reports/gr-summary",
        related: { to: "/procurement/gr", label: "Goods Receipt", perms: ["procurement.gr"] },
      },
      {
        id: "vendor-performance",
        name: "Vendor Performance",
        title: "Vendor Performance Report",
        description: "Scorecard vendor: jumlah PO, fulfillment rate, dan total nilai pembelian.",
        icon: Award,
        route: "/reports/vendor-performance",
        related: { to: "/procurement/vendor-scorecard", label: "Vendor Scorecard", perms: ["procurement.view", "procurement.vendor.read"] },
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    description: "General ledger, trial balance, AP aging, dan P&L format FnB Group.",
    icon: Banknote,
    reports: [
      {
        id: "journal-ledger",
        name: "Journal Ledger",
        title: "Journal Ledger Report",
        description: "Entri general ledger dengan detail COA, debit/kredit, dan dimensi outlet/brand.",
        icon: BookOpen,
        route: "/reports/journal-ledger",
        related: { to: "/finance/journals", label: "Journals", perms: ["finance.journal_entry"] },
      },
      {
        id: "trial-balance",
        name: "Trial Balance",
        title: "Trial Balance Report",
        description: "Saldo akun per periode (saldo awal, mutasi, saldo akhir) untuk closing.",
        icon: Scale,
        route: "/reports/trial-balance",
        related: { to: "/finance/reports?tab=trial-balance", label: "Trial Balance", perms: ["finance.report"] },
      },
      {
        id: "ap-aging",
        name: "AP Aging",
        title: "AP Aging Report",
        description: "Hutang outstanding per vendor dengan bucket umur (Current / 1–30 / 31–60 / 61–90 / 90+ hari) dan detail invoice.",
        icon: Clock,
        route: "/reports/ap-aging",
        related: { to: "/finance/payments-hub?tab=ap-aging", label: "AP Aging", perms: ["finance.ap.read"] },
      },
      {
        id: "pl-group",
        name: "P&L (FnB Group Format)",
        title: "P&L Report — FnB Group Format",
        description: "Laba rugi multi-bulan: kolom per bulan + YTD dengan format FnB Group (Revenue / COGS / Gross Profit / OPEX / Net Income).",
        icon: FileSpreadsheet,
        route: "/reports/pl-group",
        related: { to: "/finance/reports?tab=profit-loss", label: "Profit & Loss", perms: ["finance.report"] },
      },
    ],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Susun laporan sendiri dengan filter lanjutan.",
    icon: Wand2,
    reports: [
      {
        id: "report-builder",
        name: "Custom Report Builder",
        title: "Custom Report Builder",
        description: "Pilih dimensi × metrik × filter, lalu ekspor. Dibuka di Finance › Reports.",
        icon: Wand2,
        // Langsung ke tab tujuan (dulu /finance/report-builder yang hanya me-redirect).
        route: "/finance/reports?tab=report-builder",
        perms: ["finance.report"],
      },
    ],
  },
];

const BY_ID = Object.fromEntries(
  REPORT_CATEGORIES.flatMap((c) => c.reports.map((r) => [r.id, { ...r, category: c.id }])),
);

/** Metadata satu laporan berdasarkan id (mis. "daily-sales"). */
export function getReport(id) {
  return BY_ID[id];
}
