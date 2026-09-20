/**
 * useFinanceListQueries - React Query hooks for Finance list pages
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * AR Invoice List with tabs (invoices, customers, aging, recon)
 */
export function useARInvoices(filterPeriod, filterStatus) {
  return useQuery({
    queryKey: ["finance", "ar-invoices", { filterPeriod, filterStatus }],
    queryFn: async () => {
      const params = {};
      if (filterPeriod) params.period = filterPeriod;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get("/ar/invoices", { params });
      return unwrap(res) || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useARCustomers() {
  return useQuery({
    queryKey: ["finance", "ar-customers"],
    queryFn: async () => {
      const res = await api.get("/ar/customers");
      return unwrap(res) || [];
    },
    staleTime: 60 * 1000, // 1 minute - customers don't change frequently
  });
}

export function useARAging() {
  return useQuery({
    queryKey: ["finance", "ar-aging"],
    queryFn: async () => {
      const res = await api.get("/ar/aging");
      return unwrap(res);
    },
    staleTime: 60 * 1000,
  });
}

export function useARRecon(reconPeriod) {
  return useQuery({
    queryKey: ["finance", "ar-recon", { reconPeriod }],
    queryFn: async () => {
      const res = await api.get("/ar/reconciliation", {
        params: { period: reconPeriod },
      });
      return unwrap(res);
    },
    staleTime: 60 * 1000,
  });
}
