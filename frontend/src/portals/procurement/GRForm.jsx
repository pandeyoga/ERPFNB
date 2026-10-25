/** GR Form — post Goods Receipt against PO (or direct).
 *  Phase 3: PeriodLockBanner blocks submit when target receive_date period is locked.
 *  Outlet Scope: auto-selects user default outlet; restricted staff see only their outlets.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, PackageOpen } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
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
      .then(async res => {
        let po = (unwrap(res) || []).find(p => p.id === fromPO);
        if (!po) {
          // CTL-14: fetch directly instead of relying on the first 100 POs
          try { po = unwrap(await api.get(`/procurement/pos/${fromPO}`)); } catch { po = null; }
        }
        if (!po) return;
        // CTL-14: default qty = remaining after previous GRs
        const received = {};
        try {
          const grs = unwrap(await api.get("/procurement/grs", { params: { per_page: 100 } })) || [];
          grs.filter(g => g.po_id === po.id && g.status === "posted").forEach(g =>
            (g.lines || []).forEach(l => {
              if (l.po_line_index != null) received[l.po_line_index] = (received[l.po_line_index] || 0) + Number(l.qty_received || 0);
            }));
        } catch { /* ignore */ }
        // Nama vendor untuk field vendor yang terkunci (dokumen PO hanya menyimpan vendor_id)
        let vendorName = po.vendor_name || "";
        if (!vendorName && po.vendor_id) {
          try { vendorName = unwrap(await api.get(`/master/vendors/${po.vendor_id}`))?.name || ""; } catch { /* ignore */ }
        }
        setPoInfo(po);
        setForm(f => ({
          ...f,
          po_id: po.id,
          vendor_id: po.vendor_id,
          vendor_name: vendorName,
          outlet_id: po.outlet_id || "",
          payment_terms_days: po.payment_terms_days || 30,
          tax_rate: (po.lines || [])[0]?.tax_rate || 0,
          lines: (po.lines || []).map((ln, idx) => ({
            po_line_index: idx,
            item_id: ln.item_id, item_name: ln.item_name,
            qty_ordered: ln.qty || 0,
            qty_received: Math.max(0, (ln.qty || 0) - (received[idx] || 0)),
            unit: ln.unit, unit_cost: ln.unit_cost || 0,
            condition_note: "",
          })).filter(l => l.qty_received > 0),
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
    <div className="space-y-3 lg:space-y-4 max-w-5xl mx-auto" data-testid="gr-form-page">
      <div data-testid="gr-form-header">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-1" data-testid="gr-form-back">
          <ArrowLeft /> Kembali
        </Button>
        <PageHeader
          icon={PackageOpen}
          title="Posting Goods Receipt"
          subtitle={poInfo ? undefined : "Catat barang yang diterima dari vendor. Stok & jurnal AP terbentuk otomatis."}
          className="mb-0 md:mb-0"
          testId="gr-form-page-header"
          actions={
            <Button onClick={save} disabled={saving || periodLocked} data-testid="gr-save">
              <Save /> {saving ? "Memposting…" : "Posting GR"}
            </Button>
          }
        >
          {poInfo && (
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-full glass-input" data-testid="gr-form-po-badge">
              Dari PO {poInfo.doc_no || poInfo.id.slice(0, 8)}
            </span>
          )}
        </PageHeader>
      </div>

      <PeriodLockBanner
        date={form.receive_date}
        action="post Goods Receipt"
        onLockState={({ locked, closed }) => setPeriodLocked(locked || closed)}
      />

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4" data-testid="gr-form-header-card">
        <div className="md:col-span-2 space-y-1">
          <Label htmlFor="gr-vendor-input" className="text-xs md:text-sm font-medium">Vendor *</Label>
          {fromPO ? (
            <Input id="gr-vendor-input" disabled value={form.vendor_name || (loadingPO ? "Memuat…" : "—")} className="glass-input" data-testid="gr-vendor-locked" />
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
        <div className="space-y-1">
          <Label className="text-xs md:text-sm font-medium">Outlet tujuan *</Label>
          <OutletScopePicker
            value={form.outlet_id}
            onChange={(id) => {
              setOutletId(id);
              setForm(f => ({ ...f, outlet_id: id }));
            }}
            outlets={scopedOutlets}
            isFullAccess={isFullAccess}
            allowAll={false}
            placeholder="Pilih outlet"
            className="[&>button]:min-w-0 [&>button]:flex-1"
            data-testid="gr-outlet"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gr-receive-date" className="text-xs md:text-sm font-medium">Tanggal terima</Label>
          <Input id="gr-receive-date" type="date" value={form.receive_date}
            onChange={e => setForm(f => ({ ...f, receive_date: e.target.value }))}
            className="glass-input" data-testid="gr-receive-date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gr-invoice-no" className="text-xs md:text-sm font-medium">No. invoice</Label>
          <Input id="gr-invoice-no" value={form.invoice_no}
            onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
            placeholder="INV-2026-001"
            className="glass-input" data-testid="gr-invoice-no" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gr-invoice-date" className="text-xs md:text-sm font-medium">Tanggal invoice</Label>
          <Input id="gr-invoice-date" type="date" value={form.invoice_date}
            onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
            className="glass-input" data-testid="gr-invoice-date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gr-tax-rate" className="text-xs md:text-sm font-medium">Tarif pajak (desimal, mis. 0.11)</Label>
          <Input id="gr-tax-rate" type="number" step="0.01" min="0" value={form.tax_rate}
            onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
            className="glass-input" data-testid="gr-tax-rate" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gr-terms-days" className="text-xs md:text-sm font-medium">Termin pembayaran (hari)</Label>
          <Input id="gr-terms-days" type="number" min="0" value={form.payment_terms_days}
            onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))}
            className="glass-input" data-testid="gr-terms-days" />
        </div>
      </div>

      <div className="glass-card p-4" data-testid="gr-lines-card">
        <div className="flex items-center justify-between mb-3" data-testid="gr-lines-toolbar">
          <h3 className="text-sm md:text-base font-semibold">Item diterima {fromPO && <span className="text-xs font-normal text-muted-foreground">(dari PO)</span>}</h3>
          {!fromPO && (
            <Button onClick={addLine} variant="outline" size="sm" data-testid="gr-add-line">
              <Plus /> Tambah item
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
                    aria-label={`Qty diterima baris ${ln._idx + 1}`}
                    onChange={e => setLine(ln._idx, "qty_received", e.target.value)}
                    className={`glass-input h-9 text-right tabular-nums w-24 ${variance !== 0 ? "ring-1 ring-amber-500/50" : ""}`}
                    data-testid={`gr-line-qty-${ln._idx}`} />
                );
              } },
            { key: "unit", label: "Unit", render: (ln) => <span className="text-muted-foreground">{ln.unit}</span> },
            { key: "unit_cost", label: "Harga satuan", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.unit_cost}
                  aria-label={`Harga satuan baris ${ln._idx + 1}`}
                  onChange={e => setLine(ln._idx, "unit_cost", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-32" data-testid={`gr-line-cost-${ln._idx}`} />
              ) },
            { key: "total", label: "Total", numeric: true,
              render: (ln) => {
                const total = Number(ln.qty_received || 0) * Number(ln.unit_cost || 0);
                return <span className="font-medium" data-testid={`gr-line-total-${ln._idx}`}>{fmtRp(total)}</span>;
              } },
            { key: "note", label: "Catatan",
              render: (ln) => (
                <Input value={ln.condition_note || ""}
                  aria-label={`Catatan kondisi baris ${ln._idx + 1}`}
                  onChange={e => setLine(ln._idx, "condition_note", e.target.value)}
                  className="glass-input h-9" placeholder="mis. rusak ringan" data-testid={`gr-line-note-${ln._idx}`} />
              ) },
          ]}
          rowAction={(ln) => !fromPO ? (
            <Button variant="ghost" size="icon-sm" onClick={() => removeLine(ln._idx)}
              className="hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Hapus baris ${ln._idx + 1}`}
              data-testid={`gr-line-remove-${ln._idx}`}>
              <Trash2 />
            </Button>
          ) : null}
        />
        <div className="mt-3 max-w-sm ml-auto space-y-1 text-sm" data-testid="gr-totals">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums" data-testid="gr-subtotal">{fmtRp(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax ({(Number(form.tax_rate) * 100).toFixed(1)}%)</span><span className="tabular-nums" data-testid="gr-tax-amount">{fmtRp(totals.tax)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50 text-base font-semibold"><span>Grand Total</span><span className="tabular-nums" data-testid="gr-grand-total">{fmtRp(totals.grand)}</span></div>
        </div>
      </div>

      <div className="glass-card p-4 space-y-1" data-testid="gr-notes-card">
        <Label htmlFor="gr-notes" className="text-xs md:text-sm font-medium">Catatan</Label>
        <Textarea id="gr-notes" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="glass-input min-h-[80px]" data-testid="gr-notes" />
      </div>
    </div>
  );
}
