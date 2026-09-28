# 📋 TORADO ERP - COMPLETE FEATURE & FLOW INVENTORY
**Generated:** 2026-06-18  
**System:** Full-Stack Restaurant/Multi-Outlet ERP  
**Tech Stack:** FastAPI (Backend) + React (Frontend) + MongoDB

---

## 🏢 SYSTEM ARCHITECTURE OVERVIEW

**Total Backend Routers:** 58 modules  
**Total Frontend Portals:** 8 main portals  
**Total Features:** 180+ distinct features  
**Database Collections:** 40+ collections

---

## 📊 PORTALS & MODULES BREAKDOWN

### **1. 🔐 AUTHENTICATION & ACCESS CONTROL**
**Router:** `auth.py`, `approvals.py`, `approval_matrix.py`  
**Features:**
- Login/Logout/Refresh Token
- Role-based Access Control (RBAC)
- Permission Matrix Builder
- Approval Workflows Configuration
- Approval Delegation
- Multi-factor Authentication (MFA)

**Frontend Pages:**
- Login page
- User Management (`admin/Users.jsx`)
- Role Management (`admin/Roles.jsx`)
- Approval Matrix Builder (`admin/ApprovalMatrixBuilder.jsx`)
- Approval Center (`shared/ApprovalCenter.jsx`)

---

### **2. 💰 FINANCE PORTAL**
**Router:** `finance.py`, `ar.py`, `payments.py`, `payment_runs.py`, `bank_recon.py`, `cash.py`, `tax.py`, `efaktur.py`, `ebupot.py`, `budget.py`

#### **2.1 General Ledger (GL)**
- Chart of Accounts (COA) Browser
- Journal Entries (Manual & Auto)
- Trial Balance
- Balance Sheet
- Profit & Loss (P&L)
- Cashflow Report
- Period Closing Wizard
- Period Lock/Unlock

**Frontend:**
- `finance/JournalList.jsx` - Journal entry list
- `finance/JournalDetail.jsx` - Journal detail view
- `finance/ManualJournalForm.jsx` - Manual JE creation
- `finance/COABrowser.jsx` - Chart of accounts
- `finance/TrialBalance.jsx` - Trial balance report
- `finance/BalanceSheet.jsx` - Balance sheet
- `finance/ProfitLoss.jsx` - P&L statement
- `finance/CashflowReport.jsx` - Cashflow analysis
- `finance/PeriodList.jsx` - Accounting periods
- `finance/PeriodClosingWizard.jsx` - Month-end closing

#### **2.2 Accounts Payable (AP)**
- AP Aging Report
- Vendor Ledger
- Invoice Management
- Payment Vouchers
- Payment Requests
- Payment Runs (Batch Payments)
- Payment Run Templates
- Bank Reconciliation
- Cash Position

**Frontend:**
- `finance/APAging.jsx` - AP aging buckets
- `finance/PaymentList.jsx` - Payment vouchers
- `finance/PaymentForm.jsx` - Payment entry
- `finance/PaymentDetail.jsx` - Payment detail
- `finance/PaymentRequestList.jsx` - Payment requests
- `finance/PaymentRunList.jsx` - Batch payments
- `finance/PaymentRunTemplateList.jsx` - Payment templates
- `finance/BankRecon.jsx` - Bank reconciliation
- `finance/CashPosition.jsx` - Cash position dashboard

#### **2.3 Accounts Receivable (AR)**
- AR Aging Report
- Customer Ledger
- Customer Invoices
- Invoice Reminders
- Payment Receipts
- Write-offs

**Frontend:**
- `finance/ARInvoiceList.jsx` - AR invoices
- `finance/ARInvoiceDialogs.jsx` - Invoice CRUD dialogs

#### **2.4 Fixed Assets**
- Asset Register
- Depreciation Calculation
- Depreciation Posting
- Asset Disposal
- Asset Revaluation

**Frontend:**
- `finance/FixedAssetList.jsx` - Asset list
- `finance/FixedAssetDetail.jsx` - Asset detail & depreciation

