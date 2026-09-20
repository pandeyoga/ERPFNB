/** Inventory valuation snapshot per outlet. */
import { useEffect, useState } from "react";
import api, { unwrap } from "@/lib/api";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import useOutletScope from "@/hooks/useOutletScope";
import KpiCard from "@/components/shared/KpiCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtDateTime } from "@/lib/format";
import { BarChart3, Layers, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function Valuation() {
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
      toast.error("Gagal load valuation");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [outletId]); // eslint-disable-line

  if (loading) return (
    <div className="space-y-4" data-testid="inventory-valuation-page">
      <LoadingState rows={4} />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="inventory-valuation-page">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end" data-testid="val-toolbar">
        <div className="min-w-[220px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <SimpleSelect
            value={outletId}
            onValueChange={setOutletId}
            options={[{ value: "", label: "Semua (consolidated)" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Semua (consolidated)"
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            testId="val-outlet"
          />
        </div>
        <div className="text-xs text-muted-foreground" data-testid="val-asof">As of: {val?.as_of ? fmtDateTime(val.as_of) : "—"}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="val-kpi-strip">
        <div data-testid="val-kpi-total"><KpiCard label="Total Inventory Value" value={fmtRp(val?.total_value || 0)} icon={BarChart3} color="aurora-1" /></div>
        <div data-testid="val-kpi-items"><KpiCard label="Item Count (qty>0)" value={val?.item_count || 0} icon={Layers} color="aurora-2" /></div>
        <div data-testid="val-kpi-outlets"><KpiCard label="Outlet" value={Object.keys(val?.by_outlet || {}).length} icon={Building2} color="aurora-4" /></div>
      </div>

      <div className="glass-card p-5" data-testid="val-by-outlet-card">
        <h3 className="font-semibold mb-3">Per Outlet</h3>
        {(!val?.by_outlet || Object.keys(val.by_outlet).length === 0) ? (
          <div data-testid="val-empty"><EmptyState title="Belum ada nilai inventory" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="val-outlet-list">
            {Object.entries(val.by_outlet).map(([oid, value]) => {
              const o = scopedOutlets.find(x => x.id === oid);
              const pct = val.total_value > 0 ? (value / val.total_value) * 100 : 0;
              return (
                <div key={oid} className="glass-input rounded-xl p-4" data-testid={`val-outlet-${oid}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{o?.name || oid}</span>
                    <span className="font-bold tabular-nums" data-testid={`val-outlet-value-${oid}`}>{fmtRp(value)}</span>
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
    </div>
  );
}
