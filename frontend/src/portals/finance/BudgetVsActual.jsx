/** Budget vs Actual — v0.3.5 Enhanced (Multi-scope) */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Target, TrendingUp, TrendingDown, Settings2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable from "@/components/shared/DataTable";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";

export default function BudgetVsActual() {
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
          api.get("/admin/brands").catch(() => ({ data: { data: [] } }))
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
    if (category === "REV") return pct < -5 ? "text-red-600" : pct > 5 ? "text-green-600" : "text-gray-600";
    // For expenses, positive variance is bad (over-budget)
    return pct > 10 ? "text-red-600" : pct < -10 ? "text-green-600" : "text-gray-600";
  };

  const hasBudgets = data && (data.category_rollup?.length > 0 || data.coa_level?.some(r => r.budget > 0));

  return (
    <div className="space-y-6" data-testid="budget-vs-actual">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Target className="h-6 w-6" /> Budget vs Actual
          </h2>
          <p className="text-muted-foreground text-sm">Perbandingan budget vs realisasi per periode</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/finance/budget/manage")} data-testid="manage-budgets-btn">
          <Settings2 className="h-4 w-4 mr-2" /> Kelola Budget
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Periode</Label>
              <Input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                data-testid="period-input" />
            </div>
            
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={v => {
                setScope(v);
                setOutletId("");
                setBrandId("");
              }}>
                <SelectTrigger data-testid="scope-select">
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
              <div className="space-y-2">
                <Label>Outlet</Label>
                <Select value={outletId} onValueChange={setOutletId}>
                  <SelectTrigger data-testid="outlet-select">
                    <SelectValue placeholder="Pilih Outlet" />
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
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger data-testid="brand-select">
                    <SelectValue placeholder="Pilih Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger data-testid="level-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">COA + Category</SelectItem>
                  <SelectItem value="coa">COA Only</SelectItem>
                  <SelectItem value="category">Category Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={loadData} disabled={loading} data-testid="load-data-btn" className="w-full">
                {loading ? "Loading..." : "Muat Data"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && !hasBudgets && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <Target className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Belum ada budget untuk periode <strong>{period}</strong>.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/finance/budget/manage")}>
              Buat Budget
            </Button>
          </CardContent>
        </Card>
      )}

      {data && hasBudgets && (
        <>
          {/* Category Summary */}
          {(level === "both" || level === "category") && (data.category_rollup || []).length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="category-summary">
              {(data.category_rollup || []).filter(cat => !cat.derived).map((cat) => (
                <Card key={cat.category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{cat.name || cat.category}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xl font-bold">{formatCurrency(cat.actual)}</div>
                    <div className="text-sm text-muted-foreground">Budget: {formatCurrency(cat.budget)}</div>
                    {cat.variance_pct !== null && (
                      <div className={`flex items-center gap-1 text-sm ${getVarianceColor(cat.variance_pct, cat.category)}`}>
                        {cat.variance_pct > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span>{cat.variance_pct > 0 ? "+" : ""}{(cat.variance_pct || 0).toFixed(1)}%</span>
                      </div>
                    )}
                    {cat.budget > 0 && (
                      <Progress value={Math.min((cat.actual / cat.budget) * 100, 100)} className="h-1.5" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Derived Categories Summary */}
          {(level === "both" || level === "category") && (data.category_rollup || []).some(c => c.derived) && (
            <Card>
              <CardHeader>
                <CardTitle>Ringkasan P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(data.category_rollup || []).filter(cat => cat.derived).map((cat) => (
                    <div key={cat.category} className="border rounded-lg p-4 space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">{cat.name || cat.category}</div>
                      <div className="text-2xl font-bold">{formatCurrency(cat.actual)}</div>
                      <div className="text-sm text-muted-foreground">Budget: {formatCurrency(cat.budget)}</div>
                      {cat.variance_pct !== null && (
                        <div className={`flex items-center gap-1 text-sm ${getVarianceColor(cat.variance_pct, cat.category)}`}>
                          {cat.variance_pct > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          <span>{cat.variance_pct > 0 ? "+" : ""}{(cat.variance_pct || 0).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* COA Detail */}
          {(level === "both" || level === "coa") && (data.coa_level || []).length > 0 && (
            <Card data-testid="coa-detail-card">
              <CardHeader>
                <CardTitle>Detail per COA</CardTitle>
                <CardDescription>Perbandingan detail per akun</CardDescription>
              </CardHeader>
              <CardContent>
              <DataTable
                rows={data.coa_level || []}
                keyField="coa_id"
                rowTestIdPrefix="coa-row"
                empty={<div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data COA</div>}
                columns={[
                  { key: "coa_code", label: "COA", sortable: true, primary: true,
                    render: (row) => (
                      <div>
                        <div className="font-medium">{row.coa_code}</div>
                        <div className="text-xs text-muted-foreground">{row.coa_name}</div>
                        <Badge variant="outline" className="text-xs mt-0.5">{row.category}</Badge>
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
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-8 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Budget</div>
                  <div className="text-2xl font-bold">{formatCurrency(data.total_budget)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Actual</div>
                  <div className="text-2xl font-bold">{formatCurrency(data.total_actual)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Variance</div>
                  <div className={`text-2xl font-bold ${data.total_variance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {data.total_variance > 0 ? "+" : ""}{formatCurrency(data.total_variance)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
