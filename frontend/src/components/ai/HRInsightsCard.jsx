/** Insight SDM (Agen HR): labor cost % per toko bulan lalu (butuh izin payroll) dan hari-hari kekurangan orang karena
 * cuti 2 minggu ke depan + cuti yang menunggu persetujuan. GET /api/ai/hr/labor-cost, /api/ai/hr/leave-coverage. */
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import api, { unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtRp, fmtDate } from "@/lib/format";

export default function HRInsightsCard() {
  const { can } = useAuth();
  const canPay = can("hr.payroll.read") || can("finance.report.profit_loss");
  const canLeave = can("hr.leave.read") || can("hr.read");
  const [labor, setLabor] = useState(null);
  const [leave, setLeave] = useState(null);
  useEffect(() => {
    if (canPay) api.get("/ai/hr/labor-cost", { scope: false }).then((r) => setLabor(unwrap(r))).catch(() => setLabor({ rows: [] }));
    if (canLeave) api.get("/ai/hr/leave-coverage", { scope: false }).then((r) => setLeave(unwrap(r))).catch(() => setLeave({ rows: [] }));
  }, [canPay, canLeave]);
  if (!canPay && !canLeave) return null;
  const short = (leave?.rows || []).filter((r) => r.status === "kurang_orang");
  return (
    <Card className="p-4 space-y-4" data-testid="hr-insights-card">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base flex-1">Insight SDM</CardTitle>
      </div>
      {canPay && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Labor cost % {labor?.period ? `· ${labor.period}` : ""}
            {labor?.ringkasan?.labor_cost_pct != null && <span className="text-muted-foreground font-normal"> — total {labor.ringkasan.labor_cost_pct}% (batas {labor.ringkasan.batas_pct}%)</span>}</h4>
          <DataTable rows={(labor?.rows || []).map((r, i) => ({ ...r, _k: i }))} keyField="_k" loading={!labor} rowTestIdPrefix="labor-row"
            columns={[
              { key: "toko", label: "Toko", primary: true },
              { key: "biaya_tenaga_kerja", label: "Biaya tenaga kerja", numeric: true, render: (r) => fmtRp(r.biaya_tenaga_kerja) },
              { key: "penjualan", label: "Penjualan", numeric: true, hideOnMobile: true, render: (r) => fmtRp(r.penjualan) },
              { key: "labor_cost_pct", label: "Labor cost", numeric: true, render: (r) => (r.labor_cost_pct == null ? "—" : `${r.labor_cost_pct}%`) },
              { key: "status", label: "Status", render: (r) => <StatusPill status={r.status === "tinggi" ? "rejected" : r.status === "wajar" ? "confirmed" : "draft"}
                label={r.status === "tinggi" ? "Tinggi" : r.status === "wajar" ? "Wajar" : "Tanpa penjualan"} /> },
            ]}
            empty={<EmptyState icon={Users} title="Belum ada payroll" description="Labor cost dihitung dari payroll yang sudah diposting." />} />
        </div>
      )}
      {canLeave && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Cuti 2 minggu ke depan · {leave?.ringkasan?.cuti_menunggu ?? 0} menunggu persetujuan</h4>
          <DataTable rows={short.map((r, i) => ({ ...r, _k: i }))} keyField="_k" loading={!leave} rowTestIdPrefix="leave-short"
            columns={[
              { key: "tanggal", label: "Tanggal", primary: true, render: (r) => fmtDate(r.tanggal) },
              { key: "toko", label: "Toko" },
              { key: "cuti", label: "Cuti", numeric: true, render: (r) => `${r.cuti}/${r.karyawan} (${r.persen}%)` },
              { key: "nama", label: "Nama", hideOnMobile: true, render: (r) => <span className="text-xs">{r.nama}</span> },
            ]}
            empty={<EmptyState icon={Users} title="Staf cukup" description="Tidak ada hari dengan lebih dari 30% staf satu toko cuti." />} />
        </div>
      )}
    </Card>
  );
}
