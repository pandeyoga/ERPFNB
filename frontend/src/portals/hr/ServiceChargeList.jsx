/** Service Charge — list periods (DataTable, row→detail) + calculate / approve / post. */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, Calculator, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** @param {{ embedded?: boolean }} props — embedded=true saat dirender sebagai tab di CompensationHub (tanpa PageHeader). */
export default function ServiceChargeList({ embedded = false }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [periodFilter, setPeriodFilter] = useState("");
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked → `outlets`
  // was an undefined identifier causing ReferenceError that crashed the entire
  // HR portal (ErrorBoundary). Destructure `scopedOutlets` aliased as `outlets`.
  const { scopedOutlets: outlets } = useOutletScope();

  const outletMap = useMemo(
    () => Object.fromEntries((outlets || []).map(o => [o.id, o])),
    [outlets],
  );

  const canPost = (user?.permissions || []).includes("hr.service_charge.post")
    || (user?.permissions || []).includes("*");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCalc(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/hr/service-charges", { params: { period: periodFilter || undefined, per_page: 50 } });
      setItems(unwrap(r) || []);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [periodFilter]);

  const calcBtn = (
    <Button onClick={() => setShowCalc(true)} data-testid="hr-sc-calc-btn">
      <Calculator /> Hitung Service Charge
    </Button>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="hr-service-charge-page">
      <PageHeader icon={Receipt} title="Service Charge"
          subtitle="Distribusi service charge per outlet & periode"
          actions={calcBtn} />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="hr-sc-period-filter" className="text-xs md:text-sm font-medium text-muted-foreground">Periode</Label>
          <Input id="hr-sc-period-filter" type="month" value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="w-44"
                  data-testid="hr-sc-period-filter" />
          {periodFilter && (
            <Button size="sm" variant="ghost" onClick={() => setPeriodFilter("")} data-testid="hr-sc-period-reset">Reset</Button>
          )}
          <InlineHelp id="hr-service-charge-list" size="sm" />
        </div>
      </div>

      <div className="glass-card" data-testid="hr-sc-table-card">
        <DataTable
          columns={[
            { key: "period", label: "Period", primary: true, sortable: true, render: it => <span className="font-mono">{it.period}</span> },
            { key: "outlet", label: "Outlet", render: it => outletMap[it.outlet_id]?.name || it.outlet_id?.slice(0, 8) },
            { key: "gross_service", label: "Gross Service", numeric: true, sortable: true, render: it => <span className="whitespace-nowrap">{fmtRp(it.gross_service)}</span> },
            { key: "lb_ld", label: "L&B / L&D", numeric: true, render: it => <span className="text-xs whitespace-nowrap">{fmtRp(it.lb_amount)} / {fmtRp(it.ld_amount)}</span> },
            { key: "distributable", label: "Distributable", numeric: true, sortable: true, render: it => <span className="font-semibold whitespace-nowrap">{fmtRp(it.distributable)}</span> },
            { key: "status", label: "Status", align: "center", sortable: true, render: it => <StatusPill status={it.status} /> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "period", dir: "desc" }}
          onRowClick={(it) => setDetailId(it.id)}
          empty={<EmptyState icon={Receipt} title="Belum ada data service charge"
            description="Tekan Hitung Service Charge untuk men-generate alokasi per outlet/periode."
            action={<Button size="sm" onClick={() => setShowCalc(true)}><Calculator /> Hitung Service Charge</Button>} />}
          rowAction={(it) => canPost ? (
            <WorkflowButton base="/hr/service-charges" item={it} testPrefix="hr-sc" onDone={load} />
          ) : null}
          rowTestIdPrefix="hr-sc-row"
        />
      </div>

      <CalculateDialog
        open={showCalc}
        onOpenChange={setShowCalc}
        outlets={outlets}
        onCalculated={async () => { setShowCalc(false); await load(); }}
      />
      <DetailDialog
        scId={detailId}
        open={!!detailId}
        outlets={outlets}
        onOpenChange={(v) => !v && setDetailId(null)}
        canPost={canPost}
        onPosted={async () => { setDetailId(null); await load(); }}
      />
    </div>
  );
}

function CalculateDialog({ open, onOpenChange, outlets, onCalculated }) {
  const [form, setForm] = useState({
    period: currentPeriod(), outlet_id: "", lb_pct: 0.05, ld_pct: 0,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.outlet_id) return toast.error("Pilih outlet");
    setSubmitting(true);
    try {
      await api.post("/hr/service-charges/calculate", {
        period: form.period,
        outlet_id: form.outlet_id,
        lb_pct: Number(form.lb_pct) || 0,
        ld_pct: Number(form.ld_pct) || 0,
        notes: form.notes || undefined,
      });
      toast.success("Service charge dihitung");
      await onCalculated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="hr-sc-calc-dialog">
        <DialogHeader>
          <DialogTitle>Hitung Service Charge</DialogTitle>
          <DialogDescription>
            Auto-pull dari validated daily sales pada period+outlet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="hr-sc-period">Periode *</Label>
            <Input id="hr-sc-period" type="month" value={form.period}
                    onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
                    data-testid="hr-sc-period" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hr-sc-outlet">Outlet *</Label>
            <Select value={form.outlet_id} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v }))}>
              <SelectTrigger id="hr-sc-outlet" data-testid="hr-sc-outlet"><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
              <SelectContent>
                {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="hr-sc-lb">L&amp;B % (0.05 = 5%)</Label>
              <Input id="hr-sc-lb" type="number" min="0" max="0.5" step="0.01" value={form.lb_pct}
                      onChange={(e) => setForm(f => ({ ...f, lb_pct: e.target.value }))}
                      data-testid="hr-sc-lb" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hr-sc-ld">L&amp;D %</Label>
              <Input id="hr-sc-ld" type="number" min="0" max="0.5" step="0.01" value={form.ld_pct}
                      onChange={(e) => setForm(f => ({ ...f, ld_pct: e.target.value }))}
                      data-testid="hr-sc-ld" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="hr-sc-notes">Catatan</Label>
            <Textarea id="hr-sc-notes" rows={2} value={form.notes}
                       onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting}
                  data-testid="hr-sc-calc-submit">
            {submitting ? "Menghitung…" : "Hitung"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ scId, open, onOpenChange, outlets, canPost, onPosted }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!scId) { setData(null); return; }
    api.get(`/hr/service-charges/${scId}`).then(r => setData(unwrap(r))).catch(() => {});
  }, [scId]);

  const handleAction = async (action) => {
    setBusy(true);
    try {
      const r = await api.post(`/hr/service-charges/${scId}/${action}`);
      if (action === "post") {
        toast.success("Posted ke jurnal");
        await onPosted();
      } else {
        setData(unwrap(r));
        toast.success("Service charge di-approve — siap di-post");
      }
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col gap-0 p-0 overflow-hidden" data-testid="hr-sc-detail-dialog">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Detail Service Charge</DialogTitle>
          {data && (
            <DialogDescription>
              Period <span className="font-mono">{data.period}</span> · Outlet {outlets.find(o => o.id === data.outlet_id)?.name || data.outlet_id?.slice(0,8)}
              {' '}· Status <StatusPill status={data.status} />
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {!data ? (
          <LoadingState rows={5} />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CompactStatCard size="sm" label="Gross" value={fmtRp(data.gross_service)} testId="hr-sc-detail-gross" />
              <CompactStatCard size="sm" label={`L&B (${(data.lb_pct*100).toFixed(1)}%)`} value={fmtRp(data.lb_amount)} testId="hr-sc-detail-lb" />
              <CompactStatCard size="sm" label={`L&D (${(data.ld_pct*100).toFixed(1)}%)`} value={fmtRp(data.ld_amount)} testId="hr-sc-detail-ld" />
              <CompactStatCard size="sm" label="Distributable" value={fmtRp(data.distributable)} tone="success" testId="hr-sc-detail-distributable" />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Alokasi per Karyawan ({data.allocations?.length || 0})
              </h3>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                    <tr>
                      <th className="text-left px-3 py-2">Karyawan</th>
                      <th className="text-center px-3 py-2">Hari Kerja</th>
                      <th className="text-right px-3 py-2">Share</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.allocations || []).map((a, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="px-3 py-2">{a.employee_name || a.employee_id?.slice(0,8)}</td>
                        <td className="px-3 py-2 text-center">{a.days_worked}</td>
                        <td className="px-3 py-2 text-right text-xs">{Number(a.share_pct || 0).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtRp(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </div>
        <DialogFooter className="px-5 py-3 border-t border-border/60">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          {canPost && data?.status === "calculated" && (
            <Button onClick={() => handleAction("approve")} disabled={busy}
                    data-testid="hr-sc-detail-approve">
              {busy ? "Memproses…" : "Setujui"}
            </Button>
          )}
          {canPost && data?.status === "approved" && (
            <Button onClick={() => handleAction("post")} disabled={busy}
                    data-testid="hr-sc-detail-post">
              {busy ? "Memposting…" : "Posting ke Jurnal"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** calculated → Approve, approved → Post (FIN-10: post only from approved). */
export function WorkflowButton({ base, item, testPrefix, onDone }) {
  const action = ({ calculated: "approve", approved: "post" })[item.status];
  if (!action) return null;
  const run = async (e) => {
    e.stopPropagation();
    try {
      await api.post(`${base}/${item.id}/${action}`);
      toast.success(action === "post" ? "Di-post ke jurnal" : "Di-approve — siap di-post");
      await onDone();
    } catch (err) { toast.error(unwrapError(err)); }
  };
  return (
    <Button size="sm" variant={action === "post" ? "default" : "outline"}
            onClick={run} data-testid={`${testPrefix}-${action}-${item.id}`}>
      {action === "post"
        ? <><ArrowUpCircle /> Posting</>
        : <><CheckCircle2 /> Setujui</>}
    </Button>
  );
}
