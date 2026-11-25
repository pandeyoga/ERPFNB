/** Asisten tutup buku: checklist kesiapan per periode (Daily Sales belum divalidasi, GRNI, AP jatuh tempo, rekonsiliasi
 * bank, kas kecil, payroll, penyusutan), fluktuasi akun vs bulan lalu, dan ringkasan AI opsional.
 * Backend: GET /ai/finance/close/{period}?ai=. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import StatusPill from "@/components/shared/StatusPill";
import SimpleSelect from "@/components/shared/SimpleSelect";
import DataTable from "@/components/shared/DataTable";
import Markdown from "@/components/ai/Markdown";
import api, { unwrap, unwrapError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canOpenPath } from "@/lib/unifiedNav";
import { fmtRp } from "@/lib/format";

const PILL = { beres: ["confirmed", "Beres"], info: ["submitted", "Info"], warning: ["pending", "Perlu dicek"], kritis: ["rejected", "Wajib"] };

function lastMonths(n = 6) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const v = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: m.toLocaleDateString("id-ID", { month: "long", year: "numeric" }) });
  }
  return out;
}

export default function CloseAssistantCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const months = useMemo(() => lastMonths(), []);
  const [period, setPeriod] = useState(months[0].value);
  const [data, setData] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    setData(null);
    api.get(`/ai/finance/close/${period}`, { scope: false }).then((r) => setData(unwrap(r)))
      .catch((e) => { toast.error(unwrapError(e)); setData({ checklist: [], fluktuasi: [] }); });
  }, [period]);

  const explain = async () => {
    setAiBusy(true);
    try { setData(unwrap(await api.get(`/ai/finance/close/${period}`, { params: { ai: true }, scope: false }))); }
    catch (e) { toast.error(unwrapError(e)); } finally { setAiBusy(false); }
  };
  const open = (path) => path && canOpenPath(user, path.split("?")[0]);
  const todo = (data?.checklist || []).filter((i) => i.status !== "beres").length;

  return (
    <Card className="p-4 space-y-3" data-testid="close-assistant">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base flex-1 min-w-0">Kesiapan tutup buku</CardTitle>
        <SimpleSelect value={period} onValueChange={setPeriod} options={months} ariaLabel="Periode" className="w-44" />
        <Button size="sm" variant="outline" onClick={explain} disabled={aiBusy || !data} data-testid="close-ai-explain">
          <Sparkles className="h-3.5 w-3.5" /> {aiBusy ? "Menganalisis…" : "Ringkasan AI"}
        </Button>
      </div>
      {!data ? <p className="text-sm text-muted-foreground">Memuat…</p> : (
        <>
          <p className="text-sm">
            Periode <b>{data.status_periode === "locked" ? "terkunci" : "terbuka"}</b> ·{" "}
            {data.siap_tutup ? <span className="text-emerald-700 dark:text-emerald-400">siap ditutup</span>
              : <span className="text-amber-800 dark:text-amber-400">{todo} hal perlu diselesaikan</span>}
          </p>
          <ul className="divide-y divide-border" data-testid="close-checklist">
            {(data.checklist || []).map((i) => (
              <li key={i.key} className="flex items-center gap-3 py-2">
                <StatusPill status={PILL[i.status]?.[0] || "draft"} label={PILL[i.status]?.[1] || i.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{i.judul}{i.jumlah ? ` (${i.jumlah})` : ""}</div>
                  {(i.rincian || i.nominal) && (
                    <div className="text-xs text-muted-foreground truncate">{[i.rincian, i.nominal ? fmtRp(i.nominal) : null].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
                {i.status !== "beres" && open(i.halaman) && (
                  <Button size="sm" variant="ghost" onClick={() => navigate(i.halaman)} aria-label={`Buka: ${i.judul}`}>
                    Buka <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {(data.fluktuasi || []).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Fluktuasi akun vs bulan lalu (≥ 20% & ≥ Rp1 jt)</h4>
              <DataTable keyField="akun" rows={data.fluktuasi} rowTestIdPrefix="close-flux" loading={!data}
                empty={<p className="p-3 text-sm text-muted-foreground">Tidak ada fluktuasi besar.</p>}
                columns={[
                  { key: "akun", label: "Akun", primary: true },
                  { key: "periode_ini", label: "Periode ini", numeric: true, render: (r) => fmtRp(r.periode_ini) },
                  { key: "periode_lalu", label: "Bulan lalu", numeric: true, hideOnMobile: true, render: (r) => fmtRp(r.periode_lalu) },
                  { key: "persen", label: "Perubahan", numeric: true, render: (r) => (r.persen != null ? `${r.persen > 0 ? "+" : ""}${r.persen}%` : "baru") },
                ]} />
            </div>
          )}
          {data.penjelasan_ai && (
            <div className="rounded-md bg-muted/50 p-3 text-sm" data-testid="close-ai-text">
              <Markdown text={data.penjelasan_ai} onNavigate={(p) => navigate(p)} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
