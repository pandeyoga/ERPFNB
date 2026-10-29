/**
 * Phase 11B — Cash Position Dashboard
 * Single page that shows: net liquid cash, breakdown by type, projection 30/60/90,
 * per-account table with update / reconcile / history actions, CSV bulk uploader.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Banknote, CreditCard, Smartphone, Building2,
  TrendingUp, TrendingDown, RefreshCw, FileSpreadsheet, Plus, History,
  AlertTriangle, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { GlassTooltip } from "@/components/shared/charts/chartKit";
import UpdateBalanceModal from "@/components/shared/UpdateBalanceModal";
import CashCsvUploader from "@/components/shared/CashCsvUploader";
import { Button } from "@/components/ui/button";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { fmtRp, fmtDateTime, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const TYPE_META = {
  bank:        { label: "Bank",       icon: Building2,  tone: "text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300" },
  petty_cash:  { label: "Petty Cash", icon: Banknote,   tone: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300" },
  ewallet:     { label: "E-Wallet",   icon: Smartphone, tone: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300" },
  other:       { label: "Lainnya",    icon: CreditCard, tone: "text-foreground bg-muted/40 dark:bg-slate-900/40 dark:text-slate-300" },
};

const HEALTH_TONE = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 border-amber-200 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300",
  red:   "bg-rose-100 text-rose-800 border-rose-200 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300",
};

const HEALTH_ICON = { green: CheckCircle2, amber: AlertCircle, red: AlertTriangle };

/**
 * Dipakai di /finance/cash-position, /owner/cash, dan tab "Cash position" Payments hub.
 * `embedded` → tanpa PageHeader (hub sudah punya <h1>), aksi pindah ke toolbar ringkas.
 */
