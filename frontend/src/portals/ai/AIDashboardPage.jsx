/** /ai/dashboard — Dashboard AI: grafik yang disematkan dari percakapan Asisten AI.
 * Grafik dengan sumber query (periode relatif, mis. "30 hari terakhir") diperbarui otomatis saat halaman dibuka;
 * data dibaca ulang sebagai pengguna ini (izin & batas toko tetap berlaku). */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, RefreshCw, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { confirmDialog } from "@/components/shared/confirmDialog";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import ChartBlock from "@/components/ai/ChartBlock";

export default function AIDashboardPage() {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const refreshOne = useCallback(async (id, quiet = false) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const p = unwrap(await api.post(`/ai/agent/pins/${id}/refresh`));
      setPins((xs) => xs.map((x) => (x.id === id ? p : x)));
    } catch (e) {
      if (!quiet) toast.error(unwrapError(e));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rows = unwrap(await api.get("/ai/agent/pins", { scope: false })) || [];
        setPins(rows);
        // perbarui otomatis grafik yang punya sumber query
        rows.filter((p) => p.spec?.source_query).forEach((p) => refreshOne(p.id, true));
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshOne]);

  const remove = async (p) => {
    if (!(await confirmDialog({ title: "Hapus grafik?", description: `"${p.title}" dihapus dari Dashboard AI.`, confirmText: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/ai/agent/pins/${p.id}`);
      setPins((xs) => xs.filter((x) => x.id !== p.id));
    } catch (e) {
      toast.error(unwrapError(e));
    }
  };

  return (
    <div className="space-y-3 md:space-y-4" data-testid="ai-dashboard-page">
      <PageHeader icon={LayoutDashboard} title="Dashboard AI" subtitle="Grafik yang Anda sematkan dari Asisten AI — diperbarui otomatis saat dibuka" />
      {loading && <LoadingState />}
      {!loading && !pins.length && (
        <Card className="p-4">
          <EmptyState icon={LayoutDashboard} title="Belum ada grafik"
            description="Minta Asisten AI membuat grafik (mis. 'grafik sales per toko 30 hari terakhir'), lalu klik Sematkan."
            action={<Button asChild variant="outline"><Link to="/ai"><MessageSquare className="h-4 w-4" /> Buka Asisten AI</Link></Button>} />
        </Card>
      )}
      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        {pins.map((p) => (
          <Card key={p.id} className="p-4 space-y-2" data-testid="ai-pin">
            <CardHeader className="p-0 flex-row items-start justify-between gap-2 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{p.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {p.spec?.source_query ? `Diperbarui ${fmtRelative(p.refreshed_at)}` : `Snapshot ${fmtRelative(p.created_at)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.spec?.source_query && (
                  <Button size="icon-sm" variant="ghost" onClick={() => refreshOne(p.id)} disabled={busy[p.id]} aria-label={`Perbarui ${p.title}`}>
                    <RefreshCw className={busy[p.id] ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  </Button>
                )}
                <Button size="icon-sm" variant="ghost" onClick={() => remove(p)} aria-label={`Hapus ${p.title}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ChartBlock spec={p.spec} height={260} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
