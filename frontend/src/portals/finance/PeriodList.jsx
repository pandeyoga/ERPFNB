/** PeriodList — table of accounting periods with status pills + lock/unlock/wizard actions. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Unlock, ListChecks, CalendarRange, RefreshCw, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { confirmDialog, promptDialog } from "@/components/shared/confirmDialog";
import RowActions from "@/components/shared/RowActions";

export default function PeriodList({ embedded = false }) {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [acting, setActing] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/periods", { params: { year } });
      setItems(unwrap(res) || []);
    } catch {
      toast.error("Gagal memuat daftar periode");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year]);

  async function lock(period) {
    if (!(await confirmDialog(`Kunci periode ${period}? Setelah dikunci, jurnal di periode ini tidak bisa diposting.`))) return;
    try {
      setActing(period);
      await api.post(`/finance/periods/${period}/lock`, { reason: "Lock from period list" });
      toast.success(`Periode ${period} dikunci`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengunci periode");
    } finally { setActing(""); }
  }

  async function close(period) {
    if (!(await confirmDialog(`Tutup periode ${period}? Soft-close (masih bisa dibuka kembali).`))) return;
    try {
      setActing(period);
      await api.post(`/finance/periods/${period}/close`, { reason: "Close from period list" });
      toast.success(`Periode ${period} ditutup (soft-close)`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menutup periode");
    } finally { setActing(""); }
  }

  async function unlock(period) {
    const reason = await promptDialog({
      title: `Buka kembali periode ${period}?`,
      description: "Periode akan kembali ke status open sehingga jurnal dapat diposting lagi. Aksi ini tercatat pada audit log.",
      label: "Alasan",
      placeholder: "Mis: koreksi adjustment, tambah jurnal terlewat…",
      required: true,
      multiline: true,
      confirmText: "Buka kembali",
    });
    if (!reason) return;
    try {
      setActing(period);
      await api.post(`/finance/periods/${period}/unlock`, { reason });
      toast.success(`Periode ${period} dibuka kembali`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membuka kembali periode");
    } finally { setActing(""); }
  }

  const canClose = can("finance.period.close_step");
  const canLock = can("finance.period.lock");
  const canUnlock = can("finance.period.unlock");

  return (
    <div data-testid="periods-page">
      {!embedded && (
        <PageHeader
          icon={CalendarRange}
          title="Periods"
          subtitle="Status periode akuntansi (open / closed / locked) beserta aksi tutup, kunci, dan buka kembali"
        />
      )}
      <div className="space-y-3 lg:space-y-4">
      <div className="glass-card p-3 flex flex-wrap items-end gap-3">
        <div className="w-32">
          <Label htmlFor="period-year" className="text-xs font-medium text-muted-foreground">Tahun</Label>
          <Input id="period-year" type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="glass-input mt-1 h-9" data-testid="period-year" />
        </div>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="period-refresh">
          <RefreshCw className={loading ? "animate-spin" : undefined} /> Muat ulang
        </Button>
        <div className="ml-auto text-xs text-muted-foreground hidden md:flex items-center gap-1.5" data-testid="period-status-legend">
          <StatusPill status="open" /> dapat diposting
          <span className="mx-1">·</span>
          <StatusPill status="closed" /> soft-close
          <span className="mx-1">·</span>
          <StatusPill status="locked" /> hard-lock
        </div>
      </div>

      <div className="glass-card overflow-hidden" data-testid="periods-table">
        <DataTable
          rows={items}
          keyField="period"
          loading={loading}
          rowTestIdPrefix="period-row"
          empty={<EmptyState icon={CalendarRange} title="Belum ada periode" description="Periode dibuat otomatis saat jurnal pertama di tahun ini diposting." />}
          columns={[
            { key: "period", label: "Period", sortable: true, primary: true,
              render: (p) => <span className="font-semibold tabular-nums">{p.period}</span> },
            { key: "status", label: "Status", sortable: true,
              render: (p) => <StatusPill status={p.status} /> },
            { key: "locked", label: "Locked / Closed",
              render: (p) => (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  {p.locked_at ? <><Lock className="h-3 w-3" aria-label="Dikunci" /> {fmtDateTime(p.locked_at)}</> :
                    p.closed_at ? <><CheckCircle2 className="h-3 w-3" aria-label="Ditutup" /> {fmtDateTime(p.closed_at)}</> : "—"}
                </span>
              ) },
            { key: "updated_at", label: "Terakhir Diperbarui", sortable: true,
              render: (p) => <span className="text-xs text-muted-foreground">{fmtDateTime(p.updated_at)}</span> },
          ]}
          rowAction={(p) => (
            // Aksi baris: Wizard + "⋯" (DESIGN_SYSTEM §10.1) — sebelumnya 3–4 tombol berjajar per periode.
            <RowActions
              testId={`period-actions-${p.period}`}
              primary={(
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/finance/period-closing/${p.period}`} data-testid={`period-wizard-${p.period}`}>
                    <ListChecks /> Wizard
                  </Link>
                </Button>
              )}
              items={[
                { label: "Tutup (soft-close)", hidden: !(p.status === "open" && canClose), disabled: acting === p.period,
                  onSelect: () => close(p.period), testId: `period-close-${p.period}` },
                { label: "Kunci", icon: Lock, hidden: !((p.status === "open" || p.status === "closed") && canLock), disabled: acting === p.period,
                  onSelect: () => lock(p.period), testId: `period-lock-${p.period}` },
                { label: "Buka kembali", icon: Unlock, hidden: !((p.status === "locked" || p.status === "closed") && canUnlock), disabled: acting === p.period,
                  onSelect: () => unlock(p.period), testId: `period-unlock-${p.period}` },
              ]}
            />
          )}
        />
      </div>
      </div>

    </div>
  );
}
