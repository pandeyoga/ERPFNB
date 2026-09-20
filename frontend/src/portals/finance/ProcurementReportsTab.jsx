/**
 * ProcurementReportsTab — Tab di FinanceReportsHub untuk export laporan Procurement.
 * Menyediakan download XLSX untuk PR, PO, GR, dan Vendor Performance.
 */
import { useState } from "react";
import { FileSpreadsheet, ClipboardList, ShoppingCart, Truck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InlineHelp } from "@/components/shared/InlineHelp";
import useExcelExport from "@/hooks/useExcelExport";
import useOutletScope from "@/hooks/useOutletScope";
import { todayJakartaISO } from "@/lib/format";

const PR_STATUSES = [
  { key: "", label: "Semua Status" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "converted", label: "Converted" },
];

const PO_STATUSES = [
  { key: "", label: "Semua Status" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "approved", label: "Approved" },
  { key: "partial", label: "Partial Received" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

function ReportCard({ icon: Icon, title, description, accentClass, children, onExport, exportLabel = "Export Excel", testId }) {
  return (
    <div className={cn(
      "rounded-xl border border-border/60 bg-card p-5 flex flex-col gap-4",
      "hover:border-border transition-colors"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("p-2.5 rounded-lg flex-shrink-0", accentClass)}>
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
        className="w-full mt-auto gap-2 text-sm"
        onClick={onExport}
        data-testid={testId}
      >
        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
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
    <div className="space-y-5" data-testid="procurement-reports-tab">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Laporan Pengadaan
        </h3>
        <InlineHelp id="procurement-reports" size="xs" placement="right" />
        <span className="text-xs text-muted-foreground/60">— unduh data ke Excel (.xlsx)</span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. Purchase Request */}
        <ReportCard
          icon={ClipboardList}
          title="Purchase Request (PR)"
          description="Daftar semua PR beserta status, outlet, dan jumlah lines. Filter per status dan outlet."
          accentClass="bg-blue-500/10 text-blue-500"
          testId="export-pr-xlsx"
          onExport={() => exportXlsx(
            "/procurement/prs/export/xlsx",
            "purchase_requests.xlsx",
            { status: prStatus, outlet_id: prOutlet, source: prSource }
          )}
        >
          {/* Status */}
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Status
            </Label>
            <SimpleSelect
              value={prStatus}
              onValueChange={setPrStatus}
              options={PR_STATUSES.map(s => ({ value: s.key, label: s.label }))}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="pr-report-status"
            />
          </div>

          {/* Outlet */}
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Outlet
            </Label>
            <SimpleSelect
              value={prOutlet}
              onValueChange={setPrOutlet}
              options={[{ value: "", label: "Semua Outlet" }, ...allOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Semua Outlet"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="pr-report-outlet"
            />
          </div>

          {/* Source */}
          <div className="sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Source
            </Label>
            <SimpleSelect
              value={prSource}
              onValueChange={setPrSource}
              options={[
                { value: "", label: "Semua Source" },
                { value: "manual", label: "Manual" },
                { value: "market_list", label: "Market List" },
                { value: "urgent", label: "Urgent" },
              ]}
              placeholder="Semua Source"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="pr-report-source"
            />
          </div>
        </ReportCard>

        {/* 2. Purchase Order */}
        <ReportCard
          icon={ShoppingCart}
          title="Purchase Order (PO)"
          description="Daftar PO lengkap dengan vendor, total nilai, dan status pengiriman."
          accentClass="bg-violet-500/10 text-violet-500"
          testId="export-po-xlsx"
          onExport={() => exportXlsx(
            "/procurement/pos/export/xlsx",
            "purchase_orders.xlsx",
            { status: poStatus, outlet_id: poOutlet }
          )}
        >
          {/* Status */}
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Status
            </Label>
            <SimpleSelect
              value={poStatus}
              onValueChange={setPoStatus}
              options={PO_STATUSES.map(s => ({ value: s.key, label: s.label }))}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="po-report-status"
            />
          </div>

          {/* Outlet */}
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Outlet
            </Label>
            <SimpleSelect
              value={poOutlet}
              onValueChange={setPoOutlet}
              options={[{ value: "", label: "Semua Outlet" }, ...allOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Semua Outlet"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="po-report-outlet"
            />
          </div>
        </ReportCard>

        {/* 3. GR Summary */}
        <ReportCard
          icon={Truck}
          title="Goods Receipt Summary"
          description="Ringkasan penerimaan barang per periode — jumlah GR, total nilai, dan vendor."
          accentClass="bg-emerald-500/10 text-emerald-500"
          testId="export-gr-xlsx"
          onExport={() => exportXlsx(
            "/reports/procurement/gr-summary.xlsx",
            `gr_summary_${grFrom}_${grTo}.xlsx`,
            { date_from: grFrom, date_to: grTo }
          )}
        >
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Dari Tanggal
            </Label>
            <input
              type="date"
              value={grFrom}
              onChange={e => setGrFrom(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              data-testid="gr-report-from"
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Sampai Tanggal
            </Label>
            <input
              type="date"
              value={grTo}
              onChange={e => setGrTo(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              data-testid="gr-report-to"
            />
          </div>
        </ReportCard>

        {/* 4. Vendor Performance */}
        <ReportCard
          icon={Star}
          title="Vendor Performance"
          description="Analisis performa vendor: lead time, fill rate, ketepatan harga, dan skor akhir."
          accentClass="bg-amber-500/10 text-amber-500"
          testId="export-vendor-perf-xlsx"
          onExport={() => exportXlsx(
            "/reports/procurement/vendor-performance.xlsx",
            `vendor_performance_${vpFrom}_${vpTo}.xlsx`,
            { date_from: vpFrom, date_to: vpTo }
          )}
        >
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Dari Tanggal
            </Label>
            <input
              type="date"
              value={vpFrom}
              onChange={e => setVpFrom(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              data-testid="vp-report-from"
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Sampai Tanggal
            </Label>
            <input
              type="date"
              value={vpTo}
              onChange={e => setVpTo(e.target.value)}
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              data-testid="vp-report-to"
            />
          </div>
        </ReportCard>
      </div>

      {/* Download note */}
      <p className="text-xs text-muted-foreground/60 text-center pt-1">
        File diunduh langsung ke browser dalam format Microsoft Excel (.xlsx)
      </p>
    </div>
  );
}
