/**
 * useOwnerDashboard - React Query hooks for Owner Portal
 */
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";

/**
 * Fetch Owner home dashboard with multiple data sources
 */
export function useOwnerHome() {
  return useQuery({
    queryKey: ["owner", "home"],
    queryFn: async () => {
      const [home, anomalies, approvals, notifs] = await Promise.all([
        api.get("/executive/home").then(unwrap),
        api.get("/anomalies/summary").then(unwrap),
        api.get("/approvals/counts").then(unwrap),
        api.get("/notifications", { params: { limit: 5 } }).then(unwrap),
      ]);
      
      return {
        home: home || {},
        anomalySummary: anomalies || null,
        approvalCounts: approvals || null,
        notifications: notifs || [],
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
