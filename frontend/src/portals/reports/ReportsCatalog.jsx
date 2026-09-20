/** Reports Catalog — Main directory page for all reports */
import { FileSpreadsheet, TrendingUp, Store, Package, DollarSign, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const REPORT_CATEGORIES = [
  {
    id: "sales",
    name: "Sales & Outlet Reports",
    description: "Operational reports untuk sales, outlet performance, dan FDO",
    icon: TrendingUp,
    color: "from-emerald-500/20 to-emerald-600/5",
    borderColor: "border-emerald-500/30",
    reports: [
      {
        id: "daily-sales",
        name: "Daily Sales Summary",
        description: "Laporan penjualan harian per outlet dengan subtotal",
        route: "/reports/daily-sales",
        status: "active",
      },
      {
        id: "outlet-performance",
        name: "Outlet Performance",
        description: "Performa outlet: total sales, avg daily, transaction count dengan chart",
        route: "/reports/outlet-performance",
        status: "active",
      },
      {
        id: "fdo-history",
        name: "FDO History",
        description: "Riwayat Floor Daily Order dengan status dan approval",
        route: "/reports/fdo-history",
        status: "active",
      },
    ],
  },
  {
    id: "inventory",
    name: "Inventory Reports",
    description: "Stock balance, movement, dan valuation reports",
    icon: Package,
    color: "from-blue-500/20 to-blue-600/5",
    borderColor: "border-blue-500/30",
    reports: [
      {
        id: "stock-balance",
        name: "Stock Balance",
        description: "Current stock levels per outlet dan item",
        route: "/reports/stock-balance",
        status: "active",
      },
      {
        id: "stock-movement",
        name: "Stock Movement",
        description: "IN/OUT transaction history dengan summary",
        route: "/reports/stock-movement",
        status: "active",
      },
      {
        id: "inventory-valuation",
        name: "Inventory Valuation",
        description: "Nilai inventory per category dan outlet",
        route: "/reports/inventory-valuation",
        status: "active",
      },
    ],
  },
  {
    id: "procurement",
    name: "Procurement Reports",
    description: "PO, GR, dan vendor performance reports",
    icon: Store,
    color: "from-purple-500/20 to-purple-600/5",
    borderColor: "border-purple-500/30",
    reports: [
      {
        id: "po-summary",
        name: "PO Summary",
        description: "Purchase Order summary per vendor dan status",
        route: "/reports/po-summary",
        status: "active",
      },
      {
        id: "gr-summary",
        name: "GR Summary",
        description: "Goods Receipt summary dengan variance analysis",
        route: "/reports/gr-summary",
        status: "active",
      },
      {
        id: "vendor-performance",
        name: "Vendor Performance",
        description: "Vendor scorecard dengan on-time delivery dan price stability",
        route: "/reports/vendor-performance",
        status: "active",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance Reports",
    description: "GL, Trial Balance, dan AP Aging reports",
    icon: DollarSign,
    color: "from-amber-500/20 to-amber-600/5",
    borderColor: "border-amber-500/30",
    reports: [
      {
        id: "journal-ledger",
        name: "Journal Ledger",
        description: "General Ledger entries dengan COA detail",
        route: "/reports/journal-ledger",
        status: "active",
      },
      {
        id: "trial-balance",
        name: "Trial Balance",
        description: "Account balances per period untuk closing",
        route: "/reports/trial-balance",
        status: "active",
      },
      {
        id: "ap-aging",
        name: "AP Aging",
        description: "Outstanding payables dengan aging buckets",
        route: "/reports/ap-aging",
        status: "active",
      },
      {
        id: "pl-group",
        name: "P&L (FnB Group Format)",
        description: "Income statement multi-bulan dengan kolom per bulan + YTD (format custom FnB Group)",
        route: "/reports/pl-group",
        status: "active",
      },
    ],
  },
  {
    id: "custom",
    name: "Custom Report Builder",
    description: "Build custom reports dengan advanced filters",
    icon: FileText,
    color: "from-rose-500/20 to-rose-600/5",
    borderColor: "border-rose-500/30",
    reports: [
      {
        id: "report-builder",
        name: "Report Builder",
        description: "Universal report builder: pilih dimensions × metrics × filters",
        route: "/finance/report-builder",
        status: "active",
      },
    ],
  },
];

export default function ReportsCatalog() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6" data-testid="reports-catalog">
      {/* Header */}
      <div className="glass-card p-6" data-testid="reports-catalog-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="reports-catalog-title">
              Reports Catalog
            </h1>
            <p className="text-sm text-muted-foreground">
              Export reports lengkap dalam format Excel untuk semua modul
            </p>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div className="space-y-6" data-testid="reports-category-grid">
        {REPORT_CATEGORIES.map((category) => {
          const Icon = category.icon;
          return (
            <div key={category.id} className="space-y-3" data-testid={`report-category-${category.id}`}>
              {/* Category Header */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center border ${category.borderColor}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{category.name}</h2>
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                </div>
              </div>

              {/* Reports Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.reports.map((report) => (
                  <Card
                    key={report.id}
                    className={`p-4 hover:shadow-lg transition-all cursor-pointer border-border/40 ${
                      report.status === "coming_soon" ? "opacity-60" : "hover:border-primary/40"
                    }`}
                    onClick={() => {
                      if (report.status === "active") {
                        navigate(report.route);
                      }
                    }}
                    data-testid={`report-card-${report.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{report.name}</h3>
                      {report.status === "active" ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-border/40 text-[10px]">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{report.description}</p>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
