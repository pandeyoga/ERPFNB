/** Budget vs Actual — v0.3.5 Enhanced (Multi-scope) */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Target, TrendingUp, TrendingDown, Settings2, RefreshCw, BarChart3 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";

export default function BudgetVsActual({ embedded = false, onSwitchTab }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [scope, setScope] = useState("outlet");
  const [outletId, setOutletId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [level, setLevel] = useState("both");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);

  // Load outlets and brands
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [outletRes, brandRes] = await Promise.all([
          api.get("/public/outlets"),
          api.get("/master/brands").catch(() => ({ data: { data: [] } }))
        ]);
        if (outletRes.data) setOutlets(outletRes.data.data || []);
        if (brandRes.data) setBrands(brandRes.data.data || []);
      } catch (err) {
        logger.error("Failed to load budget vs actual master data", { error: err.message });
      }
    }
    loadMasterData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { period, scope, level };
      if (scope === "outlet" && outletId) params.outlet_id = outletId;
      if (scope === "brand" && brandId) params.brand_id = brandId;
      const res = await api.get("/budget/vs-actual", { params });
      if (res.data.success) setData(res.data.data);
    } catch { toast.error("Gagal memuat data budget"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [period, scope, outletId, brandId, level]);

  const getVarianceColor = (pct, category) => {
    if (pct === null || pct === undefined) return "text-muted-foreground";
    // For revenue, negative variance is bad (under-budget)
    if (category === "REV") return pct < -5 ? "text-red-700 dark:text-red-400" : pct > 5 ? "text-green-700 dark:text-green-400" : "text-muted-foreground";
    // For expenses, positive variance is bad (over-budget)
    return pct > 10 ? "text-red-700 dark:text-red-400" : pct < -10 ? "text-green-700 dark:text-green-400" : "text-muted-foreground";
  };

  const hasBudgets = data && (data.category_rollup?.length > 0 || data.coa_level?.some(r => r.budget > 0));

  // Di dalam hub → pindah tab; standalone → buka hub pada tab Budget management.
  const goManage = () => (onSwitchTab ? onSwitchTab("manage") : navigate("/finance/budget-hub?tab=manage"));

  const varianceTone = (pct, category) => {
    const cls = getVarianceColor(pct, category);
    if (cls.includes("red")) return "danger";
    if (cls.includes("green")) return "success";
    return "default";
  };
  const fmtVar = (pct) => (pct === null || pct === undefined ? null : `${pct > 0 ? "+" : ""}${(pct || 0).toFixed(1)}%`);
  const catSub = (cat) => [`Budget: ${formatCurrency(cat.budget)}`, fmtVar(cat.variance_pct)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="budget-vs-actual">
      {!embedded && (
        <PageHeader
          icon={Target}
          title="Budget vs Actual"
          subtitle="Perbandingan budget vs realisasi per periode"
          className="mb-0 md:mb-0"
          actions={(
            <Button variant="outline" onClick={goManage} data-testid="manage-budgets-btn">
              <Settings2 /> Kelola Budget
            </Button>
          )}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="bva-period">Periode</Label>
              <Input id="bva-period" type="month" value={period} onChange={e => setPeriod(e.target.value)}
                data-testid="period-input" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bva-scope">Scope</Label>
              <Select value={scope} onValueChange={v => {
                setScope(v);
                setOutletId("");
                setBrandId("");
              }}>
                <SelectTrigger id="bva-scope" data-testid="scope-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet">Outlet</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "outlet" && (
              <div className="space-y-1">
                <Label htmlFor="bva-outlet">Outlet</Label>
                <Select value={outletId} onValueChange={setOutletId}>
                  <SelectTrigger id="bva-outlet" data-testid="outlet-select">
                    <SelectValue placeholder="Semua outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "brand" && (
              <div className="space-y-1">
                <Label htmlFor="bva-brand">Brand</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger id="bva-brand" data-testid="brand-select">
                    <SelectValue placeholder="Semua brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="bva-level">Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="bva-level" data-testid="level-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">COA + Kategori</SelectItem>
                  <SelectItem value="coa">COA saja</SelectItem>
                  <SelectItem value="category">Kategori saja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={loadData} disabled={loading} data-testid="load-data-btn" className="w-full">
                <RefreshCw className={loading ? "animate-spin" : undefined} />
                {loading ? "Memuat…" : "Muat ulang"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && !hasBudgets && (
        <Card className="border-dashed">
          <CardContent className="p-0">
            <EmptyState
              icon={Target}
              title={`Belum ada budget untuk periode ${period}`}
              description="Buat budget per COA terlebih dahulu agar realisasi dapat dibandingkan."
              action={<Button variant="outline" size="sm" onClick={goManage} data-testid="bva-create-budget-btn">Buat Budget</Button>}
            />
          </CardContent>
        </Card>
      )}

      {data && hasBudgets && (
        <>
          {/* Category Summary */}
          {(level === "both" || level === "category") && (data.category_rollup || []).length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="category-summary">
              {(data.category_rollup || []).filter(cat => !cat.derived).map((cat) => (
                <CompactStatCard
                  key={cat.category}
                  label={cat.name || cat.category}
                  value={formatCurrency(cat.actual)}
                  sub={catSub(cat)}
                  icon={cat.variance_pct > 0 ? TrendingUp : TrendingDown}
                  tone={varianceTone(cat.variance_pct, cat.category)}
                  color="aurora-1"
                  testId={`bva-cat-${String(cat.category).toLowerCase()}`}
                />
              ))}
            </div>
          )}

          {/* Derived Categories Summary */}
          {(level === "both" || level === "category") && (data.category_rollup || []).some(c => c.derived) && (
            <section className="space-y-2" data-testid="bva-pl-summary">
              <h2 className="text-base md:text-lg font-semibold">Ringkasan P&amp;L</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(data.category_rollup || []).filter(cat => cat.derived).map((cat) => (
                  <CompactStatCard
                    key={cat.category}
                    label={cat.name || cat.category}
                    value={formatCurrency(cat.actual)}
                    sub={catSub(cat)}
                    icon={cat.variance_pct > 0 ? TrendingUp : TrendingDown}
                    tone={varianceTone(cat.variance_pct, cat.category)}
                    color="aurora-2"
                    testId={`bva-derived-${String(cat.category).toLowerCase()}`}
                  />
                ))}
              </div>
            </section>
          )}

          {/* COA Detail */}
          {(level === "both" || level === "coa") && (data.coa_level || []).length > 0 && (
            <Card data-testid="coa-detail-card">
              <CardHeader>
                <CardTitle>Detail per COA</CardTitle>
                <CardDescription>Perbandingan detail per akun</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
              <DataTable
                rows={data.coa_level || []}
                keyField="coa_id"
                rowTestIdPrefix="coa-row"
                empty={<div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data COA</div>}
                columns={[
                  { key: "coa_code", label: "COA", sortable: true, primary: true,
                    render: (row) => (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium tabular-nums">{row.coa_code}</span>
                        <span className="text-xs text-muted-foreground">{row.coa_name}</span>
                        <Badge variant="outline" className="text-xs">{row.category}</Badge>
                      </div>
                    ) },
                  { key: "budget", label: "Budget", numeric: true, sortable: true,
                    render: (row) => <span className="text-sm">{formatCurrency(row.budget)}</span> },
                  { key: "actual", label: "Actual", numeric: true, sortable: true,
                    render: (row) => <span className="text-sm font-semibold">{formatCurrency(row.actual)}</span> },
                  { key: "variance", label: "Variance", numeric: true, sortable: true,
                    render: (row) => <span className={`text-sm ${getVarianceColor(row.variance_pct, row.category)}`}>{formatCurrency(row.variance)}</span> },
                  { key: "variance_pct", label: "Var %", numeric: true, sortable: true,
                    render: (row) => (
                      <span className={`text-sm ${getVarianceColor(row.variance_pct, row.category)}`}>
                        {row.variance_pct !== null ? `${row.variance_pct > 0 ? "+" : ""}${(row.variance_pct || 0).toFixed(1)}%` : "-"}
                      </span>
                    ) },
                ]}
              />
              </CardContent>
            </Card>
          )}

          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="bva-totals">
            <CompactStatCard label="Total budget" value={formatCurrency(data.total_budget)} icon={Target} color="aurora-1" testId="bva-total-budget" />
            <CompactStatCard label="Total actual" value={formatCurrency(data.total_actual)} icon={BarChart3} color="aurora-3" testId="bva-total-actual" />
            <CompactStatCard label="Variance"
              value={`${data.total_variance > 0 ? "+" : ""}${formatCurrency(data.total_variance)}`}
              icon={data.total_variance > 0 ? TrendingUp : TrendingDown}
              tone={data.total_variance > 0 ? "danger" : "success"}
              color={data.total_variance > 0 ? "aurora-6" : "aurora-4"}
              testId="bva-total-variance" />
          </div>
        </>
      )}
    </div>
  );
}