#### **2.5 Budgeting**
- Budget Master Data
- Budget vs Actual Reports
- Budget Approval Workflow
- Budget Revisions
- Budget Import/Export

**Frontend:**
- `finance/BudgetHub.jsx` - Budget management hub
- `finance/BudgetManagement.jsx` - Budget CRUD
- `finance/BudgetVsActual.jsx` - Variance analysis

#### **2.6 Tax Compliance**
- Tax Configuration
- Tax Calculation Engine
- E-Faktur Export (Indonesia)
- E-Bupot Export (Indonesia)
- Tax Center Dashboard

**Frontend:**
- `finance/TaxCenter.jsx` - Tax hub
- `finance/EFakturExport.jsx` - E-Faktur export
- `finance/EBupotExport.jsx` - E-Bupot export
- `admin/TaxConfig.jsx` - Tax setup

#### **2.7 Financial Reports**
- Vendor Scorecard
- Report Builder (Custom Reports)
- Pivot Reports
- Comparative Reports
- Forecasting

**Frontend:**
- `finance/VendorScorecard.jsx`
- `finance/ReportBuilder.jsx`
- `finance/PivotReport.jsx`
- `finance/Comparatives.jsx`
- `finance/Forecasting.jsx`

#### **2.8 Anomaly Detection**
- Anomaly Thresholds
- Anomaly Scanning
- Anomaly Feed
- Anomaly Triage

**Frontend:**
- `finance/AnomalyFeed.jsx` - Real-time anomaly alerts

---

### **3. 👥 HR PORTAL**
**Router:** `hr.py`, `leave.py`

#### **3.1 Employee Management**
- Employee Master Data
- Employee Profiles
- Organizational Structure

#### **3.2 Leave Management**
- Leave Types Configuration
- Leave Quota Management
- Leave Requests
- Leave Approval Workflow
- Leave Calendar
- Leave Balance Tracking

**Frontend:**
- `hr/LeaveRequests.jsx` - Leave request list & approval

#### **3.3 Payroll**
- Salary Master
- Payroll Processing
- Payroll Cycles
- Payroll Journal Entry Generation
- Payslip Generation
- Payroll Reports

**Frontend:**
- `hr/PayrollList.jsx` - Payroll cycles
- `hr/PayrollListPkg/` - Payroll dialogs & PDF generation

#### **3.4 Compensation & Benefits**
- Employee Advances
- Service Charge Distribution
- Incentive Schemes
- Incentive Runs
- FOC (Free of Charge) Vouchers
- LB Fund Ledger

**Frontend:**
- `hr/CompensationHub.jsx` - Compensation dashboard
- `hr/AdvancesList.jsx` - Employee advances
- `hr/ServiceChargeList.jsx` - Service charge distribution
- `hr/IncentiveList.jsx` - Incentive calculations
- `hr/VoucherList.jsx` - HR vouchers
- `hr/FOCList.jsx` - FOC management
- `hr/LBFundLedger.jsx` - LB fund tracking

#### **3.5 Recruitment**
- Job Listings
- Job Applications
- Applicant Tracking

**Frontend:**
- `hr/JobListings.jsx` - Job postings
- `hr/JobApplications.jsx` - Application management

---

### **4. 🏭 PROCUREMENT PORTAL**
**Router:** `procurement.py`, `rfq.py`, `vendor_items.py`

#### **4.1 Purchase Requisition (PR)**
- PR Creation
- PR Consolidation
- PR Approval Workflow
- PR to PO Conversion

**Frontend:**
- `procurement/PRList.jsx` - PR list
- `procurement/PRForm.jsx` - PR creation
- `procurement/PRDetail.jsx` - PR detail
- `procurement/PRConsolidation.jsx` - Multi-PR consolidation

#### **4.2 Purchase Order (PO)**
- PO Creation
- PO Approval Workflow
- PO Comparison
- PO Send to Vendor
- PO Cancellation
- PO PDF Generation

**Frontend:**
- `procurement/POList.jsx` - PO list
- `procurement/POForm.jsx` - PO creation
- `procurement/PODetail.jsx` - PO detail
- `procurement/POComparison.jsx` - Multi-PO comparison

