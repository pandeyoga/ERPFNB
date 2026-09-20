/** DataManagement/constants.js — shared constants for DataManagement portal. */

import {
  Database, Upload, Trash2, Download, BarChart2, FileText,
  Package, Users, DollarSign, BarChart3, ShoppingCart, Box as BoxIcon, Globe, Settings,
} from "lucide-react";

const CATEGORY_ICONS = {
  master: Package,
  employees: Users,
  finance: DollarSign,
  outlet: BarChart3,
  procurement: ShoppingCart,
  inventory: BoxIcon,
  crm: Globe,
  cms: Globe,
  system: Settings,
};

const CATEGORY_COLORS = {
  master: "bg-blue-50 border-blue-200 text-blue-700",
  employees: "bg-purple-50 border-purple-200 text-purple-700",
  finance: "bg-green-50 border-green-200 text-green-700",
  outlet: "bg-orange-50 border-orange-200 text-orange-700",
  procurement: "bg-yellow-50 border-yellow-200 text-yellow-700",
  inventory: "bg-cyan-50 border-cyan-200 text-cyan-700",
  crm: "bg-pink-50 border-pink-200 text-pink-700",
  cms: "bg-indigo-50 border-indigo-200 text-indigo-700",
  system: "bg-gray-50 border-gray-200 text-gray-700",
};

const BADGE_COLORS = {
  master: "bg-blue-100 text-blue-800",
  employees: "bg-purple-100 text-purple-800",
  finance: "bg-green-100 text-green-800",
  outlet: "bg-orange-100 text-orange-800",
  procurement: "bg-yellow-100 text-yellow-800",
  inventory: "bg-cyan-100 text-cyan-800",
  crm: "bg-pink-100 text-pink-800",
  cms: "bg-indigo-100 text-indigo-800",
  system: "bg-gray-100 text-gray-800",
};

// \u2500\u2500 Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const TABS = [
  { id: "export", label: "Export Data", icon: Download },
  { id: "import", label: "Import Data", icon: Upload },
  { id: "delete", label: "Hapus Data", icon: Trash2 },
];


export { CATEGORY_ICONS, CATEGORY_COLORS, BADGE_COLORS, TABS };
