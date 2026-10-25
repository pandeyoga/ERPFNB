/** Daily Sales Detail — read-only view + Validate/Reject (finance) buttons + Edit (outlet). */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Edit2, CheckCircle2, XCircle, FileText, Receipt } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { confirmDialog, promptDialog } from "@/components/shared/confirmDialog";

import { fetchAll } from "@/lib/api";
export default function DailySalesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [ds, setDs] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [r, o, pm] = await Promise.all([
        api.get(`/outlet/daily-sales/${id}`),
        fetchAll("/master/outlets"),
        // Nama metode pembayaran: entri lama hanya menyimpan payment_method_id → tampil UUID.
        fetchAll("/master/payment-methods").catch(() => null),
      ]);
      setDs(unwrap(r));
      setOutlets(unwrap(o) || []);
      setPaymentMethods(pm ? (unwrap(pm) || []) : []);
    } catch (e) {
      toast.error("Gagal load detail");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (loading || !ds) return <LoadingState rows={8} />;
  const outletName = outlets.find(o => o.id === ds.outlet_id)?.name || ds.outlet_id;
  const pmName = (p) => p.payment_method_name
    || paymentMethods.find(m => m.id === p.payment_method_id)?.name
    || p.payment_method_id;

  async function validate() {
    if (!(await confirmDialog("Validasi daily sales ini? Jurnal akan dibuat."))) return;
    try {
      await api.post(`/outlet/daily-sales/${id}/validate`);
      toast.success("Tervalidasi. Jurnal dibuat.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal validasi");
    }
  }

  async function rejectSubmit() {
    const reason = await promptDialog({
      title: "Tolak Daily Sales?",
      description: "Sertakan alasan agar outlet manager bisa memperbaiki.",
      label: "Alasan penolakan",
      placeholder: "Mis: Total pembayaran tidak cocok dengan grand total…",
      multiline: true,
      destructive: true,
      confirmText: "Tolak",
    });
    if (!reason) return;
    try {
      await api.post(`/outlet/daily-sales/${id}/reject`, { reason });
      toast.success("Daily sales ditolak");
      load();
    } catch (e) {
      toast.error("Gagal menolak");
    }
  }

  const canValidate = can("finance.sales.validate") && ds.status === "submitted";
  const canReject = can("finance.sales.request_fix") && ds.status === "submitted";
  const canEdit = (ds.status === "draft" || ds.status === "rejected") && can("outlet.daily_sales.create");

  return (
    <div className="space-y-3 lg:space-y-4 max-w-5xl mx-auto" data-testid="daily-sales-detail-page">
      <div data-testid="ds-detail-header">
        <Button variant="ghost" size="sm" onClick={() => navigate("/outlet/daily-sales")} className="-ml-2 mb-1" data-testid="ds-back">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daily Sales
        </Button>
        <PageHeader
          icon={Receipt}
          title={`Daily Sales ${fmtDate(ds.sales_date)}`}
          subtitle={outletName}
          className="mb-0 md:mb-0"
          actions={(canEdit || canReject || canValidate) && (
            <>
              {canEdit && (
                <Button variant="outline" asChild>
                  <Link to={`/outlet/daily-sales/${id}/edit`} data-testid="ds-edit">
                    <Edit2 className="h-4 w-4" /> Ubah
                  </Link>
                </Button>
              )}
              {canReject && (
                <Button onClick={rejectSubmit} variant="outline" className="text-red-600 hover:bg-red-500/10" data-testid="ds-reject">
                  <XCircle className="h-4 w-4" /> Tolak
                </Button>
              )}
              {canValidate && (
                <Button onClick={validate} data-testid="ds-validate">
                  <CheckCircle2 className="h-4 w-4" /> Validasi
                </Button>
              )}
            </>
          )}
        >
          <StatusPill status={ds.status} />
        </PageHeader>
      </div>

      {ds.status === "rejected" && ds.rejected_reason && (
        <div className="glass-card border-l-4 border-red-500 p-3 text-sm">
          <strong className="text-red-700 dark:text-red-400">Ditolak:</strong> {ds.rejected_reason}
        </div>
      )}
      {ds.journal_entry_id && (
        <div className="glass-card border-l-4 border-emerald-500 p-3 text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>Jurnal dibuat · ID <span className="text-xs text-muted-foreground tabular-nums">{ds.journal_entry_id}</span></span>
        </div>
      )}

      <div className="glass-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 text-sm">
        <Field label="Outlet" value={outletName} />
        <Field label="Tanggal" value={fmtDate(ds.sales_date)} />
        <Field label="Jumlah Transaksi" value={ds.transaction_count || 0} />
        <Field label="Submitted" value={ds.submitted_at ? fmtDateTime(ds.submitted_at) : "-"} />
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm md:text-base font-semibold mb-2">Channels</h3>
        <DataTable
          rows={ds.channels || []}
          keyField="channel"
          stickyHeader={false}
          rowTestIdPrefix="ds-channel-row"
          empty={<EmptyState title="Tidak ada channel" description="Belum ada data penjualan per channel." />}
          columns={[
            { key: "channel", label: "Channel", primary: true,
              render: (c) => <span className="capitalize">{c.channel}</span> },
            { key: "gross", label: "Gross", numeric: true, sortable: true, render: (c) => fmtRp(c.gross || 0) },
            { key: "discount", label: "Diskon", numeric: true, render: (c) => fmtRp(c.discount || 0) },
            { key: "net", label: "Net", numeric: true, sortable: true,
              render: (c) => <span className="font-medium">{fmtRp(c.net || 0)}</span> },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm md:text-base font-semibold mb-3">Revenue Buckets</h3>
          <div className="space-y-2 text-sm">
            {(ds.revenue_buckets || []).map(b => (
              <div key={b.bucket} className="flex justify-between">
                <span className="capitalize text-muted-foreground">{b.bucket}</span>
                <span className="tabular-nums font-medium">{fmtRp(b.amount || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Service Charge</span>
              <span className="tabular-nums">{fmtRp(ds.service_charge || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pajak</span>
              <span className="tabular-nums">{fmtRp(ds.tax_amount || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border/50 text-base font-semibold">
              <span>Grand Total</span>
              <span className="tabular-nums">{fmtRp(ds.grand_total || 0)}</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm md:text-base font-semibold mb-3">Payment Breakdown</h3>
          {(ds.payment_breakdown || []).length === 0 && <div className="text-sm text-muted-foreground">—</div>}
          <div className="space-y-2 text-sm">
            {(ds.payment_breakdown || []).map((p, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{pmName(p)}</span>
                <span className="tabular-nums font-medium">{fmtRp(p.amount || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {ds.notes && (
        <div className="glass-card p-4">
          <h3 className="text-sm md:text-base font-semibold mb-1">Catatan</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{ds.notes}</p>
        </div>
      )}

    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
