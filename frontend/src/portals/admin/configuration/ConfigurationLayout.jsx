/** ConfigurationLayout — nested admin sub-portal at /admin/configuration/*
 * PageHeader ("Business Rules" = nama menu) + Tabs standar per jenis aturan + scope picker bersama.
 * Renders the right child page via <Outlet />.
 *
 * Catatan: pindah tab mempertahankan query `scope_type`/`scope_id` (sebelumnya hilang saat
 * pindah tab sehingga scope kembali ke Group).
 */
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, Wallet, Sparkles, Award, CalendarDays, Settings2, Shield } from "lucide-react";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScopePicker from "@/components/shared/ScopePicker";

const SUB = [
  { path: "sales-schemas",           label: "Sales schemas",      icon: ShoppingBag,  hint: "Channel, metode bayar, bucket revenue" },
  { path: "petty-cash-policies",     label: "Petty cash",         icon: Wallet,       hint: "Limit & threshold approval" },
  { path: "service-charge-policies", label: "Service charge",     icon: Sparkles,     hint: "Formula % + alokasi" },
  { path: "incentive-schemes",       label: "Incentive schemes",  icon: Award,        hint: "Target & rumus tier" },
  { path: "anomaly-thresholds",      label: "Anomaly thresholds", icon: Shield,       hint: "Threshold deteksi anomali" },
  { path: "effective-dating",        label: "Effective dating",   icon: CalendarDays, hint: "Timeline efektif & bentrok" },
];

export default function ConfigurationLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const base = "/admin/configuration";
  const current = location.pathname.replace(base, "").replace(/^\//, "");
  const active = SUB.find((r) => current === r.path || current.startsWith(`${r.path}/`))?.path;

  return (
    <HubHeaderProvider>
      <div className="space-y-3" data-testid="admin-configuration-page">
        <PageHeader hub
          icon={Settings2}
          title="Business Rules"
          subtitle="Atur aturan operasional tanpa tim teknis. Setiap aturan punya scope dan periode berlaku."
        />

        <Tabs value={active || ""} onValueChange={(v) => navigate(`${base}/${v}${location.search}`)}>
          <TabsList data-testid="config-tabs">
            {SUB.map((r) => {
              const Icon = r.icon;
              return (
                <TabsTrigger key={r.path} value={r.path} title={r.hint} data-testid={`config-tab-${r.path}`}>
                  <Icon /> {r.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="glass-card p-3 sticky top-2 z-20 backdrop-blur-md">
          <ScopePicker />
        </div>

        <Outlet />
      </div>
    </HubHeaderProvider>
  );
}
