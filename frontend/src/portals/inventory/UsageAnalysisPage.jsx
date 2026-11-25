/** /inventory/usage — Agen Inventory: pemakaian bahan teoretis (penjualan × resep) vs aktual, waste, dan saran transfer
 * antar toko (stok berlebih → di bawah par). Backend: /api/ai/inventory/usage-variance | waste | transfer-suggestions. */
import { useCallback, useEffect, useState } from "react";
import { PackageSearch, Bot, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import CompactStatCard from "@/components/shared/CompactStatCard";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import api, { unwrap, unwrapError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtRp } from "@/lib/format";

const TABS = [{ value: "usage", label: "Teoretis vs aktual" }, { value: "waste", label: "Waste" }, { value: "transfer", label: "Saran transfer" }];
const PILL = { wajar: ["confirmed", "Wajar"], lebih_boros: ["rejected", "Lebih boros"], lebih_hemat: ["submitted", "Lebih hemat"], tanpa_resep: ["draft", "Tanpa resep"] };
const num = (v) => (v == null ? "—" : Number(v).toLocaleString("id-ID", { maximumFractionDigits: 3 }));

export default function UsageAnalysisPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState("usage");
  const [days, setDays] = useState("30");
  const [data, setData] = useState(null);
  const [made, setMade] = useState({});

  const load = useCallback(() => {
    setData(null);
    const end = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
    const req = tab === "usage" ? api.get("/ai/inventory/usage-variance", { params: { start, end } })
      : tab === "waste" ? api.get("/ai/inventory/waste", { params: { days } }) : api.get("/ai/inventory/transfer-suggestions");
    req.then((r) => setData(unwrap(r))).catch((e) => { toast.error(unwrapError(e)); setData({ rows: [], ringkasan: {} }); });
  }, [tab, days]);
  useEffect(() => { load(); }, [load]);

  const makeTransfer = async (draft, i) => {
    try {
      const r = unwrap(await api.post("/inventory/transfers", draft));
      setMade((m) => ({ ...m, [i]: r.doc_no || "dibuat" })); toast.success(`Transfer ${r.doc_no || ""} dibuat (draft)`);
    } catch (e) { toast.error(unwrapError(e)); }
  };
  const askAI = () => window.dispatchEvent(new CustomEvent("aurora-open-ai", { detail: {
    prompt: tab === "usage" ? "Analisis selisih pemakaian bahan teoretis vs aktual 30 hari: item mana yang paling boros, kemungkinan penyebab (porsi, resep, waste, pencatatan) dan langkah perbaikannya."
      : tab === "waste" ? "Analisis waste 30 hari terakhir per toko & item, bandingkan dengan pembelian, dan beri saran mengurangi waste."
        : "Periksa saran transfer stok antar toko dan usulkan transfer yang masuk akal." } }));
  const s = data?.ringkasan || {};

  return (
    <div className="space-y-3 md:space-y-4" data-testid="inventory-usage-page">
      <PageHeader icon={PackageSearch} title="Pemakaian & Waste" subtitle="Pemakaian bahan menurut resep vs kenyataan, waste, dan transfer antar toko"
        actions={can("ai.agent.use") ? <Button variant="outline" onClick={askAI}><Bot /> Analisis AI</Button> : null} />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter value={tab} onChange={setTab} options={TABS} ariaLabel="Analisis" testId="usage-tabs" />
        {tab !== "transfer" && (
          <SimpleSelect value={days} onValueChange={setDays} ariaLabel="Rentang" className="w-36"
            options={[{ value: "7", label: "7 hari" }, { value: "30", label: "30 hari" }, { value: "90", label: "90 hari" }]} />
        )}
      </div>
      {tab === "usage" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CompactStatCard label="Item dianalisis" value={s.item ?? "…"} />
            <CompactStatCard label="Lebih boros" value={s.lebih_boros ?? "…"} tone={s.lebih_boros ? "warning" : "success"} />
            <CompactStatCard label="Nilai lebih boros" value={fmtRp(s.nilai_lebih_boros || 0)} tone={s.nilai_lebih_boros ? "danger" : "default"} />
            <CompactStatCard label="Menu tanpa resep" value={s.menu_tanpa_resep ?? "…"} sub={`dari ${s.menu_terjual ?? 0} menu terjual`} />
          </div>
          {data?.catatan && <p className="text-sm text-amber-800 dark:text-amber-400">{data.catatan}</p>}
          <Card className="p-0 overflow-hidden">
            <DataTable rows={(data?.rows || []).map((r, i) => ({ ...r, _k: i }))} keyField="_k" loading={!data} rowTestIdPrefix="usage-row"
              columns={[
                { key: "item", label: "Item", primary: true, render: (r) => <span className="font-medium">{r.item}</span> },
                { key: "toko", label: "Toko", hideOnMobile: true },
                { key: "teoretis", label: "Teoretis", numeric: true, render: (r) => `${num(r.teoretis)} ${r.satuan || ""}` },
                { key: "aktual", label: "Aktual", numeric: true, render: (r) => `${num(r.aktual)} ${r.satuan || ""}` },
                { key: "selisih_pct", label: "Selisih", numeric: true, render: (r) => (r.selisih_pct == null ? "—" : `${r.selisih_pct > 0 ? "+" : ""}${r.selisih_pct}%`) },
                { key: "nilai_selisih", label: "Nilai", numeric: true, hideOnMobile: true, render: (r) => fmtRp(r.nilai_selisih || 0) },
                { key: "status", label: "Status", render: (r) => <StatusPill status={PILL[r.status][0]} label={PILL[r.status][1]} /> },
              ]}
              empty={<EmptyState icon={PackageSearch} title="Belum bisa dihitung" description="Butuh detail penjualan per menu (Impor Cerdas) dan resep (Menu & Resep)." />} />
          </Card>
          {data && <p className="text-xs text-muted-foreground">Aktual dihitung dari {data.metode_aktual}. Selisih &gt; 5% ditandai.</p>}
        </>
      )}
      {tab === "waste" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <CompactStatCard label="Total waste" value={fmtRp(s.total_waste || 0)} tone={s.total_waste ? "warning" : "success"} />
            <CompactStatCard label="Total pembelian" value={fmtRp(s.total_pembelian || 0)} />
            <CompactStatCard label="Waste / pembelian" value={s.total_pembelian ? `${((s.total_waste / s.total_pembelian) * 100).toFixed(1)}%` : "—"} />
          </div>
          <Card className="p-0 overflow-hidden">
            <DataTable rows={(data?.rows || []).map((r, i) => ({ ...r, _k: i }))} keyField="_k" loading={!data} rowTestIdPrefix="waste-row"
              columns={[
                { key: "item", label: "Item", primary: true, render: (r) => <span className="font-medium">{r.item}</span> },
                { key: "toko", label: "Toko" },
                { key: "qty", label: "Qty", numeric: true, render: (r) => num(r.qty) },
                { key: "kali", label: "Kejadian", numeric: true, hideOnMobile: true },
                { key: "nilai", label: "Nilai", numeric: true, render: (r) => fmtRp(r.nilai) },
              ]}
              empty={<EmptyState icon={PackageSearch} title="Tidak ada waste tercatat" description="Catat waste lewat penyesuaian stok (jenis wastage)." />} />
          </Card>
        </>
      )}
      {tab === "transfer" && (
        <Card className="p-0 overflow-hidden">
          <DataTable rows={(data?.draf_transfer || []).map((d, i) => ({ ...d, _k: i }))} keyField="_k" loading={!data} rowTestIdPrefix="transfer-sugg"
            columns={[
              { key: "dari", label: "Dari → ke", primary: true, render: (d) => {
                const first = (data.rows || []).find((x) => x.from_outlet_id === d.from_outlet_id && x.to_outlet_id === d.to_outlet_id);
                return <span className="font-medium">{first?.dari} → {first?.ke}</span>; } },
              { key: "lines", label: "Item", render: (d) => (data.rows || []).filter((x) => x.from_outlet_id === d.from_outlet_id && x.to_outlet_id === d.to_outlet_id)
                .map((x) => `${x.item} ${num(x.qty)} ${x.satuan || ""}`).join(", ") },
            ]}
            rowAction={(d) => (made[d._k] ? <StatusPill status="confirmed" label={made[d._k]} />
              : can("inventory.transfer") ? <Button size="sm" variant="outline" onClick={() => makeTransfer({ ...d, _k: undefined }, d._k)}><ArrowRightLeft /> Buat transfer</Button> : null)}
            empty={<EmptyState icon={ArrowRightLeft} title="Tidak ada saran" description="Tidak ada toko dengan stok berlebih untuk item yang kurang di toko lain." />} />
        </Card>
      )}
    </div>
  );
}
