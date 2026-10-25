/**
 * tourMap.js — Centralized mapping of routes → tour IDs + tour metadata
 *
 * Format:
 *   pathToTours: { "/path": ["tour-id-1", "tour-id-2"] }
 *   - exact match first
 *   - prefix match with "/*" suffix
 *   - dynamic params via ":param" segments
 *   - tab hub via query: "/hr/compensation?tab=advances" → tour halaman lama yang kini menjadi tab
 *
 *   tourMetadata: { "tour-id": { title, description, icon } }
 */

// =====================================================
// PATH → TOURS MAPPING
// =====================================================

const pathToTours = {
  // ==== Outlet portal ====
  "/outlet": ["outlet-home"],
  "/outlet/loyalty/input-poin": ["outlet-loyalty-points"],
  "/outlet/voucher-redeem": ["outlet-loyalty-redeem"],
  "/outlet/daily-sales/new": ["outlet-daily-sales", "outlet-sales-wizard"],
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
  "/outlet/end-of-day?step=3": ["outlet-daily-close"],
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
  "/admin/master/:entity": ["admin-master-data"],
  "/admin/cms/:entity": ["admin-cms-studio"],
  "/admin/cms/menu": ["admin-menu-cms"],
  "/admin/cms/brands": ["admin-cms-studio"],
  "/admin/cms/news": ["admin-cms-studio"],
  "/admin/user-management?tab=users": ["admin-users"],
  "/admin/user-management?tab=roles": ["admin-roles"],
  // NOTE: `/admin/approval-builder` is NOT a real route — the ApprovalMatrixBuilder
  // page is served at `/admin/approvals` (see AdminPortal.jsx). Mapping kept only
  // on the canonical `/admin/approvals` route below.
  "/admin/approvals": ["admin-approval-builder"],
  "/admin/setup?tab=bulk-import": ["admin-bulk-import"],
  "/admin/setup?tab=number-series": ["admin-number-series"],
  "/admin/setup?tab=tax-config": ["admin-tax-config"],
  "/admin/operations": ["admin-operations"],
  "/admin/settings": ["admin-settings"],
  "/admin/loyalty": ["admin-loyalty-overview"],
  "/admin/loyalty?tab=customers": ["admin-loyalty-customers"],
  "/admin/loyalty?tab=rewards": ["admin-loyalty-rewards"],
  "/admin/configuration": ["admin-configuration"],
  "/admin/operations/report-schedules": ["admin-report-schedules"],
  "/admin/operations/data-management": ["admin-data-management"],
  "/admin/smart-seo": ["admin-smart-seo"],
  "/admin/integrations": ["admin-integrations"],
  "/admin/user-management?tab=audit-log": ["admin-audit-log"],
  "/admin/operations/tour-analytics": ["admin-tour-analytics"],
  // NOTE: `/admin/approvals` renders ApprovalMatrixBuilder (canonical route).
  // The page shows a "Memuat builder…" loading state that fetches
  // roles+outlets+brands+users+entities; the root container renders immediately
  // (data-testid="approval-matrix-builder") so the tour anchor is always present.
  "/admin/user-management": ["admin-user-management"],
  "/admin/setup": ["admin-setup"],
  "/admin/configuration/effective-dating": ["admin-effective-dating"],
  "/admin/loyalty?tab=redemptions": ["admin-loyalty-redemptions"],
  "/admin/loyalty/customers/:customerId": ["admin-loyalty-customers"],
  "/admin/integrations/:tab": ["admin-integrations"],
  "/admin/operations/:section": ["admin-operations"],
  "/admin/sales-schemas": ["admin-configuration"],
  "/admin/petty-cash-policies": ["admin-configuration"],
  "/admin/service-charge-policies": ["admin-configuration"],
  "/admin/incentive-schemes": ["admin-configuration"],
  "/admin/anomaly-thresholds": ["admin-configuration"],

  // ==== Procurement portal ====
  "/procurement": ["procurement-home"],
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
  "/finance/validation": ["finance-validation"],
  "/finance/manual-journal": ["finance-manual-journal"],
  "/finance/payments-hub?tab=ap-aging": ["finance-ap"],
  "/finance/journals": ["finance-journals"],
  "/finance/payments-hub?tab=payments": ["finance-payments", "finance-payment-requests"],
  "/finance/payments-hub?tab=bank-recon": ["finance-bank-recon"],
  "/finance/coa": ["finance-coa"],
  "/finance/period-closing?phase=1": ["finance-anomalies"],
  "/finance/period-closing?phase=0": ["finance-periods"],
  "/finance/period-closing": ["finance-period-closing"],
  // Consolidated hubs (current IA — sidebar lands here)
  "/finance/payments-hub": ["finance-payments-hub"],
  "/finance/reports": ["finance-reports-hub"],
  "/finance/tax": ["finance-tax-hub"],
  "/finance/budget-hub": ["finance-budget-hub"],
  "/finance/assets": ["finance-assets"],
  "/finance/assets/:id": ["finance-assets"],
  "/finance/payments-hub?tab=cash-position": ["finance-cash-position"],
  "/finance/vendor-scorecard": ["finance-vendor-scorecard"],
  "/finance/payments-hub?tab=deposits": ["finance-reservation-deposits"],
  "/finance/payments-hub?tab=payment-runs": ["finance-payment-runs"],
  "/finance/payment-runs/:id": ["finance-payment-runs"],
  "/finance/payments-hub?tab=run-templates": ["finance-payment-run-templates"],
  "/finance/payment-run-templates/:id": ["finance-payment-run-templates"],
  "/finance/budget-hub?tab=forecasting": ["finance-forecasting"],
  "/finance/budget-hub?tab=vs-actual": ["finance-budget-vs-actual"],
  "/finance/tax?tab=efaktur": ["finance-efaktur"],
  "/finance/tax?tab=ebupot": ["finance-ebupot"],
  "/finance/payments-hub?tab=ar-invoices": ["finance-ar"],
  "/finance/payments/:id": ["finance-payments", "finance-payment-requests"],
  "/finance/journals/:id": ["finance-journals"],
  "/finance/period-closing/:period": ["finance-period-closing"],

  // ==== Inventory portal ====
  "/inventory": ["inventory-home"],
  "/inventory/balance": ["inventory-balance"],
  "/inventory/movements-hub": ["inventory-movements-hub"],
  "/inventory/opname": ["inventory-opname"],
  "/inventory/opname/:id": ["inventory-opname"],
  "/inventory/movements-hub?type=transfers": ["inventory-transfers"],
  "/inventory/transfers/:id": ["inventory-transfers"],
  "/inventory/movements-hub?type=adjustments": ["inventory-adjustment"],
  "/inventory/low-stock": ["inventory-low-stock"],
  "/inventory/market-list": ["inventory-market-list"],
  "/inventory/valuation": ["inventory-valuation"],

  // ==== Executive portal ====
  "/executive": ["executive-owner-home"],
  "/executive/analytics-hub?tab=brand": ["executive-brand-mix"],
  "/executive/brand/:brandId": ["executive-brand-drilldown"],
  "/executive/outlet/:outletId": ["executive-outlet-drilldown"],
  "/executive/analytics": ["executive-home"],
  "/executive/ai-qa": ["executive-ai-qa"],
  // NOTE: `/executive/ai` doesn't exist as a route (ExecutivePortal has only
  // ai-qa). Removed to eliminate route→tour drift.
  "/executive/anomaly": ["executive-anomaly"],
  "/executive/analytics-hub": ["executive-analytics-hub"],
  "/executive/analytics-hub?tab=profit-walk": ["executive-profit-walk"],
  "/executive/analytics-hub?tab=period-compare": ["executive-period-compare"],
  "/executive/reservations": ["executive-reservations"],
  "/executive/budget-approvals": ["executive-budget-approvals"],
  "/executive/outlet-budgets": ["executive-outlet-budgets"],
  "/executive/budget-monitor": ["executive-budget-monitor"],
  "/executive/budget-increase-requests": ["executive-budget-increase"],

  // ==== Owner portal ====
  "/owner": ["owner-home"],
  "/owner/cash": ["owner-cash"],
  "/owner/briefing": ["owner-briefing"],
  "/owner/ai-assistant": ["owner-ai-assistant"],
  "/owner/digest-settings": ["owner-digest-settings"],

  // ==== HR portal ====
  "/hr": ["hr-home"],
  "/hr/compensation?tab=voucher": ["hr-voucher"],
  "/hr/compensation?tab=foc": ["hr-foc"],
  "/hr/compensation?tab=lb-fund": ["hr-lb-fund"],
  "/hr/compensation?tab=payroll": ["hr-payroll"],
  "/hr/compensation?tab=advances": ["hr-advances"],
  "/hr/leaves": ["hr-leaves"],
  "/hr/job-applications": ["hr-job-applications"],
  "/hr/job-listings": ["hr-job-listings"],
  "/hr/compensation?tab=service-charge": ["hr-service-charge"],
  "/hr/compensation?tab=incentive": ["hr-incentive"],
  "/hr/compensation": ["hr-compensation"],

  // ==== Top-level (cross-portal) ====
  "/my-approvals": ["my-approvals"],
  "/finance/reports?tab=trial-balance": ["finance-trial-balance"],
  "/finance/reports?tab=balance-sheet": ["finance-balance-sheet"],
  "/finance/reports?tab=cashflow": ["finance-cashflow"],
  "/finance/reports?tab=profit-loss": ["finance-profit-loss"],
  "/finance/reports?tab=comparatives": ["finance-comparatives"],
  "/inventory/movements-hub?type=history": ["inventory-movements"],
};

