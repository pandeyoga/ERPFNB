/** Phase 11C — Owner Cockpit landing.
 * Top: 4 KPIs (Cash, MTD Revenue, AP 7d, Anomalies)
 * Mid:  Cash Position widget + Today's digest preview
 * Bot:  Approval Pending (top 5, quick action) + Anomalies + Business Q&A CTA
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Wallet, TrendingUp, ClipboardCheck, AlertTriangle, ArrowRight,
  RefreshCw, Bell, MessageSquareText, Send, Building2, Receipt, FileText,
  Check, X, LayoutDashboard, Sparkles, Crown,
} from "lucide-react";
import { InlineHelp } from "@/components/shared/InlineHelp";
import api, { unwrap } from "@/lib/api";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import CashPositionWidget from "@/components/shared/CashPositionWidget";
import LoadingState from "@/components/shared/LoadingState";
import DashboardPresetSelector from "@/components/shared/DashboardPresetSelector";
import CollapsibleSection from "@/components/shared/CollapsibleSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtRp, fmtDate, fmtNumber, fmtRelative } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { promptDialog } from "@/components/shared/confirmDialog";

// Preset → which sections to render. Inverse logic: full_view shows everything.
const PRESET_SECTIONS = {
  sales_focus: { kpiRow: true,  cashWidget: false, digestPreview: true,  pendingApprovals: false, bottomRow: false },
  cash_flow:   { kpiRow: true,  cashWidget: true,  digestPreview: true,  pendingApprovals: true,  bottomRow: false },
  operations:  { kpiRow: true,  cashWidget: false, digestPreview: false, pendingApprovals: true,  bottomRow: true  },
  full_view:   { kpiRow: true,  cashWidget: true,  digestPreview: true,  pendingApprovals: true,  bottomRow: true  },
};
const DEFAULT_PRESET = "full_view";

function PendingApprovalsWidget() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/approvals/queue", { params: { per_page: 5 } });
      setItems(unwrap(r) || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function quickAction(item, action) {
    const body = { entity_type: item.entity_type, entity_id: item.entity_id, action };
    if (action === "reject") {
      // Minta alasan nyata (dulu hard-coded "Owner reject from cockpit" tanpa konfirmasi).
      const reason = await promptDialog({
        title: "Tolak pengajuan",
        description: `${item.label || "Dokumen"} — ${itemTitle(item)}`,
        label: "Alasan penolakan",
        placeholder: "Jelaskan alasan penolakan…",
        multiline: true,
        destructive: true,
        confirmText: "Tolak",
      });
      if (!reason) return;
      body.reason = reason;
    }
    setBusy(`${item.entity_id}-${action}`);
    try {
      await api.post("/approvals/quick-action", body);
      toast.success(`${action === "approve" ? "Disetujui" : "Ditolak"} \u2014 ${itemTitle(item)}`);
      setItems((arr) => arr.filter(x => x.entity_id !== item.entity_id));
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || (action === "approve" ? "Gagal menyetujui" : "Gagal menolak"));
    } finally { setBusy(null); }
  }

  const header = (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Approval Pending (Top 5)
      </h3>
      <Button variant="ghost" size="sm" asChild data-testid="cockpit-approvals-open-all">
        <Link to="/my-approvals">Buka semua <ArrowRight /></Link>
      </Button>
    </div>
  );

  if (loading) return <div className="glass-card p-4 h-32 animate-pulse" />;
  if (!items.length) {
    return (
      <div className="glass-card p-4">
        {header}
        <EmptyState icon={ClipboardCheck} title="Tidak ada approval menunggu" description="Semua pengajuan sudah diproses." />
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      {header}
      <ul className="divide-y divide-border/40">
        {items.map((it) => (
          <li key={it.entity_id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{itemTitle(it)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[it.label, it.tier_label || it.current_step_label || it.step_label, fmtRelative(it.submitted_at || it.created_at)].filter(Boolean).join(" • ")}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground">{it.amount_label}</div>
              <div className="text-sm font-semibold tabular-nums">
                {it.amount != null ? fmtRp(it.amount) : it.days_count != null ? `${it.days_count} hari` : "—"}
              </div>
            </div>
            <Button size="sm" disabled={busy === `${it.entity_id}-approve`}
                    onClick={() => quickAction(it, "approve")}
                    variant="success"
                    data-testid={`cockpit-approve-${it.entity_id}`}>
              <Check /> Setujui
            </Button>
            <Button size="icon-sm" variant="outline" disabled={busy === `${it.entity_id}-reject`}
                    onClick={() => quickAction(it, "reject")}
                    className="text-rose-700 dark:text-rose-400 hover:text-rose-700"
                    aria-label={`Tolak ${itemTitle(it)}`}
                    title="Tolak"
                    data-testid={`cockpit-reject-${it.entity_id}`}>
              <X />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// /approvals/queue mengembalikan `title` (+ doc_no); `describe` dipertahankan sebagai fallback lama.
function itemTitle(it) {
  return it.title || it.describe || it.doc_no || it.label || "Dokumen";
}

export default function OwnerCockpit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activePreset, setActivePreset] = useState(DEFAULT_PRESET);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/owner/cockpit");
      setData(unwrap(r));
    } catch {
      toast.error("Gagal memuat cockpit");
    } finally { setLoading(false); }
  }

  // Load saved preset on mount (auto-restore last selection)
  useEffect(() => {
    api.get("/preferences/me")
      .then((r) => {
        const saved = unwrap(r)?.preferences?.dashboard_preset_owner;
        if (saved && PRESET_SECTIONS[saved]) setActivePreset(saved);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, []);

  async function sendDigestNow() {
    setSending(true);
    try {
      const r = await api.post("/owner/digest/send-now");
      const res = unwrap(r);
      toast.success(`Digest terkirim ke ${res.channels?.join(", ") || "in-app"}`);
    } catch (e) {
      toast.error("Gagal kirim digest");
    } finally { setSending(false); }
  }

  if (loading || !data) return (
    <div className="space-y-3 lg:space-y-4" data-testid="owner-cockpit-page">
      <LoadingState message="Memuat cockpit…" />
    </div>
  );

  const digest = data.digest || {};
  const cash = data.cash_position || {};
  const sections = PRESET_SECTIONS[activePreset] || PRESET_SECTIONS[DEFAULT_PRESET];

  const firstName = user?.full_name?.split(" ")[0] || user?.name?.split(" ")[0] || "Owner";

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="owner-cockpit-page">
      {/* Header */}
      <div data-testid="owner-welcome">
        <PageHeader
          icon={Crown}
          className="mb-0 md:mb-0"
          title={
            <span className="inline-flex items-center gap-2">
              Overview
              <InlineHelp id="owner-cockpit-kpi" size="xs" placement="right" />
            </span>
          }
          subtitle={`Selamat datang, ${firstName} — snapshot keuangan group hari ini, ${fmtDate(digest.date)}`}
          actions={
            <>
              <Button variant="outline" asChild data-testid="open-daily-briefing-btn">
                <Link to="/owner/briefing">
                  <Sparkles /> AI Daily Briefing
                </Link>
              </Button>
              <Button variant="outline" onClick={load} data-testid="owner-refresh">
                <RefreshCw /> Muat ulang
              </Button>
              <Button onClick={sendDigestNow} disabled={sending} data-testid="owner-send-digest">
                <Send /> {sending ? "Mengirim…" : "Kirim Digest"}
              </Button>
            </>
          }
        />
      </div>

      {/* Phase F3 — Dashboard preset selector */}
      <DashboardPresetSelector
        portal="owner"
        activePreset={activePreset}
        onSelect={setActivePreset}
      />

      {/* Top KPIs */}
      {sections.kpiRow && (
      <CollapsibleSection id="owner_kpi_cards" title="KPI Utama" icon={LayoutDashboard}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="owner-kpi-row">
          <CompactStatCard
            testId="owner-kpi-cash"
            label="Cash Position"
            value={fmtRp(cash.net_liquid_cash || 0)}
            icon={Wallet}
            color={cash.health === "red" ? "aurora-6" : cash.health === "amber" ? "aurora-5" : "aurora-4"}
            tone={cash.health === "red" ? "danger" : cash.health === "amber" ? "warning" : "default"}
            sub={cash.days_runway ? `${cash.days_runway} hari runway` : "Sehat"}
            onClick={() => navigate("/owner/cash")}
          />
          <CompactStatCard
            testId="owner-kpi-revenue"
            label="Revenue MTD"
            value={fmtRp(digest.mtd_revenue || 0)}
            icon={TrendingUp}
            color="aurora-2"
            sub={`Periode ${digest.mtd_period || "-"}`}
          />
          <CompactStatCard
            testId="owner-kpi-ap"
            label="AP 7 Hari"
            value={fmtRp(digest.ap_due_total || 0)}
            icon={Receipt}
            color="aurora-5"
            sub={`${digest.ap_due_count || 0} invoice jatuh tempo`}
          />
          <CompactStatCard
            testId="owner-kpi-anomalies"
            label="Anomali 24 Jam"
            value={digest.anomaly_count || 0}
            icon={AlertTriangle}
            color="aurora-6"
            tone={digest.anomaly_severe ? "danger" : "default"}
            sub={`${digest.anomaly_severe || 0} severe`}
            onClick={() => navigate("/finance/period-closing?phase=1")}
          />
        </div>
      </CollapsibleSection>
      )}

      {/* Mid: Cash widget + Digest preview */}
      {(sections.cashWidget || sections.digestPreview) && (
      <CollapsibleSection id="owner_cash_digest" title="Cash & Digest" icon={Wallet}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4" data-testid="owner-mid-row">
          {sections.cashWidget && (
          <div className={sections.digestPreview ? "lg:col-span-1" : "lg:col-span-3"}>
            <CashPositionWidget to="/owner/cash" />
          </div>
          )}

          {sections.digestPreview && (
          <div className={cn("glass-card p-4", sections.cashWidget ? "lg:col-span-2" : "lg:col-span-3")}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-semibold">Digest Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Yang akan dikirim ke channel Anda jam 06:00 WIB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild data-testid="cockpit-digest-settings-link">
                <Link to="/owner/digest-settings">Atur channel <ArrowRight /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Revenue kemarin per outlet</div>
              {digest.yesterday_by_outlet?.length ? (
                <ul className="divide-y divide-border/40">
                  {digest.yesterday_by_outlet.map((o) => (
                    <li key={o.outlet_id} className="flex items-center justify-between text-sm py-1.5">
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {o.outlet_name}
                      </span>
                      <span className="font-semibold tabular-nums whitespace-nowrap">{fmtRp(o.revenue)}
                        {o.transactions > 0 && <span className="text-xs font-normal text-muted-foreground ml-2">{fmtNumber(o.transactions)} trx</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground italic">Tidak ada data sales kemarin yang tervalidasi.</div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-sm font-semibold">
                <span>Total revenue kemarin</span>
                <span className="tabular-nums text-emerald-700 dark:text-emerald-400">{fmtRp(digest.yesterday_total || 0)}</span>
              </div>
            </div>
          </div>
          )}
        </div>
      </CollapsibleSection>
      )}

      {/* Pending approvals quick widget (Phase 11F) */}
      {sections.pendingApprovals && (
      <CollapsibleSection id="owner_pending_approvals" title="Approval Pending" icon={ClipboardCheck}>
        <PendingApprovalsWidget />
      </CollapsibleSection>
      )}

      {/* Bottom row: Anomalies + AI (kartu "Pending Approvals" dihapus — duplikat
          seksi Approval Pending di atas, yang selalu tampil di preset yang punya bottomRow) */}
      {sections.bottomRow && (
      <CollapsibleSection id="owner_bottom_row" title="Insights & Actions" icon={Bell}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4" data-testid="owner-bottom-row">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" /> Anomali 24 jam
            </h3>
            <Badge variant={digest.anomaly_severe ? "destructive" : "outline"}>
              {digest.anomaly_count || 0}
            </Badge>
          </div>
          {(digest.anomalies || []).length > 0 ? (
            <ul className="space-y-1.5 max-h-32 overflow-y-auto">
              {(digest.anomalies || []).slice(0, 3).map((a, i) => (
                <li key={i} className="text-xs text-muted-foreground line-clamp-2">
                  <span className={cn("font-semibold mr-1",
                    a.severity === "severe" ? "text-rose-700 dark:text-rose-400" : "text-amber-800 dark:text-amber-400")}>
                    {a.type}
                  </span>
                  {a.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Tidak ada anomali aktif.</p>
          )}
          <Button variant="outline" size="sm" asChild className="mt-3" data-testid="cockpit-open-anomaly-feed">
            <Link to="/finance/period-closing?phase=1">Buka Anomaly Feed <ArrowRight /></Link>
          </Button>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" /> Executive Q&amp;A
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Tanya AI: "Cash aman gak?", "Outlet mana yang drop?", "Top vendor bulan ini?"
          </p>
          <Button variant="outline" size="sm" asChild data-testid="cockpit-open-ai-assistant">
            <Link to="/executive/ai-qa">Buka Executive Q&amp;A <ArrowRight /></Link>
          </Button>
        </div>
      </div>
      </CollapsibleSection>
      )}
    </div>
  );
}
