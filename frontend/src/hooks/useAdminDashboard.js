/**
 * useAdminDashboard - React Query hooks for Admin Portal
 */
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

/** Tile master data di Admin home — satu sumber untuk hook ini dan AdminHome.jsx. */
export const MASTER_TILES = [
  { entity: "items",             label: "Items" },
  { entity: "vendors",           label: "Vendors" },
  { entity: "employees",         label: "Employees" },
  { entity: "chart-of-accounts", label: "COA" },
  { entity: "brands",            label: "Brands" },
  { entity: "outlets",           label: "Outlets" },
  { entity: "categories",        label: "Categories" },
  { entity: "payment-methods",   label: "Metode bayar" },
  { entity: "bank-accounts",     label: "Bank Accounts" },
  { entity: "tax-codes",         label: "Tax Codes" },
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
        // Cukup meta.total — per_page=1, tidak perlu memuat semua baris.
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
