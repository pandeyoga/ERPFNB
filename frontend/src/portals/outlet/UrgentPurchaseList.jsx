/** Urgent Purchase — list + create dialog + finance approve.
 *  Phase 9D: AI Categorize chip on the justification/notes field.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag, Trash2, CheckCircle2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import ReceiptCapture from "@/components/shared/ReceiptCapture";
import ForecastGuardBanner from "@/components/shared/ForecastGuardBanner";
import AICategorizeChip from "@/components/shared/AICategorizeChip";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useOutletScopeCtx } from "./OutletScopeContext";
import { confirmDialog } from "@/components/shared/confirmDialog";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "submitted", label: "Menunggu Approval" },
  { key: "approved",  label: "Approved" },
  { key: "rejected",  label: "Rejected" },
];

export default function UrgentPurchaseList() {
  const { can } = useAuth();
  const { scopedOutlets: userOutlets, outletId } = useOutletScopeCtx();
  const [items, setItems] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

  useEffect(() => {
    api.get("/master/payment-methods", { params: { per_page: 100 } })
      .then(p => setPaymentMethods(unwrap(p) || [])).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (status) params.status = status;
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/outlet/urgent-purchases", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [page, status, outletId]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  async function approve(up) {
    if (!(await confirmDialog(`Approve urgent purchase ${up.doc_no || up.id}?`))) return;
    try {
      await api.post(`/outlet/urgent-purchases/${up.id}/approve`);
      toast.success("Disetujui. Jurnal dibuat.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal approve");
    }
  }

  return (
    <div className="space-y-4" data-testid="urgent-purchase-page">
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Outlet filter dikendalikan dari header. Pilih outlet di atas untuk mempersempit data.
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="sm:ml-auto rounded-full pill-active gap-2 h-10 px-5 w-full sm:w-auto" data-testid="up-new">
            <Plus className="h-4 w-4" /> Urgent Purchase Baru
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filter status">
        {STATUS_TABS.map(t => (
          <button
            key={t.key || "all"}
            role="tab"
            aria-selected={status === t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors touch-target ${
              status === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground"
            }`}
            data-testid={`up-tab-${t.key || "all"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card">
        <DataTable
          columns={[
            {
              key: "doc_no", label: "Doc No", primary: true,
              render: up => <span className="font-mono text-xs">{up.doc_no || up.id.slice(0, 8)}</span>,
            },
            { key: "purchase_date", label: "Tanggal", render: up => fmtDate(up.purchase_date) },
            {
              key: "outlet", label: "Outlet",
              render: up => userOutlets.find(o => o.id === up.outlet_id)?.name || up.outlet_id,
            },
            {
              key: "vendor", label: "Vendor",
              render: up => up.vendor_text || up.vendor_id || "—",
            },
            {
              key: "total", label: "Total", numeric: true,
              render: up => <span className="font-semibold">{fmtRp(up.total || 0)}</span>,
            },
            { key: "status", label: "Status", render: up => <StatusPill status={up.status} /> },
          ]}
          rows={items}
          loading={loading}
          empty={<EmptyState icon={ShoppingBag} title="Belum ada urgent purchase" description="Buat ketika ada kebutuhan mendadak yang tidak bisa lewat PR normal." />}
          rowAction={(up) => (
            up.status === "submitted" && can("finance.payment.approve") && (
              <Button onClick={() => approve(up)} size="sm" className="rounded-full pill-active gap-1 h-8 px-4" data-testid={`up-approve-${up.id}`}>
                <CheckCircle2 className="h-3 w-3" /> Approve
              </Button>
            )
          )}
          rowTestIdPrefix="up"
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman sebelumnya">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman berikutnya">Next</button>
            </div>
          </div>
        )}
      </div>

      <UrgentPurchaseForm
        open={showForm} userOutlets={userOutlets} paymentMethods={paymentMethods}
        defaultOutletId={outletId}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); load(); }}
      />
    </div>
  );
}

function UrgentPurchaseForm({ open, userOutlets, paymentMethods, defaultOutletId, onClose, onSaved }) {
  const [form, setForm] = useState(emptyUP());
  const [saving, setSaving] = useState(false);
  const [guardVerdict, setGuardVerdict] = useState(null);
  const [confirmReason, setConfirmReason] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyUP(),
        purchase_date: todayJakartaISO(),
        outlet_id: defaultOutletId || userOutlets[0]?.id || "",
      });
      setGuardVerdict(null);
      setConfirmReason("");
    }
  }, [open, userOutlets, defaultOutletId]);

  if (!open) return null;

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.items];
      lines[i] = { ...lines[i], [key]: val };
      const qty = Number(lines[i].qty || 0);
      const cost = Number(lines[i].cost || 0);
      lines[i].total = Math.round(qty * cost * 100) / 100;
      return { ...f, items: lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f, items: [...f.items, { name: "", qty: 1, unit: "pcs", cost: 0, total: 0 }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }
  const total = form.items.reduce((s, l) => s + Number(l.total || 0), 0);

  const hasSevereGuard = guardVerdict?.severity === "severe";
  const hasMildGuard = guardVerdict?.severity === "mild";
  const needsReason = hasSevereGuard || hasMildGuard;

  const submit = async () => {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.items.length === 0) { toast.error("Tambahkan minimal 1 item"); return; }
    if (form.items.some(it => !it.name || !it.qty)) { toast.error("Lengkapi semua item"); return; }
    if (needsReason && !confirmReason.trim()) {
      toast.error("Pengeluaran melewati forecast — wajib isi alasan/justifikasi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        outlet_id: form.outlet_id,
        purchase_date: form.purchase_date,
        vendor_id: form.vendor_id || null,
        vendor_text: form.vendor_text || null,
        items: form.items.map(it => ({
          name: it.name, qty: Number(it.qty), unit: it.unit, cost: Number(it.cost || 0),
          total: Number(it.total || 0),
        })),
        payment_method_id: form.payment_method_id || null,
        paid_by: form.paid_by || null,
        receipt_url: form.receipt_url || null,
        notes: form.notes,
        forecast_guard_reason: needsReason ? confirmReason.trim() : null,
        suggested_gl_id: form.suggested_gl_id || null,
        suggested_gl_code: form.suggested_gl_code || null,
        suggested_cost_center_outlet_id: form.suggested_outlet_id || null,
      };
      await api.post("/outlet/urgent-purchases", payload);
      toast.success("Urgent purchase dibuat");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  const handleOCRExtracted = (data) => {
    setForm(f => {
      const next = { ...f };
      if (!f.vendor_text && data.vendor_name) {
        next.vendor_text = data.vendor_name;
      }
      if (data.receipt_date) {
        next.purchase_date = data.receipt_date;
      }
      // Replace items if user has only the empty single line and OCR returned items
      const existing = f.items;
      const isSingleEmpty = existing.length === 1 && !existing[0].name && !Number(existing[0].cost);
      if (isSingleEmpty && data.items?.length) {
        next.items = data.items.map(it => ({
          name: it.name || "",
          qty: Number(it.qty || 1),
          unit: it.unit || "pcs",
          cost: Number(it.price || 0),
          total: Number(it.total || (Number(it.qty || 1) * Number(it.price || 0))),
        }));
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Urgent Purchase Baru</DialogTitle>
          <DialogDescription>Untuk pembelian mendadak yang tidak melalui PR normal.</DialogDescription>
        </DialogHeader>

        <div className="mb-3">
          <ReceiptCapture
            onExtracted={handleOCRExtracted}
            onImage={(dataUrl) => setForm(f => ({ ...f, receipt_url: dataUrl }))}
            onUploaded={(att) => setForm(f => ({ ...f, attachment_id: att.id, receipt_url: `${process.env.REACT_APP_BACKEND_URL}${att.url}` }))}
            sourceType="urgent_purchase"
            compact
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Outlet *</Label>
            <SimpleSelect
              value={form.outlet_id}
              onValueChange={v => setForm(f => ({ ...f, outlet_id: v }))}
              options={[{ value: "", label: "-- pilih outlet --" }, ...userOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="-- pilih outlet --"
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
              testId="up-form-outlet"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tanggal *</Label>
            <Input type="date" value={form.purchase_date}
              onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
              className="glass-input mt-1" data-testid="up-form-date"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vendor</Label>
            <VendorAutocomplete
              value={form.vendor_text}
              onChange={v => setForm(f => ({ ...f, vendor_text: v, vendor_id: null }))}
              onSelect={(v) => setForm(f => ({ ...f, vendor_text: v.name, vendor_id: v.id }))}
              dataTestId="up-form-vendor"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payment Method</Label>
            <SimpleSelect
              value={form.payment_method_id}
              onValueChange={v => setForm(f => ({ ...f, payment_method_id: v }))}
              options={[{ value: "", label: "-- pilih --" }, ...paymentMethods.map(pm => ({ value: pm.id, label: pm.name }))]}
              placeholder="-- pilih --"
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
              testId="up-form-pm"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Paid By</Label>
            <Input value={form.paid_by}
              onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
              placeholder="Nama pegawai/keterangan"
              className="glass-input mt-1"
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Items</h4>
            <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="up-add-line">
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          </div>
          {form.items.length === 0 && (
            <div className="text-sm text-muted-foreground italic py-3 text-center">
              Belum ada item. Klik Tambah untuk mulai.
            </div>
          )}
          {form.items.map((ln, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center mb-2">
              <div className="col-span-5">
                <ItemAutocomplete
                  value={ln.name}
                  onChange={v => setLine(i, "name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.items];
                      lines[i] = {
                        ...lines[i], name: it.name, item_id: it.id,
                        unit: it.unit || lines[i].unit,
                        cost: it.last_price ?? lines[i].cost,
                      };
                      lines[i].total = Number(lines[i].qty || 0) * Number(lines[i].cost || 0);
                      return { ...f, items: lines };
                    });
                  }}
                  placeholder="Nama item…"
                  dataTestId={`up-line-name-${i}`}
                />
              </div>
              <Input
                type="number" min="0" value={ln.qty}
                onChange={e => setLine(i, "qty", e.target.value)}
                className="glass-input col-span-2 h-9 text-right tabular-nums"
                placeholder="Qty" data-testid={`up-line-qty-${i}`}
              />
              <Input
                value={ln.unit}
                onChange={e => setLine(i, "unit", e.target.value)}
                className="glass-input col-span-1 h-9"
                placeholder="unit"
              />
              <Input
                type="number" min="0" value={ln.cost}
                onChange={e => setLine(i, "cost", e.target.value)}
                className="glass-input col-span-2 h-9 text-right tabular-nums"
                placeholder="Harga" data-testid={`up-line-cost-${i}`}
              />
              <div className="col-span-1 text-right text-sm tabular-nums font-medium">{fmtRp(ln.total || 0)}</div>
              <button onClick={() => removeLine(i)} className="col-span-1 h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex justify-between pt-3 border-t border-border/50 text-sm font-bold">
            <span>Grand Total</span>
            <span className="tabular-nums">{fmtRp(total)}</span>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes / Justifikasi</Label>
          <Textarea value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="glass-input mt-1 min-h-[60px]" />
          {form.notes && form.notes.trim().length >= 4 && (
            <div className="mt-1.5">
              <AICategorizeChip
                description={form.notes}
                amount={total}
                outletId={form.outlet_id}
                testId="up-ai-categ"
                onApply={(s) => {
                  // Persist suggested gl + cost center on the form (used at backend posting)
                  setForm(f => ({
                    ...f,
                    suggested_gl_id: s.gl_id,
                    suggested_gl_code: s.gl_code,
                    suggested_outlet_id: s.cost_center_outlet_id || f.outlet_id,
                  }));
                  toast.success(`COA ${s.gl_code} disarankan untuk Urgent Purchase ini.`);
                }}
              />
              {form.suggested_gl_code && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> COA {form.suggested_gl_code} akan diterapkan saat approval.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Forecast Guard banner — auto-checks total amount vs outlet forecast */}
        {form.outlet_id && total > 0 && (
          <div className="mt-3">
            <ForecastGuardBanner
              amount={total}
              outletId={form.outlet_id}
              kind="expense"
              period={form.purchase_date?.slice(0, 7)}
              onChange={setGuardVerdict}
            />
          </div>
        )}

        {needsReason && (
          <div className={cn(
            "mt-3 rounded-xl p-3 border-2",
            hasSevereGuard ? "border-red-500/40" : "border-amber-500/40",
          )}>
            <Label className="text-xs uppercase text-muted-foreground font-semibold">
              Alasan / Justifikasi (wajib karena {hasSevereGuard ? "jauh" : ""} di atas forecast)
            </Label>
            <Textarea
              value={confirmReason}
              onChange={e => setConfirmReason(e.target.value)}
              placeholder="mis. Vendor langganan habis stok, terpaksa beli langsung di pasar untuk operasional malam ini, dll."
              className="glass-input mt-1 min-h-[60px]"
              data-testid="up-guard-reason"
            />
            <div className="text-[11px] text-muted-foreground mt-1.5">
              Alasan akan disimpan sebagai bukti audit untuk approver.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button
            onClick={submit}
            disabled={saving || (needsReason && !confirmReason.trim())}
            className="pill-active" data-testid="up-save"
          >
            {saving ? "…" : (needsReason ? "Submit (with reason)" : "Submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyUP() {
  return {
    outlet_id: "",
    purchase_date: todayJakartaISO(),
    vendor_id: null, vendor_text: "",
    items: [{ name: "", qty: 1, unit: "pcs", cost: 0, total: 0 }],
    payment_method_id: "", paid_by: "",
    receipt_url: "",
    notes: "",
  };
}
