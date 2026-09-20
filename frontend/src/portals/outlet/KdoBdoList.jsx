/** KDO List + Form — Kitchen Daily Order. Mobile-first. (Phase 8B)
 *
 * Reused for /outlet/kdo and /outlet/bdo via the `kind` prop.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, ChefHat, Wine, Trash2, Star, Send, Save, ArrowLeft, History, Search, Sparkles } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import BudgetBlockDialog from "@/components/shared/BudgetBlockDialog";
import { fmtDate, fmtRelative, todayJakartaISO } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useOutletScopeCtx } from "./OutletScopeContext";
import { cn } from "@/lib/utils";

const META_BY_KIND = {
  kdo: {
    title: "KDO — Kitchen Daily Order",
    icon: ChefHat,
    description: "Permintaan bahan dapur harian. Buat ringkas — finance & purchasing akan tindak lanjuti.",
    apiPath: "/outlet/kdo",
    favPath: "/outlet/kdo/favorites",
    accent: "from-orange-500/20 to-amber-500/20",
    docPrefix: "KDO",
  },
  bdo: {
    title: "BDO — Bar Daily Order",
    icon: Wine,
    description: "Permintaan bahan bar harian. Buat ringkas — mobile-friendly.",
    apiPath: "/outlet/bdo",
    favPath: "/outlet/bdo/favorites",
    accent: "from-purple-500/20 to-pink-500/20",
    docPrefix: "BDO",
  },
};

export default function KdoBdoList({ kind = "kdo" }) {
  const meta = META_BY_KIND[kind];
  const Icon = meta.icon;
  const { scopedOutlets: userOutlets, outletId } = useOutletScopeCtx();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, per_page: 20 });

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (outletId) params.outlet_id = outletId;
      if (status) params.status = status;
      const res = await api.get(meta.apiPath, { params });
      setItems(unwrap(res) || []);
      setPageMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [page, outletId, status]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((pageMeta.total || 0) / (pageMeta.per_page || 20)));

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className={cn(
        "glass-card p-4 sm:p-5 bg-gradient-to-br",
        meta.accent,
      )}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl grad-aurora-soft flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold">{meta.title}</div>
              <div className="text-xs text-muted-foreground max-w-xl">{meta.description}</div>
            </div>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="rounded-full pill-active gap-2 h-10 px-5 touch-target"
            data-testid={`${kind}-new`}
          >
            <Plus className="h-4 w-4" /> {meta.docPrefix} Baru
          </Button>
        </div>
      </div>

      {/* Filters — outlet picker lives in global Outlet Portal header */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="sm:min-w-[180px] flex-1">
            <Label
              className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold"
              htmlFor={`${kind}-status-filter`}
            >
              Status
            </Label>
            <SimpleSelect
              value={status}
              onValueChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: "", label: "Semua" },
                { value: "draft", label: "Draft" },
                { value: "submitted", label: "Submitted" },
                { value: "awaiting_approval", label: "Menunggu Approval" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "converted", label: "Converted" },
              ]}
              placeholder="Semua"
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
              testId={`${kind}-status`}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="glass-card">
        <DataTable
          columns={[
            {
              key: "doc_no", label: "No Dokumen", primary: true,
              render: pr => <span className="font-mono text-xs">{pr.doc_no || pr.id.slice(0, 8)}</span>,
            },
            { key: "request_date", label: "Tanggal", render: pr => fmtDate(pr.request_date) },
            {
              key: "outlet", label: "Outlet",
              render: pr => userOutlets.find(o => o.id === pr.outlet_id)?.name || pr.outlet_id,
            },
            {
              key: "items", label: "Items", numeric: true,
              render: pr => `${(pr.lines || []).length} item`,
            },
            { key: "status", label: "Status", render: pr => <StatusPill status={pr.status} /> },
          ]}
          rows={items}
          loading={loading}
          empty={
            <EmptyState
              icon={Icon}
              title={`Belum ada ${meta.docPrefix}`}
              description={`Buat ${meta.docPrefix} pertama — cepat, mobile-friendly.`}
            />
          }
          rowTestIdPrefix={kind}
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {pageMeta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      <KdoBdoForm
        kind={kind}
        meta={meta}
        open={showForm}
        userOutlets={userOutlets}
        defaultOutletId={outletId}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); load(); }}
      />
    </div>
  );
}

