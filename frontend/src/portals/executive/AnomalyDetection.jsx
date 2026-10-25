/** Executive Anomaly Detection — list with summary, filters, triage actions. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, Filter, ChevronRight, Activity, ShieldAlert, AlertOctagon, Info, ListChecks } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import SimpleSelect from "@/components/shared/SimpleSelect";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { Button } from "@/components/ui/button";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";

// Backend memakai "severe" untuk tingkat tertinggi; diperlakukan sama dengan "critical".
const normSeverity = (sev) => {
  const s = String(sev || "low").toLowerCase();
  return s === "severe" ? "critical" : s;
};

const SEVERITY_STYLES = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
};

export default function AnomalyDetection() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({ severity: "", status: "open", type: "", days: 7 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [aRes, sRes, tRes] = await Promise.all([
        api.get("/anomalies", { params: { ...filters, per_page: 50 } }),
        api.get("/anomalies/summary", { params: { days: filters.days } }),
        api.get("/anomalies/types"),
      ]);
      setItems(unwrap(aRes) || []);
      setSummary(unwrap(sRes));
      setTypes(unwrap(tRes) || []);
    } catch (e) {
      toast.error("Gagal memuat anomali");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters.severity, filters.status, filters.type, filters.days]);

  async function runScan() {
    setScanning(true);
    try {
      await api.post("/anomalies/scan", { days: 7 });
      toast.success("Scan selesai");
      load();
    } catch (e) {
      toast.error("Gagal menjalankan scan: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setScanning(false); }
  }

  const counts = useMemo(() => {
    const result = { critical: 0, high: 0, medium: 0, low: 0, total: items.length };
    for (const a of items) {
      const sev = normSeverity(a.severity);
      if (result[sev] !== undefined) result[sev] += 1;
    }
    return result;
  }, [items]);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="executive-anomaly-page">
      <PageHeader
        icon={AlertTriangle}
        title="Anomaly Detection"
        subtitle="Deteksi otomatis pola tidak biasa pada operasi bisnis"
        className="mb-0 md:mb-0"
        actions={
          <Button onClick={runScan} disabled={scanning} data-testid="anomaly-scan-btn">
            <RefreshCw className={scanning ? "animate-spin" : undefined} /> {scanning ? "Memindai…" : "Jalankan Scan"}
          </Button>
        }
      />

      {/* Severity counts (critical mencakup "severe") */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="anomaly-severity-counts">
        {[
          ["total", "Total", ListChecks, "aurora-1", "default"],
          ["critical", "Critical / Severe", AlertOctagon, "aurora-6", "danger"],
          ["high", "High", ShieldAlert, "aurora-6", "warning"],
          ["medium", "Medium", AlertTriangle, "aurora-5", "warning"],
          ["low", "Low", Info, "aurora-3", "info"],
        ].map(([k, label, Icon, color, tone]) => (
          <CompactStatCard
            key={k}
            size="sm"
            testId={`anomaly-count-${k}`}
            label={label}
            value={counts[k] || 0}
            icon={Icon}
            color={color}
            tone={(counts[k] || 0) > 0 ? tone : "default"}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-3 flex flex-wrap gap-2 items-center" data-testid="anomaly-filters">
        <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
        <SimpleSelect value={filters.severity} onValueChange={(v) => setFilters((f) => ({ ...f, severity: v }))} className="w-[170px]" ariaLabel="Filter severity" testId="anomaly-filter-severity" placeholder="Semua Severity"
          options={[
            { value: "", label: "Semua Severity" },
            { value: "critical", label: "Critical" },
            { value: "severe", label: "Severe" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]} />
        <SimpleSelect value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))} className="w-[160px]" ariaLabel="Filter status" testId="anomaly-filter-status" placeholder="Semua Status"
          options={[
            { value: "", label: "Semua Status" },
            { value: "open", label: "Open" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "resolved", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
          ]} />
        <SimpleSelect value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))} className="w-[200px]" ariaLabel="Filter tipe" testId="anomaly-filter-type" placeholder="Semua Tipe"
          options={[{ value: "", label: "Semua Tipe" }, ...types.map((t) => ({ value: t.value, label: t.label }))]} />
        <SimpleSelect value={String(filters.days)} onValueChange={(v) => setFilters((f) => ({ ...f, days: Number(v) }))} className="w-[160px]" ariaLabel="Rentang waktu" testId="anomaly-filter-days"
          options={[
            { value: "7", label: "7 hari terakhir" },
            { value: "14", label: "14 hari terakhir" },
            { value: "30", label: "30 hari terakhir" },
          ]} />
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-4"><LoadingState rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Tidak ada anomali ditemukan"
            description="Sistem tidak mendeteksi pola tidak biasa untuk filter saat ini. Klik Jalankan Scan untuk memindai ulang."
          />
        ) : (
          <div className="divide-y divide-border/30">
            {items.map((a) => (
              <Link
                key={a.id}
                to={`/finance/period-closing?phase=1&id=${a.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-foreground/5 group"
                data-testid={`anomaly-row-${a.id}`}
              >
                <div className={`shrink-0 px-2 py-0.5 text-[11px] uppercase font-semibold rounded-md border ${SEVERITY_STYLES[normSeverity(a.severity)] || SEVERITY_STYLES.low}`}>
                  {a.severity}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.title || a.label || a.type}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description || a.message || a.detail}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex gap-3">
                    <span>{fmtDate(a.detected_at || a.created_at)}</span>
                    {a.amount != null && <span>Nilai: {fmtRp(Number(a.amount))}</span>}
                    {a.outlet_name && <span>Outlet: {a.outlet_name}</span>}
                    {a.vendor_name && <span>Vendor: {a.vendor_name}</span>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Untuk triage detail (acknowledge / resolve / dismiss), buka <Link to="/finance/period-closing?phase=1" className="text-primary hover:underline">Finance → Anomaly Feed</Link>.
      </div>
    </div>
  );
}