#### **4.3 Goods Receipt (GR)**
- GR Creation from PO
- GR Approval Workflow
- GR to Invoice Matching
- Partial GR

**Frontend:**
- `procurement/GRList.jsx` - GR list
- `procurement/GRForm.jsx` - GR entry

#### **4.4 Request for Quotation (RFQ)**
- RFQ Creation
- RFQ Send to Vendors
- Quote Collection
- Quote Comparison
- RFQ Award

**Frontend:**
- `procurement/RFQList.jsx` - RFQ list
- `procurement/RFQDetail.jsx` - RFQ detail & quotes

#### **4.5 Vendor Management**
- Vendor Master Data
- Vendor Catalog
- Vendor Scorecard
- Vendor Comparison
- Vendor Recommendations (AI)
- Price Intelligence

**Frontend:**
- `procurement/AllVendors.jsx` - Vendor list
- `procurement/VendorCatalog.jsx` - Vendor item catalog
- `procurement/VendorScorecardList.jsx` - Vendor performance
- `procurement/VendorComparison.jsx` - Multi-vendor compare
- `procurement/VendorRecommendPage.jsx` - AI vendor suggestions
- `procurement/PriceIntelligence.jsx` - Price tracking

#### **4.6 Procurement Workboard**
- Kanban Board for PR/PO tracking

**Frontend:**
- `procurement/KanbanWorkboard.jsx` - Visual workflow board

---

### **5. 📦 INVENTORY PORTAL**
**Router:** `inventory.py`, `market_list.py`, `item_pricing.py`

#### **5.1 Stock Management**
- Item Master Data
- Stock Balance (Multi-Outlet)
- Stock Movements Tracking
- Low Stock Alerts
- Stock Valuation (FIFO/Average)
- Stock Balance Matrix

**Frontend:**
- `inventory/StockBalance.jsx` - Current stock levels
- `inventory/Movements.jsx` - Stock movement history
- `inventory/LowStockAlert.jsx` - Reorder alerts
- `inventory/Valuation.jsx` - Inventory valuation
- `inventory/StockBalanceMatrix.jsx` - Multi-outlet matrix
- `inventory/StockMovementsHub.jsx` - Movement hub

#### **5.2 Stock Transfers**
- Inter-Outlet Transfers
- Transfer Requests
- Transfer Approvals
- Transfer Receiving

**Frontend:**
- `inventory/TransferList.jsx` - Transfer list
- `inventory/TransferDetail.jsx` - Transfer detail

#### **5.3 Stock Adjustments**
- Stock Adjustment Entry
- Adjustment Approval Workflow
- Adjustment Reasons

**Frontend:**
- `inventory/AdjustmentList.jsx` - Adjustment list

#### **5.4 Stock Opname (Physical Count)**
- Opname Session Creation
- Opname Counting
- Variance Analysis (AI-powered)
- Adjustment Generation

**Frontend:**
- `inventory/OpnameList.jsx` - Opname sessions
- `inventory/OpnameSession.jsx` - Active counting session
- `inventory/AIVariancePanel.jsx` - AI variance explanation

#### **5.5 Market List (Price Reference)**
- Quarterly Market Price Lists
- Market Price Tracking
- Comparative Pricing

**Frontend:**
- `inventory/MarketListPage.jsx` - Market price management

---

### **6. 🏪 OUTLET PORTAL**
**Router:** `outlet.py`, `daily_sales.py`, `daily_close.py`, `kdo_bdo.py`, `outlet_budget.py`, `reservations.py`, `loyalty.py`

#### **6.1 Daily Operations**
- Daily Sales Entry
- Daily Sales Approval
- Daily Sales Journal Generation
- End-of-Day Workflow
- Daily Close
- Petty Cash Management

**Frontend:**
- `outlet/DailySalesList.jsx` - Sales list
- `outlet/DailySalesForm.jsx` - Sales entry
- `outlet/DailySalesDetail.jsx` - Sales detail
- `outlet/DailyClose.jsx` - EOD closing
- `outlet/EndOfDayWorkflow.jsx` - EOD wizard
- `outlet/PettyCashList.jsx` - Petty cash tracking

