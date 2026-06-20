import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ─── Tailwind class merging ─────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  try {
    return twMerge(clsx(inputs));
  } catch {
    return inputs.filter(Boolean).join(" ");
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Format integer cents as a USD currency string. */
export function formatCents(cents: number, opts?: { compact?: boolean }): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : 0,
  }).format(dollars);
}

/** Format fractional cents (e.g. profit/unit) with two decimal places. */
export function formatCentsPrecise(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Convert a Date to an ISO yyyy-mm-dd string (UTC). */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Tailwind text color for a signed delta (green up, red down, gray flat/null). */
export function deltaColorClass(delta: number | null): string {
  if (delta === null || delta === 0) return "text-gray-500";
  return delta > 0 ? "text-emerald-600" : "text-red-600";
}

/** Tailwind color class for a margin percentage health band. */
export function marginColorClass(marginPct: number): string {
  if (marginPct >= 35) return "text-emerald-700 bg-emerald-50";
  if (marginPct >= 20) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}
