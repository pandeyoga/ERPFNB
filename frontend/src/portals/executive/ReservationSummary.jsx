/**
 * Executive Portal — Reservation Summary
 */
import { useState, useEffect } from "react";
import {
  CalendarCheck, Users, Clock,
  RefreshCw, UserCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import LoadingState from "@/components/shared/LoadingState";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import { fmtNumber } from "@/lib/format";
import api from "@/lib/api";
import { toast } from "sonner";

const STATUS_LABELS = {
  pending: "Menunggu",
  confirmed: "Dikonfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  no_show: "Tidak Hadir",
};


export default function ReservationSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/reservations/reports/executive", {
        params: {
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo && { date_to: dateTo }),
        },
      });
      if (res.data.success) setSummary(res.data.data);
    } catch {
      toast.error("Gagal memuat ringkasan reservasi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = Object.keys(STATUS_LABELS);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="reservation-summary-page">
      <PageHeader
        icon={CalendarCheck}
        title="Reservations"
        subtitle="Statistik dan performa reservasi semua outlet"
        className="mb-0 md:mb-0"
        actions={
          <Button variant="outline" onClick={load} disabled={loading} data-testid="reservation-refresh">
            <RefreshCw className={loading ? "animate-spin" : undefined} /> Muat ulang
          </Button>
        }
      />

      {/* Filters */}
      <div className="glass-card p-3 flex flex-wrap items-end gap-3" data-testid="reservation-filters">
        <div className="space-y-1">
          <Label htmlFor="reservation-date-from" className="text-xs md:text-sm font-medium">Dari</Label>
          <Input id="reservation-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" data-testid="filter-date-from" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reservation-date-to" className="text-xs md:text-sm font-medium">Sampai</Label>
          <Input id="reservation-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" data-testid="filter-date-to" />
        </div>
      </div>

      {loading ? (
        <LoadingState rows={4} />
      ) : summary ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="reservation-kpi-cards">
            <CompactStatCard testId="reservation-kpi-total" label="Total Reservasi" value={fmtNumber(summary.total)} icon={CalendarCheck} color="aurora-1" />
            <CompactStatCard testId="reservation-kpi-upcoming" label="Akan Datang" value={fmtNumber(summary.upcoming)} icon={Clock} color="aurora-3" tone="info" />
            <CompactStatCard testId="reservation-kpi-completed" label="Selesai" value={fmtNumber(summary.by_status?.completed?.count || 0)} icon={UserCheck} color="aurora-4" tone="success" />
            <CompactStatCard testId="reservation-kpi-pax" label="Total Tamu" value={fmtNumber(summary.total_pax)} icon={Users} color="aurora-5" tone="warning" />
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            <Card>
              <CardHeader><CardTitle>Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statuses.map(s => {
                    const data = summary.by_status?.[s];
                    const count = data?.count || 0;
                    const pct = summary.total > 0 ? Math.round(count / summary.total * 100) : 0;
                    return (
                      <div key={s} className="flex items-center justify-between gap-3">
                        <StatusPill status={s} label={STATUS_LABELS[s]} />
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-muted rounded-full h-2">
                            <div
                              className="bg-amber-500 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-16 text-right tabular-nums">{count} ({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* By Outlet */}
            <Card>
              <CardHeader><CardTitle>Per Outlet</CardTitle></CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={[
                    { key: "outlet_name", label: "Outlet", primary: true, sortable: true, render: (o) => <span className="font-medium">{o.outlet_name}</span> },
                    { key: "count", label: "Reservasi", numeric: true, sortable: true },
                    { key: "pax", label: "Tamu", numeric: true, sortable: true },
                    { key: "completed", label: "Selesai", numeric: true, sortable: true, render: (o) => <span className="text-green-700 dark:text-green-400">{o.completed}</span> },
                  ]}
                  rows={summary.by_outlet || []}
                  keyField="outlet_id"
                  defaultSort={{ key: "count", dir: "desc" }}
                  empty={<p className="text-muted-foreground text-sm p-4" data-testid="reservation-outlet-empty">Belum ada reservasi pada rentang tanggal ini.</p>}
                  rowTestIdPrefix="reservation-outlet-row"
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="glass-card">
          <EmptyState icon={CalendarCheck} title="Tidak ada data" description="Ringkasan reservasi belum tersedia untuk rentang tanggal ini." />
        </div>
      )}
    </div>
  );
}
