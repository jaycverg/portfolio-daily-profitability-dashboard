import type { WaterfallStep } from "@/lib/profitability";
import { formatCents } from "@/lib/utils";

interface WaterfallProps {
  steps: WaterfallStep[];
  height?: number;
}

/**
 * Inline-SVG profit waterfall: Revenue -> COGS -> Gross -> Opex -> Operating
 * Profit. Total bars (Revenue/Gross/Operating) are anchored to the baseline;
 * delta bars (COGS/Opex) float between the prior and new running total.
 */
export function Waterfall({ steps, height = 280 }: WaterfallProps) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No data
      </div>
    );
  }

  const width = 720;
  const padX = 12;
  const padTop = 16;
  const padBottom = 44;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  // The vertical scale spans 0..max(running, revenue).
  const tops = steps.map((s) => Math.max(s.runningCents, s.runningCents - s.deltaCents));
  const max = Math.max(...tops, 0);
  const min = Math.min(...steps.map((s) => Math.min(s.runningCents, s.runningCents - s.deltaCents)), 0);
  const span = max - min || 1;

  const slot = innerW / steps.length;
  const barW = slot * 0.56;
  const y = (v: number) => padTop + innerH - ((v - min) / span) * innerH;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[560px]"
        style={{ height }}
        role="img"
        aria-label="Profit waterfall"
      >
        {/* zero baseline */}
        <line x1={padX} x2={width - padX} y1={y(0)} y2={y(0)} stroke="#e2e8f0" strokeWidth={1} />

        {steps.map((step, i) => {
          const cx = padX + slot * i + slot / 2;
          const barX = cx - barW / 2;

          const prevRunning = step.runningCents - step.deltaCents;
          const top = step.isTotal
            ? Math.max(step.runningCents, 0)
            : Math.max(step.runningCents, prevRunning);
          const bottom = step.isTotal
            ? Math.min(step.runningCents, 0)
            : Math.min(step.runningCents, prevRunning);

          const barY = y(top);
          const barH = Math.max(2, y(bottom) - y(top));

          let fill = "#059669"; // total/positive
          if (!step.isTotal) fill = step.deltaCents < 0 ? "#f59e0b" : "#10b981";
          if (step.label === "COGS") fill = "#f59e0b";
          if (step.label === "Opex") fill = "#fb923c";
          if (step.isTotal && step.runningCents < 0) fill = "#dc2626";

          // connector line from previous bar top to this bar (for delta bars)
          const connectorY = y(prevRunning);
          const prevCx = padX + slot * (i - 1) + slot / 2;

          return (
            <g key={step.label}>
              {i > 0 && (
                <line
                  x1={prevCx + barW / 2}
                  x2={barX}
                  y1={connectorY}
                  y2={connectorY}
                  stroke="#cbd5e1"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}
              <rect x={barX} y={barY} width={barW} height={barH} rx={3} fill={fill} />
              <text
                x={cx}
                y={barY - 6}
                textAnchor="middle"
                className="fill-gray-700"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {formatCents(step.deltaCents, { compact: true })}
              </text>
              <text
                x={cx}
                y={height - padBottom + 18}
                textAnchor="middle"
                className="fill-gray-500"
                style={{ fontSize: 11 }}
              >
                {step.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
