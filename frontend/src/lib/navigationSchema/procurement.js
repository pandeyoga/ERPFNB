/** navigationSchema/procurement.js — Procurement portal navigation. */

import { LayoutDashboard, ClipboardList, ShoppingCart, Truck, Store, BarChart3 } from "lucide-react";

export const procurementNav = {
  id: "procurement",
  name: "Procurement Portal",
  // Urutan = alur dokumen: PR → RFQ → PO → GR, lalu vendor & analitik harga.
  sections: [
    {
      id: "dashboard",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Overview", path: "/procurement" },
      ],
    },
    {
      id: "requests",
      name: "Requests",
      icon: ClipboardList,
      items: [
        { id: "pr", name: "Purchase Requests", path: "/procurement/pr" },
        { id: "consolidation", name: "PR Consolidation", path: "/procurement/consolidation" },
        { id: "rfq", name: "RFQ", path: "/procurement/rfq" },
      ],
    },
    {
      id: "purchase-orders",
      name: "Orders",
      icon: ShoppingCart,
      items: [
        { id: "po", name: "Purchase Orders", path: "/procurement/po" },
        { id: "kanban", name: "PO Kanban Board", path: "/procurement/kanban" },
        { id: "comparison", name: "PO Comparison", path: "/procurement/po-comparison" },
      ],
    },
    {
      id: "goods-receipt",
      name: "Goods Receipt",
      icon: Truck,
      items: [
        { id: "gr", name: "Goods Receipt", path: "/procurement/gr" },
      ],
    },
    {
      id: "vendors",
      name: "Vendors",
      icon: Store,
      items: [
        { id: "vendors", name: "Vendors", path: "/procurement/vendors", matchPaths: ["/procurement/vendor-scorecard", "/procurement/vendor-comparison", "/procurement/vendor-recommend", "/procurement/vendor-catalog"] },
        // Vendor Scorecard · Comparison · AI Recommend · Item Catalog are pill-links
        // inside /procurement/vendors (removed from sidebar to dedupe IA).
      ],
    },
    {
      id: "smart-procurement",
      name: "Price Intelligence",
      icon: BarChart3,
      items: [
        { id: "price-intelligence", name: "Price Intelligence", path: "/procurement/price-intelligence" },
      ],
    },
  ],
};
