/** Transfer Detail — full page with header, status timeline, line items, and action buttons. */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, Send, Inbox, Package, Calendar, CircleDot, FileText, AlertCircle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/shared/confirmDialog";

import { fetchAll } from "@/lib/api";

/** Daftar transfer ada sebagai tab di Stock Movements hub (item sidebar "Stock Movements"). */
const LIST_URL = "/inventory/movements-hub?type=transfers";

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
        fetchAll("/master/outlets"),
      ]);
      setTransfer(unwrap(tRes));
      const oList = unwrap(oRes) || [];
      setOutlets(Object.fromEntries(oList.map((o) => [o.id, o])));
    } catch (e) {
      toast.error("Gagal memuat detail transfer");
      navigate(LIST_URL);
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
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengirim transfer"); }
    finally { setActing(false); }
  }
  async function receive() {
    if (!(await confirmDialog("Konfirmasi penerimaan? Stok akan masuk ke outlet tujuan."))) return;
    setActing(true);
    try {
      await api.post(`/inventory/transfers/${id}/receive`);
      toast.success("Transfer diterima");
      load();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menerima transfer"); }
    finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!transfer) return null;

  const fromName = outlets[transfer.from_outlet_id]?.name || transfer.from_outlet_id;
  const toName = outlets[transfer.to_outlet_id]?.name || transfer.to_outlet_id;
  const totalQty = (transfer.lines || []).reduce((s, l) => s + Number(l.qty || 0), 0);
  const totalValue = Number(transfer.total_value || 0);

  // Status menentukan langkah aktif; timestamp hanya pelengkap. Sebelumnya transfer
  // berstatus "received" tanpa sent_at/received_at tampil seolah belum dikirim/diterima.
  const st = transfer.status;
  const timeline = [
    { label: "Dibuat (draft)", time: transfer.created_at, icon: FileText, active: true },
    { label: "Dikirim", time: transfer.sent_at, icon: Send, active: !!transfer.sent_at || st === "sent" || st === "received" },
    { label: "Diterima", time: transfer.received_at, icon: Inbox, active: !!transfer.received_at || st === "received" },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="transfer-detail-page">
      <div data-testid="trf-detail-header">
        <Button variant="ghost" onClick={() => navigate(LIST_URL)} data-testid="trf-detail-back">
          <ArrowLeft /> Kembali ke daftar transfer
        </Button>
      </div>

      <PageHeader
        icon={ArrowLeftRight}
        title={`Transfer ${transfer.doc_no || transfer.id?.slice(0, 8)}`}
        subtitle={`${fromName} → ${toName}`}
        className="mb-0 md:mb-0"
        actions={
          <div className="flex items-center gap-2" data-testid="trf-detail-actions">
            <StatusPill status={transfer.status} />
            {transfer.status === "draft" && can("inventory.transfer.send") && (
              <Button onClick={send} disabled={acting} data-testid="trf-detail-send">
                <Send /> Kirim
              </Button>
            )}
            {transfer.status === "sent" && can("inventory.transfer.receive") && (
              <Button onClick={receive} disabled={acting} data-testid="trf-detail-receive">
                <Inbox /> Terima
              </Button>
            )}
          </div>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="trf-summary">
        <CompactStatCard size="sm" icon={Calendar} color="aurora-1" label="Tanggal transfer" value={fmtDate(transfer.transfer_date)} testId="trf-summary-date" />
        <CompactStatCard size="sm" icon={Package} color="aurora-2" label="Total item" value={`${transfer.lines?.length || 0} item`} sub={`${fmtNumber(totalQty)} qty`} testId="trf-summary-items" />
        <CompactStatCard size="sm" icon={ArrowLeftRight} color="aurora-3" label="Total nilai" value={fmtRp(totalValue)} testId="trf-summary-value" />
        <CompactStatCard size="sm" icon={CircleDot} color="aurora-5" label="Status" value={<StatusPill status={transfer.status} />} testId="trf-summary-status" />
      </div>

      {/* Timeline */}
      <div className="glass-card p-4" data-testid="trf-timeline-card">
        <h2 className="text-sm md:text-base font-semibold mb-3">Timeline status</h2>
        <div className="flex items-center gap-2 overflow-x-auto" data-testid="trf-timeline">
          {timeline.map((t, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0" data-testid={`trf-timeline-step-${i}`}>
              <div className={`h-9 w-9 rounded-full flex items-center justify-center ${t.active ? "grad-aurora text-white" : "bg-foreground/5 text-muted-foreground"}`}>
                <t.icon className="h-4 w-4" />
              </div>
              <div className="min-w-[120px]">
                <div className="text-xs font-semibold">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.time ? fmtDateTime(t.time) : "—"}</div>
              </div>
              {i < timeline.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      {/* Line items table */}
      <div className="glass-card overflow-hidden" data-testid="trf-lines-card">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm md:text-base font-semibold">Item</h2>
          <span className="text-xs text-muted-foreground" data-testid="trf-lines-count">{transfer.lines?.length || 0} baris</span>
        </div>
        <DataTable
          rows={(transfer.lines || []).map((ln, i) => ({ ...ln, _idx: i + 1, _key: i }))}
          keyField="_key"
          rowTestIdPrefix="trf-line"
          empty={<div data-testid="trf-lines-empty" className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada item pada transfer ini.</div>}
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
            <tr className="bg-foreground/5 font-semibold" data-testid="trf-total-row">
              <td colSpan={5} className="px-3 py-2 text-right">Total nilai</td>
              <td className="px-3 py-2 text-right tabular-nums" data-testid="trf-total-value">{fmtRp(totalValue)}</td>
            </tr>
          ) : null}
        />
      </div>

      {/* Notes */}
      {transfer.notes && (
        <div className="glass-card p-4" data-testid="trf-notes-card">
          <h2 className="flex items-center gap-2 text-sm md:text-base font-semibold mb-2">
            <AlertCircle className="h-4 w-4" /> Catatan
          </h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{transfer.notes}</p>
        </div>
      )}

      {/* Movements links */}
      {(transfer.movement_out_ids?.length || transfer.movement_in_ids?.length) ? (
        <div className="glass-card p-4 space-y-2" data-testid="trf-movements-card">
          <h2 className="text-sm md:text-base font-semibold">Stock movements</h2>
          <div className="text-xs text-muted-foreground">
            {transfer.movement_out_ids?.length > 0 && <div data-testid="trf-mvt-out">Keluar: {transfer.movement_out_ids.length} entri (di {fromName})</div>}
            {transfer.movement_in_ids?.length > 0 && <div data-testid="trf-mvt-in">Masuk: {transfer.movement_in_ids.length} entri (di {toName})</div>}
          </div>
          <Link to="/inventory/movements-hub?type=history" className="text-xs text-primary hover:underline inline-block" data-testid="trf-view-all-mvt">Lihat semua pergerakan stok →</Link>
        </div>
      ) : null}
    </div>
  );
}

