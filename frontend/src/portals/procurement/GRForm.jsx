/** GR Form — post Goods Receipt against PO (or direct).
 *  Phase 3: PeriodLockBanner blocks submit when target receive_date period is locked.
 *  Outlet Scope: auto-selects user default outlet; restricted staff see only their outlets.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import PeriodLockBanner from "@/components/shared/PeriodLockBanner";
import OutletScopePicker from "@/components/shared/OutletScopePicker";
import useOutletScope from "@/hooks/useOutletScope";
import useOutletScopeGuard from "@/hooks/useOutletScopeGuard";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

export default function GRForm() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const fromPO = search.get("po");

  const { outletId, setOutletId, scopedOutlets, isFullAccess, isRestricted, loaded: outletsLoaded } = useOutletScope();
  const [saving, setSaving] = useState(false);
  const [loadingPO, setLoadingPO] = useState(Boolean(fromPO));
  const [periodLocked, setPeriodLocked] = useState(false);
  const [poInfo, setPoInfo] = useState(null);
  const [form, setForm] = useState({
    po_id: fromPO || "",
    vendor_id: "", vendor_name: "",
    outlet_id: "",
    receive_date: todayJakartaISO(),
    invoice_no: "", invoice_date: "",
    tax_rate: 0,
    payment_terms_days: 30,
    lines: [{ item_name: "", item_id: null, qty_ordered: 0, qty_received: 1, unit: "pcs", unit_cost: 0, condition_note: "" }],
    notes: "",
  });

  // Sync outletId → form.outlet_id (auto-select on load)
  useEffect(() => {
    if (outletId && !form.outlet_id) {
      setForm(f => ({ ...f, outlet_id: outletId }));
    }
  }, [outletId, setOutletId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: warn if pre-filled outlet (from PO) is not in user's scope
  useOutletScopeGuard({
    requestedOutletId: form.outlet_id,
    setOutletId,
    scopedOutlets,
    isRestricted,
    loaded: outletsLoaded,
  });

  // Remove manual outlet fetch — handled by useOutletScope above

  // If PO id present, prefill
  useEffect(() => {
    if (!fromPO) return;
    setLoadingPO(true);
    api.get("/procurement/pos", { params: { per_page: 100 } })
      .then(res => {
        const po = (unwrap(res) || []).find(p => p.id === fromPO);
        if (!po) return;
        setPoInfo(po);
        setForm(f => ({
          ...f,
          po_id: po.id,
          vendor_id: po.vendor_id,
          outlet_id: po.outlet_id || "",
          payment_terms_days: po.payment_terms_days || 30,
          lines: (po.lines || []).map((ln, idx) => ({
            po_line_index: idx,
            item_id: ln.item_id, item_name: ln.item_name,
            qty_ordered: ln.qty || 0,
            qty_received: ln.qty || 0,
            unit: ln.unit, unit_cost: ln.unit_cost || 0,
            condition_note: "",
          })),
        }));
        // Sync outlet picker with PO's outlet
        if (po.outlet_id) setOutletId(po.outlet_id);
      })
      .catch(() => {})
      .finally(() => setLoadingPO(false));
  }, [fromPO]);

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f, lines: [...f.lines, { item_name: "", item_id: null, qty_ordered: 0, qty_received: 1, unit: "pcs", unit_cost: 0, condition_note: "" }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const totals = useMemo(() => {
    const subtotal = form.lines.reduce((s, l) => s + Number(l.qty_received || 0) * Number(l.unit_cost || 0), 0);
    const tax = subtotal * Number(form.tax_rate || 0);
    return { subtotal, tax, grand: subtotal + tax };
  }, [form.lines, form.tax_rate]);

  async function save() {
    if (!form.vendor_id) { toast.error("Vendor wajib"); return; }
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.lines.length === 0 || form.lines.some(l => !l.item_name || !l.qty_received)) {
      toast.error("Lengkapi line items"); return;
    }
    setSaving(true);
    try {
      const payload = {
        po_id: form.po_id || null,
        vendor_id: form.vendor_id,
        outlet_id: form.outlet_id,
        receive_date: form.receive_date,
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date || null,
        tax_rate: Number(form.tax_rate || 0),
        payment_terms_days: Number(form.payment_terms_days || 30),
        lines: form.lines.map(l => ({
          po_line_index: l.po_line_index,
          item_id: l.item_id, item_name: l.item_name,
          qty_ordered: Number(l.qty_ordered || 0),
          qty_received: Number(l.qty_received),
          unit: l.unit, unit_cost: Number(l.unit_cost || 0),
          condition_note: l.condition_note,
        })),
        notes: form.notes,
      };
      const res = await api.post("/procurement/grs", payload);
      const gr = unwrap(res);
      toast.success(`GR ${gr.doc_no} di-posting. Stok & jurnal terbuat.`);
      navigate("/procurement/gr");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal posting");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto" data-testid="gr-form-page">
      <div className="flex items-center gap-3 flex-wrap" data-testid="gr-form-header">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2" data-testid="gr-form-back">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">Posting Goods Receipt</h2>
        {poInfo && (
          <span className="text-xs px-2 py-1 rounded-full glass-input" data-testid="gr-form-po-badge">PO {poInfo.doc_no || poInfo.id.slice(0, 8)}</span>
        )}
        <div className="ml-auto">
          <Button onClick={save} disabled={saving || periodLocked} className="rounded-full pill-active gap-2" data-testid="gr-save">
            <Save className="h-4 w-4" /> {saving ? "…" : "Post GR"}
          </Button>
        </div>
      </div>

      <PeriodLockBanner
        date={form.receive_date}
        action="post Goods Receipt"
        onLockState={({ locked, closed }) => setPeriodLocked(locked || closed)}
      />

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="gr-form-header-card">
        <div className="md:col-span-2">
          <Label className="text-xs uppercase text-muted-foreground">Vendor *</Label>
          {fromPO ? (
            <Input disabled value={form.vendor_name || form.vendor_id} className="glass-input mt-1" data-testid="gr-vendor-locked" />
          ) : (
            <VendorAutocomplete
              value={form.vendor_name}
              onChange={v => setForm(f => ({ ...f, vendor_name: v, vendor_id: null }))}
              onSelect={v => setForm(f => ({ ...f, vendor_name: v.name, vendor_id: v.id }))}
              placeholder="Cari vendor…"
              dataTestId="gr-vendor"
            />
          )}
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Outlet (destinasi) *</Label>
          <div className="mt-1">
            <OutletScopePicker
              value={form.outlet_id}
              onChange={(id) => {
                setOutletId(id);
                setForm(f => ({ ...f, outlet_id: id }));
              }}
              outlets={scopedOutlets}
              isFullAccess={isFullAccess}
              allowAll={false}
              placeholder="-- pilih outlet --"
              data-testid="gr-outlet"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Receive Date</Label>
          <Input type="date" value={form.receive_date}
            onChange={e => setForm(f => ({ ...f, receive_date: e.target.value }))}
            className="glass-input mt-1" data-testid="gr-receive-date" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Invoice No</Label>
          <Input value={form.invoice_no}
            onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
            placeholder="INV-2026-001"
            className="glass-input mt-1" data-testid="gr-invoice-no" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Invoice Date</Label>
          <Input type="date" value={form.invoice_date}
            onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
            className="glass-input mt-1" data-testid="gr-invoice-date" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Tax Rate (e.g. 0.11)</Label>
          <Input type="number" step="0.01" min="0" value={form.tax_rate}
            onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
            className="glass-input mt-1" data-testid="gr-tax-rate" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Payment Terms (hari)</Label>
          <Input type="number" min="0" value={form.payment_terms_days}
            onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))}
            className="glass-input mt-1" data-testid="gr-terms-days" />
        </div>
      </div>

      <div className="glass-card p-5" data-testid="gr-lines-card">
        <div className="flex items-center justify-between mb-3" data-testid="gr-lines-toolbar">
          <h3 className="font-semibold">Line Items {fromPO && <span className="text-xs text-muted-foreground">(prefilled dari PO)</span>}</h3>
          {!fromPO && (
            <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="gr-add-line">
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          )}
        </div>
        <DataTable
          rows={form.lines.map((ln, i) => ({ ...ln, _idx: i }))}
          keyField="_idx"
          loading={loadingPO}
          loadingRows={2}
          stickyHeader={false}
          rowTestIdPrefix="gr-line-row"
          empty={<EmptyState title="Belum ada item" description="Tambah line item untuk Goods Receipt." />}
          columns={[
            { key: "item", label: "Item", primary: true,
              render: (ln) => fromPO ? (
                <div className="text-sm font-medium" data-testid={`gr-line-name-${ln._idx}`}>{ln.item_name}</div>
              ) : (
                <ItemAutocomplete
                  value={ln.item_name}
                  onChange={v => setLine(ln._idx, "item_name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.lines];
                      lines[ln._idx] = { ...lines[ln._idx], item_name: it.name, item_id: it.id, unit: it.unit || lines[ln._idx].unit, unit_cost: it.last_price ?? lines[ln._idx].unit_cost };
                      return { ...f, lines };
                    });
                  }}
                  dataTestId={`gr-line-item-${ln._idx}`}
                />
              ) },
            { key: "qty_ordered", label: "Qty Order", numeric: true,
              render: (ln) => <span className="text-muted-foreground" data-testid={`gr-line-ordered-${ln._idx}`}>{ln.qty_ordered || 0}</span> },
            { key: "qty_received", label: "Qty Diterima", numeric: true,
              render: (ln) => {
                const variance = Number(ln.qty_ordered || 0) - Number(ln.qty_received || 0);
                return (
                  <Input type="number" min="0" value={ln.qty_received}
                    onChange={e => setLine(ln._idx, "qty_received", e.target.value)}
                    className={`glass-input h-9 text-right tabular-nums w-24 ${variance !== 0 ? "ring-1 ring-amber-500/50" : ""}`}
                    data-testid={`gr-line-qty-${ln._idx}`} />
                );
              } },
            { key: "unit", label: "Unit", render: (ln) => <span className="text-muted-foreground">{ln.unit}</span> },
            { key: "unit_cost", label: "Unit Cost", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.unit_cost}
                  onChange={e => setLine(ln._idx, "unit_cost", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-32" data-testid={`gr-line-cost-${ln._idx}`} />
              ) },
            { key: "total", label: "Total", numeric: true,
              render: (ln) => {
                const total = Number(ln.qty_received || 0) * Number(ln.unit_cost || 0);
                return <span className="font-medium" data-testid={`gr-line-total-${ln._idx}`}>{fmtRp(total)}</span>;
              } },
            { key: "note", label: "Note",
              render: (ln) => (
                <Input value={ln.condition_note || ""}
                  onChange={e => setLine(ln._idx, "condition_note", e.target.value)}
                  className="glass-input h-9" placeholder="e.g. rusak ringan" data-testid={`gr-line-note-${ln._idx}`} />
              ) },
          ]}
          rowAction={(ln) => !fromPO ? (
            <button onClick={() => removeLine(ln._idx)} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
              data-testid={`gr-line-remove-${ln._idx}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        />
        <div className="mt-3 max-w-sm ml-auto space-y-1 text-sm" data-testid="gr-totals">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums" data-testid="gr-subtotal">{fmtRp(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax ({(Number(form.tax_rate) * 100).toFixed(1)}%)</span><span className="tabular-nums" data-testid="gr-tax-amount">{fmtRp(totals.tax)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50 text-base font-bold"><span>Grand Total</span><span className="tabular-nums" data-testid="gr-grand-total">{fmtRp(totals.grand)}</span></div>
        </div>
      </div>

      <div className="glass-card p-5" data-testid="gr-notes-card">
        <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
        <Textarea value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="glass-input mt-1 min-h-[80px]" data-testid="gr-notes" />
      </div>
    </div>
  );
}
