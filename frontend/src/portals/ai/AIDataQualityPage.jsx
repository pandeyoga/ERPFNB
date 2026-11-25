/** /ai/data-quality — AI Data Steward: item & supplier ganda (nama mirip, NPWP/rekening/telepon sama) beserta
 * pemakaian per record, nonaktifkan duplikat yang belum dipakai, dan master data yang belum lengkap.
 * Backend: /api/ai/steward/duplicates | completeness | deactivate. */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DatabaseZap, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import CompactStatCard from "@/components/shared/CompactStatCard";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import EmptyState from "@/components/shared/EmptyState";
import { confirmDialog } from "@/components/shared/confirmDialog";
import api, { unwrap, unwrapError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canOpenPath } from "@/lib/unifiedNav";

const ENTITIES = [{ value: "items", label: "Item" }, { value: "vendors", label: "Supplier" }];
const MASTER_PATH = { items: "/admin/master/items", vendors: "/admin/master/vendors" };

const usageText = (u) => Object.entries(u || {}).map(([k, v]) => `${k} ${v}`).join(", ") || "belum dipakai";

export default function AIDataQualityPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [entity, setEntity] = useState("items");
  const [dups, setDups] = useState(null);
  const [comp, setComp] = useState(null);
  const canManage = can("admin.master_data.manage");

  const load = useCallback(() => {
    setDups(null); setComp(null);
    api.get("/ai/steward/duplicates", { params: { entity }, scope: false }).then((r) => setDups(unwrap(r)))
      .catch((e) => { toast.error(unwrapError(e)); setDups({ kelompok: [], jumlah_kelompok: 0 }); });
    api.get("/ai/steward/completeness", { params: { entity }, scope: false }).then((r) => setComp(unwrap(r)))
      .catch(() => setComp({ rows: [], total: 0, belum_lengkap: 0 }));
  }, [entity]);
  useEffect(() => { load(); }, [load]);

  const deactivate = async (g, rec) => {
    const keep = g.records.find((r) => r.id === g.pertahankan);
    if (!(await confirmDialog({ title: "Nonaktifkan duplikat?", description: `"${rec.name}" dinonaktifkan dan namanya dicatat sebagai alias "${keep.name}".`,
      confirmText: "Nonaktifkan" }))) return;
    try {
      await api.post("/ai/steward/deactivate", { entity, id: rec.id, keep_id: keep.id });
      toast.success("Duplikat dinonaktifkan"); load();
    } catch (e) { toast.error(unwrapError(e)); }
  };
  const askAI = (g) => window.dispatchEvent(new CustomEvent("aurora-open-ai", { detail: {
    prompt: `Bantu gabungkan ${entity === "items" ? "item" : "supplier"} ganda: ${g.records.map((r) => `"${r.name}" (id ${r.id}, ${usageText(r.pemakaian)})`).join("; ")}. Jelaskan dampaknya & langkah aman.` } }));
  const openMaster = canOpenPath(user, MASTER_PATH[entity]);

  const groupCols = [
    { key: "records", label: "Record", primary: true, render: (g) => (
      <ul className="space-y-0.5">{g.records.map((r) => (
        <li key={r.id} className="text-sm"><span className={r.id === g.pertahankan ? "font-medium" : ""}>{r.name}</span>
          <span className="text-xs text-muted-foreground"> · {r.code || "—"}{r.unit ? ` · ${r.unit}` : ""} · {usageText(r.pemakaian)}</span></li>))}</ul>) },
    { key: "alasan", label: "Alasan", hideOnMobile: true },
    { key: "aksi", label: "Saran", render: (g) => (
      <div className="flex flex-wrap gap-1.5">
        {g.saran.map((sg) => {
          const rec = g.records.find((r) => r.id === sg.id);
          return sg.aksi === "nonaktifkan" && canManage
            ? <Button key={sg.id} size="sm" variant="outline" onClick={() => deactivate(g, rec)} data-testid={`dq-deactivate-${sg.id}`}>Nonaktifkan "{rec.name}"</Button>
            : <span key={sg.id} className="text-xs text-muted-foreground">"{rec.name}": {sg.aksi === "nonaktifkan" ? "bisa dinonaktifkan" : "gabung manual"}</span>;
        })}
        {can("ai.agent.use") && <Button size="sm" variant="ghost" onClick={() => askAI(g)}><Bot className="h-3.5 w-3.5" /> Tanya AI</Button>}
      </div>) },
  ];

  return (
    <div className="space-y-3 md:space-y-4" data-testid="ai-data-quality-page">
      <PageHeader icon={DatabaseZap} title="Kualitas Data" subtitle="Item & supplier ganda dan data master yang belum lengkap — dicek AI Data Steward" />
      <SegmentedFilter value={entity} onChange={setEntity} options={ENTITIES} ariaLabel="Jenis data" testId="dq-entity" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <CompactStatCard label="Kelompok ganda" value={dups?.jumlah_kelompok ?? "…"} tone={dups?.jumlah_kelompok ? "warning" : "success"} />
        <CompactStatCard label="Belum lengkap" value={comp?.belum_lengkap ?? "…"} sub={comp ? `dari ${comp.total}` : undefined} tone={comp?.belum_lengkap ? "warning" : "success"} />
        <CompactStatCard label="Lengkap" value={comp ? `${comp.total ? Math.round(((comp.total - comp.belum_lengkap) / comp.total) * 100) : 100}%` : "…"} />
      </div>
      <Card className="p-4 space-y-3">
        <CardTitle className="text-base">Data ganda</CardTitle>
        <DataTable columns={groupCols} rows={dups?.kelompok || []} keyField="pertahankan" loading={!dups} rowTestIdPrefix="dq-group"
          empty={<EmptyState icon={DatabaseZap} title="Tidak ada data ganda" description="Nama, NPWP, rekening & telepon tidak ada yang kembar." />} />
      </Card>
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base flex-1">Belum lengkap</CardTitle>
          {openMaster && <Button size="sm" variant="outline" onClick={() => navigate(MASTER_PATH[entity])}>Buka master data</Button>}
        </div>
        <DataTable rows={comp?.rows || []} loading={!comp} rowTestIdPrefix="dq-incomplete"
          columns={[{ key: "name", label: "Nama", primary: true }, { key: "kurang", label: "Belum diisi", render: (r) => r.kurang.join(", ") }]}
          empty={<EmptyState icon={DatabaseZap} title="Semua lengkap" description="Tidak ada data master yang kurang." />} />
      </Card>
    </div>
  );
}
