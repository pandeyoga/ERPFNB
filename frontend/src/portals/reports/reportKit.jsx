/** reportKit — SATU layout untuk semua halaman laporan Excel di Report Center.
 *
 * Setiap halaman /reports/* = PageHeader (ikon + judul + subtitle dari reportCatalog)
 * → satu Card "Filter" berisi field berlabel (h-9) → footer dengan satu tombol utama
 * "Ekspor Excel". Laporan ini tidak punya pratinjau di layar; bila ada halaman on-screen
 * yang setara (mis. Inventory › Stock Balance) tombol "Lihat di layar" ditampilkan di
 * PageHeader (hanya bila user punya izinnya).
 */
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Monitor } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getReport } from "./reportCatalog";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Tanggal ISO (YYYY-MM-DD) n hari yang lalu — default "Dari tanggal". */
export function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Validasi rentang tanggal/periode sebelum ekspor. */
export function validRange(from, to, msg = "Tanggal awal tidak boleh setelah tanggal akhir") {
  if (from && to && from > to) {
    toast.error(msg);
    return false;
  }
  return true;
}

/** Pesan error dari response blob (axios responseType "blob" membungkus JSON error). */
async function errorMessage(e) {
  const data = e?.response?.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const j = JSON.parse(await data.text());
      return j?.errors?.[0]?.message || j?.message || j?.detail || e.message;
    } catch {
      /* bukan JSON */
    }
  }
  return data?.errors?.[0]?.message || data?.message || e?.message || "Terjadi kesalahan";
}

/** Hook ekspor: `const [exporting, exportExcel] = useExcelExport();`
 *  `exportExcel({ path, params: URLSearchParams, filename })` mengunduh file .xlsx. */
export function useExcelExport() {
  const [exporting, setExporting] = useState(false);
  const run = useCallback(async ({ path, params, filename }) => {
    setExporting(true);
    try {
      const qs = params ? params.toString() : "";
      const response = await api.get(qs ? `${path}?${qs}` : path, { responseType: "blob" });
      const blob = new Blob([response.data], { type: XLSX_MIME });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Laporan Excel berhasil diunduh");
    } catch (e) {
      toast.error(`Gagal mengekspor laporan: ${await errorMessage(e)}`);
    } finally {
      setExporting(false);
    }
  }, []);
  return [exporting, run];
}

/** Layout halaman laporan. */
export function ReportPage({
  reportId,
  testId,
  titleTestId,
  filterTestId,
  exportTestId,
  onExport,
  exporting = false,
  children,
  after,
}) {
  const meta = getReport(reportId) || {};
  const { user } = useAuth();
  const related = meta.related && permitted(user, meta.related.perms) ? meta.related : null;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid={testId}>
      <PageHeader
        icon={meta.icon}
        title={<span data-testid={titleTestId}>{meta.title}</span>}
        subtitle={meta.description}
        actions={
          <>
            <Button asChild variant="ghost" data-testid="report-back-to-catalog">
              <Link to="/reports"><ArrowLeft /> Report Center</Link>
            </Button>
            {related && (
              <Button asChild variant="outline" data-testid="report-view-onscreen">
                <Link to={related.to} title={`Lihat data ${related.label} langsung di layar`}>
                  <Monitor /> Buka {related.label}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Card data-testid={filterTestId}>
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm md:text-base font-semibold">Filter</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Atur filter, lalu ekspor. Filter yang dikosongkan berarti semua data.
          </p>
        </div>
        <div className="px-4 pb-4 space-y-4">{children}</div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">Laporan diunduh sebagai file Excel (.xlsx).</p>
          <Button onClick={onExport} disabled={exporting} data-testid={exportTestId}>
            <Download /> {exporting ? "Mengekspor…" : "Ekspor Excel"}
          </Button>
        </div>
      </Card>

      {after}
    </div>
  );
}

/** Grid field filter: 1 kolom di mobile, 2 di sm, 4 di lg. */
export function FilterGrid({ children, className }) {
  return <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3", className)}>{children}</div>;
}

/** Field berlabel. `id` dipakai untuk <Label htmlFor> → kontrol (Input / SelectTrigger). */
export function ReportField({ id, label, required = false, hint, className, children }) {
  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label htmlFor={id} className="text-xs md:text-sm font-medium">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Multi-pilih berbentuk chip (outlet / vendor / brand / kategori).
 *  options: [{ value, label, raw }]; value: string[]; testIdFor(option) → data-testid. */
export function ChipMultiSelect({ id, label, icon: Icon, options, value, onChange, testIdFor, testId }) {
  if (!options?.length) return null;
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div role="group" aria-labelledby={`${id}-label`} data-testid={testId}>
      <div className="flex items-center justify-between gap-2 mb-1.5 min-h-8">
        <span id={`${id}-label`} className="text-xs md:text-sm font-medium inline-flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          {label}
          <span className="font-normal text-muted-foreground">
            {value.length > 0 ? `· ${value.length} dipilih` : "· semua"}
          </span>
        </span>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])} data-testid={`${id}-reset`}>
            Reset
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => toggle(o.value)}
              data-testid={testIdFor ? testIdFor(o) : undefined}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** Helper: entitas master → opsi chip (id sebagai value, code dipakai untuk testid). */
export function toOptions(list, labelFn = (x) => x.name) {
  return (list || []).map((x) => ({ value: x.id, label: labelFn(x), code: x.code }));
}
