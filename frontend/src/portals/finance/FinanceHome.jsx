/** Finance Home — KPIs + quick links to most used pages. */
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardCheck, BookOpenCheck, FileBarChart, Receipt, Scale,
  PenSquare, ArrowRight, LayoutDashboard, CalendarCheck, CreditCard,
} from "lucide-react";
import { useFinanceHome } from "@/hooks/useFinanceDashboard";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import ApprovalWidget from "@/components/shared/ApprovalWidget";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp } from "@/lib/format";

export default function FinanceHome() {
  const navigate = useNavigate();
  const { data: home, isLoading: loading } = useFinanceHome();

  if (loading) return <LoadingState rows={4} />;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="finance-home-page">
      <div data-testid="finance-welcome">
        <PageHeader
          icon={LayoutDashboard}
          title="Finance Overview"
          subtitle={<>Periode aktif: <span className="font-medium text-foreground">{home?.period}</span> · jurnal otomatis dari operasional + manual journal bila perlu.</>}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="finance-kpi-strip">
        <CompactStatCard label="Pending validation" value={home?.submitted_validations ?? 0}
          sub="Daily sales menunggu finance" icon={ClipboardCheck} color="aurora-1"
          onClick={() => navigate("/finance/validation")} testId="kpi-pending-validation" />
        <CompactStatCard label="Journal this period" value={home?.je_this_period ?? 0}
          sub={`Total all-time: ${home?.je_total ?? 0}`} icon={BookOpenCheck} color="aurora-2"
          onClick={() => navigate("/finance/journals")} testId="kpi-journal-this-period" />
        <CompactStatCard label="AP exposure" value={fmtRp(home?.ap_exposure ?? 0)}
          sub="GR belum dibayar" icon={Receipt} color="aurora-4"
          onClick={() => navigate("/finance/payments-hub?tab=ap-aging")} testId="kpi-ap-exposure" />
        <CompactStatCard label="Rejected DS" value={home?.rejected_count ?? 0}
          sub="Outlet perlu memperbaiki" icon={Scale} color="aurora-5"
          tone={(home?.rejected_count ?? 0) > 0 ? "danger" : "default"} testId="kpi-rejected-ds" />
      </div>

      {/* Approval Widget — semua approval kini di Pusat Persetujuan (/my-approvals) */}
      <ApprovalWidget approvalCenterPath="/my-approvals" />

      <section data-testid="finance-quick-actions" className="space-y-2">
        <h2 className="text-base md:text-lg font-semibold">Quick actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <ActionTile to="/finance/validation" icon={ClipboardCheck} label="Sales Validation" testId="fin-qa-validate" />
          <ActionTile to="/finance/manual-journal" icon={PenSquare} label="Manual Journal" testId="fin-qa-manual" />
          <ActionTile to="/finance/payments-hub" icon={CreditCard} label="Payments" testId="fin-qa-payments" />
          <ActionTile to="/finance/reports?tab=trial-balance" icon={Scale} label="Trial Balance" testId="fin-qa-tb" />
          <ActionTile to="/finance/reports?tab=profit-loss" icon={FileBarChart} label="Profit & Loss" testId="fin-qa-pl" />
          <ActionTile to="/finance/period-closing" icon={CalendarCheck} label="Period Closing" testId="fin-qa-period-closing" />
        </div>
      </section>

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 text-sm" data-testid="finance-tips">
        <div className="space-y-1">
          <h3 className="text-sm md:text-base font-semibold">Tips</h3>
          <p className="text-muted-foreground">Validasi daily sales segera setelah submit untuk menjaga trial balance tetap akurat. Jurnal terbentuk otomatis.</p>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm md:text-base font-semibold">Closing period</h3>
          <p className="text-muted-foreground">
            Setelah validasi & rekonsiliasi selesai, kunci periode lewat{" "}
            <Link to="/finance/period-closing" className="text-primary hover:underline font-medium">Period Closing</Link>{" "}
            agar tidak ada posting mundur.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionTile({ to, icon: Icon, label, testId }) {
  return (
    <Link to={to} className="glass-card-hover p-3 flex items-center gap-3" data-testid={testId}>
      <div className="h-9 w-9 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{label}</div></div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
