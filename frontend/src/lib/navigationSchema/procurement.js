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
        { id: "kanban", name: "Procurement Kanban", path: "/procurement/kanban" },
        { id: "comparison", name: "Vendor Comparison", path: "/procurement/vendor-comparison" },
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
        { id: "vendors", name: "Vendors", path: "/procurement/vendors", matchPaths: ["/procurement/vendor-scorecard", "/procurement/vendor-recommend", "/procurement/vendor-catalog"] },
        // Vendor Scorecard · AI Recommend · Item Catalog are pill-links inside
        // /procurement/vendors. Vendor Comparison (per item + per PO) ada di Orders.
      ],
    },
    {
      id: "sourcing",
      name: "Sourcing",
      icon: BarChart3,
      items: [
        // Harga acuan per periode & wilayah, penawaran supplier, analisis per item (dulu Price Intelligence +
        // Market Price List di Inventory).
        { id: "sourcing", name: "Sourcing", path: "/procurement/sourcing", matchPaths: ["/procurement/sourcing/items"] },
      ],
    },
  ],
};
