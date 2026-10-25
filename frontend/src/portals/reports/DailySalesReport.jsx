/** Daily Sales Summary Report — pratinjau di layar + ekspor Excel penjualan harian per outlet/brand.
 *  Pratinjau memakai /reports/sales/daily-sales (baris & filter sama dengan file Excel). */
import { useState, useEffect } from "react";
import { Store, Tag, Eye } from "lucide-react";
import api, { fetchAll, unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { fmtRp, fmtNumber, fmtDate, todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import { useDebounce } from "@/hooks/useDebounce";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function DailySalesReport() {
  const { allOutlets } = useOutletScope();
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(30));
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [brands, setBrands] = useState([]);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [exporting, exportExcel] = useExcelExport();
  const [preview, setPreview] = useState({ rows: [], meta: null, loading: true, error: null });

  // Pratinjau mengikuti filter (di-debounce agar memilih beberapa chip tidak memicu banyak request).
  const previewKey = useDebounce(JSON.stringify([dateFrom, dateTo, selectedOutlets, selectedBrands]), 400);
  useEffect(() => {
    const [from, to, outletIds, brandIds] = JSON.parse(previewKey);
    if (from && to && from > to) {
      setPreview({ rows: [], meta: null, loading: false, error: "Tanggal awal setelah tanggal akhir." });
      return;
    }
    let cancelled = false;
    setPreview(p => ({ ...p, loading: true, error: null }));
    const params = { limit: 100 };
    if (from) params.date_from = from;
    if (to) params.date_to = to;
    if (outletIds.length) params.outlet_ids = outletIds.join(",");
    if (brandIds.length) params.brand_ids = brandIds.join(",");
    api.get("/reports/sales/daily-sales", { params })
      .then(res => { if (!cancelled) setPreview({ rows: unwrap(res) || [], meta: res.data?.meta, loading: false, error: null }); })
      .catch(e => { if (!cancelled) setPreview({ rows: [], meta: null, loading: false, error: e.response?.data?.errors?.[0]?.message || "Gagal memuat pratinjau" }); });
    return () => { cancelled = true; };
  }, [previewKey]);

  useEffect(() => {
    fetchAll("/master/brands")
      .then(r => setBrands(r.data?.data || []))
      .catch(() => {});
  }, []);

  function downloadExcel() {
    if (!validRange(dateFrom, dateTo)) return;
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    if (selectedBrands.length > 0) params.append("brand_ids", selectedBrands.join(","));
    exportExcel({
      path: "/reports/sales/daily-sales.xlsx",
      params,
      filename: `daily_sales_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="daily-sales"
      testId="daily-sales-report-page"
      titleTestId="daily-sales-title"
      filterTestId="daily-sales-filter-card"
      exportTestId="daily-sales-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
      after={<DailySalesPreview {...preview} />}
    >
      <FilterGrid>
        <ReportField id="ds-date-from" label="Dari tanggal">
          <Input id="ds-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="daily-sales-date-from" />
        </ReportField>
        <ReportField id="ds-date-to" label="Hingga tanggal">
          <Input id="ds-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="daily-sales-date-to" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="ds-outlets" label="Outlet" icon={Store}
        options={toOptions(allOutlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `outlet-filter-${o.code || o.value}`}
      />
      <ChipMultiSelect
        id="ds-brands" label="Brand" icon={Tag}
        options={toOptions(brands)} value={selectedBrands} onChange={setSelectedBrands}
        testIdFor={o => `brand-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}

/** Pratinjau baris laporan (maks. 100) + total atas seluruh baris. */
function DailySalesPreview({ rows, meta, loading, error }) {
  const total = meta?.total ?? 0;
  return (
    <section className="glass-card overflow-hidden" data-testid="daily-sales-preview">
      <div className="px-4 pt-4 pb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border/50">
        <h2 className="text-sm md:text-base font-semibold inline-flex items-center gap-2 mr-auto">
          <Eye className="h-4 w-4 text-muted-foreground" /> Pratinjau
        </h2>
        {meta && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground" data-testid="daily-sales-preview-totals">
            <span>Baris <b className="text-foreground tabular-nums">{fmtNumber(total)}</b></span>
            <span>Transaksi <b className="text-foreground tabular-nums">{fmtNumber(meta.transaction_count || 0)}</b></span>
            <span>Grand total <b className="text-foreground tabular-nums">{fmtRp(meta.grand_total || 0)}</b></span>
          </div>
        )}
      </div>
      {error ? (
        <EmptyState title="Pratinjau tidak tersedia" description={error} />
      ) : (
        <DataTable
          rows={rows}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="daily-sales-preview-row"
          columns={[
            { key: "sales_date", label: "Tanggal", primary: true, render: r => fmtDate(r.sales_date) },
            { key: "outlet_name", label: "Outlet" },
            { key: "brand_name", label: "Brand", render: r => r.brand_name || "—" },
            { key: "transaction_count", label: "Transaksi", numeric: true, render: r => fmtNumber(r.transaction_count) },
            { key: "grand_total", label: "Grand total", numeric: true, render: r => fmtRp(r.grand_total) },
            { key: "status", label: "Status", render: r => <StatusPill status={r.status} /> },
          ]}
          empty={<EmptyState title="Tidak ada sales tervalidasi" description="Ubah rentang tanggal atau filter outlet/brand." />}
        />
      )}
      {!error && total > rows.length && (
        <p className="px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground" data-testid="daily-sales-preview-more">
          Menampilkan {rows.length} dari {fmtNumber(total)} baris — ekspor Excel untuk seluruh baris.
        </p>
      )}
    </section>
  );
}
