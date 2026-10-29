/** Inventory Home — KPIs + drill-down tiles. (Phase 9C: Low Stock widget; Audit-Phase B: Market List Pending widget; Outlet Scope: filter by outlet) */
import { Link } from "react-router-dom";
import {
  Package, Layers, ArrowLeftRight, Truck, Sliders, ClipboardCheck,
  BarChart3, ArrowRight, AlertTriangle, ShoppingCart, Star, Clock,
} from "lucide-react";
import { useInventoryHome } from "@/hooks/useInventoryDashboard";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
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
    <div className="space-y-3 lg:space-y-4" data-testid="inventory-home-page">
      <div data-testid="inventory-welcome">
        <PageHeader
          icon={Package}
          title="Inventory Overview"
          subtitle="Cek stok, lakukan transfer/adjustment, dan jalankan opname berkala agar stok sistem tetap akurat."
          className="mb-0 md:mb-0"
          actions={
            <OutletScopePicker
              value={outletId}
              onChange={(id) => setOutletId(id)}
              outlets={scopedOutlets}
              isFullAccess={isFullAccess}
              data-testid="inventory-outlet-picker"
            />
          }
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="inventory-kpi-strip">
        <CompactStatCard label="Total Inventory Value"
          value={fmtRp(val?.total_value || 0)} loading={loading}
          sub="Berdasarkan moving average" icon={BarChart3} color="aurora-1" testId="inv-kpi-value" />
        <CompactStatCard label="Jumlah Item"
          value={fmtNumber(val?.item_count || 0)} loading={loading}
          sub="Item dengan qty > 0" icon={Layers} color="aurora-2" testId="inv-kpi-items" />
        <CompactStatCard label="Low Stock"
          value={lowStock.total_below || 0} loading={loading} tone={lowStock.total_below > 0 ? "danger" : "default"}
          sub="Item di bawah par" icon={AlertTriangle} color="aurora-6" testId="inv-kpi-low-stock" />
        <CompactStatCard label="Opname Aktif"
          value={pendingOpname} loading={loading}
          sub="Sesi in progress" icon={ClipboardCheck} color="aurora-5" testId="inv-kpi-opname" />
      </div>

      {/* Quick actions — tombol eksplisit (bukan kartu yang seluruhnya bisa diklik). */}
      <div className="flex flex-wrap gap-2" data-testid="inventory-quick-actions">
        <QuickAction to="/inventory/balance" icon={Layers} label="Cek stok" testId="inv-qa-balance" />
        <QuickAction to="/inventory/low-stock" icon={AlertTriangle} label="Low stock" testId="inv-qa-lowstock" />
        <QuickAction to="/inventory/movements-hub?type=transfers" icon={Truck} label="Transfer stok" testId="inv-qa-transfer" />
        <QuickAction to="/inventory/movements-hub?type=adjustments" icon={Sliders} label="Adjustment stok" testId="inv-qa-adj" />
        <QuickAction to="/inventory/opname" icon={ClipboardCheck} label="Mulai opname" testId="inv-qa-opname" />
      </div>

      {/* Phase 9C — Low Stock Widget */}
      {lowStock.total_below > 0 && (
        <section className="glass-card p-4 border-l-4 border-rose-500" data-testid="low-stock-widget">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-sm md:text-base font-semibold inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-700 dark:text-rose-400" />
                Top {Math.min(8, lowStock.items.length)} item di bawah par
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total <b>{lowStock.total_below}</b> item di bawah par level di seluruh outlet.
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/inventory/low-stock" data-testid="low-stock-widget-cta">
                <ShoppingCart /> Lihat &amp; buat PR <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(lowStock.items || []).slice(0, 8).map((it) => (
              <div key={`${it.item_id}-${it.outlet_id}`}
                   className="glass-input rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                <span className={`text-[11px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                  it.severity === "critical"
                    ? "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30"
                    : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                }`}>
                  {it.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.item_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {it.outlet_name} · qty {fmtNumber(it.qty, 0)} / par {fmtNumber(it.par_level, 0)}
                  </div>
                </div>
                {it.suggested_reorder > 0 && (
                  <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0">
                    +{it.suggested_reorder}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audit-Phase B — Market List Pending Items Widget */}
      {pendingMarket.count > 0 && (
        <section className="glass-card p-4 border-l-4 border-amber-500" data-testid="market-pending-widget">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-sm md:text-base font-semibold inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                Market Price List — menunggu review
                <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  {pendingMarket.count}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Item baru otomatis dibuat dari KDO/BDO/FDO menunggu review admin.
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/inventory/market-list?ml_status=pending_review" data-testid="market-pending-cta">
                <Star /> Tinjau sekarang <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(pendingMarket.items || []).slice(0, 4).map((it) => (
              <div key={it.id} className="glass-input rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                <Package className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {it.code} · {it.unit_default || "-"} · dari {it.created_from || "auto"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <section className="glass-card p-4" data-testid="inv-recent-movements">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm md:text-base font-semibold">Recent Movements</h2>
            <Link to="/inventory/movements-hub?type=history" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="inv-recent-see-all">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recent.length === 0 && <div className="text-sm text-muted-foreground">Belum ada pergerakan stok.</div>}
          <div className="space-y-1.5">
            {recent.map(m => (
              <div key={m.id} className="glass-input rounded-xl px-3 py-2 flex items-center gap-3">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.item_name || m.item_id}</div>
                  {/* hanya tipe pergerakan yang di-kapitalisasi; waktu relatif tetap huruf kecil seperti di halaman lain */}
                  <div className="text-xs text-muted-foreground">
                    <span className="capitalize">{m.movement_type.replace("_", " ")}</span> · {fmtRelative(m.created_at)}
                  </div>
                </div>
                <div className={`text-sm tabular-nums font-semibold ${m.qty > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {m.qty > 0 ? "+" : ""}{fmtNumber(m.qty, 2)} {m.unit}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-4" data-testid="inv-valuation-by-outlet">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm md:text-base font-semibold">Valuation per Outlet</h2>
            <Link to="/inventory/valuation" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="inv-valuation-see-all">
              Lihat detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading || !val ? (
            <div className="text-sm text-muted-foreground">Memuat…</div>
          ) : Object.entries(val.by_outlet || {}).length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada nilai inventory.</div>
          ) : (
            <div className="space-y-1.5">
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
        </section>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, testId }) {
  return (
    <Button asChild variant="outline">
      <Link to={to} data-testid={testId}>
        <Icon /> {label}
      </Link>
    </Button>
  );
}
