/** Phase 12D — Generic editor list for system_settings items.
 * Reused inside Integrations Hub tabs.
 */
import { useState } from "react";
import { Eye, EyeOff, Save, Trash2, Edit3, FileWarning } from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import IntegrationStatusPill from "./IntegrationStatusPill";
import { fmtDateTime } from "@/lib/format";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function IntegrationSettingsList({ items, onChange }) {
  const [editing, setEditing] = useState({});
  const [busyKey, setBusyKey] = useState(null);

  function startEdit(item) {
    setEditing((s) => ({ ...s, [item.key]: { value: "", show: false } }));
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
      toast.success(`${item.label} disimpan${item.is_secret ? " (terenkripsi)" : ""}`);
      cancelEdit(item.key);
      onChange?.();
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
      onChange?.();
    } finally { setBusyKey(null); }
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const isEditing = !!editing[item.key];
        const status = !item.is_set ? "unset" : (item.source === "database" ? "database" : "environment");
        return (
          <li key={item.key} className="glass-card p-4" data-testid={`integration-row-${item.key}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm">{item.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{item.key}</span>
                  {item.is_secret && <Badge variant="outline" className="text-[10px]">secret</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <IntegrationStatusPill status={status} size="sm" />
            </div>

            {item.is_set && !isEditing && (
              <div className="text-xs mb-3 px-3 py-2 rounded bg-muted/40 inline-flex items-center gap-2">
                <span className="text-muted-foreground">Saved:</span>
                <span className="font-mono">{item.value_masked}</span>
                {item.updated_at && (
                  <span className="text-muted-foreground">• {fmtDateTime(item.updated_at)}</span>
                )}
              </div>
            )}

            {!item.is_set && !isEditing && (
              <div className="text-xs mb-3 inline-flex items-center gap-1 text-amber-700">
                <FileWarning className="h-3 w-3" /> Belum dikonfigurasi
              </div>
            )}

            {isEditing ? (
              <div className="space-y-2 mt-2">
                <Label className="text-xs">Nilai baru</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={editing[item.key]?.show || !item.is_secret ? "text" : "password"}
                    value={editing[item.key]?.value || ""}
                    onChange={(e) => setValue(item.key, e.target.value)}
                    placeholder={item.placeholder}
                    className="flex-1 font-mono text-xs"
                    data-testid={`integration-input-${item.key}`}
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
                    data-testid={`integration-save-${item.key}`}
                  >
                    <Save className="h-3.5 w-3.5" /> Simpan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelEdit(item.key)}>Batal</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => startEdit(item)}
                        data-testid={`integration-edit-${item.key}`} className="gap-1">
                  <Edit3 className="h-3.5 w-3.5" /> {item.is_set ? "Update" : "Set"}
                </Button>
                {item.is_set && item.source === "database" && (
                  <Button size="sm" variant="ghost" onClick={() => remove(item)}
                          disabled={busyKey === item.key}
                          className="text-rose-600 hover:text-rose-700 gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Reset
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
