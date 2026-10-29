/** POForm/index.jsx — purchase order form. */
/** PO Form — create new Purchase Order. Optionally seed from approved PR.
 *  Phase 9B: Adds VendorComparisonPanel right-rail when items selected.
 *  Phase 9D: Adds AI Vendor Recommendation modal trigger near vendor field.
 *  Smart Procurement: Adds vendor availability check, market ref price, alt vendor suggestion.
 *  Outlet Scope: auto-selects user default outlet; restricted staff see only their outlets. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle, XCircle, ChevronRight, FileCheck } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import { FormActionBar, useDirtyState, confirmDiscard } from "@/components/shared/UnsavedChanges";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import VendorComparisonPanel from "@/components/shared/VendorComparisonPanel";
import OutletScopePicker from "@/components/shared/OutletScopePicker";
import useOutletScope from "@/hooks/useOutletScope";
import useOutletScopeGuard from "@/hooks/useOutletScopeGuard";
import { AIVendorRecommendationModal } from "@/components/shared/AIVendorRecommendation";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, todayJakartaISO, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

import { fetchAll } from "@/lib/api";
const fmt = (n) => fmtNumber(n); // DUP-10: shared formatter

export default function POForm() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const fromPRIds = search.getAll("pr");
  const qVendorId = search.get("vendor_id") || "";
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

  const { dirty, markSaved } = useDirtyState(form);

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
    fetchAll("/master/vendors")
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

  // Prefill dari PR Consolidation: ?prefill=<base64 JSON {lines, pr_ids, note}>
  // (sebelumnya param ini dikirim tapi tidak pernah dibaca → form PO kosong)
  useEffect(() => {
    const raw = search.get("prefill");
    if (!raw) return;
    let data = null;
    try { data = JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch { data = null; }
    if (!data || !Array.isArray(data.lines) || data.lines.length === 0) return;
    setForm(f => ({
      ...f,
      pr_ids: Array.isArray(data.pr_ids) ? data.pr_ids : f.pr_ids,
      notes: data.note || f.notes,
      lines: data.lines.map(l => ({
        item_name: l.item_name || "", item_id: l.item_id || null,
        qty: Number(l.qty || 1), unit: l.unit || "pcs",
        unit_cost: Number(l.unit_cost || 0),
        discount: 0, tax_rate: 0,
        availability_status: null, ref_price: null, ref_quarter: null,
      })),
    }));
    toast.success(`Form PO diisi dari konsolidasi (${data.lines.length} item)`);
  }, []); // eslint-disable-line

  // Deep-link dari Vendor Recommendation: ?vendor_id=<id> memilih vendor otomatis
  useEffect(() => {
    if (!qVendorId || form.vendor_id) return;
    const v = vendors.find(x => x.id === qVendorId);
    if (v) setForm(f => ({ ...f, vendor_id: v.id, vendor_name: v.name }));
  }, [qVendorId, vendors]); // eslint-disable-line

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
      markSaved();
      navigate(`/procurement/po/${po.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally { setSaving(false); }
  }

  return (
    <>
    <div className="space-y-3 lg:space-y-4 max-w-7xl mx-auto" data-testid="po-form-page">
      <div>
        <Button variant="ghost" size="sm" onClick={async () => { if (await confirmDiscard()) navigate(-1); }} className="-ml-2 mb-1" data-testid="po-back">
          <ArrowLeft /> Kembali
        </Button>
        <PageHeader
          icon={FileCheck}
          title="PO Baru"
          subtitle="Pilih vendor, isi item & harga. PO tersimpan sebagai draft sebelum diajukan/dikirim."
          className="mb-0 md:mb-0"
        />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-3 lg:gap-4">
        {/* MAIN COLUMN */}
        <div className="space-y-3 lg:space-y-4 2xl:col-span-2">

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4" data-testid="po-form-header-card">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs md:text-sm font-medium">Vendor *</Label>
          <div className="flex items-center gap-2">
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
        <div className="space-y-1">
          <Label className="text-xs md:text-sm font-medium">Outlet tujuan</Label>
          <div>
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
              className="[&>button]:min-w-0 [&>button]:flex-1"
              data-testid="po-outlet"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="po-order-date" className="text-xs md:text-sm font-medium">Tanggal order</Label>
          <Input id="po-order-date" type="date" value={form.order_date}
            onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
            className="glass-input" data-testid="po-order-date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="po-expected-delivery" className="text-xs md:text-sm font-medium">Estimasi tiba</Label>
          <Input id="po-expected-delivery" type="date" value={form.expected_delivery_date}
            onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))}
            className="glass-input" data-testid="po-expected-delivery" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="po-payment-terms" className="text-xs md:text-sm font-medium">Termin pembayaran (hari)</Label>
          <Input id="po-payment-terms" type="number" min="0" value={form.payment_terms_days}
            onChange={e => setForm(f => ({ ...f, payment_terms_days: e.target.value }))}
            className="glass-input" data-testid="po-payment-terms" />
        </div>
      </div>

      {form.pr_ids.length > 0 && (
        <div className="glass-card p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="po-source-prs">
          <span className="font-medium">Dari {form.pr_ids.length} PR:</span>
          {form.pr_ids.map(p => (
            <Link key={p} to={`/procurement/pr/${p}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline" data-testid={`po-source-pr-${p}`}>
              PR {p.slice(0, 8)}
            </Link>
          ))}
        </div>
      )}

      <div className="glass-card p-4" data-testid="po-lines-card">
        <div className="flex items-center justify-between mb-3" data-testid="po-lines-toolbar">
          <h3 className="text-sm md:text-base font-semibold">Item</h3>
          <Button onClick={addLine} variant="outline" size="sm" data-testid="po-add-line">
            <Plus /> Tambah item
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
                        <span className="text-blue-700 dark:text-blue-400">Ref {ln.ref_quarter}: Rp {fmt(ln.ref_price)}</span>
                        {deviation != null && (
                          <span className={`font-semibold ${Math.abs(deviation) > 10 ? "text-red-700 dark:text-red-400" : deviation > 0 ? "text-orange-800 dark:text-orange-400" : "text-green-700 dark:text-green-400"}`}>
                            ({deviation > 0 ? "+" : ""}{deviation.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    )}
                    {isUnavailable && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />Tidak tersedia dari vendor ini
                        </span>
                        <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => openAltVendor(i)} data-testid={`po-line-alt-link-${i}`}>
                          Cari vendor alternatif
                        </Button>
                      </div>
                    )}
                    {ln._needs_split && (
                      <div className="text-xs mt-1 text-orange-800 dark:text-orange-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Split ke: <strong>{ln._alt_vendor_name}</strong>
                        <span className="text-muted-foreground">(PO terpisah)</span>
                      </div>
                    )}
                    {vendorItem && !isUnavailable && vendorItem.current_price > 0 && !ln._needs_split && (
                      <div className="text-xs mt-0.5 text-green-700 dark:text-green-400">
                        Harga vendor: Rp {fmt(vendorItem.current_price)}
                        {vendorItem.last_gr_date && <span className="text-muted-foreground ml-1">(GR {vendorItem.last_gr_date})</span>}
                      </div>
                    )}
                  </div>
                );
              } },
            { key: "qty", label: "Qty", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.qty} aria-label={`Qty baris ${ln._idx + 1}`} onChange={e => setLine(ln._idx, "qty", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-20" data-testid={`po-line-qty-${ln._idx}`} />
              ) },
            { key: "unit", label: "Unit",
              render: (ln) => (
                <Input value={ln.unit} aria-label={`Unit baris ${ln._idx + 1}`} onChange={e => setLine(ln._idx, "unit", e.target.value)} className="glass-input h-9 w-20" data-testid={`po-line-unit-${ln._idx}`} />
              ) },
            { key: "unit_cost", label: "Harga satuan", numeric: true,
              render: (ln) => {
                const i = ln._idx;
                const vendorItem = ln.item_id ? vendorCatalog[ln.item_id] : null;
                return (
                  <div className="relative group">
                    <Input type="number" min="0" value={ln.unit_cost} aria-label={`Harga satuan baris ${i + 1}`} onChange={e => setLine(i, "unit_cost", e.target.value)}
                      className="glass-input h-9 text-right tabular-nums w-32" data-testid={`po-line-unit-cost-${i}`} />
                    {vendorItem?.last_unit_cost && (
                      <div className="absolute hidden group-hover:block z-50 bottom-full right-0 mb-1 w-56 bg-foreground text-background rounded-lg shadow-xl p-3 text-xs text-left">
                        <div className="font-semibold mb-2">Vendor Price Info</div>
                        <div className="space-y-1 text-background/80">
                          <div className="flex justify-between"><span>Last PO:</span><span className="font-medium">Rp {fmt(vendorItem.last_unit_cost)}</span></div>
                          {vendorItem.last_gr_date && (
                            <div className="flex justify-between text-xs text-muted-foreground"><span>Date:</span><span>{vendorItem.last_gr_date}</span></div>
                          )}
                          {ln.unit_cost > 0 && (
                            <div className="mt-2 pt-2 border-t border-background/20">
                              <div className="flex justify-between">
                                <span>Change:</span>
                                <span className={`font-semibold ${ln.unit_cost > vendorItem.last_unit_cost ? 'text-red-700 dark:text-red-400' : ln.unit_cost < vendorItem.last_unit_cost ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
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
            { key: "discount", label: "Diskon", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.discount} aria-label={`Diskon baris ${ln._idx + 1}`} onChange={e => setLine(ln._idx, "discount", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-24" data-testid={`po-line-discount-${ln._idx}`} />
              ) },
            { key: "tax_rate", label: "Pajak", numeric: true,
              render: (ln) => (
                <Input type="number" step="0.01" min="0" value={ln.tax_rate} aria-label={`Tarif pajak baris ${ln._idx + 1}`} onChange={e => setLine(ln._idx, "tax_rate", e.target.value)}
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
                  <Button variant="ghost" size="icon-sm" onClick={() => handleMarkUnavailable(i, ln.item_id)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Tandai tidak tersedia" aria-label={`Tandai item baris ${i + 1} tidak tersedia dari vendor`}
                    data-testid={`po-line-unavailable-${i}`}>
                    <XCircle />
                  </Button>
                )}
                {ln.item_id && isUnavailable && (
                  <Button variant="ghost" size="icon-sm" onClick={() => openAltVendor(i)}
                    className="text-orange-800 dark:text-orange-400"
                    title="Cari vendor alternatif" aria-label={`Cari vendor alternatif untuk baris ${i + 1}`}
                    data-testid={`po-line-alt-${i}`}>
                    <ChevronRight />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={() => removeLine(i)}
                  className="hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Hapus baris ${i + 1}`}
                  data-testid={`po-line-remove-${i}`}>
                  <Trash2 />
                </Button>
              </div>
            );
          }}
        />
        <div className="mt-4 max-w-sm ml-auto space-y-1.5 text-sm" data-testid="po-totals">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums" data-testid="po-subtotal">{fmtRp(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span className="tabular-nums" data-testid="po-tax">{fmtRp(totals.tax)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50 text-base font-semibold"><span>Grand Total</span><span className="tabular-nums" data-testid="po-grand-total">{fmtRp(totals.grand)}</span></div>
        </div>
      </div>

      <div className="glass-card p-4 space-y-1" data-testid="po-notes-card">
        <Label htmlFor="po-notes" className="text-xs md:text-sm font-medium">Catatan</Label>
        <Textarea id="po-notes" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="glass-input min-h-[80px]" data-testid="po-notes" />
      </div>
        </div>
        {/* /MAIN COLUMN */}

        {/* RIGHT COLUMN — Vendor Comparison Panel */}
        <div className="2xl:col-span-1">
          <div className="2xl:sticky 2xl:top-4">
            <VendorComparisonPanel
              itemIds={selectedItemIds}
              days={180}
              compact
              onSelectVendor={applyVendorPriceToLine}
            />
          </div>
        </div>
      </div>

      {/* Simpan selalu terlihat di bawah form (DESIGN_SYSTEM §10.4). */}
      <FormActionBar dirty={dirty} hint="PO tersimpan sebagai draft sebelum diajukan/dikirim.">
        <Button onClick={save} disabled={saving} data-testid="po-save">
          <Save /> {saving ? "Menyimpan…" : "Simpan PO"}
        </Button>
      </FormActionBar>
    </div>

    {/* Alternative Vendor Modal */}
    <Dialog open={showAltVendor} onOpenChange={setShowAltVendor}>
      <DialogContent className="max-w-lg" data-testid="po-alt-vendor-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-800 dark:text-orange-400" />
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
            <div className="text-center py-6 text-muted-foreground" data-testid="po-alt-loading">Mencari vendor alternatif...</div>
          ) : altVendors.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="po-alt-empty">
              <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <div>Tidak ada vendor lain yang menyuplai item ini</div>
              <div className="text-xs mt-1">Pertimbangkan Urgent Purchase atau tambah vendor baru</div>
            </div>
          ) : altVendors.map(v => (
            <div key={v.vendor_id} className="flex items-center justify-between p-3 border rounded-lg mb-2 hover:bg-blue-50 cursor-pointer" onClick={() => selectAltVendorForLine(v)}
              data-testid={`po-alt-vendor-${v.vendor_id}`}>
              <div>
                <div className="font-medium text-sm">{v.vendor_name}</div>
                <div className="text-xs text-muted-foreground">{v.vendor_code}</div>
                {v.ref_price && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Ref: Rp {fmt(v.ref_price)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {v.current_price > 0 ? `Rp ${fmt(v.current_price)}` : "Harga belum ada"}
                </div>
                {v.deviation_pct != null && (
                  <div className={`text-xs font-medium ${v.deviation_pct > 10 ? "text-red-700 dark:text-red-400" : v.deviation_pct < 0 ? "text-green-700 dark:text-green-400" : "text-orange-800 dark:text-orange-400"}`}>
                    {v.deviation_pct > 0 ? "+" : ""}{v.deviation_pct.toFixed(1)}% vs ref
                  </div>
                )}
                <div className={`text-xs mt-0.5 ${v.availability_status === "available" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
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
              className="flex-1 border-orange-300 dark:border-orange-500/30 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
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
