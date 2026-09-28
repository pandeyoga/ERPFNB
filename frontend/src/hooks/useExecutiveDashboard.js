/**
 * useExecutiveDashboard - React Query hooks for Executive Dashboard
 * Replaces manual useState + useEffect patterns with cached queries
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

const BRAND_PALETTE = [
  "#5B5FE3", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16",
];

/**
 * Fetch brands master data with color palette
 */
export function useBrands() {
  return useQuery({
    queryKey: ["master", "brands"],
    queryFn: async () => {
      const res = await api.get("/master/brands");
      const brandsRaw = res.data?.data || [];
      return brandsRaw.map((b, i) => ({
        id: b.id,
        label: b.name || b.code || b.id,
        color: b.color || BRAND_PALETTE[i % BRAND_PALETTE.length],
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - master data changes infrequently
  });
}

/**
 * Fetch outlets master data
 */
export function useOutlets() {
  return useQuery({
    queryKey: ["master", "outlets"],
    queryFn: async () => {
      const res = await api.get("/master/outlets");
      const outletsRaw = res.data?.data || [];
      return outletsRaw.map((o) => ({
        id: o.id,
        label: o.name || o.code || o.id,
        brand_id: o.brand_id,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch executive KPIs with filters
 */
export function useExecutiveKPIs(filterParams, enabled = true) {
  return useQuery({
    queryKey: ["executive", "kpis", filterParams],
    queryFn: async () => {
      const res = await api.get("/executive/kpis", { params: filterParams });
      return unwrap(res);
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds - KPIs are relatively fresh
  });
}

/**
 * Fetch sales trend with filters
 */
export function useSalesTrend(filterParams, days, enabled = true) {
  return useQuery({
    queryKey: ["executive", "sales-trend", { ...filterParams, days }],
    queryFn: async () => {
      const res = await api.get("/executive/sales-trend", { 
        params: { days, ...filterParams } 
      });
      return unwrap(res);
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch brand mix data with filters
 */
export function useBrandMix(filterParams, enabled = true) {
  return useQuery({
    queryKey: ["executive", "brand-mix", filterParams],
    queryFn: async () => {
      const res = await api.get("/executive/brand-mix", { params: filterParams });
      return unwrap(res);
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch AP aging summary
 */
export function useAPAgingSummary(enabled = true) {
  return useQuery({
    queryKey: ["executive", "ap-aging-summary"],
    queryFn: async () => {
      const res = await api.get("/executive/ap-aging-summary");
      return unwrap(res);
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - aging data doesn't change frequently
  });
}

/**
 * Fetch user dashboard preset preference
 */
export function useDashboardPreset(presetKey = "dashboard_preset_executive") {
  return useQuery({
    queryKey: ["preferences", "me", presetKey],
    queryFn: async () => {
      const res = await api.get("/preferences/me");
      return unwrap(res)?.preferences?.[presetKey] ?? null;
    },
    staleTime: Infinity, // Preferences rarely change
  });
}
