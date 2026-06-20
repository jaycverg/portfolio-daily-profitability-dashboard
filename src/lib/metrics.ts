/**
 * Data-access layer that bridges Prisma rows and the pure profitability engine.
 * Server components and API route handlers call these helpers; the heavy lifting
 * (all margin math) stays in `profitability.ts`.
 */
import { db } from "@/lib/db";
import { toISODate } from "@/lib/utils";
import {
  computeAggregate,
  computeDailyMetrics,
  computeBusinessUnitMetrics,
  computeDeltaSummary,
  computeWaterfall,
  type FinancialRow,
  type OperationsRow,
} from "@/lib/profitability";

export interface DateRange {
  /** ISO yyyy-mm-dd inclusive */
  from: string;
  /** ISO yyyy-mm-dd inclusive */
  to: string;
}

/** Load engine-shaped rows for a date range (optionally one business unit). */
export async function loadRows(
  range?: Partial<DateRange>,
  businessUnitId?: string,
): Promise<{ financials: FinancialRow[]; operations: OperationsRow[] }> {
  const where: {
    date?: { gte?: Date; lte?: Date };
    businessUnitId?: string;
  } = {};

  if (range?.from || range?.to) {
    where.date = {};
    if (range.from) where.date.gte = new Date(`${range.from}T00:00:00.000Z`);
    if (range.to) where.date.lte = new Date(`${range.to}T00:00:00.000Z`);
  }
  if (businessUnitId) where.businessUnitId = businessUnitId;

  const [finRows, opsRows, units] = await Promise.all([
    db.dailyFinancials.findMany({ where, orderBy: { date: "asc" } }),
    db.dailyOperations.findMany({ where, orderBy: { date: "asc" } }),
    db.businessUnit.findMany(),
  ]);

  const unitNames = new Map(units.map((u) => [u.id, u.name]));

  const financials: FinancialRow[] = finRows.map((r) => ({
    date: toISODate(r.date),
    businessUnitId: r.businessUnitId,
    businessUnitName: unitNames.get(r.businessUnitId),
    revenueCents: r.revenueCents,
    cogsCents: r.cogsCents,
    opexCents: r.opexCents,
  }));

  const operations: OperationsRow[] = opsRows.map((r) => ({
    date: toISODate(r.date),
    businessUnitId: r.businessUnitId,
    unitsProduced: r.unitsProduced,
    laborHours: r.laborHours,
    utilizationPct: r.utilizationPct,
  }));

  return { financials, operations };
}

/** Full overview payload for the dashboard home page. */
export async function getOverview(days = 90) {
  const { financials, operations } = await loadRows();
  const daily = computeDailyMetrics(financials, operations);
  const trimmed = daily.slice(-days);
  const businessUnits = computeBusinessUnitMetrics(financials, operations);
  const aggregate = computeAggregate(financials, operations);
  const delta = computeDeltaSummary(daily);

  // The waterfall on the overview reflects the most recent day.
  const todayRows = filterToDate(
    financials,
    operations,
    delta.today?.date ?? null,
  );
  const todayAggregate = computeAggregate(
    todayRows.financials,
    todayRows.operations,
  );
  const waterfall = computeWaterfall(todayAggregate);

  return { daily: trimmed, businessUnits, aggregate, delta, waterfall };
}

function filterToDate(
  financials: FinancialRow[],
  operations: OperationsRow[],
  date: string | null,
) {
  if (!date) return { financials: [], operations: [] };
  return {
    financials: financials.filter((f) => f.date === date),
    operations: operations.filter((o) => o.date === date),
  };
}

/** Drill-down payload for a date range + optional business unit. */
export async function getDrillDown(range: DateRange, businessUnitId?: string) {
  const { financials, operations } = await loadRows(range, businessUnitId);
  const daily = computeDailyMetrics(financials, operations);
  const aggregate = computeAggregate(financials, operations);
  const waterfall = computeWaterfall(aggregate);
  const businessUnits = computeBusinessUnitMetrics(financials, operations);
  return { daily, aggregate, waterfall, businessUnits };
}

export async function listBusinessUnits() {
  return db.businessUnit.findMany({ orderBy: { name: "asc" } });
}

/** Default range = full seeded window (last 90 days through today, UTC). */
export function defaultRange(days = 90): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - (days - 1));
  return { from: toISODate(from), to: toISODate(to) };
}