#### **6.2 Daily Orders (KDO/BDO/FDO)**
- Kitchen Daily Order (KDO)
- Bar Daily Order (BDO)
- Front-of-House Daily Order (FDO)

**Frontend:**
- `outlet/KdoPage.jsx` - Kitchen orders
- `outlet/BdoPage.jsx` - Bar orders
- `outlet/FdoPage.jsx` - FOH orders
- `outlet/KdoBdoList.jsx` - Order history
- `outlet/DailyOrdersHub.jsx` - Order hub

#### **6.3 Outlet Budget**
- Budget Allocation per Outlet
- Budget Tracker
- Budget vs Actual
- Budget Increase Requests
- PR Pre-check against Budget

**Frontend:**
- `outlet/OutletBudgetTracker.jsx` - Budget dashboard
- `outlet/OutletBudgetMiniWidget.jsx` - Budget widget

#### **6.4 Urgent Purchases**
- Urgent Purchase Requests
- Urgent Purchase Approvals

**Frontend:**
- `outlet/UrgentPurchaseList.jsx` - Urgent PR list

#### **6.5 Reservations**
- Reservation Management
- Reservation Status Tracking
- Reservation Deposits

**Frontend:**
- `outlet/ReservationList.jsx` - Reservation list
- `outlet/ReservationForm.jsx` - Reservation entry

#### **6.6 Customer Loyalty**
- Loyalty Points Entry (Cashier)
- Voucher Redemption

**Frontend:**
- `outlet/LoyaltyPointsEntry.jsx` - Points award
- `outlet/VoucherRedemption.jsx` - Redeem vouchers

#### **6.7 CRM Hub**
- Customer Relationship Management

**Frontend:**
- `outlet/CRMHub.jsx` - CRM dashboard

---

### **7. 📈 EXECUTIVE/OWNER PORTAL**
**Router:** `executive.py`, `owner.py`, `forecasting.py`, `anomalies.py`

#### **7.1 Executive Dashboard**
- Executive Analytics Hub
- Brand Drilldown
- Outlet Drilldown
- Brand Mix Overview
- Period Comparison
- Profit Walk Analysis

**Frontend:**
- `executive/ExecutiveHome.jsx` - Executive home
- `executive/ExecutiveAnalyticsHub.jsx` - Analytics hub
- `executive/BrandDrilldown.jsx` - Brand performance
- `executive/OutletDrilldown.jsx` - Outlet performance
- `executive/BrandMixOverview.jsx` - Brand mix analysis
- `executive/PeriodCompare.jsx` - Period-over-period
- `executive/ProfitWalk.jsx` - Profit waterfall

#### **7.2 Budget Management (Executive)**
- Budget Approvals
- Budget Increase Requests Review
- Outlet Budget Allocation
- Outlet Budget Monitor

**Frontend:**
- `executive/BudgetApprovals.jsx` - Budget approval queue
- `executive/BudgetIncreaseRequests.jsx` - Increase requests
- `executive/OutletBudgetAllocation.jsx` - Allocate budgets
- `executive/OutletBudgetMonitor.jsx` - Monitor spending

#### **7.3 AI-Powered Insights**
- Executive Q&A (AI Assistant)
- Anomaly Detection
- Forecasting
- Reservation Summary

**Frontend:**
- `executive/ExecutiveQA.jsx` - Ask AI questions
- `executive/AnomalyDetection.jsx` - Anomaly dashboard
- `executive/ReservationSummary.jsx` - Reservation analytics

#### **7.4 Owner Cockpit**
- Daily Briefing
- Owner Dashboard
- Digest Settings (Email Reports)

**Frontend:**
- `owner/OwnerCockpit.jsx` - Owner home
- `owner/DailyBriefing.jsx` - Daily summary
- `owner/DigestSettings.jsx` - Email report config
- `executive/OwnerHome.jsx` - Alternative owner view

---

