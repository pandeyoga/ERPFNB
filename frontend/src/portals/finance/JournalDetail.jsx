/** Journal Detail with drill-down to source + reverse action. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw, ExternalLink, FileText } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function JournalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [je, setJe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revOpen, setRevOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/finance/journals/${id}`);
      setJe(unwrap(res));
    } catch (e) {
      toast.error("Gagal load journal");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function reverse() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      await api.post(`/finance/journals/${id}/reverse`, { reason });
      toast.success("Journal di-reverse. Counter JE dibuat.");
      setRevOpen(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal reverse");
    }
  }

  if (loading || !je) return <LoadingState rows={6} />;

  const canReverse = can("finance.journal_entry.reverse") && je.status === "posted" && je.source_type !== "reversal";

  const lineColumns = [
    { key: "coa", label: "COA", primary: true,
      render: (ln) => (
        <div>
          <div className="font-mono text-xs text-muted-foreground">{ln.coa_code}</div>
          <div className="font-medium">{ln.coa_name || ln.coa_id}</div>
        </div>
      ) },
    { key: "memo", label: "Memo", render: (ln) => <span className="text-xs text-muted-foreground">{ln.memo || "—"}</span> },
    { key: "dr", label: "Debit", numeric: true,
      render: (ln) => <span className={cn(ln.dr ? "font-semibold" : "text-muted-foreground")}>{ln.dr ? fmtRp(ln.dr) : "—"}</span> },
    { key: "cr", label: "Kredit", numeric: true,
      render: (ln) => <span className={cn(ln.cr ? "font-semibold" : "text-muted-foreground")}>{ln.cr ? fmtRp(ln.cr) : "—"}</span> },
    { key: "dim", label: "Dim",
      render: (ln) => (
        <span className="text-xs text-muted-foreground">
          {ln.dim_outlet && <span className="mr-2">outlet: {ln.dim_outlet.slice(0, 8)}</span>}
          {ln.dim_brand && <span className="mr-2">brand: {ln.dim_brand.slice(0, 8)}</span>}
          {ln.dim_vendor && <span className="mr-2">vendor: {ln.dim_vendor.slice(0, 8)}</span>}
          {ln.dim_employee && <span>emp: {ln.dim_employee.slice(0, 8)}</span>}
        </span>
      ) },
  ];
  const lineRows = (je.lines || []).map((ln, i) => ({ ...ln, id: i }));

  return (
    <div className="space-y-5 max-w-5xl mx-auto" data-testid="je-detail-page">
      <div className="flex items-center gap-3 flex-wrap" data-testid="je-detail-header">
        <Button variant="outline" onClick={() => navigate("/finance/journals")} className="rounded-full gap-2" data-testid="je-detail-back">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold" data-testid="je-detail-doc-no">JE {je.doc_no || je.id.slice(0, 8)}</h2>
        <span data-testid="je-detail-status"><StatusPill status={je.status} /></span>
        <div className="ml-auto">
          {canReverse && (
            <Button onClick={() => setRevOpen(true)} variant="outline" className="rounded-full gap-2 text-amber-600 hover:bg-amber-500/10" data-testid="je-reverse">
              <RotateCcw className="h-4 w-4" /> Reverse JE
            </Button>
          )}
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm" data-testid="je-detail-meta">
        <Field label="Entry Date" value={fmtDate(je.entry_date)} />
        <Field label="Period" value={je.period} />
        <Field label="Source" value={(je.source_type || "").replace("_", " ")} />
        <Field label="Posted At" value={je.posted_at ? fmtDateTime(je.posted_at) : "—"} />
        <div className="md:col-span-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</div>
          <div className="font-medium mt-0.5" data-testid="je-detail-description">{je.description || "—"}</div>
        </div>
      </div>

      {je.source_link && (
        <div className="glass-card p-4" data-testid="je-detail-source-card">
          <div className="flex items-center gap-3 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Source document:</span>
            <code className="text-xs" data-testid="je-detail-source-doc-no">{je.source_link.doc_no || je.source_link.id.slice(0, 8)}</code>
            <span className="text-xs text-muted-foreground">({je.source_link.date})</span>
            {je.source_link.route && (
              <Link
                to={`${je.source_link.route}/${je.source_link.id}`}
                className="ml-auto inline-flex items-center gap-1 text-sm text-foreground/80 hover:text-foreground font-medium"
                data-testid="je-drill-source"
              >
                Buka <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">Lines</h3>
        <DataTable
          rows={lineRows}
          columns={lineColumns}
          keyField="id"
          rowTestIdPrefix="je-detail-line"
          empty={<div className="p-6"><EmptyState title="Tidak ada baris" description="Journal ini belum punya baris." /></div>}
          footer={
            <tr className="font-bold" data-testid="je-detail-totals-row">
              <td colSpan={2} className="px-4 py-3 text-right">Total</td>
              <td className="px-4 py-3 text-right tabular-nums" data-testid="je-detail-total-dr">{fmtRp(je.total_dr || 0)}</td>
              <td className="px-4 py-3 text-right tabular-nums" data-testid="je-detail-total-cr">{fmtRp(je.total_cr || 0)}</td>
              <td />
            </tr>
          }
        />
      </div>

      {je.status === "reversed" && (
        <div className="glass-card p-4 border-l-4 border-amber-500 text-sm" data-testid="je-detail-reversed-banner">
          <strong>JE ini di-reverse.</strong> Reversal entry sudah dibuat untuk meng-counter saldo.
        </div>
      )}
      {je.source_type === "reversal" && je.reversal_of && (
        <div className="glass-card p-4 border-l-4 border-sky-500 text-sm flex items-center gap-2" data-testid="je-detail-reversal-banner">
          <RotateCcw className="h-4 w-4" />
          <span>Reversal dari JE {je.reversal_of.slice(0, 8)}…</span>
          <Link to={`/finance/journals/${je.reversal_of}`} className="ml-auto text-sm font-medium text-foreground/80 hover:text-foreground inline-flex items-center gap-1" data-testid="je-detail-original-link">
            Lihat asli <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      <Dialog open={revOpen} onOpenChange={setRevOpen}>
        <DialogContent className="glass-card max-w-md" data-testid="je-reverse-dialog">
          <DialogHeader>
            <DialogTitle>Reverse Journal Entry?</DialogTitle>
            <DialogDescription>Counter-JE akan dibuat menggunakan tanggal yang sama. Action ini ter-audit.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Alasan reversal…" data-testid="je-reverse-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevOpen(false)} data-testid="je-reverse-cancel">Batal</Button>
            <Button onClick={reverse} className="pill-active" data-testid="je-reverse-confirm">Reverse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5 capitalize">{value}</div>
    </div>
  );
}
