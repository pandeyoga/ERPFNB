/** DataManagement/index.jsx — orchestrator, imports sub-components. */
/**
 * DataManagement.jsx — Import / Export / Delete System Data
 * Accessible at: /admin/data-management
 * Features:
 *   - Export: select collections by category or individually → JSON / XLSX / ZIP
 *   - Import: upload JSON file → single collection or full backup restore
 *   - Delete: granular delete by category with confirmation phrase
 *   - Preview: view first N records of any collection
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { logger } from "@/lib/logger";
import { RefreshCw, Database, Package, Shield } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";

import { TABS } from "./constants";
import ExportTab from "./ExportTab";
import ImportTab from "./ImportTab";
import DeleteTab from "./DeleteTab";

/** embedded=true saat dirender di hub Monitoring (/admin/operations/data-management):
 *  tanpa PageHeader karena judul halaman sudah dari hub. */
export default function DataManagement({ embedded = false }) {
  const [activeTab, setActiveTab] = useState("export");
  const [collections, setCollections] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/data/collections");
      setCollections(res.data?.data);
    } catch (e) {
      logger.error("Data management operation failed", { error: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  const intro = "Backup, restore, dan kelola seluruh data sistem FnB Group ERP.";
  const refreshBtn = (
    <Button variant="outline" onClick={loadCollections} disabled={loading} data-testid="dm-refresh">
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      Muat ulang
    </Button>
  );

  const allColls = collections?.all_collections || [];
  const totalDocs = allColls.reduce((s, c) => s + (c.count || 0), 0);
  const totalColls = allColls.filter(c => c.count > 0).length;
  const catCount = Object.keys(collections?.categories || {}).length;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="data-management-page">
      <PageHeader icon={Database} title="Data Management" subtitle={intro} actions={refreshBtn} />

      {loading && !collections ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Stats */}
          {collections && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="dm-stats">
              <CompactStatCard testId="dm-stat-total-records" label="Total Records" value={totalDocs.toLocaleString("id-ID")} icon={Database} color="aurora-3" />
              <CompactStatCard testId="dm-stat-koleksi-aktif" label="Koleksi Aktif" value={totalColls} icon={Package} color="aurora-4" />
              <CompactStatCard testId="dm-stat-kategori" label="Kategori" value={catCount} icon={Shield} color="aurora-2" />
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList data-testid="dm-tabs">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} data-testid={`dm-tab-${tab.id}`}>
                    <Icon />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "export" && <ExportTab collections={collections} />}
              {activeTab === "import" && <ImportTab collections={collections} onSuccess={loadCollections} />}
              {activeTab === "delete" && <DeleteTab collections={collections} onSuccess={loadCollections} />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
