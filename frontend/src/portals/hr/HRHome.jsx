/** HR Home — dashboard cards + quick actions. */
import { Link, useNavigate } from "react-router-dom";
import {
  Users, Wallet, Receipt, Ticket, PiggyBank, ArrowRight,
  CalendarDays, CheckCircle, AlertTriangle, LayoutDashboard,
} from "lucide-react";
import { useHRHome } from "@/hooks/useHRDashboard";
import ApprovalWidget from "@/components/shared/ApprovalWidget";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import { fmtRp } from "@/lib/format";

export default function HRHome() {
  const navigate = useNavigate();
  const { data: home, isLoading: loading } = useHRHome();

  if (loading) return <LoadingState variant="cards" />;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="hr-home-page">
      <div data-testid="hr-home-header">
        <PageHeader
          icon={LayoutDashboard}
          title="HR Overview"
          className="mb-0 md:mb-0"
          subtitle={
            <>
              Periode aktif: <span className="font-medium text-foreground" data-testid="hr-home-period">{home?.period}</span>
              {" "}· monitoring kasbon, service charge, incentive & voucher.
            </>
          }
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4" data-testid="hr-home-kpi-strip">
        <div data-testid="hr-kpi-employees">
          <CompactStatCard label="Active Employees" value={home?.active_employees ?? 0}
            sub="Karyawan aktif" icon={Users} color="aurora-1" />
        </div>
        <div data-testid="hr-kpi-advances">
          <CompactStatCard label="Open Advances" value={home?.open_advances ?? 0}
            sub={`Outstanding: ${fmtRp(home?.advance_outstanding ?? 0)}`}
            icon={Wallet} color="aurora-2"
            onClick={() => navigate("/hr/compensation?tab=advances")} />
        </div>
        <div data-testid="hr-kpi-voucher">
          <CompactStatCard label="Voucher Liability" value={fmtRp(home?.voucher_liability ?? 0)}
            sub={`${home?.voucher_unredeemed_count ?? 0} belum ditukar`}
            icon={Ticket} color="aurora-3"
            onClick={() => navigate("/hr/compensation?tab=voucher")} />
        </div>
        <div data-testid="hr-kpi-lbfund">
          <CompactStatCard label="LB Fund Balance" value={fmtRp(home?.lb_fund_balance ?? 0)}
            sub="Loss & Breakage Fund" icon={PiggyBank} color="aurora-4"
            onClick={() => navigate("/hr/compensation?tab=lb-fund")} />
        </div>
      </div>

      {(home?.pending_advance_approval > 0 || home?.service_charge_pending > 0 || home?.incentive_pending > 0) && (
        <div className="glass-card p-4 flex items-start gap-3 border-l-4 border-amber-500" data-testid="hr-pending-card">
          <AlertTriangle className="h-5 w-5 text-amber-800 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm md:text-base mb-1.5">Tindakan Tertunda</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {home?.pending_advance_approval > 0 && (
                <li>
                  <Link to="/hr/compensation?tab=advances" className="hover:text-foreground" data-testid="hr-pending-adv">
                    {home.pending_advance_approval} kasbon menunggu approval →
                  </Link>
                </li>
              )}
              {home?.service_charge_pending > 0 && (
                <li>
                  <Link to="/hr/compensation?tab=service-charge" className="hover:text-foreground" data-testid="hr-pending-sc">
                    {home.service_charge_pending} service charge belum di-post →
                  </Link>
                </li>
              )}
              {home?.incentive_pending > 0 && (
                <li>
                  <Link to="/hr/compensation?tab=incentive" className="hover:text-foreground" data-testid="hr-pending-inc">
                    {home.incentive_pending} incentive run perlu disposisi →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      <section data-testid="hr-quick-actions">
        <h2 className="text-base md:text-lg font-semibold mb-2">Aksi Cepat</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <ActionTile to="/hr/compensation?tab=advances&new=1" icon={Wallet} label="Buat Kasbon" testId="hr-qa-advance" />
          <ActionTile to="/hr/compensation?tab=service-charge&new=1" icon={Receipt} label="Hitung Service Charge" testId="hr-qa-service" />
          <ActionTile to="/hr/leaves" icon={CalendarDays} label="Kelola Cuti" testId="hr-qa-leaves" />
          <ActionTile to="/my-approvals" icon={CheckCircle} label="Pusat Persetujuan" testId="hr-qa-approvals" />
        </div>
      </section>

      {/* Approval Widget */}
      <ApprovalWidget approvalCenterPath="/my-approvals" />
      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 text-sm" data-testid="hr-tips-card">
        <div className="space-y-1" data-testid="hr-tips-service">
          <h3 className="text-sm md:text-base font-semibold">Tips Service Charge</h3>
          <p className="text-muted-foreground">
            Service charge auto-pull dari validated daily sales. Tetapkan persen LB/LD
            kemudian alokasi otomatis berdasarkan hari kerja default 22 hari.
          </p>
        </div>
        <div className="space-y-1" data-testid="hr-tips-payroll">
          <h3 className="text-sm md:text-base font-semibold">Payroll Cycle</h3>
          <p className="text-muted-foreground">
            Payroll mengkonsolidasi gaji + service share + incentive share − cicilan kasbon.
            Posting payroll otomatis offset advance receivable.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Tile aksi cepat — satu target klik (Link) dengan gaya kartu yang sama dengan CompactStatCard. */
function ActionTile({ to, icon: Icon, label, testId }) {
  return (
    <Link
      to={to}
      className="glass-card-hover p-3 min-h-[60px] flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={testId}
    >
      <div className="h-9 w-9 shrink-0 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="flex-1 min-w-0 text-sm font-medium truncate">{label}</div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
