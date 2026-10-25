/** navigationSchema/hr.js — Hr portal navigation. */

import { LayoutDashboard, CalendarDays, Wallet, Briefcase } from "lucide-react";

export const hrNav = {
  id: "hr",
  name: "HR Portal",
  sections: [
    {
      id: "dashboard",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Overview", path: "/hr" },
      ],
    },
    {
      id: "leave",
      name: "Leave Requests",
      icon: CalendarDays,
      items: [
        { id: "leave-requests", name: "Leave Requests", path: "/hr/leaves" },
      ],
    },
    {
      id: "compensation",
      name: "Compensation",
      icon: Wallet,
      items: [
        // Advances · Service Charge · Incentive · Voucher · FOC · LB Fund · Payroll
        // are in-page TABS of /hr/compensation.
        { id: "comp-hub", name: "Compensation", path: "/hr/compensation" },
      ],
    },
    {
      id: "hr-config",
      name: "Recruitment",
      icon: Briefcase,
      items: [
        // Employees dikelola di Admin → Master Data (bukan duplikat di sini).
        { id: "job-listings", name: "Job Listings", path: "/hr/job-listings" },
        { id: "job-applications", name: "Job Applications", path: "/hr/job-applications" },
      ],
    },
  ],
};
