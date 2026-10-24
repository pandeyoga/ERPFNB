/** navigationSchema/executive.js — Executive portal navigation. */

import { LayoutDashboard, LineChart, PiggyBank, Brain, CalendarCheck } from "lucide-react";

export const executiveNav = {
  id: "executive",
  name: "Executive Portal",
  sections: [
    {
      id: "dashboard",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "owner-home", name: "Overview", path: "/executive" },
      ],
    },
    {
      id: "performance",
      name: "Analytics",
      icon: LineChart,
      items: [
        { id: "analytics-dashboard", name: "Sales Analytics", path: "/executive/analytics" },
        { id: "analytics-hub", name: "Performance Analytics", path: "/executive/analytics-hub", matchPaths: ["/executive/brand", "/executive/profit-walk", "/executive/period-compare", "/executive/outlet"] },
        // Brand Mix · Profit Walk · Period Compare are in-page TABS of
        // /executive/analytics-hub (consolidated to keep Executive sidebar <=12 items).
      ],
    },
    {
      id: "outlet-budget",
      name: "Outlet Budget",
      icon: PiggyBank,
      items: [
        { id: "outlet-budget-set", name: "Budget Allocation", path: "/executive/outlet-budgets" },
        { id: "outlet-budget-monitor", name: "Budget Monitor", path: "/executive/budget-monitor" },
        { id: "budget-approvals", name: "Budget Approvals", path: "/executive/budget-approvals" },
        { id: "outlet-budget-increase", name: "Increase Requests", path: "/executive/budget-increase-requests" },
      ],
    },
    {
      id: "ai-insights",
      name: "AI Insights",
      icon: Brain,
      items: [
        { id: "exec-qa", name: "Executive Q&A", path: "/executive/ai-qa" },
        { id: "anomaly", name: "Anomaly Detection", path: "/executive/anomaly" },
      ],
    },
    {
      id: "reservations-exec",
      name: "Reservations",
      icon: CalendarCheck,
      items: [
        { id: "reservation-summary", name: "Reservations", path: "/executive/reservations" },
      ],
    },
  ],
};
