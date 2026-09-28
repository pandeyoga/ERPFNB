/**
 * BrandMixDonut — Recharts PieChart for brand revenue mix (Phase 5B migrated from SVG).
 * Props:
 *   - rows: [{brand_id, brand_name, total, share_pct, color}]
 *   - onSliceClick(brand_id)
 *   - size: width/height in px
 */
import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_COLORS = [
  "#5B5FE3", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16",
];

export default function BrandMixDonut({ rows = [], onSliceClick, size = 180 }) {
  const [hovered, setHovered] = useState(null);
  const grandTotal = rows.reduce((s, r) => s + (r.total || 0), 0);

  if (!rows.length || grandTotal <= 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground italic py-4">
        Belum ada data brand mix periode ini.
      </div>
    );
  }

  // Prepare data for Recharts
  const chartData = rows.map((row, i) => ({
    ...row,
    name: row.brand_name || row.name || "Unknown",
    value: row.total || 0,
    color: row.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const focused = hovered != null ? chartData[hovered] : null;

  return (
    <div className="flex flex-col items-center" data-testid="brand-mix-donut">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.31}
              outerRadius={size * 0.44}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, index) => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onClick={(data) => onSliceClick && onSliceClick(data.brand_id)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={hovered != null && hovered !== index ? 0.35 : 1}
                  className="transition-opacity cursor-pointer"
                  data-testid={`donut-slice-${entry.brand_id}`}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                    <div className="font-semibold text-foreground">{data.name}</div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-bold tabular-nums">{fmtRp(data.value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Share:</span>
                      <span className="font-semibold tabular-nums">{(data.share_pct ?? 0).toFixed(1)}%</span>
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {focused ? focused.name : "Total"}
          </div>
          <div className="text-base font-bold tabular-nums">
            {focused ? `${focused.share_pct?.toFixed?.(1) ?? "0"}%` : fmtRp(grandTotal)}
          </div>
          {focused && (
            <div className="text-[10px] text-muted-foreground tabular-nums">{fmtRp(focused.value)}</div>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 w-full">
        {chartData.map((s, i) => (
          <button
            key={s.brand_id}
            onClick={() => onSliceClick && onSliceClick(s.brand_id)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors text-left w-full",
              "hover:bg-foreground/5",
            )}
            data-testid={`donut-legend-${s.brand_id}`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: s.color }}
            />
            <span className="flex-1 truncate font-medium">{s.name}</span>
            <span className="text-muted-foreground tabular-nums shrink-0">
              {(s.share_pct ?? 0).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
