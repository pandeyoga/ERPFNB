/**
 * useListQuery - Generic React Query hook for paginated list pages
 * 
 * Provides consistent pattern for list pages with pagination, filters, and search
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Generic list query hook
 * @param {string} endpoint - API endpoint (e.g., "/procurement/prs")
 * @param {object} params - Query parameters (page, per_page, filters, etc.)
 * @param {object} options - Additional useQuery options
 */
export function useListQuery(endpoint, params = {}, options = {}) {
  return useQuery({
    queryKey: [endpoint, params],
    queryFn: async () => {
      const res = await api.get(endpoint, { params });
      return {
        data: unwrap(res) || [],
        meta: res.data?.meta || { total: 0, page: 1, per_page: 20 },
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    keepPreviousData: true, // Keep old data while fetching new page
    ...options,
  });
}

/**
 * Specialized hook for list pages with common patterns
 */
export function usePaginatedList(endpoint, filters = {}, page = 1, perPage = 20) {
  const params = {
    page,
    per_page: perPage,
    ...filters,
  };
  
  return useListQuery(endpoint, params);
}
