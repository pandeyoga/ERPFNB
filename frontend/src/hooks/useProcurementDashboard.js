/**
 * useProcurementDashboard - React Query hooks for Procurement Portal
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Fetch Procurement home dashboard data with stats and recent items
 */
export function useProcurementHome({ canPO = true, canGR = true } = {}) {
  return useQuery({
    queryKey: ["procurement", "home", canPO, canGR],
    queryFn: async () => {
      // Hanya panggil daftar yang boleh dibaca peran ini: satu 403 di Promise.all dulu mengosongkan SELURUH KPI
      // (mis. Outlet Manager yang boleh melihat PR tetapi tidak PO/GR).
      const none = Promise.resolve({ data: { data: [], meta: { total: 0 } } });
      const [prSubmitted, prAll, poOpen, poAll, grAll] = await Promise.all([
        api.get("/procurement/prs", { params: { status: "submitted", per_page: 5 } }),
        api.get("/procurement/prs", { params: { per_page: 5 } }),
        canPO ? api.get("/procurement/pos", { params: { status: "sent", per_page: 5 } }) : none,
        canPO ? api.get("/procurement/pos", { params: { per_page: 5 } }) : none,
        canGR ? api.get("/procurement/grs", { params: { per_page: 5 } }) : none,
      ]);

      return {
        stats: {
          pr_pending: prSubmitted.data?.meta?.total || 0,
          pr_total: prAll.data?.meta?.total || 0,
          po_open: poOpen.data?.meta?.total || 0,
          po_total: poAll.data?.meta?.total || 0,
          gr_total: grAll.data?.meta?.total || 0,
        },
        recentPR: unwrap(prAll) || [],
        recentPO: unwrap(poAll) || [],
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

