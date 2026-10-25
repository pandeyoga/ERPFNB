/** e-Faktur / Coretax Export — Sprint 1b */
import { useState, useEffect } from "react";
import { FileText, Download, CheckCircle2, Eye, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency, formatDateID } from "@/lib/format";
import { logger } from "@/lib/logger";

export default function EFakturExport({ embedded = false }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [jobType, setJobType] = useState("keluaran");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exports, setExports] = useState([]);
  const [lastExport, setLastExport] = useState(null);

  useEffect(() => {
    loadExports();
  }, []);

  const loadExports = async () => {
    try {
      const res = await api.get("/efaktur/exports", { params: { per_page: 10 } });
      if (res.data.success) {
        setExports(res.data.data.items);
      }
    } catch (err) {
      logger.error("Failed to load e-Faktur export history", { error: err.message });
    }
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get("/efaktur/preview", { params: { period, job_type: jobType } });
      if (res.data.success) {
        setPreview(res.data.data);
        toast.success(`Preview dimuat: ${res.data.data.keluaran.length + res.data.data.masukan.length} faktur`);
      }
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal memuat preview");
    } finally {
      setLoading(false);
    }
  };

  const generateExport = async () => {
    setExporting(true);
    try {
      const res = await api.post("/efaktur/export", { period, job_type: jobType });
      if (res.data.success) {
        const job = res.data.data;
        setLastExport(job);
        toast.success(`Export berhasil! ${job.faktur_count} faktur`);
        loadExports();
      }
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal membuat file ekspor");
    } finally {
      setExporting(false);
    }
  };

  const downloadFile = (format, type) => {
    if (!lastExport || !lastExport.files) {
      toast.error("Belum ada file ekspor");
      return;
    }
    const key = `${format}_${type}`;
    const content = lastExport.files[key];
    if (!content) {
      toast.error(`File ${key} tidak ditemukan`);
      return;
    }
    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_${period}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${type}_${period}.${format} diunduh`);
  };

  const fakturColumns = (nameKey, nameLabel) => [
    { key: "faktur_no", label: "No Faktur", primary: true, render: (f) => <span className="text-xs font-medium tabular-nums">{f.faktur_no}</span> },
    { key: "tanggal_faktur", label: "Tanggal", render: (f) => formatDateID(f.tanggal_faktur) },
    { key: nameKey, label: nameLabel, render: (f) => <span className="block truncate max-w-xs">{f[nameKey]}</span> },
    { key: "dpp", label: "DPP", numeric: true, sortable: true, render: (f) => formatCurrency(f.dpp) },
    { key: "ppn", label: "PPN", numeric: true, sortable: true, render: (f) => formatCurrency(f.ppn) },
  ];
  const historyColumns = [
    { key: "period", label: "Periode", primary: true },
    { key: "job_type", label: "Tipe", render: (e) => <Badge variant="outline">{e.job_type}</Badge> },
    { key: "faktur_count", label: "Jumlah", numeric: true },
    { key: "total_dpp", label: "Total DPP", numeric: true, render: (e) => formatCurrency(e.total_dpp) },
    { key: "created_at", label: "Tanggal", render: (e) => new Date(e.created_at).toLocaleString("id-ID") },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="efaktur-export">
      {!embedded && (
        <PageHeader
          icon={FileText}
          title="e-Faktur Export"
          subtitle="Ekspor Faktur Pajak (CSV + XML) format Coretax untuk diunggah ke DJP"
          className="mb-0 md:mb-0"
        />
      )}

      <Card data-testid="export-form-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Buat file ekspor
          </CardTitle>
          <CardDescription>
            Pilih periode dan tipe faktur, lalu tampilkan preview sebelum membuat file ekspor (CSV + XML Coretax).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="efaktur-period">Periode</Label>
              <Input
                id="efaktur-period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                data-testid="period-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-type">Tipe Faktur</Label>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger id="job-type" data-testid="job-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keluaran">Faktur Keluaran (Penjualan)</SelectItem>
                  <SelectItem value="masukan">Faktur Masukan (Pembelian)</SelectItem>
                  <SelectItem value="all">Keduanya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={loadPreview} disabled={loading} data-testid="preview-btn">
              {loading ? <RefreshCw className="animate-spin" /> : <Eye />}
              {loading ? "Memuat…" : "Preview"}
            </Button>
            <Button
              onClick={generateExport}
              disabled={exporting || !preview}
              data-testid="generate-btn"
            >
              {exporting ? <RefreshCw className="animate-spin" /> : <Download />}
              {exporting ? "Membuat…" : "Buat file ekspor"}
            </Button>
            {!preview && <span className="text-xs text-muted-foreground">Tampilkan preview dulu untuk mengaktifkan ekspor.</span>}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card data-testid="preview-card">
          <CardHeader>
            <CardTitle>Preview Data</CardTitle>
            <CardDescription>
              Total: {preview.keluaran.length + preview.masukan.length} faktur | DPP: {formatCurrency(preview.total_dpp)} | PPN: {formatCurrency(preview.total_ppn)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="keluaran">
              <TabsList>
                <TabsTrigger value="keluaran">Keluaran ({preview.keluaran.length})</TabsTrigger>
                <TabsTrigger value="masukan">Masukan ({preview.masukan.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="keluaran">
                <DataTable
                  rows={preview.keluaran.slice(0, 10)}
                  columns={fakturColumns("nama_pembeli", "Pembeli")}
                  keyField="faktur_no"
                  rowTestIdPrefix="efaktur-keluaran-row"
                  empty={<div className="p-3"><EmptyState title="Tidak ada faktur keluaran" description="Tidak ada faktur keluaran pada periode ini." /></div>}
                />
                {preview.keluaran.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-2">...dan {preview.keluaran.length - 10} lainnya</p>
                )}
              </TabsContent>
              <TabsContent value="masukan">
                <DataTable
                  rows={preview.masukan.slice(0, 10)}
                  columns={fakturColumns("nama_penjual", "Penjual")}
                  keyField="faktur_no"
                  rowTestIdPrefix="efaktur-masukan-row"
                  empty={<div className="p-3"><EmptyState title="Tidak ada faktur masukan" description="Tidak ada faktur masukan pada periode ini." /></div>}
                />
                {preview.masukan.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-2">...dan {preview.masukan.length - 10} lainnya</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {lastExport && (
        <Alert data-testid="download-alert">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">File ekspor berhasil dibuat. Unduh file:</div>
            <div className="flex gap-2 flex-wrap">
              {lastExport.job_type !== "masukan" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => downloadFile("csv", "keluaran")} data-testid="download-csv-keluaran">
                    <Download /> CSV Keluaran
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadFile("xml", "keluaran")} data-testid="download-xml-keluaran">
                    <Download /> XML Keluaran
                  </Button>
                </>
              )}
              {lastExport.job_type !== "keluaran" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => downloadFile("csv", "masukan")} data-testid="download-csv-masukan">
                    <Download /> CSV Masukan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadFile("xml", "masukan")} data-testid="download-xml-masukan">
                    <Download /> XML Masukan
                  </Button>
                </>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card data-testid="export-history-card">
        <CardHeader>
          <CardTitle>Riwayat ekspor</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={exports}
            columns={historyColumns}
            keyField="id"
            rowTestIdPrefix="efaktur-history-row"
            empty={<EmptyState title="Belum ada ekspor" description="Riwayat ekspor e-Faktur akan muncul di sini setelah file pertama dibuat." />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
