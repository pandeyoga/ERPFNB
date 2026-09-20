/** Phase 12D — Integration status pill (Connected / Not Configured / Failed / Fallback). */
import { CheckCircle2, XCircle, AlertCircle, Globe, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  configured:    { icon: CheckCircle2, label: "Connected",      tone: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  unset:         { icon: AlertCircle,  label: "Not Configured",  tone: "bg-amber-100 text-amber-700 border-amber-300" },
  failed:        { icon: XCircle,      label: "Failed",          tone: "bg-rose-100 text-rose-700 border-rose-300" },
  fallback:      { icon: Globe,        label: "Using fallback",  tone: "bg-blue-100 text-blue-700 border-blue-300" },
  database:      { icon: Database,     label: "Database",        tone: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  environment:   { icon: Globe,        label: "Environment",     tone: "bg-slate-100 text-slate-700 border-slate-300" },
};

export default function IntegrationStatusPill({ status, label, className, size = "md" }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unset;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        config.tone,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label || config.label}
    </span>
  );
}
