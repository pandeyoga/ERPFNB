/** Procurement → Vendor Scorecard (procurement-specific list view).
 * Wraps reports/vendor-scorecard endpoint. Detail goes via /procurement/vendors/{id}/scorecard.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Filter, Star, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import SimpleSelect from "@/components/shared/SimpleSelect";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtPct, fmtNumber } from "@/lib/format";
import { toast } from "sonner";

export default function VendorScorecardList() {
  const [data, setData] = useState([]);
  const [period, setPeriod] = useState("ytd");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // Try reports endpoint first
      let rows = null;
      try {
        const res = await api.get("/reports/vendor-scorecard", { params: { period } });
        rows = unwrap(res);
      } catch {
        // Fallback: build from vendor list (no scoring)
        const v = await api.get("/master/vendors", { params: { per_page: 100, active: true } });
        rows = (unwrap(v) || []).map((vd) => ({
          vendor_id: vd.id, vendor_name: vd.name, vendor_code: vd.code,
          po_count: 0, total_value: 0, score: null,
        }));
      }
      const arr = Array.isArray(rows) ? rows : (rows?.items || rows?.vendors || []);
      setData(arr);
    } catch (e) {
      toast.error("Gagal load scorecard");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  function scoreColor(s) {
    if (s == null) return "bg-foreground/5 text-muted-foreground";
    if (s >= 85) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    if (s >= 70) return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    if (s >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
  }
  function scoreLabel(s) {
    if (s == null) return "—";
    if (s >= 85) return "Excellent";
    if (s >= 70) return "Good";
    if (s >= 50) return "Average";
    return "Poor";
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4" data-testid="vendor-scorecard-page">
      <PageHeader
        icon={Award}
        title="Vendor Scorecard"
        subtitle="Penilaian performa vendor (on-time delivery, quality, price competitiveness)"
        action={
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <SimpleSelect
              value={period}
              onValueChange={setPeriod}
              options={[
                { value: "ytd", label: "YTD" },
                { value: "qtd", label: "QTD" },
                { value: "mtd", label: "MTD" },
              ]}
              className="glass-input rounded-lg h-10 text-sm"
              testId="scorecard-period"
            />
          </div>
        }
      />

      <div className="glass-card overflow-hidden" data-testid="scorecard-table-card">
        <DataTable
          columns={[
            { key: "vendor_name", label: "Vendor", primary: true, sortable: true,
              sortAccessor: (v) => v.vendor_name || v.name || "",
              render: (v) => (
                <div>
                  <div className="font-semibold" data-testid={`scorecard-name-${v.vendor_id}`}>{v.vendor_name || v.name}</div>
                  <div className="text-[10px] text-muted-foreground">{v.vendor_code || v.code}</div>
                </div>
              ) },
            { key: "po_count", label: "PO Count", numeric: true, sortable: true, sortAccessor: (v) => v.po_count || 0,
              render: (v) => <span data-testid={`scorecard-pos-${v.vendor_id}`}>{fmtNumber(v.po_count || 0)}</span> },
            { key: "total_value", label: "Total Value", numeric: true, sortable: true, sortAccessor: (v) => v.total_value || 0,
              render: (v) => <span className="font-semibold" data-testid={`scorecard-value-${v.vendor_id}`}>{fmtRp(v.total_value || 0)}</span> },
            { key: "on_time", label: "On-Time", numeric: true, sortable: true, sortAccessor: (v) => v.on_time_pct ?? -1,
              render: (v) => (
                <span data-testid={`scorecard-ontime-${v.vendor_id}`}>
                  {v.on_time_pct != null ? (
                    <span className="inline-flex items-center gap-1">
                      {Number(v.on_time_pct) >= 80 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />}
                      {fmtPct(v.on_time_pct)}
                    </span>
                  ) : "—"}
                </span>
              ) },
            { key: "score", label: "Score", numeric: true, sortable: true, sortAccessor: (v) => v.score ?? v.composite_score ?? -1,
              render: (v) => {
                const score = v.score ?? v.composite_score ?? null;
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border ${scoreColor(score)}`} data-testid={`scorecard-score-${v.vendor_id}`}>
                    <Star className="h-3 w-3" /> {score != null ? `${Number(score).toFixed(0)}·${scoreLabel(score)}` : "N/A"}
                  </span>
                );
              } },
          ]}
          rows={data}
          keyField="vendor_id"
          loading={loading}
          rowTestIdPrefix="scorecard-row"
          defaultSort={{ key: "score", dir: "desc" }}
          renderExpanded={(v) => <VendorScoreDrilldown v={v} scoreLabel={scoreLabel} />}
          empty={<EmptyState icon={Award} title="Tidak ada data" description="Belum ada vendor dengan transaksi pada periode ini." />}
          rowAction={(v) => (
            <Link to={`/finance/vendor-scorecard?vendor_id=${v.vendor_id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              data-testid={`scorecard-detail-${v.vendor_id}`} onClick={(e) => e.stopPropagation()}>
              Detail <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center" data-testid="scorecard-footer-link">
        Untuk detail KPI per vendor (delivery time, defect rate, price benchmark), buka <Link to="/finance/vendor-scorecard" className="text-primary hover:underline">Finance → Vendor Scorecard</Link>.
      </p>
    </div>
  );
}

function VendorScoreDrilldown({ v, scoreLabel }) {
  const score = v.score ?? v.composite_score ?? null;
  const metrics = [
    { label: "On-Time Delivery", value: v.on_time_pct != null ? fmtPct(v.on_time_pct) : "—" },
    { label: "Jumlah PO", value: fmtNumber(v.po_count || 0) },
    { label: "Total Nilai", value: fmtRp(v.total_value || 0) },
    { label: "Quality / Defect", value: v.defect_rate != null ? fmtPct(v.defect_rate) : (v.quality_score != null ? Number(v.quality_score).toFixed(0) : "—") },
    { label: "Avg Lead Time", value: v.avg_lead_time != null ? `${Number(v.avg_lead_time).toFixed(1)} hari` : "—" },
    { label: "Composite Score", value: score != null ? `${Number(score).toFixed(0)} · ${scoreLabel(score)}` : "N/A" },
  ];
  return (
    <div className="space-y-2" data-testid={`scorecard-breakdown-${v.vendor_id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Rincian KPI Vendor</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-[11px] text-muted-foreground">{m.label}</div>
            <div className="font-semibold tabular-nums">{m.value}</div>
          </div>
        ))}
      </div>
      <Link to={`/finance/vendor-scorecard?vendor_id=${v.vendor_id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
        data-testid={`scorecard-fulldetail-${v.vendor_id}`} onClick={(e) => e.stopPropagation()}>
        Buka detail lengkap (delivery time, defect rate, price benchmark) <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
