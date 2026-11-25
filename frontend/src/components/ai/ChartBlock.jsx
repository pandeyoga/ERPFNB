/** ChartBlock — grafik dari Asisten AI (spesifikasi `show_chart`): bar / line / area / pie dengan tema chartKit.
 *
 * spec = { type, title, x_key, series: [{key, label}], data: [{...}], unit: "rp"|"num"|"pct", stacked }.
 * Kolom id (outlet_id, item_id, …) otomatis memakai `<kolom>_name` bila tersedia sebagai label sumbu.
 */
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { CATEGORICAL, GlassTooltip, ChartEmpty, axisProps, gridProps, fmtCompact } from "@/components/shared/charts/chartKit";

export function chartFormatter(unit) {
  if (unit === "pct") return (v) => (v == null ? "-" : `${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`);
  if (unit === "rp") return (v) => (v == null ? "-" : `Rp ${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`);
  return (v) => (v == null ? "-" : Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 }));
}

export default function ChartBlock({ spec, height = 260 }) {
  if (!spec) return null;
  const { type, x_key: xKey, series = [], data = [], unit = "num", stacked } = spec;
  const fmt = chartFormatter(unit);
  const labelKey = data.some((r) => r[`${xKey}_name`] != null) ? `${xKey}_name` : xKey;
  const rows = data.map((r) => ({ ...r, __x: r[labelKey] ?? r[xKey] }));
  if (!rows.length) return <ChartEmpty message="Belum ada data untuk grafik ini." />;

  if (type === "pie") {
    const s = series[0];
    return (
      <div style={{ height }} data-testid="ai-chart">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey={s.key} nameKey="__x" innerRadius="45%" outerRadius="80%" paddingAngle={1}>
              {rows.map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
            </Pie>
            <Tooltip content={<GlassTooltip valueFormatter={fmt} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const Chart = type === "line" ? LineChart : type === "area" ? AreaChart : BarChart;
  const common = { data: rows, margin: { top: 8, right: 8, bottom: 4, left: 0 } };
  return (
    <div style={{ height }} data-testid="ai-chart">
      <ResponsiveContainer>
        <Chart {...common}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="__x" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => (unit === "pct" ? `${v}%` : fmtCompact(v))} />
          <Tooltip content={<GlassTooltip valueFormatter={fmt} />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => {
            const color = CATEGORICAL[i % CATEGORICAL.length];
            if (type === "line") return <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} dot={rows.length <= 31} />;
            if (type === "area") return <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} fill={color} fillOpacity={0.15} stackId={stacked ? "a" : undefined} />;
            return <Bar key={s.key} dataKey={s.key} name={s.label} fill={color} radius={[4, 4, 0, 0]} stackId={stacked ? "a" : undefined} maxBarSize={48} />;
          })}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