### **8. 🔧 ADMIN PORTAL**
**Router:** `admin.py`, `admin_ops.py`, `system_settings.py`, `bulk_import.py`, `data_management.py`, `report_schedules.py`, `master.py`

#### **8.1 User Management**
- User CRUD
- User Roles Assignment
- User Permissions
- Password Reset
- User Activity Log

**Frontend:**
- `admin/Users.jsx` - User list
- `admin/UsersAdmin/` - User dialogs
- `admin/UserManagementHub.jsx` - User hub

#### **8.2 Role & Permission Management**
- Role CRUD
- Permission Assignment
- Approval Matrix Configuration
- Approval Workflows

**Frontend:**
- `admin/Roles.jsx` - Role management
- `admin/ApprovalWorkflows.jsx` - Workflow config
- `admin/ApprovalMatrixBuilder.jsx` - Matrix builder

#### **8.3 Master Data Management**
- Master Data Hub
- COA Management
- Vendor Master
- Customer Master
- Item Master
- Outlet Master
- Brand Master
- Employee Master

**Frontend:**
- `admin/MasterData.jsx` - Master data hub
- `admin/MasterDataHub.jsx` - Master data landing

#### **8.4 System Configuration**
- System Settings
- Number Series Configuration
- Tax Configuration
- Business Rules Engine

**Frontend:**
- `admin/SystemSettings.jsx` - System settings
- `admin/NumberSeries.jsx` - Number series
- `admin/TaxConfig.jsx` - Tax setup

#### **8.5 Data Management**
- Bulk Import (Excel/CSV)
- Data Archival
- Data Migration Tools
- Data Validation Queue

**Frontend:**
- `admin/BulkImport.jsx` - Bulk import wizard
- `admin/DataManagement.jsx` - Data tools

#### **8.6 Operations**
- Audit Log
- Report Scheduling
- System Health Monitoring
- Rate Limiter Configuration
- Scheduler Jobs Management

**Frontend:**
- `admin/Operations.jsx` - Operations hub
- `admin/AuditLog.jsx` - Audit trail
- `admin/ReportSchedules.jsx` - Scheduled reports

#### **8.7 Integrations**
- Integration Hub
- Telegram Bot Configuration
- Email/SMS Configuration
- External API Configuration

**Frontend:**
- `admin/Integrations.jsx` - Integration hub
- `admin/integrations/` - Integration pages

#### **8.8 CMS (Content Management System)**
- CMS Studio
- Page Management
- Brand Pages
- Outlet Pages
- News/Blog Management
- Menu Management
- Instagram Feed Integration
- Media Library
- SEO Management

**Frontend:**
- `admin/CMSStudio.jsx` - CMS hub
- `admin/SmartSEO.jsx` - SEO tools
- `admin/cms/` - CMS pages

#### **8.9 Loyalty Program Admin**
- Loyalty Customer Management
- Rewards Configuration
- Loyalty Transactions
- Redemption Management

**Frontend:**
- `admin/loyalty/` - Loyalty admin pages

#### **8.10 Tour Analytics**
- User Tour Tracking
- Feature Adoption Analytics

**Frontend:**
- `admin/TourAnalytics.jsx` - Tour analytics

---

### **9. 📊 REPORTS PORTAL**
**Router:** `reports.py`

#### **9.1 Standard Reports**
- AP Aging Report
- Daily Sales Report
- FDO History Report
- GR Summary Report
- Inventory Valuation Report
- Journal/Ledger Report
- Outlet Performance Report
- P&L Torado Format
- PO Summary Report
- Stock Balance Report
- Stock Movement Report
- Trial Balance Report
- Vendor Performance Report

**Frontend:**
- `reports/ReportsCatalog.jsx` - Report catalog
- `reports/APAgingReport.jsx`
- `reports/DailySalesReport.jsx`
- `reports/FdoHistoryReport.jsx`
- `reports/GRSummaryReport.jsx`
- `reports/InventoryValuationReport.jsx`
- `reports/JournalLedgerReport.jsx`
- `reports/OutletPerformanceReport.jsx`
- `reports/PLToradoReport.jsx`
- `reports/POSummaryReport.jsx`
- `reports/StockBalanceReport.jsx`
- `reports/StockMovementReport.jsx`
- `reports/TrialBalanceReport.jsx`
- `reports/VendorPerformanceReport.jsx`

