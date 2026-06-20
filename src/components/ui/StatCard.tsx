import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, deltaColorClass } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  /** Signed delta percentage/points; null hides the delta row. */
  delta?: number | null;
  deltaSuffix?: string;
  /** Small contextual hint shown under the value. */
  hint?: string;
  icon?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  delta = null,
  deltaSuffix = "%",
  hint,
  icon,
}: StatCardProps) {
  const Arrow =
    delta === null || delta === 0
      ? Minus
      : delta > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>
        {icon && <span className="text-emerald-600">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">
        {value}
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-xs">
        {delta !== null ? (
          <span className={cn("flex items-center gap-0.5 font-medium", deltaColorClass(delta))}>
            <Arrow className="h-3.5 w-3.5" />
            {Math.abs(delta).toFixed(1)}
            {deltaSuffix} <span className="text-gray-400">vs prior day</span>
          </span>
        ) : (
          <span className="text-gray-400">{hint ?? "—"}</span>
        )}
      </div>
    </div>
  );
}
