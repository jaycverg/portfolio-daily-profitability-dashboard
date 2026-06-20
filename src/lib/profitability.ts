/**
 * Daily P&L engine — pure, framework-free, fully unit-tested.
 *
 * Given financial rows (revenue / COGS / opex, all in integer cents) and
 * operational rows (units produced, labor hours, utilization), it computes
 * per-day and per-business-unit profitability metrics, plus aggregate roll-ups
 * and a profit waterfall (Revenue -> COGS -> Gross -> Opex -> Operating Profit).
 *
 * Conventions:
 *  - All monetary inputs and outputs are INTEGER CENTS unless a field name ends
 *    in `Pct` (a percentage 0-100) or `PerUnit` / `PerLaborHour` (cents, may be
 *    fractional).
 *  - COGS and opex are treated as positive magnitudes on input. The waterfall
 *    represents them as negative deltas.
 *  - Division-by-zero is handled defensively: ratios return 0 when the
 *    denominator is 0, so the engine never produces NaN/Infinity.
 */

// ─── Input shapes ───────────────────────────────────────────────────────────

export interface FinancialRow {
  date: string; // ISO date (yyyy-mm-dd) — the calendar day
  businessUnitId: string;
  businessUnitName?: string;
  revenueCents: number;
  cogsCents: number;
  opexCents: number;
}

export interface OperationsRow {
  date: string;
  businessUnitId: string;
  unitsProduced: number;
  laborHours: number;
  utilizationPct: number;
}

// ─── Output shapes ──────────────────────────────────────────────────────────

export interface ProfitMetrics {
  revenueCents: number;
  cogsCents: number;
  opexCents: number;
  /** Revenue - COGS */
  grossProfitCents: number;
  /** Gross profit / revenue * 100 */
  grossMarginPct: number;
  /**
   * Contribution margin = revenue - variable costs. We treat COGS as the
   * variable cost component, so for this model contribution == gross profit.
   * Exposed separately because the two diverge once opex is partly variable.
   */
  contributionMarginCents: number;
  /** Gross profit - opex */
  operatingProfitCents: number;
  /** Operating profit / revenue * 100 */
  operatingMarginPct: number;
  unitsProduced: number;
  laborHours: number;
  /** Average utilization across the rows contributing to this bucket */
  utilizationPct: number;
  /** Operating profit / units produced (cents, fractional allowed) */
  profitPerUnitCents: number;
  /** Operating profit / labor hours (cents, fractional allowed) */
  profitPerLaborHourCents: number;
}

export interface DailyMetrics extends ProfitMetrics {
  date: string;
}

export interface BusinessUnitMetrics extends ProfitMetrics {
  businessUnitId: string;
  businessUnitName: string;
  /** Daily operating profit series for the unit, ordered by date — for sparklines. */
  operatingProfitSeries: number[];
}

