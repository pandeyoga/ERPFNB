/** Procurement Home — KPIs + recent activity. (9B: shortcuts to Kanban + Vendor Comparison) */
import { Link } from "react-router-dom";
import {
  FileText, FileCheck, PackageOpen, ArrowRight, Clock,
  Layers, Scale,
} from "lucide-react";
import { useProcurementHome } from "@/hooks/useProcurementDashboard";
import KpiCard from "@/components/shared/KpiCard";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp, fmtDate } from "@/lib/format";

export default function ProcurementHome() {
  const { data, isLoading: loading } = useProcurementHome();
  const stats = data?.stats || { pr_pending: 0, pr_total: 0, po_open: 0, po_total: 0, gr_total: 0 };
  const recentPR = data?.recentPR || [];
  const recentPO = data?.recentPO || [];

  return (
    <div className="space-y-6" data-testid="procurement-home-page">
      <div className="glass-card p-6" data-testid="procurement-welcome">
        <h2 className="text-xl font-bold mb-1">Procurement Overview</h2>
        <p className="text-sm text-muted-foreground">
          Lihat status pengadaan, kelola PR/PO, dan posting goods receipt.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/procurement/kanban">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-foreground/[0.06] hover:bg-foreground/[0.10] transition-colors" data-testid="qa-kanban">
              <Layers className="h-3.5 w-3.5" /> Buka Workboard (Kanban)
            </button>
          </Link>
          <Link to="/procurement/vendor-comparison">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-foreground/[0.06] hover:bg-foreground/[0.10] transition-colors" data-testid="qa-vc">
              <Scale className="h-3.5 w-3.5" /> Bandingkan Vendor
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="procurement-kpi-strip">
        <KpiCard label="PR Pending" value={loading ? "…" : stats.pr_pending}
          hint={`${stats.pr_total} total`} icon={FileText} color="aurora-1" />
        <KpiCard label="PO Open" value={loading ? "…" : stats.po_open}
          hint={`${stats.po_total} total`} icon={FileCheck} color="aurora-2" />
        <KpiCard label="GR Posted" value={loading ? "…" : stats.gr_total}
          hint="All-time" icon={PackageOpen} color="aurora-4" />
        <KpiCard label="Quick Actions" value=" " hint="Buat PR baru" icon={ArrowRight} color="aurora-5"
          onClick={() => window.location.assign("/procurement/pr/new")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Purchase Requests</h3>
            <Link to="/procurement/pr" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPR.length === 0 && <div className="text-sm text-muted-foreground italic" data-testid="procurement-recent-pr-empty">Belum ada PR.</div>}
          <div className="space-y-2" data-testid="procurement-recent-pr-list">
            {recentPR.map(pr => (
              <Link key={pr.id} to={`/procurement/pr/${pr.id}`} className="glass-input rounded-xl px-3 py-2.5 flex items-center gap-3 hover:bg-foreground/5 transition" data-testid={`procurement-pr-row-${pr.id}`}>
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{pr.doc_no || pr.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(pr.request_date)} · {pr.lines?.length || 0} item
                  </div>
                </div>
                <StatusPill status={pr.status} />
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Purchase Orders</h3>
            <Link to="/procurement/po" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPO.length === 0 && <div className="text-sm text-muted-foreground italic" data-testid="procurement-recent-po-empty">Belum ada PO.</div>}
          <div className="space-y-2" data-testid="procurement-recent-po-list">
            {recentPO.map(po => (
              <Link key={po.id} to={`/procurement/po/${po.id}`} className="glass-input rounded-xl px-3 py-2.5 flex items-center gap-3 hover:bg-foreground/5 transition" data-testid={`procurement-po-row-${po.id}`}>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{po.doc_no || po.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(po.order_date)} · {fmtRp(po.grand_total || 0)}
                  </div>
                </div>
                <StatusPill status={po.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
