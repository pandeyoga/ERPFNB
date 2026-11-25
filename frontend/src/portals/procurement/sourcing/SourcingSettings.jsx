/** Sourcing › Pengaturan — tipe periode harga acuan (default + per kategori) dan ambang peringatan. */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api, { unwrap, fetchAll } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { FormActionBar, useUnsavedChanges } from "@/components/shared/UnsavedChanges";
import { PERIOD_LABEL, PERIOD_OPTIONS, useSourcingPerms, useSourcingSettings } from "./shared";

const NUMBERS = [
  { key: "alert_pct", label: "Ambang di atas acuan (%)", hint: "Harga penawaran/beli di atas acuan + ambang ini ditandai merah.", min: 0, max: 100 },
  { key: "min_quotes", label: "Penawaran minimal per item", hint: "Praktik umum: 3 penawaran per item bahan segar.", min: 1, max: 10 },
  { key: "expiring_days", label: "Penanda penawaran segera habis (hari)", hint: "Penawaran yang berakhir dalam X hari ditandai.", min: 0, max: 90 },
  { key: "analysis_days", label: "Jendela analisis harga beli (hari)", hint: "Riwayat GR yang dipakai untuk harga terakhir, rata-rata, dan potensi hemat.", min: 7, max: 365 },
];

export default function SourcingSettings() {
  const qc = useQueryClient();
  const { canSettings } = useSourcingPerms();
  const { data: settings } = useSourcingSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data: categories = [] } = useQuery({
    queryKey: ["master", "categories", "item"],
    queryFn: async () => (unwrap(await fetchAll("/master/categories", { active: true })) || []).filter((c) => c.type === "item"),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (settings) setForm({ ...settings, category_period_types: { ...(settings.category_period_types || {}) } }); }, [settings]);
  const dirty = useMemo(() => form && settings && JSON.stringify(
    ["default_period_type", "category_period_types", ...NUMBERS.map((n) => n.key)].map((k) => form[k])) !== JSON.stringify(
    ["default_period_type", "category_period_types", ...NUMBERS.map((n) => n.key)].map((k) => settings[k])), [form, settings]);
  useUnsavedChanges(!!dirty);
  if (!form) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/sourcing/settings", {
        default_period_type: form.default_period_type, category_period_types: form.category_period_types,
        ...Object.fromEntries(NUMBERS.map((n) => [n.key, Number(form[n.key])])),
      });
      toast.success("Pengaturan Sourcing disimpan");
      qc.invalidateQueries({ queryKey: ["sourcing"] });
    } catch (e) { toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menyimpan"); }
    finally { setSaving(false); }
  };
  const setCat = (id, v) => setForm((f) => {
    const m = { ...f.category_period_types };
    if (v) m[id] = v; else delete m[id];
    return { ...f, category_period_types: m };
  });

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="sourcing-settings">
      <PageHeader title="Pengaturan" subtitle="Periode harga acuan dan ambang peringatan analisis harga." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 lg:items-start">
        <div className="glass-card p-4 space-y-3" data-testid="sourcing-settings-period">
          <div>
            <h3 className="text-sm md:text-base font-semibold">Periode harga acuan</h3>
            <p className="text-xs text-muted-foreground">Bahan segar biasanya mingguan; bahan kering bulanan atau kuartalan.</p>
          </div>
          <div>
            <Label>Periode default</Label>
            <SimpleSelect value={form.default_period_type} onValueChange={(v) => setForm((f) => ({ ...f, default_period_type: v }))}
              options={PERIOD_OPTIONS} disabled={!canSettings} ariaLabel="Periode default" className="glass-input w-48 mt-1" testId="settings-default-period" />
          </div>
          <div>
            <Label>Per kategori</Label>
            <ul className="mt-1 divide-y divide-border/40 rounded-lg border border-border/60" data-testid="settings-category-periods">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm">{c.name}</span>
                  <SimpleSelect value={form.category_period_types[c.id] || ""} onValueChange={(v) => setCat(c.id, v)} disabled={!canSettings}
                    options={[{ value: "", label: `Default (${PERIOD_LABEL[form.default_period_type]})` }, ...PERIOD_OPTIONS]}
                    ariaLabel={`Periode ${c.name}`} className="glass-input w-48" testId={`settings-category-${c.id}`} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="glass-card p-4 space-y-3" data-testid="sourcing-settings-alerts">
          <div>
            <h3 className="text-sm md:text-base font-semibold">Ambang analisis</h3>
            <p className="text-xs text-muted-foreground">Dipakai di Ringkasan dan analisis per item.</p>
          </div>
          {NUMBERS.map((n) => (
            <div key={n.key}>
              <Label htmlFor={`set-${n.key}`}>{n.label}</Label>
              <Input id={`set-${n.key}`} type="number" min={n.min} max={n.max} value={form[n.key]} disabled={!canSettings}
                onChange={(e) => setForm((f) => ({ ...f, [n.key]: e.target.value }))} className="glass-input w-32 mt-1"
                data-testid={`settings-${n.key}`} />
              <p className="text-xs text-muted-foreground mt-0.5">{n.hint}</p>
            </div>
          ))}
        </div>
      </div>
      {canSettings && (
        <FormActionBar dirty={!!dirty} hint={dirty ? "Ada perubahan belum disimpan" : "Belum ada perubahan"}>
          <Button variant="ghost" onClick={() => setForm({ ...settings, category_period_types: { ...(settings.category_period_types || {}) } })}
            disabled={!dirty} data-testid="settings-discard">Batal</Button>
          <Button onClick={save} disabled={!dirty || saving} data-testid="settings-save">Simpan</Button>
        </FormActionBar>
      )}
    </div>
  );
}
