/** MyApprovals — "Pusat Persetujuan": SATU inbox approval untuk semua modul.
 *
 * Semua path lama (/finance/approvals, /hr/approvals, …) di-redirect ke sini.
 * Tab: Antrean (kartu filter per tipe dokumen + quick approve/reject, swipe di mobile)
 * dan Delegasi (sebelumnya hanya ada di ApprovalCenter yang tidak pernah ter-render).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox, RefreshCw, ShoppingCart, Package, Sliders, Wallet,
  ClipboardCheck, Sparkles, AlertTriangle, ShoppingBag,
  Check, X, ChevronRight, CalendarDays, CreditCard, ArrowLeftRight, PiggyBank, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import ApprovalDelegations, { APPROVAL_ENTITY_LABELS } from "@/components/shared/ApprovalDelegations";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Tipe dokumen yang bisa masuk antrean. Kartu filter hanya tampil untuk tipe yang
 * punya item menunggu (sebelumnya hanya 4 tipe statis → cuti, payment request, dll.
 * tidak bisa difilter). */
const ENTITY_ICONS = {
  purchase_request:  ClipboardCheck,
  purchase_order:    ShoppingCart,
  stock_adjustment:  Sliders,
  employee_advance:  Wallet,
  urgent_purchase:   ShoppingBag,
  leave_request:     CalendarDays,
  payment_request:   CreditCard,
  stock_transfer:    ArrowLeftRight,
  budget:            PiggyBank,
  ar_invoice:        FileText,
  item_master:       Package,
};

