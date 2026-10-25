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
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="space-y-3" data-testid="admin-integrations-page">
      <div data-testid="admin-integrations-header">
        <PageHeader
          icon={Plug}
          title="Integrations"
          subtitle="Atur API key & kredensial (Telegram, WhatsApp, Email, AI, dll). Semua nilai rahasia disimpan terenkripsi."
        />

        {/* Tab strip — gaya Tabs standar; angka = jumlah setting terisi / total */}
        <Tabs value={activeTab.id} onValueChange={goTab}>
          <TabsList data-testid="admin-integrations-tabs">
            {TABS.map((t) => {
              const Icon = t.icon;
              const stat = tabStatuses[t.id] || { total: 0, set: 0 };
              const complete = stat.total > 0 && stat.set === stat.total;
              return (
                <TabsTrigger key={t.id} value={t.id} data-testid={`integration-tab-${t.id}`}>
                  <Icon /> {t.label}
                  {stat.total > 0 && (
                    <span
                      className={cn(
                        "px-1.5 rounded-full text-[11px] tabular-nums bg-foreground/10",
                        complete && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                      )}
                      title={`${stat.set} dari ${stat.total} setting terisi`}
                    >
                      {stat.set}/{stat.total}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 lg:gap-4 items-start" data-testid="integration-content">
          <div className="xl:col-span-2" data-testid="integration-settings-list">
            {filteredItems.length === 0 ? (
              <EmptyState
                title="Belum ada setting di kategori ini"
                description="Buka tab 'Lainnya' untuk melihat setting custom, atau cek dokumentasi."
              />
            ) : (
              <IntegrationSettingsList
                items={filteredItems}
                onChange={() => setReloadKey((k) => k + 1)}
              />
            )}
          </div>
          <div className="space-y-3">
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