export default function CashPosition({ embedded = false }) {
  const { can } = useAuth();
  const canUpdate = can("finance.cash.update");
  const [accounts, setAccounts] = useState([]);
  const [position, setPosition] = useState(null);
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState(null);
  const [showCsv, setShowCsv] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [historyAcc, setHistoryAcc] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const [accRes, posRes, projRes] = await Promise.all([
        api.get("/finance/cash/accounts"),
        api.get("/finance/cash/position"),
        api.get("/finance/cash/position/projection", { params: { days } }),
      ]);
      setAccounts(unwrap(accRes) || []);
      setPosition(unwrap(posRes));
      setProjection(unwrap(projRes));
    } catch (e) {
      toast.error("Gagal memuat Cash Position");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    api.get("/finance/cash/position/projection", { params: { days } })
      .then((r) => setProjection(unwrap(r)))
      .catch(() => {});
  }, [days]);

  async function loadHistory(acc) {
    setHistoryAcc(acc);
    try {
      const r = await api.get(`/finance/cash/accounts/${acc.id}/history`, { params: { days: 60 } });
      setHistoryRows(unwrap(r) || []);
    } catch {
      setHistoryRows([]);
    }
  }

  const grouped = useMemo(() => {
    const out = { bank: [], petty_cash: [], ewallet: [], other: [] };
    for (const a of accounts) (out[a.type] ||= []).push(a);
    return out;
  }, [accounts]);

  const HealthIcon = position?.health ? HEALTH_ICON[position.health] : CheckCircle2;

  const subtitle = "Saldo kas & bank real-time, eksposur AP, runway, dan proyeksi kas 30/60/90 hari.";
  const actions = (
    <>
      <Button variant="outline" onClick={load} data-testid="cash-refresh-btn">
        <RefreshCw className="h-4 w-4" /> Muat ulang
      </Button>
      {canUpdate && (
        <>
          <Button variant="outline" onClick={() => setShowCsv(true)} data-testid="cash-csv-btn">
            <FileSpreadsheet className="h-4 w-4" /> Unggah CSV
          </Button>
          <Button onClick={() => setShowCreate(true)} data-testid="cash-create-btn">
            <Plus className="h-4 w-4" /> Akun Baru
          </Button>
        </>
      )}
    </>
  );
  const header = embedded ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  ) : (
    <PageHeader icon={Wallet} title="Cash Position" subtitle={subtitle} actions={actions} />
  );

  if (loading && !position) return (
    <div className="space-y-3 lg:space-y-4" data-testid="cash-position-page">
      {header}
      <LoadingState variant="kpi" />
    </div>
  );

  const runwayTone = position?.health === "red" ? "danger" : position?.health === "amber" ? "warning" : "success";

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="cash-position-page">
      {header}

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="cash-kpi-strip">
        <div data-testid="cash-kpi-net">
          <CompactStatCard
            label="Net liquid cash"
            value={fmtRp(position?.net_liquid_cash || 0)}
            icon={Wallet}
            color="aurora-1"
            sub={`${position?.account_count || 0} akun aktif`}
          />
        </div>
        <div data-testid="cash-kpi-ap">
          <CompactStatCard
            label="AP exposure"
            value={fmtRp(position?.ap_exposure || 0)}
            icon={CreditCard}
            color="aurora-2"
            sub="Invoice outstanding"
          />
        </div>
        <div data-testid="cash-kpi-after-ap">
          <CompactStatCard
            label="Net after AP"
            value={fmtRp(position?.net_after_ap || 0)}
            icon={position?.net_after_ap >= 0 ? TrendingUp : TrendingDown}
            color={position?.net_after_ap >= 0 ? "aurora-4" : "aurora-6"}
            tone={position?.net_after_ap >= 0 ? "success" : "danger"}
            sub={position?.net_after_ap >= 0 ? "Sehat" : "Defisit"}
          />
        </div>
        <div data-testid="cash-kpi-runway">
          <CompactStatCard
            label="Days runway"
            value={position?.days_runway ? `${position.days_runway} hari` : "—"}
            icon={HealthIcon}
            color={runwayTone === "danger" ? "aurora-6" : runwayTone === "warning" ? "aurora-5" : "aurora-4"}
            tone={position?.days_runway ? runwayTone : "default"}
            sub={`Burn rate Rp ${fmtNumber(position?.daily_burn || 0)}/hari`}
          />
        </div>
      </div>

      {/* Health banner */}
      {position?.days_runway != null && (
        <div className={cn(
          "glass-card p-4 flex items-center gap-3 border",
          HEALTH_TONE[position.health],
        )} data-testid="cash-health-banner">
          <HealthIcon className="h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">
              {position.health === "red"   && "Critical — cash runway < 14 hari. "}
              {position.health === "amber" && "Watch — cash runway antara 14–45 hari. "}
              {position.health === "green" && "Sehat — cash runway > 45 hari. "}
            </span>
            Total cash sekarang Rp {fmtNumber(position.net_liquid_cash)} → {position.days_runway} hari ke depan.
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="cash-toolbar">
        <h2 className="text-base md:text-lg font-semibold">Akun likuid</h2>
        <span className="text-xs text-muted-foreground">Klik ikon riwayat untuk melihat mutasi saldo 60 hari.</span>
      </div>

      {/* By type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4" data-testid="cash-by-type">
        {["bank", "petty_cash", "ewallet"].map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const list = grouped[type] || [];
          const total = list.reduce((s, a) => s + (a.current_balance || 0), 0);
          return (
            <div key={type} className="glass-card p-4" data-testid={`cash-type-${type}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-9 w-9 rounded-[calc(var(--radius)-2px)] flex items-center justify-center", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{list.length} akun</div>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-base font-semibold" data-testid={`cash-type-total-${type}`}>{fmtRp(total)}</div>
                </div>
              </div>
              <ul className="space-y-1.5" data-testid={`cash-accounts-${type}`}>
                {list.length === 0 && (
                  <li className="text-xs text-muted-foreground italic" data-testid={`cash-empty-${type}`}>Belum ada akun</li>
                )}
                {list.map((a) => (
                  <li key={a.id}
                      className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                      data-testid={`cash-account-${a.code}`}>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {a.outlet_name || a.bank_name || a.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right tabular-nums">
                        <div className="font-semibold whitespace-nowrap" data-testid={`cash-balance-${a.code}`}>{fmtRp(a.current_balance)}</div>
                        {canUpdate && (
                          <Button variant="link" size="sm" onClick={() => setSelected(a)}
                            className="h-auto p-0 text-xs"
                            data-testid={`cash-update-${a.code}`}>
                            Update saldo
                          </Button>
                        )}
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => loadHistory(a)}
                        aria-label={`Riwayat saldo ${a.name}`} title="Riwayat saldo"
                        data-testid={`cash-history-${a.code}`}>
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Projection chart */}
      <div className="glass-card p-4" data-testid="cash-projection-card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm md:text-base font-semibold">Proyeksi {days} hari</h3>
            <p className="text-xs text-muted-foreground">
              Asumsi: AP outflow per due-date + flat daily burn dari rata-rata 30 hari.
            </p>
          </div>
          <SegmentedFilter
            value={days}
            onChange={(v) => setDays(Number(v))}
            ariaLabel="Horizon proyeksi"
            testId="cash-projection-days"
            options={[30, 60, 90].map((d) => ({ value: d, label: `${d} hari`, testId: `cash-days-${d}` }))}
          />
        </div>
        {projection?.series?.length ? (
          <div style={{ height: 260 }} data-testid="cash-projection-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projection.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }}
                       tickFormatter={(d) => d.slice(5)}
                       interval={Math.max(1, Math.floor((projection.series.length - 1) / 8))} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip content={<GlassTooltip valueFormatter={fmtRp} labelFormatter={(d) => `Tanggal: ${d}`} />} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="balance" name="Saldo" stroke="hsl(var(--aurora-1))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="Belum ada proyeksi" description="Proyeksi muncul setelah ada saldo akun dan histori pengeluaran." />
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4" data-testid="cash-projection-summary">
          <div className="text-xs space-y-0.5">
            <div className="text-muted-foreground">Start balance</div>
            <div className="font-semibold" data-testid="cash-proj-start">{fmtRp(projection?.start_balance || 0)}</div>
          </div>
          <div className="text-xs space-y-0.5">
            <div className="text-muted-foreground">Akhir periode</div>
            <div className="font-semibold" data-testid="cash-proj-end">{fmtRp(projection?.end_balance || 0)}</div>
          </div>
          <div className="text-xs space-y-0.5">
            <div className="text-muted-foreground">Net change</div>
            <div className={cn("font-semibold", (projection?.end_change || 0) < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")} data-testid="cash-proj-change">
              {(projection?.end_change || 0) >= 0 ? "+" : ""}{fmtRp(projection?.end_change || 0)}
            </div>
          </div>
          <div className="text-xs space-y-0.5">
            <div className="text-muted-foreground">Total AP {days}d</div>
            <div className="font-semibold" data-testid="cash-proj-ap">{fmtRp(projection?.ap_total || 0)}</div>
          </div>
        </div>
      </div>

      {selected && (
        <UpdateBalanceModal
          account={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load(); }}
        />
      )}
      {showCsv && (
        <CashCsvUploader
          onClose={() => setShowCsv(false)}
          onDone={() => { setShowCsv(false); load(); }}
        />
      )}
      {showCreate && (
        <UpdateBalanceModal
          createMode
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}

      {/* History dialog */}
      <Dialog open={!!historyAcc} onOpenChange={(v) => !v && setHistoryAcc(null)}>
        <DialogContent className="max-w-2xl" data-testid="cash-history-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Riwayat saldo — {historyAcc?.name}
            </DialogTitle>
          </DialogHeader>
          {historyRows.length === 0 ? (
            <EmptyState title="Belum ada riwayat" description="Belum ada perubahan saldo dalam 60 hari terakhir." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <DataTable
                rows={historyRows}
                keyField="id"
                rowTestIdPrefix="cash-history-row"
                columns={[
                  { key: "recorded_at", label: "Tanggal", sortable: true, primary: true,
                    render: (h) => <span className="text-xs">{fmtDateTime(h.recorded_at)}</span> },
                  { key: "source", label: "Source",
                    render: (h) => <Badge variant="outline" className="text-xs">{h.source}</Badge> },
                  { key: "balance", label: "Saldo", numeric: true, sortable: true,
                    render: (h) => <span className="font-medium">{fmtRp(h.balance)}</span> },
                  { key: "delta", label: "Delta", numeric: true,
                    render: (h) => (
                      <span className={cn("text-xs", (h.delta || 0) > 0 ? "text-emerald-700 dark:text-emerald-400" : (h.delta || 0) < 0 ? "text-rose-700 dark:text-rose-400" : "text-muted-foreground")}>
                        {h.delta > 0 ? "+" : ""}{fmtRp(h.delta || 0)}
                      </span>
                    ) },
                ]}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
