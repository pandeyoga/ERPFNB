/** LB Fund Ledger — read-only running balance (DataTable). */
import { useEffect, useState } from "react";
import { PiggyBank, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";

export default function LBFundLedger() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/hr/lb-fund", { params: { per_page: 100 } })
      .then(r => {
        setItems(unwrap(r) || []);
        setMeta(r.data?.meta || { balance: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4" data-testid="hr-lb-fund-page">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="lb-fund-kpi-strip">
        <div data-testid="lb-fund-kpi-balance">
          <KpiCard label="Current Balance" value={fmtRp(meta.balance ?? 0)}
            hint="L&B Fund saldo berjalan" icon={PiggyBank} color="aurora-1" />
        </div>
        <div data-testid="lb-fund-kpi-in">
          <KpiCard label="Total IN" value={items.filter(x => x.direction === "in").length}
            hint="Service charge deduction" icon={ArrowDownCircle} color="aurora-3" />
        </div>
        <div data-testid="lb-fund-kpi-out">
          <KpiCard label="Total OUT" value={items.filter(x => x.direction === "out").length}
            hint="Customer comp / breakage" icon={ArrowUpCircle} color="aurora-4" />
        </div>
      </div>

      <div className="glass-card" data-testid="lb-fund-table-card">
        <DataTable
          columns={[
            { key: "entry_date", label: "Date", primary: true, sortable: true, render: it => fmtDate(it.entry_date) },
            { key: "source_type", label: "Source", sortable: true, render: it => <span className="text-xs">{it.source_type}</span> },
            { key: "description", label: "Description", render: it => <span className="text-xs text-muted-foreground">{it.description || "—"}</span> },
            {
              key: "direction", label: "In/Out", align: "center", sortable: true,
              render: it => it.direction === "in" ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs" data-testid={`lb-fund-dir-in-${it.id}`}>
                  <ArrowDownCircle className="h-3.5 w-3.5" /> IN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-600 text-xs" data-testid={`lb-fund-dir-out-${it.id}`}>
                  <ArrowUpCircle className="h-3.5 w-3.5" /> OUT
                </span>
              ),
            },
            { key: "amount", label: "Amount", numeric: true, sortable: true, render: it => <span data-testid={`lb-fund-amount-${it.id}`}>{fmtRp(it.amount)}</span> },
            { key: "balance_after", label: "Balance", numeric: true, sortable: true, render: it => <span className="font-semibold" data-testid={`lb-fund-balance-${it.id}`}>{fmtRp(it.balance_after)}</span> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "entry_date", dir: "desc" }}
          empty={<EmptyState icon={PiggyBank} title="Belum ada gerakan LB Fund"
            description="Saldo otomatis bertambah dari service charge L&B deduction, dan berkurang dari customer compensation." />}
          rowTestIdPrefix="lb-fund-row"
        />
      </div>
    </div>
  );
}
