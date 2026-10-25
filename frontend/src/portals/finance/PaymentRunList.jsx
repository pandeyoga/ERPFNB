/** PaymentRunList.jsx — Batch Payment Run list + create dialog */
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PlayCircle, Plus, Search, CheckCircle2, Banknote, ChevronRight, Layout, Layers, FileEdit,
} from "lucide-react";
import { toast } from "sonner";

import api, { unwrap, unwrapWithMeta } from "@/lib/api";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import StatusPill from "@/components/shared/StatusPill";

const STATUS_TABS = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "posted", label: "Posted" },
  { key: "cancelled", label: "Cancelled" },
];

export default function PaymentRunList({ embedded = false }) {
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

  const subtitle = "Eksekusi beberapa payment approved sekaligus dari satu rekening bank.";
  const templatesPath = "/finance/payments-hub?tab=run-templates";
  const actions = (
    <>
      <Button variant="outline" onClick={() => navigate(templatesPath)} data-testid="prn-from-template-btn">
        <Layout className="h-4 w-4" />Templates
      </Button>
      <Button onClick={() => setShowCreate(true)} data-testid="prn-create-btn">
        <Plus className="h-4 w-4" />Buat Payment Run
      </Button>
    </>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="payment-run-list-page">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      ) : (
        <PageHeader icon={Layers} title="Payment Runs" subtitle={subtitle} actions={actions} />
      )}

      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="prn-kpi-strip">
          <CompactStatCard label="Draft" icon={FileEdit} color="aurora-3" testId="prn-kpi-draft"
            value={<span data-testid="prn-kpi-draft-value">{kpi.draft ?? "—"}</span>} />
          <CompactStatCard label="Confirmed (siap eksekusi)" icon={CheckCircle2} color="aurora-2" tone="info" testId="prn-kpi-confirmed"
            value={<span data-testid="prn-kpi-confirmed-value">{kpi.confirmed ?? "—"}</span>} />
          <CompactStatCard label={`Posted ${kpi.period}`} icon={PlayCircle} color="aurora-4" tone="success" testId="prn-kpi-posted"
            value={<span data-testid="prn-kpi-posted-value">{kpi.posted_this_month.count}</span>}
            sub="run dieksekusi bulan ini" />
          <CompactStatCard label="Total dibayar bulan ini" icon={Banknote} color="aurora-1" testId="prn-kpi-total"
            value={<span data-testid="prn-kpi-total-value">{fmtRp(kpi.posted_this_month.amount)}</span>} />
        </div>
      )}

      <div className="glass-card p-3 flex flex-wrap items-center gap-3" data-testid="prn-toolbar">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList data-testid="prn-status-tabs" aria-label="Filter status payment run">
            {STATUS_TABS.map(t => (
              <TabsTrigger key={t.key} value={t.key} data-testid={`prn-tab-${t.key}`}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading && <LoadingState rows={5} />}
      {!loading && items.length === 0 && (
        <div className="glass-card">
          <EmptyState icon={PlayCircle} title="Belum ada payment run"
            description="Buat payment run untuk mengeksekusi beberapa payment sekaligus."
            action={<Button size="sm" onClick={() => setShowCreate(true)} data-testid="prn-empty-create">
              <Plus className="h-4 w-4" />Buat Payment Run</Button>}
            data-testid="prn-empty-state" />
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="glass-card overflow-hidden" data-testid="prn-table-card">
          <DataTable
            columns={[
              { key: "doc_no", label: "Doc No", primary: true, sortable: true,
                render: (r) => <span className="font-mono text-xs whitespace-nowrap" data-testid={`prn-doc-${r.doc_no}`}>{r.doc_no}</span> },
              { key: "payment_date", label: "Payment Date", sortable: true, render: (r) => fmtDate(r.payment_date) },
              { key: "bank", label: "Bank Account",
                render: (r) => <span className="text-xs text-muted-foreground max-w-[200px] truncate block">{r.bank_account_name || r.bank_account_id}</span> },
              { key: "pay_count", label: "Jumlah PAY", numeric: true, sortable: true,
                render: (r) => <span data-testid={`prn-count-${r.doc_no}`}>{r.pay_count} PAY</span> },
              { key: "total_amount", label: "Total Amount", numeric: true, sortable: true,
                render: (r) => <span data-testid={`prn-amount-${r.doc_no}`}>{fmtRp(r.total_amount)}</span> },
              { key: "status", label: "Status",
                render: (r) => (
                  <span className="inline-flex items-center gap-1">
                    <StatusPill status={r.status} />
                    {r.has_wht && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400"
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
              <Button asChild variant="ghost" size="sm">
                <Link to={`/finance/payment-runs/${r.id}`}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`prn-view-${r.doc_no}`}>Lihat detail</Link>
              </Button>
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
                <Label htmlFor="prn-form-date">Payment Date <span className="text-red-500">*</span></Label>
                <Input id="prn-form-date" type="date" value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="glass-input" data-testid="prn-form-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prn-form-bank">Bank Account <span className="text-red-500">*</span></Label>
                <Select value={form.bank_account_id}
                  onValueChange={v => setForm(f => ({ ...f, bank_account_id: v }))}>
                  <SelectTrigger id="prn-form-bank" className="glass-input" data-testid="prn-form-bank">
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
              <Label htmlFor="prn-form-notes">Catatan (opsional)</Label>
              <Input id="prn-form-notes" value={form.notes}
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
              <Input placeholder="Cari doc no / payee / deskripsi..." value={search}
                onChange={e => setSearch(e.target.value)} aria-label="Cari payment approved"
                className="glass-input pl-9" data-testid="prn-pay-search" />
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
                          onChange={toggleAll} aria-label="Pilih semua payment"
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
                          <input type="checkbox" readOnly aria-label={`Pilih ${p.doc_no}`}
                            checked={selectedIds.includes(p.id)}
                            data-testid={`prn-pay-check-${p.doc_no}`} />
                        </td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{p.doc_no}</td>
                        <td className="px-3 py-2">
                          <div>{p.payee_name || "-"}</div>
                          <div className="text-[11px] text-muted-foreground uppercase">{p.payee_type}</div>
                        </td>
                        <td className="px-3 py-2 max-w-[180px] truncate">{p.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold"
                          data-testid={`prn-pay-amount-${p.doc_no}`}>{fmtRp(p.amount)}</td>
                        <td className="px-3 py-2">
                          {p.wh_type && parseFloat(p.wh_amount || 0) > 0 ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              title={`PPh WHT: ${fmtRp(p.wh_amount)}`}>
                              WHT {fmtRp(p.wh_amount)}
                            </span>
                          ) : <span className="text-[11px] text-muted-foreground">—</span>}
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
                Pilih payment <ChevronRight className="h-4 w-4" />
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
                {submitting ? "Menyimpan..." : `Buat run (${selectedIds.length} payment)`}
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
                <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{p.doc_no}</td>
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
  return <th className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
