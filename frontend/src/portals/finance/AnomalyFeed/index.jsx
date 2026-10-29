/** Phase 7D — Anomaly Feed (Finance).
 * Lists anomaly_events with filter + triage actions + detail drawer.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce"; // Phase 5C.5
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, Play,
  RefreshCw, Filter, ChevronRight, Search, Shield, Eye, ArrowUpDown, Calendar,
  TrendingUp, Info, Zap, ExternalLink, FileText, ShieldAlert, Inbox,
  Download, UserPlus, MessageSquare, BarChart3, SlidersHorizontal, ListChecks,
} from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtRelative, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useExcelExport from "@/hooks/useExcelExport";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import StatusPill, { statusLabel } from "@/components/shared/StatusPill";
import AnomalyAnalyticsDashboard from "@/components/shared/AnomalyAnalyticsDashboard"; // Phase 5C.6
import { ThresholdSettingsDialog } from "./ThresholdSettingsDialog";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";

const SEVERITY_LABELS = {
  severe: "Severe",
  critical: "Critical",
  high: "High",
  mild: "Mild",
  medium: "Medium",
  low: "Low",
  none: "None",
};

/** Kelompok tampilan severity. Data demo/seed memakai high/medium/low selain severe/mild —
 * tanpa pemetaan ini "HIGH" tampil hijau dan tile Severe/Mild menghitung 0. */
function sevBucket(sev) {
  if (sev === "severe" || sev === "critical" || sev === "high") return "severe";
  if (sev === "mild" || sev === "medium") return "mild";
  return "none";
}

const LABEL = "text-xs font-medium text-muted-foreground";

/** Status triage anomali — label & warna dari kamus global StatusPill. */
const TRIAGE_STATUSES = ["open", "acknowledged", "investigating", "resolved", "false_positive"];

function severityStyle(sev) {
  const b = sevBucket(sev);
  if (b === "severe") return "bg-red-500/15 text-red-800 dark:text-red-300 ring-1 ring-red-500/30";
  if (b === "mild") return "bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/30";
  return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30";
}

function periodRange(fPeriod) {
  if (!fPeriod) return {};
  const [y, m] = fPeriod.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { date_from: `${fPeriod}-01`, date_to: nextMonth };
}

