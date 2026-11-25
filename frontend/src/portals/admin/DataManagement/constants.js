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
  master: "bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-400",
  employees: "bg-purple-500/10 border-purple-500/20 text-purple-800 dark:text-purple-400",
  finance: "bg-green-500/10 border-green-500/20 text-green-800 dark:text-green-400",
  outlet: "bg-orange-500/10 border-orange-500/20 text-orange-800 dark:text-orange-400",
  procurement: "bg-yellow-500/10 border-yellow-500/20 text-yellow-800 dark:text-yellow-400",
  inventory: "bg-cyan-500/10 border-cyan-500/20 text-cyan-800 dark:text-cyan-400",
  crm: "bg-pink-500/10 border-pink-500/20 text-pink-800 dark:text-pink-400",
  cms: "bg-indigo-500/10 border-indigo-500/20 text-indigo-800 dark:text-indigo-400",
  system: "bg-muted border-border text-muted-foreground",
};

const BADGE_COLORS = {
  master: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
  employees: "bg-purple-500/15 text-purple-800 dark:text-purple-300",
  finance: "bg-green-500/15 text-green-800 dark:text-green-300",
  outlet: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  procurement: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300",
  inventory: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  crm: "bg-pink-500/15 text-pink-800 dark:text-pink-300",
  cms: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300",
  system: "bg-muted text-foreground",
};

// \u2500\u2500 Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const TABS = [
  { id: "export", label: "Ekspor data", icon: Download },
  { id: "import", label: "Impor data", icon: Upload },
  { id: "delete", label: "Hapus data", icon: Trash2 },
];


export { CATEGORY_ICONS, CATEGORY_COLORS, BADGE_COLORS, TABS };
