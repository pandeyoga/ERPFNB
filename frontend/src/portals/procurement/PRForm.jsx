/** PR Form — create new Purchase Request.
 *  Phase 9C: supports `?prefill=<base64-json>` query param (from Low Stock Alert).
 *  Phase 9D: AI Vendor Recommendation per-line + consensus panel.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Send, Plus, Trash2, Sparkles, FileText } from "lucide-react";
import api, { unwrap, fetchAll } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import PageHeader from "@/components/shared/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { AIVendorRecommendationModal } from "@/components/shared/AIVendorRecommendation";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

function decodePrefill(s) {
  try {
    const json = decodeURIComponent(escape(atob(s)));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export default function PRForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, can } = useAuth();
  const { scopedOutlets, allOutlets, loaded } = useOutletScope();
  const outlets = allOutlets; // FIX: Get outlets from hook
  const [brands, setBrands] = useState([]);
  const [saving, setSaving] = useState(false);
  const [prefillBanner, setPrefillBanner] = useState(null);
  const [form, setForm] = useState({
    outlet_id: "", brand_id: "", source: "manual",
    request_date: todayJakartaISO(), needed_by: "",
    lines: [{ item_name: "", item_id: null, qty: 1, unit: "pcs", est_cost: 0, notes: "" }],
    notes: "",
  });

  // ---- Apply prefill from URL once ----
  useEffect(() => {
    const raw = searchParams.get("prefill");
    if (!raw) return;
    const data = decodePrefill(raw);
    if (!data || !Array.isArray(data.lines) || data.lines.length === 0) return;
    setForm(f => ({
      ...f,
      outlet_id: data.outlet_id || f.outlet_id,
      source: data.source === "low_stock" ? "manual" : (data.source || f.source),
      lines: data.lines.map(l => ({
        item_id: l.item_id || null,
        item_name: l.item_name || "",
        qty: Number(l.qty || 1),
        unit: l.unit || "pcs",
        est_cost: Number(l.unit_cost || 0),
        notes: "",
      })),
      notes: data.note || f.notes,
    }));
    setPrefillBanner({
      source: data.source,
      lines_count: data.lines.length,
    });
    toast.success(`Form di-prefill dari ${data.source === "low_stock" ? "Low Stock Alert" : "halaman lain"} (${data.lines.length} item)`);
  }, [searchParams]);

  // Opsi Brand (sebelumnya tidak pernah dimuat → dropdown selalu kosong)
  useEffect(() => {
    fetchAll("/master/brands", { active: true })
      .then(r => setBrands(unwrap(r) || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (form.outlet_id) return;
    const userOutlets = user?.outlet_ids || [];
    if (userOutlets.length === 1) setForm(f => ({ ...f, outlet_id: userOutlets[0] }));
  }, [user]); // eslint-disable-line

  const userOutlets = useMemo(() => {
    if ((user?.permissions || []).includes("*")) return outlets;
    const ids = new Set(user?.outlet_ids || []);
    return outlets.filter(o => ids.has(o.id));
  }, [outlets, user]);

  const totalEst = form.lines.reduce(
    (s, ln) => s + Number(ln.qty || 0) * Number(ln.est_cost || 0), 0,
  );

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({
      ...f, lines: [...f.lines, { item_name: "", item_id: null, qty: 1, unit: "pcs", est_cost: 0, notes: "" }],
    }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  async function save(submit = false) {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    if (form.lines.some(l => !l.item_name || !l.qty)) {
      toast.error("Lengkapi semua line item"); return;
    }
    setSaving(true);
    try {
      const payload = {
        outlet_id: form.outlet_id,
        brand_id: form.brand_id || null,
        source: form.source,
        request_date: form.request_date,
        needed_by: form.needed_by || null,
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty: Number(l.qty), unit: l.unit,
          est_cost: Number(l.est_cost || 0), notes: l.notes,
        })),
        notes: form.notes,
        status: submit ? "submitted" : "draft",
      };
      const res = await api.post("/procurement/prs", payload);
      const pr = unwrap(res);
      toast.success(submit ? "PR di-submit" : "Draft PR disimpan");
      navigate(`/procurement/pr/${pr.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 lg:space-y-4 max-w-5xl mx-auto" data-testid="pr-form-page">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-1" data-testid="pr-back">
          <ArrowLeft /> Kembali
        </Button>
        <PageHeader
          icon={FileText}
          title="PR Baru"
          subtitle="Ajukan permintaan pembelian. Simpan sebagai draft atau langsung ajukan untuk approval."
          className="mb-0 md:mb-0"
          actions={
            <>
              <Button onClick={() => save(false)} disabled={saving} variant="outline" data-testid="pr-save-draft">
                <Save /> Simpan draft
              </Button>
              <Button onClick={() => save(true)} disabled={saving} data-testid="pr-submit">
                <Send /> Ajukan PR
              </Button>
            </>
          }
        />
      </div>

      {prefillBanner && (
        <div className="glass-card p-3 bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2"
             data-testid="pr-prefill-banner">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <b>Form di-prefill</b> dari {prefillBanner.source === "low_stock" ? "Low Stock Alert" : "halaman terkait"} —
            {" "}{prefillBanner.lines_count} item siap di-review. Sesuaikan qty/cost sebelum submit.
          </div>
        </div>
      )}

      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4" data-testid="pr-form-header-card">
        <div className="space-y-1">
          <Label className="text-xs md:text-sm font-medium">Outlet *</Label>
          <SimpleSelect
            value={form.outlet_id}
            onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v }))}
            options={[{ value: "", label: "Pilih outlet" }, ...userOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Pilih outlet"
            ariaLabel="Outlet"
            className="glass-input w-full"
            testId="pr-outlet"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs md:text-sm font-medium">Brand</Label>
          <SimpleSelect
            value={form.brand_id}
            onValueChange={(v) => setForm(f => ({ ...f, brand_id: v }))}
            options={[{ value: "", label: "Tanpa brand (opsional)" }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
            placeholder="Tanpa brand (opsional)"
            ariaLabel="Brand"
            className="glass-input w-full"
            testId="pr-brand"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs md:text-sm font-medium">Source</Label>
          <SimpleSelect
            value={form.source}
            onValueChange={(v) => setForm(f => ({ ...f, source: v }))}
            options={[
              { value: "manual", label: "Manual" },
              { value: "KDO", label: "KDO (Kebutuhan Direksi/Operasional)" },
              { value: "BDO", label: "BDO (Bahan Direksi/Operasional)" },
            ]}
            ariaLabel="Source"
            className="glass-input w-full"
            testId="pr-source"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-request-date" className="text-xs md:text-sm font-medium">Tanggal request</Label>
          <Input id="pr-request-date" type="date" value={form.request_date}
            onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))}
            className="glass-input" data-testid="pr-request-date" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-needed-by" className="text-xs md:text-sm font-medium">Dibutuhkan tanggal</Label>
          <Input id="pr-needed-by" type="date" value={form.needed_by}
            onChange={e => setForm(f => ({ ...f, needed_by: e.target.value }))}
            className="glass-input" data-testid="pr-needed-by" />
        </div>
      </div>

      <div className="glass-card p-4" data-testid="pr-lines-card">
        <div className="flex items-center justify-between mb-3" data-testid="pr-lines-toolbar">
          <h3 className="text-sm md:text-base font-semibold">Item yang diminta</h3>
          <Button onClick={addLine} variant="outline" size="sm" data-testid="pr-add-line">
            <Plus /> Tambah item
          </Button>
        </div>
        <DataTable
          rows={form.lines.map((ln, i) => ({ ...ln, _idx: i }))}
          keyField="_idx"
          loading={!loaded}
          loadingRows={2}
          stickyHeader={false}
          rowTestIdPrefix="pr-line-row"
          empty={<EmptyState title="Belum ada item" description="Tambah line item untuk Purchase Request." />}
          columns={[
            { key: "item", label: "Item", primary: true,
              render: (ln) => (
                <ItemAutocomplete
                  value={ln.item_name}
                  onChange={v => setLine(ln._idx, "item_name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.lines];
                      lines[ln._idx] = {
                        ...lines[ln._idx],
                        item_name: it.name, item_id: it.id,
                        unit: it.unit || lines[ln._idx].unit,
                        est_cost: it.last_price ?? lines[ln._idx].est_cost,
                      };
                      return { ...f, lines };
                    });
                  }}
                  placeholder="Cari item…"
                  dataTestId={`pr-line-item-${ln._idx}`}
                />
              ) },
            { key: "qty", label: "Qty", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.qty}
                  aria-label={`Qty baris ${ln._idx + 1}`}
                  onChange={e => setLine(ln._idx, "qty", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-24"
                  data-testid={`pr-line-qty-${ln._idx}`} />
              ) },
            { key: "unit", label: "Unit",
              render: (ln) => (
                <Input value={ln.unit}
                  aria-label={`Unit baris ${ln._idx + 1}`}
                  onChange={e => setLine(ln._idx, "unit", e.target.value)}
                  className="glass-input h-9 w-20" data-testid={`pr-line-unit-${ln._idx}`} />
              ) },
            { key: "est_cost", label: "Est. harga", numeric: true,
              render: (ln) => (
                <Input type="number" min="0" value={ln.est_cost}
                  aria-label={`Estimasi harga baris ${ln._idx + 1}`}
                  onChange={e => setLine(ln._idx, "est_cost", e.target.value)}
                  className="glass-input h-9 text-right tabular-nums w-32" data-testid={`pr-line-est-cost-${ln._idx}`} />
              ) },
            { key: "subtotal", label: "Subtotal", numeric: true,
              render: (ln) => {
                const subtotal = Number(ln.qty || 0) * Number(ln.est_cost || 0);
                return <span className="font-medium" data-testid={`pr-line-subtotal-${ln._idx}`}>{fmtRp(subtotal)}</span>;
              } },
            { key: "notes", label: "Catatan",
              render: (ln) => (
                <Input value={ln.notes || ""}
                  aria-label={`Catatan baris ${ln._idx + 1}`}
                  onChange={e => setLine(ln._idx, "notes", e.target.value)}
                  className="glass-input h-9" placeholder="—" data-testid={`pr-line-notes-${ln._idx}`} />
              ) },
          ]}
          rowAction={(ln) => (
            <div className="flex items-center justify-end gap-1">
              {ln.item_id && can("ai.vendor_recommend.use") && (
                <AIVendorRecommendationModal
                  itemId={ln.item_id}
                  triggerLabel=""
                  onSelect={() => {
                    toast.info("Rekomendasi vendor dipilih — gunakan saat membuat PO dari PR ini.");
                  }}
                />
              )}
              <Button variant="ghost" size="icon-sm" onClick={() => removeLine(ln._idx)}
                className="hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Hapus baris ${ln._idx + 1}`}
                data-testid={`pr-line-remove-${ln._idx}`}>
                <Trash2 />
              </Button>
            </div>
          )}
          footer={
            <tr className="font-semibold" data-testid="pr-totals-row">
              <td colSpan={4} className="px-4 py-3 text-right">Total Estimasi</td>
              <td className="px-4 py-3 text-right tabular-nums" data-testid="pr-total-est">{fmtRp(totalEst)}</td>
              <td colSpan={2} />
            </tr>
          }
        />
      </div>

      <div className="glass-card p-4 space-y-1" data-testid="pr-notes-card">
        <Label htmlFor="pr-notes" className="text-xs md:text-sm font-medium">Catatan</Label>
        <Textarea id="pr-notes" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="glass-input min-h-[80px]" data-testid="pr-notes" />
      </div>
    </div>
  );
}
