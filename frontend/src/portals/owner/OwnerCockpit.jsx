/** Phase 11C — Owner Cockpit landing.
 * Top: 4 KPIs (Cash, MTD Revenue, AP 7d, Anomalies)
 * Mid:  Cash Position widget + Today's digest preview
 * Bot:  Yesterday revenue per outlet + Pending approvals + AI Assistant CTA
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, TrendingUp, ClipboardCheck, AlertTriangle, ArrowRight,
  RefreshCw, Bell, MessageSquareText, Send, Building2, Receipt, FileText,
  Check, X, LayoutDashboard, Sparkles,
} from "lucide-react";
import { InlineHelp } from "@/components/shared/InlineHelp";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
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
    setBusy(`${item.entity_id}-${action}`);
    try {
      const body = { entity_type: item.entity_type, entity_id: item.entity_id, action };
      if (action === "reject") body.reason = "Owner reject from cockpit";
      await api.post("/approvals/quick-action", body);
      toast.success(`${action === "approve" ? "Approved" : "Rejected"} \u2014 ${item.describe}`);
      setItems((arr) => arr.filter(x => x.entity_id !== item.entity_id));
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || `Gagal ${action}`);
    } finally { setBusy(null); }
  }

  if (loading) return <div className="glass-card p-5 h-32 animate-pulse" />;
  if (!items.length) {
    return (
      <div className="glass-card p-5 text-sm text-muted-foreground italic">
        ✨ Tidak ada approval menunggu sekarang.
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" /> Approval Pending (Top 5)
        </h3>
        <Link to="/owner/approvals" className="text-xs text-primary hover:underline">
          Buka semua →
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.entity_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{it.describe}</div>
              <div className="text-xs text-muted-foreground truncate">
                {it.label} • {it.tier_label || it.step_label} • {fmtRelative(it.submitted_at || it.created_at)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-muted-foreground">{it.amount_label}</div>
              <div className="font-bold font-mono">{fmtRp(it.amount || 0)}</div>
            </div>
            <Button size="sm" disabled={busy === `${it.entity_id}-approve`}
                    onClick={() => quickAction(it, "approve")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 min-h-[40px]"
                    data-testid={`cockpit-approve-${it.entity_id}`}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy === `${it.entity_id}-reject`}
                    onClick={() => quickAction(it, "reject")}
                    className="border-rose-300 text-rose-600 hover:bg-rose-50 gap-1 min-h-[40px]"
                    data-testid={`cockpit-reject-${it.entity_id}`}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OwnerCockpit() {
  const { user } = useAuth();
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
      toast.error("Gagal load cockpit");
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
    <div className="space-y-6" data-testid="owner-cockpit-page">
      <LoadingState message="Loading owner cockpit…" />
    </div>
  );

  const digest = data.digest || {};
  const cash = data.cash_position || {};
  const sections = PRESET_SECTIONS[activePreset] || PRESET_SECTIONS[DEFAULT_PRESET];

  return (
    <div className="space-y-6" data-testid="owner-cockpit-page">
      {/* Welcome strip */}
      <div className="glass-card p-6 lg:p-8 grad-aurora-soft" data-testid="owner-welcome">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
              Selamat datang, {user?.full_name?.split(" ")[0]} 👋
              <InlineHelp id="owner-cockpit-kpi" size="xs" placement="right" />
            </h2>
            <p className="text-sm text-muted-foreground">
              Snapshot keuangan group hari ini — {fmtDate(digest.date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1" data-testid="open-daily-briefing-btn">
              <Link to="/owner/briefing">
                <Sparkles className="h-3.5 w-3.5" /> Daily Briefing AI
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={load} className="gap-1" data-testid="owner-refresh">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={sendDigestNow} disabled={sending}
                    className="gap-1" data-testid="owner-send-digest">
              <Send className="h-3.5 w-3.5" /> {sending ? "Mengirim…" : "Kirim Digest Sekarang"}
            </Button>
          </div>
        </div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="owner-kpi-row">
          <KpiCard
            label="Cash Position"
            value={fmtRp(cash.net_liquid_cash || 0)}
            icon={Wallet}
            color={cash.health === "red" ? "danger" : cash.health === "amber" ? "warning" : "success"}
            hint={cash.days_runway ? `${cash.days_runway} hari runway` : "Healthy"}
            onClick={() => window.location.assign("/owner/cash")}
            data-testid="owner-kpi-cash"
          />
          <KpiCard
            label="Revenue MTD"
            value={fmtRp(digest.mtd_revenue || 0)}
            icon={TrendingUp}
            color="aurora-2"
            hint={`Period ${digest.mtd_period || "-"}`}
            data-testid="owner-kpi-revenue"
          />
          <KpiCard
            label="AP 7 Hari"
            value={fmtRp(digest.ap_due_total || 0)}
            icon={Receipt}
            color="aurora-4"
            hint={`${digest.ap_due_count || 0} invoice`}
            data-testid="owner-kpi-ap"
          />
          <KpiCard
            label="Anomalies 24h"
            value={digest.anomaly_count || 0}
            icon={AlertTriangle}
            color={digest.anomaly_severe ? "danger" : "aurora-6"}
            hint={`${digest.anomaly_severe || 0} severe`}
            onClick={() => window.location.assign("/finance/anomalies")}
            data-testid="owner-kpi-anomalies"
          />
        </div>
      </CollapsibleSection>
      )}

      {/* Mid: Cash widget + Digest preview */}
      {(sections.cashWidget || sections.digestPreview) && (
      <CollapsibleSection id="owner_cash_digest" title="Cash & Digest" icon={Wallet}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" data-testid="owner-mid-row">
          {sections.cashWidget && (
          <div className={sections.digestPreview ? "lg:col-span-1" : "lg:col-span-3"}>
            <CashPositionWidget to="/owner/cash" />
          </div>
          )}

          {sections.digestPreview && (
          <div className={cn("glass-card p-5", sections.cashWidget ? "lg:col-span-2" : "lg:col-span-3")}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="h-9 w-9 rounded-xl bg-aurora-3/15 text-aurora-3 flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-semibold">Digest Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Yang akan dikirim ke channel Anda jam 06:00 WIB
                  </p>
                </div>
              </div>
              <Link to="/owner/digest-settings" className="text-xs text-primary hover:underline">
                Atur channel →
              </Link>
            </div>
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">Yesterday revenue per outlet</div>
              {digest.yesterday_by_outlet?.length ? (
                <ul className="space-y-1.5">
                  {digest.yesterday_by_outlet.map((o) => (
                    <li key={o.outlet_id} className="flex items-center justify-between text-sm py-1.5">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {o.outlet_name}
                      </span>
                      <span className="font-mono font-semibold">{fmtRp(o.revenue)}
                        <span className="text-[10px] text-muted-foreground ml-2">{o.transactions} txn</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground italic">Tidak ada data sales kemarin yang tervalidasi.</div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-border/50 text-sm font-semibold">
                <span>Total revenue kemarin</span>
                <span className="font-mono text-emerald-700">{fmtRp(digest.yesterday_total || 0)}</span>
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

      {/* Bottom row: Approvals + Anomalies + AI */}
      {sections.bottomRow && (
      <CollapsibleSection id="owner_bottom_row" title="Insights & Actions" icon={Bell}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" data-testid="owner-bottom-row">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" /> Pending Approvals
            </h3>
            <Badge variant={digest.pending_approvals ? "default" : "outline"}>
              {digest.pending_approvals || 0}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {digest.pending_approvals
              ? `${digest.pending_approvals} item menunggu approval Anda.`
              : "Semua approval sudah selesai ✨"}
          </p>
          <Link to="/owner/approvals">
            <Button variant="outline" size="sm" className="w-full gap-1">
              Buka Inbox <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Anomalies
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
                    a.severity === "severe" ? "text-rose-600" : "text-amber-600")}>
                    {a.type}
                  </span>
                  {a.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Tidak ada anomaly aktif ✨</p>
          )}
          <Link to="/finance/anomalies">
            <Button variant="outline" size="sm" className="w-full gap-1 mt-3">
              Buka Feed <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" /> Tanya FnB ERP AI
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            "Cash aman gak?", "Outlet mana yg drop?", "Top vendor bulan ini?"
          </p>
          <Link to="/owner/ai-assistant">
            <Button size="sm" className="w-full gap-1">
              Buka Chat <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
      </CollapsibleSection>
      )}
    </div>
  );
}
