/** AP Aging report by vendor with bucket breakdown. */
import { useEffect, useState } from "react";
import { Receipt, Download, Clock, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InlineHelp } from "@/components/shared/InlineHelp";
import useExcelExport from "@/hooks/useExcelExport";

export default function APAging({ embedded = false }) {
  const [asOf, setAsOf] = useState(todayJakartaISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { downloading, exportXlsx } = useExcelExport();

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/ap-aging", { params: { as_of: asOf } });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal memuat AP aging");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [asOf]);

  function exportCsv() {
    if (!data) return;
    const header = "Vendor,Current,1-30,31-60,61-90,90+,Total";
    const rows = data.rows.map(r =>
      `"${r.vendor_name}",${r.current},${r.d_30},${r.d_60},${r.d_90},${r.d_90p},${r.total}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AP-Aging-${data.as_of}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="ap-aging-page">
      <PageHeader icon={Receipt} title="AP Aging"
          subtitle="Hutang usaha (GR belum dibayar) per vendor, dikelompokkan per umur jatuh tempo." />

      <div className="flex flex-wrap items-end gap-3" data-testid="ap-toolbar">
        <div className="min-w-[160px]">
          <Label htmlFor="ap-asof" className="text-xs md:text-sm font-medium">Per tanggal</Label>
          <Input id="ap-asof" type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="glass-input mt-1" data-testid="ap-asof" />
        </div>
        <div className="flex items-center gap-1.5 h-9 text-sm text-muted-foreground">
          <span>Bucket umur AP</span>
          <InlineHelp id="ap-aging-buckets" placement="bottom-start" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button onClick={exportCsv} variant="outline" disabled={!data} data-testid="ap-export-csv">
            <Download className="h-4 w-4" /> Ekspor CSV
          </Button>
          <Button
            onClick={() => exportXlsx("/finance/ap-aging/export/xlsx", `ap_aging_${asOf}.xlsx`, { as_of: asOf })}
            disabled={downloading}
            variant="outline"
            data-testid="ap-export-xlsx"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Mengunduh..." : "Ekspor Excel"}
          </Button>
        </div>
      </div>

      {loading && <LoadingState rows={6} />}
      {!loading && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="ap-buckets">
            <BucketCard label="Current" value={data.buckets.current} tone="success" icon={CheckCircle2} color="aurora-4" testid="ap-bucket-current" />
            <BucketCard label="1-30 hari" value={data.buckets.d_30} tone="info" icon={Clock} color="aurora-2" testid="ap-bucket-d30" />
            <BucketCard label="31-60 hari" value={data.buckets.d_60} tone="warning" icon={Clock} color="aurora-5" testid="ap-bucket-d60" />
            <BucketCard label="61-90 hari" value={data.buckets.d_90} tone="warning" icon={AlertCircle} color="aurora-5" testid="ap-bucket-d90" />
            <BucketCard label="90+ hari" value={data.buckets.d_90p} tone="danger" icon={AlertTriangle} color="aurora-6" testid="ap-bucket-d90p" />
          </div>

          <div className="glass-card overflow-hidden" data-testid="ap-table-card">
            <DataTable
              columns={[
                { key: "vendor_name", label: "Vendor", primary: true, sortable: true,
                  render: (v) => <span className="font-medium" data-testid={`ap-vendor-name-${v.vendor_id}`}>{v.vendor_name}</span> },
                { key: "current", label: "Current", numeric: true, sortable: true, render: (v) => v.current ? fmtRp(v.current) : "—" },
                { key: "d_30", label: "1-30", numeric: true, sortable: true, render: (v) => v.d_30 ? fmtRp(v.d_30) : "—" },
                { key: "d_60", label: "31-60", numeric: true, sortable: true, render: (v) => v.d_60 ? fmtRp(v.d_60) : "—" },
                { key: "d_90", label: "61-90", numeric: true, sortable: true, render: (v) => v.d_90 ? fmtRp(v.d_90) : "—" },
                { key: "d_90p", label: "90+", numeric: true, sortable: true,
                  render: (v) => <span className={cn(v.d_90p ? "text-red-700 dark:text-red-400 font-semibold" : "")}>{v.d_90p ? fmtRp(v.d_90p) : "—"}</span> },
                { key: "total", label: "Total", numeric: true, sortable: true,
                  render: (v) => <span className="font-bold" data-testid={`ap-vendor-total-${v.vendor_id}`}>{fmtRp(v.total)}</span> },
              ]}
              rows={data.rows}
              keyField="vendor_id"
              rowTestIdPrefix="ap-vendor-row"
              defaultSort={{ key: "total", dir: "desc" }}
              renderExpanded={(v) => <ApVendorItems v={v} />}
              empty={<EmptyState icon={Receipt} title="Tidak ada AP outstanding" description="Semua GR sudah bayar atau belum ada GR." />}
              footer={
                data.rows.length > 0 ? (
                  <tr className="font-bold border-t-2 border-border/70 bg-card/60" data-testid="ap-total-row">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtRp(data.buckets.current)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_30)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_60)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_90)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtRp(data.buckets.d_90p)}</td>
                    <td className="px-4 py-3 text-right tabular-nums" data-testid="ap-grand-total">{fmtRp(data.grand_total)}</td>
                  </tr>
                ) : null
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function BucketCard({ label, value, tone, icon, color, testid }) {
  return (
    <CompactStatCard
      label={label}
      icon={icon}
      color={color}
      tone={value ? tone : "default"}
      testId={testid}
      value={<span data-testid={testid ? `${testid}-value` : undefined}>{fmtRp(value || 0)}</span>}
    />
  );
}

function ApVendorItems({ v }) {
  const items = v.items || [];
  if (!items.length) return <p className="text-sm text-muted-foreground">Tidak ada invoice outstanding.</p>;
  return (
    <table className="w-full text-xs" data-testid={`ap-detail-${v.vendor_id}`}>
      <thead><tr className="text-left text-muted-foreground">
        <th className="px-2 py-1">Doc No</th>
        <th className="px-2 py-1">Invoice</th>
        <th className="px-2 py-1">Receive</th>
        <th className="px-2 py-1">Due</th>
        <th className="px-2 py-1">Terlambat</th>
        <th className="px-2 py-1 text-right">Amount</th>
      </tr></thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.gr_id} className="border-t border-border/30" data-testid={`ap-item-${it.gr_id}`}>
            <td className="px-2 py-1 font-mono whitespace-nowrap">{it.doc_no || it.gr_id.slice(0, 8)}</td>
            <td className="px-2 py-1">{it.invoice_no || "—"}</td>
            <td className="px-2 py-1">{fmtDate(it.receive_date)}</td>
            <td className="px-2 py-1">{fmtDate(it.due_date)}</td>
            <td className={cn("px-2 py-1", it.days_overdue > 0 ? "text-red-700 dark:text-red-400 font-medium" : "")}>
              {it.days_overdue > 0 ? `+${it.days_overdue} hari` : "—"}
            </td>
            <td className="px-2 py-1 text-right tabular-nums">{fmtRp(it.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
