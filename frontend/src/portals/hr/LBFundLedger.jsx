/** LB Fund Ledger — read-only running balance (DataTable). */
import { useEffect, useState } from "react";
import { PiggyBank, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";

/** @param {{ embedded?: boolean }} props — embedded=true saat dirender sebagai tab di CompensationHub (tanpa PageHeader). */
export default function LBFundLedger({ embedded = false }) {
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

  const inCount = items.filter(x => x.direction === "in").length;
  const outCount = items.filter(x => x.direction === "out").length;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="hr-lb-fund-page">
      <PageHeader icon={PiggyBank} title="LB Fund"
          subtitle="Buku besar dana Loss & Breakage — saldo berjalan dari service charge L&B" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4" data-testid="lb-fund-kpi-strip">
        <div data-testid="lb-fund-kpi-balance">
          <CompactStatCard label="Saldo Berjalan" value={fmtRp(meta.balance ?? 0)} loading={loading}
            sub="L&B Fund" icon={PiggyBank} color="aurora-1" />
        </div>
        <div data-testid="lb-fund-kpi-in">
          <CompactStatCard label="Mutasi Masuk" value={inCount} loading={loading}
            sub="transaksi · potongan service charge" icon={ArrowDownCircle} color="aurora-3" tone="success" />
        </div>
        <div data-testid="lb-fund-kpi-out">
          <CompactStatCard label="Mutasi Keluar" value={outCount} loading={loading}
            sub="transaksi · customer comp / breakage" icon={ArrowUpCircle} color="aurora-4" tone="danger" />
        </div>
      </div>

      <div className="glass-card" data-testid="lb-fund-table-card">
        <DataTable
          columns={[
            { key: "entry_date", label: "Tanggal", primary: true, sortable: true, render: it => fmtDate(it.entry_date) },
            { key: "source_type", label: "Sumber", sortable: true, render: it => <span className="text-xs">{it.source_type}</span> },
            { key: "description", label: "Keterangan", render: it => <span className="text-xs text-muted-foreground">{it.description || "—"}</span> },
            {
              key: "direction", label: "Masuk/Keluar", align: "center", sortable: true,
              render: it => it.direction === "in" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs" data-testid={`lb-fund-dir-in-${it.id}`}>
                  <ArrowDownCircle className="h-3.5 w-3.5" /> Masuk
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 text-xs" data-testid={`lb-fund-dir-out-${it.id}`}>
                  <ArrowUpCircle className="h-3.5 w-3.5" /> Keluar
                </span>
              ),
            },
            { key: "amount", label: "Jumlah", numeric: true, sortable: true, render: it => <span className="whitespace-nowrap" data-testid={`lb-fund-amount-${it.id}`}>{fmtRp(it.amount)}</span> },
            { key: "balance_after", label: "Saldo", numeric: true, sortable: true, render: it => <span className="font-semibold whitespace-nowrap" data-testid={`lb-fund-balance-${it.id}`}>{fmtRp(it.balance_after)}</span> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "entry_date", dir: "desc" }}
          empty={<EmptyState icon={PiggyBank} title="Belum ada mutasi LB Fund"
            description="Saldo otomatis bertambah dari potongan L&B service charge, dan berkurang dari customer compensation." />}
          rowTestIdPrefix="lb-fund-row"
        />
      </div>
    </div>
  );
}
