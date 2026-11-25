/** DeleteTab — dangerous delete/truncate operations. */
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

// \u2500\u2500 Category config (mirrors backend) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
import { CATEGORY_ICONS, CATEGORY_COLORS, BADGE_COLORS } from "./constants";

function DeleteTab({ collections, onSuccess }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(null);
  const REQUIRED_PHRASE = "HAPUS SEMUA DATA";
  const categories = collections?.categories || {};

  const toggleCategory = (catId) => {
    if (catId === "ALL") {
      setSelectedCategories(prev => prev.includes("ALL") ? [] : ["ALL"]);
    } else {
      setSelectedCategories(prev => {
        const without = prev.filter(c => c !== "ALL");
        return without.includes(catId) ? without.filter(c => c !== catId) : [...without, catId];
      });
    }
  };

  const selectedDocs = selectedCategories.includes("ALL")
    ? (collections?.all_collections?.reduce((s, c) => s + c.count, 0) || 0)
    : selectedCategories.reduce((s, catId) => s + (categories[catId]?.total_docs || 0), 0);

  const handleDelete = async () => {
    if (selectedCategories.length === 0) {
      setStatus({ type: "error", msg: "Pilih minimal 1 kategori data" }); return;
    }
    if (confirmPhrase !== REQUIRED_PHRASE) {
      setStatus({ type: "error", msg: `Ketik "${REQUIRED_PHRASE}" untuk konfirmasi` }); return;
    }
    setDeleting(true);
    setStatus(null);
    try {
      const res = await api.post("/admin/data/delete", {
        categories: selectedCategories,
        confirm_phrase: confirmPhrase,
      });
      const total = res.data?.data?.total_deleted || 0;
      setStatus({ type: "success", msg: `${total.toLocaleString("id-ID")} records berhasil dihapus.` });
      setSelectedCategories([]);
      setConfirmPhrase("");
      onSuccess?.();
    } catch (e) {
      setStatus({ type: "error", msg: e.response?.data?.detail || e.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Warning */}
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-destructive">Perhatian: Operasi Tidak Dapat Dibatalkan</p>
          <p className="text-sm text-destructive mt-1">
            Data yang dihapus tidak dapat dikembalikan. Pastikan sudah melakukan <strong>export backup</strong> sebelum menghapus.
            Users, Roles, dan System Settings tidak akan dihapus.
          </p>
        </div>
      </div>

      {/* Category selector */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm md:text-base font-semibold">Pilih Data yang Akan Dihapus</h3>

        {/* Delete All option */}
        <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
          selectedCategories.includes("ALL") ? "border-destructive bg-destructive/10" : "border-border hover:border-destructive/50"
        }`}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedCategories.includes("ALL")}
              onChange={() => toggleCategory("ALL")}
              className="rounded accent-red-600"
            />
            <Trash2 className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">Hapus SEMUA Data</p>
              <p className="text-xs text-destructive">Kecuali Users, Roles, & System Settings</p>
            </div>
          </div>
          <span className="text-sm font-medium text-destructive bg-destructive/15 px-2 py-1 rounded">
            {(collections?.all_collections?.reduce((s, c) => s + c.count, 0) || 0).toLocaleString("id-ID")} docs
          </span>
        </label>

        {/* Individual categories */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Atau pilih per kategori:</p>
          {Object.entries(categories).map(([catId, cat]) => {
            const Icon = CATEGORY_ICONS[catId] || Package;
            const isSelected = selectedCategories.includes(catId);
            return (
              <label
                key={catId}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected ? "border-destructive bg-destructive/10" : "border-border hover:border-foreground/20"
                } ${selectedCategories.includes("ALL") ? "opacity-40 pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCategory(catId)}
                    className="rounded"
                    disabled={selectedCategories.includes("ALL")}
                  />
                  <div className={`p-1.5 rounded-md border ${CATEGORY_COLORS[catId]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.description?.slice(0, 50)}...</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${BADGE_COLORS[catId]}`}>
                  {(cat.total_docs || 0).toLocaleString("id-ID")} docs
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Summary & confirmation */}
      {selectedCategories.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold">Konfirmasi Penghapusan</h3>
            <span className="text-sm font-semibold text-destructive bg-destructive/10 px-3 py-1 rounded-full">
              {selectedDocs.toLocaleString("id-ID")} records akan dihapus
            </span>
          </div>

          <div className="space-y-1">
            <label htmlFor="delete-confirm-input" className="text-xs font-medium text-muted-foreground">
              Ketik <strong>{REQUIRED_PHRASE}</strong> untuk konfirmasi:
            </label>
            <input
              id="delete-confirm-input"
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={REQUIRED_PHRASE}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-medium tabular-nums focus:outline-none focus:ring-2 transition-all ${
                confirmPhrase === REQUIRED_PHRASE
                  ? "border-destructive focus:ring-red-200 bg-destructive/10"
                  : "border-border focus:ring-gray-200"
              }`}
              data-testid="delete-confirm-input"
            />
          </div>

          {status && (
            <div className={`flex items-start gap-2 p-3 rounded-lg ${
              status.type === "success" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-400"
                : "bg-destructive/10 border border-destructive/30 text-destructive"
            }`}>
              {status.type === "success" ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
              <p className="text-sm">{status.msg}</p>
            </div>
          )}

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || confirmPhrase !== REQUIRED_PHRASE}
            className="w-full"
            data-testid="delete-confirm-btn"
          >
            {deleting ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Menghapus...</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Hapus {selectedDocs.toLocaleString("id-ID")} Records</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default DeleteTab;