function emptyForm() {
  return {
    outlet_id: "",
    request_date: todayJakartaISO(),
    needed_by: "",
    notes: "",
    lines: [{ name: "", item_id: null, qty: 1, unit: "pcs", note: "" }],
  };
}

function KdoBdoForm({ kind, meta, open, userOutlets, defaultOutletId, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const [statusToSet, setStatusToSet] = useState("submitted");
  const [budgetBlock, setBudgetBlock] = useState(null);  // verdict object from 422 OUTLET_BUDGET_BLOCK

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyForm(),
        outlet_id: defaultOutletId || userOutlets[0]?.id || "",
      });
      setStatusToSet("submitted");
    }
  }, [open, userOutlets, defaultOutletId]);

  // Load favorites when outlet changes
  useEffect(() => {
    if (!open || !form.outlet_id) { setFavorites([]); return; }
    setFavLoading(true);
    api.get(meta.favPath, { params: { outlet_id: form.outlet_id, limit: 12 } })
      .then(r => setFavorites(unwrap(r) || []))
      .catch(() => setFavorites([]))
      .finally(() => setFavLoading(false));
  }, [open, form.outlet_id, meta.favPath]);

  if (!open) return null;

  const setLine = (idx, key, val) => {
    setForm(f => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [key]: val };
      return { ...f, lines };
    });
  };
  const addLine = () => setForm(f => ({
    ...f,
    lines: [...f.lines, { name: "", item_id: null, qty: 1, unit: "pcs", note: "" }],
  }));
  const removeLine = (i) => setForm(f => ({
    ...f, lines: f.lines.filter((_, idx) => idx !== i),
  }));
  const addFromFav = (fav) => {
    setForm(f => {
      // Find first empty line, or push new
      const existing = f.lines;
      const emptyIdx = existing.findIndex(l => !l.name && !l.item_id);
      const newLine = {
        name: fav.name,
        item_id: fav.item_id || null,
        qty: Number(fav.last_qty) || 1,
        unit: fav.unit || "pcs",
        note: "",
      };
      if (emptyIdx >= 0) {
        const lines = [...existing];
        lines[emptyIdx] = newLine;
        return { ...f, lines };
      }
      return { ...f, lines: [...existing, newLine] };
    });
  };

  const submit = async () => {
    if (!form.outlet_id) { toast.error("Outlet wajib"); return; }
    const validLines = form.lines.filter(l => (l.name || l.item_id) && Number(l.qty) > 0);
    if (validLines.length === 0) { toast.error("Tambahkan minimal 1 item dengan qty > 0"); return; }
    setSaving(true);
    try {
      const payload = {
        outlet_id: form.outlet_id,
        request_date: form.request_date,
        needed_by: form.needed_by || null,
        notes: form.notes || null,
        status: statusToSet,
        lines: validLines.map(l => ({
          name: l.name,
          item_id: l.item_id || null,
          qty: Number(l.qty),
          unit: l.unit || "pcs",
          note: l.note || null,
        })),
      };
      await api.post(meta.apiPath, payload);
      toast.success(`${meta.docPrefix} ${statusToSet === "draft" ? "disimpan sebagai draft" : "berhasil di-submit"}`);
      onSaved();
    } catch (e) {
      const errs = e.response?.data?.errors || [];
      const code = errs[0]?.code;
      if (code === "OUTLET_BUDGET_BLOCK") {
        // Re-run precheck to get full verdict (budget_id, remaining, shortfall)
        try {
          const verdictRes = await api.post("/outlet-budget/precheck-pr", {
            outlet_id: form.outlet_id,
            source: kind,
            lines: validLines,
            request_date: form.request_date,
          });
          setBudgetBlock(verdictRes.data.data);
        } catch (_) {
          setBudgetBlock({
            bucket: kind, pr_total: 0,
            reason: errs[0]?.field || "OVER_BUDGET",
            message: errs[0]?.message,
          });
        }
      } else {
        toast.error(errs[0]?.message || "Gagal submit");
      }
    } finally {
      setSaving(false);
    }
  };

  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {meta.docPrefix} Baru
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        {/* Header inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Outlet *</Label>
            <SimpleSelect
              value={form.outlet_id}
              onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v }))}
              options={[{ value: "", label: "-- pilih --" }, ...userOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="-- pilih --"
              className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
              testId={`${kind}-form-outlet`}
            />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Tanggal *</Label>
            <Input
              type="date"
              value={form.request_date}
              onChange={(e) => setForm(f => ({ ...f, request_date: e.target.value }))}
              className="glass-input mt-1"
              data-testid={`${kind}-form-date`}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase text-muted-foreground">Dibutuhkan Pada (opsional)</Label>
            <Input
              type="date"
              value={form.needed_by}
              onChange={(e) => setForm(f => ({ ...f, needed_by: e.target.value }))}
              className="glass-input mt-1"
            />
          </div>
        </div>

        {/* Favorites strip */}
        {favorites.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Star className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Sering dipesan (30 hari terakhir)
              </span>
            </div>
            <div className="flex flex-wrap gap-2" data-testid={`${kind}-favorites`}>
              {favorites.map((fav) => (
                <button
                  key={fav.key}
                  type="button"
                  onClick={() => addFromFav(fav)}
                  className="glass-input rounded-full px-3 py-1.5 text-xs hover:bg-foreground/10 inline-flex items-center gap-1.5 touch-target"
                  data-testid={`${kind}-fav-${fav.key.slice(0, 16)}`}
                >
                  <Plus className="h-3 w-3" />
                  <span className="font-medium">{fav.name}</span>
                  <span className="text-muted-foreground">
                    {fav.last_qty} {fav.unit}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {favLoading && favorites.length === 0 && (
          <div className="text-xs text-muted-foreground py-1 italic">
            Memuat item favorit…
          </div>
        )}

        {/* Items grid */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Items</h4>
            <Button
              type="button"
              onClick={addLine}
              variant="outline"
              size="sm"
              className="rounded-full gap-1"
              data-testid={`${kind}-add-line`}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          </div>
          {form.lines.map((ln, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-2 items-start mb-2 sm:items-center"
              data-testid={`${kind}-line-${i}`}
            >
              <div className="col-span-12 sm:col-span-7">
                <ItemAutocomplete
                  showMarketRef={true}
                  value={ln.name}
                  onChange={(v) => setLine(i, "name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.lines];
                      lines[i] = {
                        ...lines[i],
                        name: it.name,
                        item_id: it.id,
                        unit: it.unit || lines[i].unit,
                      };
                      return { ...f, lines };
                    });
                  }}
                  placeholder="Nama item…"
                  dataTestId={`${kind}-line-name-${i}`}
                />
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={ln.qty}
                onChange={(e) => setLine(i, "qty", e.target.value)}
                className="glass-input col-span-4 sm:col-span-2 h-10 text-right tabular-nums"
                placeholder="Qty"
                data-testid={`${kind}-line-qty-${i}`}
              />
              <Input
                value={ln.unit}
                onChange={(e) => setLine(i, "unit", e.target.value)}
                className="glass-input col-span-4 sm:col-span-2 h-10"
                placeholder="unit"
                data-testid={`${kind}-line-unit-${i}`}
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="col-span-4 sm:col-span-1 h-10 w-full rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                aria-label="Hapus baris"
                data-testid={`${kind}-line-remove-${i}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            className="glass-input mt-1 min-h-[60px]"
            placeholder="Catatan tambahan (opsional)…"
            data-testid={`${kind}-form-notes`}
          />
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <div className="flex gap-2 sm:ml-auto">
            <Button
              variant="outline"
              onClick={() => { setStatusToSet("draft"); setTimeout(submit, 0); }}
              disabled={saving}
              className="gap-2"
              data-testid={`${kind}-save-draft`}
            >
              <Save className="h-4 w-4" /> Simpan Draft
            </Button>
            <Button
              onClick={() => { setStatusToSet("submitted"); setTimeout(submit, 0); }}
              disabled={saving}
              className="pill-active gap-2"
              data-testid={`${kind}-submit`}
            >
              <Send className="h-4 w-4" /> Submit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <BudgetBlockDialog
        open={!!budgetBlock}
        onClose={() => setBudgetBlock(null)}
        verdict={budgetBlock}
        outletId={form.outlet_id}
        onSubmitted={() => { setBudgetBlock(null); onClose(); toast.info("Request terkirim. PR akan bisa di-submit setelah Executive approve."); }}
      />
    </Dialog>
  );
}
