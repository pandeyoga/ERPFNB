/**
 * React Query Client Configuration
 * 
 * Provides caching, request deduplication, and automatic retry logic
 * to reduce redundant API calls and improve performance.
 *
 * Bug fix RC-4 + RC-9 (2026-05-26):
 *  - Reduced 5xx retry from 2x → 1x so deterministic 500s fail in ~1s
 *    instead of ~4s (less time stuck in "blank" loading state).
 *  - Special-cased 429 (rate limit) to retry ONCE after server-suggested
 *    Retry-After delay, instead of immediately erroring out. This prevents
 *    a transient rate-limit burst from cascading into a visible error.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache configuration
      staleTime: 5 * 60 * 1000,      // Data considered fresh for 5 minutes
      gcTime: 10 * 60 * 1000,        // Garbage collection after 10 minutes (formerly cacheTime)
      
      // Retry configuration with exponential backoff
      retry: (failureCount, error) => {
        const status = error?.response?.status;

        // 429 (rate limit): retry ONCE after backoff so transient bursts
        // recover gracefully. The retryDelay below honors Retry-After if present.
        if (status === 429) return failureCount < 1;

        // Other 4xx (client errors): do not retry — these are deterministic.
        if (status >= 400 && status < 500) {
          return false;
        }

        // 5xx (server errors): retry ONCE only (was 2x). Fast-fail keeps the
        // user-visible "loading" window under ~1.2s for deterministic 500s.
        return failureCount < 1;
      },
      
      retryDelay: (attemptIndex, error) => {
        const status = error?.response?.status;
        // For 429, honor server's Retry-After header if it's a small value (<10s)
        if (status === 429) {
          const retryAfter = error?.response?.headers?.['retry-after'];
          if (retryAfter) {
            const sec = parseInt(retryAfter, 10);
            if (!Number.isNaN(sec) && sec > 0 && sec <= 10) {
              return sec * 1000;
            }
          }
          return 1500; // default 1.5s for rate-limit backoff
        }
        // Exponential backoff for 5xx: 800ms, 1600ms (capped at 5s)
        return Math.min(800 * Math.pow(2, attemptIndex), 5000);
      },
      
      // Prevent automatic refetch on window focus (reduce unnecessary calls)
      refetchOnWindowFocus: false,
      
      // Only refetch on mount if data is stale
      refetchOnMount: 'stale',
      
      // Don't refetch on reconnect (reduces burst requests)
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry mutations once on network errors
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * Query key factory for consistent cache key generation
 */
export const queryKeys = {
  // Owner portal
  owner: {
    briefing: ['owner', 'briefing'],
    digest: {
      subscriptions: ['owner', 'digest', 'subscriptions'],
    },
    telegram: {
      info: ['owner', 'telegram', 'info'],
    },
  },
  
  // Approvals
  approvals: {
    queue: (params) => ['approvals', 'queue', params],
    counts: (params) => ['approvals', 'counts', params],
    delegations: ['approvals', 'delegations'],
  },
  
  // Inventory
  inventory: {
    balance: (outletId) => ['inventory', 'balance', outletId],
    movements: (params) => ['inventory', 'movements', params],
  },
  
  // Procurement
  procurement: {
    pos: (params) => ['procurement', 'pos', params],
    grs: (params) => ['procurement', 'grs', params],
  },
  
  // Outlets
  outlets: {
    list: ['outlets', 'list'],
    detail: (id) => ['outlets', 'detail', id],
  },
};

export default queryClient;
