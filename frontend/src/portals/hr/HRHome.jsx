/** HR Home — dashboard cards + quick actions. */
import { Link } from "react-router-dom";
import {
  Users, Wallet, Receipt, Ticket, PiggyBank, ArrowRight,
  CalendarDays, CheckCircle, AlertTriangle,
} from "lucide-react";
import { useHRHome } from "@/hooks/useHRDashboard";
import ApprovalWidget from "@/components/shared/ApprovalWidget";
import KpiCard from "@/components/shared/KpiCard";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp } from "@/lib/format";

export default function HRHome() {
  const { data: home, isLoading: loading } = useHRHome();

  if (loading) return <LoadingState variant="cards" />;

  return (
    <div className="space-y-6" data-testid="hr-home-page">
      <div className="glass-card p-6" data-testid="hr-home-header">
        <h2 className="text-xl font-bold mb-1">HR Overview</h2>
        <p className="text-sm text-muted-foreground">
          Periode aktif: <span className="font-medium text-foreground" data-testid="hr-home-period">{home?.period}</span>
          {' '}· monitoring kasbon, service charge, incentive & voucher.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="hr-home-kpi-strip">
        <div data-testid="hr-kpi-employees">
          <KpiCard label="Active Employees" value={home?.active_employees ?? 0}
            hint="Karyawan aktif" icon={Users} color="aurora-1" />
        </div>
        <div data-testid="hr-kpi-advances">
          <KpiCard label="Open Advances" value={home?.open_advances ?? 0}
            hint={`Outstanding: ${fmtRp(home?.advance_outstanding ?? 0)}`}
            icon={Wallet} color="aurora-2"
            onClick={() => window.location.assign("/hr/advances")} />
        </div>
        <div data-testid="hr-kpi-voucher">
          <KpiCard label="Voucher Liability" value={fmtRp(home?.voucher_liability ?? 0)}
            hint={`${home?.voucher_unredeemed_count ?? 0} unredeemed`}
            icon={Ticket} color="aurora-3"
            onClick={() => window.location.assign("/hr/voucher")} />
        </div>
        <div data-testid="hr-kpi-lbfund">
          <KpiCard label="LB Fund Balance" value={fmtRp(home?.lb_fund_balance ?? 0)}
            hint="Loss & Breakage Fund" icon={PiggyBank} color="aurora-4"
            onClick={() => window.location.assign("/hr/lb-fund")} />
        </div>
      </div>

      {(home?.pending_advance_approval > 0 || home?.service_charge_pending > 0 || home?.incentive_pending > 0) && (
        <div className="glass-card p-5 flex items-start gap-3 border-l-4 border-amber-500" data-testid="hr-pending-card">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-2">Tindakan Tertunda</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {home?.pending_advance_approval > 0 && (
                <li>
                  <Link to="/hr/advances" className="hover:text-foreground" data-testid="hr-pending-adv">
                    {home.pending_advance_approval} kasbon menunggu approval →
                  </Link>
                </li>
              )}
              {home?.service_charge_pending > 0 && (
                <li>
                  <Link to="/hr/service-charge" className="hover:text-foreground" data-testid="hr-pending-sc">
                    {home.service_charge_pending} service charge belum di-post →
                  </Link>
                </li>
              )}
              {home?.incentive_pending > 0 && (
                <li>
                  <Link to="/hr/incentive" className="hover:text-foreground" data-testid="hr-pending-inc">
                    {home.incentive_pending} incentive run perlu disposisi →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div data-testid="hr-quick-actions">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionTile to="/hr/advances?new=1" icon={Wallet} label="Buat Kasbon" testId="hr-qa-advance" />
          <ActionTile to="/hr/service-charge?new=1" icon={Receipt} label="Hitung Service" testId="hr-qa-service" />
          <ActionTile to="/hr/leaves" icon={CalendarDays} label="Cuti Karyawan" testId="hr-qa-leaves" />
          <ActionTile to="/hr/approvals" icon={CheckCircle} label="Approval Center" testId="hr-qa-approvals" />
        </div>
      </div>

      {/* Approval Widget */}
      <ApprovalWidget approvalCenterPath="/hr/approvals" />
      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" data-testid="hr-tips-card">
        <div className="space-y-1" data-testid="hr-tips-service">
          <h3 className="font-semibold mb-2">Tips Service Charge</h3>
          <p className="text-muted-foreground">
            Service charge auto-pull dari validated daily sales. Tetapkan persen LB/LD
            kemudian alokasi otomatis berdasarkan hari kerja default 22 hari.
          </p>
        </div>
        <div className="space-y-1" data-testid="hr-tips-payroll">
          <h3 className="font-semibold mb-2">Payroll Cycle</h3>
          <p className="text-muted-foreground">
            Payroll mengkonsolidasi gaji + service share + incentive share − cicilan kasbon.
            Posting payroll otomatis offset advance receivable.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionTile({ to, icon: Icon, label, testId }) {
  return (
    <Link to={to} className="glass-card-hover p-4 flex items-center gap-3" data-testid={testId}>
      <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1"><div className="text-sm font-semibold">{label}</div></div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
