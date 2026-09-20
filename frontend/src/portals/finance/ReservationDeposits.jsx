/**
 * Finance Portal — Reservation Deposit Summary
 */
import { useState, useEffect } from "react";
import {
  CalendarCheck, DollarSign, AlertCircle, CheckCircle2,
  RefreshCw, Loader2, XCircle, RotateCcw
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import dayjs from "dayjs";

export default function ReservationDeposits() {
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

  const DEPOSIT_COLORS = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    refunded: "bg-blue-100 text-blue-700",
    forfeited: "bg-red-100 text-red-700",
    none: "bg-gray-100 text-gray-500",
  };

  return (
    <div data-testid="reservation-deposits-page" className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deposit Reservasi</h1>
          <p className="text-gray-500 text-sm mt-1">Rekap deposit reservasi per periode</p>
        </div>
        <Button data-testid="deposits-refresh-btn" variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Period filter */}
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger data-testid="deposits-period-selector" className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map(m => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <div data-testid="deposits-loading" className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div data-testid="deposits-summary-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Terkumpul", key: "paid", color: "text-green-600", icon: CheckCircle2 },
              { label: "Menunggu", key: "pending", color: "text-amber-600", icon: AlertCircle },
              { label: "Dikembalikan", key: "refunded", color: "text-blue-600", icon: RotateCcw },
              { label: "Hangus", key: "forfeited", color: "text-red-600", icon: XCircle },
            ].map(({ label, key, color, icon: Icon }) => (
              <Card key={key} data-testid={`deposits-card-${key}`}>
                <CardContent className="pt-4 text-center">
                  <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
                  <p className={`text-2xl font-bold ${color}`}>
                    {formatCurrency(data.totals?.[key] || 0)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* By Outlet Table */}
          <Card data-testid="deposits-outlet-table-card">
            <CardHeader>
              <CardTitle className="text-base">Detail per Outlet</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                rows={data.by_outlet || []}
                keyField="outlet_id"
                rowTestIdPrefix="deposits-outlet-row"
                className="px-2 pb-2"
                empty={(
                  <div data-testid="deposits-empty" className="text-center py-8 text-gray-400">
                    <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Tidak ada data deposit untuk periode ini</p>
                  </div>
                )}
                columns={[
                  { key: "outlet_name", label: "Outlet", primary: true, sortable: true,
                    render: (o) => <span className="font-medium">{o.outlet_name}</span> },
                  { key: "count", label: "Reservasi", numeric: true, sortable: true },
                  { key: "paid", label: "Terkumpul", numeric: true, sortable: true,
                    render: (o) => <span className="text-green-600 font-medium">{formatCurrency(o.paid || 0)}</span> },
                  { key: "pending", label: "Menunggu", numeric: true,
                    render: (o) => <span className="text-amber-600">{formatCurrency(o.pending || 0)}</span> },
                  { key: "refunded", label: "Dikembalikan", numeric: true,
                    render: (o) => <span className="text-blue-600">{formatCurrency(o.refunded || 0)}</span> },
                  { key: "forfeited", label: "Hangus", numeric: true,
                    render: (o) => <span className="text-red-600">{formatCurrency(o.forfeited || 0)}</span> },
                ]}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <p data-testid="deposits-no-data" className="text-center text-gray-400 py-12">Tidak ada data</p>
      )}
    </div>
  );
}
