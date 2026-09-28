/**
 * useProcurementDashboard - React Query hooks for Procurement Portal
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Fetch Procurement home dashboard data with stats and recent items
 */
export function useProcurementHome() {
  return useQuery({
    queryKey: ["procurement", "home"],
    queryFn: async () => {
      const [prSubmitted, prAll, poOpen, poAll, grAll] = await Promise.all([
        api.get("/procurement/prs", { params: { status: "submitted", per_page: 5 } }),
        api.get("/procurement/prs", { params: { per_page: 5 } }),
        api.get("/procurement/pos", { params: { status: "sent", per_page: 5 } }),
        api.get("/procurement/pos", { params: { per_page: 5 } }),
        api.get("/procurement/grs", { params: { per_page: 5 } }),
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

