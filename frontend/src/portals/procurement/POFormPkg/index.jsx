/** POForm/index.jsx — purchase order form. */
/** PO Form — create new Purchase Order. Optionally seed from approved PR.
 *  Phase 9B: Adds VendorComparisonPanel right-rail when items selected.
 *  Phase 9D: Adds AI Vendor Recommendation modal trigger near vendor field.
 *  Smart Procurement: Adds vendor availability check, market ref price, alt vendor suggestion.
 *  Outlet Scope: auto-selects user default outlet; restricted staff see only their outlets. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, XCircle, CheckCircle, ChevronRight } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import VendorComparisonPanel from "@/components/shared/VendorComparisonPanel";
import OutletScopePicker from "@/components/shared/OutletScopePicker";
import useOutletScope from "@/hooks/useOutletScope";
import useOutletScopeGuard from "@/hooks/useOutletScopeGuard";
import { AIVendorRecommendationModal } from "@/components/shared/AIVendorRecommendation";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

const fmt = (n) => n != null ? new Intl.NumberFormat("id-ID").format(n) : "-";

export default function POForm() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const fromPRIds = search.getAll("pr");
  const { can } = useAuth();

  const { outletId, setOutletId, scopedOutlets, isFullAccess, isRestricted, loaded: outletsLoaded } = useOutletScope();
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_id: "", vendor_name: "",
    outlet_id: "",
    pr_ids: [],
    order_date: todayJakartaISO(),
    expected_delivery_date: "",
    payment_terms_days: 30,
    lines: [{ item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0, discount: 0, tax_rate: 0, availability_status: null, ref_price: null, ref_quarter: null }],
    notes: "",
  });

  // Guard: warn if pre-filled outlet (from PR) is not in user's scope
  useOutletScopeGuard({
    requestedOutletId: form.outlet_id,
    setOutletId,
    scopedOutlets,
    isRestricted,
    loaded: outletsLoaded,
  });

  // Sync outletId → form.outlet_id (auto-select on load)
  useEffect(() => {
    if (outletId && !form.outlet_id) {
      setForm(f => ({ ...f, outlet_id: outletId }));
    }
  }, [outletId]); // eslint-disable-line

  // Smart Procurement state
  const [vendorCatalog, setVendorCatalog] = useState({}); // {item_id: vendor_item_doc}
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showAltVendor, setShowAltVendor] = useState(false);
  const [altVendorLineIdx, setAltVendorLineIdx] = useState(null);
  const [altVendors, setAltVendors] = useState([]);
  const [loadingAlt, setLoadingAlt] = useState(false);

  useEffect(() => {
    // Load vendors only — outlets are provided by useOutletScope
    api.get("/master/vendors", { params: { per_page: 200 } })
      .then((v) => setVendors(unwrap(v) || []))
      .catch(() => {});
  }, []);

  // Fetch vendor catalog when vendor changes
  const fetchVendorCatalog = useCallback(async (vendorId) => {
    if (!vendorId) { setVendorCatalog({}); return; }
    setLoadingCatalog(true);
    try {
      const res = await api.get(`/vendor-items/vendor/${vendorId}?per_page=200`);
      const items = res.data.data || [];
      const map = {};
      items.forEach(vi => { map[vi.item_id] = vi; });
      setVendorCatalog(map);
    } catch (_) {
      setVendorCatalog({});
    } finally { setLoadingCatalog(false); }
  }, []);

  // Optional: seed from approved PRs
  useEffect(() => {
    if (fromPRIds.length === 0) return;
    Promise.all(fromPRIds.map(pid => api.get("/procurement/prs", { params: { per_page: 100 } })))
      .then(results => {
        const allPRs = (unwrap(results[0]) || []);
        const matched = allPRs.filter(p => fromPRIds.includes(p.id));
        if (matched.length === 0) return;
        const lines = matched.flatMap(p => (p.lines || []).map(ln => ({
          item_name: ln.item_name, item_id: ln.item_id,
          qty: ln.qty, unit: ln.unit,
          unit_cost: ln.est_cost || 0,
          discount: 0, tax_rate: 0,
          availability_status: null, ref_price: null, ref_quarter: null,
        })));
        setForm(f => ({
          ...f,
          outlet_id: matched[0]?.outlet_id || f.outlet_id,
          pr_ids: matched.map(m => m.id),
          lines,
        }));
        // Sync outlet picker with PR's outlet
        if (matched[0]?.outlet_id) setOutletId(matched[0].outlet_id);
      }).catch(() => {});
  }, [fromPRIds.length]); // eslint-disable-line

  // Fetch vendor catalog when vendor changes
  useEffect(() => {
    if (form.vendor_id) {
      fetchVendorCatalog(form.vendor_id);
    }
  }, [form.vendor_id, fetchVendorCatalog]);

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0, discount: 0, tax_rate: 0, availability_status: null, ref_price: null, ref_quarter: null }] }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  // Mark line item as unavailable from current vendor
  const handleMarkUnavailable = async (i, itemId) => {
    if (!form.vendor_id || !itemId) return;
    try {
      await api.post(`/vendor-items/vendor/${form.vendor_id}/item/${itemId}/unavailable`, {});
      toast.warning("Item ditandai tidak tersedia dari vendor ini");
      // Refresh catalog
      fetchVendorCatalog(form.vendor_id);
    } catch (_) {}
  };

  // Open alternative vendor modal for a line
  const openAltVendor = async (i) => {
    const line = form.lines[i];
    if (!line.item_id) return;
    setAltVendorLineIdx(i);
    setLoadingAlt(true);
    setShowAltVendor(true);
    try {
      const res = await api.get(`/market-list/items/${line.item_id}/vendors?include_unavailable=false`);
      const allVendors = res.data.data || [];
      // Exclude current vendor
      setAltVendors(allVendors.filter(v => v.vendor_id !== form.vendor_id));
    } finally { setLoadingAlt(false); }
  };

  // Select alternative vendor for a line — creates a note that this line needs different vendor
  const selectAltVendorForLine = (altVendor) => {
    const i = altVendorLineIdx;
    if (i === null) return;
    // Update the unit_cost with alt vendor's price
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = {
        ...lines[i],
        unit_cost: altVendor.current_price || lines[i].unit_cost,
        _alt_vendor_id: altVendor.vendor_id,
        _alt_vendor_name: altVendor.vendor_name,
        _needs_split: true,
      };
      return { ...f, lines };
    });
    toast.info(`Vendor alternatif dipilih: ${altVendor.vendor_name}. Item ini akan displit ke PO terpisah.`);
    setShowAltVendor(false);
  };

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    form.lines.forEach(l => {
      const lineSub = Number(l.qty || 0) * Number(l.unit_cost || 0) - Number(l.discount || 0);
      const lineTax = lineSub * Number(l.tax_rate || 0);
      subtotal += lineSub; tax += lineTax;
    });
    return { subtotal, tax, grand: subtotal + tax };
  }, [form.lines]);

  // Phase 9B: collect item_ids for vendor comparison panel
  const selectedItemIds = useMemo(
    () => form.lines.map(l => l.item_id).filter(Boolean),
    [form.lines],
  );

  function applyVendorPriceToLine(vendorId, item, vendor) {
    setForm(f => {
      const lines = f.lines.map(ln => {
        if (ln.item_id === item.item_id) {
          return { ...ln, unit_cost: vendor.last_unit_cost };
        }
        return ln;
      });
      // also set vendor on form if not yet picked
      const v = vendors.find(x => x.id === vendorId);
      return {
        ...f,
        lines,
        vendor_id: f.vendor_id || vendorId,
        vendor_name: f.vendor_name || (v?.name || ""),
      };
    });
    toast.success(`${vendor.vendor_name}: harga ${fmtRp(vendor.last_unit_cost)} diterapkan`);
  }

  async function save() {
    if (!form.vendor_id) { toast.error("Vendor wajib"); return; }
    if (form.lines.length === 0 || form.lines.some(l => !l.item_name || !l.qty)) {
      toast.error("Lengkapi line items"); return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor_id: form.vendor_id,
        outlet_id: form.outlet_id || null,
        pr_ids: form.pr_ids || [],
        order_date: form.order_date,
        expected_delivery_date: form.expected_delivery_date || null,
        payment_terms_days: Number(form.payment_terms_days || 30),
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty: Number(l.qty), unit: l.unit,
          unit_cost: Number(l.unit_cost || 0),
          discount: Number(l.discount || 0),
          tax_rate: Number(l.tax_rate || 0),
        })),
        notes: form.notes,
      };
      const res = await api.post("/procurement/pos", payload);
      const po = unwrap(res);
      toast.success("PO dibuat");
      navigate(`/procurement/po/${po.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally { setSaving(false); }
  }

  return (
    <>
    <div className="space-y-5 max-w-7xl mx-auto" data-testid="po-form-page">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2" data-testid="po-back">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">PO Baru</h2>
        <div className="ml-auto">
          <Button onClick={save} disabled={saving} className="rounded-full pill-active gap-2" data-testid="po-save">
            <Save className="h-4 w-4" /> {saving ? "…" : "Simpan"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* MAIN COLUMN */}
        <div className="space-y-5 xl:col-span-2">

      <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="po-form-header-card">
        <div className="md:col-span-2">
          <Label className="text-xs uppercase text-muted-foreground">Vendor *</Label>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1">
              <VendorAutocomplete
                value={form.vendor_name}
                onChange={v => setForm(f => ({ ...f, vendor_name: v, vendor_id: null }))}
                onSelect={v => setForm(f => ({ ...f, vendor_name: v.name, vendor_id: v.id }))}
                placeholder="Cari vendor…"
                dataTestId="po-vendor"
              />
            </div>
            {can("ai.vendor_recommend.use") && (form.lines || []).some(l => l.item_id) && (
              <AIVendorRecommendationModal
                itemId={(form.lines || []).find(l => l.item_id)?.item_id}
                triggerLabel="Rekomendasi"
                onSelect={(c) => {
                  setForm(f => ({ ...f, vendor_id: c.vendor_id, vendor_name: c.vendor_name }));
                  toast.success(`Vendor "${c.vendor_name}" dipilih dari rekomendasi.`);
                }}
              />
            )}
            {can("ai.vendor_recommend.use") && fromPRIds.length > 0 && (
              <AIVendorRecommendationModal
                prId={fromPRIds[0]}
                triggerLabel="Rekomendasi PR"
                onSelect={(c) => {
                  setForm(f => ({ ...f, vendor_id: c.vendor_id, vendor_name: c.vendor_name }));
                  toast.success(`Vendor "${c.vendor_name}" dipilih dari konsensus PR.`);
                }}
              />
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Delivery Outlet</Label>
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
              placeholder="Central / Belum ditentukan"
              data-testid="po-outlet"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Order Date</Label>
          <Input type="date" value={form.order_date}
            onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
            className="glass-input mt-1" data-testid="po-order-date" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Expected Delivery</Label>
          <Input type="date" value={form.expected_delivery_date}
            onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))}
            className="glass-input mt-1" data-testid="po-expected-delivery" />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Payment Terms (hari)</Label>
          <Input type="number" min="0" value={form.payment_terms_days}
            onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))}
            className="glass-input mt-1" data-testid="po-payment-terms" />
        </div>
      </div>

      {form.pr_ids.length > 0 && (
        <div className="glass-card p-4 text-sm" data-testid="po-source-prs">
          <strong>Source PR:</strong>{" "}
          {form.pr_ids.map(p => <code key={p} className="text-xs mr-2">{p.slice(0, 8)}</code>)}
        </div>
      )}

      <div className="glass-card p-5" data-testid="po-lines-card">
        <div className="flex items-center justify-between mb-3" data-testid="po-lines-toolbar">
          <h3 className="font-semibold">Line Items</h3>
          <Button onClick={addLine} variant="outline" size="sm" className="rounded-full gap-1" data-testid="po-add-line">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </div>
        <DataTable
          rows={form.lines.map((ln, i) => ({ ...ln, _idx: i }))}
          keyField="_idx"
          loading={loadingCatalog}
          loadingRows={2}
          stickyHeader={false}
          rowTestIdPrefix="po-line-row"
          rowClassName={(ln) => (ln.item_id && vendorCatalog[ln.item_id]?.availability_status === "unavailable") ? "bg-red-50" : ""}
          empty={<EmptyState title="Belum ada item" description="Tambah line item untuk Purchase Order." />}
          columns={[
            { key: "item", label: "Item", primary: true, className: "min-w-[220px]",
              render: (ln) => {
                const i = ln._idx;
                const vendorItem = ln.item_id ? vendorCatalog[ln.item_id] : null;
                const isUnavailable = vendorItem?.availability_status === "unavailable";
                const refPrice = ln.ref_price || vendorItem?.ref_price;
                const deviation = refPrice && ln.unit_cost > 0 ? ((ln.unit_cost - refPrice) / refPrice) * 100 : null;
                return (
                  <div>
                    <ItemAutocomplete
                      value={ln.item_name}
                      onChange={v => setLine(i, "item_name", v)}
                      onSelect={async (it) => {
                        let ref = null;
                        try {
                          const refRes = await api.get(`/market-list/items/${it.id}/ref-price`);
                          ref = refRes.data.data;
                        } catch (_) {}
                        setForm(f => {
                          const lines = [...f.lines];
                          const vi = vendorCatalog[it.id];
                          lines[i] = {
                            ...lines[i], item_name: it.name, item_id: it.id,
                            unit: it.unit || lines[i].unit,
                            unit_cost: vi?.current_price || (it.last_price ?? lines[i].unit_cost),
                            ref_price: ref?.ref_price || null,
                            ref_quarter: ref?.quarter_label || null,
                            availability_status: vi?.availability_status || null,
                          };
                          return { ...f, lines };
                        });
                      }}
                      dataTestId={`po-line-item-${i}`}
                    />
                    {ln.ref_price && (
                      <div className="text-xs mt-0.5 flex items-center gap-1">
                        <span className="text-blue-600">Ref {ln.ref_quarter}: Rp {fmt(ln.ref_price)}</span>
                        {deviation != null && (
                          <span className={`font-semibold ${Math.abs(deviation) > 10 ? "text-red-600" : deviation > 0 ? "text-orange-600" : "text-green-600"}`}>
                            ({deviation > 0 ? "+" : ""}{deviation.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    )}
                    {isUnavailable && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />Tidak tersedia dari vendor ini
                        </span>
                        <Button size="sm" variant="ghost" className="h-5 text-xs text-blue-600 hover:text-blue-800 px-1" onClick={() => openAltVendor(i)}>
                          Cari Alt. Vendor →
                        </Button>
                      </div>
                    )}
                    {ln._needs_split && (
                      <div className="text-xs mt-1 text-orange-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Split ke: <strong>{ln._alt_vendor_name}</strong>
                        <span className="text-gray-400">(PO terpisah)</span>
                      </div>
                    )}
                    {vendorItem && !isUnavailable && vendorItem.current_price > 0 && !ln._needs_split && (
                      <div className="text-xs mt-0.5 text-green-600">
                        Harga vendor: Rp {fmt(vendorItem.current_price)}
                        {vendorItem.last_gr_date && <span className="text-gray-400 ml-1">(GR {vendorItem.last_gr_date})</span>}
                      </div>
                    )}
                  </div>
                );
              } },
            { key: "qty", label: "Qty", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.qty} onChange={e => setLine(ln._idx, "qty", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-20" data-testid={`po-line-qty-${ln._idx}`} />
              ) },
            { key: "unit", label: "Unit",
              render: (ln) => (
                <Input value={ln.unit} onChange={e => setLine(ln._idx, "unit", e.target.value)} className="glass-input h-9 w-20" data-testid={`po-line-unit-${ln._idx}`} />
              ) },
            { key: "unit_cost", label: "Unit Cost", numeric: true,
              render: (ln) => {
                const i = ln._idx;
                const vendorItem = ln.item_id ? vendorCatalog[ln.item_id] : null;
                return (
                  <div className="relative group">
                    <Input type="number" min="0" value={ln.unit_cost} onChange={e => setLine(i, "unit_cost", e.target.value)}
                      className="glass-input h-9 text-right tabular-nums w-32" data-testid={`po-line-unit-cost-${i}`} />
                    {vendorItem?.last_unit_cost && (
                      <div className="absolute hidden group-hover:block z-50 bottom-full right-0 mb-1 w-56 bg-gray-900 text-white rounded-lg shadow-xl p-3 text-xs text-left">
                        <div className="font-semibold mb-2">Vendor Price Info</div>
                        <div className="space-y-1 text-gray-200">
                          <div className="flex justify-between"><span>Last PO:</span><span className="font-medium">Rp {fmt(vendorItem.last_unit_cost)}</span></div>
                          {vendorItem.last_gr_date && (
                            <div className="flex justify-between text-xs text-gray-400"><span>Date:</span><span>{vendorItem.last_gr_date}</span></div>
                          )}
                          {ln.unit_cost > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="flex justify-between">
                                <span>Change:</span>
                                <span className={`font-semibold ${ln.unit_cost > vendorItem.last_unit_cost ? 'text-red-400' : ln.unit_cost < vendorItem.last_unit_cost ? 'text-green-400' : 'text-gray-300'}`}>
                                  {ln.unit_cost > vendorItem.last_unit_cost ? '+' : ln.unit_cost < vendorItem.last_unit_cost ? '' : ''}
                                  {((ln.unit_cost - vendorItem.last_unit_cost) / vendorItem.last_unit_cost * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              } },
            { key: "discount", label: "Disc", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.discount} onChange={e => setLine(ln._idx, "discount", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-24" data-testid={`po-line-discount-${ln._idx}`} />
              ) },
            { key: "tax_rate", label: "Tax%", numeric: true,
              render: (ln) => (
                <Input type="number" step="0.01" min="0" value={ln.tax_rate} onChange={e => setLine(ln._idx, "tax_rate", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-20" data-testid={`po-line-tax-${ln._idx}`} />
              ) },
            { key: "subtotal", label: "Subtotal", numeric: true,
              render: (ln) => {
                const sub = Number(ln.qty || 0) * Number(ln.unit_cost || 0) - Number(ln.discount || 0);
                const total = sub * (1 + Number(ln.tax_rate || 0));
                return <span className="font-medium" data-testid={`po-line-subtotal-${ln._idx}`}>{fmtRp(total)}</span>;
              } },
          ]}
          rowAction={(ln) => {
            const i = ln._idx;
            const vendorItem = ln.item_id ? vendorCatalog[ln.item_id] : null;
            const isUnavailable = vendorItem?.availability_status === "unavailable";
            return (
              <div className="flex gap-1 justify-end">
                {ln.item_id && form.vendor_id && !isUnavailable && (
                  <button onClick={() => handleMarkUnavailable(i, ln.item_id)}
                    className="h-9 w-9 rounded-lg hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400" title="Tandai tidak tersedia">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                )}
                {ln.item_id && isUnavailable && (
                  <button onClick={() => openAltVendor(i)}
                    className="h-9 w-9 rounded-lg hover:bg-blue-50 hover:text-blue-500 flex items-center justify-center text-orange-500" title="Cari vendor alternatif">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => removeLine(i)} className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center" data-testid={`po-line-remove-${i}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }}
        />
        <div className="mt-4 max-w-sm ml-auto space-y-1.5 text-sm" data-testid="po-totals">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums" data-testid="po-subtotal">{fmtRp(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums" data-testid="po-tax">{fmtRp(totals.tax)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50 text-base font-bold"><span>Grand Total</span><span className="tabular-nums" data-testid="po-grand-total">{fmtRp(totals.grand)}</span></div>
        </div>
      </div>

      <div className="glass-card p-5" data-testid="po-notes-card">
        <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
        <Textarea value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="glass-input mt-1 min-h-[80px]" data-testid="po-notes" />
      </div>
        </div>
        {/* /MAIN COLUMN */}

        {/* RIGHT COLUMN — Vendor Comparison Panel */}
        <div className="xl:col-span-1">
          <div className="xl:sticky xl:top-4">
            <VendorComparisonPanel
              itemIds={selectedItemIds}
              days={180}
              compact
              onSelectVendor={applyVendorPriceToLine}
            />
          </div>
        </div>
      </div>
    </div>

    {/* Alternative Vendor Modal */}
    <Dialog open={showAltVendor} onOpenChange={setShowAltVendor}>
      <DialogContent className="max-w-lg" data-testid="po-alt-vendor-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Cari Vendor Alternatif
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {altVendorLineIdx !== null && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm" data-testid="po-alt-context">
              <strong>{form.lines[altVendorLineIdx]?.item_name}</strong> tidak tersedia dari{" "}
              <strong>{form.vendor_name}</strong>. Pilih vendor alternatif:
            </div>
          )}
          {loadingAlt ? (
            <div className="text-center py-6 text-gray-400" data-testid="po-alt-loading">Mencari vendor alternatif...</div>
          ) : altVendors.length === 0 ? (
            <div className="text-center py-6 text-gray-400" data-testid="po-alt-empty">
              <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <div>Tidak ada vendor lain yang menyuplai item ini</div>
              <div className="text-xs mt-1">Pertimbangkan Urgent Purchase atau tambah vendor baru</div>
            </div>
          ) : altVendors.map(v => (
            <div key={v.vendor_id} className="flex items-center justify-between p-3 border rounded-lg mb-2 hover:bg-blue-50 cursor-pointer" onClick={() => selectAltVendorForLine(v)}
              data-testid={`po-alt-vendor-${v.vendor_id}`}>
              <div>
                <div className="font-medium text-sm">{v.vendor_name}</div>
                <div className="text-xs text-gray-500">{v.vendor_code}</div>
                {v.ref_price && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Ref: Rp {fmt(v.ref_price)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {v.current_price > 0 ? `Rp ${fmt(v.current_price)}` : "Harga belum ada"}
                </div>
                {v.deviation_pct != null && (
                  <div className={`text-xs font-medium ${v.deviation_pct > 10 ? "text-red-600" : v.deviation_pct < 0 ? "text-green-600" : "text-orange-600"}`}>
                    {v.deviation_pct > 0 ? "+" : ""}{v.deviation_pct.toFixed(1)}% vs ref
                  </div>
                )}
                <div className={`text-xs mt-0.5 ${v.availability_status === "available" ? "text-green-600" : "text-red-600"}`}>
                  {v.availability_status === "available" ? "✓ Tersedia" : "✗ Tidak Tersedia"}
                </div>
              </div>
            </div>
          ))}
          <div className="mt-4 pt-3 border-t flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAltVendor(false)} data-testid="po-alt-cancel">
              Batal
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
              data-testid="po-alt-return-pr"
              onClick={() => {
                toast.info("Item akan dikembalikan ke PR pool untuk diproses terpisah");
                removeLine(altVendorLineIdx);
                setShowAltVendor(false);
              }}
            >
              Cancel & Kembalikan ke PR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
