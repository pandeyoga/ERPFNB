/** PageHeader — SATU-SATUNYA judul halaman (<h1>) di area konten.
 *
 * Token mengikuti design_guidelines.md (typography_scale.page_header_changes):
 * title `text-xl md:text-2xl font-semibold`, subtitle `text-xs md:text-sm`, ikon
 * 32px, jarak bawah `mb-3 md:mb-4`. Breadcrumb lokasi sudah ada di TopNav, jadi
 * halaman tidak perlu breadcrumb/judul tambahan di atas PageHeader.
 *
 * Props:
 *  - icon, title, subtitle
 *  - actions (alias lama: action) — tombol aksi halaman, rata kanan
 *  - children — baris tambahan di bawah judul (mis. chip filter/status)
 */
import { cn } from "@/lib/utils";

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  actions,
  children,
  colorClass = "grad-aurora",
  className,
  testId = "page-header",
}) {
  const slot = actions ?? action;
  return (
    <div className={cn("mb-3 md:mb-4", className)} data-testid={testId}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className={cn("h-8 w-8 rounded-[calc(var(--radius)-2px)] flex items-center justify-center shrink-0", colorClass)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold leading-[1.2] tracking-[-0.015em] truncate" data-testid="page-header-title">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-muted-foreground leading-[1.3] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {slot && <div className="flex items-center gap-2 flex-wrap shrink-0 ml-auto">{slot}</div>}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
