/**
 * tourMap.js — Centralized mapping of routes → tour IDs + tour metadata
 *
 * Format:
 *   pathToTours: { "/path": ["tour-id-1", "tour-id-2"] }
 *   - exact match first
 *   - prefix match with "/*" suffix
 *   - dynamic params via ":param" segments
 *
 *   tourMetadata: { "tour-id": { title, description, icon } }
 */

// =====================================================
// PATH → TOURS MAPPING
// =====================================================

const pathToTours = {
  // ==== Outlet portal ====
  "/outlet": ["outlet-home"],
  "/outlet/approvals": ["my-approvals"],
  "/outlet/loyalty/input-poin": ["outlet-loyalty-points"],
  "/outlet/voucher-redeem": ["outlet-loyalty-redeem"],
  "/outlet/daily-sales/new": ["outlet-daily-sales"],
  "/outlet/daily-sales/:id": ["outlet-daily-sales"],
  "/outlet/daily-sales/:id/edit": ["outlet-daily-sales"],
  "/outlet/home": ["outlet-home"],
  "/outlet/daily-orders": ["outlet-daily-orders"],
  "/outlet/end-of-day": ["outlet-end-of-day"],
  "/outlet/crm": ["outlet-crm-hub"],
  "/outlet/reservations": ["outlet-reservation-list"],
  "/outlet/reservations/new": ["outlet-reservation-form"],
  "/outlet/reservations/:id/edit": ["outlet-reservation-form"],
  "/outlet/daily-sales": ["outlet-daily-sales"],
  "/outlet/sales-wizard": ["outlet-sales-wizard"],
  "/outlet/daily-close": ["outlet-daily-close"],
  "/outlet/petty-cash": ["outlet-petty-cash"],
  "/outlet/loyalty/scan": ["outlet-loyalty-scan"],
  "/outlet/loyalty/redeem": ["outlet-loyalty-redeem"],
  "/outlet/urgent-purchase": ["outlet-urgent-purchase"],
  "/outlet/budget": ["outlet-budget-tracker"],
  "/outlet/inventory/stock-check": ["outlet-stock-check"],
  "/outlet/inventory/transfers": ["outlet-stock-transfers"],
  "/outlet/inventory/usage": ["outlet-usage-log"],

  // ==== Admin portal ====
  "/admin": ["admin-home"],
  "/admin/master-data": ["admin-master-data"],
  "/admin/master/:entity": ["admin-master-data"],
  "/admin/cms-studio": ["admin-cms-studio"],
  "/admin/cms/:entity": ["admin-cms-studio"],
  "/admin/cms/menu": ["admin-menu-cms"],
  "/admin/cms/brands": ["admin-cms-studio"],
  "/admin/cms/news": ["admin-cms-studio"],
  "/admin/users": ["admin-users"],
  "/admin/roles": ["admin-roles"],
  // NOTE: `/admin/approval-builder` is NOT a real route — the ApprovalMatrixBuilder
  // page is served at `/admin/approvals` (see AdminPortal.jsx). Mapping kept only
  // on the canonical `/admin/approvals` route below.
  "/admin/workflows": ["admin-workflows"],
  "/admin/bulk-import": ["admin-bulk-import"],
  "/admin/number-series": ["admin-number-series"],
  "/admin/tax": ["admin-tax-config"],
  "/admin/operations": ["admin-operations"],
  "/admin/settings": ["admin-settings"],
  "/admin/loyalty": ["admin-loyalty-overview"],
  "/admin/loyalty/customers": ["admin-loyalty-customers"],
  "/admin/loyalty/rewards": ["admin-loyalty-rewards"],
  "/admin/configuration": ["admin-configuration"],
  "/admin/report-schedules": ["admin-report-schedules"],
  "/admin/data-management": ["admin-data-management"],
  "/admin/smart-seo": ["admin-smart-seo"],
  "/admin/integrations": ["admin-integrations"],
  "/admin/audit-log": ["admin-audit-log"],
  "/admin/tour-analytics": ["admin-tour-analytics"],
  // NOTE: `/admin/approvals` renders ApprovalMatrixBuilder (canonical route).
  // The page shows a "Memuat builder…" loading state that fetches
  // roles+outlets+brands+users+entities; the root container renders immediately
  // (data-testid="approval-matrix-builder") so the tour anchor is always present.
  "/admin/approvals": ["admin-approval-builder"],
  "/admin/user-management": ["admin-user-management"],
  "/admin/setup": ["admin-setup"],
  "/admin/configuration/effective-dating": ["admin-effective-dating"],
  "/admin/loyalty/redemptions": ["admin-loyalty-redemptions"],
  // Removed: `/admin/loyalty/analytics` mapped to admin-loyalty-overview
  // whose targets are on loyalty HOME, not analytics. Prevents runtime drift.
  "/admin/loyalty/customers/:customerId": ["admin-loyalty-customers"],
  // NOTE: `/admin/loyalty/analytics` was a stale mapping to the loyalty-overview
  // tour (which targets loyalty HOME testids). Removed to eliminate route→tour
  // drift; the analytics page will show inline help only.
  "/admin/integrations/:tab": ["admin-integrations"],
  "/admin/operations/:section": ["admin-operations"],
  "/admin/sales-schemas": ["admin-configuration"],
  "/admin/petty-cash-policies": ["admin-configuration"],
  "/admin/service-charge-policies": ["admin-configuration"],
  "/admin/incentive-schemes": ["admin-configuration"],
  "/admin/anomaly-thresholds": ["admin-configuration"],

  // ==== Procurement portal ====
  "/procurement": ["procurement-home"],
  "/procurement/approvals": ["my-approvals"],
  "/procurement/kanban": ["procurement-kanban"],
  "/procurement/pr": ["procurement-pr-list"],
  "/procurement/po": ["procurement-po-list"],
  "/procurement/vendor-comparison": ["procurement-vendor-compare"],
  "/procurement/gr": ["procurement-gr"],
  "/procurement/vendors": ["procurement-vendors"],
  "/procurement/vendor-scorecard": ["procurement-vendor-scorecard"],
  "/procurement/vendor-recommend": ["procurement-vendor-recommend"],
  "/procurement/rfq": ["procurement-rfq"],
  "/procurement/consolidation": ["procurement-consolidation"],
  "/procurement/po-comparison": ["procurement-po-comparison"],
  "/procurement/price-intelligence": ["procurement-price-intelligence"],
  "/procurement/vendor-catalog": ["procurement-vendor-catalog"],
  // NOTE: `/{pr,po,gr,rfq}/new` form pages intentionally NOT mapped to their
  // list tours — the form has different testids than the list. Detail routes
  // `/{pr,po}/:id` also intentionally omitted (detail-specific tours can be
  // added later). Mapping them to the list tour causes runtime drift.
  "/procurement/pr/:id": ["procurement-pr-list"],
  "/procurement/po/:id": ["procurement-po-list"],
  "/procurement/rfq/:id": ["procurement-rfq"],

  // ==== Finance portal ====
  "/finance": ["finance-home"],
  "/finance/approvals": ["my-approvals"],
  "/finance/validation": ["finance-validation"],
  "/finance/manual-journal": ["finance-manual-journal"],
  "/finance/ap-aging": ["finance-ap"],
  "/finance/journals": ["finance-journals"],
  "/finance/payment-requests": ["finance-payment-requests"],
  "/finance/payments": ["finance-payments"],
  "/finance/bank-recon": ["finance-bank-recon"],
  // NOTE: `/finance/ar` is not a real route — AR invoices live at
  // `/finance/ar-invoices` (see FinancePortal.jsx). Mapping kept there.
  "/finance/trial-balance": ["finance-trial-balance"],
  "/finance/balance-sheet": ["finance-balance-sheet"],
  "/finance/cashflow": ["finance-cashflow"],
  "/finance/coa": ["finance-coa"],
  "/finance/profit-loss": ["finance-profit-loss"],
  "/finance/anomalies": ["finance-anomalies"],
  "/finance/comparatives": ["finance-comparatives"],
  "/finance/periods": ["finance-periods"],
  "/finance/period-closing": ["finance-period-closing"],
  // Consolidated hubs (current IA — sidebar lands here)
  "/finance/payments-hub": ["finance-payments-hub"],
  "/finance/reports": ["finance-reports-hub"],
  "/finance/tax": ["finance-tax-hub"],
  "/finance/budget-hub": ["finance-budget-hub"],
  "/finance/assets": ["finance-assets"],
  "/finance/assets/:id": ["finance-assets"],
  "/finance/cash-position": ["finance-cash-position"],
  "/finance/vendor-scorecard": ["finance-vendor-scorecard"],
  "/finance/reservation-deposits": ["finance-reservation-deposits"],
  "/finance/payment-runs": ["finance-payment-runs"],
  "/finance/payment-runs/:id": ["finance-payment-runs"],
  "/finance/payment-run-templates": ["finance-payment-run-templates"],
  "/finance/payment-run-templates/:id": ["finance-payment-run-templates"],
  "/finance/forecasting": ["finance-forecasting"],
  "/finance/budget": ["finance-budget-vs-actual"],
  // NOTE: `/finance/budget/manage` renders BudgetManagement (a form), not the
  // hub. Removed to eliminate route→tour drift; add a dedicated budget-manage
  // tour if a walkthrough is needed there.
  "/finance/efaktur": ["finance-efaktur"],
  "/finance/ebupot": ["finance-ebupot"],
  // NOTE: `/finance/tax-center` renders the legacy standalone TaxCenter, not
  // the unified FinanceTaxHub whose tour targets tab-testids. Removed.
  "/finance/ar-invoices": ["finance-ar"],
  // NOTE: `/finance/payments/new` and `/finance/payment-requests/new` render
  // form pages, not lists. Removed to eliminate route→tour drift.
  "/finance/payments/:id": ["finance-payments"],
  "/finance/payment-requests/:id": ["finance-payment-requests"],
  "/finance/journals/:id": ["finance-journals"],
  "/finance/period-closing/:period": ["finance-period-closing"],

  // ==== Inventory portal ====
  "/inventory": ["inventory-home"],
  "/inventory/balance": ["inventory-balance"],
  "/inventory/movements": ["inventory-movements"],
  "/inventory/movements-hub": ["inventory-movements-hub"],
  "/inventory/opname": ["inventory-opname"],
  "/inventory/opname/:id": ["inventory-opname"],
  "/inventory/transfers": ["inventory-transfers"],
  "/inventory/transfers/:id": ["inventory-transfers"],
  "/inventory/adjustments": ["inventory-adjustment"],
  "/inventory/low-stock": ["inventory-low-stock"],
  "/inventory/market-list": ["inventory-market-list"],
  "/inventory/valuation": ["inventory-valuation"],

  // ==== Executive portal ====
  "/executive": ["executive-owner-home"],
  "/executive/approvals": ["my-approvals"],
  "/executive/brand": ["executive-brand-mix"],
  "/executive/brand/:brandId": ["executive-brand-drilldown"],
  "/executive/outlet/:outletId": ["executive-outlet-drilldown"],
  "/executive/analytics": ["executive-home"],
  "/executive/ai-qa": ["executive-ai-qa"],
  // NOTE: `/executive/ai` doesn't exist as a route (ExecutivePortal has only
  // ai-qa). Removed to eliminate route→tour drift.
  "/executive/anomaly": ["executive-anomaly"],
  "/executive/analytics-hub": ["executive-analytics-hub"],
  // NOTE: `/executive/brand-mix` is not a real route — BrandMixOverview is served
  // at `/executive/brand` (see ExecutivePortal.jsx). Mapping kept there.
  "/executive/profit-walk": ["executive-profit-walk"],
  "/executive/period-compare": ["executive-period-compare"],
  "/executive/reservations": ["executive-reservations"],
  "/executive/budget-approvals": ["executive-budget-approvals"],
  "/executive/outlet-budgets": ["executive-outlet-budgets"],
  "/executive/budget-monitor": ["executive-budget-monitor"],
  "/executive/budget-increase-requests": ["executive-budget-increase"],

  // ==== Owner portal ====
  "/owner": ["owner-home"],
  "/owner/cockpit": ["owner-home"],
  "/owner/cash": ["owner-cash"],
  "/owner/approvals": ["my-approvals"],
  "/owner/briefing": ["owner-briefing"],
  "/owner/ai-assistant": ["owner-ai-assistant"],
  "/owner/digest-settings": ["owner-digest-settings"],

  // ==== HR portal ====
  "/hr": ["hr-home"],
  "/hr/approvals": ["my-approvals"],
  "/hr/voucher": ["hr-voucher"],
  "/hr/foc": ["hr-foc"],
  "/hr/lb-fund": ["hr-lb-fund"],
  "/hr/payroll": ["hr-payroll"],
  "/hr/advances": ["hr-advances"],
  "/hr/leaves": ["hr-leaves"],
  "/hr/job-applications": ["hr-job-applications"],
  "/hr/job-listings": ["hr-job-listings"],
  "/hr/service-charge": ["hr-service-charge"],
  "/hr/incentive": ["hr-incentive"],
  "/hr/compensation": ["hr-compensation"],

  // ==== Top-level (cross-portal) ====
  "/approvals": ["my-approvals"],
  "/my-approvals": ["my-approvals"],
};

