/** Payment Request Form — select open AP invoices untuk payment approval. */
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, CheckSquare, Square, AlertTriangle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PaymentRequestForm() {
  const navigate = useNavigate();
  const [openAP, setOpenAP] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState({
    request_date: todayJakartaISO(),
    period_week: getCurrentWeek(),
    notes: "",
  });

  useEffect(() => {
    loadOpenAP();
  }, []);

  async function loadOpenAP() {
    setLoading(true);
    try {
      const res = await api.get("/finance/payment-requests/helpers/open-ap");
      setOpenAP(unwrap(res) || []);
    } catch (e) {
      toast.error("Gagal load open AP");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(grId) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(grId) ? next.delete(grId) : next.add(grId);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === openAP.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(openAP.map((ap) => ap.gr_id)));
    }
  }

  const selectedItems = useMemo(() => {
    return openAP.filter((ap) => selected.has(ap.gr_id));
  }, [openAP, selected]);

  const totalAmount = useMemo(() => {
    return selectedItems.reduce((sum, ap) => sum + ap.outstanding, 0);
  }, [selectedItems]);

  async function save() {
    if (selected.size === 0) {
      toast.error("Pilih minimal 1 invoice untuk dimasukkan ke PR");
      return;
    }

    if (!form.request_date) {
      toast.error("Request date wajib diisi");
      return;
    }

    if (!form.period_week) {
      toast.error("Period week wajib diisi (YYYY-WW)");
      return;
    }

    setSaving(true);
    try {
      const items = selectedItems.map((ap) => ({
        gr_id: ap.gr_id,
        vendor_id: ap.vendor_id,
        vendor_name: ap.vendor_name,
        invoice_no: ap.invoice_no,
        invoice_date: ap.invoice_date,
        due_date: ap.due_date,
        amount: ap.outstanding,
        priority: ap.priority,
      }));

      const payload = {
        request_date: form.request_date,
        period_week: form.period_week,
        items,
        notes: form.notes,
      };

      const res = await api.post("/finance/payment-requests", payload);
      const pr = unwrap(res);
      toast.success(`Payment Request ${pr.doc_no} berhasil dibuat`);
      navigate(`/finance/payment-requests/${pr.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal buat PR");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto" data-testid="pr-form-page">
      <div className="flex items-center gap-3 flex-wrap" data-testid="pr-form-header">
        <Button
          variant="outline"
          onClick={() => navigate("/finance/payment-requests")}
          className="rounded-full gap-2"
          data-testid="pr-form-back"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">Buat Payment Request Baru</h2>
        <div className="ml-auto">
          <Button
            onClick={save}
            disabled={saving || selected.size === 0}
            className="rounded-full gap-2"
            data-testid="pr-save"
          >
            <Save className="h-4 w-4" /> {saving ? "..." : "Simpan sebagai Draft"}
          </Button>
        </div>
      </div>

      {/* Form Header */}
      <div className="glass-card p-5" data-testid="pr-form-meta-card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Request Date *</Label>
            <Input
              type="date"
              value={form.request_date}
              onChange={(e) => setForm({ ...form, request_date: e.target.value })}
              className="glass-input mt-1"
              data-testid="pr-request-date"
            />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Period Week (YYYY-WW) *</Label>
            <Input
              type="text"
              placeholder="mis: 2026-20"
              value={form.period_week}
              onChange={(e) => setForm({ ...form, period_week: e.target.value })}
              className="glass-input mt-1"
              data-testid="pr-period"
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              Format: YYYY-WW (year-week number)
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Notes (optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan tambahan..."
              className="glass-input mt-1 min-h-[60px]"
              data-testid="pr-notes"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="pr-summary">
        <div className="glass-card p-4" data-testid="pr-stat-selected">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Invoice Dipilih</div>
          <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400 mt-1">
            {selected.size}
          </div>
        </div>
        <div className="glass-card p-4" data-testid="pr-stat-total">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Amount</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {fmtRp(totalAmount)}
          </div>
        </div>
        <div className="glass-card p-4" data-testid="pr-stat-overdue">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Overdue Items</div>
          <div className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400 mt-1">
            {openAP.filter((ap) => ap.days_overdue > 0).length}
          </div>
        </div>
      </div>

      {/* Open AP List */}
      <div className="glass-card p-5" data-testid="pr-open-ap-section">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Open AP Invoices</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="rounded-full gap-1"
            data-testid="pr-select-all"
          >
            {selected.size === openAP.length ? (
              <>
                <Square className="h-3.5 w-3.5" /> Unselect All
              </>
            ) : (
              <>
                <CheckSquare className="h-3.5 w-3.5" /> Select All
              </>
            )}
          </Button>
        </div>

        <div data-testid="pr-open-ap-table">
          <DataTable
            rows={openAP}
            keyField="gr_id"
            loading={loading}
            rowTestIdPrefix="pr-item"
            onRowClick={(ap) => toggleSelect(ap.gr_id)}
            rowClassName={(ap) => selected.has(ap.gr_id) ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}
            empty={(
              <span data-testid="pr-open-ap-empty">
                <EmptyState
                  icon={AlertTriangle}
                  title="Tidak ada open AP"
                  description="Semua invoice sudah dibayar atau belum ada invoice yang perlu dibayar."
                />
              </span>
            )}
            columns={[
              { key: "_sel", label: "", className: "w-12",
                render: (ap) => selected.has(ap.gr_id)
                  ? <CheckSquare className="h-5 w-5 text-emerald-700 dark:text-emerald-400 mx-auto" data-testid={`pr-item-checked-${ap.gr_id}`} />
                  : <Square className="h-5 w-5 text-muted-foreground mx-auto" data-testid={`pr-item-unchecked-${ap.gr_id}`} /> },
              { key: "vendor_name", label: "Vendor", primary: true, sortable: true,
                render: (ap) => <span className="font-medium">{ap.vendor_name}</span> },
              { key: "invoice_no", label: "Invoice No",
                render: (ap) => <span className="font-mono text-xs">{ap.invoice_no || "—"}</span> },
              { key: "invoice_date", label: "Invoice Date", render: (ap) => fmtDate(ap.invoice_date) },
              { key: "due_date", label: "Due Date", render: (ap) => fmtDate(ap.due_date) },
              { key: "days_overdue", label: "Overdue", sortable: true,
                render: (ap) => (
                  <span className={cn(ap.days_overdue > 0 && "text-red-700 dark:text-red-400 font-semibold")}>
                    {ap.days_overdue > 0 ? `+${ap.days_overdue} hari` : "—"}
                  </span>
                ) },
              { key: "total_amount", label: "Total", numeric: true, sortable: true,
                render: (ap) => fmtRp(ap.total_amount) },
              { key: "paid", label: "Paid", numeric: true,
                render: (ap) => <span className="text-muted-foreground">{fmtRp(ap.paid)}</span> },
              { key: "outstanding", label: "Outstanding", numeric: true, sortable: true,
                render: (ap) => <span className="font-semibold">{fmtRp(ap.outstanding)}</span> },
              { key: "priority", label: "Priority", render: (ap) => <PriorityBadge priority={ap.priority} /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }) {
  if (priority === "urgent") {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        URGENT
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
      Normal
    </span>
  );
}

function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, "0")}`;
}
