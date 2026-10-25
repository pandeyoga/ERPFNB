/** Report Center (/reports) — katalog laporan Excel lintas modul.
 *  Metadata (nama, ikon, deskripsi, route) ada di reportCatalog.js dan juga dipakai
 *  oleh judul tiap halaman laporan, sehingga katalog & halaman selalu konsisten. */
import { Link } from "react-router-dom";
import { FileSpreadsheet, ArrowRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import { REPORT_CATEGORIES } from "./reportCatalog";

export default function ReportsCatalog() {
  const { user } = useAuth();
  // Laporan dengan `perms` (mis. Custom Report Builder di Finance) hanya ditampilkan
  // bila user boleh membukanya — sebelumnya kartu tetap tampil lalu berujung /no-access.
  const categories = REPORT_CATEGORIES
    .map((c) => ({ ...c, reports: c.reports.filter((r) => !r.perms || permitted(user, r.perms)) }))
    .filter((c) => c.reports.length > 0);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="reports-catalog">
      <div data-testid="reports-catalog-header">
        <PageHeader
          icon={FileSpreadsheet}
          title={<span data-testid="reports-catalog-title">Report Center</span>}
          subtitle="Ekspor laporan Excel lintas modul. Pilih laporan, atur filter, lalu ekspor."
        />
      </div>

      <div className="space-y-4 lg:space-y-5" data-testid="reports-category-grid">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <section key={category.id} className="space-y-2" data-testid={`report-category-${category.id}`} aria-labelledby={`report-cat-${category.id}`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 id={`report-cat-${category.id}`} className="text-base md:text-lg font-semibold inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {category.name}
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground">{category.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.reports.map((report) => {
                  const RIcon = report.icon;
                  return (
                    <Link
                      key={report.id}
                      to={report.route}
                      className="glass-card group p-3 flex items-start gap-3 transition-[box-shadow,border-color] hover:shadow-md hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid={`report-card-${report.id}`}
                    >
                      <div className="h-9 w-9 shrink-0 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center">
                        <RIcon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm md:text-base font-semibold leading-tight">{report.name}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{report.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
