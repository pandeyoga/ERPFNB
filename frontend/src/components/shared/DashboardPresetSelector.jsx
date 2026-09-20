/**
 * DashboardPresetSelector — Sprint F Phase 3
 * A compact preset picker bar used by Owner Cockpit and Executive Dashboard.
 *
 * Usage:
 *   <DashboardPresetSelector
 *     portal="owner"          // "owner" | "executive"
 *     activePreset={preset}
 *     onSelect={(preset) => handlePresetChange(preset)}
 *   />
 */
import { useState, useEffect } from "react";
import { LayoutDashboard, TrendingUp, Wallet, Settings, BarChart3, Award, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import api from "@/lib/api";

const ICON_MAP = {
  LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  Wallet: <Wallet className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  Award: <Award className="h-4 w-4" />,
  AlertTriangle: <AlertTriangle className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
};

export default function DashboardPresetSelector({ portal, activePreset, onSelect }) {
  const [presets, setPresets] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/preferences/presets/${portal}`)
      .then(r => setPresets(r.data.data || []))
      .catch(() => {});
  }, [portal]);

  const handleSelect = async (preset) => {
    if (activePreset === preset.id) return;
    setSaving(true);
    try {
      await api.post("/preferences/dashboard-preset", { portal, preset_id: preset.id });
      onSelect?.(preset.id);
    } catch {
      toast.error("Gagal menyimpan preset");
    } finally {
      setSaving(false);
    }
  };

  if (!presets.length) return null;

  return (
    <TooltipProvider>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-1.5"
        data-testid="dashboard-preset-selector"
        role="group"
        aria-label="Dashboard layout preset"
      >
        <span className="px-2 text-xs font-medium text-muted-foreground hidden sm:block">Layout:</span>
        {presets.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <Tooltip key={preset.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 gap-1.5 text-xs transition-all ${
                    isActive
                      ? "shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handleSelect(preset)}
                  disabled={saving}
                  data-testid={`preset-btn-${preset.id}`}
                >
                  {ICON_MAP[preset.icon] || <LayoutDashboard className="h-4 w-4" />}
                  <span className="hidden sm:inline">{preset.name}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
