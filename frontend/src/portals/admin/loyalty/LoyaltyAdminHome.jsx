import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Award, Gift, TrendingUp, Sparkles, Trophy } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import CompactStatCard from "@/components/shared/CompactStatCard";

function TierDistributionCard({ distribution }) {
  const total = (distribution.bronze || 0) + (distribution.silver || 0) + (distribution.gold || 0);
  const rows = [
    { key: "bronze", label: "Bronze", count: distribution.bronze || 0, barClass: "bg-gradient-to-r from-amber-700 to-amber-900" },
    { key: "silver", label: "Silver", count: distribution.silver || 0, barClass: "bg-gradient-to-r from-slate-400 to-slate-600" },
    { key: "gold", label: "Gold", count: distribution.gold || 0, barClass: "bg-gradient-to-r from-yellow-400 to-yellow-600" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-4 w-4" />
          Tier Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-sm text-muted-foreground mb-3">
            Gagal memuat data analytics.
          </div>
          <Button variant="outline" onClick={load}>
            Muat ulang
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="admin-loyalty-home">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompactStatCard
          label="Total Customers"
          value={data.total_customers.toLocaleString()}
          sub={`${data.active_customers} aktif / ${data.inactive_customers} nonaktif`}
          icon={Users}
          color="aurora-2"
        />
        <CompactStatCard
          label="Poin Beredar"
          value={data.total_points_outstanding.toLocaleString()}
          sub="Total saldo semua customer"
          icon={Sparkles}
          color="aurora-3"
        />
        <CompactStatCard
          label="Poin Diterbitkan 30d"
          value={data.points_earned_30d.toLocaleString()}
          sub="Poin earn 30 hari terakhir"
          icon={TrendingUp}
          color="aurora-4"
        />
        <CompactStatCard
          label="Redemption 30d"
          value={data.redemptions_30d.toLocaleString()}
          sub={`${data.active_rewards}/${data.total_rewards} rewards aktif`}
          icon={Gift}
          color="aurora-5"
        />
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <TierDistributionCard distribution={data.tier_distribution || {}} />
        <TopRewardsCard topRewards={data.top_rewards || []} />
      </div>

      {/* Quick actions — tetap di dalam hub (tab), bukan pindah ke route terpisah */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm md:text-base font-semibold">Navigasi cepat</h3>
            <div className="text-sm text-muted-foreground">
              Kelola customer, rewards, dan audit redemption dari satu tempat.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/loyalty?tab=customers" data-testid="link-admin-loyalty-customers">
                <Users className="h-4 w-4" /> Customers
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/loyalty?tab=rewards" data-testid="link-admin-loyalty-rewards">
                <Gift className="h-4 w-4" /> Rewards
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/loyalty?tab=redemptions" data-testid="link-admin-loyalty-redemptions">
                <Award className="h-4 w-4" /> Redemptions
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
