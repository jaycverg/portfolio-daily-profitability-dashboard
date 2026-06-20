import { formatCents, formatDate } from "@/lib/utils";

interface Point {
  date: string;
  value: number; // cents
}

interface AreaChartProps {
  data: Point[];
  height?: number;
  /** Number of x-axis tick labels to render. */
  ticks?: number;
}

/**
 * Lightweight inline-SVG area + line chart (no chart library).
 * Renders a daily series with a soft emerald gradient fill and a baseline at 0.
 */
export function AreaChart({ data, height = 240, ticks = 5 }: AreaChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const width = 800;
  const padX = 8;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (i: number) =>
    padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padY + innerH - ((v - min) / span) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(" ");

  const areaPath =
    `M ${x(0).toFixed(1)} ${y(data[0].value).toFixed(1)} ` +
    data
      .slice(1)
      .map((d, i) => `L ${x(i + 1).toFixed(1)} ${y(d.value).toFixed(1)}`)
      .join(" ") +
    ` L ${x(data.length - 1).toFixed(1)} ${y(min).toFixed(1)} L ${x(0).toFixed(1)} ${y(min).toFixed(1)} Z`;

  const zeroY = y(0);

  const tickIdxs = Array.from({ length: Math.min(ticks, data.length) }, (_, i) =>
    Math.round((i / (Math.min(ticks, data.length) - 1 || 1)) * (data.length - 1)),
  );

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label="Daily operating profit over time"
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* zero baseline */}
        {min < 0 && (
          <line
            x1={padX}
            x2={width - padX}
            y1={zeroY}
            y2={zeroY}
            stroke="#cbd5e1"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        )}

        <path d={areaPath} fill="url(#areaFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#059669"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-gray-400">
        {tickIdxs.map((idx) => (
          <span key={idx}>{formatDate(data[idx].date)}</span>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between px-1 text-[10px] text-gray-400">
        <span>min {formatCents(min, { compact: true })}</span>
        <span>max {formatCents(max, { compact: true })}</span>
      </div>
    </div>
  );
}
