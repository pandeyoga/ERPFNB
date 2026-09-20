/**
 * useFinanceDashboard - React Query hooks for Finance Portal
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Fetch Finance home dashboard data
 */
export function useFinanceHome() {
  return useQuery({
    queryKey: ["finance", "home"],
    queryFn: async () => {
      const res = await api.get("/finance/home");
      return unwrap(res) || {};
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
