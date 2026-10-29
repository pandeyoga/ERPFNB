/** Stock Valuation — snapshot nilai persediaan per outlet. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import { REPORT_CENTER_PERMS } from "@/lib/portals";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import useOutletScope from "@/hooks/useOutletScope";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtDateTime } from "@/lib/format";
import { BarChart3, Layers, Building2, Calculator, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function Valuation() {
  const { user } = useAuth();
  const { outletId, setOutletId, scopedOutlets } = useOutletScope();
  const [val, setVal] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/valuation", { params });
      setVal(unwrap(res));
    } catch (e) {
      toast.error("Gagal memuat valuasi stok");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [outletId]); // eslint-disable-line

  // Ekspor Excel ada di Report Center (/reports/inventory-valuation) — halaman ini on-screen.
  const canExport = permitted(user, REPORT_CENTER_PERMS);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="inventory-valuation-page">
      <PageHeader
        icon={Calculator}
        title="Stock Valuation"
        subtitle="Nilai persediaan (moving average) per outlet."
        className="mb-0 md:mb-0"
        actions={canExport ? (
          <Button asChild variant="outline" data-testid="val-export-link">
            <Link to="/reports/inventory-valuation"><FileSpreadsheet /> Ekspor Excel</Link>
          </Button>
        ) : null}
      />

      <div className="flex flex-wrap gap-3 items-end" data-testid="val-toolbar">
        <div className="min-w-[220px]">
          <Label className="text-xs md:text-sm font-medium">Outlet</Label>
          <SimpleSelect
            value={outletId}
            onValueChange={setOutletId}
            options={[{ value: "", label: "Semua (konsolidasi)" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Semua (konsolidasi)"
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            testId="val-outlet"
            ariaLabel="Filter outlet"
          />
        </div>
        <div className="text-xs text-muted-foreground pb-2.5" data-testid="val-asof">Per: {val?.as_of ? fmtDateTime(val.as_of) : "—"}</div>
      </div>

      {loading ? (
        <LoadingState rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="val-kpi-strip">
            <div data-testid="val-kpi-total"><CompactStatCard label="Total nilai persediaan" value={fmtRp(val?.total_value || 0)} icon={BarChart3} color="aurora-1" testId="val-kpi-total-card" /></div>
            <div data-testid="val-kpi-items"><CompactStatCard label="Jumlah item (qty > 0)" value={val?.item_count || 0} icon={Layers} color="aurora-2" testId="val-kpi-items-card" /></div>
            <div data-testid="val-kpi-outlets"><CompactStatCard label="Outlet" value={Object.keys(val?.by_outlet || {}).length} icon={Building2} color="aurora-4" testId="val-kpi-outlets-card" /></div>
          </div>

          <div className="glass-card p-4" data-testid="val-by-outlet-card">
            <h2 className="text-sm md:text-base font-semibold mb-3">Per outlet</h2>
            {(!val?.by_outlet || Object.keys(val.by_outlet).length === 0) ? (
              <div data-testid="val-empty"><EmptyState title="Belum ada nilai persediaan" description="Nilai muncul setelah ada stok (GR, transfer, atau adjustment) di outlet." /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="val-outlet-list">
                {Object.entries(val.by_outlet).map(([oid, value]) => {
                  const o = scopedOutlets.find(x => x.id === oid);
                  const pct = val.total_value > 0 ? (value / val.total_value) * 100 : 0;
                  return (
                    <div key={oid} className="glass-input rounded-xl p-3" data-testid={`val-outlet-${oid}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{o?.name || oid}</span>
                        <span className="font-semibold tabular-nums" data-testid={`val-outlet-value-${oid}`}>{fmtRp(value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                        <div className="h-full grad-aurora" style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5" data-testid={`val-outlet-pct-${oid}`}>{pct.toFixed(1)}% dari total</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
