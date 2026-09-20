/** Transfer Detail — full page with header, status timeline, line items, and action buttons. */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, Send, Inbox, Package, Calendar, User, FileText, AlertCircle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function TransferDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [transfer, setTransfer] = useState(null);
  const [outlets, setOutlets] = useState({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [tRes, oRes] = await Promise.all([
        api.get(`/inventory/transfers/${id}`),
        api.get("/master/outlets", { params: { per_page: 100 } }),
      ]);
      setTransfer(unwrap(tRes));
      const oList = unwrap(oRes) || [];
      setOutlets(Object.fromEntries(oList.map((o) => [o.id, o])));
    } catch (e) {
      toast.error("Gagal memuat detail transfer");
      navigate("/inventory/transfers");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function send() {
    if (!(await confirmDialog("Kirim transfer? Stok akan dikurangi dari outlet asal."))) return;
    setActing(true);
    try {
      await api.post(`/inventory/transfers/${id}/send`);
      toast.success("Transfer dikirim");
      load();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
    finally { setActing(false); }
  }
  async function receive() {
    if (!(await confirmDialog("Konfirmasi penerimaan? Stok akan masuk ke outlet tujuan."))) return;
    setActing(true);
    try {
      await api.post(`/inventory/transfers/${id}/receive`);
      toast.success("Transfer diterima");
      load();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
    finally { setActing(false); }
  }

  if (loading) return <div className="max-w-5xl mx-auto p-6"><LoadingState rows={6} /></div>;
  if (!transfer) return null;

  const fromName = outlets[transfer.from_outlet_id]?.name || transfer.from_outlet_id;
  const toName = outlets[transfer.to_outlet_id]?.name || transfer.to_outlet_id;
  const totalQty = (transfer.lines || []).reduce((s, l) => s + Number(l.qty || 0), 0);
  const totalValue = Number(transfer.total_value || 0);

  const timeline = [
    { label: "Dibuat (Draft)", time: transfer.created_at, icon: FileText, active: true },
    { label: "Dikirim", time: transfer.sent_at, icon: Send, active: !!transfer.sent_at },
    { label: "Diterima", time: transfer.received_at, icon: Inbox, active: !!transfer.received_at },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4" data-testid="transfer-detail-page">
      <div className="flex items-center justify-between gap-3 flex-wrap" data-testid="trf-detail-header">
        <Button variant="ghost" size="sm" onClick={() => navigate("/inventory/transfers")} className="gap-2" data-testid="trf-detail-back">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <div className="flex gap-2" data-testid="trf-detail-actions">
          {transfer.status === "draft" && can("inventory.transfer.send") && (
            <Button onClick={send} disabled={acting} className="rounded-full pill-active gap-2" data-testid="trf-detail-send">
              <Send className="h-4 w-4" /> Kirim
            </Button>
          )}
          {transfer.status === "sent" && can("inventory.transfer.receive") && (
            <Button onClick={receive} disabled={acting} className="rounded-full pill-active gap-2" data-testid="trf-detail-receive">
              <Inbox className="h-4 w-4" /> Terima
            </Button>
          )}
        </div>
      </div>

      <PageHeader
        icon={ArrowLeftRight}
        title={`Transfer ${transfer.doc_no || transfer.id?.slice(0, 8)}`}
        subtitle={`${fromName} → ${toName}`}
        action={<StatusPill status={transfer.status} />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="trf-summary">
        <SummaryCard icon={Calendar} label="Tanggal Transfer" value={fmtDate(transfer.transfer_date)} testid="trf-summary-date" />
        <SummaryCard icon={Package} label="Total Item" value={`${transfer.lines?.length || 0} item`} sub={`${fmtNumber(totalQty)} qty`} testid="trf-summary-items" />
        <SummaryCard icon={ArrowLeftRight} label="Total Value" value={fmtRp(totalValue)} testid="trf-summary-value" />
        <SummaryCard icon={User} label="Status" value={statusLabel(transfer.status)} testid="trf-summary-status" />
      </div>

      {/* Timeline */}
      <div className="glass-card p-5" data-testid="trf-timeline-card">
        <h3 className="text-sm font-semibold mb-4">Timeline Status</h3>
        <div className="flex items-center gap-2 overflow-x-auto" data-testid="trf-timeline">
          {timeline.map((t, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0" data-testid={`trf-timeline-step-${i}`}>
              <div className={`h-9 w-9 rounded-full flex items-center justify-center ${t.active ? "grad-aurora text-white" : "bg-foreground/5 text-muted-foreground"}`}>
                <t.icon className="h-4 w-4" />
              </div>
              <div className="min-w-[120px]">
                <div className="text-xs font-semibold">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">{t.time ? fmtDateTime(t.time) : "—"}</div>
              </div>
              {i < timeline.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      {/* Line items table */}
      <div className="glass-card overflow-hidden" data-testid="trf-lines-card">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line Items</h3>
          <span className="text-xs text-muted-foreground" data-testid="trf-lines-count">{transfer.lines?.length || 0} baris</span>
        </div>
        <DataTable
          rows={(transfer.lines || []).map((ln, i) => ({ ...ln, _idx: i + 1, _key: i }))}
          keyField="_key"
          rowTestIdPrefix="trf-line"
          empty={<div data-testid="trf-lines-empty" className="px-5 py-8 text-center text-sm text-muted-foreground">Belum ada line item</div>}
          columns={[
            { key: "_idx", label: "#", render: (ln) => <span className="text-xs text-muted-foreground tabular-nums">{ln._idx}</span> },
            { key: "item_name", label: "Item", primary: true, sortable: true, render: (ln) => ln.item_name || ln.item_id },
            { key: "qty", label: "Qty", numeric: true, sortable: true, render: (ln) => fmtNumber(Number(ln.qty || 0)) },
            { key: "unit", label: "Unit", render: (ln) => <span className="text-xs text-muted-foreground">{ln.unit || "-"}</span> },
            { key: "unit_cost", label: "Unit Cost", numeric: true, render: (ln) => fmtRp(Number(ln.unit_cost || 0)) },
            { key: "total", label: "Total", numeric: true, sortable: true,
              render: (ln) => <span className="font-semibold">{fmtRp(Number(ln.total_cost || ln.qty * ln.unit_cost || 0))}</span> },
          ]}
          footer={(transfer.lines || []).length > 0 ? (
            <tr className="bg-foreground/5 font-bold" data-testid="trf-total-row">
              <td colSpan={5} className="px-5 py-3 text-right">Total Value</td>
              <td className="px-5 py-3 text-right tabular-nums" data-testid="trf-total-value">{fmtRp(totalValue)}</td>
            </tr>
          ) : null}
        />
      </div>

      {/* Notes */}
      {transfer.notes && (
        <div className="glass-card p-4" data-testid="trf-notes-card">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <AlertCircle className="h-4 w-4" /> Catatan
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{transfer.notes}</p>
        </div>
      )}

      {/* Movements links */}
      {(transfer.movement_out_ids?.length || transfer.movement_in_ids?.length) ? (
        <div className="glass-card p-4 space-y-2" data-testid="trf-movements-card">
          <h3 className="text-sm font-semibold">Inventory Movements</h3>
          <div className="text-xs text-muted-foreground">
            {transfer.movement_out_ids?.length > 0 && <div data-testid="trf-mvt-out">Out: {transfer.movement_out_ids.length} entries (di {fromName})</div>}
            {transfer.movement_in_ids?.length > 0 && <div data-testid="trf-mvt-in">In: {transfer.movement_in_ids.length} entries (di {toName})</div>}
          </div>
          <Link to="/inventory/movements" className="text-xs text-primary hover:underline inline-block" data-testid="trf-view-all-mvt">Lihat semua movement →</Link>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(s) {
  return ({ draft: "Draft", sent: "Dikirim", received: "Diterima" }[s] || s);
}

function SummaryCard({ icon: Icon, label, value, sub, testid }) {
  return (
    <div className="glass-card p-4" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-bold text-base tabular-nums truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
