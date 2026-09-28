/** PreferencesDialog — user appearance & session preferences.
 * Replaces the dead "Preferences" placeholder in UserMenu.
 */
import { useState } from "react";
import { Settings as SettingsIcon, Sun, Moon, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

export default function PreferencesDialog({ open, onOpenChange }) {
  const { theme, setTheme } = useTheme();
  const [rememberPortal, setRememberPortal] = useState(
    () => localStorage.getItem("aurora_remember_last_portal") !== "false"
  );

  const themes = [
    { id: "light", label: "Terang", icon: Sun },
    { id: "dark", label: "Gelap", icon: Moon },
  ];

  function toggleRemember(v) {
    setRememberPortal(v);
    localStorage.setItem("aurora_remember_last_portal", String(v));
    toast.success(v ? "Beranda akan membuka modul terakhir yang Anda kunjungi" : "Beranda akan membuka modul default Anda");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="preferences-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> Preferensi
          </DialogTitle>
          <DialogDescription>Sesuaikan tampilan & perilaku aplikasi.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Theme */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Tema Tampilan</Label>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((t) => {
                const Icon = t.icon;
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`relative flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "border-foreground/40 bg-foreground/[0.06] font-semibold"
                        : "border-border hover:bg-foreground/[0.03] text-muted-foreground"
                    }`}
                    data-testid={`pref-theme-${t.id}`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                    {active && <Check className="h-4 w-4 ml-auto text-green-600 dark:text-green-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remember last portal */}
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div className="pr-3">
              <div className="text-sm font-medium">Ingat Modul Terakhir</div>
              <div className="text-xs text-muted-foreground">Beranda langsung membuka modul terakhir yang Anda kunjungi.</div>
            </div>
            <Switch checked={rememberPortal} onCheckedChange={toggleRemember} data-testid="pref-remember-portal" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="preferences-close">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
