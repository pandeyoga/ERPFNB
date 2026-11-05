/**
 * P&L dengan kolom per brand / per toko (DESIGN_SYSTEM §10.7). Cakupan = konteks TopNav; kolom "Pusat" = transaksi
 * tanpa toko (hanya di konteks Semua brand). Jumlah semua kolom = P&L konteks itu.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import DataTable from "@/components/shared/DataTable";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";

// Kolom banyak → nominal dalam juta agar matriks muat tanpa gulir horizontal di 1280px.
const fmtJt = (v) => (v ? (v / 1e6).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—");

function valueColumns(columns) {
  return [
    ...columns.map((c) => ({
      key: c.key, label: c.label, numeric: true,
      render: (r) => <span className="tabular-nums">{fmtJt(r.values[c.key])}</span>,
    })),
    { key: "total", label: "Total", numeric: true, sortable: true,
      render: (r) => <span className="font-semibold tabular-nums">{fmtJt(r.total)}</span> },
  ];
}

function FooterRow({ label, values, columns, strong }) {
  return (
    <tr className="bg-muted/40 font-semibold border-t-2 border-border">
      <td className="px-4 py-2.5" colSpan={2}>{label}</td>
      {columns.map((c) => <td key={c.key} className="px-4 py-2.5 text-right tabular-nums">{fmtJt(values[c.key])}</td>)}
      <td className={`px-4 py-2.5 text-right tabular-nums ${strong ? "text-base" : ""}`}>{fmtJt(values.total)}</td>
    </tr>
  );
}

export default function PlBreakdown({ period, by, params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    setLoading(true);
    api.get("/finance/profit-loss/breakdown", { params: { period, by, ...params } })
      .then((r) => !off && setData(unwrap(r)))
      .catch(() => { if (!off) { setData(null); toast.error("Gagal memuat P&L per kolom"); } })
      .finally(() => !off && setLoading(false));
    return () => { off = true; };
  }, [period, by, JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingState rows={6} />;
  if (!data) return null;
  const { columns } = data;
  const hasRows = data.sections.some((s) => s.rows.length > 0);
  if (!hasRows) return <EmptyState title="Belum ada data P&L untuk periode ini" />;

  const cols = [
    { key: "code", label: "Kode", primary: true,
      render: (r) => <span className="text-xs font-medium tabular-nums text-muted-foreground">{r.code}</span> },
    { key: "name", label: "Akun", render: (r) => r.name },
    ...valueColumns(columns),
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid={`pl-breakdown-${by}`}>
      <p className="text-xs text-muted-foreground" data-testid="pl-breakdown-note">
        Nominal dalam juta Rupiah.{columns.some((c) => c.key === "__pusat__") && " Kolom Pusat = transaksi tanpa toko (AR, payroll pusat, payment run)."}
      </p>
      {data.sections.filter((s) => s.rows.length > 0).map((s) => (
        <div key={s.key} className="glass-card p-0 overflow-hidden" data-testid={`pl-breakdown-section-${s.key}`}>
          <h3 className="px-4 py-3 border-b border-border/30 text-sm md:text-base font-semibold">{s.label}</h3>
          <DataTable
            rows={s.rows}
            keyField="code"
            rowTestIdPrefix={`pl-bd-${s.key}-row`}
            columns={cols}
            footer={<FooterRow label={`Total ${s.label}`} values={s.totals} columns={columns} />}
          />
        </div>
      ))}
      <div className="glass-card p-0 overflow-hidden" data-testid="pl-breakdown-summary">
        <h3 className="px-4 py-3 border-b border-border/30 text-sm md:text-base font-semibold">Laba rugi</h3>
        <DataTable
          rows={[
            { key: "gp", code: "", name: "Gross Profit", values: data.gross_profit, total: data.gross_profit.total },
            { key: "ni", code: "", name: "Net Income", values: data.net_income, total: data.net_income.total },
          ]}
          keyField="key"
          rowTestIdPrefix="pl-bd-summary"
          columns={cols}
        />
      </div>
    </div>
  );
}
