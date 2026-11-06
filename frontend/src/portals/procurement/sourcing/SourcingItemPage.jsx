/** Sourcing › analisis satu item: semua supplier dalam satu tabel (penawaran, harga aktual, kelengkapan, ketepatan,
 *  skor), tren harga mingguan vs acuan, riwayat acuan per periode, dan daftar penawaran. */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Edit2, FileText, Lightbulb, Plus, Tag, Trash2 } from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import { fmtDate, fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import KeyFacts from "@/components/shared/KeyFacts";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import RowActions from "@/components/shared/RowActions";
import LoadingState from "@/components/shared/LoadingState";
import { confirmDialog } from "@/components/shared/confirmDialog";
import { CATEGORICAL, ChartEmpty, GlassTooltip, axisProps, fmtCompact, gridProps } from "@/components/shared/charts/chartKit";
import {
  BenchmarkDialog, DeltaPct, OfferDialog, PERIOD_LABEL, PriceCell, RegionSelect, SOURCE_LABEL, useSourcingPerms,
} from "./shared";

const INSIGHT_TONE = {
  danger: "border-rose-500/40 text-rose-700 dark:text-rose-400",
  warning: "border-amber-500/40 text-amber-800 dark:text-amber-400",
  success: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  info: "border-blue-500/40 text-blue-700 dark:text-blue-400",
};

function pct(v) {
  return v === null || v === undefined ? "—" : `${Number(v).toFixed(0)}%`;
}

function ScorePill({ score }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">—</span>;
  const tone = score >= 85 ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
    : score >= 70 ? "bg-blue-500/15 text-blue-800 dark:text-blue-400"
      : score >= 50 ? "bg-amber-500/15 text-amber-800 dark:text-amber-400" : "bg-rose-500/15 text-rose-800 dark:text-rose-400";
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", tone)}>{Math.round(score)}</span>;
}

export default function SourcingItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const region = params.get("region") || "";
  const perms = useSourcingPerms();
  const [offerOpen, setOfferOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [bmOpen, setBmOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sourcing", "item", id, region],
    queryFn: async () => unwrap(await api.get(`/sourcing/items/${id}`, { params: { region_id: region || undefined } })),
  });

  const item = data?.item;
  const s = data?.summary || {};
  const alert = data?.settings?.alert_pct ?? 10;
  const days = data?.analysis_days ?? 90;
  const bm = data?.benchmark;
  const vendorsInTrend = useMemo(() => {
    const names = new Set();
    (data?.trend || []).forEach((row) => Object.keys(row).forEach((k) => { if (k !== "week" && k !== "Acuan") names.add(k); }));
    return [...names];
  }, [data]);

  if (isLoading || !data) return <LoadingState rows={6} />;

  const removeOffer = async (o) => {
    if (!(await confirmDialog({ title: "Hapus penawaran?", description: `${o.vendor_name} · ${fmtRp(o.price)}/${o.unit}`, confirmText: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/sourcing/offers/${o.id}`);
      toast.success("Penawaran dihapus");
      qc.invalidateQueries({ queryKey: ["sourcing"] });
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menghapus");
    }
  };

  const supplierColumns = [
    { key: "vendor_name", label: "Supplier", primary: true, sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate" title={r.vendor_name}>{r.vendor_name}</div>
          <div className="text-xs text-muted-foreground">{r.purchases} pembelian · {r.qty} {item.unit_default}</div>
        </div>
      ) },
    { key: "offer_price", label: "Penawaran berlaku", sortable: true,
      render: (r) => r.offer_price != null ? (
        <PriceCell price={r.offer_price} unit={item.unit_default}
          sub={[r.offer_valid_to && `s/d ${fmtDate(r.offer_valid_to)}`, r.offer_moq ? `MOQ ${r.offer_moq}` : null].filter(Boolean).join(" · ")}
          delta={r.offer_vs_benchmark_pct ?? undefined} alert={alert} />
      ) : <span className="text-xs text-muted-foreground">Belum ada</span> },
    { key: "last_price", label: "Harga terakhir", sortable: true,
      render: (r) => <PriceCell price={r.last_price} unit={item.unit_default}
        sub={r.last_date && `${fmtDate(r.last_date)}${r.avg_price != null ? ` · rata² ${fmtRp(r.avg_price)}` : ""}`}
        delta={r.last_vs_benchmark_pct ?? undefined} alert={alert} /> },
    { key: "fill_rate_pct", label: "Pengiriman", sortable: true,
      render: (r) => (r.fill_rate_pct == null && r.on_time_pct == null) ? <span className="text-muted-foreground">—</span> : (
        <div className="text-xs leading-5 whitespace-nowrap">
          <div><span className="font-medium tabular-nums">{pct(r.fill_rate_pct)}</span> lengkap · <span className="font-medium tabular-nums">{pct(r.on_time_pct)}</span> tepat waktu</div>
          <div className="text-muted-foreground">Lead time {r.avg_lead_days != null ? `${r.avg_lead_days} hari` : (r.offer_lead_days ? `${r.offer_lead_days} hari (penawaran)` : "—")}</div>
        </div>
      ) },
    { key: "score", label: "Skor", numeric: true, sortable: true,
      render: (r) => (
        <div className="text-right" title={r.score_basis?.length ? `Dihitung dari: ${r.score_basis.join(", ")}` : undefined}>
          <ScorePill score={r.score} />
          {r.score != null && r.score_basis?.length === 1 && <div className="text-xs text-muted-foreground">{r.score_basis[0]} saja</div>}
        </div>
      ) },
    { key: "availability", label: "Status", render: (r) => <StatusPill status={r.availability} /> },
  ];

  const offerColumns = [
    { key: "vendor_name", label: "Supplier", primary: true, sortable: true },
    { key: "price", label: "Harga", numeric: true, sortable: true, render: (o) => `${fmtRp(o.price)}/${o.unit}` },
    { key: "valid_from", label: "Berlaku", sortable: true,
      render: (o) => <span className="whitespace-nowrap">{fmtDate(o.valid_from)} – {o.valid_to ? fmtDate(o.valid_to) : "tanpa batas"}</span> },
    { key: "min_order_qty", label: "MOQ", numeric: true, hideOnMobile: true, render: (o) => o.min_order_qty || "—" },
    { key: "region_name", label: "Wilayah", hideOnMobile: true },
    { key: "source", label: "Sumber", hideOnMobile: true, render: (o) => `${SOURCE_LABEL[o.source] || o.source}${o.source_ref ? ` · ${o.source_ref}` : ""}` },
    { key: "status", label: "Status", render: (o) => <StatusPill status={o.status} /> },
  ];

  const facts = [
    { label: "Acuan", value: bm ? (
      <span className="tabular-nums">{fmtRp(bm.ref_price)}/{item.unit_default} <span className="text-xs text-muted-foreground font-normal">{bm.period_label}{bm.stale ? " (lama)" : ""}</span></span>
    ) : "Belum ada", testId: "sourcing-item-fact-benchmark" },
    { label: "Penawaran terbaik", value: s.best_offer ? `${fmtRp(s.best_offer)}/${item.unit_default}` : "—", testId: "sourcing-item-fact-offer" },
    { label: "Harga terakhir", value: s.last_price ? (
      <span className="inline-flex flex-col"><span className="tabular-nums">{fmtRp(s.last_price)}/{item.unit_default}</span>
        {bm && <DeltaPct value={(s.last_price - bm.ref_price) / bm.ref_price * 100} alert={alert} />}</span>
    ) : "—", testId: "sourcing-item-fact-last" },
    { label: `Spend ${days} hari`, value: fmtRp(s.spend || 0), numeric: true },
    { label: "Supplier", value: `${s.suppliers || 0} · ${s.offers || 0} penawaran` },
    { label: "Potensi hemat", value: s.potential_saving > 0
      ? <span className="text-emerald-700 dark:text-emerald-400">{fmtRp(s.potential_saving)}</span> : "—", testId: "sourcing-item-fact-saving" },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="sourcing-item-page">
      <Button variant="link" className="px-0" onClick={() => navigate(`/procurement/sourcing${region ? `?region=${region}` : ""}`)}
        data-testid="sourcing-item-back">
        <ArrowLeft /> Kembali ke Sourcing
      </Button>
      <PageHeader
        icon={BarChart3}
        title={item.name}
        subtitle={`${item.category_name || "Tanpa kategori"} · per ${item.unit_default} · acuan ${PERIOD_LABEL[data.period_type]?.toLowerCase()}`}
        actions={(
          <>
            <RegionSelect value={region} onChange={(v) => setParams(v ? { region: v } : {}, { replace: true })} testId="sourcing-item-region" />
            {perms.canRfq && (
              <Button variant="outline" asChild data-testid="sourcing-item-rfq">
                <Link to="/procurement/rfq/new"><FileText /> Minta penawaran</Link>
              </Button>
            )}
            {perms.canBenchmark && (
              <Button variant="outline" onClick={() => setBmOpen(true)} data-testid="sourcing-item-set-benchmark">
                <Tag /> Tetapkan acuan
              </Button>
            )}
            {perms.canOffers && (
              <Button onClick={() => { setEditingOffer(null); setOfferOpen(true); }} data-testid="sourcing-item-add-offer">
                <Plus /> Tambah Penawaran
              </Button>
            )}
          </>
        )}
      >
        <KeyFacts items={facts} testId="sourcing-item-facts" />
      </PageHeader>

      {data.insights?.length > 0 && (
        <div className="glass-card p-4" data-testid="sourcing-item-insights">
          <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 mb-2"><Lightbulb className="h-4 w-4 text-muted-foreground" /> Catatan analisis</h3>
          <ul className="space-y-1.5">
            {data.insights.map((n, i) => (
              <li key={i} className={cn("border-l-2 pl-3 text-sm", INSIGHT_TONE[n.tone] || INSIGHT_TONE.info)}>{n.text}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-card overflow-hidden" data-testid="sourcing-item-suppliers">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="text-sm md:text-base font-semibold">Perbandingan supplier</h3>
          <p className="text-xs text-muted-foreground">Skor: harga 40 · kelengkapan 25 · tepat waktu 20 · kualitas 15 (komponen tanpa data tidak dihitung). Riwayat GR {days} hari.</p>
        </div>
        <DataTable columns={supplierColumns} rows={data.suppliers} keyField="vendor_id" rowTestIdPrefix="sourcing-supplier"
          defaultSort={{ key: "score", dir: "desc" }}
          empty={<EmptyState icon={BarChart3} title="Belum ada supplier" description="Belum ada pembelian atau penawaran untuk item ini." />} />
      </div>

      <div className="glass-card p-4" data-testid="sourcing-item-trend">
        <h3 className="text-sm md:text-base font-semibold">Tren harga per minggu</h3>
        <p className="text-xs text-muted-foreground mb-2">Harga diterima (rata-rata tertimbang qty) per supplier, dibandingkan harga acuan.</p>
        {data.trend?.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="week" {...axisProps} tickFormatter={(v) => fmtDate(v, "DD MMM")} />
              <YAxis {...axisProps} tickFormatter={fmtCompact} width={48} />
              <Tooltip content={<GlassTooltip valueFormatter={(v) => fmtRp(v)} labelFormatter={(v) => `Minggu ${fmtDate(v)}`} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {vendorsInTrend.map((v, i) => (
                <Line key={v} type="monotone" dataKey={v} stroke={CATEGORICAL[i % CATEGORICAL.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              ))}
              <Line type="stepAfter" dataKey="Acuan" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : <ChartEmpty message="Belum ada riwayat penerimaan barang untuk item ini." />}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 lg:gap-4 xl:items-start">
        <div className="glass-card overflow-hidden xl:col-span-2" data-testid="sourcing-item-offers">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-2">
            <h3 className="text-sm md:text-base font-semibold">Penawaran</h3>
          </div>
          <DataTable columns={offerColumns} rows={data.offers} keyField="id" rowTestIdPrefix="sourcing-offer"
            defaultSort={{ key: "valid_from", dir: "desc" }}
            rowAction={perms.canOffers ? (o) => (
              <RowActions testId={`sourcing-offer-actions-${o.id}`} promote={false} items={[
                { label: "Edit", icon: Edit2, onSelect: () => { setEditingOffer(o); setOfferOpen(true); }, testId: `sourcing-offer-edit-${o.id}` },
                { label: "Hapus", icon: Trash2, destructive: true, onSelect: () => removeOffer(o), testId: `sourcing-offer-delete-${o.id}` },
              ]} />
            ) : undefined}
            empty={<EmptyState icon={Tag} title="Belum ada penawaran" description="Tambahkan penawaran supplier atau minta lewat RFQ." />} />
        </div>
        <div className="glass-card overflow-hidden" data-testid="sourcing-item-benchmarks">
          <div className="px-4 py-3 border-b border-border/50">
            <h3 className="text-sm md:text-base font-semibold">Riwayat acuan</h3>
          </div>
          {data.benchmark_history?.length ? (
            <ul className="divide-y divide-border/40">
              {[...data.benchmark_history].reverse().map((h) => (
                <li key={`${h.period_id}-${h.region_id || "all"}`} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{h.label}</div>
                    <div className="text-xs text-muted-foreground">{h.region_id ? data.region_name : "Semua wilayah"} · {SOURCE_LABEL[h.source] || h.source || "—"}</div>
                  </div>
                  <span className="tabular-nums font-medium">{fmtRp(h.price)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada harga acuan.</p>}
        </div>
      </div>

      <OfferDialog open={offerOpen} onOpenChange={setOfferOpen} initial={editingOffer} fixedItem={item} onSaved={refetch} />
      {perms.canBenchmark && (
        <BenchmarkDialog open={bmOpen} onOpenChange={setBmOpen} item={item} regionId={region} periodType={data.period_type}
          current={bm && !bm.stale ? bm : null} onSaved={refetch} />
      )}
    </div>
  );
}
