/** navigationSchema/inventory.js — Inventory portal navigation. */

import { LayoutDashboard, Boxes, Package } from "lucide-react";

export const inventoryNav = {
  id: "inventory",
  name: "Inventory Portal",
  sections: [
    {
      id: "dashboard",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Overview", path: "/inventory" },
      ],
    },
    {
      id: "stock",
      name: "Stock",
      icon: Boxes,
      items: [
        { id: "balance", name: "Stock Balance", path: "/inventory/balance" },
        { id: "movements-hub", name: "Stock Movements", path: "/inventory/movements-hub", matchPaths: ["/inventory/transfers", "/inventory/adjustments"] },
        { id: "low-stock", name: "Low Stock Alert", path: "/inventory/low-stock" },
        { id: "opname", name: "Stock Opname", path: "/inventory/opname" },
        { id: "valuation", name: "Stock Valuation", path: "/inventory/valuation" },
        { id: "market-list", name: "Market Price List", path: "/inventory/market-list" },
      ],
    },
    {
      id: "inventory-config",
      name: "Item Catalog",
      icon: Package,
      items: [
        { id: "items", name: "Item Catalog", path: "/admin/master/items" },
      ],
    },
  ],
};
