/** ImportTab — upload JSON to seed/restore collections. */
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
import SimpleSelect from "@/components/shared/SimpleSelect";
import {
  Download, Upload, Trash2, Database, ChevronDown, ChevronUp,
  FileJson, FileSpreadsheet, Archive, AlertTriangle, CheckCircle,
  Eye, RefreshCw, X, Search, Package, DollarSign, ShoppingCart,
  BoxIcon, Users, Globe, Settings, BarChart3, Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";

// \u2500\u2500 Category config (mirrors backend) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
import { CATEGORY_ICONS, CATEGORY_COLORS } from "./constants";

function ImportTab({ collections, onSuccess }) {
  const [file, setFile] = useState(null);
  const [importMode, setImportMode] = useState("single"); // "single" or "full_backup"
  const [targetCollection, setTargetCollection] = useState("");
  const [mergeMode, setMergeMode] = useState("merge");
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();
  const allCollections = collections?.all_collections || [];

  const handleFile = (f) => {
    setFile(f);
    setStatus(null);
    setPreview(null);
    // Parse JSON for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          setPreview({ type: "array", count: data.length, keys: data[0] ? Object.keys(data[0]).slice(0, 8) : [] });
        } else if (data._meta) {
          const colls = Object.keys(data).filter(k => k !== "_meta");
          const total = colls.reduce((s, k) => s + (Array.isArray(data[k]) ? data[k].length : 0), 0);
          setPreview({ type: "backup", collections: colls, total, meta: data._meta });
          setImportMode("full_backup");
        }
      } catch {
        setPreview({ type: "error" });
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) { setStatus({ type: "error", msg: "Pilih file terlebih dahulu" }); return; }
    if (importMode === "single" && !targetCollection) {
      setStatus({ type: "error", msg: "Pilih koleksi target" }); return;
    }
    setImporting(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (importMode === "single") {
        formData.append("collection", targetCollection);
        formData.append("mode", mergeMode);
      } else {
        formData.append("mode", mergeMode);
      }

      const endpoint = importMode === "full_backup"
        ? "/api/admin/data/import/backup"
        : "/api/admin/data/import";

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          body: formData,
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.errors?.[0]?.message || "Import failed");

      const imported = data.data?.imported || data.data?.total_records || 0;
      setStatus({ type: "success", msg: `Import berhasil! ${imported} records diproses.` });
      onSuccess?.();
      setFile(null);
      setPreview(null);
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Upload zone */}
      <div
        className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        data-testid="import-dropzone"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
        />
        <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        {file ? (
          <div>
            <p className="font-medium text-gray-800">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 font-medium">Drop file JSON di sini atau klik untuk pilih</p>
            <p className="text-sm text-gray-400 mt-1">Format: .json (FnB ERP backup atau array)</p>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Preview File</h4>
          {preview.type === "backup" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Full Backup</span>
                <span className="text-sm text-gray-600">{preview.total?.toLocaleString("id-ID")} total records</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {preview.collections.map(c => (
                  <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{c}</span>
                ))}
              </div>
              {preview.meta?.exported_at && (
                <p className="text-xs text-gray-400">Exported: {new Date(preview.meta.exported_at).toLocaleString("id-ID")}</p>
              )}
            </div>
          ) : preview.type === "array" ? (
            <div>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Single Collection</span>
              <p className="text-sm text-gray-600 mt-1">{preview.count} records ditemukan</p>
              {preview.keys.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {preview.keys.map(k => (
                    <span key={k} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{k}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-500">File tidak dapat dibaca. Pastikan format JSON valid.</p>
          )}
        </div>
      )}

      {/* Import options */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-medium text-sm text-gray-800">Opsi Import</h3>

        {/* Mode */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Tipe Import</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "single", label: "Koleksi Tunggal", desc: "Import ke 1 koleksi" },
              { id: "full_backup", label: "Full Backup Restore", desc: "Restore semua koleksi" },
            ].map((m) => (
              <label
                key={m.id}
                className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                  importMode === m.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input type="radio" name="imode" value={m.id} checked={importMode === m.id}
                  onChange={() => setImportMode(m.id)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Target collection (single mode) */}
        {importMode === "single" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Koleksi Target</label>
            <SimpleSelect
              value={targetCollection}
              onValueChange={setTargetCollection}
              options={[{ value: "", label: "— Pilih koleksi —" }, ...allCollections.map(c => ({ value: c.name, label: `${c.name} (${c.count} records)` }))]}
              placeholder="— Pilih koleksi —"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              testId="import-target-collection"
            />
          </div>
        )}

        {/* Merge mode */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Mode Penggabungan</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "merge", label: "Merge (Upsert)", desc: "Update existing + tambah baru" },
              { id: "replace", label: "Replace", desc: "Hapus koleksi lalu insert" },
            ].map((m) => (
              <label key={m.id} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                mergeMode === m.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input type="radio" name="mmode" value={m.id} checked={mergeMode === m.id}
                  onChange={() => setMergeMode(m.id)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {mergeMode === "replace" && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-700">Mode <strong>Replace</strong> akan menghapus seluruh data di koleksi tujuan sebelum import. Pastikan Anda sudah memiliki backup!</p>
          </div>
        )}
      </div>

      {status && (
        <div className={`flex items-start gap-2 p-4 rounded-xl ${
          status.type === "success" ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {status.type === "success" ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm">{status.msg}</p>
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={importing || !file}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        data-testid="import-btn"
      >
        {importing ? (
          <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Importing...</>
        ) : (
          <><Upload className="w-4 h-4" /> Import Data</>
        )}
      </button>
    </div>
  );
}

// \u2500\u2500 Delete Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export default ImportTab;
