/** /outlet/menu — Menu & Resep: master menu per brand (termasuk yang dibuat otomatis dari impor penjualan), resep/BOM,
 * HPP per porsi & food cost %, simulasi saat mengedit, dan bantuan riset resep lewat Asisten AI.
 * Backend: /api/menu/costing, /api/menu/items, /api/menu/items/{id}/recipe, /api/menu/recipe/simulate. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChefHat, Plus, Trash2, Bot, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { useScope } from "@/contexts/ScopeContext";
import { useAuth } from "@/lib/auth";
import api, { fetchAll, unwrap, unwrapError } from "@/lib/api";
import { cn } from "@/lib/utils";

const rp = (v) => (v == null ? "—" : `Rp ${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`);
const UNITS = ["g", "kg", "ml", "l", "pcs"].map((u) => ({ value: u, label: u }));
const BUCKETS = [{ value: "food", label: "Food" }, { value: "beverage", label: "Beverage" }, { value: "other", label: "Other" }];

function fcTone(pct) {
  if (pct == null) return "text-muted-foreground";
  if (pct > 35) return "text-rose-700 dark:text-rose-400";
  if (pct > 30) return "text-amber-800 dark:text-amber-400";
  return "text-emerald-700 dark:text-emerald-400";
}

// baris yang ikut dihitung (urutan sama dengan `lines` hasil simulasi)
const isCosted = (ln) => !!(ln && (ln.item_id || ln.item_name) && Number(ln.qty) > 0);

function askAI(prompt) {
  window.dispatchEvent(new CustomEvent("aurora-open-ai", { detail: { prompt } }));
}

function NewMenuDialog({ open, onOpenChange, brands, defaultBrand, onCreated }) {
  const [form, setForm] = useState({ name: "", category: "", bucket: "food", price: "", brand_id: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm({ name: "", category: "", bucket: "food", price: "", brand_id: defaultBrand || "" }); }, [open, defaultBrand]);
  const save = async () => {
    if (!form.name.trim() || !form.brand_id) { toast.error("Nama menu & brand wajib diisi"); return; }
    setSaving(true);
    try {
      const m = unwrap(await api.post("/menu/items", { ...form, price: form.price === "" ? null : Number(form.price) }));
      toast.success("Menu ditambahkan"); onOpenChange(false); onCreated(m);
    } catch (e) { toast.error(unwrapError(e)); } finally { setSaving(false); }
  };
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Tambah menu</DialogTitle><DialogDescription>Resep bisa diisi setelah menu dibuat.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {!defaultBrand && (
            <div className="space-y-1"><Label htmlFor="mn-brand">Brand</Label>
              <SimpleSelect id="mn-brand" value={form.brand_id} onValueChange={set("brand_id")} ariaLabel="Brand"
                options={[{ value: "", label: "— Pilih brand —" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} /></div>
          )}
          <div className="space-y-1"><Label htmlFor="mn-name">Nama menu</Label>
            <Input id="mn-name" value={form.name} onChange={(e) => set("name")(e.target.value)} data-testid="menu-new-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="mn-cat">Kategori</Label>
              <Input id="mn-cat" value={form.category} onChange={(e) => set("category")(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="mn-bucket">Bucket</Label>
              <SimpleSelect id="mn-bucket" value={form.bucket} onValueChange={set("bucket")} options={BUCKETS} ariaLabel="Bucket" /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="mn-price">Harga jual (sebelum pajak)</Label>
            <Input id="mn-price" type="number" min="0" value={form.price} onChange={(e) => set("price")(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} data-testid="menu-new-save">{saving ? "Menyimpan…" : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipeDialog({ menuId, onClose, onSaved, canManage, canAI }) {
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [lines, setLines] = useState([]);
  const [yieldQty, setYieldQty] = useState(1);
  const [price, setPrice] = useState("");
  const [instructions, setInstructions] = useState("");
  const [cost, setCost] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!menuId) return;
    setData(null);
    Promise.all([api.get(`/menu/items/${menuId}/recipe`, { scope: false }), fetchAll("/master/items")])
      .then(([r, it]) => {
        const d = unwrap(r);
        setData(d); setItems(unwrap(it) || []);
        setLines((d.recipe?.lines || []).map((ln) => ({ ...ln })));
        setYieldQty(d.recipe?.yield_qty || 1); setPrice(d.menu?.price ?? ""); setInstructions(d.recipe?.instructions || ""); setCost(d.costing);
      }).catch((e) => toast.error(unwrapError(e)));
  }, [menuId]);

  // simulasi HPP setiap kali isi berubah (tanpa menyimpan)
  useEffect(() => {
    if (!data) return undefined;
    const t = setTimeout(() => {
      const valid = lines.filter(isCosted);
      api.post("/menu/recipe/simulate", { lines: valid, yield_qty: Number(yieldQty) || 1, price: price === "" ? null : Number(price) })
        .then((r) => setCost(unwrap(r))).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [lines, yieldQty, price, data]);

  const itemOpts = useMemo(() => [{ value: "", label: "— Pilih bahan —" }, ...items.map((i) => ({ value: i.id, label: `${i.name} (${i.unit_default || "-"})` }))], [items]);
  const setLine = (i, k, v) => setLines((ls) => ls.map((ln, j) => (j === i ? { ...ln, [k]: v } : ln)));
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/menu/items/${menuId}/recipe`, { lines: lines.filter((ln) => ln.item_id).map((ln) => ({ ...ln, qty: Number(ln.qty), waste_pct: Number(ln.waste_pct || 0) })),
        yield_qty: Number(yieldQty) || 1, price: price === "" ? null : Number(price), instructions });
      toast.success("Resep disimpan"); onSaved();
    } catch (e) { toast.error(unwrapError(e)); } finally { setSaving(false); }
  };
  const costByIdx = (i) => (isCosted(lines[i]) ? (cost?.lines || [])[lines.slice(0, i + 1).filter(isCosted).length - 1] : undefined);

  return (
    <Dialog open={!!menuId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.menu?.name || "Resep"}</DialogTitle>
          <DialogDescription>Bahan per {Number(yieldQty) || 1} porsi · harga bahan dari pembelian terakhir (GR) / penawaran supplier.</DialogDescription>
        </DialogHeader>
        {!data ? <p className="text-sm text-muted-foreground">Memuat…</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CompactStatCard label="HPP / porsi" value={rp(cost?.hpp_per_porsi)} />
              <CompactStatCard label="Food cost" value={cost?.food_cost_pct != null ? `${cost.food_cost_pct}%` : "—"}
                tone={cost?.food_cost_pct > 35 ? "danger" : cost?.food_cost_pct > 30 ? "warning" : "success"} />
              <CompactStatCard label="Margin / porsi" value={rp(cost?.margin_per_porsi)} />
              <CompactStatCard label="Total bahan" value={rp(cost?.total_bahan)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="rc-yield">Hasil (porsi)</Label>
                <Input id="rc-yield" type="number" min="0.1" step="0.1" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} disabled={!canManage} /></div>
              <div className="space-y-1"><Label htmlFor="rc-price">Harga jual (sebelum pajak)</Label>
                <Input id="rc-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canManage} /></div>
            </div>
            <div className="space-y-2" data-testid="recipe-lines">
              {lines.length > 0 && (
                <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span className="col-span-4">Bahan</span><span className="col-span-2">Qty</span><span className="col-span-2">Satuan</span>
                  <span className="col-span-1">Susut %</span><span className="col-span-2 text-right">Biaya</span>
                </div>
              )}
              {lines.map((ln, i) => {
                const c = costByIdx(i);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 md:col-span-4"><SimpleSelect value={ln.item_id || ""} onValueChange={(v) => setLine(i, "item_id", v)}
                      options={!ln.item_id && ln.item_name ? [{ value: "", label: `${ln.item_name} (belum ada di master item)` }, ...itemOpts.slice(1)] : itemOpts}
                      disabled={!canManage} ariaLabel={`Bahan ${i + 1}`} className="w-full" /></div>
                    <div className="col-span-3 md:col-span-2"><Input type="number" min="0" value={ln.qty ?? ""} onChange={(e) => setLine(i, "qty", e.target.value)}
                      aria-label={`Qty bahan ${i + 1}`} disabled={!canManage} /></div>
                    <div className="col-span-3 md:col-span-2"><SimpleSelect value={ln.unit || "g"} options={UNITS} onValueChange={(v) => setLine(i, "unit", v)}
                      disabled={!canManage} ariaLabel={`Satuan bahan ${i + 1}`} className="w-full" /></div>
                    <div className="col-span-2 md:col-span-1"><Input type="number" min="0" max="99" value={ln.waste_pct ?? 0} onChange={(e) => setLine(i, "waste_pct", e.target.value)}
                      aria-label={`Susut % bahan ${i + 1}`} title="Susut %" disabled={!canManage} /></div>
                    <div className="col-span-4 md:col-span-2 text-right text-xs tabular-nums whitespace-nowrap text-muted-foreground pb-2">{c?.biaya != null ? rp(c.biaya) : "—"}</div>
                    {canManage && (
                      <div className="col-span-12 md:col-span-1 flex justify-end">
                        <Button size="icon-sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Hapus bahan ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!lines.length && <p className="text-sm text-muted-foreground">Belum ada bahan.</p>}
              {canManage && <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { item_id: "", qty: "", unit: "g", waste_pct: 0 }])} data-testid="recipe-add-line"><Plus className="h-3.5 w-3.5" /> Tambah bahan</Button>}
            </div>
            {(cost?.masalah || []).length > 0 && (
              <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-0.5">{cost.masalah.map((m) => <li key={m}>• {m}</li>)}</ul>
            )}
            {cost?.peringatan && <p className="text-xs text-rose-700 dark:text-rose-400">{cost.peringatan}</p>}
            <div className="space-y-1"><Label htmlFor="rc-ins">Cara membuat</Label>
              <Textarea id="rc-ins" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={!canManage} /></div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {canAI && <Button variant="outline" onClick={() => askAI(`Bantu riset & analisis resep "${data?.menu?.name || ""}" (menu_item_id ${menuId}): bandingkan dengan resep standar, usulkan komposisi & porsi, hitung HPP dengan simulasi, target food cost ≤ 35%, dan saran harga jual.`)}>
            <Bot className="h-4 w-4" /> Riset resep dengan AI
          </Button>}
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          {canManage && <Button onClick={save} disabled={saving || !data} data-testid="recipe-save">{saving ? "Menyimpan…" : "Simpan resep"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MenuRecipePage() {
  const scope = useScope();
  const { can } = useAuth();
  const canManage = can("menu.item.manage");
  const canAI = can("ai.agent.use");
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const brandId = scope.brand?.id || scope.outlet?.brand_id || "";

  const load = useCallback(() => {
    api.get("/menu/costing", { params: brandId ? { brand_id: brandId } : {}, scope: false })
      .then((r) => setData(unwrap(r))).catch((e) => { toast.error(unwrapError(e)); setData({ rows: [], ringkasan: {} }); });
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.rows || []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const s = data?.ringkasan || {};
  const brandName = (id) => (scope.brands || []).find((b) => b.id === id)?.name || "—";
  const cols = [
    { key: "name", label: "Menu", primary: true, render: (r) => <span className="font-medium">{r.name}</span> },
    ...(brandId ? [] : [{ key: "brand_id", label: "Brand", hideOnMobile: true, render: (r) => brandName(r.brand_id) }]),
    { key: "category", label: "Kategori", hideOnMobile: true, render: (r) => r.category || "—" },
    { key: "price", label: "Harga", numeric: true, render: (r) => rp(r.price) },
    { key: "hpp", label: "HPP / porsi", numeric: true, render: (r) => rp(r.hpp) },
    { key: "food_cost_pct", label: "Food cost", numeric: true, render: (r) => <span className={cn("font-medium", fcTone(r.food_cost_pct))}>{r.food_cost_pct != null ? `${r.food_cost_pct}%` : "—"}</span> },
    { key: "has_recipe", label: "Resep", render: (r) => <StatusPill status={r.has_recipe ? (r.lengkap ? "active" : "pending") : "draft"}
      label={r.has_recipe ? (r.lengkap ? "Lengkap" : "Belum lengkap") : "Belum ada"} /> },
    { key: "needs_review", label: "Status", hideOnMobile: true, render: (r) => (r.needs_review ? <StatusPill status="pending" label="Perlu ditinjau" /> : "—") },
  ];

  return (
    <div className="space-y-3 md:space-y-4" data-testid="menu-recipe-page">
      <PageHeader icon={ChefHat} title="Menu & Resep" subtitle="Master menu, resep (BOM), HPP per porsi & food cost — menu dari impor penjualan otomatis masuk di sini"
        actions={(
          <>
            {canAI && <Button variant="outline" onClick={() => askAI("Analisis food cost semua menu (GET /api/menu/costing): menu mana yang perlu disesuaikan resep atau harganya, dan apa sarannya?")}><Bot className="h-4 w-4" /> Analisis AI</Button>}
            {canManage && <Button onClick={() => setNewOpen(true)} data-testid="menu-new"><Plus className="h-4 w-4" /> Tambah menu</Button>}
          </>
        )} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CompactStatCard label="Menu" value={s.menu ?? "…"} sub={`${s.perlu_ditinjau ?? 0} perlu ditinjau`} />
        <CompactStatCard label="Dengan resep" value={s.dengan_resep ?? "…"} />
        <CompactStatCard label="Food cost rata-rata" value={s.food_cost_rata2 != null ? `${s.food_cost_rata2}%` : "—"} />
        <CompactStatCard label="Food cost > 35%" value={s.di_atas_batas ?? 0} tone={s.di_atas_batas ? "danger" : "default"} />
      </div>
      <Card className="p-4 space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu" className="pl-8" aria-label="Cari menu" />
        </div>
        <DataTable columns={cols} rows={rows} loading={!data} onRowClick={(r) => setOpenId(r.id)} rowTestIdPrefix="menu-row"
          empty={<EmptyState icon={ChefHat} title="Belum ada menu" description="Tambah menu, atau impor penjualan per item (Impor Cerdas) — menu terbentuk otomatis." />} />
      </Card>
      <NewMenuDialog open={newOpen} onOpenChange={setNewOpen} brands={scope.brands || []} defaultBrand={brandId} onCreated={(m) => { load(); setOpenId(m.id); }} />
      <RecipeDialog menuId={openId} onClose={() => setOpenId(null)} onSaved={() => { setOpenId(null); load(); }} canManage={canManage} canAI={canAI} />
    </div>
  );
}
