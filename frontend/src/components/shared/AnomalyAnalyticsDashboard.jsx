/**
 * Phase 5C.6: Anomaly Analytics Dashboard
 * Provides visual analytics using Recharts for anomaly patterns and trends
 */
import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import LoadingState from "@/components/shared/LoadingState";
import { GlassTooltip, ChartEmpty } from "@/components/shared/charts/chartKit";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEVERITY_COLORS = {
  severe: "#EF4444",
  mild: "#F59E0B",
  none: "#10B981",
};

const TYPE_COLORS = ["#5B5FE3", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

export default function AnomalyAnalyticsDashboard({ days = 30 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // Fetch summary data (already has by_type breakdown)
      const res = await api.get("/anomalies/summary", { params: { days } });
      const summary = unwrap(res);
      
      // Transform for charts
      const severityData = [
        { name: "Severe", value: summary.counts.severe, color: SEVERITY_COLORS.severe },
        { name: "Mild", value: summary.counts.mild, color: SEVERITY_COLORS.mild },
      ];

      const statusData = [
        { name: "Open", value: summary.counts.open },
        { name: "Resolved", value: summary.counts.resolved },
      ];

      const typeData = (summary.by_type || []).map((t, i) => ({
        name: t.label,
        total: t.total,
        severe: t.severe,
        mild: t.mild,
        color: TYPE_COLORS[i % TYPE_COLORS.length],
      }));

      const outletData = (summary.by_outlet || []).slice(0, 5); // Top 5 outlets

      setData({
        severityData,
        statusData,
        typeData,
        outletData,
        counts: summary.counts,
      });
    } catch (e) {
      toast.error("Failed to load analytics");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [days]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <LoadingState rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="anomaly-analytics-dashboard">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={AlertTriangle}
          label="Total Anomalies"
          value={data.counts.total}
          color="text-foreground"
        />
        <StatCard
          icon={AlertTriangle}
          label="Severe"
          value={data.counts.severe}
          color="text-red-600 dark:text-red-400"
        />
        <StatCard
          icon={Clock}
          label="Open"
          value={data.counts.open}
          color="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          icon={CheckCircle2}
          label="Resolved"
          value={data.counts.resolved}
          color="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Charts Row 1: Severity Distribution + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity Pie Chart */}
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3 text-sm">Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.severityData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {data.severityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Bar Chart */}
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3 text-sm">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
              <Bar dataKey="value" fill="#5B5FE3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Anomaly Types Breakdown */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Anomaly Types (Last {days} days)</h3>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="mr-2">Severe</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Mild</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.typeData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={150} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="severe" stackId="a" fill={SEVERITY_COLORS.severe} name="Severe" />
            <Bar dataKey="mild" stackId="a" fill={SEVERITY_COLORS.mild} name="Mild" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row 3: Top Outlets by Anomaly Count */}
      {data.outletData.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3 text-sm">Top Outlets by Anomaly Count</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.outletData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis
                dataKey="outlet_name"
                tick={{ fontSize: 10 }}
                angle={-20}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
              <Bar dataKey="total" fill="#5B5FE3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}
