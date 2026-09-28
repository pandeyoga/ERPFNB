/** PaymentRunList.jsx — Batch Payment Run list + create dialog */
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlayCircle, Plus, Search, X, CheckCircle2, Clock, Banknote, ChevronRight, Layout,
} from "lucide-react";
import { toast } from "sonner";

import api, { unwrap, unwrapWithMeta } from "@/lib/api";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";

const STATUS_TABS = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "posted", label: "Posted" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE = {
  draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  confirmed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  posted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400",
};

export default function PaymentRunList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [kpi, setKpi] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (status !== "all") params.status = status;
      const res = await api.get("/finance/payment-runs", { params });
      const { data, meta: m } = unwrapWithMeta(res);
      setItems(data || []);
      setMeta(m || { total: 0 });
    } catch {
      toast.error("Gagal memuat daftar Payment Run");
    } finally { setLoading(false); }
  }

  async function loadKpi() {
    try {
      const res = await api.get("/finance/payment-runs/kpi");
      setKpi(unwrap(res));
    } catch {}
  }

  useEffect(() => { load(); }, [status]);
  useEffect(() => { loadKpi(); }, []);

  return (
    <div className="space-y-4" data-testid="payment-run-list-page">
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="prn-kpi-strip">
          <KpiTile label="Draft" value={kpi.draft} tone="neutral" testid="prn-kpi-draft" />
          <KpiTile label="Confirmed (Siap Eksekusi)" value={kpi.confirmed} tone="sky" testid="prn-kpi-confirmed" />
          <KpiTile
            label={`Posted ${kpi.period}`}
            value={`${kpi.posted_this_month.count} · ${fmtRp(kpi.posted_this_month.amount)}`}
            tone="emerald" testid="prn-kpi-posted"
          />
          <KpiTile label="Total bulan ini" value={fmtRp(kpi.posted_this_month.amount)} tone="neutral" testid="prn-kpi-total" />
        </div>
      )}

      <div className="glass-card p-4 flex flex-wrap items-center gap-3" data-testid="prn-toolbar">
        <div className="flex flex-wrap gap-1" role="tablist" data-testid="prn-status-tabs">
          {STATUS_TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={status === t.key}
              data-testid={`prn-tab-${t.key}`}
              className={`px-3 py-1.5 text-xs rounded-full transition ${status === t.key ? "bg-foreground text-background" : "hover:bg-foreground/10"}`}
              onClick={() => setStatus(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => navigate("/finance/payment-run-templates")}
            className="rounded-full h-9 text-sm gap-2"
            data-testid="prn-from-template-btn">
            <Layout className="h-4 w-4" />Templates
          </Button>
          <Button onClick={() => setShowCreate(true)}
            className="rounded-full gap-2 h-9 bg-foreground text-background hover:bg-foreground/90 text-sm"
            data-testid="prn-create-btn">
            <Plus className="h-4 w-4" />Buat Payment Run
          </Button>
        </div>
      </div>

      {loading && <LoadingState rows={5} />}
      {!loading && items.length === 0 && (
        <EmptyState icon={PlayCircle} title="Belum ada Payment Run"
          description="Buat Payment Run untuk mengeksekusi beberapa payment sekaligus."
          actionLabel="Buat Run" onAction={() => setShowCreate(true)}
          data-testid="prn-empty-state" />
      )}

      {!loading && items.length > 0 && (
        <div className="glass-card overflow-hidden" data-testid="prn-table-card">
          <DataTable
            columns={[
              { key: "doc_no", label: "Doc No", primary: true, sortable: true,
                render: (r) => <span className="font-mono text-xs" data-testid={`prn-doc-${r.doc_no}`}>{r.doc_no}</span> },
              { key: "payment_date", label: "Payment Date", sortable: true, render: (r) => fmtDate(r.payment_date) },
              { key: "bank", label: "Bank Account",
                render: (r) => <span className="text-xs text-muted-foreground max-w-[200px] truncate block">{r.bank_account_name || r.bank_account_id}</span> },
              { key: "pay_count", label: "Jumlah PAY", numeric: true, sortable: true,
                render: (r) => <span data-testid={`prn-count-${r.doc_no}`}>{r.pay_count} items</span> },
              { key: "total_amount", label: "Total Amount", numeric: true, sortable: true,
                render: (r) => <span data-testid={`prn-amount-${r.doc_no}`}>{fmtRp(r.total_amount)}</span> },
              { key: "status", label: "Status",
                render: (r) => (
                  <span className="inline-flex items-center gap-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[r.status] || ""}`}>{r.status}</span>
                    {r.has_wht && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        title="Mengandung payment dengan withholding tax">WHT</span>
                    )}
                  </span>
                ) },
            ]}
            rows={items}
            keyField="doc_no"
            rowTestIdPrefix="prn-row"
            defaultSort={{ key: "payment_date", dir: "desc" }}
            renderExpanded={(r) => <RunPaymentsDrilldown run={r} />}
            rowAction={(r) => (
              <button className="text-xs text-primary hover:underline"
                onClick={(e) => { e.stopPropagation(); navigate(`/finance/payment-runs/${r.id}`); }}
                data-testid={`prn-view-${r.doc_no}`}>Detail</button>
            )}
          />
          <div className="px-4 py-2 border-t border-border/40 text-[11px] text-muted-foreground"
            data-testid="prn-meta">Total: {meta.total} Payment Run</div>
        </div>
      )}

      {showCreate && (
        <CreateRunDialog
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); navigate(`/finance/payment-runs/${id}`); }}
        />
      )}
    </div>
  );
}

