/**
 * ProcurementReportsTab — Tab di FinanceReportsHub untuk export laporan Procurement.
 * Menyediakan download XLSX untuk PR, PO, GR, dan Vendor Performance.
 */
import { useState } from "react";
import { FileSpreadsheet, ClipboardList, ShoppingCart, Truck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { InlineHelp } from "@/components/shared/InlineHelp";
import useExcelExport from "@/hooks/useExcelExport";
import useOutletScope from "@/hooks/useOutletScope";
import { todayJakartaISO } from "@/lib/format";

const PR_STATUSES = [
  { key: "", label: "Semua Status" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Diajukan" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
  { key: "converted", label: "Dikonversi" },
];

const PO_STATUSES = [
  { key: "", label: "Semua Status" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Terkirim" },
  { key: "approved", label: "Disetujui" },
  { key: "partial", label: "Partial Received" },
  { key: "received", label: "Diterima" },
  { key: "cancelled", label: "Dibatalkan" },
];

const LABEL = "text-xs font-medium text-muted-foreground";

function ReportCard({ icon: Icon, title, description, accentClass, children, onExport, exportLabel = "Ekspor Excel", testId, disabled }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-[calc(var(--radius)-2px)] flex items-center justify-center flex-shrink-0", accentClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Filters */}
      {children && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {children}
        </div>
      )}

      {/* Export Button */}
      <Button
        size="sm"
        variant="outline"
        className="w-full mt-auto"
        onClick={onExport}
        disabled={disabled}
        data-testid={testId}
      >
        <FileSpreadsheet className="text-emerald-700 dark:text-emerald-400" />
        {exportLabel}
      </Button>
    </div>
  );
}

export default function ProcurementReportsTab() {
  const { downloading, exportXlsx } = useExcelExport();
  const { allOutlets } = useOutletScope();

  // PR filters
  const [prStatus, setPrStatus] = useState("");
  const [prOutlet, setPrOutlet] = useState("");
  const [prSource, setPrSource] = useState("");

  // PO filters
  const [poStatus, setPoStatus] = useState("");
  const [poOutlet, setPoOutlet] = useState("");

  // GR + Vendor filters (date range)
  const thisMonth = todayJakartaISO().slice(0, 7);
  const defaultFrom = `${thisMonth}-01`;
  const defaultTo = todayJakartaISO();

  const [grFrom, setGrFrom] = useState(defaultFrom);
  const [grTo, setGrTo] = useState(defaultTo);
  const [vpFrom, setVpFrom] = useState(defaultFrom);
  const [vpTo, setVpTo] = useState(defaultTo);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="procurement-reports-tab">
      {/* Keterangan singkat — judul sudah diwakili label tab */}
      <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
        <span>Unduh data pengadaan (PR, PO, GR, performa vendor) langsung ke file Microsoft Excel (.xlsx).</span>
        <InlineHelp id="procurement-reports" size="xs" placement="right" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">

        {/* 1. Purchase Request */}
        <ReportCard
          icon={ClipboardList}
          title="Purchase Request (PR)"
          description="Daftar semua PR beserta status, outlet, dan jumlah lines. Filter per status dan outlet."
          accentClass="bg-blue-500/10 text-blue-800 dark:text-blue-400"
          testId="export-pr-xlsx"
          disabled={downloading}
          onExport={() => exportXlsx(
            "/procurement/prs/export/xlsx",
            "purchase_requests.xlsx",
            { status: prStatus, outlet_id: prOutlet, source: prSource }
          )}
        >
          {/* Status */}
          <div>
            <Label className={LABEL}>
              Status
            </Label>
            <SimpleSelect
              value={prStatus}
              onValueChange={setPrStatus}
              options={PR_STATUSES.map(s => ({ value: s.key, label: s.label }))}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="pr-report-status"
              ariaLabel="Status PR"
            />
          </div>

          {/* Outlet */}
          <div>
            <Label className={LABEL}>
              Outlet
            </Label>
            <SimpleSelect
              value={prOutlet}
              onValueChange={setPrOutlet}
              options={[{ value: "", label: "Semua Outlet" }, ...allOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Semua Outlet"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="pr-report-outlet"
              ariaLabel="Outlet PR"
            />
          </div>

          {/* Source */}
          <div className="sm:col-span-2">
            <Label className={LABEL}>
              Sumber
            </Label>
            <SimpleSelect
              value={prSource}
              onValueChange={setPrSource}
              options={[
                { value: "", label: "Semua sumber" },
                { value: "manual", label: "Manual" },
                { value: "market_list", label: "Market List" },
                { value: "urgent", label: "Urgent" },
              ]}
              placeholder="Semua sumber"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="pr-report-source"
              ariaLabel="Sumber PR"
            />
          </div>
        </ReportCard>

        {/* 2. Purchase Order */}
        <ReportCard
          icon={ShoppingCart}
          title="Purchase Order (PO)"
          description="Daftar PO lengkap dengan vendor, total nilai, dan status pengiriman."
          accentClass="bg-violet-500/10 text-violet-800 dark:text-violet-400"
          testId="export-po-xlsx"
          disabled={downloading}
          onExport={() => exportXlsx(
            "/procurement/pos/export/xlsx",
            "purchase_orders.xlsx",
            { status: poStatus, outlet_id: poOutlet }
          )}
        >
          {/* Status */}
          <div>
            <Label className={LABEL}>
              Status
            </Label>
            <SimpleSelect
              value={poStatus}
              onValueChange={setPoStatus}
              options={PO_STATUSES.map(s => ({ value: s.key, label: s.label }))}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="po-report-status"
              ariaLabel="Status PO"
            />
          </div>

          {/* Outlet */}
          <div>
            <Label className={LABEL}>
              Outlet
            </Label>
            <SimpleSelect
              value={poOutlet}
              onValueChange={setPoOutlet}
              options={[{ value: "", label: "Semua Outlet" }, ...allOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Semua Outlet"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="po-report-outlet"
              ariaLabel="Outlet PO"
            />
          </div>
        </ReportCard>

        {/* 3. GR Summary */}
        <ReportCard
          icon={Truck}
          title="Goods Receipt Summary"
          description="Ringkasan penerimaan barang per periode — jumlah GR, total nilai, dan vendor."
          accentClass="bg-emerald-500/10 text-emerald-800 dark:text-emerald-400"
          testId="export-gr-xlsx"
          disabled={downloading}
          onExport={() => exportXlsx(
            "/reports/procurement/gr-summary.xlsx",
            `gr_summary_${grFrom}_${grTo}.xlsx`,
            { date_from: grFrom, date_to: grTo }
          )}
        >
          <div>
            <Label htmlFor="gr-report-from" className={LABEL}>
              Dari Tanggal
            </Label>
            <Input
              id="gr-report-from"
              type="date"
              value={grFrom}
              onChange={e => setGrFrom(e.target.value)}
              className="glass-input w-full h-9 mt-1"
              data-testid="gr-report-from"
            />
          </div>
          <div>
            <Label htmlFor="gr-report-to" className={LABEL}>
              Sampai Tanggal
            </Label>
            <Input
              id="gr-report-to"
              type="date"
              value={grTo}
              onChange={e => setGrTo(e.target.value)}
              className="glass-input w-full h-9 mt-1"
              data-testid="gr-report-to"
            />
          </div>
        </ReportCard>

        {/* 4. Vendor Performance */}
        <ReportCard
          icon={Star}
          title="Vendor Performance"
          description="Analisis performa vendor: lead time, fill rate, ketepatan harga, dan skor akhir."
          accentClass="bg-amber-500/10 text-amber-800 dark:text-amber-400"
          testId="export-vendor-perf-xlsx"
          disabled={downloading}
          onExport={() => exportXlsx(
            "/reports/procurement/vendor-performance.xlsx",
            `vendor_performance_${vpFrom}_${vpTo}.xlsx`,
            { date_from: vpFrom, date_to: vpTo }
          )}
        >
          <div>
            <Label htmlFor="vp-report-from" className={LABEL}>
              Dari Tanggal
            </Label>
            <Input
              id="vp-report-from"
              type="date"
              value={vpFrom}
              onChange={e => setVpFrom(e.target.value)}
              className="glass-input w-full h-9 mt-1"
              data-testid="vp-report-from"
            />
          </div>
          <div>
            <Label htmlFor="vp-report-to" className={LABEL}>
              Sampai Tanggal
            </Label>
            <Input
              id="vp-report-to"
              type="date"
              value={vpTo}
              onChange={e => setVpTo(e.target.value)}
              className="glass-input w-full h-9 mt-1"
              data-testid="vp-report-to"
            />
          </div>
        </ReportCard>
      </div>

    </div>
  );
}
