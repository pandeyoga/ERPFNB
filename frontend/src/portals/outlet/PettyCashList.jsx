/** Petty Cash list + balance widget + create dialog with AI GL Suggestion. */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Wallet, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  CheckCircle2, AlertTriangle, Store,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import GLSuggestion from "@/components/shared/GLSuggestion";
import ReceiptCapture from "@/components/shared/ReceiptCapture";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useOutletScopeCtx } from "./OutletScopeContext";

export default function PettyCashList() {
  const { scopedOutlets, outletId, currentOutlet } = useOutletScopeCtx();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);

  const aggregateMode = !outletId;
  const outletMap = useMemo(
    () => Object.fromEntries(scopedOutlets.map(o => [o.id, o])),
    [scopedOutlets],
  );

  // COA list (rarely changes)
  const { data: coas = [] } = useQuery({
    queryKey: ["master", "chart-of-accounts", { per_page: 100, postable: true }],
    queryFn: async () => {
      const c = await api.get("/master/chart-of-accounts", { params: { per_page: 100 } });
      return (unwrap(c) || []).filter(coa => coa.is_postable && coa.active);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Petty cash list
  const listQuery = useQuery({
    queryKey: ["outlet", "petty-cash", { outletId, page }],
    queryFn: async () => {
      const listParams = { page, per_page: 20 };
      if (outletId) listParams.outlet_id = outletId;
      const res = await api.get("/outlet/petty-cash", { params: listParams });
      return {
        items: unwrap(res) || [],
        meta: res.data?.meta || { total: 0, per_page: 20 },
      };
    },
    staleTime: 30 * 1000,
    keepPreviousData: true,
    onError: () => toast.error("Gagal load petty cash"),
  });
  const items = listQuery.data?.items || [];
  const meta = listQuery.data?.meta || { total: 0, per_page: 20 };
  const loading = listQuery.isLoading;

  // Balance(s) — single outlet OR aggregate Promise.all
  const balanceKey = aggregateMode
    ? scopedOutlets.map(o => o.id).sort().join(",")
    : outletId;
  const balanceQuery = useQuery({
    queryKey: ["outlet", "petty-cash", "balance", { outletId, balanceKey }],
    queryFn: async () => {
      if (outletId) {
        const r = await api.get("/outlet/petty-cash/balance", { params: { outlet_id: outletId } });
        return { mode: "single", balance: unwrap(r)?.balance || 0, balances: {} };
      }
      if (scopedOutlets.length === 0) {
        return { mode: "aggregate", balance: 0, balances: {} };
      }
      const arr = await Promise.all(
        scopedOutlets.map(o =>
          api.get("/outlet/petty-cash/balance", { params: { outlet_id: o.id } })
            .then(b => ({ outlet_id: o.id, balance: unwrap(b)?.balance || 0 }))
            .catch(() => ({ outlet_id: o.id, balance: 0 })),
        ),
      );
      const map = Object.fromEntries(arr.map(b => [b.outlet_id, b.balance]));
      return {
        mode: "aggregate",
        balance: Object.values(map).reduce((s, v) => s + (v || 0), 0),
        balances: map,
      };
    },
    enabled: aggregateMode ? scopedOutlets.length > 0 : !!outletId,
    staleTime: 30 * 1000,
  });
  const balance = balanceQuery.data?.balance || 0;
  const balances = balanceQuery.data?.balances || {};

  const loadList = () => { listQuery.refetch(); balanceQuery.refetch(); };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4" data-testid="petty-cash-page">
      {/* Balance KPI + New button. Outlet picker is in global header. */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-3 sm:flex-wrap">
          <div className="flex-1 sm:min-w-[220px]">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              {aggregateMode
                ? `Saldo Total (${scopedOutlets.length} outlet)`
                : `Saldo Petty Cash · ${currentOutlet?.name || "—"}`}
            </Label>
            <div className="glass-input rounded-lg px-4 h-10 mt-1 flex items-center justify-between">
              <span className="font-bold text-lg tabular-nums" data-testid="pc-balance">{fmtRp(balance)}</span>
              {!aggregateMode && balance < 500000 && balance > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Saldo Rendah
                </span>
              )}
              {!aggregateMode && balance >= 500000 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Cukup
                </span>
              )}
              {aggregateMode && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                  Agregat
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={() => setShowForm(true)} disabled={!outletId}
            className="rounded-full pill-active gap-2 h-10 px-5 w-full sm:w-auto" data-testid="pc-new"
            title={!outletId ? "Pilih satu outlet di header dulu" : ""}
          >
            <Plus className="h-4 w-4" /> Transaksi Baru
          </Button>
        </div>
        {aggregateMode && Object.keys(balances).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Saldo per Outlet</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(balances).map(([oid, bal]) => (
                <div key={oid} className="glass-input rounded-lg p-2 text-xs">
                  <div className="text-muted-foreground truncate">{outletMap[oid]?.name || oid}</div>
                  <div className="font-bold tabular-nums">{fmtRp(bal)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Responsive list */}
      <div className="glass-card">
        <DataTable
          columns={[
            { key: "txn_date", label: "Tanggal", primary: true, render: t => fmtDate(t.txn_date) },
            { key: "outlet", label: "Outlet", render: t => outletMap[t.outlet_id]?.name || t.outlet_id || "—" },
            { key: "type", label: "Tipe", render: t => <TypePill type={t.type} /> },
            {
              key: "description", label: "Deskripsi",
              render: t => (
                <div>
                  <div className="font-medium">{t.description}</div>
                  {(t.item_text || t.vendor_text) && (
                    <div className="text-xs text-muted-foreground">
                      {t.item_text}{t.item_text && t.vendor_text ? " · " : ""}{t.vendor_text}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "amount", label: "Amount", numeric: true,
              render: t => (
                <span className={cn(
                  "font-semibold",
                  (t.type === "replenish" || t.type === "adjustment") ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
                )}>
                  {(t.type === "replenish" || t.type === "adjustment") ? "+" : "−"} {fmtRp(t.amount || 0)}
                </span>
              ),
            },
            {
              key: "balance_after", label: "Saldo Setelah", numeric: true,
              render: t => <span className="text-muted-foreground">{fmtRp(t.balance_after || 0)}</span>,
            },
          ]}
          rows={items}
          loading={loading}
          empty={
            <EmptyState
              icon={Wallet}
              title="Belum ada transaksi"
              description={aggregateMode
                ? "Pilih outlet spesifik di header untuk mulai mencatat petty cash, atau lanjut catat dari outlet manapun."
                : "Mulai catat pengeluaran kecil di sini."}
            />
          }
          rowTestIdPrefix="pc"
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman sebelumnya">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman berikutnya">Next</button>
            </div>
          </div>
        )}
      </div>

      <PettyCashForm
        open={showForm} outletId={outletId} coas={coas}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); loadList(); }}
      />
    </div>
  );
}

function TypePill({ type }) {
  const map = {
    purchase:    { Icon: ArrowDownCircle, label: "Purchase",   color: "red" },
    replenish:   { Icon: ArrowUpCircle,   label: "Replenish",  color: "emerald" },
    adjustment:  { Icon: ArrowLeftRight,  label: "Adjustment", color: "sky" },
  };
  const cfg = map[type] || map.purchase;
  const Icon = cfg.Icon;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 bg-${cfg.color}-500/15 text-${cfg.color}-700 dark:text-${cfg.color}-400`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function PettyCashForm({ open, outletId, coas, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...emptyForm(), txn_date: todayJakartaISO() });
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!form.description) { toast.error("Deskripsi wajib"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Amount harus > 0"); return; }
    setSaving(true);
    try {
      const payload = {
        outlet_id: outletId,
        txn_date: form.txn_date,
        type: form.type,
        amount: Number(form.amount),
        description: form.description,
        item_text: form.item_text || null,
        item_id: form.item_id || null,
        vendor_text: form.vendor_text || null,
        vendor_id: form.vendor_id || null,
        gl_account_id: form.gl_account_id || null,
        receipt_url: form.receipt_url || null,
        notes: form.notes || null,
      };
      await api.post("/outlet/petty-cash", payload);
      toast.success("Petty cash dicatat");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  const handleOCRExtracted = (data) => {
    setForm(f => {
      const next = { ...f };
      // Use total as amount when not already filled
      if ((!f.amount || Number(f.amount) === 0) && data.total > 0) {
        next.amount = String(data.total);
      }
      // Build description from vendor + first item if blank
      if (!f.description) {
        const firstItem = data.items?.[0]?.name;
        if (data.vendor_name && firstItem) {
          next.description = `${firstItem} \u2014 ${data.vendor_name}`;
        } else if (firstItem) {
          next.description = firstItem;
        } else if (data.vendor_name) {
          next.description = data.vendor_name;
        }
      }
      // Vendor text if blank
      if (!f.vendor_text && data.vendor_name) {
        next.vendor_text = data.vendor_name;
      }
      // Date if blank or different
      if (data.receipt_date) {
        next.txn_date = data.receipt_date;
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaksi Petty Cash</DialogTitle>
          <DialogDescription>Catat pengeluaran/replenish kas kecil. AI akan membantu kategorisasi GL.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "purchase",   l: "Pengeluaran", Icon: ArrowDownCircle },
              { v: "replenish",  l: "Replenish",   Icon: ArrowUpCircle },
              { v: "adjustment", l: "Adjustment",  Icon: ArrowLeftRight },
            ].map(t => {
              const Icon = t.Icon;
              return (
                <button
                  key={t.v}
                  onClick={() => setForm(f => ({ ...f, type: t.v }))}
                  className={cn(
                    "glass-input rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 transition-colors",
                    form.type === t.v ? "pill-active" : "hover:bg-foreground/5",
                  )}
                  data-testid={`pc-type-${t.v}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.l}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tanggal</Label>
              <Input
                type="date" value={form.txn_date}
                onChange={e => setForm(f => ({ ...f, txn_date: e.target.value }))}
                className="glass-input mt-1" data-testid="pc-date"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Amount *</Label>
              <Input
                type="number" min="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="glass-input mt-1 tabular-nums" data-testid="pc-amount"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Deskripsi *</Label>
            <Input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="mis: Beli galon untuk operational"
              className="glass-input mt-1" data-testid="pc-desc"
            />
          </div>

          {form.type === "purchase" && (
            <>
              <ReceiptCapture
                onExtracted={handleOCRExtracted}
                onImage={(dataUrl) => setForm(f => ({ ...f, receipt_url: dataUrl }))}
                onUploaded={(att) => setForm(f => ({ ...f, attachment_id: att.id, receipt_url: `${process.env.REACT_APP_BACKEND_URL}${att.url}` }))}
                sourceType="petty_cash"
                compact
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Item (opsional)</Label>
                  <ItemAutocomplete
                    value={form.item_text}
                    onChange={(v) => setForm(f => ({ ...f, item_text: v, item_id: null }))}
                    onSelect={(it) => setForm(f => ({ ...f, item_text: it.name, item_id: it.id }))}
                    dataTestId="pc-item"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vendor (opsional)</Label>
                  <VendorAutocomplete
                    value={form.vendor_text}
                    onChange={(v) => setForm(f => ({ ...f, vendor_text: v, vendor_id: null }))}
                    onSelect={(v) => setForm(f => ({ ...f, vendor_text: v.name, vendor_id: v.id }))}
                    dataTestId="pc-vendor"
                  />
                </div>
              </div>

              {/* AI GL Suggestion */}
              <GLSuggestion
                description={form.description}
                amount={form.amount}
                outletId={outletId}
                onAccept={(s) => setForm(f => ({ ...f, gl_account_id: s.gl_id }))}
                onLearn={(s) => {
                  if (form.description && s.gl_id) {
                    api.post("/ai/categorize/learn", {
                      description: form.description, gl_account_id: s.gl_id,
                    }).catch(() => {});
                  }
                }}
              />

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">GL Account *</Label>
                <SimpleSelect
                  value={form.gl_account_id}
                  onValueChange={v => setForm(f => ({ ...f, gl_account_id: v }))}
                  options={[{ value: "", label: "-- pilih GL --" }, ...coas.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
                  placeholder="-- pilih GL --"
                  className="glass-input rounded-lg w-full px-3 h-10 text-sm mt-1"
                  testId="pc-gl"
                />
              </div>
            </>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="glass-input mt-1 min-h-[60px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="pc-save">
            {saving ? "…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return {
    type: "purchase",
    txn_date: todayJakartaISO(),
    amount: "",
    description: "",
    item_text: "", item_id: null,
    vendor_text: "", vendor_id: null,
    gl_account_id: "",
    receipt_url: "",
    notes: "",
  };
}
