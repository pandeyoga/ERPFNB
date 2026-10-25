/** Finance Portal shell — Navigation Restructuring: PortalSubNav removed, AppShell Sidebar+Subnav handles navigation.
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`
 * (same pattern as AdminPortal). Prevents URL-tamper by partial-access roles
 * (e.g. someone with only `finance.ap.read` shouldn't reach `/finance/manual-journal`).
 * SUPER_ADMIN always passes. Non-sensitive shell/hub pages remain accessible
 * to anyone with the portal prefix (`finance.*`) — those are gated by App.js. */
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import LegacyRedirect from "@/components/shared/LegacyRedirect";
import FinanceHome from "./FinanceHome";
import ValidationQueue from "./ValidationQueue";
import JournalList from "./JournalList";
import JournalDetail from "./JournalDetail";
import ManualJournalForm from "./ManualJournalForm";
import COABrowser from "./COABrowser";
import PeriodClosingWizard from "./PeriodClosingWizard";
import VendorScorecard from "./VendorScorecard";
import PaymentForm from "./PaymentForm";
import PaymentDetail from "./PaymentDetail";
import PaymentRunDetail from "./PaymentRunDetail";
import PaymentRunTemplateDetail from "./PaymentRunTemplateDetail";
import FixedAssetList from "./FixedAssetList";
import FixedAssetDetail from "./FixedAssetDetail";
import BudgetHub from "./BudgetHub";
import PeriodClosingHub from "./PeriodClosingHub";
import FinanceReportsHub from "./FinanceReportsHub";
import FinancePaymentsHub from "./FinancePaymentsHub";
import FinanceTaxHub from "./FinanceTaxHub";

function LegacyPaymentRedirect() {
  const { id } = useParams();
  return <Navigate to={`/finance/payments/${id}`} replace />;
}

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
      <Route path="payments-hub" element={g(["finance.payment", "finance.ap.read", "finance.bank_reconciliation", "finance.cash.read", "finance.ar"], <FinancePaymentsHub />)} />
      <Route path="payments" element={<LegacyRedirect to="/finance/payments-hub?tab=payments" />} />
      <Route path="payments/new" element={g("finance.payment.create", <PaymentForm />)} />
      <Route path="payments/:id" element={g("finance.payment", <PaymentDetail />)} />
      <Route path="payment-runs" element={<LegacyRedirect to="/finance/payments-hub?tab=payment-runs" />} />
      <Route path="payment-runs/:id" element={g("finance.payment", <PaymentRunDetail />)} />
      <Route path="payment-run-templates" element={<LegacyRedirect to="/finance/payments-hub?tab=run-templates" />} />
      <Route path="payment-run-templates/:id" element={g("finance.payment", <PaymentRunTemplateDetail />)} />
      {/* P0-04: legacy Payment Request module retired → single Payments module */}
      <Route path="payment-requests" element={<Navigate to="/finance/payments-hub?tab=payments" replace />} />
      <Route path="payment-requests/new" element={<Navigate to="/finance/payments/new" replace />} />
      <Route path="payment-requests/:id" element={<LegacyPaymentRedirect />} />
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
      <Route path="ap-aging" element={<LegacyRedirect to="/finance/payments-hub?tab=ap-aging" />} />
      {/* Tax & Compliance Hub — Tax Center + e-Faktur + e-Bupot tabs */}
      <Route path="tax" element={g(["finance.report", "finance.journal_entry"], <FinanceTaxHub />)} />
      <Route path="tax-center" element={<LegacyRedirect to="/finance/tax?tab=tax" />} />
      <Route path="efaktur" element={<LegacyRedirect to="/finance/tax?tab=efaktur" />} />
      <Route path="ebupot" element={<LegacyRedirect to="/finance/tax?tab=ebupot" />} />
      <Route path="assets" element={g("finance.asset", <FixedAssetList />)} />
      <Route path="assets/:id" element={g("finance.asset", <FixedAssetDetail />)} />
      {/* Budget Hub — Budget vs Actual + Management + Forecasting tabs */}
      <Route path="budget-hub" element={g("finance.budget", <BudgetHub />)} />
      <Route path="budget" element={<LegacyRedirect to="/finance/budget-hub?tab=vs-actual" />} />
      <Route path="budget/manage" element={<LegacyRedirect to="/finance/budget-hub?tab=manage" />} />
      <Route path="ar-invoices" element={<LegacyRedirect to="/finance/payments-hub?tab=ar-invoices" />} />
      <Route path="bank-recon" element={<LegacyRedirect to="/finance/payments-hub?tab=bank-recon" />} />
      <Route path="cash-position" element={<LegacyRedirect to="/finance/payments-hub?tab=cash-position" />} />
      <Route path="forecasting" element={<LegacyRedirect to="/finance/budget-hub?tab=forecasting" />} />
      <Route path="anomalies" element={<LegacyRedirect to="/finance/period-closing?phase=1" />} />
      <Route path="vendor-scorecard" element={g("finance.ap.read", <VendorScorecard />)} />
      <Route path="periods" element={<LegacyRedirect to="/finance/period-closing?phase=0" />} />
      <Route path="period-closing" element={g(["finance.period.lock", "finance.journal_entry.read"], <PeriodClosingHub />)} />
      <Route path="period-closing/:period" element={g("finance.period.lock", <PeriodClosingWizard />)} />
      <Route path="closing-wizard" element={<LegacyRedirect to="/finance/period-closing" />} />
      <Route path="coa" element={g("finance.journal_entry.read", <COABrowser />)} />
      <Route path="reservation-deposits" element={<LegacyRedirect to="/finance/payments-hub?tab=deposits" />} />
      <Route path="*" element={<Navigate to="/finance" replace />} />
      </Routes>
    </div>
  );
}

