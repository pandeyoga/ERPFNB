/** StatsBar — summary bar showing collection stats. */
import { Badge } from "@/components/ui/badge";
import { Database, Package, Shield } from "lucide-react";
import { BADGE_COLORS } from "./constants";

function StatsBar({ categories, allCollections }) {
  const totalDocs = allCollections?.reduce((s, c) => s + c.count, 0) || 0;
  const totalColls = allCollections?.filter(c => c.count > 0).length || 0;
  const catCount = Object.keys(categories || {}).length;

  return (
    <div className="grid grid-cols-3 gap-4" data-testid="dm-stats">
      {[
        { label: "Total Records", value: totalDocs.toLocaleString("id-ID"), icon: Database, color: "text-blue-600" },
        { label: "Koleksi Aktif", value: totalColls, icon: Package, color: "text-green-600" },
        { label: "Kategori", value: catCount, icon: Shield, color: "text-purple-600" },
      ].map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="bg-white rounded-xl border p-4 flex items-center gap-3" data-testid={`dm-stat-${stat.label.toLowerCase().replace(/\s/g,'-')}`}>
            <div className={`p-2 bg-gray-50 rounded-lg ${stat.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// \u2500\u2500 Export Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export default StatsBar;
