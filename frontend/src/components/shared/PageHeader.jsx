/** PageHeader — consistent portal page title with icon + optional subtitle + action slot. */
import { cn } from "@/lib/utils";

export default function PageHeader({ icon: Icon, title, subtitle, action, colorClass = "grad-aurora" }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap mb-3 lg:mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className={cn("h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0", colorClass)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 ml-auto">{action}</div>}
    </div>
  );
}
