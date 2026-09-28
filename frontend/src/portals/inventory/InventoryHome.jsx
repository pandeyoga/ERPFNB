/** Inventory Home — KPIs + drill-down tiles. (Phase 9C: Low Stock widget; Audit-Phase B: Market List Pending widget; Outlet Scope: filter by outlet) */
import { Link } from "react-router-dom";
import {
  Package, Layers, ArrowLeftRight, Truck, Sliders, ClipboardCheck,
  BarChart3, ArrowRight, AlertTriangle, ShoppingCart, Star, Clock,
} from "lucide-react";
import { useInventoryHome } from "@/hooks/useInventoryDashboard";
import KpiCard from "@/components/shared/KpiCard";
import OutletScopePicker from "@/components/shared/OutletScopePicker";
import useOutletScope from "@/hooks/useOutletScope";
import { fmtRp, fmtNumber, fmtRelative } from "@/lib/format";

export default function InventoryHome() {
  const { outletId, setOutletId, scopedOutlets, isFullAccess } = useOutletScope();
  const { data, isLoading: loading } = useInventoryHome(outletId);
  
  const val = data?.valuation || null;
  const recent = data?.recent || [];
  const pendingOpname = data?.pendingOpname || 0;
  const lowStock = data?.lowStock || { items: [], total_below: 0 };
  const pendingMarket = data?.pendingMarket || { count: 0, items: [] };

  return (
    <div className="space-y-6" data-testid="inventory-home-page">
      <div className="glass-card p-6" data-testid="inventory-welcome">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold mb-1">Inventory Overview</h2>
            <p className="text-sm text-muted-foreground">
              Cek stok, lakukan transfer/adjustment, dan jalankan opname berkala. Setiap event posting akan menjaga akurasi inventory.
            </p>
          </div>
          <OutletScopePicker
            value={outletId}
            onChange={(id) => setOutletId(id)}
            outlets={scopedOutlets}
            isFullAccess={isFullAccess}
            data-testid="inventory-outlet-picker"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="inventory-kpi-strip">
        <KpiCard label="Total Inventory Value"
          value={loading ? "…" : fmtRp(val?.total_value || 0)}
          hint="Berdasarkan moving avg" icon={BarChart3} color="aurora-1" />
        <KpiCard label="Item Count"
          value={loading ? "…" : fmtNumber(val?.item_count || 0)}
          hint="Item dengan qty > 0" icon={Layers} color="aurora-2" />
        <KpiCard label="Low Stock"
          value={loading ? "…" : (lowStock.total_below || 0)}
          hint="Item di bawah par" icon={AlertTriangle} color="aurora-3" />
        <KpiCard label="Opname Aktif"
          value={loading ? "…" : pendingOpname}
          hint="Sesi in_progress" icon={ClipboardCheck} color="aurora-5" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="inventory-quick-actions">
        <ActionTile to="/inventory/balance" icon={Layers} label="Cek Stock" testId="inv-qa-balance" />
        <ActionTile to="/inventory/low-stock" icon={AlertTriangle} label="Low Stock" testId="inv-qa-lowstock" />
        <ActionTile to="/inventory/transfers" icon={Truck} label="Buat Transfer" testId="inv-qa-transfer" />
        <ActionTile to="/inventory/adjustments" icon={Sliders} label="Adjustment" testId="inv-qa-adj" />
        <ActionTile to="/inventory/opname" icon={ClipboardCheck} label="Mulai Opname" testId="inv-qa-opname" />
      </div>

      {/* Phase 9C — Low Stock Widget */}
      {lowStock.total_below > 0 && (
        <div className="glass-card p-5 border-l-4 border-rose-500" data-testid="low-stock-widget">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Top {Math.min(8, lowStock.items.length)} Items Below Par
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total <b>{lowStock.total_below}</b> item di bawah par level di seluruh outlet.
              </p>
            </div>
            <Link to="/inventory/low-stock"
                  className="text-xs px-3 py-1.5 rounded-full bg-foreground text-background inline-flex items-center gap-1.5 hover:opacity-90"
                  data-testid="low-stock-widget-cta">
              <ShoppingCart className="h-3.5 w-3.5" />
              Lihat & Buat PR
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(lowStock.items || []).slice(0, 8).map((it) => (
              <div key={`${it.item_id}-${it.outlet_id}`}
                   className="glass-input rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                <span className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                  it.severity === "critical"
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                }`}>
                  {it.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.item_name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {it.outlet_name} · qty {fmtNumber(it.qty, 0)} / par {fmtNumber(it.par_level, 0)}
                  </div>
                </div>
                {it.suggested_reorder > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0">
                    +{it.suggested_reorder}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit-Phase B — Market List Pending Items Widget */}
      {pendingMarket.count > 0 && (
        <div className="glass-card p-5 border-l-4 border-amber-500" data-testid="market-pending-widget">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Market List Pending Review
                <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                  {pendingMarket.count}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Item baru otomatis dibuat dari KDO/BDO/FDO menunggu review admin.
              </p>
            </div>
            <Link
              to="/inventory/market-list?ml_status=pending_review"
              className="text-xs px-3 py-1.5 rounded-full bg-foreground text-background inline-flex items-center gap-1.5 hover:opacity-90"
              data-testid="market-pending-cta"
            >
              <Star className="h-3.5 w-3.5" />
              Review Now
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(pendingMarket.items || []).slice(0, 4).map((it) => (
              <div key={it.id} className="glass-input rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                <Package className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {it.code} · {it.unit_default || "-"} · dari {it.created_from || "auto"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Movements</h3>
            <Link to="/inventory/movements" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recent.length === 0 && <div className="text-sm text-muted-foreground italic">Belum ada movement.</div>}
          <div className="space-y-1.5">
            {recent.map(m => (
              <div key={m.id} className="glass-input rounded-xl px-3 py-2.5 flex items-center gap-3">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.item_name || m.item_id}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {m.movement_type.replace("_", " ")} · {fmtRelative(m.created_at)}
                  </div>
                </div>
                <div className={`text-sm tabular-nums font-semibold ${m.qty > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {m.qty > 0 ? "+" : ""}{fmtNumber(m.qty, 2)} {m.unit}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Valuation per Outlet</h3>
          {loading || !val ? (
            <div className="text-sm text-muted-foreground italic">Memuat…</div>
          ) : Object.entries(val.by_outlet || {}).length === 0 ? (
            <div className="text-sm text-muted-foreground italic">Belum ada nilai inventory.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(val.by_outlet).map(([oid, value]) => {
                const o = scopedOutlets.find(x => x.id === oid);
                return (
                  <div key={oid} className="glass-input rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-sm">{o?.name || oid}</span>
                    <span className="font-semibold tabular-nums">{fmtRp(value)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionTile({ to, icon: Icon, label, testId }) {
  return (
    <Link to={to} className="glass-card-hover p-4 flex items-center gap-3" data-testid={testId}>
      <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{label}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
