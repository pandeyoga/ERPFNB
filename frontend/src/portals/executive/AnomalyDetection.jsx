/** Executive Anomaly Detection — list with summary, filters, triage actions. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, Filter, ChevronRight, Activity } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";

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
      toast.error("Gagal load anomalies");
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
      toast.error("Gagal scan: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setScanning(false); }
  }

  const counts = useMemo(() => {
    const result = { critical: 0, high: 0, medium: 0, low: 0, total: items.length };
    for (const a of items) {
      const sev = (a.severity || "low").toLowerCase();
      if (result[sev] !== undefined) result[sev] += 1;
    }
    return result;
  }, [items]);

  return (
    <div className="max-w-6xl mx-auto space-y-4" data-testid="executive-anomaly-page">
      <PageHeader
        icon={AlertTriangle}
        title="Anomaly Detection"
        subtitle="Deteksi otomatis pola tidak biasa pada operasi bisnis"
        action={
          <Button onClick={runScan} disabled={scanning} className="rounded-full pill-active gap-2 h-10" data-testid="anomaly-scan-btn">
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} /> {scanning ? "Scanning..." : "Run Scan"}
          </Button>
        }
      />

      {/* Severity counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[["total", "Total"], ["critical", "Critical"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]].map(([k, label]) => (
          <div key={k} className="glass-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-2xl font-bold tabular-nums ${k !== "total" && SEVERITY_STYLES[k] ? SEVERITY_STYLES[k].split(" ").find(c => c.startsWith("text-")) : ""}`}>
              {counts[k] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-3 flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <SimpleSelect value={filters.severity} onValueChange={(v) => setFilters((f) => ({ ...f, severity: v }))} className="glass-input rounded-lg px-3 h-9 text-sm" testId="anomaly-filter-severity" placeholder="Semua Severity"
          options={[
            { value: "", label: "Semua Severity" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]} />
        <SimpleSelect value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))} className="glass-input rounded-lg px-3 h-9 text-sm" testId="anomaly-filter-status" placeholder="Semua Status"
          options={[
            { value: "", label: "Semua Status" },
            { value: "open", label: "Open" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "resolved", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
          ]} />
        <SimpleSelect value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))} className="glass-input rounded-lg px-3 h-9 text-sm" testId="anomaly-filter-type" placeholder="Semua Tipe"
          options={[{ value: "", label: "Semua Tipe" }, ...types.map((t) => ({ value: t.value, label: t.label }))]} />
        <SimpleSelect value={String(filters.days)} onValueChange={(v) => setFilters((f) => ({ ...f, days: Number(v) }))} className="glass-input rounded-lg px-3 h-9 text-sm" testId="anomaly-filter-days"
          options={[
            { value: "7", label: "7 hari terakhir" },
            { value: "14", label: "14 hari terakhir" },
            { value: "30", label: "30 hari terakhir" },
          ]} />
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6"><LoadingState rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Tidak ada anomali ditemukan"
            description="Sistem tidak mendeteksi pola tidak biasa untuk filter saat ini. Klik Run Scan untuk men-trigger ulang."
          />
        ) : (
          <div className="divide-y divide-border/30">
            {items.map((a) => (
              <Link
                key={a.id}
                to={`/finance/anomalies?id=${a.id}`}
                className="flex items-start gap-3 px-5 py-4 hover:bg-foreground/5 group"
                data-testid={`anomaly-row-${a.id}`}
              >
                <div className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-md border ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.low}`}>
                  {a.severity}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.title || a.label || a.type}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description || a.message || a.detail}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex gap-3">
                    <span>{fmtDate(a.detected_at || a.created_at)}</span>
                    {a.amount != null && <span>Amount: {fmtRp(Number(a.amount))}</span>}
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
        Untuk triage detail (acknowledge / resolve / dismiss), buka <Link to="/finance/anomalies" className="text-primary hover:underline">Finance → Anomaly Feed</Link>.
      </div>
    </div>
  );
}