// =====================================================
// TOUR METADATA
// =====================================================

const tourMetadata = {
  // ==== Outlet ====
  "outlet-home": { title: "Outlet — Workbench Harian", description: "Cara mengelola tugas harian outlet", icon: "🏪" },
  "outlet-daily-orders": { title: "Daily Orders Hub (KDO, BDO, FDO)", description: "Kelola semua purchase orders harian dari satu tempat", icon: "📋" },
  "outlet-end-of-day": { title: "End-of-Day Workflow", description: "4 langkah penutupan harian outlet", icon: "🔒" },
  "outlet-crm-hub": { title: "CRM & Reservasi Hub", description: "Panduan mengelola reservasi dan loyalty member", icon: "📊" },
  "outlet-reservation-list": { title: "Daftar Reservasi", description: "Status reservasi & downpayment tracking", icon: "📋" },
  "outlet-reservation-form": { title: "Form Reservasi", description: "Cara membuat & mengedit reservasi", icon: "✏️" },
  "outlet-daily-sales": { title: "Daily Sales", description: "Cara input penjualan harian", icon: "💵" },
  "outlet-sales-wizard": { title: "Sales Wizard 5-Langkah", description: "Wizard input daily sales per channel & payment", icon: "🧙" },
  "outlet-daily-close": { title: "Daily Close", description: "Penutupan harian outlet dengan validasi lengkap", icon: "🔒" },
  "outlet-petty-cash": { title: "Petty Cash", description: "Kelola kas kecil outlet", icon: "🧧" },
  "outlet-loyalty-scan": { title: "Input Poin Loyalty", description: "Scan struk untuk akumulasi poin member", icon: "⚡" },
  "outlet-loyalty-redeem": { title: "Redeem Voucher", description: "Tukar poin / voucher member di kasir", icon: "🎁" },
  "outlet-urgent-purchase": { title: "Urgent Purchase", description: "Pembelian mendesak di luar siklus PR normal", icon: "🚨" },
  "outlet-budget-tracker": { title: "Budget Saya", description: "Pantau sisa budget operasional & ajukan penambahan", icon: "💰" },
  "outlet-stock-check": { title: "Stock Check", description: "Cek stok outlet real-time & mulai opname", icon: "📦" },
  "outlet-stock-transfers": { title: "Stock Transfers", description: "Kirim & terima transfer stok antar outlet", icon: "🚛" },
  "outlet-usage-log": { title: "Usage Log", description: "Catat pemakaian & waste bahan baku outlet", icon: "📋" },
  "outlet-loyalty-points": { title: "Input Poin Loyalty", description: "Tambah poin member dari kasir berdasarkan transaksi", icon: "⭐" },

  // ==== Admin ====
  "admin-home": { title: "Admin Home", description: "Tour cepat halaman utama admin", icon: "⚙️" },
  "admin-master-data": { title: "Master Data Hub", description: "Kelola semua master data dalam satu halaman", icon: "🗂️" },
  "admin-cms-studio": { title: "CMS Studio", description: "9 entitas CMS website public dalam satu workspace", icon: "📰" },
  "admin-menu-cms": { title: "E-Menu CMS", description: "Kelola menu, upload foto & PDF", icon: "🍽️" },
  "admin-cms-brands": { title: "CMS Studio — Brands", description: "Edit profil brand untuk website public", icon: "🏷️" },
  "admin-cms-news": { title: "CMS Studio — News", description: "Publish artikel & konten website", icon: "📰" },
  "admin-users": { title: "Manajemen User", description: "Buat user, atur role, dan reset password", icon: "👥" },
  "admin-roles": { title: "Roles & Permissions", description: "Kelola peran dan izin akses untuk semua user", icon: "🔐" },
  "admin-approval-builder": { title: "Approval Matrix Builder", description: "Bangun workflow approval multi-tier secara visual", icon: "🔀" },
  "admin-workflows": { title: "Approval Workflows", description: "Kelola aturan approval berbasis teks untuk semua modul", icon: "📋" },
  "admin-bulk-import": { title: "Bulk Excel Import", description: "Import ratusan data sekaligus via CSV/Excel", icon: "📊" },
  "admin-number-series": { title: "Number Series", description: "Atur format nomor otomatis untuk semua jenis dokumen", icon: "🔢" },
  "admin-tax-config": { title: "Tax Configuration", description: "Atur tax codes dan rate PPN/service charge", icon: "💰" },
  "admin-operations": { title: "System Operations", description: "Pantau kesehatan sistem: metrics, logs, scheduler", icon: "⚙️" },
  "admin-settings": { title: "System Settings", description: "Konfigurasi global sistem: timezone, branding, parameter", icon: "🔧" },
  "admin-loyalty-overview": { title: "Loyalty Admin — Overview", description: "Dashboard program loyalty: member, poin, rewards", icon: "🎁" },
  "admin-loyalty-customers": { title: "Loyalty Customers", description: "Kelola daftar member loyalty", icon: "👥" },
  "admin-loyalty-rewards": { title: "Loyalty Rewards Catalog", description: "Kelola katalog rewards program", icon: "🎁" },
  "admin-configuration": { title: "Business Rules Configuration", description: "Atur parameter bisnis per outlet", icon: "📋" },
  "admin-report-schedules": { title: "Laporan Terjadwal", description: "Atur laporan otomatis via Email/WhatsApp/Telegram", icon: "📅" },
  "admin-data-management": { title: "Manajemen Data", description: "Export, import, dan hapus data dalam jumlah besar", icon: "💾" },
  "admin-smart-seo": { title: "Smart SEO AI", description: "Optimalkan SEO website dengan bantuan AI", icon: "🔍" },
  "admin-integrations": { title: "Integrations Hub", description: "Konfigurasi API key (LLM, Email, WhatsApp, dll)", icon: "🔌" },
  "admin-audit-log": { title: "Audit Log", description: "Lacak semua aktivitas user di sistem", icon: "🔍" },
  "admin-tour-analytics": { title: "Tour Analytics", description: "Lacak penggunaan & efektivitas Help & Tour", icon: "📊" },
  "admin-user-management": { title: "User Management Hub", description: "Users, Roles & Activity Log dalam satu workspace", icon: "👥" },
  "admin-setup": { title: "Setup & Numbering Hub", description: "Number Series, Tax Config & Bulk Import", icon: "🔧" },
  "admin-effective-dating": { title: "Effective Dating Timeline", description: "Kapan tiap konfigurasi berlaku (timeline versi aturan)", icon: "🗓️" },
  "admin-loyalty-redemptions": { title: "Loyalty Redemptions", description: "Pantau & proses penukaran reward member", icon: "🎁" },

  // ==== Procurement ====
  "procurement-home": { title: "Procurement Home", description: "Overview pembelian & approvals", icon: "🛒" },
  "procurement-kanban": { title: "Workboard Kanban", description: "Drag & drop PR → PO → GR", icon: "🗂️" },
  "procurement-pr-list": { title: "Purchase Requests", description: "Kelola & approve permintaan pembelian", icon: "📝" },
  "procurement-po-list": { title: "Purchase Orders", description: "Buat, kirim & pantau PO ke vendor", icon: "📦" },
  "procurement-vendor-compare": { title: "Bandingkan Vendor", description: "Cari vendor terbaik berdasarkan history", icon: "⚖️" },
  "procurement-gr": { title: "Penerimaan Barang (GR)", description: "Posting GR & auto-journal AP", icon: "🚚" },
  "procurement-vendors": { title: "All Vendors", description: "Lihat dan kelola semua vendor terdaftar", icon: "🏢" },
  "procurement-vendor-scorecard": { title: "Vendor Scorecard", description: "Peringkat performa vendor berdasarkan historis", icon: "📊" },
  "procurement-vendor-recommend": { title: "AI Vendor Recommendation", description: "AI merekomendasikan vendor terbaik", icon: "🤖" },
  "procurement-rfq": { title: "RFQ — Request for Quotation", description: "Kirim permintaan penawaran harga ke vendor", icon: "📋" },
  "procurement-consolidation": { title: "PR Consolidation", description: "Gabungkan banyak PR jadi PO efisien per vendor", icon: "🧩" },
  "procurement-po-comparison": { title: "PO Comparison", description: "Bandingkan PO antar vendor untuk penawaran terbaik", icon: "⚖️" },
  "procurement-price-intelligence": { title: "Price Intelligence", description: "Pantau deviasi harga beli vs harga acuan pasar", icon: "💹" },
  "procurement-vendor-catalog": { title: "Vendor Catalog", description: "Katalog item per vendor + riwayat harga", icon: "📒" },

  // ==== Finance ====
  "finance-home": { title: "Finance Home", description: "Validasi sales, AP, approvals", icon: "💰" },
  "finance-validation": { title: "Sales Validation Queue", description: "Review dan validasi daily sales dari semua outlet", icon: "✅" },
  "finance-manual-journal": { title: "Manual Journal Entry", description: "Buat jurnal akuntansi manual dengan validasi Dr=Cr", icon: "📓" },
  "finance-ap": { title: "AP Aging — Hutang Dagang", description: "Pantau aging hutang ke vendor", icon: "📒" },
  "finance-journals": { title: "Journal Entries", description: "Lihat, filter & buat JAE manual", icon: "📓" },
  "finance-payment-requests": { title: "Payment Requests", description: "Daftar semua payment request yang diajukan", icon: "💳" },
  "finance-payments": { title: "Payment Requests — Workflow Pembayaran", description: "Workflow pembayaran: request → approve → paid", icon: "💳" },
  "finance-bank-recon": { title: "Bank Reconciliation", description: "Upload mutasi rekening dan cocokkan dengan JE", icon: "🏦" },
  "finance-ar": { title: "AR Invoices — Piutang Dagang", description: "Kelola invoice ke customer B2B", icon: "📄" },
  "finance-trial-balance": { title: "Trial Balance", description: "Neraca saldo semua akun COA", icon: "⚖️" },
  "finance-balance-sheet": { title: "Balance Sheet — Neraca Keuangan", description: "Laporan posisi keuangan: Aset, Kewajiban, Ekuitas", icon: "📊" },
  "finance-cashflow": { title: "Cashflow Statement — Arus Kas", description: "Laporan arus kas: operasional, investasi, pendanaan", icon: "💵" },
  "finance-coa": { title: "Chart of Accounts (COA)", description: "Browse dan manage akun-akun buku besar", icon: "📖" },
  "finance-profit-loss": { title: "Profit & Loss — Laporan Laba Rugi", description: "Baca dan drill-down laporan P&L", icon: "📈" },
  "finance-anomalies": { title: "Anomaly Feed — Deteksi Keuangan", description: "Review flag anomali otomatis dari seluruh data keuangan", icon: "🚨" },
  "finance-comparatives": { title: "Period Comparatives", description: "Bandingkan performa keuangan antar periode", icon: "📊" },
  "finance-periods": { title: "Period Locking", description: "Kelola periode akuntansi & enforcement", icon: "📅" },
  "finance-period-closing": { title: "Period Closing Hub", description: "Workflow 4-fase tutup bulan akuntansi", icon: "🔒" },
  "finance-payments-hub": { title: "Payments Hub", description: "Payment Requests, AP, Payments, Runs, Bank Recon & AR dalam satu workspace", icon: "💳" },
  "finance-reports-hub": { title: "Reports Hub", description: "Trial Balance, P&L, Balance Sheet, Cashflow & Pivot bertab", icon: "📊" },
  "finance-tax-hub": { title: "Tax Center Hub", description: "Tax Center, e-Faktur, dan e-Bupot dalam satu tempat", icon: "🧾" },
  "finance-budget-hub": { title: "Budget Hub", description: "Budget vs Actual, Management, dan Forecasting", icon: "📐" },
  "finance-assets": { title: "Fixed Assets — Aset Tetap", description: "Kelola aset tetap, nilai buku, dan penyusutan", icon: "🏗️" },
  "finance-cash-position": { title: "Cash Position", description: "Posisi kas real-time, runway, dan rencana kas", icon: "💵" },
  "finance-vendor-scorecard": { title: "Vendor Scorecard", description: "Peringkat performa vendor dari sisi finance", icon: "🏆" },
  "finance-reservation-deposits": { title: "Deposit Reservasi", description: "Rekap deposit reservasi outlet sebagai kewajiban", icon: "🎟️" },
  "finance-payment-runs": { title: "Payment Runs", description: "Proses pembayaran batch ke banyak vendor", icon: "🏦" },
  "finance-payment-run-templates": { title: "Payment Run Templates", description: "Template pembayaran batch berulang", icon: "🗂️" },
  "finance-forecasting": { title: "Forecasting", description: "Proyeksi keuangan berbasis tren historis", icon: "🔮" },
  "finance-budget-vs-actual": { title: "Budget vs Actual", description: "Bandingkan anggaran vs realisasi per akun/periode", icon: "📏" },
  "finance-efaktur": { title: "e-Faktur Export", description: "Generate file e-Faktur PPN untuk DJP", icon: "🧾" },
  "finance-ebupot": { title: "e-Bupot Export", description: "Generate bukti potong PPh (e-Bupot)", icon: "🧾" },

  // ==== Inventory ====
  "inventory-home": { title: "Inventory Home", description: "Overview stock & alerts", icon: "📦" },
  "inventory-balance": { title: "Stock Balance — Matrix Stok", description: "Stok real-time: list dan matrix view", icon: "📊" },
  "inventory-movements": { title: "Movement Journal", description: "Timeline keluar-masuk barang lengkap", icon: "🔄" },
  "inventory-movements-hub": { title: "Stock Movements Hub", description: "History, transfers & adjustments dalam satu tempat", icon: "📦" },
  "inventory-opname": { title: "Stock Opname", description: "Hitung stok fisik dengan AI variance analysis", icon: "🔢" },
  "inventory-transfers": { title: "Transfer Stok", description: "Pindahkan stok antar outlet dengan traceability", icon: "🚛" },
  "inventory-adjustment": { title: "Stock Adjustment", description: "Koreksi stok: damage, expired, loss", icon: "⚠️" },
  "inventory-low-stock": { title: "Low Stock Alert", description: "Monitor item di bawah par level dan buat PR otomatis", icon: "⚠️" },
  "inventory-market-list": { title: "Market List — Harga Acuan", description: "Pantau harga pasar referensi dan approve harga kwartal", icon: "💰" },
  "inventory-valuation": { title: "Inventory Valuation", description: "Nilai stok per outlet pada tanggal tertentu", icon: "🧮" },

  // ==== Executive ====
  "executive-home": { title: "Executive Dashboard", description: "KPI strip + drilldown + insights", icon: "📈" },
  "executive-owner-home": { title: "Dashboard Eksekutif", description: "Ringkasan owner: KPI, anomali, approvals, akses cepat", icon: "👑" },
  "executive-outlet-drilldown": { title: "Detail Outlet", description: "KPI, P&L, inventory & staff per outlet", icon: "🏪" },
  "executive-brand-drilldown": { title: "Detail Brand", description: "KPI, cost structure, outlet & trend per brand", icon: "🏷️" },
  "executive-ai-qa": { title: "AI Q&A Assistant", description: "Tanya AI tentang performance bisnis", icon: "🤖" },
  "executive-anomaly": { title: "Anomaly Detection", description: "AI mendeteksi pola anomali di data bisnis dan keuangan", icon: "🚨" },
  "executive-brand-mix": { title: "Brand Mix Overview", description: "Analisis kontribusi dan performa masing-masing brand", icon: "📊" },
  "executive-profit-walk": { title: "Profit Walk — Analisis Laba", description: "Waterfall chart kontribusi tiap komponen ke laba bersih", icon: "📈" },
  "executive-period-compare": { title: "Period Compare — Perbandingan Periode", description: "Bandingkan KPI bisnis antar periode secara visual", icon: "📊" },
  "executive-analytics-hub": { title: "Performance Analytics Hub", description: "Brand Mix, Profit Walk & Period Compare bertab", icon: "📈" },
  "executive-reservations": { title: "Ringkasan Reservasi", description: "Pantau reservasi & deposit lintas outlet", icon: "📅" },
  "executive-budget-approvals": { title: "Budget Approvals", description: "Setujui/tolak pengajuan budget outlet", icon: "✅" },
  "executive-outlet-budgets": { title: "Set Budget Outlet", description: "Alokasikan budget operasional per outlet & periode", icon: "🎯" },
  "executive-budget-monitor": { title: "Budget Monitor", description: "Pantau realisasi vs budget outlet (heatmap & pace)", icon: "📡" },
  "executive-budget-increase": { title: "Request Penambahan Budget", description: "Tinjau & putuskan permintaan penambahan budget", icon: "➕" },

  // ==== Owner ====
  "owner-home": { title: "Owner Cockpit", description: "Cash + profit walk + approvals", icon: "👑" },
  "owner-cash": { title: "Cash Position", description: "Lihat posisi kas total group dan proyeksi ke depan", icon: "🏦" },
  "owner-approvals": { title: "My Approvals", description: "Setujui permintaan dari mobile", icon: "✅" },
  "owner-briefing": { title: "Daily Briefing AI", description: "Ringkasan bisnis harian otomatis dengan AI analysis", icon: "📄" },
  "owner-ai-assistant": { title: "Business Q&A — AI Assistant", description: "Tanya apapun tentang bisnis dalam Bahasa Indonesia", icon: "🤖" },
  "owner-digest-settings": { title: "Pengaturan Daily Briefing", description: "Atur pengiriman ringkasan harian via Telegram & langganan", icon: "📨" },

  // ==== HR ====
  "hr-home": { title: "HR Home", description: "Overview employees, payroll & advance", icon: "👤" },
  "hr-payroll": { title: "HR Payroll", description: "Kelola penggajian bulanan karyawan", icon: "💼" },
  "hr-advances": { title: "Employee Advances", description: "Kelola kasbon karyawan", icon: "💸" },
  "hr-leaves": { title: "Leave Management", description: "Kelola cuti dan absensi karyawan", icon: "📆" },
  "hr-job-applications": { title: "Job Applications", description: "Review lamaran kerja dari website", icon: "📄" },
  "hr-job-listings": { title: "Job Listings", description: "Buat dan kelola lowongan kerja di website public", icon: "📋" },
  "hr-service-charge": { title: "Service Charge Distribution", description: "Distribusi service charge dari penjualan ke karyawan", icon: "💰" },
  "hr-incentive": { title: "Incentive Management", description: "Kelola bonus dan insentif kinerja karyawan", icon: "🎁" },
  "hr-compensation": { title: "Compensation Hub", description: "7 modul remunerasi karyawan dalam satu workspace", icon: "💰" },
  "hr-voucher": { title: "HR Voucher", description: "Terbitkan & kelola voucher karyawan", icon: "🎫" },
  "hr-foc": { title: "FOC — Free of Charge", description: "Catat & kontrol transaksi gratis (FOC)", icon: "🆓" },
  "hr-lb-fund": { title: "LB Fund Ledger", description: "Buku besar dana bersama karyawan", icon: "🤝" },

  // ==== General ====
  "general-navigation": { title: "Navigasi Umum", description: "Cara mengelola sistem ERP secara umum", icon: "🧭" },
  "approval-center": { title: "Approval Center", description: "Inbox persetujuan terpusat + delegasi untuk semua dokumen", icon: "✅" },
  "my-approvals": { title: "My Approvals", description: "Inbox persetujuan personal — approve/reject cepat", icon: "✅" },
};

// =====================================================
// LOOKUP HELPERS
// =====================================================

export function getToursForPath(path) {
  const ids = [];

  // Exact match
  if (pathToTours[path]) {
    ids.push(...pathToTours[path]);
  } else {
    // Pattern match (dynamic params e.g. /admin/master/:entity, /outlet/reservations/:id/edit)
    for (const [pattern, tourIds] of Object.entries(pathToTours)) {
      if (pattern.includes(":")) {
        const regex = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$");
        if (regex.test(path)) {
          ids.push(...tourIds);
          break;
        }
      }
    }
  }

  // Always include general-navigation as fallback
  if (!ids.includes("general-navigation")) {
    ids.push("general-navigation");
  }

  return ids;
}

export function getTourMetadata(tourId) {
  return tourMetadata[tourId] || null;
}

export { pathToTours, tourMetadata };
