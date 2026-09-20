/**
 * useAdminDashboard - React Query hooks for Admin Portal
 */
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

const MASTER_TILES = [
  { entity: "items", col: "items" },
  { entity: "vendors", col: "vendors" },
  { entity: "employees", col: "employees" },
  { entity: "chart-of-accounts", col: "chart_of_accounts" },
  { entity: "brands", col: "brands" },
  { entity: "outlets", col: "outlets" },
  { entity: "categories", col: "categories" },
  { entity: "payment-methods", col: "payment_methods" },
];

/**
 * Fetch Admin home dashboard stats
 */
export function useAdminHome(canViewUsers) {
  return useQuery({
    queryKey: ["admin", "home", { canViewUsers }],
    queryFn: async () => {
      const tiles = MASTER_TILES.map(t => t.entity);
      const results = await Promise.allSettled([
        ...tiles.map(e => api.get(`/master/${e}`, { params: { per_page: 1 } })),
        ...(canViewUsers ? [
          api.get("/admin/users", { params: { per_page: 1 } }),
          api.get("/admin/roles"),
          api.get("/admin/audit-log", { params: { per_page: 1 } }),
        ] : []),
      ]);
      
      const result = {};
      tiles.forEach((e, i) => {
        if (results[i].status === "fulfilled") {
          result[e] = results[i].value.data?.meta?.total || 0;
        }
      });
      
      if (canViewUsers) {
        const uIdx = tiles.length;
        if (results[uIdx]?.status === "fulfilled") result.users = results[uIdx].value.data?.meta?.total || 0;
        if (results[uIdx + 1]?.status === "fulfilled") result.roles = (results[uIdx + 1].value.data?.data || []).length;
        if (results[uIdx + 2]?.status === "fulfilled") result.audit = results[uIdx + 2].value.data?.meta?.total || 0;
      }
      
      return result;
    },
    staleTime: 60 * 1000, // 1 minute - admin stats don't change frequently
  });
}
