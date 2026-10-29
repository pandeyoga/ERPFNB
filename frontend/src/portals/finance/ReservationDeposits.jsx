/**
 * Finance Portal — Reservation Deposit Summary
 * Standalone di /finance/reservation-deposits, juga tab "Reservation deposits" di Payments hub
 * (prop `embedded` → tanpa judul halaman kedua).
 */
import { useState, useEffect } from "react";
import {
  CalendarCheck, AlertCircle, CheckCircle2,
  RefreshCw, XCircle, RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import dayjs from "dayjs";

const SUMMARY = [
  { label: "Terkumpul",    key: "paid",      tone: "success", color: "aurora-4", icon: CheckCircle2 },
  { label: "Menunggu",     key: "pending",   tone: "warning", color: "aurora-5", icon: AlertCircle },
  { label: "Dikembalikan", key: "refunded",  tone: "info",    color: "aurora-2", icon: RotateCcw },
  { label: "Hangus",       key: "forfeited", tone: "danger",  color: "aurora-6", icon: XCircle },
];

export default function ReservationDeposits({ embedded = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Build month list (last 12 months)
  const months = Array.from({ length: 13 }, (_, i) => {
    const d = dayjs().subtract(i, "month");
    return { value: d.format("YYYY-MM"), label: d.format("MMMM YYYY") };
  });
  const [period, setPeriod] = useState(months[0].value);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/reservations/reports/deposits", { params: { period } });
      if (res.data.success) setData(res.data.data);
    } catch {
      toast.error("Gagal memuat data deposit");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtitle = "Rekap deposit reservasi per periode: terkumpul, menunggu, dikembalikan, dan hangus.";
  const refreshBtn = (
    <Button data-testid="deposits-refresh-btn" variant="outline" size="icon" onClick={load}
      aria-label="Muat ulang" title="Muat ulang">
      <RefreshCw className="w-4 h-4" />
    </Button>
  );

  return (
    <div data-testid="reservation-deposits-page" className="space-y-3 lg:space-y-4">
      {embedded ? (
        <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
      ) : (
        <PageHeader icon={CalendarCheck} title="Reservation Deposits" subtitle={subtitle} />
      )}

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger data-testid="deposits-period-selector" className="w-[200px]" aria-label="Periode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {refreshBtn}
      </div>

      {loading ? (
        <div data-testid="deposits-loading"><LoadingState variant="kpi" /></div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div data-testid="deposits-summary-cards" className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUMMARY.map(({ label, key, tone, color, icon }) => (
              <CompactStatCard key={key} label={label} icon={icon} color={color}
                tone={(data.totals?.[key] || 0) > 0 ? tone : "default"}
                value={formatCurrency(data.totals?.[key] || 0)}
                testId={`deposits-card-${key}`} />
            ))}
          </div>

          {/* By Outlet Table */}
          <Card data-testid="deposits-outlet-table-card">
            <CardHeader>
              <CardTitle>Detail per Outlet</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                rows={data.by_outlet || []}
                keyField="outlet_id"
                rowTestIdPrefix="deposits-outlet-row"
                className="px-2 pb-2"
                empty={(
                  <div data-testid="deposits-empty">
                    <EmptyState icon={CalendarCheck} title="Belum ada deposit"
                      description="Tidak ada data deposit reservasi untuk periode ini." />
                  </div>
                )}
                columns={[
                  { key: "outlet_name", label: "Outlet", primary: true, sortable: true,
                    render: (o) => <span className="font-medium">{o.outlet_name}</span> },
                  { key: "count", label: "Reservasi", numeric: true, sortable: true },
                  { key: "paid", label: "Terkumpul", numeric: true, sortable: true,
                    render: (o) => <span className="text-emerald-700 dark:text-emerald-400 font-medium">{formatCurrency(o.paid || 0)}</span> },
                  { key: "pending", label: "Menunggu", numeric: true,
                    render: (o) => <span className="text-amber-800 dark:text-amber-400">{formatCurrency(o.pending || 0)}</span> },
                  { key: "refunded", label: "Dikembalikan", numeric: true,
                    render: (o) => <span className="text-sky-700 dark:text-sky-400">{formatCurrency(o.refunded || 0)}</span> },
                  { key: "forfeited", label: "Hangus", numeric: true,
                    render: (o) => <span className="text-rose-700 dark:text-rose-400">{formatCurrency(o.forfeited || 0)}</span> },
                ]}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="glass-card" data-testid="deposits-no-data">
          <EmptyState icon={CalendarCheck} title="Tidak ada data"
            description="Data deposit belum tersedia. Coba muat ulang atau pilih periode lain." />
        </div>
      )}
    </div>
  );
}
