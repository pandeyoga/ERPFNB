/** Finance Portal shell — Navigation Restructuring: PortalSubNav removed, AppShell Sidebar+Subnav handles navigation.
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`
 * (same pattern as AdminPortal). Prevents URL-tamper by partial-access roles
 * (e.g. someone with only `finance.ap.read` shouldn't reach `/finance/manual-journal`).
 * SUPER_ADMIN always passes. Non-sensitive shell/hub pages remain accessible
 * to anyone with the portal prefix (`finance.*`) — those are gated by App.js. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import FinanceHome from "./FinanceHome";
import ValidationQueue from "./ValidationQueue";
import JournalList from "./JournalList";
import JournalDetail from "./JournalDetail";
import ManualJournalForm from "./ManualJournalForm";
import TrialBalance from "./TrialBalance";
import ProfitLoss from "./ProfitLoss";
import BalanceSheet from "./BalanceSheet";
import CashflowReport from "./CashflowReport";
import APAging from "./APAging";
import COABrowser from "./COABrowser";
import PeriodList from "./PeriodList";
import PeriodClosingWizard from "./PeriodClosingWizard";
import ReportBuilder from "./ReportBuilder";
import PivotReport from "./PivotReport";
import Comparatives from "./Comparatives";
import VendorScorecard from "./VendorScorecard";
import Forecasting from "./Forecasting";
import AnomalyFeed from "./AnomalyFeed";
import PaymentList from "./PaymentList";
import PaymentForm from "./PaymentForm";
import PaymentDetail from "./PaymentDetail";
import PaymentRunList from "./PaymentRunList";
import PaymentRunDetail from "./PaymentRunDetail";
import PaymentRunTemplateList from "./PaymentRunTemplateList";
import PaymentRunTemplateDetail from "./PaymentRunTemplateDetail";
import PaymentRequestList from "./PaymentRequestList";
import PaymentRequestForm from "./PaymentRequestForm";
import PaymentRequestDetail from "./PaymentRequestDetail";
import BankRecon from "./BankRecon";
import CashPosition from "./CashPosition";
import TaxCenter from "./TaxCenter";
import EFakturExport from "./EFakturExport";
import EBupotExport from "./EBupotExport";
import FixedAssetList from "./FixedAssetList";
import FixedAssetDetail from "./FixedAssetDetail";
import BudgetVsActual from "./BudgetVsActual";
import BudgetManagement from "./BudgetManagement";
import BudgetHub from "./BudgetHub";
import ARInvoiceList from "./ARInvoiceList";
import PeriodClosingHub from "./PeriodClosingHub";
import ReservationDeposits from "./ReservationDeposits";
import ApprovalCenter from "../shared/ApprovalCenter";
import FinanceReportsHub from "./FinanceReportsHub";
import FinancePaymentsHub from "./FinancePaymentsHub";
import FinanceTaxHub from "./FinanceTaxHub";

export default function FinancePortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="finance-portal">
      <Routes>
        <Route index element={<FinanceHome />} />
      <Route path="validation" element={g("finance.sales.validate", <ValidationQueue />)} />
      {/* Payments Hub — all payment sub-pages in one tabbed workspace */}
      <Route path="payments-hub" element={g("finance.payment", <FinancePaymentsHub />)} />
      <Route path="payments" element={g("finance.payment", <PaymentList />)} />
      <Route path="payments/new" element={g("finance.payment.create", <PaymentForm />)} />
      <Route path="payments/:id" element={g("finance.payment", <PaymentDetail />)} />
      <Route path="payment-runs" element={g("finance.payment", <PaymentRunList />)} />
      <Route path="payment-runs/:id" element={g("finance.payment", <PaymentRunDetail />)} />
      <Route path="payment-run-templates" element={g("finance.payment", <PaymentRunTemplateList />)} />
      <Route path="payment-run-templates/:id" element={g("finance.payment", <PaymentRunTemplateDetail />)} />
      <Route path="payment-requests" element={g("finance.payment_request", <PaymentRequestList />)} />
      <Route path="payment-requests/new" element={g("finance.payment_request.create", <PaymentRequestForm />)} />
      <Route path="payment-requests/:id" element={g("finance.payment_request", <PaymentRequestDetail />)} />
      <Route path="journals" element={g("finance.journal_entry", <JournalList />)} />
      <Route path="journals/:id" element={g("finance.journal_entry", <JournalDetail />)} />
      <Route path="manual-journal" element={g("finance.journal_entry.create", <ManualJournalForm />)} />
      {/* Reports Hub — all 7 reports in one tabbed workspace */}
      <Route path="reports" element={g("finance.report", <FinanceReportsHub />)} />
      {/* Legacy direct routes redirect to hub with tab pre-selected */}
      <Route path="trial-balance" element={<Navigate to="/finance/reports?tab=trial-balance" replace />} />
      <Route path="profit-loss" element={<Navigate to="/finance/reports?tab=profit-loss" replace />} />
      <Route path="balance-sheet" element={<Navigate to="/finance/reports?tab=balance-sheet" replace />} />
      <Route path="cashflow" element={<Navigate to="/finance/reports?tab=cashflow" replace />} />
      <Route path="comparatives" element={<Navigate to="/finance/reports?tab=comparatives" replace />} />
      <Route path="report-builder" element={<Navigate to="/finance/reports?tab=report-builder" replace />} />
      <Route path="pivot" element={<Navigate to="/finance/reports?tab=pivot" replace />} />
      <Route path="ap-aging" element={g("finance.ap.read", <APAging />)} />
      {/* Tax & Compliance Hub — Tax Center + e-Faktur + e-Bupot tabs */}
      <Route path="tax" element={g(["finance.report", "finance.journal_entry"], <FinanceTaxHub />)} />
      <Route path="tax-center" element={g(["finance.report", "finance.journal_entry"], <TaxCenter />)} />
      <Route path="efaktur" element={g(["finance.report", "finance.journal_entry"], <EFakturExport />)} />
      <Route path="ebupot" element={g(["finance.report", "finance.journal_entry"], <EBupotExport />)} />
      <Route path="assets" element={g("finance.asset", <FixedAssetList />)} />
      <Route path="assets/:id" element={g("finance.asset", <FixedAssetDetail />)} />
      {/* Budget Hub — Budget vs Actual + Management + Forecasting tabs */}
      <Route path="budget-hub" element={g("finance.budget", <BudgetHub />)} />
      <Route path="budget" element={g("finance.budget", <BudgetVsActual />)} />
      <Route path="budget/manage" element={g("finance.budget.update", <BudgetManagement />)} />
      <Route path="ar-invoices" element={g("finance.ar", <ARInvoiceList />)} />
      <Route path="bank-recon" element={g("finance.bank_reconciliation", <BankRecon />)} />
      <Route path="cash-position" element={g("finance.cash.read", <CashPosition />)} />
      <Route path="forecasting" element={g("finance.budget", <Forecasting />)} />
      <Route path="anomalies" element={g("finance.journal_entry.read", <AnomalyFeed />)} />
      <Route path="vendor-scorecard" element={g("finance.ap.read", <VendorScorecard />)} />
      <Route path="periods" element={g("finance.journal_entry.read", <PeriodList />)} />
      <Route path="period-closing" element={g("finance.period.lock", <PeriodClosingHub />)} />
      <Route path="period-closing/:period" element={g("finance.period.lock", <PeriodClosingWizard />)} />
      <Route path="closing-wizard" element={<Navigate to="/finance/periods" replace />} />
      <Route path="coa" element={g("finance.journal_entry.read", <COABrowser />)} />
      <Route path="reservation-deposits" element={g("finance.ar", <ReservationDeposits />)} />
      <Route path="approvals" element={<ApprovalCenter />} />
      <Route path="*" element={<Navigate to="/finance" replace />} />
      </Routes>
    </div>
  );
}