export interface WaterfallStep {
  label: string;
  /** Signed delta in cents (revenue positive; COGS/opex negative). */
  deltaCents: number;
  /** Running total after applying this step, in cents. */
  runningCents: number;
  /** Whether this step is a cumulative total (start/end bars) vs a delta bar. */
  isTotal: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Safe ratio: returns 0 when the denominator is 0 (never NaN/Infinity). */
export function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/** Percentage of `part` relative to `whole`, rounded to 1 decimal place. */
export function pct(part: number, whole: number): number {
  return round1(safeRatio(part, whole) * 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Core computation ───────────────────────────────────────────────────────

interface RawBucket {
  revenueCents: number;
  cogsCents: number;
  opexCents: number;
  unitsProduced: number;
  laborHours: number;
  utilizationSum: number;
  utilizationCount: number;
}

function emptyBucket(): RawBucket {
  return {
    revenueCents: 0,
    cogsCents: 0,
    opexCents: 0,
    unitsProduced: 0,
    laborHours: 0,
    utilizationSum: 0,
    utilizationCount: 0,
  };
}

function addOps(bucket: RawBucket, ops: OperationsRow | undefined): void {
  if (!ops) return;
  bucket.unitsProduced += ops.unitsProduced;
  bucket.laborHours += ops.laborHours;
  bucket.utilizationSum += ops.utilizationPct;
  bucket.utilizationCount += 1;
}

function addFin(bucket: RawBucket, fin: FinancialRow): void {
  bucket.revenueCents += fin.revenueCents;
  bucket.cogsCents += fin.cogsCents;
  bucket.opexCents += fin.opexCents;
}

/**
 * Derive the full ProfitMetrics from a raw accumulation bucket.
 * This is the single source of truth for every margin/per-X formula.
 */
function metricsFromBucket(bucket: RawBucket): ProfitMetrics {
  const grossProfitCents = bucket.revenueCents - bucket.cogsCents;
  const operatingProfitCents = grossProfitCents - bucket.opexCents;
  const utilizationPct = round1(
    safeRatio(bucket.utilizationSum, bucket.utilizationCount),
  );

  return {
    revenueCents: bucket.revenueCents,
    cogsCents: bucket.cogsCents,
    opexCents: bucket.opexCents,
    grossProfitCents,
    grossMarginPct: pct(grossProfitCents, bucket.revenueCents),
    // For this single-variable-cost model, contribution == gross profit.
    contributionMarginCents: grossProfitCents,
    operatingProfitCents,
    operatingMarginPct: pct(operatingProfitCents, bucket.revenueCents),
    unitsProduced: bucket.unitsProduced,
    laborHours: round2(bucket.laborHours),
    utilizationPct,
    profitPerUnitCents: round2(
      safeRatio(operatingProfitCents, bucket.unitsProduced),
    ),
    profitPerLaborHourCents: round2(
      safeRatio(operatingProfitCents, bucket.laborHours),
    ),
  };
}

/** Index operations rows by `${date}|${businessUnitId}` for O(1) join. */
function indexOps(ops: OperationsRow[]): Map<string, OperationsRow> {
  const map = new Map<string, OperationsRow>();
  for (const row of ops) {
    map.set(`${row.date}|${row.businessUnitId}`, row);
  }
  return map;
}

/**
 * Compute one ProfitMetrics aggregate across ALL supplied rows (every day,
 * every business unit combined). Useful for top-line stat cards over a range.
 */
export function computeAggregate(
  financials: FinancialRow[],
  operations: OperationsRow[],
): ProfitMetrics {
  const opsIndex = indexOps(operations);
  const bucket = emptyBucket();
  for (const fin of financials) {
    addFin(bucket, fin);
    addOps(bucket, opsIndex.get(`${fin.date}|${fin.businessUnitId}`));
  }
  return metricsFromBucket(bucket);
}

/**
 * Compute per-day metrics, collapsing all business units within a day.
 * Returns one entry per distinct date, sorted ascending.
 */
export function computeDailyMetrics(
  financials: FinancialRow[],
  operations: OperationsRow[],
): DailyMetrics[] {
  const opsIndex = indexOps(operations);
  const byDate = new Map<string, RawBucket>();

  for (const fin of financials) {
    const bucket = byDate.get(fin.date) ?? emptyBucket();
    addFin(bucket, fin);
    addOps(bucket, opsIndex.get(`${fin.date}|${fin.businessUnitId}`));
    byDate.set(fin.date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({ date, ...metricsFromBucket(bucket) }));
}

/**
 * Compute per-business-unit metrics, collapsing all days within a unit.
 * Each result carries a daily operating-profit series (sorted by date) for
 * sparklines. Sorted by operating profit descending (most profitable first).
 */
export function computeBusinessUnitMetrics(
  financials: FinancialRow[],
  operations: OperationsRow[],
): BusinessUnitMetrics[] {
  const opsIndex = indexOps(operations);
  const byUnit = new Map<
    string,
    {
      bucket: RawBucket;
      name: string;
      // date -> running operating profit for that unit on that day
      daily: Map<string, RawBucket>;
    }
  >();

  for (const fin of financials) {
    const entry =
      byUnit.get(fin.businessUnitId) ??
      {
        bucket: emptyBucket(),
        name: fin.businessUnitName ?? fin.businessUnitId,
        daily: new Map<string, RawBucket>(),
      };

    const ops = opsIndex.get(`${fin.date}|${fin.businessUnitId}`);
    addFin(entry.bucket, fin);
    addOps(entry.bucket, ops);

    const dayBucket = entry.daily.get(fin.date) ?? emptyBucket();
    addFin(dayBucket, fin);
    addOps(dayBucket, ops);
    entry.daily.set(fin.date, dayBucket);

    if (fin.businessUnitName) entry.name = fin.businessUnitName;
    byUnit.set(fin.businessUnitId, entry);
  }

  return [...byUnit.entries()]
    .map(([businessUnitId, entry]) => {
      const series = [...entry.daily.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, b]) => b.revenueCents - b.cogsCents - b.opexCents);
      return {
        businessUnitId,
        businessUnitName: entry.name,
        operatingProfitSeries: series,
        ...metricsFromBucket(entry.bucket),
      };
    })
    .sort((a, b) => b.operatingProfitCents - a.operatingProfitCents);
}

/**
 * Build the profit waterfall: Revenue -> COGS -> Gross Profit -> Opex ->
 * Operating Profit. COGS and opex are emitted as negative deltas; Gross Profit
 * and Operating Profit are cumulative totals.
 */
export function computeWaterfall(metrics: ProfitMetrics): WaterfallStep[] {
  const steps: WaterfallStep[] = [];
  let running = 0;

  running = metrics.revenueCents;
  steps.push({
    label: "Revenue",
    deltaCents: metrics.revenueCents,
    runningCents: running,
    isTotal: true,
  });

  running -= metrics.cogsCents;
  steps.push({
    label: "COGS",
    deltaCents: -metrics.cogsCents,
    runningCents: running,
    isTotal: false,
  });

  steps.push({
    label: "Gross Profit",
    deltaCents: metrics.grossProfitCents,
    runningCents: running,
    isTotal: true,
  });

  running -= metrics.opexCents;
  steps.push({
    label: "Opex",
    deltaCents: -metrics.opexCents,
    runningCents: running,
    isTotal: false,
  });

  steps.push({
    label: "Operating Profit",
    deltaCents: metrics.operatingProfitCents,
    runningCents: running,
    isTotal: true,
  });

  return steps;
}

/**
 * Compute the day-over-day delta between the latest and previous day for a set
 * of daily metrics. Returns null fields when there is insufficient history.
 */
export interface DeltaSummary {
  today: DailyMetrics | null;
  prior: DailyMetrics | null;
  revenueDeltaPct: number | null;
  grossMarginDeltaPts: number | null;
  operatingProfitDeltaPct: number | null;
  profitPerUnitDeltaPct: number | null;
}

export function computeDeltaSummary(daily: DailyMetrics[]): DeltaSummary {
  if (daily.length === 0) {
    return {
      today: null,
      prior: null,
      revenueDeltaPct: null,
      grossMarginDeltaPts: null,
      operatingProfitDeltaPct: null,
      profitPerUnitDeltaPct: null,
    };
  }
  const today = daily[daily.length - 1];
  const prior = daily.length > 1 ? daily[daily.length - 2] : null;

  const deltaPct = (cur: number, prev: number): number | null =>
    prev === 0 ? null : round1(((cur - prev) / Math.abs(prev)) * 100);

  return {
    today,
    prior,
    revenueDeltaPct: prior ? deltaPct(today.revenueCents, prior.revenueCents) : null,
    grossMarginDeltaPts: prior
      ? round1(today.grossMarginPct - prior.grossMarginPct)
      : null,
    operatingProfitDeltaPct: prior
      ? deltaPct(today.operatingProfitCents, prior.operatingProfitCents)
      : null,
    profitPerUnitDeltaPct: prior
      ? deltaPct(today.profitPerUnitCents, prior.profitPerUnitCents)
      : null,
  };
}
