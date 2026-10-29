/** BulkImport/index.jsx — wizard orchestrator. */
/**
 * Bulk Excel Import - Admin Master Data Import
 *
 * Flow:
 * 1. Select entity type (Items/Vendors/Employees/COA/Customers)
 * 2. Download template Excel
 * 3. Upload filled Excel file
 * 4. Preview validation results (valid/invalid rows)
 * 5. Commit import (upsert to database)
 * 6. Show result summary
 *
 * Sprint D enhancements:
 * - Download Error CSV/XLSX button for invalid rows
 * - Max rows guardrail display
 * - Improved error display with field-level detail
 */
import { useState, useEffect, useRef } from "react";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, Package, Users, Briefcase, BookOpen, UserCheck,
  Loader2, FileText, ChevronRight, Info, RotateCcw, FileDown,
  ArrowRight, ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import DataTable from "@/components/shared/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import api from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";

import { ENTITY_ICONS, ENTITY_COLORS, STEP_LABELS, MAX_ROWS, downloadErrorCSV } from "./constants";

export default function BulkImport({ embedded = false } = {}) {
  const [entityTypes, setEntityTypes] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { loadEntityTypes(); }, []);

  const loadEntityTypes = async () => {
    try {
      const res = await api.get("/admin/bulk-import/entity-types");
      setEntityTypes(res.data.data.items || []);
    } catch {
      toast.error("Gagal memuat jenis data import");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEntity = (entity) => {
    setSelectedEntity(entity);
    setCurrentStep(1);
    setFile(null);
    setPreviewResult(null);
    setImportResult(null);
    setShowAllErrors(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/admin/bulk-import/template/${selectedEntity.value}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_${selectedEntity.value}_${selectedEntity.label.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Template ${selectedEntity.label} berhasil diunduh`);
      setCurrentStep(2);
    } catch {
      toast.error("Gagal mengunduh template");
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("File harus berformat .xlsx atau .xls");
      return;
    }
    setFile(f);
    setPreviewResult(null);
  };

  const handlePreview = async () => {
    if (!file) { toast.error("Pilih file Excel terlebih dahulu"); return; }
    setUploading(true);
    setPreviewResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/admin/bulk-import/preview/${selectedEntity.value}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data.data;
      setPreviewResult(data);
      setCurrentStep(3);
      if (data.summary.valid > 0) {
        toast.success(`Pratinjau selesai: ${data.summary.valid} valid, ${data.summary.invalid} tidak valid`);
      } else {
        toast.warning(`Tidak ada row valid. ${data.summary.invalid} baris berisi error.`);
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memvalidasi file");
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !previewResult || previewResult.summary.valid === 0) {
      toast.error("Tidak ada data valid untuk di-import");
      return;
    }
    setCommitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/admin/bulk-import/commit/${selectedEntity.value}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data.data.import_result);
      setCurrentStep(4);
      const r = res.data.data.import_result;
      toast.success(`Import selesai: ${r.created} dibuat, ${r.updated} diperbarui`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menjalankan import");
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setSelectedEntity(null);
    setCurrentStep(0);
    setFile(null);
    setPreviewResult(null);
    setImportResult(null);
    setShowAllErrors(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="bulk-import-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const visibleErrors = showAllErrors
    ? previewResult?.invalid_rows
    : previewResult?.invalid_rows?.slice(0, 20);

  const subtitle = `Import master data dalam jumlah besar via template Excel. Maks ${MAX_ROWS.toLocaleString("id-ID")} baris per import.`;
  const resetButton = currentStep > 0 && (
    <Button variant="outline" onClick={handleReset} data-testid="btn-reset">
      <RotateCcw /> Mulai Ulang
    </Button>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="bulk-import-page">
      {/* Header — mandiri: PageHeader; di dalam hub "Setup & Numbering": baris ringkas tanpa judul kedua */}
      {embedded ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground" data-testid="bulk-import-title">{subtitle}</p>
          {resetButton}
        </div>
      ) : (
        <PageHeader
          icon={FileSpreadsheet}
          title="Bulk Excel Import"
          subtitle={subtitle}
          actions={resetButton}
          testId="bulk-import-title"
        />
      )}

      {/* Progress Steps */}
      <Card data-testid="bulk-import-steps">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {STEP_LABELS.map((label, idx) => (
              <div key={idx} className="flex items-center shrink-0">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-semibold transition-all ${
                  idx < currentStep
                    ? "bg-green-500 border-green-500 text-white"
                    : idx === currentStep
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted border-border text-muted-foreground"
                }`}>
                  {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`ml-2 text-xs font-medium hidden sm:block ${
                  idx <= currentStep ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {label}
                </span>
                {idx < STEP_LABELS.length - 1 && (
                  <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Select Entity */}
      {currentStep === 0 && (
        <Card data-testid="step-select-entity">
          <CardHeader>
            <CardTitle>Pilih jenis master data</CardTitle>
            <CardDescription>Pilih jenis data yang ingin di-import via Excel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entityTypes.map((entity) => {
                const Icon = ENTITY_ICONS[entity.value] || FileSpreadsheet;
                const colorCls = ENTITY_COLORS[entity.value] || "from-gray-500/15 to-gray-600/15 text-muted-foreground";
                return (
                  <button
                    key={entity.value}
                    className="group text-left rounded-[calc(var(--radius)-2px)] border border-border bg-card hover:border-primary hover:shadow-md transition-all p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    onClick={() => handleSelectEntity(entity)}
                    data-testid={`entity-card-${entity.value}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-[calc(var(--radius)-2px)] bg-gradient-to-br ${colorCls}`}>
                        <Icon className="w-[18px] h-[18px]" />
                      </div>
                      <h3 className="text-sm md:text-base font-semibold flex-1 min-w-0 truncate">{entity.label}</h3>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Kunci unik: <Badge variant="secondary" className="text-xs">{entity.unique_key}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Wajib: {entity.required_fields.join(", ")}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Download Template */}
      {currentStep >= 1 && selectedEntity && (
        <Card data-testid="step-download-template">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              Unduh template Excel
            </CardTitle>
            <CardDescription>
              Template sudah berisi header dan 1 baris contoh. Isi data Anda mulai baris ke-3.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-sm">
                <strong>Panduan:</strong> Jangan hapus atau ubah header baris pertama.
                Baris ke-2 adalah contoh — hapus dan ganti dengan data Anda.
                Maksimum <strong>{MAX_ROWS.toLocaleString("id-ID")} baris</strong> per upload.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleDownloadTemplate}
                data-testid="btn-download-template"
              >
                <Download />
                Unduh Template — {selectedEntity.label}
              </Button>
              {currentStep === 1 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  data-testid="btn-skip-template"
                >
                  Sudah punya template? Lanjut unggah
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Upload & Preview */}
      {currentStep >= 2 && selectedEntity && (
        <Card data-testid="step-upload-preview">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Unggah & pratinjau
            </CardTitle>
            <CardDescription>Unggah file Excel lalu periksa hasil validasi sebelum import</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Pilih file Excel untuk diunggah"
              className={`border-2 border-dashed rounded-[calc(var(--radius)-2px)] p-6 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                file ? "border-green-400 bg-green-50 dark:bg-green-950/20" : "border-border hover:border-primary"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
              data-testid="file-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                data-testid="file-input"
              />
              {file ? (
                <>
                  <FileText className="w-9 h-9 text-green-700 dark:text-green-400 mx-auto mb-2" />
                  <p className="font-medium text-green-700 dark:text-green-400">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB — klik untuk ganti file
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-9 h-9 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Klik untuk pilih file Excel</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx atau .xls</p>
                </>
              )}
            </div>

            {file && (
              <Button
                onClick={handlePreview}
                disabled={uploading}
                data-testid="btn-preview"
              >
                {uploading ? (
                  <><Loader2 className="animate-spin" /> Memvalidasi…</>
                ) : (
                  <><FileText /> Pratinjau & Validasi</>
                )}
              </Button>
            )}

            {/* Preview Results */}
            {previewResult && (
              <div className="space-y-4 pt-2" data-testid="preview-results">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3">
                  <CompactStatCard label="Valid" value={previewResult.summary.valid}
                    tone="success" icon={CheckCircle2} color="aurora-4" size="sm" testId="preview-valid-count" />
                  <CompactStatCard label="Tidak valid" value={previewResult.summary.invalid}
                    tone="danger" icon={XCircle} color="aurora-3" size="sm" testId="preview-invalid-count" />
                  <CompactStatCard label="Total baris" value={previewResult.total_rows}
                    icon={FileSpreadsheet} color="aurora-1" size="sm" testId="preview-total-count" />
                </div>

                {/* Progress bar */}
                {previewResult.total_rows > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Tingkat validitas</span>
                      <span>{Math.round((previewResult.summary.valid / previewResult.total_rows) * 100)}%</span>
                    </div>
                    <Progress
                      value={(previewResult.summary.valid / previewResult.total_rows) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Max rows warning */}
                {previewResult.total_rows > MAX_ROWS && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      File berisi {previewResult.total_rows.toLocaleString("id-ID")} baris — melebihi batas {MAX_ROWS.toLocaleString("id-ID")}.
                      Hanya {MAX_ROWS.toLocaleString("id-ID")} baris pertama yang akan diproses.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Invalid rows table */}
                {previewResult.invalid_rows?.length > 0 && (
                  <Card className="border-red-200 dark:border-red-800" data-testid="invalid-rows-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                          <XCircle className="w-4 h-4" />
                          {previewResult.invalid_rows.length} baris error
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadErrorCSV(selectedEntity.label, previewResult.invalid_rows)}
                          data-testid="btn-download-errors"
                        >
                          <FileDown />
                          Unduh CSV Error
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-auto max-h-72" data-testid="invalid-rows-table">
                        <DataTable
                          rows={visibleErrors || []}
                          keyField="row_num"
                          rowTestIdPrefix="error-row"
                          columns={[
                            { key: "row_num", label: "Baris", primary: true,
                              render: (row) => <span className="font-semibold text-xs tabular-nums">{row.row_num}</span> },
                            { key: "errors", label: "Errors", render: (row) => (
                              <div className="flex flex-wrap gap-1">
                                {row.errors.map((err, i) => (
                                  <Badge key={i} variant="destructive" className="text-xs font-normal">
                                    {err}
                                  </Badge>
                                ))}
                              </div>
                            ) },
                            { key: "data", label: "Data (preview)", render: (row) => (
                              <span className="text-xs text-muted-foreground max-w-xs truncate inline-block align-top">
                                {Object.entries(row.data)
                                  .filter(([, v]) => v)
                                  .slice(0, 3)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" · ")}
                              </span>
                            ) },
                          ]}
                        />
                      </div>
                      {previewResult.invalid_rows.length > 20 && (
                        <div className="p-3 text-center border-t">
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => setShowAllErrors(v => !v)}
                            data-testid="btn-show-all-errors"
                          >
                            {showAllErrors
                              ? "Tampilkan lebih sedikit"
                              : `Lihat semua ${previewResult.invalid_rows.length} baris error`}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Commit Import */}
      {currentStep === 3 && previewResult && previewResult.summary.valid > 0 && (
        <Card className="border-primary/30" data-testid="step-commit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Konfirmasi & import
            </CardTitle>
            <CardDescription>
              {previewResult.summary.valid} baris valid akan di-upsert ke database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                Operasi ini akan <strong>create</strong> record baru atau <strong>update</strong> record yang sudah ada
                berdasarkan unique key <code className="text-xs bg-muted px-1 rounded">{selectedEntity.unique_key}</code>.
                {previewResult.summary.invalid > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" "}{previewResult.summary.invalid} baris dengan error akan dilewati.
                  </span>
                )}
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">Jenis data</div>
                <div className="font-semibold mt-0.5">{selectedEntity.label}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">Akan di-import</div>
                <div className="font-semibold mt-0.5 text-green-700 dark:text-green-400">{previewResult.summary.valid} baris valid</div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="gap-2 justify-end">
            <Button onClick={handleReset} variant="outline" data-testid="btn-cancel-commit">
              Batal
            </Button>
            <Button
              onClick={handleCommit}
              disabled={committing}
              data-testid="btn-commit"
            >
              {committing ? (
                <><Loader2 className="animate-spin" /> Mengimpor…</>
              ) : (
                <><CheckCircle2 /> Jalankan Import</>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* No valid rows warning */}
      {currentStep === 3 && previewResult && previewResult.summary.valid === 0 && (
        <Alert variant="destructive" data-testid="no-valid-rows-alert">
          <XCircle className="w-4 h-4" />
          <AlertDescription>
            Tidak ada baris yang valid. Perbaiki error di file Excel dan upload ulang.
          </AlertDescription>
        </Alert>
      )}

      {/* Step 5: Complete */}
      {currentStep === 4 && importResult && (
        <Card className="border-green-300 dark:border-green-700" data-testid="step-complete">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Import selesai
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <CompactStatCard label="Dibuat" value={importResult.created}
                tone="success" icon={CheckCircle2} color="aurora-4" size="sm" testId="result-created" />
              <CompactStatCard label="Diperbarui" value={importResult.updated}
                tone="info" icon={RotateCcw} color="aurora-2" size="sm" testId="result-updated" />
              <CompactStatCard label="Dilewati" value={importResult.skipped}
                icon={XCircle} color="aurora-1" size="sm" testId="result-skipped" />
            </div>

            {importResult.errors?.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {importResult.errors.length} baris gagal saat insert/update ke database. Periksa log sistem.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={handleReset} data-testid="btn-import-more">
              <RotateCcw /> Import Data Lainnya
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

