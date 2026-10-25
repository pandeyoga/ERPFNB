/** navigationSchema/owner.js — Owner portal navigation. */

import { Crown, Sparkles, Wallet, BellRing } from "lucide-react";

export const ownerNav = {
  id: "owner",
  name: "Owner Portal",
  sections: [
    {
      id: "cockpit",
      name: "Cockpit",
      icon: Crown,
      items: [
        { id: "overview", name: "Overview", path: "/owner" },
        { id: "daily-briefing", name: "AI Daily Briefing", path: "/owner/briefing" },
      ],
    },
    {
      id: "financial",
      name: "Cash Position",
      icon: Wallet,
      items: [
        { id: "cash-position", name: "Cash Position", path: "/owner/cash" },
      ],
    },
    {
      id: "ai",
      name: "Business Q&A",
      icon: Sparkles,
      items: [
        { id: "business-qa", name: "Business Q&A", path: "/owner/ai-assistant" },
      ],
    },
    {
      id: "digest",
      name: "Alert Settings",
      icon: BellRing,
      items: [
        { id: "digest-settings", name: "Alert Settings", path: "/owner/digest-settings" },
      ],
    },
    // Approval Center dihapus dari sidebar portal: satu inbox global di "Pusat Persetujuan".
  ],
};
