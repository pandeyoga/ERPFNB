/** Bank Reconciliation wizard — list, upload, review-matches, commit. Sprint F v2: summary, bulk-accept, exception, CSV export. */
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle2, X, RefreshCw, Check, PlusCircle, ListChecks, ArrowLeft, AlertCircle, Zap, FileDown, RotateCcw, History, ChevronDown, Landmark, Rows3, Banknote } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Textarea } from "@/components/ui/textarea";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Audit history config ────────────────────────────────────────────────────
const ACTION_HISTORY_CONFIG = {
  create:         { label: "Upload Statement",        dot: "bg-blue-500",    text: "text-blue-700 dark:text-blue-400" },
  auto_match:     { label: "Auto Match",              dot: "bg-cyan-500",    text: "text-cyan-700 dark:text-cyan-400" },
  bulk_accept:    { label: "Bulk Auto Accept",        dot: "bg-teal-500",    text: "text-teal-700 dark:text-teal-400" },
  match:          { label: "Manual Match",            dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  unmatch:        { label: "Unmatch",                 dot: "bg-amber-500",   text: "text-amber-800 dark:text-amber-400" },
  exception:      { label: "Tandai Exception",        dot: "bg-orange-500",  text: "text-orange-800 dark:text-orange-400" },
  commit:         { label: "Commit Rekonsiliasi",     dot: "bg-green-600",   text: "text-green-700 dark:text-green-400" },
  reverse_commit: { label: "Batalkan Rekonsiliasi",   dot: "bg-red-500",     text: "text-red-700 dark:text-red-400" },
};

function historyActionSummary(entry) {
  const a = entry.after;
  if (!a) return null;
  switch (entry.action) {
    case "create":       return a.total_rows != null ? `${a.total_rows} baris diimport` : null;
    case "auto_match":   return a.matched != null    ? `${a.matched} baris di-match` : null;
    case "bulk_accept":  return a.accepted != null   ? `${a.accepted} baris diterima (min ${Math.round((a.min_score||0)*100)}%)` : null;
    case "commit":       return a.matched != null    ? `${a.matched} baris di-commit` : null;
    case "reverse_commit": return a.reversed != null ? `${a.reversed} dari ${a.total_matched||"?"} transaksi di-unrecon` : null;
    default:             return null;
  }
}

export default function BankRecon({ embedded = false }) {
  const [view, setView] = useState("list"); // 'list' | 'detail'
  const [activeId, setActiveId] = useState(null);

  function openSession(id) {
    setActiveId(id);
    setView("detail");
  }
  if (view === "list") return <BankReconList onOpen={openSession} embedded={embedded} />;
  return (
    <div className="space-y-3 lg:space-y-4">
      {/* Standalone: tetap satu <h1> di atas tampilan detail sesi (di hub, <h1> milik hub). */}
      {!embedded && (
        <PageHeader icon={Landmark} title="Bank Reconciliation"
          subtitle="Review hasil auto-match per baris statement, lalu commit rekonsiliasi." />
      )}
      <BankReconDetail sessionId={activeId} onBack={() => { setActiveId(null); setView("list"); }} />
    </div>
  );
}

function BankReconList({ onOpen, embedded = false }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bankId, setBankId] = useState("");
  const [dateTol, setDateTol] = useState(3);
  const [amtTol, setAmtTol] = useState(1000);
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        api.get("/finance/bank-recon/sessions"),
        api.get("/master/bank-accounts?page=1&per_page=50"),
      ]);
      setSessions(unwrap(sRes) || []);
      setBanks(unwrap(bRes) || []);
    } catch (e) { toast.error("Gagal memuat sessions"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function uploadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file || !bankId) { toast.error("File CSV dan bank account wajib diisi"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("bank_account_id", bankId);
    fd.append("file", file);
    fd.append("date_tol_days", String(dateTol));
    fd.append("amount_tol", String(amtTol));
    try {
      const res = await api.post("/finance/bank-recon/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const session = unwrap(res);
      toast.success(`Terunggah: ${session.total_rows} baris, ${session.matched_count || 0} cocok`);
      setShowUpload(false);
      await load();
      onOpen(session.id);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Upload gagal");
    } finally { setUploading(false); }
  }

  const sessionColumns = [
    { key: "bank_account_name", label: "Bank", primary: true, render: (s) => s.bank_account_name || "-" },
    { key: "filename", label: "File", render: (s) => <span className="text-xs text-muted-foreground">{s.filename}</span> },
    { key: "range", label: "Periode", render: (s) => <span className="text-xs whitespace-nowrap">{fmtDate(s.start_date)} — {fmtDate(s.end_date)}</span> },
    { key: "total_rows", label: "Baris", numeric: true, sortable: true },
    { key: "matched_count", label: "Matched", numeric: true, render: (s) => `${s.matched_count || 0}/${s.total_rows}` },
    { key: "status", label: "Status", render: (s) => <StatusPill status={s.status} /> },
    { key: "created_at", label: "Dibuat", sortable: true, render: (s) => <span className="text-xs whitespace-nowrap">{fmtDateTime(s.created_at)}</span> },
  ];

  const subtitle = "Unggah statement bank (CSV) → auto-match ke payment (PAY) & jurnal → commit rekonsiliasi.";
  const actions = (
    <Button onClick={() => setShowUpload(true)} data-testid="br-new-upload">
      <PlusCircle className="h-4 w-4" /> Unggah Statement
    </Button>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="bank-recon-page">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      ) : (
        <PageHeader icon={Landmark} title="Bank Reconciliation" subtitle={subtitle} actions={actions} />
      )}

      <div className="glass-card overflow-hidden" data-testid="br-session-table-card">
        <DataTable
          rows={sessions}
          columns={sessionColumns}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="br-row"
          defaultSort={{ key: "created_at", dir: "desc" }}
          onRowClick={(s) => onOpen(s.id)}
          empty={<EmptyState icon={FileSpreadsheet} title="Belum ada sesi rekonsiliasi"
            description="Unggah statement bank (CSV) untuk mulai mencocokkan transaksi."
            action={<Button size="sm" onClick={() => setShowUpload(true)} data-testid="br-empty-upload">
              <PlusCircle className="h-4 w-4" /> Unggah Statement</Button>} />}
        />
      </div>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent data-testid="br-upload-dialog">
          <DialogHeader><DialogTitle>Unggah Bank Statement (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bank Account <span className="text-red-700 dark:text-red-400">*</span></Label>
              <SimpleSelect value={bankId} onValueChange={setBankId}
                options={[{ value: "", label: "Pilih..." }, ...banks.map(b => ({ value: b.id, label: `${b.bank} ${b.account_number} — ${b.name}` }))]}
                placeholder="Pilih..." ariaLabel="Bank Account"
                className="glass-input mt-1 w-full" testId="br-bank-select" />
            </div>
            <div><Label htmlFor="br-file">File CSV <span className="text-red-700 dark:text-red-400">*</span></Label>
              <Input id="br-file" type="file" accept=".csv,.txt" ref={fileRef} className="mt-1" data-testid="br-file" />
              <p className="text-xs text-muted-foreground mt-1">
                Kolom yang dikenal: Date / Tanggal, Description / Keterangan, Amount / Debit+Credit, Reference (opsional).
                Format tanggal: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="br-datetol">Toleransi tanggal (± hari)</Label>
                <Input id="br-datetol" type="number" value={dateTol} onChange={e => setDateTol(Number(e.target.value || 3))} min={0} max={14} className="mt-1" data-testid="br-datetol" /></div>
              <div><Label htmlFor="br-amttol">Toleransi nominal (± Rp)</Label>
                <Input id="br-amttol" type="number" value={amtTol} onChange={e => setAmtTol(Number(e.target.value || 1000))} min={0} className="mt-1" data-testid="br-amttol" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)} data-testid="br-upload-cancel">Batal</Button>
            <Button onClick={uploadFile} disabled={uploading}
              data-testid="br-upload-confirm">
              <Upload className="h-4 w-4" /> {uploading ? "Mengunggah..." : "Unggah & auto-match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BankReconDetail({ sessionId, onBack }) {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [matchingRowId, setMatchingRowId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCands, setLoadingCands] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState("all"); // "all" | "journal_entry" | "payment_request"
  const [amountFilter, setAmountFilter] = useState(""); // numeric string, empty = no filter
  // Sprint F v2
  const [exceptionRowId, setExceptionRowId] = useState(null);
  const [exceptionNote, setExceptionNote] = useState("");
  const [bulkMinScore, setBulkMinScore] = useState(0.75);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [sRes, sumRes] = await Promise.all([
        api.get(`/finance/bank-recon/sessions/${sessionId}`),
        api.get(`/finance/bank-recon/sessions/${sessionId}/summary`).catch(() => ({ data: { data: null } })),
      ]);
      setData(unwrap(sRes));
      setSummary(sumRes.data?.data);
    } catch (e) { toast.error("Gagal load session"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (sessionId) load(); }, [sessionId]);

  async function loadHistory() {
    try {
      const r = await api.get(`/finance/bank-recon/sessions/${sessionId}/history`);
      setHistory(unwrap(r) || []);
    } catch { /* non-critical */ }
  }
  useEffect(() => { if (sessionId) loadHistory(); }, [sessionId]);

  async function rerun() {
    setActing(true);
    try {
      await api.post(`/finance/bank-recon/sessions/${sessionId}/auto-match`);
      await Promise.all([load(), loadHistory()]);
      toast.success("Auto-match selesai");
    } catch (e) { toast.error("Gagal rerun match"); } finally { setActing(false); }
  }

  async function commit() {
    setActing(true);
    try {
      await api.post(`/finance/bank-recon/sessions/${sessionId}/commit`);
      toast.success("Session committed — PAY ditandai reconciled");
      await Promise.all([load(), loadHistory()]);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal commit");
    } finally { setActing(false); }
  }

  // Sprint F v2
  async function handleBulkAccept() {
    setActing(true);
    try {
      const res = await api.post(`/finance/bank-recon/sessions/${sessionId}/bulk-auto-accept`, { min_score: bulkMinScore });
      const accepted = res.data?.data?.accepted || 0;
      toast.success(`${accepted} baris diterima otomatis`);
      setShowBulkDialog(false);
      await load();
    } catch (e) { toast.error("Gagal bulk accept"); } finally { setActing(false); }
  }

  async function handleMarkException() {
    try {
      await api.post(`/finance/bank-recon/sessions/${sessionId}/rows/${exceptionRowId}/exception`, { note: exceptionNote });
      toast.success("Baris ditandai sebagai exception");
      setExceptionRowId(null);
      setExceptionNote("");
      await load();
    } catch (e) { toast.error("Gagal tandai exception"); }
  }

  async function handleExportCSV() {
    try {
      const res = await api.get(`/finance/bank-recon/sessions/${sessionId}/export-csv`, { responseType: "text" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `bank_recon_${sessionId.slice(0, 8)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV diunduh");
    } catch { toast.error("Gagal export CSV"); }
  }

  async function openMatch(rowId) {
    setMatchingRowId(rowId);
    setCandidateFilter("all");
    setAmountFilter("");
    setLoadingCands(true);
    setCandidates([]);
    try {
      const res = await api.get(`/finance/bank-recon/sessions/${sessionId}/rows/${rowId}/candidates`);
      setCandidates(unwrap(res) || []);
    } catch (e) { toast.error("Gagal load candidates"); }
    finally { setLoadingCands(false); }
  }

  async function pickCandidate(c) {
    try {
      await api.post(`/finance/bank-recon/sessions/${sessionId}/rows/${matchingRowId}/match`, {
        target_type: c.target_type, target_id: c.target_id,
      });
      setMatchingRowId(null);
      await load();
      toast.success("Match berhasil");
    } catch (e) { toast.error("Gagal match"); }
  }

  async function unmatch(rowId) {
    try {
      await api.post(`/finance/bank-recon/sessions/${sessionId}/rows/${rowId}/unmatch`);
      await load();
    } catch (e) { toast.error("Gagal unmatch"); }
  }

  async function handleReverse() {
    setActing(true);
    try {
      await api.post(`/finance/bank-recon/sessions/${sessionId}/reverse-commit`);
      setShowReverseDialog(false);
      await Promise.all([load(), loadHistory()]);
      toast.success("Rekonsiliasi berhasil dibatalkan — session kembali ke status Pending");
    } catch (e) {
      toast.error((e?.response?.data?.errors?.[0]?.message || e?.response?.data?.detail) || "Gagal reverse commit");
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!data) return (
    <div className="glass-card" data-testid="br-session-not-found">
      <EmptyState icon={FileSpreadsheet} title="Sesi rekonsiliasi tidak ditemukan"
        description="Sesi gagal dimuat atau sudah dihapus."
        action={<Button variant="outline" size="sm" onClick={onBack} data-testid="br-notfound-back">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar sesi</Button>} />
    </div>
  );

  const matched = data.rows.filter(r => r.matched).length;
  const exceptional = data.rows.filter(r => r.exception).length;
  const total = data.rows.length;
  const pct = total ? Math.round((matched / total) * 100) : 0;
  const isCommitted = data.status === "committed";

  const reconRowColumns = [
    { key: "date", label: "Tanggal", primary: true, render: (r) => <span className="text-xs whitespace-nowrap">{fmtDate(r.date)}</span> },
    { key: "description", label: "Keterangan", render: (r) => <span className="block max-w-[280px] truncate" title={r.description}>{r.description || "-"}</span> },
    { key: "amount", label: "Amount", numeric: true,
      render: (r) => <span className={cn(r.amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{fmtRp(r.amount)}</span> },
    { key: "reference", label: "Ref", render: (r) => <span className="text-xs text-muted-foreground">{r.reference || "-"}</span> },
    { key: "match", label: "Match", render: (r) => (
      r.exception
        ? <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5" />Exception{r.exception_note ? `: ${r.exception_note}` : ""}</span>
        : r.matched
          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{r.match_target_doc_no || r.match_target_id?.slice(0, 8)} {r.match_type === "manual" ? "(manual)" : r.match_confidence ? `(${Math.round(r.match_confidence * 100)}%)` : ""}</span>
          : <span className="text-xs text-amber-700 dark:text-amber-400">Belum match</span>
    ) },
  ];
  const reconRowAction = (r) => (
    <span className="inline-flex items-center gap-1">
      {!isCommitted && !r.matched && !r.exception && (
        <Button size="sm" variant="outline" onClick={() => openMatch(r.id)} data-testid={`br-match-${r.id}`}>Match...</Button>
      )}
      {!isCommitted && !r.exception && !r.matched && (
        <Button size="icon-sm" variant="ghost" className="text-red-700 dark:text-red-400" onClick={() => { setExceptionRowId(r.id); setExceptionNote(""); }}
          aria-label="Tandai exception" title="Tandai exception" data-testid={`br-exception-${r.id}`}>
          <AlertCircle className="h-3.5 w-3.5" />
        </Button>
      )}
      {!isCommitted && r.matched && (
        <Button size="icon-sm" variant="ghost" onClick={() => unmatch(r.id)}
          aria-label="Batalkan match" title="Batalkan match" data-testid={`br-unmatch-${r.id}`}><X className="h-3.5 w-3.5" /></Button>
      )}
    </span>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="br-detail">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack} data-testid="br-back">
        <ArrowLeft className="h-4 w-4" /> Kembali ke daftar sesi
      </Button>
      <div className="flex flex-wrap items-start gap-3" data-testid="br-detail-header">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-base md:text-lg font-semibold truncate">{data.filename}</h2>
            <StatusPill status={data.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {data.bank_account_name} · {fmtDate(data.start_date)}–{fmtDate(data.end_date)}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={handleExportCSV} data-testid="br-export-csv">
            <FileDown className="h-4 w-4" />Ekspor CSV
          </Button>
          {!isCommitted && (
            <>
              <Button variant="outline" onClick={() => setShowBulkDialog(true)} data-testid="br-bulk-accept">
                <Zap className="h-4 w-4" />Terima massal
              </Button>
              <Button variant="outline" onClick={rerun} disabled={acting} data-testid="br-rerun">
                <RefreshCw className={cn("h-4 w-4", acting && "animate-spin")} /> Jalankan ulang match
              </Button>
              <Button onClick={commit} disabled={acting || matched === 0} data-testid="br-commit">
                <Check className="h-4 w-4" /> Commit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sprint F v2: KPI summary (nominal dari /summary digabung sebagai sub-teks) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="br-kpi-strip">
        <CompactStatCard label="Total baris" icon={Rows3} color="aurora-1" value={total} testId="br-kpi-total" />
        <CompactStatCard label="Matched" icon={CheckCircle2} color="aurora-4" tone="success" value={`${matched} (${summary?.match_pct ?? pct}%)`}
          sub={summary ? fmtRp(summary.matched_amount) : undefined} testId="br-kpi-matched" />
        <CompactStatCard label="Belum match" icon={ListChecks} color="aurora-5" tone={total - matched - exceptional > 0 ? "warning" : "default"} value={total - matched - exceptional}
          sub={summary ? fmtRp(summary.unmatched_amount) : undefined} testId="br-kpi-unmatched" />
        <CompactStatCard label="Exception" icon={AlertCircle} color="aurora-6" tone={exceptional > 0 ? "danger" : "default"} value={exceptional}
          sub={summary?.exceptional_amount > 0 ? fmtRp(summary.exceptional_amount) : undefined} testId="br-kpi-exception" />
        <CompactStatCard label="Total inflow" icon={Banknote} color="aurora-2" value={fmtRp(data.total_inflow)} testId="br-kpi-inflow" />
      </div>

      <div className="glass-card overflow-hidden">
        <DataTable
          rows={data.rows}
          columns={reconRowColumns}
          keyField="id"
          rowTestIdPrefix="br-row"
          rowAction={reconRowAction}
          rowClassName={(r) => cn(r.matched && "bg-emerald-500/5", r.exception && "bg-red-500/5 opacity-70")}
          empty={<div className="p-6"><EmptyState icon={FileSpreadsheet} title="Tidak ada baris" description="Statement ini tidak memiliki baris transaksi." /></div>}
        />
      </div>

      {isCommitted && (
        <div className="glass-card p-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Reconciled</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Committed {fmtDateTime(data.committed_at)} — {matched} matched rows ditandai sebagai reconciled.
                </div>
              </div>
            </div>
            <Button
              size="sm" variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/5 flex-shrink-0"
              onClick={() => setShowReverseDialog(true)}
              data-testid="btn-reverse-commit"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Batalkan Rekonsiliasi
            </Button>
          </div>
        </div>
      )}

      {/* ── History / Audit Timeline ──────────────────────────────────── */}
      {history.length > 0 && (
        <div className="glass-card overflow-hidden" data-testid="session-history-panel">
          {/* Collapsible header */}
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-foreground/5 transition-colors"
            onClick={() => setHistoryOpen(o => !o)}
            aria-expanded={historyOpen}
            data-testid="history-toggle"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-muted-foreground" />
              Riwayat Session
              <span className="text-xs font-normal text-muted-foreground">({history.length} event)</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", historyOpen && "rotate-180")} />
          </button>

          {historyOpen && (
            <div className="px-4 pb-4 border-t border-border/40">
              <ol className="relative mt-4 space-y-0" data-testid="history-timeline">
                {history.map((entry, i) => {
                  const cfg = ACTION_HISTORY_CONFIG[entry.action] || { label: entry.action, dot: "bg-muted-foreground", text: "text-muted-foreground" };
                  const summary = historyActionSummary(entry);
                  return (
                    <li key={entry.id || i} className="flex gap-3 pb-5 last:pb-0 relative">
                      {/* Vertical connector line */}
                      {i < history.length - 1 && (
                        <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border/50" />
                      )}
                      {/* Dot */}
                      <div className={cn("mt-0.5 h-3.5 w-3.5 rounded-full flex-shrink-0 ring-2 ring-background", cfg.dot)} />
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={cn("text-sm font-semibold", cfg.text)}>{cfg.label}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums flex-shrink-0">
                            {fmtDateTime(entry.timestamp)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {entry.user_name}
                          {summary && <span className="text-muted-foreground"> · {summary}</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Reverse commit confirmation dialog */}
      <Dialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-destructive" />
              Batalkan Rekonsiliasi?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Tindakan ini akan membatalkan rekonsiliasi dan mengembalikan semua
              <span className="font-semibold text-foreground"> {matched} transaksi</span> yang
              sudah di-match ke status <span className="font-semibold text-foreground">belum reconciled</span>.
            </p>
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-400 space-y-1">
              <p className="font-semibold">Yang akan terjadi:</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Status session kembali ke <strong>Menunggu</strong></li>
                <li>Data match (baris yang sudah di-match) dipertahankan</li>
                <li>Transaksi PAY/JE tidak lagi ditandai sebagai reconciled</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Anda masih bisa menyesuaikan match dan commit ulang setelahnya.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReverseDialog(false)} data-testid="btn-cancel-reverse">Batal</Button>
            <Button
              variant="destructive"
              onClick={handleReverse}
              disabled={acting}
              data-testid="btn-confirm-reverse"
            >
              {acting ? "Memproses..." : "Ya, Batalkan Rekonsiliasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidate picker */}
      <Dialog open={!!matchingRowId} onOpenChange={(o) => !o && setMatchingRowId(null)}>
        <DialogContent className="max-w-2xl" data-testid="br-candidate-dialog">
          <DialogHeader><DialogTitle>Pilih kandidat match</DialogTitle></DialogHeader>

          {/* Type filter toggle */}
          {!loadingCands && candidates.length > 0 && (() => {
            const hasJE  = candidates.some(c => c.target_type === "journal_entry");
            const hasPAY = candidates.some(c => c.target_type === "payment_request");
            if (!hasJE || !hasPAY) return null; // only show toggle when both types present
            const types = [
              { key: "all",              label: "Semua",        count: candidates.length },
              { key: "journal_entry",    label: "Jurnal (JE)",  count: candidates.filter(c => c.target_type === "journal_entry").length },
              { key: "payment_request",  label: "Pembayaran",   count: candidates.filter(c => c.target_type === "payment_request").length },
            ];
            return (
              <Tabs value={candidateFilter} onValueChange={setCandidateFilter}>
                <TabsList data-testid="candidate-type-filter" aria-label="Filter tipe kandidat">
                  {types.map(t => (
                    <TabsTrigger key={t.key} value={t.key} data-testid={`filter-${t.key}`}>
                      {t.label} <span className="tabular-nums">({t.count})</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            );
          })()}

          {loadingCands && <LoadingState rows={3} />}
          {!loadingCands && candidates.length === 0 && <EmptyState icon={ListChecks} title="Tidak ada kandidat" description="Coba longgarkan tolerance atau cek PAY dengan status 'paid'." />}
          {!loadingCands && candidates.length > 0 && (() => {
            // Parse amount filter — strip non-numeric chars
            const parsedAmt = amountFilter ? parseFloat(amountFilter.replace(/[^\d]/g, "")) : NaN;
            const hasAmtFilter = !isNaN(parsedAmt) && parsedAmt > 0;

            const visible = candidates
              .filter(c => candidateFilter === "all" || c.target_type === candidateFilter)
              .filter(c => {
                if (!hasAmtFilter) return true;
                // Fuzzy: within ±10% or ±Rp 50,000, whichever is larger
                const tolerance = Math.max(parsedAmt * 0.10, 50000);
                return Math.abs(Math.abs(c.amount) - parsedAmt) <= tolerance;
              });

            // Row amount for placeholder hint
            const rowAmt = data?.rows?.find(r => r.id === matchingRowId)?.amount;

            return (
              <>
                {/* Amount filter input */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Rp</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={amountFilter}
                      onChange={e => setAmountFilter(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder={rowAmt ? new Intl.NumberFormat("id-ID").format(Math.abs(rowAmt)) : "0"}
                      aria-label="Filter nominal kandidat (± 10%)"
                      className="glass-input pl-8 pr-9 tabular-nums"
                      data-testid="candidate-amount-filter"
                    />
                    {amountFilter && (
                      <Button
                        variant="ghost" size="icon-sm"
                        onClick={() => setAmountFilter("")}
                        aria-label="Hapus filter nominal"
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        data-testid="clear-amount-filter"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {hasAmtFilter && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="amount-filter-count">
                      {visible.length} / {candidates.filter(c => candidateFilter === "all" || c.target_type === candidateFilter).length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 max-h-[360px] overflow-auto">
                  {visible.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {hasAmtFilter
                        ? `Tidak ada kandidat dalam toleransi ±10% dari Rp ${new Intl.NumberFormat("id-ID").format(parsedAmt)}.`
                        : "Tidak ada kandidat dengan tipe ini."}
                    </p>
                  )}
                  {visible.map(c => (
                      <button key={c.target_id} onClick={() => pickCandidate(c)}
                      className="w-full text-left p-3 rounded-md border border-border/30 hover:bg-foreground/5 transition flex items-center gap-3"
                      data-testid="br-candidate">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono">{c.doc_no}</span>
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded font-semibold",
                            c.target_type === "journal_entry"
                              ? "bg-violet-500/10 text-violet-800 dark:text-violet-400"
                              : "bg-blue-500/10 text-blue-800 dark:text-blue-400",
                          )}>
                            {c.target_type === "journal_entry" ? "JE" : "PAY"}
                          </span>
                          {c.loose && <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-800 dark:text-amber-400 rounded">loose</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.payee_name || c.description || c.target_type} · {fmtDate(c.date)} · <span className="tabular-nums">{fmtRp(c.amount)}</span>
                        </div>
                      </div>
                      {c.score != null && (
                        <div className={cn("px-2 py-1 rounded text-xs font-semibold tabular-nums flex-shrink-0", c.score >= 0.8 ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400" : "bg-amber-500/15 text-amber-800 dark:text-amber-400")}>{Math.round(c.score * 100)}%</div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Sprint F v2: Exception dialog */}
      <Dialog open={!!exceptionRowId} onOpenChange={(o) => !o && setExceptionRowId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tandai sebagai Exception</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Baris ini tidak dapat di-match dengan transaksi yang ada. Tambahkan catatan untuk audit trail.</p>
            <div className="space-y-1">
              <Label htmlFor="br-exception-note">Catatan exception</Label>
              <Textarea id="br-exception-note" data-testid="br-exception-note" rows={3} value={exceptionNote} onChange={e => setExceptionNote(e.target.value)} placeholder="Mis: Biaya bank otomatis, belum direkam di sistem..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExceptionRowId(null)} data-testid="br-exception-cancel">Batal</Button>
            <Button variant="destructive" onClick={handleMarkException} data-testid="br-exception-confirm">Tandai Exception</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sprint F v2: Bulk auto-accept dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Terima massal (auto-accept)</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Terima otomatis semua baris yang belum di-match jika confidence score &ge; threshold yang dipilih.</p>
            <div className="space-y-1">
              <Label htmlFor="br-bulk-score">Min. confidence score: {Math.round(bulkMinScore * 100)}%</Label>
              <input id="br-bulk-score" data-testid="br-bulk-score" type="range" min="0.5" max="1.0" step="0.05" value={bulkMinScore}
                onChange={e => setBulkMinScore(Number(e.target.value))}
                className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>50% (lebih longgar)</span><span>100% (sangat ketat)</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)} data-testid="br-bulk-cancel">Batal</Button>
            <Button onClick={handleBulkAccept} disabled={acting} data-testid="br-bulk-confirm">
              {acting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Jalankan terima massal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
