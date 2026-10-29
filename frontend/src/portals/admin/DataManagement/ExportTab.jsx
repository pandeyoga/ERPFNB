/** ExportTab — bulk export/download collections. */
/**
 * DataManagement.jsx — Import / Export / Delete System Data
 * Accessible at: /admin/data-management
 * Features:
 *   - Export: select collections by category or individually → JSON / XLSX / ZIP
 *   - Import: upload JSON file → single collection or full backup restore
 *   - Delete: granular delete by category with confirmation phrase
 *   - Preview: view first N records of any collection
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Upload, Trash2, Database, ChevronDown, ChevronUp,
  FileJson, FileSpreadsheet, Archive, AlertTriangle, CheckCircle,
  Eye, RefreshCw, X, Search, Package, DollarSign, ShoppingCart,
  BoxIcon, Users, Globe, Settings, BarChart3, Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";

// \u2500\u2500 Category config (mirrors backend) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
import { CATEGORY_ICONS, CATEGORY_COLORS, BADGE_COLORS } from "./constants";

function ExportTab({ collections }) {
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [exportFormat, setExportFormat] = useState("json");
  const [exporting, setExporting] = useState(false);
  const [expandedCats, setExpandedCats] = useState({});
  const [previewColl, setPreviewColl] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [status, setStatus] = useState(null);

  const categories = collections?.categories || {};
  const allCollections = collections?.all_collections || [];

  const toggleCategory = (catId) => {
    const catColls = categories[catId]?.collections || [];
    const collNames = catColls.map(c => c.name);
    const allSelected = collNames.every(n => selectedCollections.includes(n));
    if (allSelected) {
      setSelectedCollections(prev => prev.filter(n => !collNames.includes(n)));
    } else {
      setSelectedCollections(prev => [...new Set([...prev, ...collNames])]);
    }
  };

  const toggleCollection = (name) => {
    setSelectedCollections(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const selectAll = () => {
    setSelectedCollections(allCollections.map(c => c.name));
  };

  const clearAll = () => setSelectedCollections([]);

  /** POST /admin/data/export lalu unduh file; melempar error bila server menolak
   *  (sebelumnya Quick Export tidak mengecek response.ok dan mengunduh JSON error). */
  const downloadExport = async (colls, format) => {
    const response = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}/api/admin/data/export`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ collections: colls, format }),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.errors?.[0]?.message || err.detail || "Ekspor gagal");
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition") || "";
    const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
    const filename = filenameMatch ? filenameMatch[1] : `aurora_export.${format === "xlsx" ? "xlsx" : format === "zip_json" ? "zip" : "json"}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return filename;
  };

  const runExport = async (colls, format, successMsg) => {
    setExporting(true);
    setStatus(null);
    try {
      const filename = await downloadExport(colls, format);
      setStatus({ type: "success", msg: successMsg(filename) });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    if (selectedCollections.length === 0) {
      setStatus({ type: "error", msg: "Pilih minimal 1 koleksi untuk di-export" });
      return;
    }
    runExport(selectedCollections, exportFormat,
      (fn) => `Export berhasil! ${selectedCollections.length} koleksi di-export sebagai ${fn}`);
  };

  const handlePreview = async (collName) => {
    if (previewColl === collName) {
      setPreviewColl(null);
      setPreviewData(null);
      return;
    }
    setPreviewColl(collName);
    setLoadingPreview(true);
    try {
      const res = await api.get(`/admin/data/preview/${collName}?limit=5`);
      setPreviewData(res.data?.data);
    } catch (e) {
      setPreviewData({ error: e.message });
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
      {/* Left: Collection selector */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-card">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm md:text-base font-semibold">Pilih Koleksi Data</h3>
              {selectedCollections.length > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {selectedCollections.length} dipilih
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} data-testid="dm-select-all">
                Pilih Semua
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} data-testid="dm-clear-selection">
                Hapus Pilihan
              </Button>
            </div>
          </div>

          <div className="divide-y max-h-[560px] overflow-y-auto">
            {Object.entries(categories).map(([catId, cat]) => {
              const Icon = CATEGORY_ICONS[catId] || Package;
              const isExpanded = expandedCats[catId];
              const catColls = cat.collections || [];
              const selectedInCat = catColls.filter(c => selectedCollections.includes(c.name)).length;
              const allInCatSelected = catColls.length > 0 && selectedInCat === catColls.length;

              return (
                <div key={catId}>
                  <div
                    className="flex items-center justify-between p-3 hover:bg-foreground/5 cursor-pointer"
                    onClick={() => setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }))}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allInCatSelected}
                        indeterminate={selectedInCat > 0 && !allInCatSelected ? "true" : undefined}
                        onChange={(e) => { e.stopPropagation(); toggleCategory(catId); }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                        aria-label={`Pilih semua koleksi ${cat.label || catId}`}
                      />
                      <div className={`p-1.5 rounded-md border ${CATEGORY_COLORS[catId]}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.total_docs?.toLocaleString("id-ID")} records</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedInCat > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${BADGE_COLORS[catId]}`}>
                          {selectedInCat}/{catColls.length}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-muted/40 border-t">
                      {catColls.map((coll) => (
                        <div key={coll.name}>
                          <div className="flex items-center justify-between px-10 py-2 hover:bg-foreground/5">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedCollections.includes(coll.name)}
                                onChange={() => toggleCollection(coll.name)}
                                className="rounded"
                                aria-label={`Pilih koleksi ${coll.name}`}
                              />
                              <span className="text-sm text-foreground font-medium tabular-nums">{coll.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{coll.count?.toLocaleString("id-ID")} docs</span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handlePreview(coll.name)}
                                title="Preview data"
                                aria-label={`Preview data ${coll.name}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Inline preview */}
                          {previewColl === coll.name && (
                            <div className="mx-10 mb-2 bg-background border rounded-lg overflow-hidden">
                              {loadingPreview ? (
                                <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                                  <div className="animate-spin w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full" />
                                  Loading preview...
                                </div>
                              ) : previewData ? (
                                <div className="p-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Preview: {previewData.preview_count} of {previewData.total?.toLocaleString("id-ID")} records
                                  </p>
                                  {previewData.records?.length === 0 && (
                                    <p className="text-xs text-muted-foreground py-2">Belum ada data pada koleksi ini.</p>
                                  )}
                                  {previewData.records?.length > 0 && (
                                    <DataTable
                                      rows={previewData.records}
                                      rowTestIdPrefix="export-preview-row"
                                      className="text-xs"
                                      columns={Object.keys(previewData.records[0]).slice(0, 5).map((k, ci) => ({
                                        key: k,
                                        label: k,
                                        primary: ci === 0,
                                        render: (row) => {
                                          const val = row[k];
                                          const str = typeof val === "object"
                                            ? JSON.stringify(val).slice(0, 30) + "..."
                                            : String(val ?? "—").slice(0, 30);
                                          return <span className="text-muted-foreground max-w-[120px] truncate inline-block align-top">{str}</span>;
                                        },
                                      }))}
                                    />
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Export options */}
      <div className="space-y-4">
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" />
            Opsi Ekspor
          </h3>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Format File</p>
            <div className="space-y-2">
              {[
                { id: "json", label: "JSON", icon: FileJson, desc: "Single file, semua koleksi" },
                { id: "xlsx", label: "Excel (XLSX)", icon: FileSpreadsheet, desc: "Satu sheet per koleksi" },
                { id: "zip_json", label: "ZIP + JSON", icon: Archive, desc: "File JSON per koleksi dalam ZIP" },
              ].map((fmt) => {
                const Icon = fmt.icon;
                return (
                  <label
                    key={fmt.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      exportFormat === fmt.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={fmt.id}
                      checked={exportFormat === fmt.id}
                      onChange={() => setExportFormat(fmt.id)}
                      className="text-primary"
                    />
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{fmt.label}</p>
                      <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{selectedCollections.length}</span> koleksi dipilih
            </p>
          </div>

          {status && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              status.type === "success" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
            }`}>
              {status.type === "success" ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {status.msg}
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={exporting || selectedCollections.length === 0}
            className="w-full"
            data-testid="export-btn"
          >
            {exporting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Mengekspor...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Ekspor {selectedCollections.length > 0 ? `(${selectedCollections.length})` : ""}
              </>
            )}
          </Button>
        </div>

        {/* Quick export buttons */}
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm md:text-base font-semibold">Ekspor Cepat</h3>
          <div className="space-y-2">
            {[
              { id: "full", label: "Full Backup (semua data)", collections: ["all"], format: "zip_json" },
              { id: "master", label: "Master Data Only", collections: Object.values(collections?.categories?.master?.collections || []).map(c => c.name), format: "json" },
              { id: "finance", label: "Finance Data", collections: Object.values(collections?.categories?.finance?.collections || []).map(c => c.name), format: "xlsx" },
              { id: "outlet", label: "Outlet Data", collections: Object.values(collections?.categories?.outlet?.collections || []).map(c => c.name), format: "json" },
            ].map((quick) => (
              <Button
                key={quick.label}
                type="button"
                variant="outline"
                onClick={() => runExport(quick.collections.filter(Boolean), quick.format, () => `${quick.label} berhasil di-export!`)}
                disabled={exporting || quick.collections.filter(Boolean).length === 0}
                className="w-full justify-between font-normal"
                data-testid={`dm-quick-export-${quick.id}`}
              >
                <span>{quick.label}</span>
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// \u2500\u2500 Import Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export default ExportTab;