---

### **10. 🤖 AI/AUTOMATION FEATURES**
**Router:** `ai.py`, `anomalies.py`, `forecasting.py`

#### **10.1 AI Services**
- Smart Categorization (Expenses)
- Receipt OCR & Extraction
- AI Vendor Recommendation
- AI Journal Entry Generation
- Executive Q&A (RAG-based)
- Opname Variance Explanation
- Anomaly Detection & Scanning

#### **10.2 Forecasting**
- Sales Forecasting
- Budget Forecasting
- Forecast Guard (Approval checks)

---

### **11. 🌐 PUBLIC/CUSTOMER-FACING**
**Router:** `public_content.py`, `public_menu.py`, `loyalty.py`, `reservations.py`

#### **11.1 Public Website**
- Public Pages (CMS)
- Brand Showcase
- Outlet Locations
- News/Blog
- Job Listings
- Menu Display
- Instagram Feed

#### **11.2 Customer Portal**
- Loyalty Registration
- Loyalty Login
- Points Balance
- Rewards Catalog
- Reward Redemption
- Reservation Booking

---

### **12. 🔍 SEARCH & NOTIFICATIONS**
**Router:** `search.py`, `notifications.py`, `telegram.py`

#### **12.1 Search**
- Global Search (Ctrl+K)
- Full-text search across modules

**Frontend:**
- `components/shared/GlobalSearch.jsx`

#### **12.2 Notifications**
- In-app Notifications
- Email Notifications
- Telegram Notifications
- Push Notifications

---

### **13. 🔗 INTEGRATIONS & EXTERNAL APIS**
**Router:** `efaktur.py`, `ebupot.py`, `seo.py`, `telegram.py`, `crm_analytics.py`

#### **13.1 Tax Integration**
- E-Faktur (Indonesian Tax Invoice)
- E-Bupot (Indonesian Withholding Tax)

#### **13.2 Marketing**
- SEO Optimization Tools
- Google Analytics Integration
- Instagram Integration

#### **13.3 Messaging**
- Telegram Bot
- WhatsApp Integration (planned)
- Email Service Integration

#### **13.4 CRM Analytics**
- Customer Lifetime Value (CLV)
- Cohort Analysis
- Customer Segmentation

---

## 📊 FEATURE STATISTICS

| Category | Count |
|----------|-------|
| **Backend Routers** | 58 |
| **Frontend Pages** | 180+ |
| **Database Collections** | 40+ |
| **API Endpoints** | 676 |
| **CRUD Entities** | 35+ |
| **Reports** | 25+ |
| **Workflows (Approval)** | 15+ |
| **AI Features** | 8 |
| **Integrations** | 10+ |

---

## 🎯 CORE BUSINESS FLOWS

### **Flow 1: Procure-to-Pay (P2P)**
1. Outlet creates **Purchase Requisition (PR)**
2. Procurement consolidates PRs
3. Procurement creates **Purchase Order (PO)**
4. PO approved via workflow
5. PO sent to vendor
6. Vendor delivers goods → **Goods Receipt (GR)**
7. Finance receives invoice → **AP Invoice**
8. Finance creates **Payment Voucher**
9. Payment approved & posted
10. **Journal Entry** auto-generated
11. **AP Ledger** updated

### **Flow 2: Order-to-Cash (O2C)**
1. Customer makes **Reservation**
2. Outlet records **Daily Sales**
3. Daily Sales approved
4. **Journal Entry** auto-generated (Dr: Cash, Cr: Revenue)
5. **GL Ledger** updated
6. End-of-Day **Daily Close**
7. Finance reconciles daily deposits

