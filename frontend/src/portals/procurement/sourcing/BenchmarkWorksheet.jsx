/** Sourcing › Harga acuan — lembar kerja per periode (mingguan/bulanan/kuartalan) & wilayah.
 *  Isi cepat dari median penawaran / periode sebelumnya, simpan sekaligus. Item baru dari KDO/BDO direview di sini. */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCopy, Sigma, Tag } from "lucide-react";
import { toast } from "sonner";
import api, { unwrap, fetchAll } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import SimpleSelect from "@/components/shared/SimpleSelect";
import ListToolbar, { ListSearch } from "@/components/shared/ListToolbar";
import { FormActionBar, useUnsavedChanges } from "@/components/shared/UnsavedChanges";
import { PERIOD_LABEL, PERIOD_OPTIONS, RegionSelect, SOURCE_LABEL, useSourcingPerms, useSourcingSettings } from "./shared";

function shiftDate(iso, type, dir) {
  const d = new Date(`${iso}T00:00:00`);
  if (type === "weekly") d.setDate(d.getDate() + 7 * dir);
  else if (type === "monthly") d.setMonth(d.getMonth() + dir);
  else d.setMonth(d.getMonth() + 3 * dir);
  return d.toISOString().slice(0, 10);
}

export default function BenchmarkWorksheet() {
  const qc = useQueryClient();
  const { canBenchmark, canSeePending } = useSourcingPerms();
  const { data: settings } = useSourcingSettings();
  const [periodType, setPeriodType] = useState("");
  const [on, setOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({}); // item_id → { price, source }
  const [saving, setSaving] = useState(false);
  const type = periodType || settings?.default_period_type || "monthly";

  const { data, isLoading } = useQuery({
    queryKey: ["sourcing", "worksheet", type, on, region, category],
    queryFn: async () => unwrap(await api.get("/sourcing/benchmarks/worksheet", {
      params: { period_type: type, on, region_id: region || undefined, category_id: category || undefined } })),
    enabled: !!settings,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["master", "categories", "item"],
    queryFn: async () => (unwrap(await fetchAll("/master/categories", { active: true })) || []).filter((c) => c.type === "item"),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { setDraft({}); }, [type, on, region, category]);

  const dirtyCount = Object.keys(draft).length;
  useUnsavedChanges(dirtyCount > 0);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter((r) => !q || `${r.item_name} ${r.item_code}`.toLowerCase().includes(q));
  }, [data, search]);
  const period = data?.period;
  const closed = period?.status === "closed";
  const editable = canBenchmark && !closed;

  const setPrice = (r, value, source = "manual") => setDraft((d) => {
    const n = { ...d };
    if (value === "" || Number(value) === r.price) delete n[r.item_id];
    else n[r.item_id] = { price: value, source };
    return n;
  });
  const fillFrom = (field, source) => {
    let n = 0;
    setDraft((d) => {
      const out = { ...d };
      rows.forEach((r) => {
        if (!r.price && !out[r.item_id] && r[field]) { out[r.item_id] = { price: String(r[field]), source }; n += 1; }
      });
      return out;
    });
    setTimeout(() => toast.info(n ? `${n} item diisi — periksa lalu Simpan` : "Tidak ada item kosong yang bisa diisi"), 0);
  };
  const save = async () => {
    const payload = Object.entries(draft).filter(([, v]) => Number(v.price) > 0).map(([item_id, v]) => {
      const r = rows.find((x) => x.item_id === item_id) || (data?.rows || []).find((x) => x.item_id === item_id);
      return { item_id, unit: r?.unit, price: Number(v.price), period_id: period.id, region_id: region || null, source: v.source };
    });
    if (!payload.length) return;
    setSaving(true);
    try {
      const res = unwrap(await api.post("/sourcing/benchmarks/bulk", { rows: payload }));
      if (res.errors?.length) toast.warning(`${res.ok} tersimpan, ${res.errors.length} gagal: ${res.errors[0].error}`);
      else toast.success(`${res.ok} harga acuan tersimpan`);
      setDraft({});
      qc.invalidateQueries({ queryKey: ["sourcing"] });
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const columns = [
    { key: "item_name", label: "Item", primary: true, sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate" title={r.item_name}>{r.item_name}</div>
          <div className="text-xs text-muted-foreground truncate">{r.category_name || "—"} · {r.unit}</div>
        </div>
      ) },
    { key: "previous_price", label: data?.previous_period ? `Acuan ${data.previous_period.label}` : "Acuan sebelumnya", numeric: true,
      render: (r) => r.previous_price ? fmtRp(r.previous_price) : "—" },
    { key: "offers_median", label: "Penawaran berlaku", numeric: true,
      render: (r) => r.offers_count ? (
        <div className="text-right">
          <div className="tabular-nums">{fmtRp(r.offers_median)} <span className="text-xs text-muted-foreground">median</span></div>
          <div className="text-xs text-muted-foreground">min {fmtRp(r.offers_min)} · {r.offers_count} penawaran</div>
        </div>
      ) : "—" },
    { key: "last_price", label: "Harga terakhir", numeric: true, render: (r) => r.last_price ? fmtRp(r.last_price) : "—" },
    { key: "price", label: `Acuan ${period?.label || ""}`, numeric: true,
      render: (r) => {
        const d = draft[r.item_id];
        if (!editable) return r.price ? <span className="font-medium tabular-nums">{fmtRp(r.price)}</span> : <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col items-end gap-0.5">
            <Input type="number" min="0" inputMode="decimal" aria-label={`Acuan ${r.item_name}`}
              value={d ? d.price : (r.price ?? "")} onChange={(e) => setPrice(r, e.target.value, d?.source || "manual")}
              className={`glass-input w-32 text-right tabular-nums ${d ? "ring-1 ring-amber-500/60" : ""}`}
              data-testid={`benchmark-input-${r.item_id}`} />
            {(d?.source || r.source) && <span className="text-xs text-muted-foreground">{SOURCE_LABEL[d?.source || r.source]}</span>}
          </div>
        );
      } },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="sourcing-benchmarks">
      <PageHeader
        title="Harga acuan"
        subtitle="Harga wajar pasar per periode & wilayah — pembanding harga penawaran dan harga beli."
        actions={editable ? (
          <>
            <Button variant="outline" onClick={() => fillFrom("offers_median", "offers_median")} data-testid="benchmark-fill-median">
              <Sigma /> Isi dari median penawaran
            </Button>
            <Button variant="outline" onClick={() => fillFrom("previous_price", "previous")} data-testid="benchmark-fill-previous">
              <ClipboardCopy /> Salin periode sebelumnya
            </Button>
          </>
        ) : null}
      />

      <div className="flex flex-wrap items-end gap-3" data-testid="benchmark-filters">
        <div>
          <Label className="text-xs text-muted-foreground">Periode</Label>
          <SimpleSelect value={type} onValueChange={setPeriodType} options={PERIOD_OPTIONS} ariaLabel="Tipe periode"
            className="glass-input w-36 mt-1" testId="benchmark-period-type" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{PERIOD_LABEL[type]}</Label>
          <div className="mt-1 flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Periode sebelumnya" onClick={() => setOn(shiftDate(on, type, -1))} data-testid="benchmark-prev">
              <ChevronLeft />
            </Button>
            <div className="min-w-[10rem] text-center text-sm font-medium" data-testid="benchmark-period-label">{period?.label || "…"}</div>
            <Button variant="outline" size="icon" aria-label="Periode berikutnya" onClick={() => setOn(shiftDate(on, type, 1))} data-testid="benchmark-next">
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Wilayah</Label>
          <div className="mt-1"><RegionSelect value={region} onChange={setRegion} testId="benchmark-region" /></div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Kategori</Label>
          <SimpleSelect value={category} onValueChange={(v) => setCategory(v || "")}
            options={[{ value: "", label: "Semua kategori" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            ariaLabel="Kategori" className="glass-input w-48 mt-1" testId="benchmark-category" />
        </div>
      </div>

      <div className="glass-card overflow-hidden" data-testid="benchmark-table-card">
        <ListToolbar testId="benchmark-toolbar"
          search={<ListSearch value={search} onChange={setSearch} placeholder="Cari item…" testId="benchmark-search" />}
          actions={<span className="text-xs text-muted-foreground" data-testid="benchmark-progress">{data ? `${data.filled}/${data.total} item terisi` : ""}</span>} />
        <DataTable columns={columns} rows={rows} keyField="item_id" loading={isLoading} rowTestIdPrefix="benchmark-row"
          empty={<EmptyState icon={Tag} title={`Tidak ada item dengan periode ${PERIOD_LABEL[type]?.toLowerCase()}`}
            description="Tipe periode per kategori diatur di tab Pengaturan." />} />
      </div>

      {canSeePending && <PendingItems />}

      {editable && (
        <FormActionBar dirty={dirtyCount > 0} hint={dirtyCount ? `${dirtyCount} harga acuan berubah` : "Belum ada perubahan"}>
          <Button variant="ghost" onClick={() => setDraft({})} disabled={!dirtyCount} data-testid="benchmark-discard">Batal</Button>
          <Button onClick={save} disabled={!dirtyCount || saving} data-testid="benchmark-save-all">Simpan</Button>
        </FormActionBar>
      )}
    </div>
  );
}

/** Item baru dari KDO/BDO (status pending_review): tetapkan kategori (+ acuan opsional) lalu setujui. */
function PendingItems() {
  const qc = useQueryClient();
  const { canBenchmark } = useSourcingPerms();
  const [form, setForm] = useState({});
  const { data: items = [] } = useQuery({
    queryKey: ["sourcing", "pending-items"],
    queryFn: async () => unwrap(await api.get("/market-list/items", { params: { ml_status: "pending_review", per_page: 100 } })) || [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["master", "categories", "item"],
    queryFn: async () => (unwrap(await fetchAll("/master/categories", { active: true })) || []).filter((c) => c.type === "item"),
    staleTime: 5 * 60 * 1000,
  });
  if (!items.length) return null;
  const approve = async (it) => {
    const f = form[it.id] || {};
    if (!f.category_id) { toast.error("Pilih kategori dulu"); return; }
    try {
      await api.post(`/market-list/items/${it.id}/approve`, { category_id: f.category_id, ref_price: f.ref_price ? Number(f.ref_price) : undefined });
      toast.success(`${it.name} disetujui`);
      qc.invalidateQueries({ queryKey: ["sourcing"] });
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menyetujui");
    }
  };
  return (
    <div className="glass-card overflow-hidden" data-testid="benchmark-pending-items">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm md:text-base font-semibold">Item baru menunggu review ({items.length})</h3>
        <p className="text-xs text-muted-foreground">Dibuat otomatis dari KDO/BDO karena belum ada di master item.</p>
      </div>
      <DataTable rows={items} keyField="id" rowTestIdPrefix="pending-item"
        columns={[
          { key: "name", label: "Item", primary: true, render: (it) => <span className="font-medium">{it.name}</span> },
          { key: "unit_default", label: "Satuan" },
          { key: "category_id", label: "Kategori", render: (it) => (
            <SimpleSelect value={form[it.id]?.category_id || ""} disabled={!canBenchmark}
              onValueChange={(v) => setForm((s) => ({ ...s, [it.id]: { ...s[it.id], category_id: v } }))}
              options={[{ value: "", label: "— pilih —" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              ariaLabel={`Kategori ${it.name}`} className="glass-input w-44" testId={`pending-category-${it.id}`} />
          ) },
          { key: "ref_price", label: "Acuan (opsional)", numeric: true, render: (it) => (
            <Input type="number" min="0" disabled={!canBenchmark} aria-label={`Acuan ${it.name}`} value={form[it.id]?.ref_price || ""}
              onChange={(e) => setForm((s) => ({ ...s, [it.id]: { ...s[it.id], ref_price: e.target.value } }))}
              className="glass-input w-28 text-right" data-testid={`pending-price-${it.id}`} />
          ) },
        ]}
        rowAction={canBenchmark ? (it) => (
          <Button size="sm" variant="outline" onClick={() => approve(it)} data-testid={`pending-approve-${it.id}`}>Setujui</Button>
        ) : undefined}
      />
    </div>
  );
}
