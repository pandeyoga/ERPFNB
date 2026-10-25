/** ListHeader — header untuk list inventory yang bisa tampil berdiri sendiri (route sendiri,
 * mis. /inventory/transfers) ATAU tertanam sebagai tab di Stock Movements hub.
 *
 *  - berdiri sendiri → PageHeader (satu-satunya <h1> halaman)
 *  - embedded (tab)  → baris seksi ringkas: h2 + subtitle + aksi, tanpa kartu tambahan
 *    (hub sudah punya PageHeader + Tabs, jadi tidak ada judul ganda).
 */
import PageHeader from "@/components/shared/PageHeader";

export default function ListHeader({ embedded = false, icon, title, subtitle, actions }) {
  if (!embedded) {
    return <PageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} className="mb-0 md:mb-0" />;
  }
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <h2 className="text-base md:text-lg font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
