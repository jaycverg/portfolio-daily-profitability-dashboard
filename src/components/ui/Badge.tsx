import { cn, marginColorClass } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Margin badge colored by health band (green >=35%, amber >=20%, red below). */
export function MarginBadge({ marginPct }: { marginPct: number }) {
  return <Badge className={marginColorClass(marginPct)}>{marginPct.toFixed(1)}%</Badge>;
}
