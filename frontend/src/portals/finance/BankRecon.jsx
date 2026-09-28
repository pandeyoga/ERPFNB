/** Bank Reconciliation wizard — list, upload, review-matches, commit. Sprint F v2: summary, bulk-accept, exception, CSV export. */
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle2, X, RefreshCw, Check, Download, PlusCircle, ListChecks, ArrowLeft, AlertCircle, Zap, FileDown, RotateCcw, History, ChevronDown } from "lucide-react";
import api, { unwrap, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Textarea } from "@/components/ui/textarea";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Audit history config ────────────────────────────────────────────────────
const ACTION_HISTORY_CONFIG = {
  create:         { label: "Upload Statement",        dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400" },
  auto_match:     { label: "Auto Match",              dot: "bg-cyan-500",    text: "text-cyan-600 dark:text-cyan-400" },
  bulk_accept:    { label: "Bulk Auto Accept",        dot: "bg-teal-500",    text: "text-teal-600 dark:text-teal-400" },
  match:          { label: "Manual Match",            dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  unmatch:        { label: "Unmatch",                 dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
  exception:      { label: "Tandai Exception",        dot: "bg-orange-500",  text: "text-orange-600 dark:text-orange-400" },
  commit:         { label: "Commit Rekonsiliasi",     dot: "bg-green-600",   text: "text-green-700 dark:text-green-400" },
  reverse_commit: { label: "Batalkan Rekonsiliasi",   dot: "bg-red-500",     text: "text-red-600 dark:text-red-400" },
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

export default function BankRecon() {
  const [view, setView] = useState("list"); // 'list' | 'detail'
  const [activeId, setActiveId] = useState(null);

  function openSession(id) {
    setActiveId(id);
    setView("detail");
  }
  return view === "list"
    ? <BankReconList onOpen={openSession} />
    : <BankReconDetail sessionId={activeId} onBack={() => { setActiveId(null); setView("list"); }} />;
}

function BankReconList({ onOpen }) {
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
    if (!file || !bankId) { toast.error("File CSV + bank account wajib"); return; }
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
      toast.success(`Uploaded: ${session.total_rows} rows, ${session.matched_count || 0} matched`);
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
    { key: "range", label: "Range", render: (s) => <span className="text-xs">{fmtDate(s.start_date)} — {fmtDate(s.end_date)}</span> },
    { key: "total_rows", label: "Rows", numeric: true, sortable: true },
    { key: "matched_count", label: "Matched", numeric: true, render: (s) => `${s.matched_count || 0}/${s.total_rows}` },
    { key: "status", label: "Status", render: (s) => <StatusPill status={s.status} /> },
    { key: "created_at", label: "Created", render: (s) => <span className="text-xs">{fmtDateTime(s.created_at)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Bank Reconciliation
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Upload bank statement CSV → auto-match ke Payment Request paid → commit reconciliation.
          </div>
        </div>
        <Button onClick={() => setShowUpload(true)} className="rounded-full gap-2 bg-foreground text-background hover:bg-foreground/90"
          data-testid="br-new-upload">
          <PlusCircle className="h-4 w-4" /> Upload Statement
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <DataTable
          rows={sessions}
          columns={sessionColumns}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="br-row"
          defaultSort={{ key: "created_at", dir: "desc" }}
          onRowClick={(s) => onOpen(s.id)}
          empty={<div className="p-6"><EmptyState icon={FileSpreadsheet} title="Belum ada sesi rekonsiliasi"
            description="Klik 'Upload Statement' untuk mulai."
            actionLabel="Upload Statement" onAction={() => setShowUpload(true)} /></div>}
        />
      </div>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Bank Statement (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bank Account</Label>
              <SimpleSelect value={bankId} onValueChange={setBankId}
                options={[{ value: "", label: "Pilih..." }, ...banks.map(b => ({ value: b.id, label: `${b.bank} ${b.account_number} — ${b.name}` }))]}
                placeholder="Pilih..."
                className="glass-input h-10 mt-1 w-full rounded-md" testId="br-bank-select" />
            </div>
            <div><Label>CSV File</Label>
              <Input type="file" accept=".csv,.txt" ref={fileRef} className="mt-1" data-testid="br-file" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Kolom yang dikenal: Date / Tanggal, Description / Keterangan, Amount / Debit+Credit, Reference (opsional).
                Format tanggal: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date tolerance (± hari)</Label>
                <Input type="number" value={dateTol} onChange={e => setDateTol(Number(e.target.value || 3))} min={0} max={14} className="mt-1" data-testid="br-datetol" /></div>
              <div><Label>Amount tolerance (± Rp)</Label>
                <Input type="number" value={amtTol} onChange={e => setAmtTol(Number(e.target.value || 1000))} min={0} className="mt-1" data-testid="br-amttol" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Batal</Button>
            <Button onClick={uploadFile} disabled={uploading}
              className="bg-foreground text-background hover:bg-foreground/90 gap-2"
              data-testid="br-upload-confirm">
              <Upload className="h-4 w-4" /> Upload & Auto-match
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
      toast.error(e?.response?.data?.detail || "Gagal reverse commit");
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!data) return null;

  const matched = data.rows.filter(r => r.matched).length;
  const exceptional = data.rows.filter(r => r.exception).length;
  const total = data.rows.length;
  const pct = total ? Math.round((matched / total) * 100) : 0;
  const isCommitted = data.status === "committed";

  const reconRowColumns = [
    { key: "date", label: "Date", primary: true, render: (r) => <span className="text-xs whitespace-nowrap">{fmtDate(r.date)}</span> },
    { key: "description", label: "Description", render: (r) => <span className="block max-w-[280px] truncate" title={r.description}>{r.description || "-"}</span> },
    { key: "amount", label: "Amount", numeric: true,
      render: (r) => <span className={cn(r.amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{fmtRp(r.amount)}</span> },
    { key: "reference", label: "Ref", render: (r) => <span className="text-xs text-muted-foreground">{r.reference || "-"}</span> },
    { key: "match", label: "Match", render: (r) => (
      r.exception
        ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" />Exception{r.exception_note ? `: ${r.exception_note}` : ""}</span>
        : r.matched
          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{r.match_target_doc_no || r.match_target_id?.slice(0, 8)} {r.match_type === "manual" ? "(manual)" : r.match_confidence ? `(${Math.round(r.match_confidence * 100)}%)` : ""}</span>
          : <span className="text-xs text-amber-700 dark:text-amber-400">Unmatched</span>
    ) },
  ];
  const reconRowAction = (r) => (
    <span className="space-x-1">
      {!isCommitted && !r.matched && !r.exception && (
        <Button size="sm" variant="outline" onClick={() => openMatch(r.id)} data-testid={`br-match-${r.id}`}>Match...</Button>
      )}
      {!isCommitted && !r.exception && !r.matched && (
        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { setExceptionRowId(r.id); setExceptionNote(""); }} data-testid={`br-exception-${r.id}`}>
          <AlertCircle className="h-3.5 w-3.5" />
        </Button>
      )}
      {!isCommitted && r.matched && (
        <Button size="sm" variant="ghost" onClick={() => unmatch(r.id)} data-testid={`br-unmatch-${r.id}`}><X className="h-3 w-3" /></Button>
      )}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Kembali" onClick={onBack} data-testid="br-back"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{data.filename}</h2>
            <StatusPill status={data.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {data.bank_account_name} · {fmtDate(data.start_date)}–{fmtDate(data.end_date)}
          </div>
        </div>
        {!isCommitted && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5" data-testid="br-export-csv">
              <FileDown className="h-4 w-4" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkDialog(true)} className="gap-1.5" data-testid="br-bulk-accept">
              <Zap className="h-4 w-4" />Bulk Accept
            </Button>
            <Button variant="outline" size="sm" onClick={rerun} disabled={acting} className="gap-1.5" data-testid="br-rerun">
              <RefreshCw className={cn("h-4 w-4", acting && "animate-spin")} /> Re-run
            </Button>
            <Button size="sm" onClick={commit} disabled={acting || matched === 0} className="gap-1.5 bg-foreground text-background hover:bg-foreground/90" data-testid="br-commit">
              <Check className="h-4 w-4" /> Commit
            </Button>
          </div>
        )}
        {isCommitted && (
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
            <FileDown className="h-4 w-4" />Export CSV
          </Button>
        )}
      </div>

      {/* Sprint F v2: Enhanced KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile label="Total rows" value={total} />
        <KpiTile label="Matched" value={`${matched} (${pct}%)`} tone="emerald" />
        <KpiTile label="Unmatched" value={total - matched - exceptional} tone="amber" />
        <KpiTile label="Exception" value={exceptional} tone="red" />
        <KpiTile label="Total inflow" value={fmtRp(data.total_inflow)} tone="emerald" />
      </div>

      {/* Summary panel */}
      {summary && (
        <div className="glass-card p-3 flex flex-wrap gap-4 text-sm">
          <span><strong>Match rate:</strong> {summary.match_pct}%</span>
          <span><strong>Matched:</strong> {fmtRp(summary.matched_amount)}</span>
          <span><strong>Unmatched:</strong> {fmtRp(summary.unmatched_amount)}</span>
          {summary.exceptional_amount > 0 && <span className="text-red-600"><strong>Exception:</strong> {fmtRp(summary.exceptional_amount)}</span>}
        </div>
      )}

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
              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5 flex-shrink-0"
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
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-foreground/5 transition-colors"
            onClick={() => setHistoryOpen(o => !o)}
            data-testid="history-toggle"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-muted-foreground" />
              Riwayat Session
              <span className="text-xs font-normal text-muted-foreground/70">({history.length} event)</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", historyOpen && "rotate-180")} />
          </button>

          {historyOpen && (
            <div className="px-4 pb-4 border-t border-border/40">
              <ol className="relative mt-4 space-y-0" data-testid="history-timeline">
                {history.map((entry, i) => {
                  const cfg = ACTION_HISTORY_CONFIG[entry.action] || { label: entry.action, dot: "bg-slate-400", text: "text-muted-foreground" };
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
                          <span className="text-xs text-muted-foreground/70 whitespace-nowrap tabular-nums flex-shrink-0">
                            {fmtDateTime(entry.timestamp)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {entry.user_name}
                          {summary && <span className="text-muted-foreground/60"> · {summary}</span>}
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
      <Dialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>        <DialogContent>
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
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-semibold">Yang akan terjadi:</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Status session kembali ke <strong>Pending</strong></li>
                <li>Data match (baris yang sudah di-match) dipertahankan</li>
                <li>Transaksi PAY/JE tidak lagi ditandai sebagai reconciled</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Anda masih bisa menyesuaikan match dan commit ulang setelahnya.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReverseDialog(false)}>Batal</Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Pilih Match Kandidat</DialogTitle></DialogHeader>

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
              <div className="flex gap-1.5 pb-1" data-testid="candidate-type-filter">
                {types.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setCandidateFilter(t.key)}
                    data-testid={`filter-${t.key}`}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                      candidateFilter === t.key
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {t.label} <span className="opacity-60">({t.count})</span>
                  </button>
                ))}
              </div>
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
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amountFilter}
                      onChange={e => setAmountFilter(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder={rowAmt ? new Intl.NumberFormat("id-ID").format(Math.abs(rowAmt)) : "0"}
                      className="glass-input rounded-lg w-full pl-8 pr-8 h-9 text-sm tabular-nums"
                      data-testid="candidate-amount-filter"
                    />
                    {amountFilter && (
                      <button
                        onClick={() => setAmountFilter("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        data-testid="clear-amount-filter"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
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
                      className="w-full text-left p-3 rounded-lg border border-border/30 hover:bg-foreground/5 transition flex items-center gap-3"
                      data-testid="br-candidate">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-mono">
                          {c.doc_no}
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-sans font-semibold",
                            c.target_type === "journal_entry"
                              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                          )}>
                            {c.target_type === "journal_entry" ? "JE" : "PAY"}
                          </span>
                          {c.loose && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded">loose</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.payee_name || c.description || c.target_type} · {fmtDate(c.date)} · <span className="tabular-nums">{fmtRp(c.amount)}</span>
                        </div>
                      </div>
                      {c.score != null && (
                        <div className={cn("px-2 py-1 rounded text-xs font-semibold tabular-nums flex-shrink-0", c.score >= 0.8 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>{Math.round(c.score * 100)}%</div>
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
              <Label>Catatan exception</Label>
              <Textarea rows={3} value={exceptionNote} onChange={e => setExceptionNote(e.target.value)} placeholder="Mis: Biaya bank otomatis, belum direkam di sistem..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExceptionRowId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleMarkException}>Tandai Exception</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sprint F v2: Bulk auto-accept dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Auto-Accept</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Terima otomatis semua baris yang belum di-match jika confidence score &ge; threshold yang dipilih.</p>
            <div className="space-y-1">
              <Label>Min. confidence score: {Math.round(bulkMinScore * 100)}%</Label>
              <input type="range" min="0.5" max="1.0" step="0.05" value={bulkMinScore}
                onChange={e => setBulkMinScore(Number(e.target.value))}
                className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>50% (lebih longgar)</span><span>100% (sangat ketat)</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Batal</Button>
            <Button onClick={handleBulkAccept} disabled={acting} className="gap-1.5">
              {acting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Jalankan Bulk Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiTile({ label, value, tone = "neutral" }) {
  const cls = { neutral: "", emerald: "text-emerald-700 dark:text-emerald-400", red: "text-red-700 dark:text-red-400", amber: "text-amber-700 dark:text-amber-400" }[tone] || "";
  return (
    <div className="glass-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums mt-0.5", cls)}>{value}</div>
    </div>
  );
}
