/**
 * useExcelExport — Shared hook untuk download Excel (.xlsx) dari backend.
 *
 * Usage:
 *   const { downloading, exportXlsx } = useExcelExport();
 *   exportXlsx("/anomalies/export/xlsx", "anomaly_feed.xlsx", { status, severity });
 */
import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function useExcelExport() {
  const [downloading, setDownloading] = useState(false);

  async function exportXlsx(endpoint, filename, params = {}) {
    setDownloading(true);
    try {
      // Filter out empty/undefined params
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      const response = await api.get(endpoint, {
        params: cleanParams,
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${filename} berhasil diunduh`);
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Gagal mengunduh file Excel");
    } finally {
      setDownloading(false);
    }
  }

  return { downloading, exportXlsx };
}
