/** Phase 12D \u2014 Admin Integrations Hub.
 *
 * Single page where admin manages ALL external integrations:
 *  - Telegram (bot token + webhook)
 *  - Email (Resend)
 *  - AI / LLM (Emergent universal + direct provider keys)
 *  - WhatsApp (Fonnte / Twilio / Meta)
 *  - App Branding (name, logo, color)
 *  - Custom (anything else)
 *
 * Uses the system_settings backend (Phase 11C+/12C) which now also encrypts
 * secrets at rest (Phase 12B).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Plug, MessageSquare, Mail, Brain, Phone, Palette, Wrench,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import api, { unwrap } from "@/lib/api";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import IntegrationStatusPill from "@/components/shared/IntegrationStatusPill";
import IntegrationSettingsList from "@/components/shared/IntegrationSettingsList";
import TelegramTestPanel from "./integrations/TelegramTestPanel";
import EmailTestPanel from "./integrations/EmailTestPanel";
import LlmTestPanel from "./integrations/LlmTestPanel";
import WhatsAppTestPanel from "./integrations/WhatsAppTestPanel";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "telegram",  label: "Telegram",   icon: MessageSquare, category: "telegram" },
  { id: "whatsapp",  label: "WhatsApp",   icon: Phone,         category: "whatsapp" },
  { id: "email",     label: "Email",      icon: Mail,          category: "email" },
  { id: "ai",        label: "AI / LLM",   icon: Brain,         category: "ai" },
  { id: "branding",  label: "Branding",   icon: Palette,       category: "branding" },
  { id: "custom",    label: "Lainnya",    icon: Wrench,        category: null },
];

export default function Integrations() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/system-settings/list");
      setItems(unwrap(r) || []);
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [reloadKey]);

  const filteredItems = useMemo(() => {
    if (activeTab.category === null) {
      // Custom = anything not in the known categories
      const known = new Set(TABS.filter(t => t.category).map(t => t.category));
      return items.filter((it) => !known.has(it.category));
    }
    return items.filter((it) => it.category === activeTab.category);
  }, [items, activeTab]);

  const tabStatuses = useMemo(() => {
    const status = {};
    TABS.forEach((t) => {
      const list = t.category === null
        ? items.filter((it) => !TABS.find((x) => x.category === it.category))
        : items.filter((it) => it.category === t.category);
      const total = list.length;
      const set = list.filter((it) => it.is_set).length;
      status[t.id] = { total, set };
    });
    return status;
  }, [items]);

  const goTab = (id) => navigate(`/admin/integrations/${id}`);

  return (
    <div data-testid="admin-integrations-page">
      <div className="glass-card p-5 mb-5" data-testid="admin-integrations-header">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center text-white">
            <Plug className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">Integrations Hub</h2>
            <p className="text-xs text-muted-foreground">
              Atur API keys & credentials (Telegram, WhatsApp, Email, AI, dll) langsung dari sini.
              Semua nilai rahasia disimpan terenkripsi.
            </p>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin" data-testid="admin-integrations-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab.id === t.id;
            const stat = tabStatuses[t.id] || { total: 0, set: 0 };
            return (
              <button
                key={t.id}
                onClick={() => goTab(t.id)}
                data-testid={`integration-tab-${t.id}`}
                className={cn(
                  "px-3.5 py-2 rounded-full text-sm flex items-center gap-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {stat.total > 0 && (
                  <span className={cn(
                    "px-1.5 rounded-full text-[10px] font-mono",
                    isActive ? "bg-background/20" : "bg-muted",
                    stat.set === stat.total && stat.total > 0 && !isActive && "bg-emerald-100 text-emerald-700",
                  )}>
                    {stat.set}/{stat.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5" data-testid="integration-content">
          <div className="xl:col-span-2" data-testid="integration-settings-list">
            {filteredItems.length === 0 ? (
              <EmptyState
                title="Belum ada setting di kategori ini"
                description="Pakai tab 'Lainnya' untuk lihat custom settings, atau cek dokumentasi."
              />
            ) : (
              <IntegrationSettingsList
                items={filteredItems}
                onChange={() => setReloadKey((k) => k + 1)}
              />
            )}
          </div>
          <div className="space-y-5">
            {/* Right rail: per-tab test panel */}
            {activeTab.id === "telegram" && <TelegramTestPanel onReload={() => setReloadKey((k) => k + 1)} />}
            {activeTab.id === "whatsapp" && <WhatsAppTestPanel onReload={() => setReloadKey((k) => k + 1)} />}
            {activeTab.id === "email" && <EmailTestPanel onReload={() => setReloadKey((k) => k + 1)} />}
            {activeTab.id === "ai" && <LlmTestPanel onReload={() => setReloadKey((k) => k + 1)} />}
            {(activeTab.id === "branding" || activeTab.id === "custom") && (
              <div className="glass-card p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                  <IntegrationStatusPill status={tabStatuses[activeTab.id]?.set > 0 ? "configured" : "unset"} />
                  <span>{activeTab.label}</span>
                </div>
                <p className="text-xs">
                  {activeTab.id === "branding"
                    ? "Setting branding tampil di header app, email signature, dan PDF export."
                    : "Custom settings yang Anda buat lewat API atau migration tools."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
