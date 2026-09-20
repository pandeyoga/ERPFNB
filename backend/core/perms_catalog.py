"""Master list of permission codes used by RBAC.
Syncronize with /app/memory/RBAC_MATRIX.md.
"""
PERMISSIONS_CATALOG: list[dict] = [
    # Special
    {"code": "*", "category": "Special", "label": "Super (everything)"},

    # Outlet
    {"code": "outlet.daily_sales.read", "category": "Outlet", "label": "Read daily sales"},
    {"code": "outlet.daily_sales.create", "category": "Outlet", "label": "Create daily sales"},
    {"code": "outlet.daily_sales.submit", "category": "Outlet", "label": "Submit daily sales"},
    {"code": "outlet.daily_sales.update", "category": "Outlet", "label": "Update daily sales draft"},
    {"code": "outlet.petty_cash.read", "category": "Outlet", "label": "Read petty cash"},
    {"code": "outlet.petty_cash.create", "category": "Outlet", "label": "Create petty cash txn"},
    {"code": "outlet.petty_cash.replenish_request", "category": "Outlet", "label": "Replenish request"},
    {"code": "outlet.urgent_purchase.create", "category": "Outlet", "label": "Urgent purchase"},
    {"code": "outlet.kdo.create", "category": "Outlet", "label": "KDO request"},
    {"code": "outlet.bdo.create", "category": "Outlet", "label": "BDO request"},
    {"code": "outlet.daily_close.execute", "category": "Outlet", "label": "Daily close"},
    {"code": "outlet.opname.execute", "category": "Outlet", "label": "Stock opname"},

    # Procurement
    {"code": "procurement.pr.read", "category": "Procurement", "label": "Read PR"},
    {"code": "procurement.pr.create", "category": "Procurement", "label": "Create PR"},
    {"code": "procurement.pr.approve", "category": "Procurement", "label": "Approve PR"},
    {"code": "procurement.pr.reject", "category": "Procurement", "label": "Reject PR"},
    {"code": "procurement.pr.consolidate", "category": "Procurement", "label": "Consolidate PRs"},
    {"code": "procurement.po.create", "category": "Procurement", "label": "Create PO"},
    {"code": "procurement.po.send", "category": "Procurement", "label": "Send PO"},
    {"code": "procurement.po.approve", "category": "Procurement", "label": "Approve PO"},
    {"code": "procurement.po.cancel", "category": "Procurement", "label": "Cancel PO"},
    {"code": "procurement.gr.create", "category": "Procurement", "label": "Create GR"},
    {"code": "procurement.gr.post", "category": "Procurement", "label": "Post GR"},
    {"code": "procurement.vendor.read", "category": "Procurement", "label": "Read vendor"},
    {"code": "procurement.vendor.scorecard", "category": "Procurement", "label": "Vendor scorecard"},

    # Inventory
    {"code": "inventory.balance.read", "category": "Inventory", "label": "Read stock balance"},
    {"code": "inventory.movement.read", "category": "Inventory", "label": "Read movements"},
    {"code": "inventory.transfer.create", "category": "Inventory", "label": "Create transfer"},
    {"code": "inventory.transfer.send", "category": "Inventory", "label": "Send transfer"},
    {"code": "inventory.transfer.receive", "category": "Inventory", "label": "Receive transfer"},
    {"code": "inventory.adjustment.create", "category": "Inventory", "label": "Create adjustment"},
    {"code": "inventory.adjustment.approve", "category": "Inventory", "label": "Approve adjustment"},
    {"code": "inventory.opname.start", "category": "Inventory", "label": "Start opname"},
    {"code": "inventory.opname.submit", "category": "Inventory", "label": "Submit opname"},
    {"code": "inventory.opname.approve", "category": "Inventory", "label": "Approve opname"},
    {"code": "inventory.valuation.read", "category": "Inventory", "label": "Read valuation"},

    # Finance
    {"code": "finance.sales.validate", "category": "Finance", "label": "Validate sales"},
    {"code": "finance.sales.request_fix", "category": "Finance", "label": "Request fix"},
    {"code": "finance.ap.read", "category": "Finance", "label": "Read AP"},
    {"code": "finance.payment.create", "category": "Finance", "label": "Create payment"},
    {"code": "finance.payment.approve", "category": "Finance", "label": "Approve payment"},
    {"code": "finance.payment.mark_paid", "category": "Finance", "label": "Mark paid"},
    {"code": "finance.journal_entry.read", "category": "Finance", "label": "Read journals"},
    {"code": "finance.journal_entry.create", "category": "Finance", "label": "Create journal"},
    {"code": "finance.journal_entry.post", "category": "Finance", "label": "Post journal"},
    {"code": "finance.journal_entry.reverse", "category": "Finance", "label": "Reverse journal"},
    {"code": "finance.tax.manage", "category": "Finance", "label": "Manage tax"},
    {"code": "finance.period.close_step", "category": "Finance", "label": "Period close step"},
    {"code": "finance.period.lock", "category": "Finance", "label": "Lock period"},
    {"code": "finance.period.unlock", "category": "Finance", "label": "Unlock period"},
    {"code": "finance.period.write_to_locked", "category": "Finance", "label": "Write to locked period"},
    {"code": "finance.report.profit_loss", "category": "Finance", "label": "PL report"},
    {"code": "finance.report.balance_sheet", "category": "Finance", "label": "BS report"},
    {"code": "finance.report.cashflow", "category": "Finance", "label": "Cashflow report"},
    {"code": "finance.bank_reconciliation", "category": "Finance", "label": "Bank reconciliation"},
    # Phase 11B — Cash Position
    {"code": "finance.cash.read", "category": "Finance", "label": "Read cash accounts & position"},
    {"code": "finance.cash.update", "category": "Finance", "label": "Update cash account balance"},
    
    # Sprint 1b — e-Faktur / Coretax
    {"code": "tax.efaktur.read", "category": "Tax", "label": "Read e-Faktur exports"},
    {"code": "tax.efaktur.export", "category": "Tax", "label": "Create e-Faktur export"},
    
    # Sprint 2 — Fixed Assets
    {"code": "finance.asset.read", "category": "Finance", "label": "Read fixed assets"},
    {"code": "finance.asset.create", "category": "Finance", "label": "Create fixed asset"},
    {"code": "finance.asset.update", "category": "Finance", "label": "Update fixed asset"},
    {"code": "finance.asset.delete", "category": "Finance", "label": "Delete fixed asset"},
    {"code": "finance.asset.dispose", "category": "Finance", "label": "Dispose fixed asset"},
    {"code": "finance.asset.revalue", "category": "Finance", "label": "Revalue fixed asset"},
    {"code": "finance.asset.depreciate", "category": "Finance", "label": "Post depreciation"},
    
    # Sprint 2 — Budget vs Actual
    {"code": "finance.budget.read", "category": "Finance", "label": "Read budgets"},
    {"code": "finance.budget.create", "category": "Finance", "label": "Create budget"},
    {"code": "finance.budget.update", "category": "Finance", "label": "Update budget"},
    {"code": "finance.budget.delete", "category": "Finance", "label": "Delete budget"},
    
    # Sprint 2 — AR Ledger
    {"code": "finance.ar.read", "category": "Finance", "label": "Read AR invoices"},
    {"code": "finance.ar.create", "category": "Finance", "label": "Create AR invoice"},
    {"code": "finance.ar.update", "category": "Finance", "label": "Update AR invoice"},
    {"code": "finance.ar.send", "category": "Finance", "label": "Send AR invoice"},
    {"code": "finance.ar.receive", "category": "Finance", "label": "Record AR receipt"},

    # HR
    {"code": "hr.advance.read", "category": "HR", "label": "Read advances"},
    {"code": "hr.advance.create", "category": "HR", "label": "Create advance"},
    {"code": "hr.advance.approve", "category": "HR", "label": "Approve advance"},
    {"code": "hr.service_charge.calculate", "category": "HR", "label": "Calculate service"},
    {"code": "hr.service_charge.post", "category": "HR", "label": "Post service"},
    {"code": "hr.incentive.calculate", "category": "HR", "label": "Calculate incentive"},
    {"code": "hr.incentive.approve", "category": "HR", "label": "Approve incentive"},
    {"code": "hr.voucher.issue", "category": "HR", "label": "Issue voucher"},
    {"code": "hr.voucher.redeem", "category": "HR", "label": "Redeem voucher"},
    {"code": "hr.foc.create", "category": "HR", "label": "Create FOC"},
    {"code": "hr.travel_incentive.manage", "category": "HR", "label": "Manage travel incentive"},
    {"code": "hr.lb_fund.read", "category": "HR", "label": "Read LB fund"},
    {"code": "hr.lb_fund.use", "category": "HR", "label": "Use LB fund"},

    # Admin
    {"code": "admin.user.read", "category": "Admin", "label": "Read users"},
    {"code": "admin.user.create", "category": "Admin", "label": "Create users"},
    {"code": "admin.user.update", "category": "Admin", "label": "Update users"},
    {"code": "admin.user.disable", "category": "Admin", "label": "Disable users"},
    {"code": "admin.user.reset_password", "category": "Admin", "label": "Reset password"},
    {"code": "admin.user.impersonate", "category": "Admin", "label": "Impersonate user"},
    {"code": "admin.role.manage", "category": "Admin", "label": "Manage roles"},
    {"code": "admin.master_data.manage", "category": "Admin", "label": "Manage master data"},
    {"code": "admin.master_data.bulk_import", "category": "Admin", "label": "Bulk import"},
    {"code": "admin.business_rules.manage", "category": "Admin", "label": "Business rules"},
    {"code": "admin.workflow.manage", "category": "Admin", "label": "Workflows"},
    {"code": "admin.number_series.manage", "category": "Admin", "label": "Number series"},
    {"code": "admin.audit_log.read", "category": "Admin", "label": "Audit log read"},
    {"code": "admin.audit_log.export", "category": "Admin", "label": "Audit log export"},
    {"code": "admin.system_settings.manage", "category": "Admin", "label": "System settings"},

    # Admin - Loyalty / CRM
    {"code": "admin.loyalty.read", "category": "Admin - Loyalty", "label": "Read loyalty data"},
    {"code": "admin.loyalty.manage_customers", "category": "Admin - Loyalty", "label": "Manage customers"},
    {"code": "admin.loyalty.manage_rewards", "category": "Admin - Loyalty", "label": "Manage rewards"},
    {"code": "admin.loyalty.adjust_points", "category": "Admin - Loyalty", "label": "Adjust points"},
    {"code": "admin.loyalty.analytics.read", "category": "Admin - Loyalty", "label": "Read loyalty analytics"},

    # Outlet Operational Budget (Phase 14 — Executive cost control for KDO/FDO/BDO)
    {"code": "outlet_budget.read", "category": "Outlet Budget", "label": "Read outlet operational budgets"},
    {"code": "outlet_budget.set", "category": "Outlet Budget", "label": "Set outlet budget (Executive)"},
    {"code": "outlet_budget.monitor", "category": "Outlet Budget", "label": "Monitor all outlets (Executive)"},
    {"code": "outlet_budget.request_increase", "category": "Outlet Budget", "label": "Request budget increase (Outlet)"},
    {"code": "outlet_budget.approve_increase", "category": "Outlet Budget", "label": "Approve budget increase (Executive)"},

    # Approval Matrix (Phase 15 — visual workflow builder, multi-mode routing)
    {"code": "admin.approval.read", "category": "Admin", "label": "Read approval matrix workflows"},
    {"code": "admin.approval.write", "category": "Admin", "label": "Configure approval matrix workflows"},

    # Executive
    {"code": "executive.dashboard.read", "category": "Executive", "label": "Dashboard read"},
    {"code": "executive.drilldown.read", "category": "Executive", "label": "Drilldown"},
    {"code": "executive.export", "category": "Executive", "label": "Export dashboard"},
    {"code": "executive.dashboard_view.save", "category": "Executive", "label": "Save view"},

    # AI
    {"code": "ai.chat.use", "category": "AI", "label": "Use AI chat"},
    {"code": "ai.autocomplete.use", "category": "AI", "label": "Smart autocomplete"},
    {"code": "ai.ocr.use", "category": "AI", "label": "Receipt OCR"},
    {"code": "ai.categorize.use", "category": "AI", "label": "GL categorization"},
    {"code": "ai.forecast.read", "category": "AI", "label": "Forecast read"},
    {"code": "ai.anomaly.read", "category": "AI", "label": "Anomaly read"},
    # Phase 9D
    {"code": "ai.exec_qa.use", "category": "AI", "label": "Executive Q&A (tool-calling)"},
    {"code": "ai.vendor_recommend.use", "category": "AI", "label": "AI vendor recommendation"},

    # Anomaly (Phase 7D)
    {"code": "anomaly.feed.read", "category": "Anomaly", "label": "Read anomaly feed"},
    {"code": "anomaly.triage", "category": "Anomaly", "label": "Triage anomaly (ack/resolve/fp)"},
    {"code": "anomaly.scan.trigger", "category": "Anomaly", "label": "Trigger manual anomaly scan"},

    # Search
    {"code": "search.global.use", "category": "Search", "label": "Global search"},

    # System Operations (Phase 10)
    {"code": "system.metrics.read", "category": "System", "label": "Read system metrics & rate-limit stats"},
    {"code": "system.logs.read", "category": "System", "label": "Read system logs"},
    {"code": "system.scheduler.manage", "category": "System", "label": "Manage scheduled jobs"},
    {"code": "system.archival.manage", "category": "System", "label": "Manage data archival"},
    # Phase 11C++ \u2014 System Settings (UI-managed config)
    {"code": "system.settings.read", "category": "System", "label": "Read system settings (masked)"},
    {"code": "system.settings.manage", "category": "System", "label": "Manage system settings (Telegram token, Resend key, etc.)"},

    # Owner (Phase 11C)
    {"code": "owner.cockpit.access", "category": "Owner", "label": "Access Owner Cockpit portal"},
    {"code": "owner.digest.manage", "category": "Owner", "label": "Manage owner digest subscriptions"},

    # Sprint E \u2014 Scheduled Reports
    {"code": "report_schedules.manage", "category": "Reports", "label": "Manage scheduled report subscriptions"},
    # Sprint E \u2014 RFQ Flow
    {"code": "procurement.rfq.read",   "category": "Procurement", "label": "View RFQ list and details"},
    {"code": "procurement.rfq.create", "category": "Procurement", "label": "Create / edit RFQ, enter quotes"},
    # Sprint E \u2014 e-Bupot
    {"code": "tax.ebupot.read",   "category": "Tax", "label": "Read e-Bupot PPh23 preview"},
    {"code": "tax.ebupot.export", "category": "Tax", "label": "Export e-Bupot PPh23 CSV"},

    # ── Missing Outlet permissions ──
    {"code": "outlet.fdo.create", "category": "Outlet", "label": "FDO (Floor Daily Order) request"},
    {"code": "outlet.manager",    "category": "Outlet", "label": "Outlet Manager scope access"},

    # ── Missing Procurement permissions ──
    {"code": "procurement.view",               "category": "Procurement", "label": "View procurement portal"},
    {"code": "procurement.market_list.manage", "category": "Procurement", "label": "Manage market list"},

    # ── Missing Inventory permissions ──
    {"code": "inventory.view", "category": "Inventory", "label": "View inventory portal"},

    # ── Reservations ──
    {"code": "reservations.read",    "category": "Reservations", "label": "Read reservations"},
    {"code": "reservations.create",  "category": "Reservations", "label": "Create reservations"},
    {"code": "reservations.manage",  "category": "Reservations", "label": "Manage reservations (update, status, reschedule)"},
    {"code": "reservations.reports", "category": "Reservations", "label": "View reservation reports"},

    # ── CRM ──
    {"code": "crm.view",          "category": "CRM", "label": "View CRM portal"},
    {"code": "crm.customer.read", "category": "CRM", "label": "Read customer records"},

    # ── Loyalty ──
    {"code": "loyalty.read",               "category": "Loyalty", "label": "Read loyalty data & members"},
    {"code": "loyalty.transaction.create", "category": "Loyalty", "label": "Create loyalty points transaction"},
    {"code": "loyalty.redemption.create",  "category": "Loyalty", "label": "Create loyalty redemption"},

    # ── Vouchers ──
    {"code": "vouchers.read",   "category": "Vouchers", "label": "Read vouchers"},
    {"code": "vouchers.redeem", "category": "Vouchers", "label": "Redeem vouchers"},

    # ── Missing Executive permissions ──
    {"code": "executive.budget.approve", "category": "Executive", "label": "Approve executive-level budget"},
    {"code": "executive.view",           "category": "Executive", "label": "View executive portal"},

    # ── Missing HR permissions ──
    {"code": "hr.leave.read",    "category": "HR", "label": "Read leave requests"},
    {"code": "hr.leave.create",  "category": "HR", "label": "Create / submit leave request"},
    {"code": "hr.leave.approve", "category": "HR", "label": "Approve leave request"},
    {"code": "hr.employee.read", "category": "HR", "label": "Read employee records"},
    {"code": "hr.payroll.read",  "category": "HR", "label": "Read payroll data"},

    # ── Missing Admin permissions ──
    {"code": "admin.settings",  "category": "Admin", "label": "Generic admin settings access"},
    {"code": "admin.cms.read",  "category": "Admin", "label": "Read CMS content"},
    {"code": "admin.cms.write", "category": "Admin", "label": "Write / publish CMS content"},

    # ── Finance — Payment Request ──
    {"code": "finance.payment_request.read",      "category": "Finance", "label": "Read payment requests"},
    {"code": "finance.payment_request.create",    "category": "Finance", "label": "Create payment request"},
    {"code": "finance.payment_request.submit",    "category": "Finance", "label": "Submit payment request for approval"},
    {"code": "finance.payment_request.approve",   "category": "Finance", "label": "Approve payment request"},
    {"code": "finance.payment_request.mark_paid", "category": "Finance", "label": "Mark payment request as paid"},

]
