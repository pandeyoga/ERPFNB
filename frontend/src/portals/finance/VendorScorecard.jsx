/** Vendor Performance Scorecard — ranked vendors by composite score with detail drilldown. */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Award, Clock, BadgeCheck, Download, Users, Trophy } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function scoreColor(score) {
  if (score == null) return "text-muted-foreground";
  if (score >= 85) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 70) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}
function scoreBg(score) {
  if (score == null) return "bg-muted";
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

export default function VendorScorecard() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/reports/vendor-scorecard", {
        params: { date_from: from, date_to: to, top: 50 },
      });
      const raw = unwrap(res) || {};
      // Bug fix 2026-05-26: backend may return only { vendors, filters }
      // without a `summary` block — synthesize it from vendors[] so the
      // page doesn't crash when reading data.summary.vendor_count.
      const vendors = raw.vendors || [];
      const synthSummary = {
        vendor_count: vendors.length,
        total_spend: vendors.reduce((s, v) => s + (v.total_spend || 0), 0),
        avg_on_time_pct: vendors.length
          ? Math.round(
              vendors.reduce((s, v) => s + (v.on_time_pct || 0), 0) / vendors.length,
            )
          : null,
      };
      setData({
        vendors,
        filters: raw.filters || {},
        summary: raw.summary || synthSummary,
      });
    } catch (e) {
      toast.error("Gagal memuat vendor scorecard");
      setData(null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [from, to]); // eslint-disable-line
  // Deep link dari Procurement › Vendor Scorecard ("Detail di Finance"): ?vendor_id=<id>
  const [searchParams] = useSearchParams();
  const deepVendorId = searchParams.get("vendor_id");
  useEffect(() => { if (deepVendorId) loadDetail(deepVendorId); }, [deepVendorId]); // eslint-disable-line

  async function loadDetail(vendorId) {
    setSelectedVendor(vendorId);
    setDetailLoading(true);
    try {
      const res = await api.get(`/reports/vendor-scorecard/${vendorId}`, {
        params: { date_from: from, date_to: to },
      });
      const d = unwrap(res);
      setDetail(d?.vendors?.[0] || null);
    } catch (e) {
      toast.error("Gagal memuat detail vendor");
    } finally { setDetailLoading(false); }
  }

  function exportCsv() {
    if (!data?.vendors?.length) return;
    const headers = ["Vendor", "Code", "Spend", "PO", "GR", "OnTime%", "AvgLead(d)", "PriceStability%", "Defect%", "Score"];
    const lines = [headers.join(",")];
    data.vendors.forEach(v => {
      lines.push([
        `"${v.vendor_name}"`, v.vendor_code, v.total_spend, v.po_count, v.gr_count,
        v.on_time_pct ?? "", v.avg_lead_time_days ?? "",
        v.price_stability_pct ?? "", v.defect_rate_pct ?? "",
        v.composite_score ?? "",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendor-scorecard-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Peringkat (#) dihitung dari composite score (desc) — sebelumnya memakai urutan API
  // sehingga kolom # tidak cocok dengan urutan default tabel (sort by score).
  const scoreRows = [...(data?.vendors || [])]
    .sort((a, b) => (b.composite_score ?? -1) - (a.composite_score ?? -1))
    .map((v, i) => ({ ...v, _rowid: v.vendor_code || v.vendor_id, _rank: i + 1 }));
  const scoreColumns = [
    { key: "_rank", label: "#", numeric: true, render: (r) => <span className="text-muted-foreground">{r._rank}</span> },
    { key: "vendor_name", label: "Vendor", primary: true, sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium">{r.vendor_name}</div>
          <div className="text-xs text-muted-foreground">{r.vendor_code}</div>
        </div>
      ) },
    { key: "total_spend", label: "Spend", numeric: true, sortable: true,
      render: (r) => <span className="font-medium whitespace-nowrap">{fmtRp(r.total_spend)}</span> },
    { key: "on_time_pct", label: "On-Time", numeric: true, sortable: true,
      render: (r) => `${r.on_time_pct ?? "-"}%` },
    { key: "avg_lead_time_days", label: "Lead (d)", numeric: true, sortable: true,
      render: (r) => r.avg_lead_time_days ?? "-" },
    { key: "defect_rate_pct", label: "Defect", numeric: true, sortable: true,
      render: (r) => `${r.defect_rate_pct ?? "-"}%` },
    { key: "composite_score", label: "Score", numeric: true, sortable: true,
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full", scoreBg(r.composite_score))} style={{ width: `${r.composite_score ?? 0}%` }} />
          </div>
          <span className={cn("font-bold tabular-nums", scoreColor(r.composite_score))}>{r.composite_score ?? "-"}</span>
        </div>
      ) },
    { key: "_chevron", label: "", render: () => <ChevronRight className="h-4 w-4 text-muted-foreground" /> },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="vendor-scorecard-page">
      <PageHeader
        icon={Trophy}
        title="Vendor Scorecard"
        subtitle="Peringkat performa vendor dari histori PO, GR, dan pembayaran (on-time, lead time, defect)."
        actions={
          <Button onClick={exportCsv} variant="outline" disabled={!data?.vendors?.length}
            data-testid="scorecard-export">
            <Download className="h-4 w-4" /> Ekspor CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 items-end" data-testid="scorecard-filter">
        <div>
          <Label htmlFor="scorecard-from" className="text-xs md:text-sm font-medium">Dari</Label>
          <Input id="scorecard-from" type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="glass-input mt-1 w-[160px]" data-testid="scorecard-from" />
        </div>
        <div>
          <Label htmlFor="scorecard-to" className="text-xs md:text-sm font-medium">Hingga</Label>
          <Input id="scorecard-to" type="date" value={to} onChange={e => setTo(e.target.value)}
            className="glass-input mt-1 w-[160px]" data-testid="scorecard-to" />
        </div>
      </div>

      {loading && <LoadingState rows={5} />}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CompactStatCard icon={Users} color="aurora-1" label="Vendors" value={fmtNumber(data.summary.vendor_count)} sub="dievaluasi" />
            <CompactStatCard icon={BadgeCheck} color="aurora-2" label="Total spend" value={fmtRp(data.summary.total_spend)} sub="periode terpilih" />
            <CompactStatCard icon={Clock} color="aurora-3" label="Avg on-time" value={`${data.summary.avg_on_time_pct ?? "-"}%`} sub="rata-rata pengiriman" />
            <CompactStatCard icon={Award} color="aurora-4" tone="success" label="Vendor grade A" value={fmtNumber(data.vendors.filter(v => (v.composite_score ?? 0) >= 85).length)} sub="score ≥ 85" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            {/* Vendor list */}
            <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <h3 className="text-sm md:text-base font-semibold">Vendor ranking</h3>
                <span className="text-xs text-muted-foreground">{data.vendors.length} vendor</span>
              </div>
              <DataTable
                rows={scoreRows}
                columns={scoreColumns}
                keyField="_rowid"
                rowTestIdPrefix="scorecard-row"
                defaultSort={{ key: "composite_score", dir: "desc" }}
                onRowClick={(r) => loadDetail(r.vendor_id)}
                rowClassName={(r) => (selectedVendor === r.vendor_id ? "bg-muted/30" : "")}
                empty={<div className="p-8"><EmptyState title="Belum ada data" description="Belum ada data PO/GR pada rentang ini." /></div>}
              />
            </div>

            {/* Detail panel */}
            <div className="glass-card p-4 sticky top-4 self-start">
              <h3 className="text-sm md:text-base font-semibold mb-3 flex items-center gap-2">
                <Award className="h-4 w-4" /> Detail Vendor
              </h3>
              {!detail && !detailLoading && (
                <div className="text-sm text-muted-foreground">
                  Klik vendor di tabel untuk melihat skor detail dan PO terakhir.
                </div>
              )}
              {detailLoading && <LoadingState rows={3} />}
              {detail && !detailLoading && (
                <div className="space-y-3" data-testid="scorecard-detail">
                  <div>
                    <div className="text-xs text-muted-foreground">{detail.vendor_code}</div>
                    <div className="font-semibold">{detail.vendor_name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Composite" value={detail.composite_score} suffix="/100" highlight={scoreColor(detail.composite_score)} />
                    <Metric label="Spend" value={fmtRp(detail.total_spend)} />
                    <Metric label="On-Time %" value={detail.on_time_pct ?? "-"} suffix={detail.on_time_pct != null ? "%" : ""} />
                    <Metric label="Lead Time" value={detail.avg_lead_time_days ?? "-"} suffix={detail.avg_lead_time_days != null ? " hari" : ""} />
                    <Metric label="Price Stab." value={detail.price_stability_pct ?? "-"} suffix={detail.price_stability_pct != null ? "%" : ""} />
                    <Metric label="Defect Rate" value={detail.defect_rate_pct ?? "-"} suffix={detail.defect_rate_pct != null ? "%" : ""} />
                  </div>
                  {detail.po_breakdown?.length > 0 && (
                    <div data-testid="po-breakdown">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 mt-3">
                        Recent POs ({detail.po_breakdown.length})
                      </div>
                      <div className="max-h-[260px] overflow-y-auto space-y-1.5">
                        {detail.po_breakdown.slice(0, 12).map(po => (
                          <div key={po.po_id} className="text-xs px-2 py-1.5 rounded bg-muted/30 flex items-center justify-between">
                            <div>
                              <div className="font-mono">{po.doc_no}</div>
                              <div className="text-xs text-muted-foreground">{po.order_date}</div>
                            </div>
                            <div className="text-right">
                              <div className="tabular-nums font-medium">{fmtRp(po.grand_total)}</div>
                              <div className="text-xs">
                                {po.on_time === true && <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-0 h-4 text-xs px-1.5">on-time</Badge>}
                                {po.on_time === false && <Badge className="bg-red-500/15 text-red-800 dark:text-red-300 border-0 h-4 text-xs px-1.5">late</Badge>}
                                {po.on_time === null && <Badge className="bg-muted text-muted-foreground border-0 h-4 text-xs px-1.5">no GR</Badge>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Metrik ringkas di panel detail — memakai CompactStatCard (size sm) agar satu gaya tile.
function Metric({ label, value, suffix = "", highlight }) {
  return (
    <CompactStatCard
      size="sm"
      label={label}
      value={<span className={cn("text-base", highlight)}>{value}{suffix}</span>}
      className="min-h-0 bg-muted/20"
    />
  );
}