export default function AnomalyFeed({ embedded = false }) {
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
      toast.error("Gagal memuat anomali: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get("/anomalies/types").then((r) => setTypes(unwrap(r) || [])).catch(() => {});
    // Load last scan info
    api.get("/anomalies/last-scan").then((r) => setLastScan(unwrap(r))).catch(() => {});
    // Phase 5C.3: Load users for assignment dropdown
    // UI-04: scoped assignee list (finance staff cannot read /admin/users)
    api.get("/anomalies/assignees").then((r) => setUsers(unwrap(r) || [])).catch(() => {});
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
          return (sMap[sevBucket(b.severity)] || 0) - (sMap[sevBucket(a.severity)] || 0);
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
      toast.success(`Scan selesai — ${data.counts.total} anomali ditemukan/diperbarui`);
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
      toast.success(`Status diperbarui: ${statusLabel(status)}`);
      setSelected(null);
      setSearchParams((p) => {
        const n = new URLSearchParams(p);
        n.delete("id");
        return n;
      });
      await load();
    } catch (e) {
      toast.error("Gagal memperbarui status: " + (e?.response?.data?.errors?.[0]?.message || e.message));
    }
  }

  const counts = useMemo(() => {
    const c = { total: items.length, severe: 0, mild: 0, open: 0 };
    items.forEach((i) => {
      const b = sevBucket(i.severity);
      if (b === "severe") c.severe++;
      else if (b === "mild") c.mild++;
      if (i.status === "open") c.open++;
    });
    return c;
  }, [items]);

  const headerActions = (
    <>
      <Button
        variant={showAnalytics ? "secondary" : "outline"}
        onClick={() => setShowAnalytics(!showAnalytics)}
        aria-pressed={showAnalytics}
        data-testid="anomaly-analytics-toggle"
      >
        <BarChart3 /> Analitik
      </Button>
      <Button
        variant="outline"
        onClick={() => exportXlsx("/anomalies/export/xlsx", "anomaly_feed.xlsx", {
          type: fType || undefined,
          severity: fSeverity || undefined,
          status: fStatus || undefined,
          outlet_id: fOutlet || undefined,
          ...periodRange(fPeriod),
        })}
        disabled={downloading}
        data-testid="anomaly-export-xlsx-btn"
      >
        <Download /> {downloading ? "Mengunduh…" : "Ekspor Excel"}
      </Button>
      <Button variant="outline" size="icon" onClick={load} disabled={loading}
        aria-label="Muat ulang" title="Muat ulang" data-testid="anomaly-reload-btn">
        <RefreshCw className={cn(loading && "animate-spin")} />
      </Button>
      <Button variant="outline" size="icon"
        onClick={() => setShowThresholdSettings(true)}
        aria-label="Pengaturan threshold anomali"
        title="Pengaturan threshold anomali"
        data-testid="anomaly-threshold-settings-btn">
        <SlidersHorizontal />
      </Button>
      <Button onClick={() => setShowScanDialog(true)} disabled={scanning} data-testid="anomaly-scan-btn">
        <Play className={cn(scanning && "animate-pulse")} />
        {scanning ? "Memindai…" : "Jalankan Scan"}
      </Button>
    </>
  );

  return (
    <div data-testid="anomaly-feed-page">
      {!embedded && (
        <PageHeader
          icon={ShieldAlert}
          title="Anomaly Feed"
          subtitle="Deteksi deviasi sales, harga vendor, lead time, dan lonjakan kas/AP"
          actions={headerActions}
        />
      )}

      <div className="space-y-3 lg:space-y-4">
      {embedded && (
        <div className="flex flex-wrap items-center justify-end gap-2">{headerActions}</div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CompactStatCard size="sm" label="Total (filter)" value={counts.total} icon={ListChecks} color="aurora-1" testId="sum-total" />
        <CompactStatCard size="sm" label="Severe" value={counts.severe} icon={AlertTriangle} color="aurora-6" tone={counts.severe ? "danger" : "default"} testId="sum-severe" />
        <CompactStatCard size="sm" label="Mild" value={counts.mild} icon={Info} color="aurora-5" tone={counts.mild ? "warning" : "default"} testId="sum-mild" />
        <CompactStatCard size="sm" label="Open" value={counts.open} icon={Inbox} color="aurora-3" tone="info" testId="sum-open" />
      </div>
      {/* Last scan indicator */}
      {lastScan && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="anomaly-last-scan-info">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
          Scan terakhir: <strong>{fmtRelative(lastScan.last_scan_at)}</strong>
          {lastScan.counts && (
            <span className="ml-1 text-muted-foreground">
              · Sales: {lastScan.counts.sales_deviation || 0}
              · Vendor: {lastScan.counts.vendor || 0}
              · AP: {lastScan.counts.ap_cash_spike || 0}
            </span>
          )}
        </div>
      )}

      {/* Phase 5C.6: Analytics Dashboard (collapsible) */}
      {showAnalytics && (
        <div className="glass-card p-4" data-testid="anomaly-analytics-panel">
          <AnomalyAnalyticsDashboard days={30} />
        </div>
      )}

      {/* Filter bar (Phase 5C.1 enhanced) */}
      <div className="glass-card p-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" /> Filter &amp; urutan
          </h3>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <SimpleSelect value={sortBy} onValueChange={setSortBy} ariaLabel="Urutkan"
              className="glass-input rounded-lg px-2.5 h-8 text-xs w-40" testId="anomaly-sort"
              options={[
                { value: "newest", label: "Terbaru" },
                { value: "oldest", label: "Terlama" },
                { value: "severity", label: "Severity tertinggi" },
                { value: "amount", label: "Nilai terbesar" },
              ]} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <Label htmlFor="anomaly-filter-period" className={LABEL}>Periode</Label>
            <div className="relative mt-1">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="anomaly-filter-period"
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
            <Label className={LABEL}>Tipe</Label>
            <SimpleSelect value={fType} onValueChange={(v) => { setFType(v); setPage(1); }} ariaLabel="Tipe"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-type" placeholder="Semua Tipe"
              options={[{ value: "", label: "Semua Tipe" }, ...types.map((t) => ({ value: t.value, label: t.label }))]} />
          </div>
          <div>
            <Label className={LABEL}>Severity</Label>
            <SimpleSelect value={fSeverity} onValueChange={(v) => { setFSeverity(v); setPage(1); }} ariaLabel="Severity"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-severity" placeholder="Semua"
              options={[
                { value: "", label: "Semua" },
                { value: "severe", label: "Severe" },
                { value: "mild", label: "Mild" },
              ]} />
          </div>
          <div>
            <Label className={LABEL}>Status</Label>
            <SimpleSelect value={fStatus} onValueChange={(v) => { setFStatus(v); setPage(1); }} ariaLabel="Status"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-status" placeholder="Semua Status"
              options={[
                { value: "", label: "Semua Status" },
                ...TRIAGE_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
              ]} />
          </div>
          <div>
            <Label className={LABEL}>Outlet</Label>
            <SimpleSelect value={fOutlet} onValueChange={(v) => { setFOutlet(v); setPage(1); }} ariaLabel="Outlet"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1" testId="anomaly-filter-outlet" placeholder="Semua Outlet"
              options={[{ value: "", label: "Semua Outlet" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]} />
          </div>
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <Label htmlFor="anomaly-filter-query" className={LABEL}>Cari</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="anomaly-filter-query" value={fQuery} onChange={(e) => setFQuery(e.target.value)}
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
            title="Tidak ada anomali ditemukan"
            description="Coba ubah filter atau jalankan scan untuk memperbarui data."
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
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-sm">
                <div className="text-muted-foreground">
                  Halaman {meta.page || page} dari {meta.total_pages} · {meta.total || sortedAndFiltered.length} total
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    data-testid="anomaly-prev-page"
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= (meta.total_pages || 1)}
                    data-testid="anomaly-next-page"
                  >
                    Berikutnya
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
            <Play className="h-4 w-4" /> Konfigurasi Scan Anomali
          </DialogTitle>
        </DialogHeader>

        {!hasResult ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Scan akan mendeteksi deviasi penjualan, lonjakan harga vendor, lead-time lambat, dan spike kas/AP.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm font-medium">Window hari</Label>
                <SimpleSelect
                  ariaLabel="Window hari"
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
                <Label htmlFor="scan-asof-date" className="text-xs md:text-sm font-medium">Tanggal referensi</Label>
                <Input id="scan-asof-date" type="date" value={asOfDate}
                  onChange={e => setAsOfDate(e.target.value)}
                  className="glass-input h-9 text-sm" data-testid="scan-asof-date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scan-period" className="text-xs md:text-sm font-medium">Periode AP/Kas (bulan)</Label>
              <Input id="scan-period" type="month" value={period}
                onChange={e => setPeriod(e.target.value)}
                className="glass-input h-9 text-sm" data-testid="scan-period" />
              <p className="text-xs text-muted-foreground">Digunakan untuk deteksi spike kas/AP bulan tertentu</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2" data-testid="scan-result-panel">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Scan selesai
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CompactStatCard size="sm" label="Deviasi sales" value={scanResult.counts?.sales_deviation || 0} testId="scan-result-sales" />
              <CompactStatCard size="sm" label="Vendor" value={scanResult.counts?.vendor || 0} testId="scan-result-vendor" />
              <CompactStatCard size="sm" label="AP / Kas" value={scanResult.counts?.ap_cash_spike || 0} testId="scan-result-ap" />
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <strong>Total: {scanResult.counts?.total || 0}</strong> anomali ditemukan/diperbarui
              <div className="text-xs text-muted-foreground mt-1">
                Per tanggal {asOfDate} · Periode AP: {period}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="scan-dialog-close">{hasResult ? "Tutup" : "Batal"}</Button>
          {!hasResult && (
            <Button onClick={() => onRunScan({ days, as_of_date: asOfDate, period })}
              disabled={scanning} data-testid="scan-dialog-run">
              <Play className={cn(scanning && "animate-pulse")} />
              {scanning ? "Memindai…" : "Jalankan Scan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnomalyRow({ ev, onOpen }) {
  const sev = ev.severity || "none";
  const bucket = sevBucket(sev);
  const dev = typeof ev.deviation_pct === "number" ? ev.deviation_pct : null;
  const amount = ev.observed_value || 0;
  
  return (
    <li
      className="p-3 hover:bg-foreground/5 rounded-lg cursor-pointer transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Lihat detail: ${ev.title}`}
      data-testid={`anomaly-row-${ev.id}`}
    >
      {/* Phase 5C.1: Improved visual hierarchy */}
      <div className="flex items-start gap-3">
        {/* Severity indicator dot */}
        <div className="mt-1 shrink-0">
          <div className={cn(
            "h-9 w-9 rounded-[calc(var(--radius)-2px)] flex items-center justify-center",
            bucket === "severe" ? "bg-red-500/15 text-red-800 dark:text-red-300" :
            bucket === "mild" ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" :
            "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
          )}>
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn("text-[11px] uppercase font-bold px-2 py-0.5 rounded", severityStyle(sev))}>
              {SEVERITY_LABELS[sev] || sev}
            </span>
            <StatusPill status={ev.status} />
            <span className="text-xs px-2 py-0.5 rounded bg-foreground/5 text-muted-foreground">
              {ev.type_label || ev.type}
            </span>
            {ev.outlet_name && (
              <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-800 dark:text-sky-300">
                {ev.outlet_name}
              </span>
            )}
          </div>
          
          {/* Title */}
          <div className="font-semibold text-sm md:text-base group-hover:text-primary transition-colors">
            {ev.title}
          </div>
          
          {/* Message preview */}
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {ev.message}
          </div>
          
          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{fmtRelative(ev.created_at)}</span>
            {ev.period && <span>· Periode: {ev.period}</span>}
          </div>
        </div>
        
        {/* Right side: deviation & amount */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {dev !== null && (
            <div className={cn(
              "text-sm font-semibold tabular-nums px-2 py-0.5 rounded",
              dev >= 0 ? "bg-red-500/10 text-red-800 dark:text-red-400" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-400",
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
          { label: "Lihat tren di Reports", link: "/finance/reports?tab=comparatives" },
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
          { label: "Cek Purchase Orders", link: "/procurement/po" },
          { label: "Cek daftar vendor", link: "/procurement/vendors" },
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
          { label: "Cek Goods Receipt", link: "/procurement/gr" },
          { label: "Cek Vendor Scorecard", link: "/procurement/vendor-scorecard" },
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
          { label: "Cek AP Aging", link: "/finance/payments-hub?tab=ap-aging" },
          { label: "Cek Journals", link: "/finance/journals" },
        ],
      };
    default:
      return {
        reason: "Anomali terdeteksi berdasarkan threshold konfigurasi sistem.",
        causes: ["Tinjau detail anomali untuk menentukan akar penyebab."],
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
            <span className={cn("text-[11px] uppercase font-bold px-2 py-0.5 rounded", severityStyle(sev))}>
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
              <span>Apa yang terjadi</span>
            </div>
            <div className="glass-input rounded-xl p-3 text-sm whitespace-pre-wrap">
              {event.message}
            </div>
          </div>

          {/* 2. Key Numbers: Expected vs Actual + Impact */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Angka kunci</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-input rounded-xl p-3 border-2 border-amber-500/20">
                <div className="text-[11px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
                  Aktual (teramati)
                </div>
                <div className="text-lg font-bold text-amber-800 dark:text-amber-400 tabular-nums">
                  {event.type === "vendor_leadtime" 
                    ? `${event.observed_value?.toFixed?.(1) || event.observed_value} hari`
                    : fmtRp(event.observed_value)
                  }
                </div>
              </div>
              
              <div className="glass-input rounded-xl p-3 border-2 border-sky-500/20">
                <div className="text-[11px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
                  Ekspektasi (baseline)
                </div>
                <div className="text-lg font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                  {event.type === "vendor_leadtime"
                    ? `${event.baseline_value?.toFixed?.(1) || event.baseline_value} hari`
                    : fmtRp(event.baseline_value)
                  }
                </div>
              </div>
              
              {event.deviation_pct != null && (
                <div className="glass-input rounded-xl p-3 col-span-2 border-2 border-red-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
                        Deviasi (dampak)
                      </div>
                      <div className={cn(
                        "text-xl font-bold tabular-nums",
                        event.deviation_pct >= 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                      )}>
                        {event.deviation_pct >= 0 ? "+" : ""}{event.deviation_pct.toFixed(1)}%
                      </div>
                    </div>
                    {event.z_score != null && (
                      <div className="text-right">
                        <div className="text-[11px] uppercase text-muted-foreground tracking-wide font-semibold mb-1">
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
                <span>Threshold deteksi</span>
              </div>
              <div className="glass-input rounded-xl p-3 text-xs">
                <div className="space-y-1">
                  {Object.entries(event.threshold_snapshot).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-semibold tabular-nums">{typeof val === "number" ? val.toFixed(2) : String(val)}</span>
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
              <span>Kemungkinan penyebab</span>
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
                <span>Langkah berikutnya</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rootCause.actions.map((action, i) => 
                  action.link ? (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={action.link} target="_blank" rel="noopener noreferrer" data-testid={`anomaly-action-link-${i}`}>
                        {action.label}
                        <ExternalLink />
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
              <div className="font-semibold mb-1 text-muted-foreground uppercase text-[11px] tracking-wide">Konteks tambahan</div>
              <div className="space-y-0.5">
                {Object.entries(ctx).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="tabular-nums break-all text-right">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source link */}
          {event.source_type && event.source_id && (
            <div className="text-xs text-muted-foreground">
              Sumber: <span className="font-medium tabular-nums text-foreground">{event.source_type} · {event.source_doc_no || event.source_id.slice(0, 8)}</span>
            </div>
          )}

          {/* History of actions */}
          {event.acknowledged_at && (
            <div className="text-xs text-muted-foreground">
              Ditinjau: {fmtDateTime(event.acknowledged_at)}
              {event.acknowledged_note && ` — "${event.acknowledged_note}"`}
            </div>
          )}
          {event.resolved_at && (
            <div className="text-xs text-muted-foreground">
              Selesai: {fmtDateTime(event.resolved_at)}
              {event.resolution_note && ` — "${event.resolution_note}"`}
            </div>
          )}

          {/* Phase 5C.3: Comments Timeline */}
          {comments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>Riwayat aktivitas</span>
              </div>
              <div className="glass-input rounded-xl p-3 space-y-3 max-h-48 overflow-y-auto">
                {comments.map((c, i) => (
                  <div key={i} className="border-l-2 border-sky-500/30 pl-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground">{c.user_name}</span>
                      <span className="text-xs text-muted-foreground">{fmtRelative(c.timestamp)}</span>
                    </div>
                    <div className="text-muted-foreground mb-1">
                      Aksi: <StatusPill status={c.action} />
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
                <span>Tugaskan ke</span>
              </div>
              {/* Bug fix: shadcn SelectItem tidak boleh value="" (Radix error) → SimpleSelect memetakan "" ↔ sentinel. */}
              <SimpleSelect
                value={assignedTo}
                onValueChange={setAssignedTo}
                ariaLabel="Tugaskan ke"
                placeholder="Pilih pengguna…"
                className="w-full"
                testId="anomaly-assign-user"
                options={[
                  { value: "", label: "Belum ditugaskan" },
                  ...users.map(u => ({ value: u.id, label: u.full_name || u.email })),
                ]}
              />
              {assignedTo && assignedTo !== event.assigned_to && (
                <div className="text-xs text-amber-800 dark:text-amber-400">
                  Penugasan disimpan saat Anda memilih aksi triage di bawah.
                </div>
              )}
            </div>
          )}

          {/* Note input */}
          {!disabled && (
            <div>
              <Label htmlFor="anomaly-triage-note" className="text-xs md:text-sm font-medium">Catatan triage (opsional)</Label>
              <Textarea
                id="anomaly-triage-note"
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
                <Eye /> Tandai ditinjau
              </Button>
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "investigating", note, assignedTo)}
                data-testid="anomaly-investigate-btn"
              >
                <Clock /> Selidiki
              </Button>
              <Button
                onClick={() => onTriage(event.id, "resolved", note, assignedTo)}
                data-testid="anomaly-resolve-btn"
              >
                <CheckCircle2 /> Selesaikan
              </Button>
              <Button
                variant="outline"
                onClick={() => onTriage(event.id, "false_positive", note, assignedTo)}
                data-testid="anomaly-fp-btn"
              >
                <XCircle /> Bukan anomali
              </Button>
            </div>
          )}
          {disabled && (
            <div className="text-xs text-muted-foreground text-center py-2">
              Anomali berstatus "{statusLabel(event.status)}". Tidak ada aksi lanjutan.
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
