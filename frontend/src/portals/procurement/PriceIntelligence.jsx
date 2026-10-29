/** Price Intelligence — deviasi harga vendor vs harga referensi Market List + single-source risk. */
import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import SimpleSelect from "@/components/shared/SimpleSelect";
import {
  TrendingUp, TrendingDown, BarChart2,
  RefreshCw, ShieldAlert, CheckCircle, Package,
} from "lucide-react";
import { toast } from "sonner";

import { fmtNumber } from "@/lib/format";
const fmt = (n) => fmtNumber(n); // DUP-10: shared formatter

const DevBadge = ({ pct }) => {
  if (pct == null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = pct > 10 ? "bg-red-500/15 text-red-800 dark:text-red-300" : pct < -10 ? "bg-green-500/15 text-green-800 dark:text-green-300" : pct > 0 ? "bg-orange-500/15 text-orange-800 dark:text-orange-300" : "bg-blue-500/15 text-blue-800 dark:text-blue-300";
  const icon = pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {icon}{pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
};

export default function PriceIntelligence() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState({ category_id: "", topN: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ top_n: filter.topN, ...(filter.category_id && { category_id: filter.category_id }) });
      const [intRes, catRes] = await Promise.all([
        api.get(`/market-list/intelligence?${params}`),
        api.get("/master/categories?per_page=100"),
      ]);
      setData(intRes.data.data);
      setCategories(catRes.data.data || []);
    } catch (e) {
      toast.error("Gagal memuat price intelligence");
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="price-intel-page">
      <PageHeader
        icon={BarChart2}
        title="Price Intelligence"
        testId="price-intel-header"
        subtitle={
          <>
            Deviasi harga vendor vs harga referensi Market List
            {data?.quarter_label && <span className="ml-1 font-medium text-foreground" data-testid="price-intel-quarter">· {data.quarter_label}</span>}
          </>
        }
        actions={
          <>
            <SimpleSelect
              value={filter.category_id}
              onValueChange={v => setFilter(f => ({ ...f, category_id: v }))}
              options={[{ value: "", label: "Semua kategori" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
              placeholder="Semua kategori"
              ariaLabel="Filter kategori"
              className="glass-input w-[200px]"
              testId="price-intel-category-filter"
            />
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} aria-label="Muat ulang data" data-testid="price-intel-refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="price-intel-summary">
        <CompactStatCard label="Item terlacak" value={<span data-testid="price-intel-tracked-value">{data?.total_items_tracked || 0}</span>} loading={loading && !data}
          icon={Package} color="aurora-1" testId="price-intel-stat-tracked" />
        <CompactStatCard label="Di atas referensi (>10%)" value={<span data-testid="price-intel-above-value">{data?.price_above_reference || 0}</span>} loading={loading && !data}
          icon={TrendingUp} tone="danger" testId="price-intel-stat-above" />
        <CompactStatCard label="Di bawah referensi (>10%)" value={<span data-testid="price-intel-below-value">{data?.price_below_reference || 0}</span>} loading={loading && !data}
          icon={TrendingDown} tone="success" testId="price-intel-stat-below" />
        <CompactStatCard label="Single-source risk" value={<span data-testid="price-intel-risk-value">{data?.single_source_risk?.length || 0}</span>} loading={loading && !data}
          icon={ShieldAlert} tone="warning" testId="price-intel-stat-risk" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        {/* Main deviations table */}
        <div className="lg:col-span-2">
          <Card data-testid="price-intel-deviations-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                Deviasi harga vendor vs referensi Market List
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                rows={(data?.top_deviations || []).map((d, idx) => ({ ...d, _idx: idx }))}
                keyField="_idx"
                rowTestIdPrefix="price-intel-row"
                loading={loading}
                rowClassName={(d) => d.deviation_pct > 10 ? "bg-red-500/5" : d.deviation_pct < -10 ? "bg-green-500/5" : ""}
                empty={(
                  <div data-testid="price-intel-deviations-empty">
                    <EmptyState icon={BarChart2} title="Belum ada data price intelligence"
                      description="Buat PO atau GR terlebih dahulu agar harga vendor tercatat." />
                  </div>
                )}
                columns={[
                  { key: "item_name", label: "Item", primary: true, sortable: true,
                    render: (d) => (
                      <div>
                        <div className="font-medium text-sm">{d.item_name}</div>
                        <div className="text-xs text-muted-foreground">{d.unit}</div>
                      </div>
                    ) },
                  { key: "category_name", label: "Kategori",
                    render: (d) => <span className="text-xs text-muted-foreground">{d.category_name || "—"}</span> },
                  { key: "vendor_name", label: "Vendor", sortable: true,
                    render: (d) => <span className="text-sm">{d.vendor_name}</span> },
                  { key: "actual_price", label: "Harga vendor", numeric: true, sortable: true,
                    render: (d) => <span className="font-semibold text-sm">Rp {fmt(d.actual_price)}</span> },
                  { key: "ref_price", label: "Harga ref.", numeric: true,
                    render: (d) => <span className="text-muted-foreground text-sm">Rp {fmt(d.ref_price)}</span> },
                  { key: "deviation_pct", label: "Deviasi", align: "center", sortable: true,
                    render: (d) => <DevBadge pct={d.deviation_pct} /> },
                  { key: "availability_status", label: "Status", align: "center",
                    render: (d) => d.availability_status === "unavailable" ? (
                      <Badge variant="outline" className="text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30 text-xs">Tidak tersedia</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30 text-xs">Tersedia</Badge>
                    ) },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* Single source risk */}
        <div>
          <Card data-testid="price-intel-risk-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-800 dark:text-orange-400" />
                Single-source risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.single_source_risk?.length ? (
                <div data-testid="price-intel-risk-empty">
                  <EmptyState icon={CheckCircle} title="Tidak ada risiko" description="Semua item punya lebih dari 1 vendor." />
                </div>
              ) : (
                <div className="space-y-2" data-testid="price-intel-risk-list">
                  {data.single_source_risk.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 p-2 bg-orange-500/5 rounded-lg border border-orange-500/20"
                      data-testid={`price-intel-risk-${idx}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.item_name}</div>
                        <div className="text-xs text-muted-foreground">{item.category_name}</div>
                      </div>
                      <span className="text-xs bg-orange-500/15 text-orange-800 dark:text-orange-300 px-2 py-0.5 rounded-full shrink-0">1 vendor</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
