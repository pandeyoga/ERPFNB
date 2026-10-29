/** Petty Cash list + balance widget + create dialog with AI GL Suggestion.
 *  `embedded` = dirender di dalam langkah End of Day → tanpa PageHeader. */
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
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import VendorAutocomplete from "@/components/shared/VendorAutocomplete";
import GLSuggestion from "@/components/shared/GLSuggestion";
import ReceiptCapture from "@/components/shared/ReceiptCapture";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useOutletScopeCtx } from "./OutletScopeContext";

import { fetchAll } from "@/lib/api";
export default function PettyCashList({ embedded = false }) {
  const { scopedOutlets, outletId, currentOutlet, setOutletId } = useOutletScopeCtx();
  const [showForm, setShowForm] = useState(false);
  const [pickOutlet, setPickOutlet] = useState(false);
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
      const c = await fetchAll("/master/chart-of-accounts");
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

  const lowBalance = !aggregateMode && balance > 0 && balance < 500000;
  const newButton = (
    <Button
      onClick={() => (outletId ? setShowForm(true) : setPickOutlet(true))}
      disabled={scopedOutlets.length === 0}
      data-testid="pc-new"
      title={!outletId ? "Pilih outlet untuk transaksi" : ""}
    >
      <Plus className="h-4 w-4" /> Buat Transaksi
    </Button>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="petty-cash-page">
      {!embedded && (
        <PageHeader
          icon={Wallet}
          title="Petty Cash"
          subtitle="Kas kecil outlet — catat pengeluaran, replenish, dan penyesuaian saldo."
          actions={newButton}
          className="mb-0 md:mb-0"
        />
      )}

      {/* Saldo — total + per outlet (agregat) atau satu outlet. Outlet picker ada di header. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="pc-balance-strip">
        <CompactStatCard
          label={aggregateMode ? `Saldo Total (${scopedOutlets.length} outlet)` : `Saldo · ${currentOutlet?.name || "—"}`}
          value={<span data-testid="pc-balance">{fmtRp(balance)}</span>}
          sub={aggregateMode ? "Agregat semua outlet" : lowBalance ? "Saldo rendah" : balance >= 500000 ? "Saldo cukup" : undefined}
          tone={lowBalance ? "warning" : "default"}
          icon={lowBalance ? AlertTriangle : Wallet}
          color="aurora-3"
          loading={balanceQuery.isLoading}
          testId="pc-balance-card"
          className="col-span-2 md:col-span-1"
        />
        {aggregateMode && Object.entries(balances).map(([oid, bal]) => (
          <CompactStatCard
            key={oid}
            label={outletMap[oid]?.name || oid}
            value={fmtRp(bal)}
            tone={bal > 0 && bal < 500000 ? "warning" : "default"}
            sub={bal > 0 && bal < 500000 ? "Saldo rendah" : undefined}
            size="sm"
            testId={`pc-balance-${oid}`}
          />
        ))}
        {embedded && <div className="col-span-2 md:col-span-1 flex items-center">{newButton}</div>}
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
              key: "amount", label: "Nominal", numeric: true,
              render: t => (
                <span className={cn(
                  "font-semibold",
                  isInflow(t) ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
                )}>
                  {isInflow(t) ? "+" : "−"} {fmtRp(t.amount || 0)}
                </span>
              ),
            },
            {
              key: "balance_after", label: "Saldo Setelah", numeric: true,
              render: t => <span className="text-muted-foreground">{fmtRp(t.balance_after || 0)}</span>,
            },
            {
              key: "status", label: "Status",
              render: t => t.status === "pending_approval" ? (
                <Button size="sm" variant="outline"
                  data-testid={`pc-approve-${t.id}`}
                  title="Menunggu approval — klik untuk menyetujui"
                  onClick={async () => {
                    try { await api.post(`/outlet/petty-cash/${t.id}/approve`); toast.success("Disetujui & dijurnal"); loadList(); }
                    catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal approve"); }
                  }}>Setujui</Button>
              ) : <StatusPill status={t.status} />,
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
              action={<Button size="sm" variant="outline" onClick={() => (outletId ? setShowForm(true) : setPickOutlet(true))} disabled={scopedOutlets.length === 0}>Buat Transaksi</Button>}
            />
          }
          rowTestIdPrefix="pc"
        />
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="pc-page-prev">Sebelumnya</Button>
              <span className="px-1 tabular-nums">{page}/{totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="pc-page-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>

      <PettyCashForm
        open={showForm} outletId={outletId} coas={coas}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); loadList(); }}
      />
      <OutletPickDialog
        open={pickOutlet}
        outlets={scopedOutlets}
        onClose={() => setPickOutlet(false)}
        onPick={(id) => { setOutletId(id); setPickOutlet(false); setShowForm(true); }}
      />
    </div>
  );
}

function OutletPickDialog({ open, outlets, onClose, onPick }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-md" data-testid="pc-outlet-picker">
        <DialogHeader>
          <DialogTitle>Pilih Outlet</DialogTitle>
          <DialogDescription>Transaksi petty cash dicatat per outlet. Pilih outlet untuk melanjutkan.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 max-h-[50vh] overflow-y-auto py-1">
          {outlets.map(o => (
            <button
              key={o.id} type="button" onClick={() => onPick(o.id)}
              className="glass-input rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 text-left transition-colors hover:bg-foreground/5"
              data-testid={`pc-outlet-option-${o.id}`}
            >
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{o.name}</span>
              {o.code && <span className="ml-auto text-xs text-muted-foreground">{o.code}</span>}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isInflow(t) {
  return t.type === "replenish" || (t.type === "adjustment" && t.direction !== "out");
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
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 bg-${cfg.color}-500/15 text-${cfg.color}-700 dark:text-${cfg.color}-400`}>
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
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Nominal harus > 0"); return; }
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
        direction: form.type === "adjustment" ? (form.direction || "in") : null,
      };
      if (form.type === "purchase" && !payload.gl_account_id) { toast.error("Akun GL wajib untuk pengeluaran"); setSaving(false); return; }
      await api.post("/outlet/petty-cash", payload);
      toast.success(form.type === "purchase" ? "Petty cash dicatat" : "Diajukan — menunggu approval finance");
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
      <DialogContent className="glass-card max-w-xl">
        <DialogHeader>
          <DialogTitle>Transaksi Petty Cash Baru</DialogTitle>
          <DialogDescription>Catat pengeluaran/replenish kas kecil. AI akan membantu kategorisasi GL.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipe transaksi">
            {[
              { v: "purchase",   l: "Pengeluaran", Icon: ArrowDownCircle },
              { v: "replenish",  l: "Replenish",   Icon: ArrowUpCircle },
              { v: "adjustment", l: "Adjustment",  Icon: ArrowLeftRight },
            ].map(t => {
              const Icon = t.Icon;
              return (
                <button
                  key={t.v}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t.v}
                  onClick={() => setForm(f => ({ ...f, type: t.v }))}
                  className={cn(
                    "glass-input rounded-lg h-9 px-3 text-sm flex items-center justify-center gap-2 transition-colors",
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

          {form.type === "adjustment" && (
            <div className="flex gap-2" data-testid="pc-direction" role="radiogroup" aria-label="Arah penyesuaian">
              {[{ v: "in", l: "Masuk (+)" }, { v: "out", l: "Keluar (−)" }].map(d => (
                <button key={d.v} type="button" role="radio" aria-checked={(form.direction || "in") === d.v} onClick={() => setForm(f => ({ ...f, direction: d.v }))}
                  className={cn("glass-input rounded-lg h-8 px-2.5 text-[13px]", (form.direction || "in") === d.v ? "pill-active" : "")}
                  data-testid={`pc-direction-${d.v}`}>{d.l}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pc-date-input" className="text-xs md:text-sm font-medium">Tanggal *</Label>
              <Input
                id="pc-date-input"
                type="date" value={form.txn_date}
                onChange={e => setForm(f => ({ ...f, txn_date: e.target.value }))}
                className="glass-input mt-1" data-testid="pc-date"
              />
            </div>
            <div>
              <Label htmlFor="pc-amount-input" className="text-xs md:text-sm font-medium">Nominal *</Label>
              <Input
                id="pc-amount-input"
                type="number" min="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="glass-input mt-1 tabular-nums" data-testid="pc-amount"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pc-desc-input" className="text-xs md:text-sm font-medium">Deskripsi *</Label>
            <Input
              id="pc-desc-input"
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
                  <Label className="text-xs md:text-sm font-medium">Item (opsional)</Label>
                  <ItemAutocomplete
                    value={form.item_text}
                    onChange={(v) => setForm(f => ({ ...f, item_text: v, item_id: null }))}
                    onSelect={(it) => setForm(f => ({ ...f, item_text: it.name, item_id: it.id }))}
                    dataTestId="pc-item"
                  />
                </div>
                <div>
                  <Label className="text-xs md:text-sm font-medium">Vendor (opsional)</Label>
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
                <Label className="text-xs md:text-sm font-medium">Akun GL *</Label>
                <SimpleSelect
                  value={form.gl_account_id}
                  onValueChange={v => setForm(f => ({ ...f, gl_account_id: v }))}
                  options={[{ value: "", label: "-- pilih GL --" }, ...coas.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
                  placeholder="-- pilih GL --"
                  className="glass-input w-full mt-1"
                  ariaLabel="Akun GL"
                  testId="pc-gl"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="pc-notes-input" className="text-xs md:text-sm font-medium">Catatan</Label>
            <Textarea
              id="pc-notes-input"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="glass-input mt-1 min-h-[60px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="pc-save">
            {saving ? "Menyimpan…" : "Simpan"}
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
