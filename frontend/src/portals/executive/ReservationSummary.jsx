/**
 * Executive Portal — Reservation Summary
 */
import { useState, useEffect } from "react";
import {
  CalendarCheck, Users, Clock,
  RefreshCw, Loader2, UserCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DataTable from "@/components/shared/DataTable";
import api from "@/lib/api";
import { toast } from "sonner";

const STATUS_LABELS = {
  pending: "Menunggu",
  confirmed: "Dikonfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  no_show: "Tidak Hadir",
};

const STATUS_COLORS = {
  pending: "text-amber-600",
  confirmed: "text-blue-600",
  completed: "text-green-600",
  cancelled: "text-red-600",
  no_show: "text-gray-500",
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
    <div className="p-6 space-y-6" data-testid="reservation-summary-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ringkasan Reservasi</h1>
          <p className="text-gray-500 text-sm mt-1">Statistik dan performa reservasi semua outlet</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} data-testid="reservation-refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3" data-testid="reservation-filters">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Dari</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px]" data-testid="filter-date-from" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sampai</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px]" data-testid="filter-date-to" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : summary ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="reservation-kpi-cards">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-gray-900 tabular-nums">{summary.total}</p>
                <p className="text-gray-500 text-sm mt-1 flex items-center justify-center gap-1">
                  <CalendarCheck className="w-4 h-4" /> Total Reservasi
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-blue-600 tabular-nums">{summary.upcoming}</p>
                <p className="text-gray-500 text-sm mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" /> Akan Datang
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600 tabular-nums">{summary.by_status?.completed?.count || 0}</p>
                <p className="text-gray-500 text-sm mt-1 flex items-center justify-center gap-1">
                  <UserCheck className="w-4 h-4" /> Selesai
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-amber-600 tabular-nums">{summary.total_pax}</p>
                <p className="text-gray-500 text-sm mt-1 flex items-center justify-center gap-1">
                  <Users className="w-4 h-4" /> Total Tamu
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statuses.map(s => {
                    const data = summary.by_status?.[s];
                    const count = data?.count || 0;
                    const pct = summary.total > 0 ? Math.round(count / summary.total * 100) : 0;
                    return (
                      <div key={s} className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-amber-500 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500 w-16 text-right tabular-nums">{count} ({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* By Outlet */}
            <Card>
              <CardHeader><CardTitle className="text-base">Per Outlet</CardTitle></CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={[
                    { key: "outlet_name", label: "Outlet", primary: true, sortable: true, render: (o) => <span className="font-medium">{o.outlet_name}</span> },
                    { key: "count", label: "Reservasi", numeric: true, sortable: true },
                    { key: "pax", label: "Tamu", numeric: true, sortable: true },
                    { key: "completed", label: "Selesai", numeric: true, sortable: true, render: (o) => <span className="text-green-600">{o.completed}</span> },
                  ]}
                  rows={summary.by_outlet || []}
                  keyField="outlet_id"
                  defaultSort={{ key: "count", dir: "desc" }}
                  empty={<p className="text-gray-400 text-sm p-4" data-testid="reservation-outlet-empty">Belum ada data</p>}
                  rowTestIdPrefix="reservation-outlet-row"
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-gray-400 text-center py-12">Tidak ada data</p>
      )}
    </div>
  );
}
