/**
 * useInventoryDashboard - React Query hooks for Inventory Portal
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Fetch Inventory home dashboard data with outlet scope
 */
export function useInventoryHome(outletId) {
  return useQuery({
    queryKey: ["inventory", "home", { outletId }],
    queryFn: async () => {
      const params = outletId ? { outlet_id: outletId } : {};
      const [v, mov, opn, low, mkt] = await Promise.all([
        api.get("/inventory/valuation", { params }),
        api.get("/inventory/movements", { params: { per_page: 8, ...params } }),
        api.get("/inventory/opname", { params: { status: "in_progress", per_page: 1, ...params } }),
        api.get("/inventory/low-stock", { params: { include_zero: true, include_negative: true, limit: 8, ...params } }),
        api.get("/market-list/items", { params: { ml_status: "pending_review", per_page: 5 } }).catch(() => ({ data: { data: [], meta: { total: 0 } } })),
      ]);
      
      return {
        valuation: unwrap(v),
        recent: unwrap(mov) || [],
        pendingOpname: opn.data?.meta?.total || 0,
        lowStock: unwrap(low) || { items: [], total_below: 0 },
        pendingMarket: {
          count: mkt.data?.meta?.total || 0,
          items: unwrap(mkt) || [],
        },
      };
    },
    staleTime: 30 * 1000,
  });
}
