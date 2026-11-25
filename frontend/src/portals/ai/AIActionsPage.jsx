/** /ai/approvals — Persetujuan AI: semua usulan aksi tulis dari Asisten AI milik pengguna (dari web & WhatsApp),
 * dengan filter status. Usulan yang masih menunggu bisa disetujui/ditolak di sini; AI lalu melanjutkan di percakapannya. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import EmptyState from "@/components/shared/EmptyState";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import ActionCard from "@/components/ai/ActionCard";

const FILTERS = [
  { value: "pending", label: "Menunggu" },
  { value: "done", label: "Selesai" },
  { value: "failed", label: "Gagal" },
  { value: "rejected", label: "Ditolak" },
  { value: "all", label: "Semua" },
];

export default function AIActionsPage() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = status === "all" ? { limit: 200 } : { status: status === "pending" ? "pending,executing" : status, limit: 200 };
      setRows(unwrap(await api.get("/ai/agent/actions", { params, scope: false })) || []);
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision, { body } = {}) => {
    try {
      const url = `/ai/agent/actions/${id}/${decision === "approve" ? "approve" : "reject"}`;
      const res = unwrap(await api.post(url, decision === "approve" && body !== undefined ? { body } : {}, { timeout: 200000 }));
      const a = res.action;
      if (a.status === "done") toast.success("Aksi dijalankan");
      else if (a.status === "failed") toast.error(`Aksi gagal: ${a.error || "galat"}`);
      else toast.message("Usulan ditolak");
      if (res.followup) toast.message("AI melanjutkan di percakapan terkait");
    } catch (e) {
      toast.error(unwrapError(e));
    }
    load();
  };

  const columns = [
    { key: "created_at", label: "Diusulkan", render: (r) => fmtDateTime(r.created_at) },
    { key: "title", label: "Aksi", primary: true, render: (r) => <span className="font-medium">{r.title}</span> },
    { key: "risk", label: "Risiko", render: (r) => <StatusPill status={`risk_${r.risk}`} /> },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <div className="space-y-3 md:space-y-4" data-testid="ai-actions-page">
      <PageHeader icon={ShieldCheck} title="Persetujuan AI" subtitle="Usulan buat/ubah/hapus data dari Asisten AI — dijalankan atas nama Anda setelah disetujui" />
      <SegmentedFilter value={status} onChange={setStatus} options={FILTERS} ariaLabel="Status usulan" testId="ai-actions-filter" />
      <Card className="p-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          rowTestIdPrefix="ai-action-row"
          defaultSort={{ key: "created_at", dir: "desc" }}
          renderExpanded={(r) => (
            <div className="space-y-2">
              <ActionCard action={r} onDecide={decide} />
              <Button asChild size="sm" variant="ghost">
                <Link to={`/ai?session=${r.session_id}`}><MessageSquare className="h-3.5 w-3.5" /> Buka percakapan</Link>
              </Button>
            </div>
          )}
          empty={<EmptyState icon={ShieldCheck} title={status === "pending" ? "Tidak ada usulan yang menunggu" : "Belum ada usulan"}
            description="Usulan muncul saat Anda meminta AI membuat, mengubah, atau menghapus data." />}
        />
      </Card>
    </div>
  );
}
