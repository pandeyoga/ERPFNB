/** Sourcing › Ringkasan — satu baris per item: acuan vs penawaran terbaik vs harga terakhir, supplier, potensi hemat.
 *  Klik baris → analisis item (/procurement/sourcing/items/:id).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Boxes, PiggyBank, ShieldAlert, TrendingUp, Tag, Wallet } from "lucide-react";
import api, { unwrap, fetchAll } from "@/lib/api";
import { fmtRp, fmtDate } from "@/lib/format";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import ListToolbar, { ListSearch, StatusTabs } from "@/components/shared/ListToolbar";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { FLAG_ORDER, PERIOD_LABEL, PriceCell, RegionSelect } from "./shared";

const FLAG_TABS = [
  { key: "all", label: "Semua" },
  { key: "above_benchmark", label: "Di atas acuan" },
  { key: "saving", label: "Potensi hemat" },
  { key: "single_source", label: "1 supplier" },
  { key: "no_benchmark", label: "Belum ada acuan" },
  { key: "few_quotes", label: "Penawaran kurang" },
  { key: "offer_expiring", label: "Penawaran segera habis" },
  { key: "stale_benchmark", label: "Acuan lama" },
];

export default function SourcingOverview() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [flag, setFlag] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["sourcing", "overview", region, category],
    queryFn: async () => unwrap(await api.get("/sourcing/overview", {
      params: { region_id: region || undefined, category_id: category || undefined } })),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["master", "categories", "item"],
    queryFn: async () => (unwrap(await fetchAll("/master/categories", { active: true })) || []).filter((c) => c.type === "item"),
    staleTime: 5 * 60 * 1000,
  });

  const alert = data?.settings?.alert_pct ?? 10;
  const days = data?.analysis_days ?? 90;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter((r) => (flag === "all" || r.flags.includes(flag))
      && (!q || `${r.item_name} ${r.item_code}`.toLowerCase().includes(q)));
  }, [data, flag, search]);
  const kpi = data?.kpi || {};
  const counts = useMemo(() => {
    const c = {};
    (data?.rows || []).forEach((r) => r.flags.forEach((f) => { c[f] = (c[f] || 0) + 1; }));
    return c;
  }, [data]);

  const columns = [
    { key: "item_name", label: "Item", primary: true, sortable: true, className: "max-w-[230px]",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate" title={r.item_name}>{r.item_name}</div>
          <div className="text-xs text-muted-foreground truncate">{r.category_name || "—"} · {r.unit} · {r.suppliers_count} supplier{r.offers_count ? ` · ${r.offers_count} penawaran` : ""}</div>
          {r.flags.some((f) => f !== "saving" && f !== "few_quotes") && (
            <div className="mt-1 flex flex-wrap gap-1">
              {FLAG_ORDER.filter((f) => r.flags.includes(f) && f !== "saving" && f !== "few_quotes").slice(0, 3).map((f) => <StatusPill key={f} status={f} />)}
            </div>
          )}
        </div>
      ) },
    { key: "benchmark", label: "Acuan", numeric: true, sortable: true,
      render: (r) => r.benchmark ? (
        <div className="text-right">
          <div className="font-medium tabular-nums">{fmtRp(r.benchmark)}</div>
          <div className="text-xs text-muted-foreground">{r.benchmark_label}{r.benchmark_change_pct != null && ` · ${r.benchmark_change_pct > 0 ? "+" : ""}${r.benchmark_change_pct}%`}</div>
        </div>
      ) : <span className="text-muted-foreground">—</span> },
    { key: "best_offer", label: "Penawaran terbaik", sortable: true, className: "max-w-[190px]",
      render: (r) => <PriceCell price={r.best_offer} unit={r.unit}
        sub={r.best_offer_vendor && `${r.best_offer_vendor}${r.best_offer_valid_to ? ` · s/d ${fmtDate(r.best_offer_valid_to, "DD MMM")}` : ""}`}
        delta={r.best_offer_vs_benchmark_pct ?? undefined} alert={alert} /> },
    { key: "last_price", label: "Harga terakhir", sortable: true, className: "max-w-[190px]",
      render: (r) => <PriceCell price={r.last_price} unit={r.unit}
        sub={r.last_vendor && `${r.last_vendor} · ${fmtDate(r.last_date, "DD MMM")}`}
        delta={r.last_vs_benchmark_pct ?? undefined} alert={alert} /> },
    { key: "spend", label: `Spend ${days} hari`, numeric: true, sortable: true,
      render: (r) => (
        <div className="text-right">
          <div className="tabular-nums">{fmtRp(r.spend)}</div>
          {r.potential_saving > 0 && <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">hemat {fmtRp(r.potential_saving)}</div>}
        </div>
      ) },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="sourcing-overview">
      <PageHeader
        title="Ringkasan harga"
        subtitle={`Semua item: harga acuan, penawaran supplier, dan harga yang benar-benar dibayar (GR ${days} hari terakhir).`}
        actions={(
          <>
            <SimpleSelect value={category} onValueChange={(v) => setCategory(v || "")}
              options={[{ value: "", label: "Semua kategori" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              ariaLabel="Kategori" className="glass-input w-48" testId="sourcing-category" />
            <RegionSelect value={region} onChange={setRegion} testId="sourcing-overview-region" />
          </>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="sourcing-kpis">
        <CompactStatCard label="Item dianalisis" value={kpi.items ?? 0} icon={Boxes} color="aurora-1" loading={isLoading} testId="sourcing-kpi-items" />
        <CompactStatCard label={`Spend ${days} hari`} value={fmtRp(kpi.spend || 0)} icon={Wallet} color="aurora-3" loading={isLoading} testId="sourcing-kpi-spend" />
        <CompactStatCard label="Potensi hemat" value={fmtRp(kpi.potential_saving || 0)} sub="vs penawaran termurah" icon={PiggyBank}
          tone={kpi.potential_saving > 0 ? "success" : "default"} color="aurora-4" loading={isLoading}
          onClick={() => setFlag("saving")} testId="sourcing-kpi-saving" />
        <CompactStatCard label="Di atas acuan" value={kpi.above_benchmark ?? 0} sub={`> ${alert}%`} icon={TrendingUp}
          tone={kpi.above_benchmark ? "danger" : "default"} color="aurora-6" loading={isLoading}
          onClick={() => setFlag("above_benchmark")} testId="sourcing-kpi-above" />
        <CompactStatCard label="1 supplier" value={kpi.single_source ?? 0} sub="tanpa cadangan" icon={ShieldAlert}
          tone={kpi.single_source ? "warning" : "default"} color="aurora-5" loading={isLoading}
          onClick={() => setFlag("single_source")} testId="sourcing-kpi-single" />
        <CompactStatCard label="Belum ada acuan" value={kpi.no_benchmark ?? 0} sub="periode berjalan" icon={Tag}
          color="aurora-2" loading={isLoading} onClick={() => setFlag("no_benchmark")} testId="sourcing-kpi-nobench" />
      </div>

      <div className="glass-card overflow-hidden" data-testid="sourcing-table-card">
        <ListToolbar testId="sourcing-toolbar"
          search={<ListSearch value={search} onChange={setSearch} placeholder="Cari item…" testId="sourcing-search" />}>
          <StatusTabs value={flag} onChange={setFlag} max={4} ariaLabel="Penanda"
            options={FLAG_TABS.map((t) => ({ ...t, label: t.key !== "all" && counts[t.key] ? `${t.label} (${counts[t.key]})` : t.label }))}
            testId="sourcing-flags" tabTestId={(k) => `sourcing-flag-${k}`} />
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={rows}
          keyField="item_id"
          loading={isLoading}
          rowTestIdPrefix="sourcing-row"
          defaultSort={{ key: "spend", dir: "desc" }}
          onRowClick={(r) => navigate(`/procurement/sourcing/items/${r.item_id}${region ? `?region=${region}` : ""}`)}
          empty={<EmptyState icon={Boxes} title="Tidak ada item yang cocok" description="Ubah filter atau penanda." />}
        />
        <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground" data-testid="sourcing-footnote">
          Klik baris untuk analisis item. Harga dibandingkan hanya dalam satuan yang sama. Periode acuan default: {PERIOD_LABEL[data?.settings?.default_period_type] || "—"}.
        </div>
      </div>
    </div>
  );
}
