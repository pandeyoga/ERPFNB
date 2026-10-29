/**
 * Executive — Outlet Operational Budget Allocation
 *
 * Matrix view: outlets × budget cells. Each row can independently use either:
 *   - per_bucket mode → 3 cells (KDO / FDO / BDO)
 *   - combined mode   → 1 cell (Combined pool covering KDO+FDO+BDO)
 *
 * Period toggle: Mingguan / Bulanan.
 * Save propagates to outlet_budgets via /api/outlet-budget/budgets/bulk.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Save, Wallet,
  Building2, RefreshCw, Info, BarChart3, Bell, Layers, Combine,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import api from "@/lib/api";
import { fmtRp } from "@/lib/format";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { cn } from "@/lib/utils";
import {
  BUCKETS,
  isoWeekKey, monthKey, isoDate,
  prevPeriod, nextPeriod, rangeForKey,
  fetchBudgets, saveBulkBudgets,
} from "@/lib/outletBudgetApi";

export default function OutletBudgetAllocation() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState("monthly");
  const [periodKey, setPeriodKey] = useState(monthKey(new Date()));
  const [outlets, setOutlets] = useState([]);
  // budgets[outletId] = { id?, outlet_id, brand_id, budget_mode, kdo_budget, fdo_budget, bdo_budget, combined_budget }
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Reset period key when type changes
  useEffect(() => {
    if (periodType === "weekly") setPeriodKey(isoWeekKey(new Date()));
    else if (periodType === "monthly") setPeriodKey(monthKey(new Date()));
  }, [periodType]);

  // Load outlets master once
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/master/outlets");
        setOutlets(res.data.data || []);
      } catch (e) {
        toast.error("Gagal memuat data outlet");
      }
    })();
    (async () => {
      try {
        const res = await api.get("/outlet-budget/increase-requests", { params: { status: "pending" } });
        setPendingCount(res.data.data?.total || 0);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchBudgets({ periodType, periodKey });
      const map = {};
      for (const b of res.items || []) {
        map[b.outlet_id] = {
          ...b,
          budget_mode: b.budget_mode || "per_bucket",
        };
      }
      setBudgets(map);
    } catch (e) {
      toast.error("Gagal memuat budget periode ini");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (outlets.length) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodKey, outlets.length]);

  const setRowMode = (outletId, mode) => {
    setBudgets((prev) => ({
      ...prev,
      [outletId]: {
        ...(prev[outletId] || { outlet_id: outletId }),
        budget_mode: mode,
      },
    }));
  };

  const setCell = (outletId, key, value) => {
    setBudgets((prev) => ({
      ...prev,
      [outletId]: {
        ...(prev[outletId] || { outlet_id: outletId }),
        [key]: value === "" ? "" : Number(value),
      },
    }));
  };

  const bulkSetMode = (mode) => {
    setBudgets((prev) => {
      const next = { ...prev };
      for (const ol of outlets) {
        next[ol.id] = {
          ...(prev[ol.id] || { outlet_id: ol.id, brand_id: ol.brand_id }),
          budget_mode: mode,
        };
      }
      return next;
    });
    toast.info(mode === "combined"
      ? "Semua outlet di-set ke mode Gabungan. Klik Simpan untuk apply."
      : "Semua outlet di-set ke mode Per-Bucket. Klik Simpan untuk apply.");
  };

  // Copy from previous period
  const copyFromPrev = async () => {
    try {
      const prevKey = prevPeriod(periodType, periodKey);
      const res = await fetchBudgets({ periodType, periodKey: prevKey });
      if (!res.items?.length) {
        toast.warning("Periode sebelumnya tidak punya budget");
        return;
      }
      const map = {};
      for (const b of res.items) {
        const existing = budgets[b.outlet_id];
        map[b.outlet_id] = {
          ...(existing || { outlet_id: b.outlet_id, brand_id: b.brand_id }),
          outlet_id: b.outlet_id,
          brand_id: b.brand_id,
          budget_mode: b.budget_mode || "per_bucket",
          kdo_budget: b.kdo_budget,
          fdo_budget: b.fdo_budget,
          bdo_budget: b.bdo_budget,
          combined_budget: b.combined_budget || 0,
        };
      }
      setBudgets(map);
      toast.success(`Disalin dari ${prevKey}. Klik Simpan untuk apply.`);
    } catch (e) {
      toast.error("Gagal menyalin dari periode sebelumnya");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const [start, end] = rangeForKey(periodType, periodKey);
      if (!start || !end) {
        toast.error("Periode key tidak valid");
        return;
      }
      const items = outlets.map((ol) => {
        const b = budgets[ol.id] || {};
        const mode = b.budget_mode || "per_bucket";
        return {
          outlet_id: ol.id,
          brand_id: ol.brand_id,
          budget_mode: mode,
          kdo_budget: Number(b.kdo_budget || 0),
          fdo_budget: Number(b.fdo_budget || 0),
          bdo_budget: Number(b.bdo_budget || 0),
          combined_budget: Number(b.combined_budget || 0),
        };
      });
      await saveBulkBudgets({
        period_type: periodType,
        period_key: periodKey,
        period_start: isoDate(start),
        period_end: isoDate(end),
        alert_threshold_pct: 80,
        items,
      });
      toast.success("Budget disimpan & langsung berlaku.");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan budget");
    } finally {
      setSaving(false);
    }
  };

  // Grand totals — combine per_bucket + combined contributions
  const totals = useMemo(() => {
    let kdo = 0, fdo = 0, bdo = 0, combined = 0, total = 0;
    let perBucketCount = 0, combinedCount = 0;
    for (const ol of outlets) {
      const b = budgets[ol.id] || {};
      const mode = b.budget_mode || "per_bucket";
      if (mode === "combined") {
        combined += Number(b.combined_budget || 0);
        total += Number(b.combined_budget || 0);
        combinedCount += 1;
      } else {
        const k = Number(b.kdo_budget || 0);
        const f = Number(b.fdo_budget || 0);
        const d = Number(b.bdo_budget || 0);
        kdo += k;
        fdo += f;
        bdo += d;
        total += k + f + d;
        perBucketCount += 1;
      }
    }
    return { kdo, fdo, bdo, combined, total, perBucketCount, combinedCount };
  }, [budgets, outlets]);

  const [pStart, pEnd] = rangeForKey(periodType, periodKey) || [null, null];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="outlet-budget-allocation">
      <PageHeader
        icon={Wallet}
        title="Budget Allocation"
        subtitle="Set budget operasional per outlet — mode Per-Bucket (KDO/FDO/BDO terpisah) atau Gabungan (1 pool). Tidak ada carryover."
        className="mb-0 md:mb-0"
        actions={
          <>
            {pendingCount > 0 && (
              <Button
                variant="outline"
                onClick={() => navigate("/executive/budget-increase-requests")}
                data-testid="btn-pending-requests"
              >
                <Bell className="text-amber-800 dark:text-amber-400" />
                {pendingCount} permintaan menunggu
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate("/executive/budget-monitor")}
              data-testid="btn-go-monitor"
            >
              <BarChart3 /> Budget Monitor
            </Button>
          </>
        }
      />

      {/* Period toolbar + form actions */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2" data-testid="allocation-period-bar">
        <Tabs value={periodType} onValueChange={setPeriodType}>
          <TabsList aria-label="Tipe periode">
            <TabsTrigger value="weekly" data-testid="tab-weekly">Mingguan</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">Bulanan</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            onClick={() => setPeriodKey(prevPeriod(periodType, periodKey))}
            aria-label="Periode sebelumnya"
            data-testid="btn-period-prev"
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-[120px] text-center font-mono font-semibold text-sm" data-testid="current-period-key">
            {periodKey}
          </div>
          <Button
            variant="ghost" size="icon"
            onClick={() => setPeriodKey(nextPeriod(periodType, periodKey))}
            aria-label="Periode berikutnya"
            data-testid="btn-period-next"
          >
            <ChevronRight />
          </Button>
        </div>
        {pStart && pEnd && (
          <Badge variant="outline" className="font-mono">
            {isoDate(pStart)} → {isoDate(pEnd)}
          </Badge>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={copyFromPrev} data-testid="btn-copy-prev">
            <RefreshCw /> Salin dari periode lalu
          </Button>
          <Button onClick={save} disabled={saving} data-testid="btn-save">
            <Save /> {saving ? "Menyimpan…" : "Simpan Budget"}
          </Button>
        </div>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="allocation-totals">
        <CompactStatCard size="sm" label="Total KDO" value={fmtRp(totals.kdo)} icon={Layers} color="aurora-4" />
        <CompactStatCard size="sm" label="Total FDO" value={fmtRp(totals.fdo)} icon={Layers} color="aurora-3" />
        <CompactStatCard size="sm" label="Total BDO" value={fmtRp(totals.bdo)} icon={Layers} color="aurora-2" />
        <CompactStatCard size="sm" label="Total Gabungan" value={fmtRp(totals.combined)} icon={Combine} color="aurora-1" />
        <CompactStatCard size="sm" label="Grand Total" value={fmtRp(totals.total)} icon={Wallet} color="aurora-5"
          sub={`${totals.perBucketCount} Per-Bucket · ${totals.combinedCount} Gabungan`} className="col-span-2 md:col-span-1" />
      </div>

      {/* Matrix */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" /> Matrix Allocation per Outlet
              </CardTitle>
              <CardDescription>
                Pilih mode per baris. Pada mode Gabungan, semua KDO/FDO/BDO memakai satu pool yang sama.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="outline" size="sm"
                onClick={() => bulkSetMode("per_bucket")}
                data-testid="btn-bulk-per-bucket"
              >
                <Layers /> Semua → Per-Bucket
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => bulkSetMode("combined")}
                data-testid="btn-bulk-combined"
              >
                <Combine /> Semua → Gabungan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div data-testid="budget-matrix">
            <DataTable
              rows={outlets}
              keyField="id"
              loading={loading}
              rowTestIdPrefix="budget-row"
              columns={[
                { key: "outlet", label: "Outlet", primary: true, render: (ol) => (
                  <div>
                    <div className="font-medium">{ol.name}</div>
                    <div className="text-xs text-muted-foreground">{ol.code}</div>
                  </div>
                ) },
                { key: "mode", label: "Mode", render: (ol) => {
                  const b = budgets[ol.id] || {};
                  const isCombined = (b.budget_mode || "per_bucket") === "combined";
                  return (
                    <div className="inline-flex items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-border/60 p-1" role="group" aria-label={`Mode budget ${ol.name}`} data-testid={`mode-toggle-${ol.code}`}>
                      <button
                        type="button"
                        onClick={() => setRowMode(ol.id, "per_bucket")}
                        aria-pressed={!isCombined}
                        className={cn(
                          "h-8 px-2.5 rounded-[calc(var(--radius)-4px)] text-[13px] font-medium whitespace-nowrap transition-colors",
                          !isCombined ? "pill-active" : "text-muted-foreground hover:bg-foreground/5"
                        )}
                        data-testid={`mode-per-${ol.code}`}
                      >
                        Per-Bucket
                      </button>
                      <button
                        type="button"
                        onClick={() => setRowMode(ol.id, "combined")}
                        aria-pressed={isCombined}
                        className={cn(
                          "h-8 px-2.5 rounded-[calc(var(--radius)-4px)] text-[13px] font-medium whitespace-nowrap transition-colors",
                          isCombined ? "pill-active" : "text-muted-foreground hover:bg-foreground/5"
                        )}
                        data-testid={`mode-combined-${ol.code}`}
                      >
                        Gabungan
                      </button>
                    </div>
                  );
                } },
                ...BUCKETS.map((bk) => ({
                  key: `bucket_${bk}`,
                  label: <span className={bk === "kdo" ? "text-emerald-700 dark:text-emerald-400" : bk === "fdo" ? "text-blue-700 dark:text-blue-400" : "text-purple-700 dark:text-purple-400"}>{bk.toUpperCase()}</span>,
                  render: (ol) => {
                    const b = budgets[ol.id] || {};
                    const isCombined = (b.budget_mode || "per_bucket") === "combined";
                    return (
                      <Input
                        type="number" inputMode="numeric" min="0" step="100000"
                        value={isCombined ? "" : (b[`${bk}_budget`] ?? "")}
                        onChange={(e) => setCell(ol.id, `${bk}_budget`, e.target.value)}
                        placeholder={isCombined ? "—" : "0"}
                        className={cn("w-[132px] text-right tabular-nums", isCombined && "opacity-40")}
                        disabled={isCombined}
                        aria-label={`Budget ${bk.toUpperCase()} ${ol.name}`}
                        data-testid={`cell-${ol.code}-${bk}`}
                        title={isCombined ? "Mode Gabungan — gunakan kolom Gabungan" : ""}
                      />
                    );
                  },
                })),
                { key: "combined", label: <span className="text-sky-700 dark:text-sky-400">Gabungan</span>, render: (ol) => {
                  const b = budgets[ol.id] || {};
                  const isCombined = (b.budget_mode || "per_bucket") === "combined";
                  return (
                    <Input
                      type="number" inputMode="numeric" min="0" step="100000"
                      value={isCombined ? (b.combined_budget ?? "") : ""}
                      onChange={(e) => setCell(ol.id, "combined_budget", e.target.value)}
                      placeholder={isCombined ? "0" : "—"}
                      className={cn("w-[132px] text-right tabular-nums", !isCombined && "opacity-40")}
                      disabled={!isCombined}
                      aria-label={`Budget gabungan ${ol.name}`}
                      data-testid={`cell-${ol.code}-combined`}
                      title={!isCombined ? "Mode Per-Bucket — gunakan kolom KDO/FDO/BDO" : ""}
                    />
                  );
                } },
                { key: "total", label: "Total", numeric: true, render: (ol) => {
                  const b = budgets[ol.id] || {};
                  const isCombined = (b.budget_mode || "per_bucket") === "combined";
                  const rowTotal = isCombined
                    ? Number(b.combined_budget || 0)
                    : Number(b.kdo_budget || 0) + Number(b.fdo_budget || 0) + Number(b.bdo_budget || 0);
                  return <span className="font-semibold tabular-nums whitespace-nowrap">{fmtRp(rowTotal)}</span>;
                } },
                { key: "source", label: "Source", render: (ol) => {
                  const b = budgets[ol.id] || {};
                  return b.id ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/30">Aktif</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">Belum diset</Badge>
                  );
                } },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-aurora/5 border-aurora/20">
        <CardContent className="pt-4 flex items-start gap-3 text-sm">
          <Info className="h-4 w-4 text-aurora mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Catatan</div>
            <ul className="text-muted-foreground space-y-0.5 mt-1 list-disc list-inside">
              <li>
                <strong>Per-Bucket</strong>: KDO, FDO, BDO masing-masing punya budget terpisah.
                PR yang melebihi bucket-nya akan diblokir meskipun total masih sisa.
              </li>
              <li>
                <strong>Gabungan</strong>: 1 pool besar untuk semua KDO/FDO/BDO. PR jenis apapun
                consume dari pool yang sama; diblokir hanya kalau total pool habis.
              </li>
              <li>Tidak ada carryover — sisa di akhir periode <strong>hangus</strong>.</li>
              <li>Outlet bisa kirim Request Penambahan Budget; Anda meng-approve di menu khusus.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


