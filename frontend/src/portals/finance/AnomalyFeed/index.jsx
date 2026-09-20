/** Phase 7D — Anomaly Feed (Finance).
 * Lists anomaly_events with filter + triage actions + detail drawer.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce"; // Phase 5C.5
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, Play, Flag,
  RefreshCw, Filter, ChevronRight, Search, Shield, Eye, ArrowUpDown, Calendar,
  TrendingUp, Info, Zap, ExternalLink, FileText, DollarSign,
  Download, UserPlus, MessageSquare, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtRelative, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import useExcelExport from "@/hooks/useExcelExport";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import AnomalyAnalyticsDashboard from "@/components/shared/AnomalyAnalyticsDashboard"; // Phase 5C.6
import { ThresholdSettingsDialog } from "./ThresholdSettingsDialog";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";

const SEVERITY_LABELS = {
  severe: "Severe",
  mild: "Mild",
  none: "None",
};

const STATUS_LABELS = {
  open: "Baru",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  resolved: "Resolved",
  false_positive: "False Positive",
};

function severityStyle(sev) {
  if (sev === "severe") return "bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/30";
  if (sev === "mild") return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30";
}

function statusStyle(st) {
  switch (st) {
    case "open":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    case "acknowledged":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "investigating":
      return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    case "resolved":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "false_positive":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-muted";
  }
}

export default function AnomalyFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [types, setTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [users, setUsers] = useState([]); // Phase 5C.3: for assignment
  const [showAnalytics, setShowAnalytics] = useState(false); // Phase 5C.6
  const { downloading, exportXlsx } = useExcelExport();
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets } = useOutletScope();

  // Filters
  const [fType, setFType] = useState("");
  const [fSeverity, setFSeverity] = useState("");
  const [fStatus, setFStatus] = useState("open");
  const [fOutlet, setFOutlet] = useState("");
  const [fQuery, setFQuery] = useState("");
  const [fPeriod, setFPeriod] = useState(""); // Phase 5C.1: Period filter
  
  // Pagination & Sorting (Phase 5C.1)
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [sortBy, setSortBy] = useState("newest");
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  
  // Phase 5C.5: Debounced search query
  const debouncedQuery = useDebounce(fQuery, 300);

  async function load() {
    setLoading(true);
    try {
      const params = {
        type: fType || undefined,
        severity: fSeverity || undefined,
        status: fStatus || undefined,
        outlet_id: fOutlet || undefined,
        page,
        per_page: perPage,
      };
      
      // Phase 5C.1: Period filter (date_from/date_to)
      if (fPeriod) {
        params.date_from = `${fPeriod}-01`;
        const [y, m] = fPeriod.split("-").map(Number);
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
        params.date_to = nextMonth;
      }
      
      const res = await api.get("/anomalies", { params });
      const data = unwrap(res) || [];
      setItems(data);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get("/anomalies/types").then((r) => setTypes(unwrap(r) || [])).catch(() => {});
    // Load last scan info
    api.get("/anomalies/last-scan").then((r) => setLastScan(unwrap(r))).catch(() => {});
    // Phase 5C.3: Load users for assignment dropdown
    api.get("/admin/users").then((r) => {
      const allUsers = unwrap(r) || [];
      // Filter to finance/admin users only
      const financeUsers = allUsers.filter(u => 
        u.roles?.some(role => 
          role.includes("finance") || role.includes("admin") || role.includes("executive")
        )
      );
      setUsers(financeUsers);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [fType, fSeverity, fStatus, fOutlet, fPeriod, page]); // eslint-disable-line

  // Open detail when ?id= provided
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) {
      setSelected(null);
      return;
    }
    const found = items.find((i) => i.id === id);
    if (found) setSelected(found);
    else {
      api.get(`/anomalies/${id}`).then((r) => setSelected(unwrap(r))).catch(() => setSelected(null));
    }
  }, [searchParams, items]);

  // Phase 5C.1: Sorting + search filtering (Phase 5C.5: uses debounced query)
  const sortedAndFiltered = useMemo(() => {
    // First, filter by search (debounced)
    let results = items;
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      results = items.filter((i) =>
        (i.title || "").toLowerCase().includes(q)
        || (i.message || "").toLowerCase().includes(q),
      );
    }
    
    // Then, sort
    const sorted = [...results];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case "severity":
        // severe > mild > none
        sorted.sort((a, b) => {
          const sMap = { severe: 3, mild: 2, none: 1 };
          return (sMap[b.severity] || 0) - (sMap[a.severity] || 0);
        });
        break;
      case "amount":
        sorted.sort((a, b) => (b.observed_value || 0) - (a.observed_value || 0));
        break;
      default:
        break;
    }
    return sorted;
  }, [items, debouncedQuery, sortBy]);

  async function runScan(opts = {}) {
    setScanning(true);
    setScanResult(null);
    try {
      const payload = {
        days: opts.days || 14,
        as_of_date: opts.as_of_date || undefined,
        period: opts.period || undefined,
      };
      const res = await api.post("/anomalies/scan", payload);
      const data = unwrap(res);
      setScanResult(data);
      toast.success(`Scan selesai — ${data.counts.total} anomaly ditemukan/diperbarui`);
      setLastScan({ last_scan_at: new Date().toISOString(), counts: data.counts });
      await load();
    } catch (e) {
      toast.error("Scan gagal: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    } finally {
      setScanning(false);
    }
  }

  async function triage(id, status, note, assignedTo = null) {
    try {
      const payload = { status, note: note || null };
      if (assignedTo) payload.assigned_to = assignedTo; // Phase 5C.3
      await api.post(`/anomalies/${id}/triage`, payload);
      toast.success(`Status: ${STATUS_LABELS[status] || status}`);
      setSelected(null);
      setSearchParams((p) => {
        const n = new URLSearchParams(p);
        n.delete("id");
        return n;
      });
      await load();
    } catch (e) {
      toast.error("Gagal update: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    }
  }

  // Phase 5C.3: CSV Export
  async function exportCSV() {
    try {
      const params = new URLSearchParams();
      if (fType) params.set("type", fType);
      if (fSeverity) params.set("severity", fSeverity);
      if (fStatus) params.set("status", fStatus);
      if (fOutlet) params.set("outlet_id", fOutlet);
      if (fPeriod) {
        params.set("date_from", `${fPeriod}-01`);
        const [y, m] = fPeriod.split("-").map(Number);
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
        params.set("date_to", nextMonth);
      }
      
      const url = `/anomalies/export/csv?${params.toString()}`;
      window.open(`${import.meta.env.REACT_APP_BACKEND_URL}/api${url}`, "_blank");
      toast.success("Export CSV dimulai...");
    } catch (e) {
      toast.error("Export gagal: " + e.message);
    }
  }

  const counts = useMemo(() => {
    const c = { total: items.length, severe: 0, mild: 0, open: 0 };
    items.forEach((i) => {
      if (i.severity === "severe") c.severe++;
      else if (i.severity === "mild") c.mild++;
      if (i.status === "open") c.open++;
    });
    return c;
  }, [items]);

  return (
    <div className="space-y-4" data-testid="anomaly-feed-page">
      {/* Header strip */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center",
              counts.severe > 0 ? "bg-red-500/15 text-red-700" :
              counts.mild > 0 ? "bg-amber-500/15 text-amber-700" :
              "bg-emerald-500/15 text-emerald-700",
            )}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Anomaly Detection Feed</h2>
              <p className="text-xs text-muted-foreground">
                Deteksi real-time deviasi sales, harga vendor, lead time, dan spike kas/AP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showAnalytics ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAnalytics(!showAnalytics)}
              data-testid="anomaly-analytics-toggle"
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Analytics
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => {
                const params = {};
                if (fType) params.type = fType;
                if (fSeverity) params.severity = fSeverity;
                if (fStatus) params.status = fStatus;
                if (fOutlet) params.outlet_id = fOutlet;
                if (fPeriod) {
                  params.date_from = `${fPeriod}-01`;
                  const [y, m] = fPeriod.split("-").map(Number);
                  params.date_to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
                }
                exportXlsx("/anomalies/export/xlsx", "anomaly_feed.xlsx", params);
              }}
              disabled={downloading}
              data-testid="anomaly-export-xlsx-btn"
            >
              <Download className="h-4 w-4 mr-1.5" />
              {downloading ? "Mengunduh..." : "Export Excel"}
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="anomaly-reload-btn">
              <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
              Reload
            </Button>
            <Button onClick={() => setShowScanDialog(true)} disabled={scanning} data-testid="anomaly-scan-btn">
              <Play className={cn("h-4 w-4 mr-1.5", scanning && "animate-pulse")} />
              {scanning ? "Scanning…" : "Run Scan"}
            </Button>
            <Button variant="outline" size="icon"
              onClick={() => setShowThresholdSettings(true)}
              title="Pengaturan Threshold Anomaly"
              data-testid="anomaly-threshold-settings-btn"
              className="h-9 w-9">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <SummaryTile label="Total Filtered" value={counts.total} tone="neutral" testid="sum-total" />
          <SummaryTile label="Severe" value={counts.severe} tone="severe" testid="sum-severe" />
          <SummaryTile label="Mild" value={counts.mild} tone="mild" testid="sum-mild" />
          <SummaryTile label="Open" value={counts.open} tone="open" testid="sum-open" />
        </div>
        {/* Last scan indicator */}
        {lastScan && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground" data-testid="anomaly-last-scan-info">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Scan terakhir: <strong>{fmtRelative(lastScan.last_scan_at)}</strong>
            {lastScan.counts && (
              <span className="ml-1 text-muted-foreground/70">
                · Sales: {lastScan.counts.sales_deviation || 0}
                · Vendor: {lastScan.counts.vendor || 0}
                · AP: {lastScan.counts.ap_cash_spike || 0}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Phase 5C.6: Analytics Dashboard (collapsible) */}
      {showAnalytics && (
        <div className="glass-card p-5">
          <AnomalyAnalyticsDashboard days={30} />
        </div>
      )}

      {/* Filter bar (Phase 5C.1 enhanced) */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Filter className="h-3.5 w-3.5" /> Filter & Sort
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <SimpleSelect value={sortBy} onValueChange={setSortBy}
              className="glass-input rounded-lg px-2.5 h-8 text-xs" testId="anomaly-sort"
              options={[
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" },
                { value: "severity", label: "By Severity" },
                { value: "amount", label: "By Amount" },
              ]} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-[11px]">Period</Label>
            <div className="relative mt-1">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="month"
                value={fPeriod}
                onChange={(e) => {
                  setFPeriod(e.target.value);
                  setPage(1); // Reset to page 1
                }}
                placeholder="YYYY-MM"
                className="pl-8 h-9 text-sm"
                data-testid="anomaly-filter-period"
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Tipe</Label>
            <SimpleSelect value={fType} onValueChange={(v) => { setFType(v); setPage(1); }}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-type" placeholder="Semua Tipe"
              options={[{ value: "", label: "Semua Tipe" }, ...types.map((t) => ({ value: t.value, label: t.label }))]} />
          </div>
          <div>
            <Label className="text-[11px]">Severity</Label>
            <SimpleSelect value={fSeverity} onValueChange={(v) => { setFSeverity(v); setPage(1); }}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-severity" placeholder="Semua"
              options={[
                { value: "", label: "Semua" },
                { value: "severe", label: "Severe" },
                { value: "mild", label: "Mild" },
              ]} />
          </div>
          <div>
            <Label className="text-[11px]">Status</Label>
            <SimpleSelect value={fStatus} onValueChange={(v) => { setFStatus(v); setPage(1); }}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-status" placeholder="Semua Status"
              options={[
                { value: "", label: "Semua Status" },
                { value: "open", label: "Open" },
                { value: "acknowledged", label: "Acknowledged" },
                { value: "investigating", label: "Investigating" },
                { value: "resolved", label: "Resolved" },
                { value: "false_positive", label: "False Positive" },
              ]} />
          </div>
          <div>
            <Label className="text-[11px]">Outlet</Label>
            <SimpleSelect value={fOutlet} onValueChange={(v) => { setFOutlet(v); setPage(1); }}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-outlet" placeholder="Semua Outlet"
              options={[{ value: "", label: "Semua Outlet" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]} />
          </div>
          <div>
            <Label className="text-[11px]">Cari</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={fQuery} onChange={(e) => setFQuery(e.target.value)}
                placeholder="Cari judul / pesan"
                className="pl-8 h-9 text-sm" data-testid="anomaly-filter-query" />
            </div>
          </div>
        </div>
      </div>

      {/* List (Phase 5C.1: sorted & paginated) */}
      <div className="glass-card p-2 sm:p-3">
        {loading ? (
          <LoadingState rows={5} />
        ) : sortedAndFiltered.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Tidak ada anomaly ditemukan"
            description="Coba ubah filter atau jalankan Scan untuk refresh."
          />
        ) : (
          <>
            <ul className="divide-y divide-border/40">
              {sortedAndFiltered.map((ev) => (
                <AnomalyRow
                  key={ev.id}
                  ev={ev}
                  onOpen={() => {
                    setSelected(ev);
                    setSearchParams((p) => {
                      const n = new URLSearchParams(p);
                      n.set("id", ev.id);
                      return n;
                    });
                  }}
                />
              ))}
            </ul>
            
            {/* Pagination controls (Phase 5C.1) */}
            {meta.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40 text-sm">
                <div className="text-muted-foreground">
                  Page {meta.page || page} of {meta.total_pages} · {meta.total || sortedAndFiltered.length} total
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    data-testid="anomaly-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= (meta.total_pages || 1)}
                    data-testid="anomaly-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Sheet */}
      <AnomalyDetail
        event={selected}
        onClose={() => {
          setSelected(null);
          setSearchParams((p) => {
            const n = new URLSearchParams(p);
            n.delete("id");
            return n;
          });
        }}
        onTriage={triage}
        types={types}
        users={users} // Phase 5C.3
      />

      {/* Scan Dialog */}
      {showScanDialog && (
        <ScanDialog
          scanning={scanning}
          scanResult={scanResult}
          onClose={() => { setShowScanDialog(false); setScanResult(null); }}
          onRunScan={(opts) => runScan(opts)}
        />
      )}

      {/* Threshold Settings Dialog */}
      {showThresholdSettings && (
        <ThresholdSettingsDialog onClose={() => setShowThresholdSettings(false)} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone, testid }) {
  const toneClass = {
    severe: "text-red-600 dark:text-red-400",
    mild: "text-amber-600 dark:text-amber-400",
    open: "text-sky-600 dark:text-sky-400",
    neutral: "text-foreground",
  }[tone] || "text-foreground";
  return (
    <div className="glass-input rounded-xl p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", toneClass)}>{value}</div>
    </div>
  );
}

// ── Scan Dialog ───────────────────────────────────────────────────────────────
function ScanDialog({ scanning, scanResult, onClose, onRunScan }) {
  const today = new Date().toISOString().slice(0, 10);
  const curMonth = today.slice(0, 7);
  const [days, setDays] = useState(14);
  const [asOfDate, setAsOfDate] = useState(today);
  const [period, setPeriod] = useState(curMonth);
  const hasResult = scanResult && !scanning;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="scan-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" /> Konfigurasi Anomaly Scan
          </DialogTitle>
        </DialogHeader>

        {!hasResult ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Scan akan mendeteksi deviasi penjualan, lonjakan harga vendor, lead-time lambat, dan spike kas/AP.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Window hari</Label>
                <SimpleSelect
                  value={String(days)}
                  onValueChange={v => setDays(Number(v))}
                  options={[
                    { value: "7", label: "7 hari" },
                    { value: "14", label: "14 hari" },
                    { value: "30", label: "30 hari" },
                    { value: "90", label: "90 hari" },
                  ]}
                  className="glass-input rounded-lg w-full px-3 h-9 text-sm"
                  testId="scan-days-select"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tanggal referensi (As of)</Label>
                <Input type="date" value={asOfDate}
                  onChange={e => setAsOfDate(e.target.value)}
                  className="glass-input h-9 text-sm" data-testid="scan-asof-date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Periode AP/Kas (bulan)</Label>
              <Input type="month" value={period}
                onChange={e => setPeriod(e.target.value)}
                className="glass-input h-9 text-sm" data-testid="scan-period" />
              <p className="text-[10px] text-muted-foreground">Digunakan untuk deteksi spike kas/AP bulan tertentu</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2" data-testid="scan-result-panel">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Scan Selesai
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ResultTile label="Sales Deviation" value={scanResult.counts?.sales_deviation || 0} />
              <ResultTile label="Vendor" value={scanResult.counts?.vendor || 0} />
              <ResultTile label="AP / Kas" value={scanResult.counts?.ap_cash_spike || 0} />
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <strong>Total: {scanResult.counts?.total || 0}</strong> anomaly ditemukan/diperbarui
              <div className="text-xs text-muted-foreground mt-1">
                Per tanggal {asOfDate} · Periode AP: {period}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="scan-dialog-close">Tutup</Button>
          {!hasResult && (
            <Button onClick={() => onRunScan({ days, as_of_date: asOfDate, period })}
              disabled={scanning} data-testid="scan-dialog-run">
              <Play className={cn("h-4 w-4 mr-1.5", scanning && "animate-pulse")} />
              {scanning ? "Scanning..." : "Jalankan Scan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultTile({ label, value }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function AnomalyRow({ ev, onOpen }) {
  const sev = ev.severity || "none";
  const dev = typeof ev.deviation_pct === "number" ? ev.deviation_pct : null;
  const amount = ev.observed_value || 0;
  
  return (
    <li
      className="p-3 sm:p-4 hover:bg-foreground/5 rounded-lg cursor-pointer transition-colors group"
      onClick={onOpen}
      data-testid={`anomaly-row-${ev.id}`}
    >
      {/* Phase 5C.1: Improved visual hierarchy */}
      <div className="flex items-start gap-3">
        {/* Severity indicator dot */}
        <div className="mt-1 shrink-0">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            sev === "severe" ? "bg-red-500/15 text-red-700 dark:text-red-300" :
            sev === "mild" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          )}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded", severityStyle(sev))}>
              {SEVERITY_LABELS[sev] || sev}
            </span>
            <span className={cn("text-[10px] uppercase font-semibold px-2 py-0.5 rounded", statusStyle(ev.status))}>
              {STATUS_LABELS[ev.status] || ev.status}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-foreground/5 text-muted-foreground">
              {ev.type_label || ev.type}
            </span>
            {ev.outlet_name && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300">
                {ev.outlet_name}
              </span>
            )}
          </div>
          
          {/* Title */}
          <div className="font-semibold text-base group-hover:text-primary transition-colors">
            {ev.title}
          </div>
          
          {/* Message preview */}
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {ev.message}
          </div>
          
          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span>{fmtRelative(ev.created_at)}</span>
            {ev.period && <span>· Period: {ev.period}</span>}
          </div>
        </div>
        
        {/* Right side: deviation & amount */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {dev !== null && (
            <div className={cn(
              "text-base font-bold tabular-nums px-2 py-0.5 rounded",
              dev >= 0 ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}>
              {dev >= 0 ? "+" : ""}{dev.toFixed(1)}%
            </div>
          )}
          {amount > 0 && ev.type !== "vendor_leadtime" && (
            <div className="text-xs font-semibold tabular-nums text-muted-foreground">
              {fmtRp(amount)}
            </div>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
        </div>
      </div>
    </li>
  );
}

// Phase 5C.2: Root cause suggestions & module links by anomaly type
function getRootCauseSuggestion(event) {
  const type = event.type;
  const ctx = event.context || {};
  
  switch (type) {
    case "sales_deviation":
      return {
        reason: "Penjualan outlet berbeda signifikan dari baseline historis (rata-rata + stddev).",
        causes: [
          "Perubahan operasional (tutup sementara, renovasi, event khusus)",
          "Perubahan kompetitor atau pasar lokal",
          "Masalah sistem POS atau input data",
          "Seasonality atau hari libur yang tidak diprediksi",
        ],
        actions: [
          { label: "Cek Daily Sales", link: "/outlet/daily-sales" },
          { label: "Lihat Outlet Detail", link: ctx.outlet_id ? `/outlet/${ctx.outlet_id}` : null },
        ],
      };
    case "vendor_price_spike":
      return {
        reason: "Harga vendor naik drastis dibanding rata-rata historis pembelian item ini.",
        causes: [
          "Vendor menaikkan harga resmi",
          "Perubahan currency rate (import)",
          "Salah input harga di PO",
          "Item berbeda tapi kode sama",
        ],
        actions: [
          { label: "Cek Purchase Orders", link: "/procurement/pos" },
          { label: "Cek Vendor Detail", link: ctx.vendor_id ? `/procurement/vendors/${ctx.vendor_id}` : null },
        ],
      };
    case "vendor_leadtime":
      return {
        reason: "Waktu pengiriman vendor melebihi threshold (avg + threshold_days).",
        causes: [
          "Vendor terlambat kirim",
          "Logistik delay",
          "Salah input tanggal PO/GR",
          "Item out of stock dari vendor",
        ],
        actions: [
          { label: "Cek Goods Receipt", link: "/procurement/goods-receipts" },
          { label: "Cek Vendor Performance", link: ctx.vendor_id ? `/procurement/vendors/${ctx.vendor_id}` : null },
        ],
      };
    case "ap_cash_spike":
      return {
        reason: "Total AP atau kas keluar harian melebihi threshold drastis.",
        causes: [
          "Pembayaran bulk besar (supplier payment run)",
          "Invoice duplikat",
          "Pembayaran di-advance tanpa approval",
          "Transaksi tidak biasa (fraud risk)",
        ],
        actions: [
          { label: "Cek AP Aging", link: "/finance/ap-aging" },
          { label: "Cek Journal Entries", link: "/finance/journal-entries" },
        ],
      };
    default:
      return {
        reason: "Anomali terdeteksi berdasarkan threshold konfigurasi sistem.",
        causes: ["Review detail anomaly untuk menentukan root cause."],
        actions: [],
      };
  }
}

function AnomalyDetail({ event, onClose, onTriage, users = [] }) {
  const [note, setNote] = useState("");
  const [assignedTo, setAssignedTo] = useState(""); // Phase 5C.3
  
  useEffect(() => {
    setNote("");
    setAssignedTo(event?.assigned_to || "");
  }, [event?.id]);

  if (!event) return null;
  const sev = event.severity || "none";
  const ctx = event.context || {};
  const disabled = event.status === "resolved" || event.status === "false_positive";
  
  // Phase 5C.2: Get root cause analysis
  const rootCause = getRootCauseSuggestion(event);
  
  // Phase 5C.3: Comments timeline
  const comments = event.comments || [];

  return (
    <Sheet open={!!event} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" data-testid="anomaly-detail-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded", severityStyle(sev))}>
              {SEVERITY_LABELS[sev] || sev}
            </span>
            <span>{event.title}</span>
          </SheetTitle>
          <SheetDescription>
            {event.type_label || event.type} · {fmtDateTime(event.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {/* Phase 5C.2: Structured explanation sections */}
          
          {/* 1. Reason & Message */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>What Happened</span>
            </div>
            <div className="glass-input rounded-xl p-3 text-sm whitespace-pre-wrap">
              {event.message}
            </div>
          </div>

          {/* 2. Key Numbers: Expected vs Actual + Impact */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Key Numbers</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-input rounded-xl p-3 border-2 border-amber-500/20">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
                  Actual (Observed)
                </div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {event.type === "vendor_leadtime" 
                    ? `${event.observed_value?.toFixed?.(1) || event.observed_value} days`
                    : fmtRp(event.observed_value)
                  }
                </div>
              </div>
              
              <div className="glass-input rounded-xl p-3 border-2 border-sky-500/20">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
                  Expected (Baseline)
                </div>
                <div className="text-lg font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                  {event.type === "vendor_leadtime"
                    ? `${event.baseline_value?.toFixed?.(1) || event.baseline_value} days`
                    : fmtRp(event.baseline_value)
                  }
                </div>
              </div>
              
              {event.deviation_pct != null && (
                <div className="glass-input rounded-xl p-3 col-span-2 border-2 border-red-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
                        Deviation (Impact)
                      </div>
                      <div className={cn(
                        "text-xl font-bold tabular-nums",
                        event.deviation_pct >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {event.deviation_pct >= 0 ? "+" : ""}{event.deviation_pct.toFixed(1)}%
                      </div>
                    </div>
                    {event.z_score != null && (
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
                          Z-Score (σ)
                        </div>
                        <div className="text-base font-semibold tabular-nums text-muted-foreground">
                          {event.z_score.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Threshold Applied */}
          {event.threshold_snapshot && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Zap className="h-4 w-4" />
                <span>Detection Threshold</span>
              </div>
              <div className="glass-input rounded-xl p-3 text-xs">
                <div className="space-y-1">
                  {Object.entries(event.threshold_snapshot).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-mono font-semibold">{typeof val === "number" ? val.toFixed(2) : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Root Cause Analysis (Phase 5C.2) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Possible Root Causes</span>
            </div>
            <div className="glass-input rounded-xl p-3 space-y-2">
              <div className="text-xs text-muted-foreground italic">
                {rootCause.reason}
              </div>
              <ul className="text-xs space-y-1 pl-4">
                {rootCause.causes.map((cause, i) => (
                  <li key={i} className="list-disc">{cause}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* 5. Suggested Actions & Links (Phase 5C.2) */}
          {rootCause.actions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <ExternalLink className="h-4 w-4" />
                <span>Suggested Next Steps</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rootCause.actions.map((action, i) => 
                  action.link ? (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      asChild
                      className="text-xs"
                    >
                      <a href={action.link} target="_blank" rel="noopener noreferrer">
                        {action.label}
                        <ExternalLink className="h-3 w-3 ml-1.5" />
                      </a>
                    </Button>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Context metadata */}
          {ctx && Object.keys(ctx).length > 0 && (
            <div className="glass-input rounded-xl p-3 text-xs">
              <div className="font-semibold mb-1 text-muted-foreground uppercase text-[10px] tracking-wide">Additional Context</div>
              <div className="space-y-0.5">
                {Object.entries(ctx).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="font-mono">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source link */}
          {event.source_type && event.source_id && (
            <div className="text-xs text-muted-foreground">
              Source: <code className="font-mono">{event.source_type} · {event.source_doc_no || event.source_id.slice(0, 8)}</code>
            </div>
          )}

          {/* History of actions */}
          {event.acknowledged_at && (
            <div className="text-xs text-muted-foreground">
              Acknowledged: {fmtDateTime(event.acknowledged_at)}
              {event.acknowledged_note && ` — "${event.acknowledged_note}"`}
            </div>
          )}
          {event.resolved_at && (
            <div className="text-xs text-muted-foreground">
              Resolved: {fmtDateTime(event.resolved_at)}
              {event.resolution_note && ` — "${event.resolution_note}"`}
            </div>
          )}

          {/* Phase 5C.3: Comments Timeline */}
          {comments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>Activity Timeline</span>
              </div>
              <div className="glass-input rounded-xl p-3 space-y-3 max-h-48 overflow-y-auto">
                {comments.map((c, i) => (
                  <div key={i} className="border-l-2 border-sky-500/30 pl-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground">{c.user_name}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtRelative(c.timestamp)}</span>
                    </div>
                    <div className="text-muted-foreground mb-1">
                      Action: <span className={cn("font-semibold", statusStyle(c.action))}>{STATUS_LABELS[c.action] || c.action}</span>
                    </div>
                    {c.note && <div className="text-foreground italic">"{c.note}"</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 5C.3: Assign User */}
          {!disabled && users.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <UserPlus className="h-4 w-4" />
                <span>Assign To</span>
              </div>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="w-full" data-testid="anomaly-assign-user">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignedTo && assignedTo !== event.assigned_to && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Will assign on next action
                </div>
              )}
            </div>
          )}

          {/* Note input */}
          {!disabled && (
            <div>
              <Label className="text-xs">Catatan triage (opsional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tulis konteks atau alasan keputusan…"
                rows={3}
                className="mt-1"
                data-testid="anomaly-triage-note"
              />
            </div>
          )}
        </div>

        <SheetFooter className="flex-col sm:flex-col gap-2">
          {!disabled && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "acknowledged", note, assignedTo)}
                data-testid="anomaly-ack-btn"
              >
                <Eye className="h-4 w-4 mr-1.5" /> Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "investigating", note, assignedTo)}
                data-testid="anomaly-investigate-btn"
              >
                <Clock className="h-4 w-4 mr-1.5" /> Investigating
              </Button>
              <Button
                onClick={() => onTriage(event.id, "resolved", note, assignedTo)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="anomaly-resolve-btn"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Resolve
              </Button>
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "false_positive", note, assignedTo)}
                data-testid="anomaly-fp-btn"
              >
                <XCircle className="h-4 w-4 mr-1.5" /> False Positive
              </Button>
            </div>
          )}
          {disabled && (
            <div className="text-xs text-muted-foreground text-center py-2">
              Anomaly sudah {STATUS_LABELS[event.status]}. Tidak ada aksi lanjutan.
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DetailStat({ label, value, isMoney, tone }) {
  const display = value == null ? "—" :
    (isMoney ? fmtRp(Number(value)) : String(value));
  const toneClass = tone === "danger" ? "text-red-600 dark:text-red-400"
                  : tone === "good" ? "text-emerald-600 dark:text-emerald-400"
                  : "";
  return (
    <div className="glass-input rounded-xl p-3">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide font-semibold">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums mt-0.5", toneClass)}>{display}</div>
    </div>
  );
}
