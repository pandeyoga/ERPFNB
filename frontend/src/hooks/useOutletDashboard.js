/**
 * useOutletDashboard - React Query hooks for Outlet Portal
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Fetch Outlet home dashboard data with outlet scope
 */
export function useOutletHome(outletId, scopeLoaded) {
  return useQuery({
    queryKey: ["outlet", "home", { outletId }],
    queryFn: async () => {
      const params = outletId ? { outlet_id: outletId } : {};
      const res = await api.get("/outlet/home", { params });
      return unwrap(res) || {};
    },
    enabled: scopeLoaded, // Only fetch when scope is loaded
    staleTime: 30 * 1000,
  });
}