export default function MyApprovals() {
  const [view, setView] = useState("queue"); // queue | delegation
  const [tab, setTab] = useState("all");      // filter tipe dokumen
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardLogs, setGuardLogs] = useState({});
  const [actioning, setActioning] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // {item, action}
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = tab === "all" ? {} : { entity_type: tab };
      const [q, c] = await Promise.all([
        api.get("/approvals/queue", { params: { ...params, per_page: 200 } }),
        api.get("/approvals/counts"),
      ]);
      const queue = unwrap(q) || [];
      setItems(queue);
      setCounts((unwrap(c) || {}).by_entity || {});
      try {
        const lr = await api.get("/forecasting/guard/logs", { params: { days: 30, limit: 500 } });
        const logs = unwrap(lr) || [];
        const map = {};
        logs.forEach(l => { if (l.source_id) map[l.source_id] = l; });
        setGuardLogs(map);
      } catch { /* empty */ }
    } catch {
      toast.error("Gagal memuat queue");
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tab]);

  const totalCount = useMemo(
    () => Object.values(counts || {}).reduce((s, v) => s + (v || 0), 0),
    [counts],
  );

  async function quickAction(item, action, reason = null) {
    setActioning(`${item.entity_id}-${action}`);
    try {
      const body = {
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        action,
      };
      if (action === "reject") body.reason = reason || "-";
      else body.note = reason || "";
      await api.post("/approvals/quick-action", body);
      toast.success(action === "approve" ? `Disetujui — ${item.title || item.doc_no || item.entity_id?.slice(0,8)}` : `Ditolak — ${item.title || item.doc_no || item.entity_id?.slice(0,8)}`);
      // Optimistic remove
      setItems((arr) => arr.filter((x) => x.entity_id !== item.entity_id));
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || `Gagal ${action}`);
    } finally { setActioning(null); }
  }

  // Kartu filter: "Semua" + tiap tipe yang punya antrean (+ tipe yang sedang dipilih).
  const filterTypes = useMemo(
    () => Object.keys(counts || {}).filter((k) => (counts[k] || 0) > 0 || k === tab),
    [counts, tab],
  );

  return (
    <div className="space-y-3 max-w-6xl mx-auto" data-testid="my-approvals-page">
      <PageHeader
        icon={Inbox}
        title="Pusat Persetujuan"
        subtitle="Setujui atau tolak dokumen dari semua modul tanpa membuka detail."
        actions={
          <Button variant="outline" onClick={load} data-testid="my-approvals-refresh">
            <RefreshCw className={cn(loading && "animate-spin")} /> Muat ulang
          </Button>
        }
      />

      <Tabs value={view} onValueChange={setView} data-testid="approval-center">
        <TabsList>
          <TabsTrigger value="queue" data-testid="tab-queue">
            Antrean
            {totalCount > 0 && (
              <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[11px] leading-4 tabular-nums">{totalCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="delegation" data-testid="tab-delegation">Delegasi</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3">
      {/* Filter per tipe dokumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" data-testid="approval-kpi">
        <CompactStatCard size="sm" label="Semua" value={totalCount}
          active={tab === "all"} onClick={() => setTab("all")} testId="stat-total" />
        {filterTypes.map((key) => (
          <CompactStatCard key={key} size="sm"
            label={APPROVAL_ENTITY_LABELS[key] || key.replace(/_/g, " ")}
            value={counts?.[key] ?? 0}
            active={tab === key}
            onClick={() => setTab(key)}
            testId={`stat-${key}`} />
        ))}
      </div>

      {/* List — mobile cards w/ swipe */}
      {loading ? <LoadingState rows={6} /> : (
        items.length === 0 ? (
          <EmptyState icon={Sparkles} title="Tidak ada approval menunggu"
            description="Semua dokumen yang membutuhkan aksi Anda sudah selesai." />
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {items.map((it, i) => (
                <SwipeRow
                  key={it.entity_id}
                  item={it}
                  index={i}
                  guardLog={guardLogs[it.entity_id]}
                  busy={actioning?.startsWith(it.entity_id)}
                  onApprove={() => quickAction(it, "approve")}
                  onReject={() => { setRejectModal({ item: it }); setRejectReason(""); }}
                />
              ))}
            </AnimatePresence>
          </div>
        )
      )}

        </TabsContent>

        <TabsContent value="delegation">
          <ApprovalDelegations />
        </TabsContent>
      </Tabs>

      {/* Reject confirm modal */}
      <Dialog open={!!rejectModal} onOpenChange={(v) => !v && setRejectModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak {rejectModal?.item?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{rejectModal?.item?.describe}</span> — {fmtRp(rejectModal?.item?.amount || 0)}
            </p>
            <div>
              <label className="text-xs font-semibold">Alasan</label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Mis. budget belum cukup, vendor belum diverifikasi, …"
                        rows={3} data-testid="reject-reason-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Batal</Button>
            <Button variant="destructive"
                    onClick={async () => {
                      if (!rejectReason.trim()) { toast.error("Alasan wajib"); return; }
                      const it = rejectModal.item;
                      setRejectModal(null);
                      await quickAction(it, "reject", rejectReason.trim());
                    }}
                    data-testid="reject-confirm-btn">
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SwipeRow({ item, index, guardLog, busy, onApprove, onReject }) {
  const Icon = ENTITY_ICONS[item.entity_type] || Inbox;
  const isSevere = guardLog?.severity === "severe";
  const isMild   = guardLog?.severity === "mild";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, scale: 0.96 }}
      drag="x"
      dragConstraints={{ left: -120, right: 120 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90) onApprove();
        else if (info.offset.x < -90) onReject();
      }}
      transition={{ delay: Math.min(index * 0.025, 0.4), duration: 0.18 }}
      className={cn(
        "glass-card px-3 py-2 cursor-grab active:cursor-grabbing select-none",
        isSevere && "ring-2 ring-red-500/40",
        isMild   && "ring-2 ring-amber-500/40",
        busy     && "opacity-60",
      )}
    >
      {/* Single-row layout: icon | info | amount | actions */}
      <div className="flex items-center gap-2">

        {/* Icon */}
        <div className="h-8 w-8 rounded-xl bg-aurora/10 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-aurora" />
        </div>

        {/* Info block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap leading-tight">
            <Link
              to={item.link}
              className="font-mono text-xs font-semibold truncate hover:underline max-w-[160px] md:max-w-[280px]"
              data-testid={`queue-row-${item.entity_id}`}
              onClick={e => e.stopPropagation()}
            >
              {item.title || item.describe || item.doc_no || item.entity_id?.slice(0,8)}
            </Link>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{item.label}</span>
            <StatusPill status={item.status} />
            {guardLog && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-bold",
                  isSevere ? "bg-red-500/20 text-red-700 dark:text-red-300" : "bg-amber-500/20 text-amber-700 dark:text-amber-300",
                )}
                title={guardLog.message}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {guardLog.severity}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span>
              {item.step_label ? <>menunggu <b className="text-foreground">{item.step_label}</b></> : "menunggu persetujuan"}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>{fmtRelative(item.submitted_at || item.created_at)}</span>
            {item.amount > 0 && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="font-semibold text-foreground tabular-nums">{fmtRp(item.amount)}</span>
              </>
            )}
          </div>
        </div>

        {/* Inline action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            disabled={busy}
            onClick={e => { e.stopPropagation(); onApprove(); }}
            className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid={`quick-approve-${item.entity_id}`}
          >
            <Check className="h-3 w-3" />
            <span className="hidden sm:inline">Setujui</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={e => { e.stopPropagation(); onReject(); }}
            className="gap-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
            data-testid={`quick-reject-${item.entity_id}`}
          >
            <X className="h-3 w-3" />
            <span className="hidden sm:inline">Tolak</span>
          </Button>
          <Link to={item.link} onClick={e => e.stopPropagation()}>
            <Button size="icon-sm" variant="ghost" aria-label="Buka detail" data-testid={`detail-${item.entity_id}`}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile swipe hint — satu kali di baris pertama saja */}
      {index === 0 && (
        <p className="md:hidden text-[11px] text-muted-foreground/60 mt-1.5 text-center italic">
          Swipe kanan = setujui · kiri = tolak
        </p>
      )}
    </motion.div>
  );
}
