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

import { ENTITY_ICONS, ENTITY_COLORS, STEP_LABELS, MAX_ROWS, downloadErrorCSV } from "./constants";
import StatCard from "./StatCard";

export default function BulkImport() {
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
      toast.error("Gagal memuat entity types");
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
      toast.error("Gagal download template");
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
        toast.success(`Preview OK: ${data.summary.valid} valid, ${data.summary.invalid} invalid`);
      } else {
        toast.warning(`Tidak ada row valid. ${data.summary.invalid} baris berisi error.`);
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal preview file");
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
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal commit import");
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

  return (
    <div className="space-y-6" data-testid="bulk-import-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="bulk-import-title">Bulk Excel Import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import master data dalam jumlah besar via Excel template. Batas maks {MAX_ROWS.toLocaleString("id-ID")} baris per import.
          </p>
        </div>
        {currentStep > 0 && (
          <Button variant="outline" onClick={handleReset} className="gap-2" data-testid="btn-reset">
            <RotateCcw className="w-4 h-4" /> Mulai Ulang
          </Button>
        )}
      </div>

      {/* Progress Steps */}
      <Card data-testid="bulk-import-steps">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {STEP_LABELS.map((label, idx) => (
              <div key={idx} className="flex items-center shrink-0">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold transition-all ${
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
            <CardTitle>Pilih Jenis Master Data</CardTitle>
            <CardDescription>Pilih jenis data yang ingin di-import via Excel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entityTypes.map((entity) => {
                const Icon = ENTITY_ICONS[entity.value] || FileSpreadsheet;
                const colorCls = ENTITY_COLORS[entity.value] || "from-gray-500/15 to-gray-600/15 text-gray-600";
                return (
                  <button
                    key={entity.value}
                    className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all p-5 focus:outline-none focus:ring-2 focus:ring-primary"
                    onClick={() => handleSelectEntity(entity)}
                    data-testid={`entity-card-${entity.value}`}
                  >
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${colorCls} mb-3`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-base mb-1">{entity.label}</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Unique key: <Badge variant="secondary" className="text-xs">{entity.unique_key}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Wajib: {entity.required_fields.join(", ")}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Pilih <ArrowRight className="w-3 h-3" />
                    </div>
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
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Download Template Excel
            </CardTitle>
            <CardDescription>
              Template sudah berisi header dan 1 baris contoh. Isi data Anda mulai baris ke-3.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-sm">
                <strong>Panduan:</strong> Jangan hapus atau ubah header baris pertama.
                Baris ke-2 adalah contoh — hapus dan ganti dengan data Anda.
                Maksimum <strong>{MAX_ROWS.toLocaleString("id-ID")} baris</strong> per upload.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleDownloadTemplate}
              className="w-full gap-2"
              data-testid="btn-download-template"
            >
              <Download className="w-4 h-4" />
              Download Template — {selectedEntity.label}
            </Button>
            {currentStep === 1 && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setCurrentStep(2)}
                data-testid="btn-skip-template"
              >
                Sudah punya template? Lanjut ke Upload
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Upload & Preview */}
      {currentStep >= 2 && selectedEntity && (
        <Card data-testid="step-upload-preview">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload & Preview
            </CardTitle>
            <CardDescription>Upload file Excel lalu preview hasil validasi sebelum import</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                file ? "border-green-400 bg-green-50 dark:bg-green-950/20" : "border-border hover:border-primary"
              }`}
              onClick={() => fileInputRef.current?.click()}
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
                  <FileText className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-700 dark:text-green-400">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB — klik untuk ganti file
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Klik untuk pilih file Excel</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx atau .xls</p>
                </>
              )}
            </div>

            {file && (
              <Button
                onClick={handlePreview}
                disabled={uploading}
                className="w-full gap-2"
                data-testid="btn-preview"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Memvalidasi...</>
                ) : (
                  <><FileText className="w-4 h-4" /> Preview & Validasi</>  
                )}
              </Button>
            )}

            {/* Preview Results */}
            {previewResult && (
              <div className="space-y-4 pt-2" data-testid="preview-results">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Valid"
                    value={previewResult.summary.valid}
                    color="text-green-600"
                    bg="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    testid="preview-valid-count"
                  />
                  <StatCard
                    label="Invalid"
                    value={previewResult.summary.invalid}
                    color="text-red-600"
                    bg="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    testid="preview-invalid-count"
                  />
                  <StatCard
                    label="Total"
                    value={previewResult.total_rows}
                    color="text-primary"
                    bg="bg-muted"
                    testid="preview-total-count"
                  />
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
                        <CardTitle className="flex items-center gap-2 text-red-600 text-base">
                          <XCircle className="w-5 h-5" />
                          {previewResult.invalid_rows.length} Baris Error
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => downloadErrorCSV(selectedEntity.label, previewResult.invalid_rows)}
                          data-testid="btn-download-errors"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Download Error CSV
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
                              render: (row) => <span className="font-mono font-bold text-xs">{row.row_num}</span> },
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
                          <button
                            onClick={() => setShowAllErrors(v => !v)}
                            className="text-xs text-primary hover:underline"
                            data-testid="btn-show-all-errors"
                          >
                            {showAllErrors
                              ? "Tampilkan lebih sedikit"
                              : `Lihat semua ${previewResult.invalid_rows.length} error rows`}
                          </button>
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
              <ShieldCheck className="w-5 h-5 text-primary" />
              Konfirmasi & Import
            </CardTitle>
            <CardDescription>
              {previewResult.summary.valid} baris valid akan di-upsert ke database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <div className="text-muted-foreground text-xs">Entity</div>
                <div className="font-semibold mt-0.5">{selectedEntity.label}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">Akan di-import</div>
                <div className="font-semibold mt-0.5 text-green-600">{previewResult.summary.valid} baris valid</div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="gap-3">
            <Button
              onClick={handleCommit}
              disabled={committing}
              className="flex-1 gap-2"
              data-testid="btn-commit"
            >
              {committing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Commit Import</>
              )}
            </Button>
            <Button onClick={handleReset} variant="outline" data-testid="btn-cancel-commit">
              Batal
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
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Import Selesai!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Dibuat"
                value={importResult.created}
                color="text-green-600"
                bg="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                testid="result-created"
              />
              <StatCard
                label="Diperbarui"
                value={importResult.updated}
                color="text-blue-600"
                bg="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                testid="result-updated"
              />
              <StatCard
                label="Dilewati"
                value={importResult.skipped}
                color="text-muted-foreground"
                bg="bg-muted"
                testid="result-skipped"
              />
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
          <CardFooter>
            <Button onClick={handleReset} className="w-full gap-2" data-testid="btn-import-more">
              <RotateCcw className="w-4 h-4" /> Import Data Lainnya
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