// ── Create Run Dialog ──────────────────────────────────────────────────────────

function CreateRunDialog({ onClose, onCreated }) {
  const [step, setStep] = useState(1); // 1: setup, 2: select payments
  const [banks, setBanks] = useState([]);
  const [approvedPays, setApprovedPays] = useState([]);
  const [loadingPays, setLoadingPays] = useState(false);
  const [form, setForm] = useState({
    payment_date: todayJakartaISO(),
    bank_account_id: "",
    notes: "",
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/master/bank-accounts?page=1&per_page=50")
      .then(r => setBanks(unwrap(r) || []))
      .catch(() => {});
  }, []);

  async function loadApprovedPays() {
    setLoadingPays(true);
    try {
      const res = await api.get("/finance/payments", {
        params: { status: "approved", per_page: 100 },
      });
      const { data } = unwrapWithMeta(res);
      setApprovedPays(data || []);
    } catch {
      toast.error("Gagal memuat daftar payment yang approved");
    } finally { setLoadingPays(false); }
  }

  function handleNext() {
    if (!form.payment_date) { toast.error("Payment date wajib"); return; }
    if (!form.bank_account_id) { toast.error("Bank account wajib"); return; }
    loadApprovedPays();
    setStep(2);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return approvedPays;
    const q = search.toLowerCase();
    return approvedPays.filter(p =>
      (p.doc_no || "").toLowerCase().includes(q) ||
      (p.payee_name || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  }, [approvedPays, search]);

  const selectedTotal = useMemo(() => {
    return approvedPays
      .filter(p => selectedIds.includes(p.id))
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  }, [selectedIds, approvedPays]);

  function toggleAll() {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(p => p.id));
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) { toast.error("Pilih minimal 1 payment"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/finance/payment-runs", {
        ...form,
        pay_ids: selectedIds,
      });
      const run = unwrap(res);
      toast.success(`Payment Run ${run.doc_no} berhasil dibuat`);
      onCreated(run.id);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membuat payment run");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="create-run-dialog">
        <DialogHeader>
          <DialogTitle>Buat Payment Run Baru</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="glass-input" data-testid="prn-form-date" />
              </div>
              <div className="space-y-1.5">
                <Label>Bank Account <span className="text-red-500">*</span></Label>
                <Select value={form.bank_account_id}
                  onValueChange={v => setForm(f => ({ ...f, bank_account_id: v }))}>
                  <SelectTrigger className="glass-input" data-testid="prn-form-bank">
                    <SelectValue placeholder="Pilih bank account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bank} {b.account_number} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan untuk run ini..." className="glass-input"
                data-testid="prn-form-notes" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Pilih payments yang akan dieksekusi. Hanya payment berstatus <strong>approved</strong> yang tersedia.
              </p>
              <Badge variant="secondary" data-testid="prn-selected-count">
                {selectedIds.length} dipilih · {fmtRp(selectedTotal)}
              </Badge>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari doc_no / payee / deskripsi..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="glass-input pl-9 h-9" data-testid="prn-pay-search" />
            </div>

            {loadingPays && <LoadingState rows={4} />}
            {!loadingPays && filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Tidak ada payment approved yang tersedia.
              </div>
            )}
            {!loadingPays && filtered.length > 0 && (
              <div className="border border-border/40 rounded-lg overflow-hidden max-h-72 overflow-y-auto"
                data-testid="prn-pay-picker-table">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b border-border/40">
                    <tr>
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox"
                          checked={filtered.length > 0 && selectedIds.length === filtered.length}
                          onChange={toggleAll}
                          data-testid="prn-select-all" />
                      </th>
                      <Th>Doc No</Th>
                      <Th>Payee</Th>
                      <Th>Keterangan</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>WHT</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id}
                        className={`border-b border-border/20 hover:bg-foreground/5 cursor-pointer ${selectedIds.includes(p.id) ? "bg-primary/5" : ""}`}
                        onClick={() => setSelectedIds(prev =>
                          prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                        )}
                        data-testid={`prn-pay-row-${p.doc_no}`}>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" readOnly
                            checked={selectedIds.includes(p.id)}
                            data-testid={`prn-pay-check-${p.doc_no}`} />
                        </td>
                        <td className="px-3 py-2 font-mono">{p.doc_no}</td>
                        <td className="px-3 py-2">
                          <div>{p.payee_name || "-"}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{p.payee_type}</div>
                        </td>
                        <td className="px-3 py-2 max-w-[180px] truncate">{p.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold"
                          data-testid={`prn-pay-amount-${p.doc_no}`}>{fmtRp(p.amount)}</td>
                        <td className="px-3 py-2">
                          {p.wh_type && parseFloat(p.wh_amount || 0) > 0 ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              title={`PPh WHT: ${fmtRp(p.wh_amount)}`}>
                              WHT {fmtRp(p.wh_amount)}
                            </span>
                          ) : <span className="text-[10px] text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose} data-testid="prn-create-cancel">Batal</Button>
              <Button onClick={handleNext} data-testid="prn-create-next">
                Pilih Payments <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} data-testid="prn-create-back">Kembali</Button>
              <Button variant="outline" onClick={onClose} data-testid="prn-create-cancel2">Batal</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || selectedIds.length === 0}
                data-testid="prn-create-submit">
                {submitting ? "Menyimpan..." : `Buat Run (${selectedIds.length} payments)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunPaymentsDrilldown({ run }) {
  const [pays, setPays] = useState(null);
  const [loadingD, setLoadingD] = useState(true);
  useEffect(() => {
    let active = true;
    api.get(`/finance/payment-runs/${run.id}`)
      .then(r => { if (active) setPays(unwrap(r)?.payments || []); })
      .catch(() => { if (active) setPays([]); })
      .finally(() => { if (active) setLoadingD(false); });
    return () => { active = false; };
  }, [run.id]);

  if (loadingD) return <div className="text-xs text-muted-foreground py-2">Memuat payments…</div>;
  if (!pays?.length) return <p className="text-sm text-muted-foreground">Tidak ada payment dalam run ini.</p>;
  return (
    <div className="space-y-2" data-testid={`prn-breakdown-${run.doc_no}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        Payments dalam run ({pays.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Doc No</th>
              <th className="py-1 pr-3 font-medium">Payee</th>
              <th className="py-1 pr-3 font-medium">Keterangan</th>
              <th className="py-1 pr-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {pays.map((p, i) => (
              <tr key={p.id || i} className="border-t border-border/30">
                <td className="py-1.5 pr-3 font-mono">{p.doc_no}</td>
                <td className="py-1.5 pr-3">{p.payee_name || "—"}</td>
                <td className="py-1.5 pr-3 max-w-[220px] truncate">{p.description || "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">{fmtRp(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
function KpiTile({ label, value, tone = "neutral", testid }) {
  const cls = {
    neutral: "", sky: "text-sky-700 dark:text-sky-400",
    emerald: "text-emerald-700 dark:text-emerald-400",
  }[tone] || "";
  return (
    <div className="glass-card p-4" data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${cls}`}
        data-testid={testid ? `${testid}-value` : undefined}>{value ?? "—"}</div>
    </div>
  );
}
