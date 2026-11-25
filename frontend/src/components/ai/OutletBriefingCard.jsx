/** Briefing toko harian (Agen Outlet): penjualan kemarin vs rata-rata hari yang sama 4 minggu, dan hal yang perlu
 * perhatian per toko (Daily Sales belum masuk/divalidasi, kas kecil & pembelian mendesak menunggu, stok di bawah par,
 * anomali). GET /api/ai/outlet/briefing (konteks Brand/Toko TopNav otomatis). */
import { useEffect, useState } from "react";
import { Sunrise } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function OutletBriefingCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/ai/outlet/briefing").then((r) => setData(unwrap(r))).catch(() => setData({ rows: [] }));
  }, []);
  const rows = (data?.rows || []).filter((r) => r.perhatian.length || r.penjualan != null);
  return (
    <Card className="p-4 space-y-3" data-testid="outlet-briefing-card">
      <div className="flex items-center gap-2">
        <Sunrise className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base flex-1">Briefing toko{data?.tanggal ? ` · ${fmtDate(data.tanggal)}` : ""}</CardTitle>
        {data?.ringkasan && <span className="text-xs text-muted-foreground">{data.ringkasan.perlu_perhatian} toko perlu perhatian</span>}
      </div>
      <DataTable rows={rows} keyField="outlet_id" loading={!data} rowTestIdPrefix="briefing-row"
        columns={[
          { key: "toko", label: "Toko", primary: true, render: (r) => <span className="font-medium">{r.toko}</span> },
          { key: "penjualan", label: "Penjualan", numeric: true, render: (r) => (r.penjualan == null ? "—" : fmtRp(r.penjualan)) },
          { key: "perubahan_pct", label: "vs 4 minggu", numeric: true, render: (r) => (r.perubahan_pct == null ? "—" : (
            <span className={cn(r.perubahan_pct <= -10 ? "text-rose-700 dark:text-rose-400" : r.perubahan_pct >= 10 ? "text-emerald-700 dark:text-emerald-400" : "")}>
              {r.perubahan_pct > 0 ? "+" : ""}{r.perubahan_pct}%</span>)) },
          { key: "reservasi_hari_ini", label: "Reservasi", numeric: true, hideOnMobile: true, render: (r) => (r.reservasi_hari_ini ? `${r.reservasi_hari_ini} (${r.pax_hari_ini} pax)` : "—") },
          { key: "perhatian", label: "Perlu perhatian", render: (r) => <span className="text-xs">{r.perhatian.join(" · ") || "—"}</span> },
        ]}
        empty={<EmptyState icon={Sunrise} title="Semua beres" description="Tidak ada data penjualan atau hal yang perlu perhatian." />} />
    </Card>
  );
}
