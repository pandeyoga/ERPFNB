/**
 * e-Bupot PPh 23 Export Page — Sprint E Phase 3
 * Export PPh 23 withholding tax data in DJP e-Bupot CSV format.
 */
import { useState, useEffect } from "react";
import {
  FileSpreadsheet, Download, RefreshCw, AlertCircle,
  CheckCircle2, Eye, Calendar, Info, Receipt, Wallet, Scissors,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function getPeriodOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opts;
}

export default function EBupotExport({ embedded = false }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [preview, setPreview] = useState(null);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadExports(); }, []);

  const loadExports = async () => {
    try {
      const res = await api.get("/ebupot/exports");
      setExports(res.data.data || []);
    } catch {}
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get("/ebupot/preview", { params: { period } });
      setPreview(res.data.data);
      toast.success(`Preview dimuat: ${res.data.data.row_count} transaksi`);
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal memuat preview");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.post("/ebupot/export", { period });
      const job = res.data.data;
      // Download CSV
      const blob = new Blob([job.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eBupot_PPh23_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`e-Bupot CSV diunduh: ${job.row_count} transaksi`);
      loadExports();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal mengekspor");
    } finally {
      setExporting(false);
    }
  };

  const periodOptions = getPeriodOptions();
  const periodLabel = periodOptions.find(o => o.value === period)?.label || period;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="ebupot-export-page">
      {!embedded && (
        <PageHeader
          icon={FileSpreadsheet}
          title="e-Bupot PPh 23"
          subtitle="Ekspor data pemotongan PPh 23 dalam format CSV DJP e-Bupot Unifikasi"
          className="mb-0 md:mb-0"
        />
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          File CSV ini dapat diimpor langsung ke aplikasi <strong>DJP e-Bupot Unifikasi</strong>.
          Pastikan NPWP perusahaan sudah dikonfigurasi di <strong>Admin → System Settings</strong>.
        </AlertDescription>
      </Alert>

      {/* 1. Ekspor — satu alur tanpa sub-tab: pilih masa → preview → unduh */}
      <Card data-testid="ebupot-export-card">
        <CardHeader>
          <CardTitle>Buat CSV e-Bupot</CardTitle>
          <CardDescription>Pilih masa pajak, tampilkan preview, lalu unduh file CSV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="ebupot-period">Masa Pajak</Label>
              <Select value={period} onValueChange={(v) => { setPeriod(v); setPreview(null); }}>
                <SelectTrigger id="ebupot-period" className="w-60" data-testid="ebupot-period-select">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadPreview} disabled={loading} data-testid="ebupot-preview-btn">
              {loading ? <RefreshCw className="animate-spin" /> : <Eye />}
              Preview
            </Button>
            <Button onClick={handleExport} disabled={exporting} data-testid="ebupot-export-btn">
              {exporting ? <RefreshCw className="animate-spin" /> : <Download />}
              Unduh CSV
            </Button>
          </div>

          {preview && (
            <div className="space-y-3" data-testid="ebupot-preview-summary">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CompactStatCard size="sm" label="Total transaksi" value={preview.row_count} icon={Receipt} color="aurora-1" testId="ebupot-stat-rows" />
                <CompactStatCard size="sm" label="Total DPP" value={formatCurrency(preview.total_dpp)} icon={Wallet} color="aurora-3" testId="ebupot-stat-dpp" />
                <CompactStatCard size="sm" label="Total PPh dipotong" value={formatCurrency(preview.total_pph)} icon={Scissors} color="aurora-5" testId="ebupot-stat-pph" />
              </div>
              {preview.warning_count > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {preview.warning_count} transaksi memiliki peringatan (NPWP kosong, dll).
                    Periksa kolom Status pada tabel preview di bawah.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Preview data (muncul setelah Preview) */}
      {preview && (
        <Card data-testid="ebupot-preview-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Preview data PPh 23 — {periodLabel}</CardTitle>
              <Button size="sm" variant="outline" onClick={loadPreview} disabled={loading} data-testid="ebupot-preview-refresh">
                <RefreshCw className={loading ? "animate-spin" : undefined} /> Muat ulang
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={(preview.rows || []).map((row, i) => ({ ...row, _idx: i }))}
              keyField="_idx"
              stickyHeader={false}
              rowTestIdPrefix="ebupot-preview-row"
              empty={<EmptyState icon={FileSpreadsheet} title="Tidak ada transaksi" description="Tidak ada pemotongan PPh 23 pada masa pajak ini." />}
              columns={[
                { key: "_num", label: "#", render: (row) => <span className="text-xs text-muted-foreground">{row._idx + 1}</span> },
                { key: "nama_terpotong", label: "Vendor", primary: true, sortable: true,
                  render: (row) => <span className="text-sm font-medium">{row.nama_terpotong}</span> },
                { key: "npwp_terpotong", label: "NPWP",
                  render: (row) => <span className="text-xs font-medium tabular-nums">{row.npwp_terpotong}</span> },
                { key: "kode_objek", label: "Kode Objek",
                  render: (row) => <span className="text-xs">{row.kode_objek}</span> },
                { key: "dpp", label: "DPP", numeric: true, sortable: true,
                  render: (row) => <span className="text-sm">{formatCurrency(row.dpp)}</span> },
                { key: "tarif", label: "Tarif", numeric: true,
                  render: (row) => <span className="text-sm">{row.tarif?.toFixed(1)}%</span> },
                { key: "pph_dipotong", label: "PPh Dipotong", numeric: true, sortable: true,
                  render: (row) => <span className="text-sm font-medium">{formatCurrency(row.pph_dipotong)}</span> },
                { key: "bukti_potong_no", label: "Bukti Potong",
                  render: (row) => <span className="text-xs font-medium tabular-nums">{row.bukti_potong_no}</span> },
                { key: "status", label: "Status",
                  render: (row) => row.validation_issues?.length > 0 ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20 text-xs gap-1">
                      <AlertCircle className="h-3 w-3" />{row.validation_issues.length} peringatan
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/20 text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" />OK
                    </Badge>
                  ) },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* 3. Riwayat ekspor */}
      <Card data-testid="ebupot-history-card">
        <CardHeader>
          <CardTitle>Riwayat ekspor ({exports.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            rows={exports}
            keyField="id"
            rowTestIdPrefix="ebupot-history-row"
            empty={<EmptyState title="Belum ada riwayat ekspor" description="File CSV e-Bupot yang sudah diunduh akan tercatat di sini." />}
            columns={[
              { key: "period", label: "Periode", primary: true, sortable: true,
                render: (job) => <span className="font-medium">{job.period}</span> },
              { key: "row_count", label: "Transaksi", numeric: true, sortable: true },
              { key: "total_pph", label: "Total PPh", numeric: true, sortable: true,
                render: (job) => formatCurrency(job.total_pph) },
              { key: "created_by", label: "Diekspor Oleh",
                render: (job) => <span className="text-sm">{job.created_by}</span> },
              { key: "created_at", label: "Tanggal",
                render: (job) => <span className="text-sm">{job.created_at ? new Date(job.created_at).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</span> },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
