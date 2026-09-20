/** Sparkline — tiny inline trend line (pure SVG, no deps).
 * Props:
 *   - data: number[]            series values (oldest → newest)
 *   - width, height: px         (default 72 x 24)
 *   - className                 wrapper classes
 *   - strokeClassName           tailwind text-* color for the line (uses currentColor)
 *   - showArea                  faint gradient fill under the line
 *   - showDot                   highlight the last point
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

export default function Sparkline({
  data = [],
  width = 72,
  height = 24,
  className,
  strokeClassName = "text-aurora",
  showArea = true,
  showDot = true,
}) {
  const gradId = useId();
  const pts = (data || []).filter((n) => typeof n === "number" && !isNaN(n));
  if (pts.length < 2) return <div className={cn("inline-block", className)} style={{ width, height }} aria-hidden />;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const stepX = w / (pts.length - 1);

  const coords = pts.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y];
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height - pad} L${coords[0][0].toFixed(1)},${height - pad} Z`;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", strokeClassName, className)}
      fill="none"
      aria-hidden
    >
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradId})`} />
        </>
      )}
      <path d={line} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {showDot && <circle cx={lastX} cy={lastY} r="2.25" fill="currentColor" />}
    </svg>
  );
}
