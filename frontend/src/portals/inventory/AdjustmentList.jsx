/** Adjustment list + create + approve (multi-tier aware). */
import { useEffect, useMemo, useState } from "react";
import { Plus, Sliders, CheckCircle2, Trash2, XCircle, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { usePaginatedList } from "@/hooks/useListQuery";
import { Button } from "@/components/ui/button";
import AsyncButton from "@/components/shared/AsyncButton";
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
import ApprovalProgress from "@/components/shared/ApprovalProgress";
import ApprovalChain from "@/components/shared/ApprovalChain";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";
import { confirmDialog, promptDialog } from "@/components/shared/confirmDialog";
import ListHeader from "./ListHeader";

const REASONS = [
  { v: "waste", l: "Waste / Buang" },
  { v: "damage", l: "Damage / Rusak" },
  { v: "correction", l: "Correction / Koreksi" },
  { v: "other", l: "Other" },
];

/** `embedded` = dirender sebagai tab di Stock Movements hub (tanpa <h1> sendiri). */
export default function AdjustmentList({ embedded = false }) {
  const { can } = useAuth();
  const { outletId, setOutletId, scopedOutlets, allOutlets, isFullAccess, currentOutlet } = useOutletScope();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);

  const filters = useMemo(() => {
    const f = {};
    if (outletId) f.outlet_id = outletId;
    return f;
  }, [outletId]);

  const { data, isLoading: loading, refetch } = usePaginatedList("/inventory/adjustments", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };

  const outletMap = useMemo(
    () => Object.fromEntries(allOutlets.map(o => [o.id, o])),
    [allOutlets],
  );

  // Reset page when outlet scope changes
  useEffect(() => { setPage(1); }, [outletId]);

  async function approve(a) {
    if (!(await confirmDialog(`Setujui adjustment ${a.doc_no || a.id.slice(0, 8)}? Stok & jurnal akan diperbarui.`))) return;
    try {
      await api.post(`/inventory/adjustments/${a.id}/approve`, { note: "approved" });
      toast.success("Adjustment disetujui"); refetch();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyetujui adjustment"); }
  }

  const [stateDlg, setStateDlg] = useState(null);
  const [stateData, setStateData] = useState(null);

  async function openState(a) {
    setStateDlg(a);
    setStateData(null);
    try {
      const res = await api.get(`/inventory/adjustments/${a.id}/approval-state`);
      setStateData(unwrap(res));
    } catch { setStateData(null); }
  }

  // Alasan penolakan via promptDialog global (sebelumnya dialog ad-hoc lokal).
  async function reject(a) {
    const reason = await promptDialog({
      title: "Tolak adjustment?",
      description: `${a.doc_no || a.id.slice(0, 8)} — stok tidak akan berubah.`,
      label: "Alasan penolakan",
      placeholder: "Tulis alasan penolakan…",
      required: true,
      multiline: true,
      destructive: true,
      confirmText: "Tolak",
    });
    if (reason == null) return;
    try {
      await api.post(`/inventory/adjustments/${a.id}/reject`, { reason: reason.trim() });
      toast.success("Adjustment ditolak");
      refetch();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menolak adjustment"); }
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="inventory-adjustment-page">
      <div data-testid="adj-header-card">
        <ListHeader
          embedded={embedded}
          icon={Sliders}
          title="Stock Adjustments"
          subtitle={`${outletId && currentOutlet ? `Outlet: ${currentOutlet.name}` : "Semua outlet"} — waste, rusak, atau koreksi stok. Approval menghasilkan jurnal.`}
          actions={
            <>
              {/* Outlet switcher for multi-outlet / full-access users */}
              {scopedOutlets.length > 1 && (
                <SimpleSelect
                  value={outletId}
                  onValueChange={setOutletId}
                  options={[...(isFullAccess ? [{ value: "", label: "Semua outlet" }] : []), ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
                  placeholder="Semua outlet"
                  className="glass-input w-44"
                  testId="adj-outlet-filter"
                  ariaLabel="Filter outlet"
                />
              )}
              <Button onClick={() => setShowForm(true)} data-testid="adj-new" disabled={!can("inventory.adjustment.create")}>
                <Plus /> Buat Adjustment
              </Button>
            </>
          }
        />
      </div>

      <div className="glass-card overflow-hidden" data-testid="adj-table">
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: a => <span className="font-medium tabular-nums">{a.doc_no || a.id.slice(0, 8)}</span> },
            { key: "adjustment_date", label: "Tanggal", sortable: true, render: a => fmtDate(a.adjustment_date) },
            { key: "outlet", label: "Outlet", render: a => outletMap[a.outlet_id]?.name || a.outlet_id },
            { key: "reason", label: "Alasan", sortable: true, render: a => <span className="capitalize">{a.reason}</span> },
            { key: "lines", label: "Lines", numeric: true, sortable: true, sortAccessor: a => a.lines?.length || 0, render: a => a.lines?.length || 0 },
            { key: "total_value", label: "Nilai Total", numeric: true, sortable: true,
              render: a => <span className={cn("font-semibold", a.total_value < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{fmtRp(a.total_value || 0)}</span> },
            { key: "status", label: "Status", render: a => <StatusPill status={a.status} /> },
          ]}
          rows={items}
          loading={loading}
          rowTestIdPrefix="adj-row"
          defaultSort={{ key: "adjustment_date", dir: "desc" }}
          renderExpanded={(a) => <AdjustmentLines a={a} />}
          empty={<EmptyState icon={Sliders} title="Belum ada adjustment" description="Buat adjustment untuk mencatat waste, barang rusak, atau koreksi stok." />}
          rowAction={(a) => (
            <div className="inline-flex items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); openState(a); }}
                title="Lihat status approval" aria-label={`Lihat status approval ${a.doc_no || ""}`.trim()}
                data-testid={`adj-state-${a.id}`}>
                <Eye />
              </Button>
              {(a.status === "submitted" || a.status === "awaiting_approval") && can("inventory.adjustment.approve") && (
                <>
                  <AsyncButton onClick={async (e) => { e.stopPropagation(); await approve(a); }} size="sm" busyText="Menyetujui…" data-testid={`adj-approve-${a.id}`}>
                    <CheckCircle2 /> Setujui
                  </AsyncButton>
                  <Button onClick={(e) => { e.stopPropagation(); reject(a); }} size="sm" variant="outline"
                    className="text-destructive" data-testid={`adj-reject-${a.id}`}>
                    <XCircle /> Tolak
                  </Button>
                </>
              )}
            </div>
          )}
        />
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="adj-pagination">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="adj-prev">Sebelumnya</Button>
              <span className="tabular-nums">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="adj-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>

      <AdjustmentForm
        open={showForm}
        outlets={scopedOutlets}
        defaultOutletId={outletId}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); refetch(); }}
      />

      {/* Approval state detail */}
      <Dialog open={!!stateDlg} onOpenChange={(v) => !v && setStateDlg(null)}>
        <DialogContent className="glass-card max-w-2xl">
          <DialogHeader>
            <DialogTitle>Status approval · {stateDlg?.doc_no || stateDlg?.id?.slice(0, 8)}</DialogTitle>
            <DialogDescription>Tier, step saat ini, dan timeline approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Progres approval</h3>
              <ApprovalProgress state={stateData} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Timeline</h3>
              <ApprovalChain chain={stateDlg?.approval_chain || []} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStateDlg(null)} data-testid="adj-state-close">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdjustmentLines({ a }) {
  const lines = a.lines || [];
  if (!lines.length) return <p className="text-sm text-muted-foreground">Tidak ada item.</p>;
  return (
    <div className="space-y-2" data-testid={`adj-lines-${a.id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Item ({lines.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Item</th>
              <th className="py-1 pr-3 font-medium text-right">± Qty</th>
              <th className="py-1 pr-3 font-medium">Unit</th>
              <th className="py-1 pr-3 font-medium text-right">Harga</th>
              <th className="py-1 pr-3 font-medium text-right">Subtotal</th>
              <th className="py-1 pr-3 font-medium">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-border/30">
                <td className="py-1.5 pr-3 font-medium">{l.item_name}</td>
                <td className={cn("py-1.5 pr-3 text-right tabular-nums", Number(l.qty_delta) < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                  {Number(l.qty_delta) > 0 ? `+${l.qty_delta}` : l.qty_delta}
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">{l.unit}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(l.unit_cost || 0)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{fmtRp(Number(l.qty_delta || 0) * Number(l.unit_cost || 0))}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{l.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdjustmentForm({ open, outlets, defaultOutletId, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(prev => ({
        ...emptyForm(),
        adjustment_date: todayJakartaISO(),
        // Pre-fill outlet from scope context
        outlet_id: defaultOutletId || outlets?.[0]?.id || "",
      }));
    }
  }, [open, defaultOutletId, outlets]);
  if (!open) return null;

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { item_name: "", item_id: null, qty_delta: 0, unit: "pcs", unit_cost: 0, notes: "" }] }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const total = form.lines.reduce((s, l) => s + Number(l.qty_delta || 0) * Number(l.unit_cost || 0), 0);

  const submit = async () => {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.lines.some(l => !l.item_name)) { toast.error("Lengkapi line items"); return; }
    setSaving(true);
    try {
      await api.post("/inventory/adjustments", {
        outlet_id: form.outlet_id,
        adjustment_date: form.adjustment_date,
        reason: form.reason,
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty_delta: Number(l.qty_delta || 0),
          unit: l.unit, unit_cost: Number(l.unit_cost || 0),
          notes: l.notes,
        })),
        notes: form.notes,
      });
      toast.success("Adjustment dibuat");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan adjustment");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjustment Baru</DialogTitle>
          <DialogDescription>Status awal submitted, perlu approval untuk update stok &amp; jurnal.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs md:text-sm font-medium">Outlet <span className="text-destructive">*</span></Label>
            <SimpleSelect
              value={form.outlet_id}
              onValueChange={v => setForm(f => ({ ...f, outlet_id: v }))}
              options={[{ value: "", label: "Pilih outlet" }, ...outlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Pilih outlet"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="adj-outlet"
              ariaLabel="Outlet"
            />
          </div>
          <div>
            <Label htmlFor="adj-date" className="text-xs md:text-sm font-medium">Tanggal <span className="text-destructive">*</span></Label>
            <Input id="adj-date" type="date" value={form.adjustment_date}
              onChange={e => setForm(f => ({ ...f, adjustment_date: e.target.value }))}
              className="glass-input mt-1" data-testid="adj-date" />
          </div>
          <div>
            <Label className="text-xs md:text-sm font-medium">Alasan <span className="text-destructive">*</span></Label>
            <SimpleSelect
              value={form.reason}
              onValueChange={v => setForm(f => ({ ...f, reason: v }))}
              options={REASONS.map(r => ({ value: r.v, label: r.l }))}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="adj-reason"
              ariaLabel="Alasan adjustment"
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Item <span className="text-xs font-normal text-muted-foreground">(±Qty: negatif = kurangi, positif = tambah)</span></h3>
            <Button onClick={addLine} variant="outline" size="sm" data-testid="adj-add-line">
              <Plus /> Tambah baris
            </Button>
          </div>
          {form.lines.map((ln, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center mb-2">
              <div className="col-span-5">
                <ItemAutocomplete
                  value={ln.item_name}
                  onChange={v => setLine(i, "item_name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.lines];
                      lines[i] = { ...lines[i], item_name: it.name, item_id: it.id, unit: it.unit || lines[i].unit, unit_cost: it.last_price ?? lines[i].unit_cost };
                      return { ...f, lines };
                    });
                  }}
                  dataTestId={`adj-line-item-${i}`}
                />
              </div>
              <Input type="number" value={ln.qty_delta}
                onChange={e => setLine(i, "qty_delta", e.target.value)}
                className="glass-input col-span-2 text-right tabular-nums" placeholder="±Qty" aria-label={`±Qty baris ${i + 1}`} data-testid={`adj-line-qty-${i}`} />
              <Input value={ln.unit} onChange={e => setLine(i, "unit", e.target.value)} className="glass-input col-span-1" placeholder="Unit" aria-label={`Unit baris ${i + 1}`} />
              <Input type="number" min="0" value={ln.unit_cost} onChange={e => setLine(i, "unit_cost", e.target.value)} className="glass-input col-span-2 text-right tabular-nums" placeholder="Harga" aria-label={`Harga satuan baris ${i + 1}`} />
              <div className="col-span-1 text-right text-xs tabular-nums">{fmtRp(Number(ln.qty_delta || 0) * Number(ln.unit_cost || 0))}</div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={form.lines.length <= 1}
                className="col-span-1 hover:bg-destructive/10 hover:text-destructive" aria-label={`Hapus baris ${i + 1}`} data-testid={`adj-line-remove-${i}`}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-semibold">
            <span>Total nilai</span>
            <span className={cn("tabular-nums", total < 0 ? "text-red-700 dark:text-red-400" : "")}>{fmtRp(total)}</span>
          </div>
        </div>

        <div>
          <Label htmlFor="adj-notes" className="text-xs md:text-sm font-medium">Catatan</Label>
          <Textarea id="adj-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="glass-input mt-1 min-h-[60px]" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="adj-save">{saving ? "Mengajukan…" : "Ajukan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return {
    outlet_id: "", reason: "waste",
    adjustment_date: todayJakartaISO(),
    lines: [{ item_name: "", item_id: null, qty_delta: 0, unit: "pcs", unit_cost: 0, notes: "" }],
    notes: "",
  };
}
