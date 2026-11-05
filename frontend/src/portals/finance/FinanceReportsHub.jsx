/**
 * FinanceReportsHub — Unified reports workspace ("Reports" di sidebar Finance).
 * 8 tab laporan dalam satu halaman: TB, P&L, BS, Cashflow, Comparatives, Builder, Pivot, Procurement.
 * URL param: ?tab=trial-balance (default). Halaman tab tidak merender judul sendiri —
 * satu-satunya <h1> adalah PageHeader di sini.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3, TrendingUp, Scale, Droplets, GitCompareArrows,
  Wand2, Table2, ShoppingCart, FileText,
} from "lucide-react";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import HubTabs, { groupTabs } from "@/components/shared/HubTabs";
import { InlineHelp } from "@/components/shared/InlineHelp";

import TrialBalance from "./TrialBalance";
import ProfitLoss from "./ProfitLoss";
import BalanceSheet from "./BalanceSheet";
import CashflowReport from "./CashflowReport";
import Comparatives from "./Comparatives";
import ReportBuilder from "./ReportBuilder";
import PivotReport from "./PivotReport";
import ProcurementReportsTab from "./ProcurementReportsTab";

const TABS = [
  { id: "trial-balance",       label: "Trial Balance",       icon: BarChart3,        component: TrialBalance },
  { id: "profit-loss",         label: "Profit & Loss",       icon: TrendingUp,       component: ProfitLoss },
  { id: "balance-sheet",       label: "Balance Sheet",       icon: Scale,            component: BalanceSheet },
  { id: "cashflow",            label: "Cashflow",            icon: Droplets,         component: CashflowReport },
  { id: "comparatives",        label: "Period compare",      icon: GitCompareArrows, component: Comparatives },
  { id: "report-builder",      label: "Custom reports",      icon: Wand2,            component: ReportBuilder },
  { id: "pivot",               label: "Pivot analysis",      icon: Table2,           component: PivotReport },
  { id: "procurement-reports", label: "Procurement reports", icon: ShoppingCart,     component: ProcurementReportsTab },
];

const GROUPS = [
  { id: "statements", label: "Laporan keuangan", icon: BarChart3, ids: ["trial-balance", "profit-loss", "balance-sheet", "cashflow"] },
  { id: "analysis", label: "Analisis", icon: Table2, ids: ["comparatives", "pivot", "report-builder"] },
  { id: "procurement", label: "Procurement reports", ids: ["procurement-reports"] },
];

export default function FinanceReportsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "trial-balance");

  // Sync activeTab ↔ URL param
  useEffect(() => {
    const p = searchParams.get("tab");
    if (p && p !== activeTab) setActiveTab(p);
  }, [searchParams]); // eslint-disable-line

  function handleTabChange(id) {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  }

  const active = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveComponent = active.component;

  return (
    <HubHeaderProvider>
    <div data-testid="finance-reports-hub">
      <PageHeader hub
        icon={FileText}
        title="Reports"
        subtitle="Laporan keuangan, perbandingan periode, custom report, pivot, dan ekspor pengadaan"
        actions={<InlineHelp id="finance-reports-hub" size="xs" placement="left" />}
      />

      {/* 8 laporan → 3 kelompok + sub-tab (DESIGN_SYSTEM §10.8) */}
      <HubTabs
        groups={groupTabs(TABS, GROUPS)}
        value={active.id}
        onChange={handleTabChange}
        testId="reports-hub-tabs"
        itemTestId={(id) => `reports-tab-${id}`}
        groupTestId={(id) => `reports-group-${id}`}
      />
      <div className="mt-3" data-testid="reports-hub-content" role="tabpanel" aria-label={active.label}>
        <ActiveComponent />
      </div>
    </div>
    </HubHeaderProvider>
  );
}
