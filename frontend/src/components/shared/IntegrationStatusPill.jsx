/** Phase 12D — Integration status pill (Terhubung / Belum dikonfigurasi / Gagal / Memakai fallback). */
import { CheckCircle2, XCircle, AlertCircle, Globe, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  configured:    { icon: CheckCircle2, label: "Terhubung",      tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border-emerald-500/30" },
  unset:         { icon: AlertCircle,  label: "Belum dikonfigurasi", tone: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30" },
  failed:        { icon: XCircle,      label: "Gagal",           tone: "bg-rose-500/15 text-rose-800 dark:text-rose-400 border-rose-500/30" },
  fallback:      { icon: Globe,        label: "Memakai fallback", tone: "bg-blue-500/15 text-blue-800 dark:text-blue-400 border-blue-500/30" },
  database:      { icon: Database,     label: "Database",        tone: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-400 border-indigo-500/30" },
  environment:   { icon: Globe,        label: "Environment",     tone: "bg-muted/40 text-foreground border-border" },
};

export default function IntegrationStatusPill({ status, label, className, size = "md" }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unset;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        config.tone,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label || config.label}
    </span>
  );
}