// =====================================================
// TOUR METADATA
// =====================================================

const tourMetadata = {
  // ==== Outlet ====
  "outlet-home": { title: "Outlet — Workbench Harian", description: "Cara mengelola tugas harian outlet" },
  "outlet-daily-orders": { title: "Daily Orders Hub (KDO, BDO, FDO)", description: "Kelola semua purchase orders harian dari satu tempat" },
  "outlet-end-of-day": { title: "End-of-Day Workflow", description: "4 langkah penutupan harian outlet" },
  "outlet-crm-hub": { title: "CRM & Reservasi Hub", description: "Panduan mengelola reservasi dan loyalty member" },
  "outlet-reservation-list": { title: "Daftar Reservasi", description: "Status reservasi & downpayment tracking" },
  "outlet-reservation-form": { title: "Form Reservasi", description: "Cara membuat & mengedit reservasi" },
  "outlet-daily-sales": { title: "Daily Sales", description: "Cara input penjualan harian" },
  "outlet-sales-wizard": { title: "Sales Wizard 5-Langkah", description: "Wizard input daily sales per channel & payment" },
  "outlet-daily-close": { title: "Daily Close", description: "Penutupan harian outlet dengan validasi lengkap" },
  "outlet-petty-cash": { title: "Petty Cash", description: "Kelola kas kecil outlet" },
  "outlet-loyalty-scan": { title: "Input Poin Loyalty", description: "Scan struk untuk akumulasi poin member" },
  "outlet-loyalty-redeem": { title: "Redeem Voucher", description: "Tukar poin / voucher member di kasir" },
  "outlet-urgent-purchase": { title: "Urgent Purchase", description: "Pembelian mendesak di luar siklus PR normal" },
  "outlet-budget-tracker": { title: "Budget Saya", description: "Pantau sisa budget operasional & ajukan penambahan" },
  "outlet-stock-check": { title: "Stock Check", description: "Cek stok outlet real-time & mulai opname" },
  "outlet-stock-transfers": { title: "Stock Transfers", description: "Kirim & terima transfer stok antar outlet" },
  "outlet-usage-log": { title: "Usage Log", description: "Catat pemakaian & waste bahan baku outlet" },
  "outlet-loyalty-points": { title: "Input Poin Loyalty", description: "Tambah poin member dari kasir berdasarkan transaksi" },

  // ==== Admin ====
  "admin-home": { title: "Admin Home", description: "Tour cepat halaman utama admin" },
  "admin-master-data": { title: "Master Data Hub", description: "Kelola semua master data dalam satu halaman" },
  "admin-cms-studio": { title: "CMS Studio", description: "9 entitas CMS website public dalam satu workspace" },
  "admin-menu-cms": { title: "E-Menu CMS", description: "Kelola menu, upload foto & PDF" },
  "admin-cms-brands": { title: "CMS Studio — Brands", description: "Edit profil brand untuk website public" },
  "admin-cms-news": { title: "CMS Studio — News", description: "Publish artikel & konten website" },
  "admin-users": { title: "Manajemen User", description: "Buat user, atur role, dan reset password" },
  "admin-roles": { title: "Roles & Permissions", description: "Kelola peran dan izin akses untuk semua user" },
  "admin-approval-builder": { title: "Approval Matrix Builder", description: "Bangun workflow approval multi-tier secara visual" },
  "admin-bulk-import": { title: "Bulk Excel Import", description: "Import ratusan data sekaligus via CSV/Excel" },
  "admin-number-series": { title: "Number Series", description: "Atur format nomor otomatis untuk semua jenis dokumen" },
  "admin-tax-config": { title: "Tax Configuration", description: "Atur tax codes dan rate PPN/service charge" },
  "admin-operations": { title: "System Operations", description: "Pantau kesehatan sistem: metrics, logs, scheduler" },
  "admin-settings": { title: "System Settings", description: "Konfigurasi global sistem: timezone, branding, parameter" },
  "admin-loyalty-overview": { title: "Loyalty Admin — Overview", description: "Dashboard program loyalty: member, poin, rewards" },
  "admin-loyalty-customers": { title: "Loyalty Customers", description: "Kelola daftar member loyalty" },
  "admin-loyalty-rewards": { title: "Loyalty Rewards Catalog", description: "Kelola katalog rewards program" },
  "admin-configuration": { title: "Business Rules Configuration", description: "Atur parameter bisnis per outlet" },
  "admin-report-schedules": { title: "Laporan Terjadwal", description: "Atur laporan otomatis via Email/WhatsApp/Telegram" },
  "admin-data-management": { title: "Manajemen Data", description: "Export, import, dan hapus data dalam jumlah besar" },
  "admin-smart-seo": { title: "Smart SEO AI", description: "Optimalkan SEO website dengan bantuan AI" },
  "admin-integrations": { title: "Integrations", description: "Konfigurasi API key (LLM, Email, WhatsApp, dll)" },
  "admin-audit-log": { title: "Audit Log", description: "Lacak semua aktivitas user di sistem" },
  "admin-tour-analytics": { title: "Tour Analytics", description: "Lacak penggunaan & efektivitas Help & Tour" },
  "admin-user-management": { title: "User Management Hub", description: "Users, Roles & Activity Log dalam satu workspace" },
  "admin-setup": { title: "Setup & Numbering Hub", description: "Number Series, Tax Config & Bulk Import" },
  "admin-effective-dating": { title: "Effective Dating Timeline", description: "Kapan tiap konfigurasi berlaku (timeline versi aturan)" },
  "admin-loyalty-redemptions": { title: "Loyalty Redemptions", description: "Pantau & proses penukaran reward member" },

  // ==== Procurement ====
  "procurement-home": { title: "Procurement Home", description: "Overview pembelian & approvals" },
  "procurement-kanban": { title: "Workboard Kanban", description: "Drag & drop PR → PO → GR" },
  "procurement-pr-list": { title: "Purchase Requests", description: "Kelola & approve permintaan pembelian" },
  "procurement-po-list": { title: "Purchase Orders", description: "Buat, kirim & pantau PO ke vendor" },
  "procurement-vendor-compare": { title: "Bandingkan Vendor", description: "Cari vendor terbaik berdasarkan history" },
  "procurement-gr": { title: "Penerimaan Barang (GR)", description: "Posting GR & auto-journal AP" },
  "procurement-vendors": { title: "All Vendors", description: "Lihat dan kelola semua vendor terdaftar" },
  "procurement-vendor-scorecard": { title: "Vendor Scorecard", description: "Peringkat performa vendor berdasarkan historis" },
  "procurement-vendor-recommend": { title: "AI Vendor Recommendation", description: "AI merekomendasikan vendor terbaik" },
  "procurement-rfq": { title: "RFQ — Request for Quotation", description: "Kirim permintaan penawaran harga ke vendor" },
  "procurement-consolidation": { title: "PR Consolidation", description: "Gabungkan banyak PR jadi PO efisien per vendor" },
  "procurement-po-comparison": { title: "PO Comparison", description: "Bandingkan PO antar vendor untuk penawaran terbaik" },
  "procurement-price-intelligence": { title: "Price Intelligence", description: "Pantau deviasi harga beli vs harga acuan pasar" },
  "procurement-vendor-catalog": { title: "Vendor Catalog", description: "Katalog item per vendor + riwayat harga" },

  // ==== Finance ====
  "finance-home": { title: "Finance Home", description: "Validasi sales, AP, approvals" },
  "finance-validation": { title: "Sales Validation Queue", description: "Review dan validasi daily sales dari semua outlet" },
  "finance-manual-journal": { title: "Manual Journal Entry", description: "Buat jurnal akuntansi manual dengan validasi Dr=Cr" },
  "finance-ap": { title: "AP Aging — Hutang Dagang", description: "Pantau aging hutang ke vendor" },
  "finance-journals": { title: "Journal Entries", description: "Lihat, filter & buat JAE manual" },
  "finance-payment-requests": { title: "Payment Requests", description: "Daftar semua payment request yang diajukan" },
  "finance-payments": { title: "Payment Requests — Workflow Pembayaran", description: "Workflow pembayaran: request → approve → paid" },
  "finance-bank-recon": { title: "Bank Reconciliation", description: "Upload mutasi rekening dan cocokkan dengan JE" },
  "finance-ar": { title: "AR Invoices — Piutang Dagang", description: "Kelola invoice ke customer B2B" },
  "finance-trial-balance": { title: "Trial Balance", description: "Neraca saldo semua akun COA" },
  "finance-balance-sheet": { title: "Balance Sheet — Neraca Keuangan", description: "Laporan posisi keuangan: Aset, Kewajiban, Ekuitas" },
  "finance-cashflow": { title: "Cashflow Statement — Arus Kas", description: "Laporan arus kas: operasional, investasi, pendanaan" },
  "finance-coa": { title: "Chart of Accounts (COA)", description: "Browse dan manage akun-akun buku besar" },
  "finance-profit-loss": { title: "Profit & Loss — Laporan Laba Rugi", description: "Baca dan drill-down laporan P&L" },
  "finance-anomalies": { title: "Anomaly Feed — Deteksi Keuangan", description: "Review flag anomali otomatis dari seluruh data keuangan" },
  "finance-comparatives": { title: "Period Comparatives", description: "Bandingkan performa keuangan antar periode" },
  "finance-periods": { title: "Period Locking", description: "Kelola periode akuntansi & enforcement" },
  "finance-period-closing": { title: "Period Closing Hub", description: "Workflow 4-fase tutup bulan akuntansi" },
  "finance-payments-hub": { title: "Payments Hub", description: "Payment Requests, AP, Payments, Runs, Bank Recon & AR dalam satu workspace" },
  "finance-reports-hub": { title: "Reports Hub", description: "Trial Balance, P&L, Balance Sheet, Cashflow & Pivot bertab" },
  "finance-tax-hub": { title: "Tax Center Hub", description: "Tax Center, e-Faktur, dan e-Bupot dalam satu tempat" },
  "finance-budget-hub": { title: "Budget Hub", description: "Budget vs Actual, Management, dan Forecasting" },
  "finance-assets": { title: "Fixed Assets — Aset Tetap", description: "Kelola aset tetap, nilai buku, dan penyusutan" },
  "finance-cash-position": { title: "Cash Position", description: "Posisi kas real-time, runway, dan rencana kas" },
  "finance-vendor-scorecard": { title: "Vendor Scorecard", description: "Peringkat performa vendor dari sisi finance" },
  "finance-reservation-deposits": { title: "Deposit Reservasi", description: "Rekap deposit reservasi outlet sebagai kewajiban" },
  "finance-payment-runs": { title: "Payment Runs", description: "Proses pembayaran batch ke banyak vendor" },
  "finance-payment-run-templates": { title: "Payment Run Templates", description: "Template pembayaran batch berulang" },
  "finance-forecasting": { title: "Forecasting", description: "Proyeksi keuangan berbasis tren historis" },
  "finance-budget-vs-actual": { title: "Budget vs Actual", description: "Bandingkan anggaran vs realisasi per akun/periode" },
  "finance-efaktur": { title: "e-Faktur Export", description: "Generate file e-Faktur PPN untuk DJP" },
  "finance-ebupot": { title: "e-Bupot Export", description: "Generate bukti potong PPh (e-Bupot)" },

  // ==== Inventory ====
  "inventory-home": { title: "Inventory Home", description: "Overview stock & alerts" },
  "inventory-balance": { title: "Stock Balance — Matrix Stok", description: "Stok real-time: list dan matrix view" },
  "inventory-movements": { title: "Movement Journal", description: "Timeline keluar-masuk barang lengkap" },
  "inventory-movements-hub": { title: "Stock Movements Hub", description: "History, transfers & adjustments dalam satu tempat" },
  "inventory-opname": { title: "Stock Opname", description: "Hitung stok fisik dengan AI variance analysis" },
  "inventory-transfers": { title: "Transfer Stok", description: "Pindahkan stok antar outlet dengan traceability" },
  "inventory-adjustment": { title: "Stock Adjustment", description: "Koreksi stok: damage, expired, loss" },
  "inventory-low-stock": { title: "Low Stock Alert", description: "Monitor item di bawah par level dan buat PR otomatis" },
  "inventory-market-list": { title: "Market List — Harga Acuan", description: "Pantau harga pasar referensi dan approve harga kwartal" },
  "inventory-valuation": { title: "Inventory Valuation", description: "Nilai stok per outlet pada tanggal tertentu" },

  // ==== Executive ====
  "executive-home": { title: "Sales Analytics", description: "KPI strip + drilldown + insights" },
  "executive-owner-home": { title: "Dashboard Eksekutif", description: "Ringkasan owner: KPI, anomali, approvals, akses cepat" },
  "executive-outlet-drilldown": { title: "Detail Outlet", description: "KPI, P&L, inventory & staff per outlet" },
  "executive-brand-drilldown": { title: "Detail Brand", description: "KPI, cost structure, outlet & trend per brand" },
  "executive-ai-qa": { title: "AI Q&A Assistant", description: "Tanya AI tentang performance bisnis" },
  "executive-anomaly": { title: "Anomaly Detection", description: "AI mendeteksi pola anomali di data bisnis dan keuangan" },
  "executive-brand-mix": { title: "Brand Mix Overview", description: "Analisis kontribusi dan performa masing-masing brand" },
  "executive-profit-walk": { title: "Profit Walk — Analisis Laba", description: "Waterfall chart kontribusi tiap komponen ke laba bersih" },
  "executive-period-compare": { title: "Period Compare — Perbandingan Periode", description: "Bandingkan KPI bisnis antar periode secara visual" },
  "executive-analytics-hub": { title: "Performance Analytics Hub", description: "Brand Mix, Profit Walk & Period Compare bertab" },
  "executive-reservations": { title: "Reservations", description: "Pantau reservasi & deposit lintas outlet" },
  "executive-budget-approvals": { title: "Budget Approvals", description: "Setujui/tolak pengajuan budget outlet" },
  "executive-outlet-budgets": { title: "Budget Allocation", description: "Alokasikan budget operasional per outlet & periode" },
  "executive-budget-monitor": { title: "Budget Monitor", description: "Pantau realisasi vs budget outlet (heatmap & pace)" },
  "executive-budget-increase": { title: "Increase Requests", description: "Tinjau & putuskan permintaan penambahan budget" },

  // ==== Owner ====
  "owner-home": { title: "Owner Cockpit", description: "Cash + profit walk + approvals" },
  "owner-cash": { title: "Cash Position", description: "Lihat posisi kas total group dan proyeksi ke depan" },
  "owner-approvals": { title: "My Approvals", description: "Setujui permintaan dari mobile" },
  "owner-briefing": { title: "AI Daily Briefing", description: "Ringkasan bisnis harian otomatis dengan AI analysis" },
  "owner-ai-assistant": { title: "Business Q&A — AI Assistant", description: "Tanya apapun tentang bisnis dalam Bahasa Indonesia" },
  "owner-digest-settings": { title: "Pengaturan Daily Briefing", description: "Atur pengiriman ringkasan harian via Telegram & langganan" },

  // ==== HR ====
  "hr-home": { title: "HR Home", description: "Overview employees, payroll & advance" },
  "hr-payroll": { title: "HR Payroll", description: "Kelola penggajian bulanan karyawan" },
  "hr-advances": { title: "Employee Advances", description: "Kelola kasbon karyawan" },
  "hr-leaves": { title: "Leave Requests", description: "Kelola cuti dan absensi karyawan" },
  "hr-job-applications": { title: "Job Applications", description: "Review lamaran kerja dari website" },
  "hr-job-listings": { title: "Job Listings", description: "Buat dan kelola lowongan kerja di website public" },
  "hr-service-charge": { title: "Service Charge Distribution", description: "Distribusi service charge dari penjualan ke karyawan" },
  "hr-incentive": { title: "Incentive Management", description: "Kelola bonus dan insentif kinerja karyawan" },
  "hr-compensation": { title: "Compensation Hub", description: "7 modul remunerasi karyawan dalam satu workspace" },
  "hr-voucher": { title: "HR Voucher", description: "Terbitkan & kelola voucher karyawan" },
  "hr-foc": { title: "FOC — Free of Charge", description: "Catat & kontrol transaksi gratis (FOC)" },
  "hr-lb-fund": { title: "LB Fund Ledger", description: "Buku besar dana bersama karyawan" },

  // ==== General ====
  "general-navigation": { title: "Navigasi Umum", description: "Cara mengelola sistem ERP secara umum" },
  "approval-center": { title: "Pusat Persetujuan", description: "Inbox persetujuan terpusat + delegasi untuk semua dokumen" },
  "my-approvals": { title: "My Approvals", description: "Inbox persetujuan personal — approve/reject cepat" },
};

// =====================================================
// LOOKUP HELPERS
// =====================================================

export function getToursForPath(path, search = "") {
  const ids = [];

  // Tab hub (route lama yang kini menjadi tab): "/hub?tab=x" didahulukan sebagai tour utama
  new URLSearchParams(search).forEach((value, key) => {
    const tabKey = `${path}?${key}=${value}`;
    if (pathToTours[tabKey]) ids.push(...pathToTours[tabKey].filter((id) => !ids.includes(id)));
  });

  // Exact match
  if (pathToTours[path]) {
    ids.push(...pathToTours[path].filter((id) => !ids.includes(id)));
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
