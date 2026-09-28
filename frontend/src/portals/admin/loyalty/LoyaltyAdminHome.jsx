import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Award, Gift, TrendingUp, Sparkles, Trophy } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function StatCard({ label, value, hint, icon: Icon, accent = "default" }) {
  const accentMap = {
    default: "from-slate-500/10 to-slate-600/10 text-slate-600",
    primary: "from-purple-500/10 to-pink-500/10 text-purple-600",
    success: "from-emerald-500/10 to-teal-500/10 text-emerald-600",
    warning: "from-amber-500/10 to-orange-500/10 text-amber-600",
    info: "from-blue-500/10 to-cyan-500/10 text-blue-600",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              {value}
            </div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accentMap[accent]} flex items-center justify-center shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TierDistributionCard({ distribution }) {
  const total = (distribution.bronze || 0) + (distribution.silver || 0) + (distribution.gold || 0);
  const rows = [
    { key: "bronze", label: "Bronze", count: distribution.bronze || 0, barClass: "bg-gradient-to-r from-amber-700 to-amber-900" },
    { key: "silver", label: "Silver", count: distribution.silver || 0, barClass: "bg-gradient-to-r from-slate-400 to-slate-600" },
    { key: "gold", label: "Gold", count: distribution.gold || 0, barClass: "bg-gradient-to-r from-yellow-400 to-yellow-600" },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4" />
          Tier Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{r.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {r.count} <span className="text-xs">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full ${r.barClass} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TopRewardsCard({ topRewards }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Top Rewards (90 hari terakhir)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topRewards && topRewards.length > 0 ? (
          <ol className="space-y-3">
            {topRewards.map((r, idx) => (
              <li
                key={r.reward_id}
                className="flex items-center justify-between gap-3 text-sm"
                data-testid={`top-reward-${idx}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <div className="font-medium truncate">{r.reward_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.points_used.toLocaleString()} poin dipakai
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {r.redemption_count}×
                </Badge>
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Belum ada redemption dalam 90 hari terakhir.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoyaltyAdminHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/loyalty/analytics/overview");
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-sm text-muted-foreground mb-3">
            Gagal memuat data analytics.
          </div>
          <Button variant="outline" onClick={load}>
            Coba Lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5" data-testid="admin-loyalty-home">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Customers"
          value={data.total_customers.toLocaleString()}
          hint={`${data.active_customers} aktif / ${data.inactive_customers} nonaktif`}
          icon={Users}
          accent="primary"
        />
        <StatCard
          label="Poin Beredar"
          value={data.total_points_outstanding.toLocaleString()}
          hint="Total saldo semua customer"
          icon={Sparkles}
          accent="info"
        />
        <StatCard
          label="Poin Diterbitkan 30d"
          value={data.points_earned_30d.toLocaleString()}
          hint="Poin earn 30 hari terakhir"
          icon={TrendingUp}
          accent="success"
        />
        <StatCard
          label="Redemption 30d"
          value={data.redemptions_30d.toLocaleString()}
          hint={`${data.active_rewards}/${data.total_rewards} rewards aktif`}
          icon={Gift}
          accent="warning"
        />
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TierDistributionCard distribution={data.tier_distribution || {}} />
        <TopRewardsCard topRewards={data.top_rewards || []} />
      </div>

      {/* Quick actions */}
      <Card>
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Navigasi Cepat</div>
            <div className="text-sm text-muted-foreground">
              Kelola customer, rewards, dan audit redemption dari satu tempat.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/loyalty/customers">
              <Button variant="outline" size="sm" data-testid="link-admin-loyalty-customers">
                <Users className="h-4 w-4 mr-2" /> Customers
              </Button>
            </Link>
            <Link to="/admin/loyalty/rewards">
              <Button variant="outline" size="sm" data-testid="link-admin-loyalty-rewards">
                <Gift className="h-4 w-4 mr-2" /> Rewards
              </Button>
            </Link>
            <Link to="/admin/loyalty/redemptions">
              <Button variant="outline" size="sm" data-testid="link-admin-loyalty-redemptions">
                <Award className="h-4 w-4 mr-2" /> Redemptions
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
