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
export function useAdminHome(access = {}) {
  const { users = false, roles = false, audit = false } = access;
  return useQuery({
    queryKey: ["admin", "home", { users, roles, audit }],
    queryFn: async () => {
      const tiles = MASTER_TILES.map(t => t.entity);
      // Hanya endpoint yang diizinkan peran ini (lihat AdminHome) — tidak ada 403 yang pasti.
      const extra = [
        users && ["users", api.get("/admin/users", { params: { per_page: 1 } }), (r) => r.data?.meta?.total || 0],
        roles && ["roles", api.get("/admin/roles"), (r) => (r.data?.data || []).length],
        audit && ["audit", api.get("/admin/audit-log", { params: { per_page: 1 } }), (r) => r.data?.meta?.total || 0],
      ].filter(Boolean);
      const results = await Promise.allSettled([
        // Cukup meta.total — per_page=1, tidak perlu memuat semua baris.
        ...tiles.map(e => api.get(`/master/${e}`, { params: { per_page: 1 } })),
        ...extra.map(([, req]) => req),
      ]);

      const result = {};
      tiles.forEach((e, i) => {
        if (results[i].status === "fulfilled") {
          result[e] = results[i].value.data?.meta?.total || 0;
        }
      });
      extra.forEach(([key, , pick], j) => {
        const r = results[tiles.length + j];
        if (r?.status === "fulfilled") result[key] = pick(r.value);
      });

      return result;
    },
    staleTime: 60 * 1000, // 1 minute - admin stats don't change frequently
  });
}
