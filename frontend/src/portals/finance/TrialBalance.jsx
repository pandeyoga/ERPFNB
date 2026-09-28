/** Trial Balance — by period, all postable COAs with non-zero activity. */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Download, Search } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import { InlineHelp } from "@/components/shared/InlineHelp";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";

export default function TrialBalance() {
  const [period, setPeriod] = useState(() => todayJakartaISO().slice(0, 7));
  const { outletId, setOutletId, scopedOutlets, allOutlets } = useOutletScope();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = { period };
      if (outletId) params.dim_outlet = outletId;
      const res = await api.get("/finance/trial-balance", { params });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal load TB");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [period, outletId]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q) return data.rows;
    const s = q.toLowerCase();
    return data.rows.filter(r =>
      (r.code || "").toLowerCase().includes(s) ||
      (r.name || "").toLowerCase().includes(s),
    );
  }, [data, q]);

  function exportCsv() {
    if (!data) return;
    const header = "Code,Name,Type,Normal,Opening,Period_Dr,Period_Cr,Closing";
    const rows = data.rows.map(r =>
      `${r.code},"${r.name}",${r.type},${r.normal_balance},${r.opening},${r.period_dr},${r.period_cr},${r.closing}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TB-${period}${outletId ? `-${outletId.slice(0, 6)}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-testid="trial-balance-page" className="space-y-4">
      <div data-testid="tb-filter-card" className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Period</Label>
          <Input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="tb-period" />
        </div>
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet (opsional)</Label>
          <SimpleSelect
            value={outletId}
            onValueChange={setOutletId}
            options={[{ value: "", label: "Consolidated" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Consolidated"
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            testId="tb-outlet"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cari COA</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Code / nama akun…" className="glass-input pl-9 h-9" />
          </div>
        </div>
        <Button onClick={exportCsv} variant="outline" className="rounded-full gap-2 h-10" data-testid="tb-export">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {data && (
        <div data-testid="tb-balance-status" className={cn(
          "glass-card p-4 flex items-center gap-3 text-sm",
          data.totals.is_balanced_period
            ? "border-l-4 border-emerald-500"
            : "border-l-4 border-amber-500",
        )}>
          {data.totals.is_balanced_period ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <span className="font-medium inline-flex items-center gap-1.5">
            {data.totals.is_balanced_period
              ? "Period activity balanced (Dr = Cr)."
              : `Period belum balance: Δ ${fmtRp(data.totals.period_dr - data.totals.period_cr)}`}
            <InlineHelp id="trial-balance-balance" size="xs" placement="right" />
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Period Dr {fmtRp(data.totals.period_dr)} · Cr {fmtRp(data.totals.period_cr)}
          </span>
        </div>
      )}

      <div data-testid="tb-table-card" className="glass-card overflow-hidden">
        <DataTable
          rows={filtered}
          keyField="code"
          loading={loading}
          rowTestIdPrefix="tb-row"
          defaultSort={{ key: "closing", dir: "desc" }}
          empty={<div className="p-6"><EmptyState title="Tidak ada aktivitas" description="Tidak ada COA dengan aktivitas pada periode/filter ini." /></div>}
          columns={[
            { key: "code", label: "Code", sortable: true, primary: true,
              render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { key: "name", label: "Name", sortable: true },
            { key: "type", label: "Type",
              render: (r) => <span className="text-xs text-muted-foreground capitalize">{r.type}</span> },
            { key: "opening", label: "Opening", numeric: true, sortable: true,
              help: <InlineHelp id="trial-balance-opening" size="xs" placement="top" />,
              render: (r) => fmtRp(r.opening) },
            { key: "period_dr", label: "Period Dr", numeric: true, sortable: true,
              render: (r) => (r.period_dr ? fmtRp(r.period_dr) : "—") },
            { key: "period_cr", label: "Period Cr", numeric: true, sortable: true,
              render: (r) => (r.period_cr ? fmtRp(r.period_cr) : "—") },
            { key: "closing", label: "Closing", numeric: true, sortable: true,
              help: <InlineHelp id="trial-balance-closing" size="xs" placement="top" />,
              render: (r) => <span className="font-semibold">{fmtRp(r.closing)}</span> },
          ]}
          footer={data ? (
            <tr className="font-bold border-t-2 border-border/70">
              <td colSpan={4} className="px-4 py-3 text-right">Total Period</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtRp(data.totals.period_dr)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtRp(data.totals.period_cr)}</td>
              <td />
            </tr>
          ) : null}
        />
      </div>
    </div>
  );
}
