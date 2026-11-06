/** Sourcing — komponen & helper bersama (hub /procurement/sourcing dan halaman item).
 *  Data: backend/routers/sourcing.py · analisis: docs/audit/MARKET_PRICE_SOURCING_ANALYSIS_2026-11-05.md
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { unwrap, fetchAll } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SimpleSelect from "@/components/shared/SimpleSelect";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";

export const PERIOD_OPTIONS = [
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "quarterly", label: "Kuartalan" },
];
export const PERIOD_LABEL = Object.fromEntries(PERIOD_OPTIONS.map((o) => [o.value, o.label]));

export const SOURCE_LABEL = {
  survey: "Survei pasar", offers_median: "Median penawaran", manual: "Input manual", import: "Impor",
  previous: "Periode sebelumnya", rfq: "RFQ", contract: "Kontrak",
};

/** Penanda analisis (urut prioritas tampil). Label = StatusPill. */
export const FLAG_ORDER = ["above_benchmark", "single_source", "no_benchmark", "stale_benchmark", "offer_expiring", "few_quotes", "saving"];

export function useSourcingPerms() {
  const { user } = useAuth();
  return {
    canBenchmark: permitted(user, "procurement.market_list.manage"),
    canOffers: permitted(user, "procurement.price_list.manage"),
    canSettings: permitted(user, "procurement.sourcing.settings"),
    canRfq: permitted(user, "procurement.rfq.create"),
  };
}

