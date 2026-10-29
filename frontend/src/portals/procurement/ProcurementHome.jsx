/** Procurement Overview — KPI + aktivitas terbaru + pintasan (Kanban, Vendor Comparison). */
import { Link, useNavigate } from "react-router-dom";
import {
  FileText, FileCheck, PackageOpen, ArrowRight, Clock,
  Layers, Scale, Plus, ShoppingCart,
} from "lucide-react";
import { useProcurementHome } from "@/hooks/useProcurementDashboard";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp, fmtDate } from "@/lib/format";

export default function ProcurementHome() {
  const navigate = useNavigate();
  const { data, isLoading: loading } = useProcurementHome();
  const stats = data?.stats || { pr_pending: 0, pr_total: 0, po_open: 0, po_total: 0, gr_total: 0 };
  const recentPR = data?.recentPR || [];
  const recentPO = data?.recentPO || [];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="procurement-home-page">
      <PageHeader
        icon={ShoppingCart}
        title="Procurement Overview"
        subtitle="Lihat status pengadaan, kelola PR/PO, dan posting goods receipt."
        testId="procurement-welcome"
        actions={
          <>
            <Button asChild variant="outline" data-testid="qa-kanban">
              <Link to="/procurement/kanban"><Layers /> Buka Kanban</Link>
            </Button>
            <Button asChild variant="outline" data-testid="qa-vc">
              <Link to="/procurement/vendor-comparison"><Scale /> Bandingkan vendor</Link>
            </Button>
            <Button asChild data-testid="qa-new-pr">
              <Link to="/procurement/pr/new"><Plus /> Buat PR</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="procurement-kpi-strip">
        <CompactStatCard label="PR menunggu approval" value={stats.pr_pending} loading={loading}
          sub={`dari ${stats.pr_total} PR`} icon={FileText} color="aurora-1"
          onClick={() => navigate("/procurement/pr?status=submitted")} testId="procurement-kpi-pr-pending" />
        <CompactStatCard label="PO terkirim (open)" value={stats.po_open} loading={loading}
          sub={`dari ${stats.po_total} PO`} icon={FileCheck} color="aurora-2"
          onClick={() => navigate("/procurement/po?status=sent")} testId="procurement-kpi-po-open" />
        <CompactStatCard label="GR diposting" value={stats.gr_total} loading={loading}
          sub="Sepanjang waktu" icon={PackageOpen} color="aurora-4"
          onClick={() => navigate("/procurement/gr")} testId="procurement-kpi-gr" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm md:text-base font-semibold">Purchase Requests terbaru</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/procurement/pr">Lihat semua <ArrowRight /></Link>
            </Button>
          </div>
          {recentPR.length === 0 && !loading && <div className="text-sm text-muted-foreground py-3" data-testid="procurement-recent-pr-empty">Belum ada PR.</div>}
          <div className="divide-y divide-border/40" data-testid="procurement-recent-pr-list">
            {recentPR.map(pr => (
              <Link key={pr.id} to={`/procurement/pr/${pr.id}`} className="-mx-2 px-2 py-2 rounded-md flex items-center gap-3 hover:bg-foreground/5 transition-colors" data-testid={`procurement-pr-row-${pr.id}`}>
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
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

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm md:text-base font-semibold">Purchase Orders terbaru</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/procurement/po">Lihat semua <ArrowRight /></Link>
            </Button>
          </div>
          {recentPO.length === 0 && !loading && <div className="text-sm text-muted-foreground py-3" data-testid="procurement-recent-po-empty">Belum ada PO.</div>}
          <div className="divide-y divide-border/40" data-testid="procurement-recent-po-list">
            {recentPO.map(po => (
              <Link key={po.id} to={`/procurement/po/${po.id}`} className="-mx-2 px-2 py-2 rounded-md flex items-center gap-3 hover:bg-foreground/5 transition-colors" data-testid={`procurement-po-row-${po.id}`}>
                <FileCheck className="h-4 w-4 text-muted-foreground shrink-0" />
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
