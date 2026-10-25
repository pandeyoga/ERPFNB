/** Daily Close — outlet end-of-day checklist + deposit slip upload + submit. (Phase 8B)
 *
 *  Komponen yang sama dirender sebagai Langkah 4 di End of Day (/outlet/end-of-day,
 *  `embedded`). Rute lama /outlet/daily-close tetap ada (deprecated) dan menampilkan
 *  banner yang mengarahkan ke End of Day. */
import { useEffect, useState } from "react";
import {
  ClipboardCheck, CheckCircle2, AlertTriangle, FileImage, Send,
  Lock, RefreshCw, Calendar as CalendarIcon, Receipt, Wallet,
  ChefHat, ArrowRight, Info, Store,
} from "lucide-react";
import { Link } from "react-router-dom";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import FileDropZone from "@/components/shared/FileDropZone";
import { fmtDate, fmtDateTime, fmtRp, todayJakartaISO } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOutletScopeCtx } from "./OutletScopeContext";

const CHECKLIST_ICONS = {
  sales: Receipt,
  petty_cash: Wallet,
  kdo_bdo: ChefHat,
  deposit_slip: FileImage,
};

export default function DailyClose({ embedded = false }) {
  const { user } = useAuth();
  const { outletId, scopedOutlets: outlets, currentOutlet } = useOutletScopeCtx();
  const [date, setDate] = useState(todayJakartaISO());
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [depositSlip, setDepositSlip] = useState(null); // attachment object
  const [notes, setNotes] = useState("");

  async function loadStatus() {
    if (!outletId || !date) return;
    setLoading(true);
    try {
      const params = { outlet_id: outletId, date };
      if (depositSlip) params.deposit_slip_attachment_id = depositSlip.id;
      const res = await api.get("/outlet/daily-close/status", { params });
      setStatus(unwrap(res) || null);
    } catch (e) {
      toast.error("Gagal load status");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const params = { per_page: 30 };
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/outlet/daily-close", { params });
      setHistory(unwrap(res) || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, [outletId, date, depositSlip?.id]); // eslint-disable-line
  useEffect(() => { loadHistory(); }, [outletId]); // eslint-disable-line

  async function handleSubmit() {
    if (!status?.can_close) {
      toast.error("Checklist belum lengkap. Lengkapi item bertanda merah.");
      return;
    }
    if (!depositSlip?.id) {
      toast.error("Slip setoran wajib di-upload");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/outlet/daily-close/submit", {
        outlet_id: outletId,
        date,
        deposit_slip_attachment_id: depositSlip.id,
        notes,
      });
      const data = unwrap(res);
      toast.success("Daily close berhasil—finance team akan diberi notifikasi");
      setStatus(prev => ({ ...prev, closed: true, record: data, can_close: false }));
      setDepositSlip(null);
      setNotes("");
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal submit");
    } finally {
      setSubmitting(false);
    }
  }

  const allOk = !!status?.can_close;
  const closed = !!status?.closed;
  const items = status?.items || [];
  const okCount = items.filter(i => i.ok).length;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="daily-close-page">
      {!embedded && (
        <>
          <PageHeader
            icon={ClipboardCheck}
            title="Daily Close"
            subtitle="Tutup hari operasional outlet. Pastikan checklist hijau & slip setoran terlampir."
            className="mb-0 md:mb-0"
          />
          <div className="glass-card p-3 flex items-start gap-2 text-sm border-l-4 border-l-sky-500" data-testid="dc-deprecated-banner">
            <Info className="h-4 w-4 mt-0.5 text-sky-600 shrink-0" />
            <div className="flex-1">
              Daily Close kini menjadi <b>Langkah 4</b> di alur <b>End of Day</b> (Daily Sales → Daily Orders → Petty Cash → Daily Close).
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/outlet/end-of-day?step=3" data-testid="dc-open-eod">Buka End of Day</Link>
            </Button>
          </div>
        </>
      )}

      {/* Toolbar: outlet (read-only, dari header) + tanggal */}
      <div className="glass-card p-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs md:text-sm font-medium">Outlet</div>
          <div className="h-9 mt-1 flex items-center gap-1.5 text-sm font-medium" data-testid="dc-outlet-display">
            <Store className="h-4 w-4 text-muted-foreground" />
            {currentOutlet ? currentOutlet.name : <span className="text-muted-foreground font-normal">Belum dipilih — pilih satu outlet di header Outlet Aktif</span>}
          </div>
        </div>
        <div className="sm:w-48">
          <Label className="text-xs md:text-sm font-medium" htmlFor="dc-date">Tanggal</Label>
          <Input
            id="dc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="glass-input mt-1"
            data-testid="dc-date"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => { loadStatus(); }}
          disabled={!outletId}
          data-testid="dc-refresh"
        >
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </Button>
      </div>

      {!outletId && (
        <div className="glass-card p-3 text-sm text-muted-foreground flex items-center gap-2" data-testid="dc-pick-outlet-hint">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          Checklist daily close dihitung per outlet. Pilih satu outlet di header Outlet Aktif untuk melihat checklist dan menutup hari.
        </div>
      )}

      {/* Status banner */}
      {loading && <LoadingState rows={4} />}
      {!loading && status && (
        <div
          className={cn(
            "glass-card p-3 sm:p-4 border-l-4",
            closed ? "border-l-emerald-500 bg-emerald-500/5" :
            allOk ? "border-l-emerald-500 bg-emerald-500/5" :
            "border-l-amber-500 bg-amber-500/5",
          )}
          data-testid="dc-status-banner"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-base font-semibold flex items-center gap-2">
                {closed ? (
                  <>
                    <Lock className="h-4 w-4 text-emerald-600" />
                    Sudah ditutup
                  </>
                ) : allOk ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Siap ditutup
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    {okCount}/{items.length} checklist OK
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {closed && status.record
                  ? `Ditutup oleh ${status.record.closed_by_name || status.record.closed_by} pada ${fmtDateTime(status.record.closed_at)}`
                  : allOk
                    ? "Semua syarat terpenuhi. Klik Submit untuk menutup."
                    : "Lengkapi checklist di bawah sebelum submit."}
              </div>
            </div>
            {closed && status.record?.deposit_slip_url && (
              <a
                href={`${process.env.REACT_APP_BACKEND_URL}${status.record.deposit_slip_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs h-8 px-3 rounded-md border border-input hover:bg-accent inline-flex items-center gap-1.5"
                data-testid="dc-view-slip"
              >
                <FileImage className="h-3.5 w-3.5" />
                Lihat Slip
              </a>
            )}
          </div>
        </div>
      )}

      {/* Checklist */}
      {!loading && status && (
        <div className="glass-card p-4">
          <h3 className="text-sm md:text-base font-semibold mb-3">
            Checklist
          </h3>
          <div className="space-y-2" data-testid="dc-checklist">
            {items.map((it) => {
              const Icon = CHECKLIST_ICONS[it.key] || ClipboardCheck;
              return (
                <div
                  key={it.key}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    it.ok
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-amber-500/30 bg-amber-500/5",
                  )}
                  data-testid={`dc-check-${it.key}`}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-[calc(var(--radius)-2px)] flex items-center justify-center shrink-0",
                      it.ok ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {it.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">{it.title}</span>
                      {it.ok && <StatusPill status="approved" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {it.label}
                    </div>
                    {/* Item-specific actions */}
                    {it.key === "sales" && !it.ok && it.status === "missing" && (
                      <Link
                        to={`/outlet/daily-sales/new`}
                        className="text-xs mt-1 inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        Buat Daily Sales <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {it.key === "sales" && !it.ok && it.status && it.status !== "missing" && it.sales_id && (
                      <Link
                        to={`/outlet/daily-sales/${it.sales_id}`}
                        className="text-xs mt-1 inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        Lihat / Submit <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {it.key === "kdo_bdo" && !it.ok && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Link to="/outlet/daily-orders?type=kdo" className="text-xs inline-flex items-center gap-1 text-foreground hover:underline">
                          KDO <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link to="/outlet/daily-orders?type=bdo" className="text-xs inline-flex items-center gap-1 text-foreground hover:underline">
                          BDO <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                    {it.key === "petty_cash" && !it.ok && (
                      <Link
                        to="/outlet/petty-cash"
                        className="text-xs mt-1 inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        Buka Petty Cash <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit form (only when not closed) */}
      {!loading && status && !closed && (
        <div className="glass-card p-4" data-testid="dc-submit-form">
          <h3 className="text-sm md:text-base font-semibold mb-3">
            Slip Setoran Bank *
          </h3>
          <FileDropZone
            category="deposit_slip"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            sourceType="daily_close_pending"
            sourceId={`${outletId}_${date}`}
            label="Upload slip setoran bank"
            description="JPG / PNG / WEBP / PDF — maks 10 MB"
            value={depositSlip}
            onUploaded={(att) => setDepositSlip(att)}
            onCleared={() => setDepositSlip(null)}
            testId="dc-deposit"
          />
          <div className="mt-3">
            <Label className="text-xs md:text-sm font-medium" htmlFor="dc-notes">Catatan</Label>
            <Textarea
              id="dc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="glass-input mt-1 min-h-[60px]"
              placeholder="Catatan tambahan (opsional)…"
              data-testid="dc-notes"
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Submit akan kunci hari ini & beritahu finance team.
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !allOk || !depositSlip}
              data-testid="dc-submit"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Memproses…" : "Submit Daily Close"}
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="glass-card">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm md:text-base font-semibold">
            Riwayat Daily Close
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadHistory}
            data-testid="dc-history-refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
          </Button>
        </div>
        <DataTable
          columns={[
            {
              key: "close_date", label: "Tanggal", primary: true,
              render: r => fmtDate(r.close_date),
            },
            {
              key: "outlet", label: "Outlet",
              render: r => outlets.find(o => o.id === r.outlet_id)?.name || r.outlet_id,
            },
            {
              key: "sales_total", label: "Sales", numeric: true,
              render: r => fmtRp(r.sales_total || 0),
            },
            {
              key: "pc_balance", label: "Saldo Petty Cash", numeric: true,
              render: r => fmtRp(r.petty_cash_balance || 0),
            },
            {
              key: "closed_by", label: "Ditutup oleh",
              render: r => r.closed_by_name || r.closed_by || "-",
            },
            {
              key: "closed_at", label: "Waktu",
              render: r => fmtDateTime(r.closed_at),
            },
            {
              key: "slip", label: "Slip",
              render: r => r.deposit_slip_url
                ? <a
                    href={`${process.env.REACT_APP_BACKEND_URL}${r.deposit_slip_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-foreground hover:underline inline-flex items-center gap-1"
                    data-testid={`dc-history-slip-${r.id}`}
                  >
                    <FileImage className="h-3 w-3" /> Lihat
                  </a>
                : "-",
            },
          ]}
          rows={history}
          loading={historyLoading}
          empty={
            <EmptyState
              icon={CalendarIcon}
              title="Belum ada riwayat"
              description="Daily close yang ditutup akan tampil di sini."
            />
          }
          rowTestIdPrefix="dc-history"
        />
      </div>
    </div>
  );
}