export function useRegions() {
  return useQuery({
    queryKey: ["master", "regions", "picker"],
    queryFn: async () => unwrap(await fetchAll("/master/regions", { active: true })) || [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useSourcingSettings() {
  return useQuery({
    queryKey: ["sourcing", "settings"],
    queryFn: async () => unwrap(await api.get("/sourcing/settings")),
    staleTime: 60 * 1000,
  });
}

/** Pemilih wilayah harga (bukan konteks Brand/Toko — wilayah adalah dimensi harga). */
export function RegionSelect({ value, onChange, testId = "sourcing-region", className = "w-48", allLabel = "Semua wilayah" }) {
  const { data: regions = [] } = useRegions();
  return (
    <SimpleSelect
      value={value || ""}
      onValueChange={(v) => onChange(v || "")}
      options={[{ value: "", label: allLabel }, ...regions.map((r) => ({ value: r.id, label: r.name }))]}
      ariaLabel="Wilayah harga"
      className={cn("glass-input", className)}
      testId={testId}
    />
  );
}

/** Selisih terhadap acuan: merah bila di atas ambang, hijau bila di bawah acuan. */
export function DeltaPct({ value, alert = 10, className }) {
  if (value === null || value === undefined) return null;
  const tone = value > alert ? "text-rose-700 dark:text-rose-400"
    : value < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground";
  return (
    <span className={cn("text-xs font-medium tabular-nums whitespace-nowrap", tone, className)}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}% vs acuan
    </span>
  );
}

export function PriceCell({ price, unit, sub, delta, alert }) {
  if (price === null || price === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <div className="font-medium tabular-nums whitespace-nowrap">{fmtRp(price)}<span className="text-xs text-muted-foreground font-normal">/{unit}</span></div>
      {sub && <div className="text-xs text-muted-foreground truncate" title={typeof sub === "string" ? sub : undefined}>{sub}</div>}
      {delta !== undefined && <DeltaPct value={delta} alert={alert} />}
    </div>
  );
}

/* ---------- Dialog penawaran supplier ---------- */
const today = () => new Date().toISOString().slice(0, 10);

export function OfferDialog({ open, onOpenChange, initial, fixedItem, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { data: vendors = [] } = useQuery({
    queryKey: ["master", "vendors", "picker"],
    queryFn: async () => unwrap(await fetchAll("/master/vendors", { active: true })) || [],
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...initial } : {
      item_id: fixedItem?.id || "", item_name: fixedItem?.name || "", unit: fixedItem?.unit_default || "",
      vendor_id: "", price: "", min_order_qty: "", lead_time_days: "", valid_from: today(), valid_to: "", region_id: "",
      source: "manual", source_ref: "", notes: "",
    });
  }, [open, initial, fixedItem]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.vendor_id || !form.item_id || !(Number(form.price) > 0)) {
      toast.error("Supplier, item, dan harga wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, price: Number(form.price), min_order_qty: Number(form.min_order_qty || 0),
        lead_time_days: Number(form.lead_time_days || 0), region_id: form.region_id || null, valid_to: form.valid_to || null };
      if (initial?.id) await api.put(`/sourcing/offers/${initial.id}`, body);
      else await api.post("/sourcing/offers", body);
      toast.success(initial?.id ? "Penawaran diperbarui" : "Penawaran ditambahkan");
      qc.invalidateQueries({ queryKey: ["sourcing"] });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menyimpan penawaran");
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="offer-dialog">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Penawaran" : "Tambah Penawaran"}</DialogTitle>
          <DialogDescription>Harga yang ditawarkan supplier dan masa berlakunya. Dipakai sebagai pembanding sebelum membeli.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Item</Label>
            {fixedItem || initial?.id ? (
              <div className="mt-1 text-sm font-medium" data-testid="offer-item-fixed">{form.item_name || fixedItem?.name}</div>
            ) : (
              <div className="mt-1">
                <ItemAutocomplete value={form.item_name || ""} onChange={(v) => set("item_name", v)}
                  onSelect={(it) => setForm((f) => ({ ...f, item_id: it.id, item_name: it.name, unit: it.unit || it.unit_default || f.unit }))}
                  dataTestId="offer-item" />
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Supplier</Label>
            <SimpleSelect value={form.vendor_id || ""} onValueChange={(v) => set("vendor_id", v)} disabled={!!initial?.id}
              options={[{ value: "", label: "— pilih supplier —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
              ariaLabel="Supplier" className="glass-input w-full mt-1" testId="offer-vendor" />
          </div>
          <div>
            <Label htmlFor="offer-price">Harga per satuan (Rp)</Label>
            <Input id="offer-price" type="number" min="0" value={form.price ?? ""} onChange={(e) => set("price", e.target.value)}
              className="glass-input mt-1" data-testid="offer-price" />
          </div>
          <div>
            <Label htmlFor="offer-unit">Satuan</Label>
            <Input id="offer-unit" value={form.unit || ""} onChange={(e) => set("unit", e.target.value)}
              className="glass-input mt-1" data-testid="offer-unit" />
          </div>
          <div>
            <Label htmlFor="offer-moq">Minimal order (MOQ)</Label>
            <Input id="offer-moq" type="number" min="0" value={form.min_order_qty ?? ""} onChange={(e) => set("min_order_qty", e.target.value)}
              className="glass-input mt-1" data-testid="offer-moq" />
          </div>
          <div>
            <Label htmlFor="offer-lead">Lead time (hari)</Label>
            <Input id="offer-lead" type="number" min="0" value={form.lead_time_days ?? ""} onChange={(e) => set("lead_time_days", e.target.value)}
              className="glass-input mt-1" data-testid="offer-lead" />
          </div>
          <div>
            <Label htmlFor="offer-from">Berlaku dari</Label>
            <Input id="offer-from" type="date" value={form.valid_from || ""} onChange={(e) => set("valid_from", e.target.value)}
              className="glass-input mt-1" data-testid="offer-valid-from" />
          </div>
          <div>
            <Label htmlFor="offer-to">Berlaku sampai</Label>
            <Input id="offer-to" type="date" value={form.valid_to || ""} onChange={(e) => set("valid_to", e.target.value)}
              className="glass-input mt-1" data-testid="offer-valid-to" />
          </div>
          <div>
            <Label>Wilayah</Label>
            <div className="mt-1"><RegionSelect value={form.region_id} onChange={(v) => set("region_id", v)} className="w-full" testId="offer-region" /></div>
          </div>
          <div>
            <Label>Sumber</Label>
            <SimpleSelect value={form.source || "manual"} onValueChange={(v) => set("source", v)}
              options={["manual", "contract", "rfq", "import"].map((v) => ({ value: v, label: SOURCE_LABEL[v] }))}
              ariaLabel="Sumber penawaran" className="glass-input w-full mt-1" testId="offer-source" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="offer-notes">Catatan</Label>
            <Textarea id="offer-notes" rows={2} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)}
              placeholder="Mis. kualitas grade A, harga termasuk antar" className="glass-input mt-1" data-testid="offer-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="offer-cancel">Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="offer-save">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Dialog harga acuan (satu item) ---------- */
export function BenchmarkDialog({ open, onOpenChange, item, regionId, periodType, current, onSaved }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState("");
  const [source, setSource] = useState("survey");
  const [note, setNote] = useState("");
  const [region, setRegion] = useState(regionId || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPrice(current?.ref_price ? String(current.ref_price) : "");
    setSource(current?.source || "survey");
    setNote(current?.source_note || "");
    setRegion(regionId || "");
  }, [open, current, regionId]);
  const submit = async () => {
    if (!(Number(price) > 0)) { toast.error("Harga acuan harus lebih besar dari 0"); return; }
    setSaving(true);
    try {
      await api.post("/sourcing/benchmarks", { item_id: item.id, unit: item.unit_default, price: Number(price),
        region_id: region || null, period_type: periodType, source, source_note: note || null });
      toast.success("Harga acuan disimpan");
      qc.invalidateQueries({ queryKey: ["sourcing"] });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menyimpan harga acuan");
    } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="benchmark-dialog">
        <DialogHeader>
          <DialogTitle>Tetapkan Harga Acuan</DialogTitle>
          <DialogDescription>{item?.name} · periode {PERIOD_LABEL[periodType]?.toLowerCase()} berjalan, per {item?.unit_default}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="bm-price">Harga acuan (Rp / {item?.unit_default})</Label>
            <Input id="bm-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)}
              className="glass-input mt-1" data-testid="benchmark-price" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Wilayah</Label>
              <div className="mt-1"><RegionSelect value={region} onChange={setRegion} className="w-full" testId="benchmark-region" /></div>
            </div>
            <div>
              <Label>Sumber</Label>
              <SimpleSelect value={source} onValueChange={setSource}
                options={["survey", "offers_median", "manual"].map((v) => ({ value: v, label: SOURCE_LABEL[v] }))}
                ariaLabel="Sumber acuan" className="glass-input w-full mt-1" testId="benchmark-source" />
            </div>
          </div>
          <div>
            <Label htmlFor="bm-note">Keterangan sumber</Label>
            <Input id="bm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. Pasar Induk Kramat Jati, 6 Nov"
              className="glass-input mt-1" data-testid="benchmark-note" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="benchmark-cancel">Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="benchmark-save">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
