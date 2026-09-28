/** Phase 11C++ — System Settings UI for runtime config (Telegram token, Resend key, etc).
 * Used as embedded card in Owner DigestSettings + standalone page.
 */
import { useEffect, useState } from "react";
import {
  Settings, Eye, EyeOff, Save, RefreshCw, Trash2, CheckCircle2, XCircle,
  Globe, Database, FileWarning, ExternalLink,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmDialog } from "@/components/shared/confirmDialog";

const CATEGORY_LABEL = {
  telegram: "Telegram",
  email:    "Email (Resend)",
  digest:   "Digest",
  custom:   "Custom",
};

export default function SystemSettingsCard({ filterCategory = null, title = "System Settings" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [editing, setEditing] = useState({});  // { [key]: { value, show } }
  const [testResults, setTestResults] = useState({});

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/system-settings/list");
      const list = unwrap(r) || [];
      setItems(filterCategory ? list.filter(s => s.category === filterCategory) : list);
    } catch (e) {
      toast.error("Gagal load system settings");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterCategory]);

  function startEdit(key) {
    setEditing((s) => ({ ...s, [key]: { value: "", show: false } }));
  }
  function cancelEdit(key) {
    setEditing((s) => { const c = { ...s }; delete c[key]; return c; });
  }
  function setValue(key, value) {
    setEditing((s) => ({ ...s, [key]: { ...(s[key] || {}), value } }));
  }
  function toggleShow(key) {
    setEditing((s) => ({ ...s, [key]: { ...(s[key] || {}), show: !(s[key] && s[key].show) } }));
  }

  async function save(item) {
    const value = editing[item.key]?.value?.trim();
    if (!value) { toast.error("Value tidak boleh kosong"); return; }
    setBusyKey(item.key);
    try {
      await api.post("/system-settings/set", { key: item.key, value });
      toast.success(`${item.label} disimpan`);
      cancelEdit(item.key);
      // Auto-test telegram token
      if (item.key === "TELEGRAM_BOT_TOKEN") {
        await testTelegram();
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally { setBusyKey(null); }
  }

  async function remove(item) {
    if (!(await confirmDialog(`Hapus ${item.label}?`))) return;
    setBusyKey(item.key);
    try {
      await api.delete(`/system-settings/${item.key}`);
      toast.success("Setting dihapus");
      load();
    } finally { setBusyKey(null); }
  }

  async function testTelegram(ephemeralToken = null) {
    setBusyKey("test_telegram");
    try {
      const body = ephemeralToken ? { token: ephemeralToken } : {};
      const r = await api.post("/system-settings/test/telegram", body);
      const res = unwrap(r);
      setTestResults((s) => ({ ...s, telegram: res }));
      if (res.ok) {
        toast.success(`Bot @${res.bot?.username} aktif!`);
      } else {
        toast.error(res.reason || "Bot tidak terjangkau");
      }
    } catch {
      toast.error("Test bot gagal");
    } finally { setBusyKey(null); }
  }

  async function setupWebhook() {
    const baseHint = window.location.origin.replace(window.location.host, "").replace("//:", "//");
    const url = window.prompt(
      "Masukkan public backend URL (mis. https://app.example.com). Path '/api/telegram/webhook' akan otomatis ditambahkan.",
      baseHint || "",
    );
    if (!url) return;
    setBusyKey("setup_webhook");
    try {
      const r = await api.post("/system-settings/telegram/set-webhook", { url });
      const res = unwrap(r);
      if (res.ok) {
        toast.success(`Webhook terdaftar: ${res.url}`);
        load();
      } else {
        toast.error(res.reason || res.description || "Set webhook gagal");
      }
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Set webhook gagal");
    } finally { setBusyKey(null); }
  }

  if (loading) return <LoadingState message="Loading settings…" />;

  // Group by category for display
  const byCategory = items.reduce((acc, it) => {
    const c = it.category || "custom";
    (acc[c] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-9 w-9 rounded-xl bg-aurora-3/15 text-aurora-3 flex items-center justify-center">
            <Settings className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">
              Nilai disimpan di database, override env. Disimpan tersembunyi (mask).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {Object.entries(byCategory).map(([cat, list]) => (
        <div key={cat} className="mb-4 last:mb-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            {CATEGORY_LABEL[cat] || cat}
          </div>
          <ul className="space-y-2.5">
            {list.map((item) => {
              const isEditing = !!editing[item.key];
              const isTelegram = item.key === "TELEGRAM_BOT_TOKEN";
              const tgRes = testResults.telegram;
              return (
                <li key={item.key} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{item.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{item.key}</span>
                        {item.is_secret && <Badge variant="outline" className="text-[10px]">secret</Badge>}
                        {item.is_set ? (
                          <Badge variant="default" className="text-[10px] gap-1">
                            {item.source === "database" ? <Database className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                            {item.source}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                            <FileWarning className="h-3 w-3 mr-1" /> belum diset
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      {item.is_set && !isEditing && (
                        <div className="text-xs mt-2">
                          <span className="text-muted-foreground">Saved:</span>{" "}
                          <span className="font-mono">{item.value_masked}</span>
                          {item.updated_at && (
                            <span className="ml-2 text-muted-foreground">
                              • {fmtDateTime(item.updated_at)} {item.updated_by ? `by user` : ""}
                            </span>
                          )}
                        </div>
                      )}
                      {isTelegram && tgRes && (
                        <div className={cn("text-xs mt-2 inline-flex items-center gap-1 px-2 py-1 rounded",
                          tgRes.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                          {tgRes.ok
                            ? <><CheckCircle2 className="h-3 w-3" /> Connected: @{tgRes.bot?.username || "bot"}</>
                            : <><XCircle className="h-3 w-3" /> {tgRes.reason || "failed"}</>}
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 space-y-2">
                      <Label className="text-xs">Nilai baru</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type={editing[item.key]?.show ? "text" : (item.is_secret ? "password" : "text")}
                          value={editing[item.key]?.value || ""}
                          onChange={(e) => setValue(item.key, e.target.value)}
                          placeholder={item.placeholder}
                          className="flex-1 font-mono text-xs"
                          data-testid={`setting-input-${item.key}`}
                        />
                        {item.is_secret && (
                          <Button type="button" variant="outline" size="icon" onClick={() => toggleShow(item.key)}>
                            {editing[item.key]?.show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => save(item)}
                          disabled={busyKey === item.key || !editing[item.key]?.value?.trim()}
                          className="gap-1"
                          data-testid={`setting-save-${item.key}`}
                        >
                          <Save className="h-3.5 w-3.5" /> Simpan & Verify
                        </Button>
                        {isTelegram && editing[item.key]?.value && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => testTelegram(editing[item.key].value)}
                            className="gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Test (no save)
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => cancelEdit(item.key)}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline"
                              onClick={() => startEdit(item.key)}
                              data-testid={`setting-edit-${item.key}`}>
                        {item.is_set ? "Update" : "Set"}
                      </Button>
                      {item.is_set && item.source === "database" && (
                        <Button size="sm" variant="ghost" onClick={() => remove(item)}
                                disabled={busyKey === item.key}
                                className="text-rose-600 hover:text-rose-700 gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Reset
                        </Button>
                      )}
                      {isTelegram && item.is_set && (
                        <>
                          <Button size="sm" variant="outline"
                                  onClick={() => testTelegram()}
                                  disabled={busyKey === "test_telegram"}
                                  className="gap-1"
                                  data-testid="setting-test-telegram">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                          </Button>
                          <Button size="sm" variant="outline"
                                  onClick={setupWebhook}
                                  disabled={busyKey === "setup_webhook"}
                                  className="gap-1"
                                  data-testid="setting-setup-webhook">
                            <ExternalLink className="h-3.5 w-3.5" /> Setup Webhook
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
