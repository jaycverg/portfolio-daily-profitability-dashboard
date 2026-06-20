interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

/** Tiny inline-SVG sparkline for in-table trends. Colored by net direction. */
export function Sparkline({ data, width = 96, height = 28 }: SparklineProps) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="text-xs text-gray-300">—</div>;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const x = (i: number) => pad + (i / (data.length - 1)) * innerW;
  const y = (v: number) => pad + innerH - ((v - min) / span) * innerH;

  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

  const up = data[data.length - 1] >= data[0];
  const stroke = up ? "#059669" : "#dc2626";

  return (
    <svg width={width} height={height} role="img" aria-label="trend sparkline">
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2} fill={stroke} />
    </svg>
  );
}