### **Flow 3: Hire-to-Retire (H2R)**
1. HR posts **Job Listing**
2. Candidates submit **Job Applications**
3. HR reviews & hires
4. Employee onboarded → **Employee Master**
5. Employee submits **Leave Request**
6. Leave approved via workflow
7. HR runs **Payroll Processing**
8. **Payroll Journal Entry** generated
9. Employee receives **Payslip**

### **Flow 4: Inventory Management**
1. Procurement receives goods → **GR**
2. **Stock Balance** updated (increase)
3. Outlet requests **Stock Transfer**
4. Transfer approved & shipped
5. Receiving outlet confirms → **Stock Balance** updated both sides
6. Periodic **Stock Opname (Physical Count)**
7. Variance identified → **Stock Adjustment**
8. Adjustment approved → **Stock Balance** updated

### **Flow 5: Month-End Closing**
1. Finance reviews **Trial Balance**
2. Finance posts **Manual Journal Entries** (accruals, prepayments)
3. Finance runs **Depreciation Calculation**
4. Finance posts **Depreciation Journal**
5. Finance reviews **AP Aging** & **AR Aging**
6. Finance generates **Financial Statements** (P&L, Balance Sheet)
7. Finance runs **Period Closing Wizard**
8. Period **Locked** → no more transactions for that month
9. Reports sent to management

### **Flow 6: Budget Management**
1. Finance creates **Annual Budget**
2. Budget broken down by Outlet/Department
3. Budget submitted for **Executive Approval**
4. Approved budget → **Budget Allocation**
5. Outlets monitor **Budget vs Actual**
6. If needed, outlet requests **Budget Increase**
7. Increase approved by Executive
8. System enforces budget limits on PRs

---

## 🔐 SECURITY & COMPLIANCE

### **Security Features:**
- JWT Authentication
- Role-Based Access Control (RBAC)
- Permission Matrix (granular permissions)
- Audit Log (all user actions tracked)
- Data Encryption (at rest & in transit)
- Rate Limiting (API abuse prevention)
- Session Management
- Password Policies

### **Compliance Features:**
- Indonesian Tax Compliance (E-Faktur, E-Bupot)
- Audit Trail (SOX compliance)
- Period Locking (prevent backdating)
- Approval Workflows (segregation of duties)
- Data Archival (retention policies)

---

## 🎨 UI/UX FEATURES

### **Shared Components:**
- Global Search (Ctrl+K)
- Approval Center (unified approval queue)
- Notification Center
- Theme Toggle (Dark/Light mode)
- Responsive Design (mobile-friendly)
- Loading States & Skeletons
- Toast Notifications
- Modals & Dialogs
- Data Tables with Filtering & Sorting
- Export to Excel/PDF

---

## 📱 MOBILE/RESPONSIVE FEATURES

- Mobile-optimized Outlet Portal
- Touch-friendly UI for Daily Sales entry
- Mobile reservation booking
- Mobile loyalty point redemption
- Responsive dashboards

---

## 🚀 ADVANCED FEATURES

### **AI-Powered:**
- Smart expense categorization
- Vendor recommendations
- Opname variance explanation
- Anomaly detection
- Executive Q&A chatbot

### **Automation:**
- Auto journal entry generation
- Auto depreciation posting
- Scheduled reports
- Email digests
- Telegram bot notifications

### **Analytics:**
- Executive dashboards
- Brand drilldown
- Outlet drilldown
- Cohort analysis
- CLV calculation
- Profit walk analysis

---

## 📋 SUMMARY

**Total Features:** ~180 distinct features  
**Modules:** 10 major modules (Finance, HR, Procurement, Inventory, Outlet, Executive, Admin, Reports, Public, AI)  
**Workflows:** 15+ approval workflows  
**Reports:** 25+ standard reports  
**Integrations:** Tax, Marketing, Messaging, CRM  
**AI Features:** 8 AI-powered features

**System Type:** Full-featured multi-outlet restaurant/F&B ERP with finance, HR, procurement, inventory, outlet operations, CRM, loyalty, reservations, CMS, and executive analytics.

**Deployment:** Cloud-native (Kubernetes), scalable, microservices-ready architecture.

---

**End of Feature Inventory**
