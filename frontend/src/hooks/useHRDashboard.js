/**
 * useHRDashboard - React Query hooks for HR Portal
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Fetch HR home dashboard data
 */
export function useHRHome() {
  return useQuery({
    queryKey: ["hr", "home"],
    queryFn: async () => {
      const res = await api.get("/hr/dashboard");
      return unwrap(res) || {};
    },
    staleTime: 30 * 1000,
  });
}
