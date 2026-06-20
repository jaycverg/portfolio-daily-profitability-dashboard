import { describe, it, expect } from "vitest";
import {
  computeAggregate,
  computeDailyMetrics,
  computeBusinessUnitMetrics,
  computeWaterfall,
  computeDeltaSummary,
  safeRatio,
  type FinancialRow,
  type OperationsRow,
} from "../profitability";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const fin: FinancialRow[] = [
  // Day 1, Unit A
  {
    date: "2026-01-01",
    businessUnitId: "A",
    businessUnitName: "Assembly",
    revenueCents: 1_000_00,
    cogsCents: 600_00,
    opexCents: 200_00,
  },
  // Day 1, Unit B
  {
    date: "2026-01-01",
    businessUnitId: "B",
    businessUnitName: "Bottling",
    revenueCents: 500_00,
    cogsCents: 250_00,
    opexCents: 100_00,
  },
  // Day 2, Unit A
  {
    date: "2026-01-02",
    businessUnitId: "A",
    businessUnitName: "Assembly",
    revenueCents: 1_200_00,
    cogsCents: 700_00,
    opexCents: 200_00,
  },
];

const ops: OperationsRow[] = [
  {
    date: "2026-01-01",
    businessUnitId: "A",
    unitsProduced: 100,
    laborHours: 40,
    utilizationPct: 80,
  },
  {
    date: "2026-01-01",
    businessUnitId: "B",
    unitsProduced: 50,
    laborHours: 20,
    utilizationPct: 60,
  },
  {
    date: "2026-01-02",
    businessUnitId: "A",
    unitsProduced: 120,
    laborHours: 40,
    utilizationPct: 90,
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("safeRatio", () => {
  it("returns 0 instead of NaN/Infinity on zero denominator", () => {
    expect(safeRatio(100, 0)).toBe(0);
    expect(safeRatio(0, 0)).toBe(0);
    expect(safeRatio(50, 10)).toBe(5);
  });
});

describe("computeAggregate — margin math", () => {
  it("computes gross profit, gross margin %, contribution, operating profit", () => {
    const m = computeAggregate(fin, ops);
    // Revenue 1000 + 500 + 1200 = 2700 ; COGS 600+250+700 = 1550 ; opex 200+100+200 = 500
    expect(m.revenueCents).toBe(2_700_00);
    expect(m.cogsCents).toBe(1_550_00);
    expect(m.opexCents).toBe(500_00);
    expect(m.grossProfitCents).toBe(1_150_00); // 2700 - 1550
    expect(m.contributionMarginCents).toBe(1_150_00); // == gross in this model
    expect(m.operatingProfitCents).toBe(650_00); // 1150 - 500
    // gross margin = 1150 / 2700 * 100 = 42.6%
    expect(m.grossMarginPct).toBe(42.6);
    // operating margin = 650 / 2700 * 100 = 24.1%
    expect(m.operatingMarginPct).toBe(24.1);
  });

  it("computes profit per unit and profit per labor hour", () => {
    const m = computeAggregate(fin, ops);
    // units = 100 + 50 + 120 = 270 ; operating profit = 65000 cents
    // 65000 / 270 = 240.74 cents/unit
    expect(m.unitsProduced).toBe(270);
    expect(m.profitPerUnitCents).toBe(240.74);
    // labor hours = 40 + 20 + 40 = 100 ; 65000 / 100 = 650 cents/hr
    expect(m.laborHours).toBe(100);
    expect(m.profitPerLaborHourCents).toBe(650);
  });

  it("averages utilization across contributing rows", () => {
    const m = computeAggregate(fin, ops);
    // (80 + 60 + 90) / 3 = 76.666 -> 76.7
    expect(m.utilizationPct).toBe(76.7);
  });
});

describe("computeAggregate — defensive zero handling", () => {
  it("never produces NaN with zero revenue / zero units / zero hours", () => {
    const m = computeAggregate(
      [
        {
          date: "2026-02-01",
          businessUnitId: "Z",
          revenueCents: 0,
          cogsCents: 0,
          opexCents: 0,
        },
      ],
      [
        {
          date: "2026-02-01",
          businessUnitId: "Z",
          unitsProduced: 0,
          laborHours: 0,
          utilizationPct: 0,
        },
      ],
    );
    expect(m.grossMarginPct).toBe(0);
    expect(m.operatingMarginPct).toBe(0);
    expect(m.profitPerUnitCents).toBe(0);
    expect(m.profitPerLaborHourCents).toBe(0);
    expect(Number.isNaN(m.profitPerUnitCents)).toBe(false);
  });
});

describe("computeDailyMetrics", () => {
  it("collapses business units within a day and sorts by date", () => {
    const daily = computeDailyMetrics(fin, ops);
    expect(daily.map((d) => d.date)).toEqual(["2026-01-01", "2026-01-02"]);
    // Day 1 combines A + B: revenue 1500, cogs 850, opex 300
    expect(daily[0].revenueCents).toBe(1_500_00);
    expect(daily[0].cogsCents).toBe(850_00);
    expect(daily[0].operatingProfitCents).toBe(350_00); // 1500-850-300
    // Day 2 is A only
    expect(daily[1].revenueCents).toBe(1_200_00);
    expect(daily[1].operatingProfitCents).toBe(300_00); // 1200-700-200
  });
});

describe("computeBusinessUnitMetrics", () => {
  it("aggregates per unit, sorts by operating profit desc, builds a sparkline series", () => {
    const units = computeBusinessUnitMetrics(fin, ops);
    expect(units.map((u) => u.businessUnitId)).toEqual(["A", "B"]);
    const a = units[0];
    // Unit A across 2 days: revenue 2200, cogs 1300, opex 400 -> op profit 500
    expect(a.businessUnitName).toBe("Assembly");
    expect(a.revenueCents).toBe(2_200_00);
    expect(a.operatingProfitCents).toBe(500_00);
    // series = [day1 op profit, day2 op profit] = [1000-600-200, 1200-700-200]
    expect(a.operatingProfitSeries).toEqual([200_00, 300_00]);
  });
});

describe("computeWaterfall", () => {
  it("emits Revenue -> COGS -> Gross -> Opex -> Operating Profit with correct running totals", () => {
    const m = computeAggregate(fin, ops);
    const wf = computeWaterfall(m);
    expect(wf.map((s) => s.label)).toEqual([
      "Revenue",
      "COGS",
      "Gross Profit",
      "Opex",
      "Operating Profit",
    ]);
    expect(wf[0].runningCents).toBe(2_700_00); // revenue
    expect(wf[1].deltaCents).toBe(-1_550_00); // cogs negative
    expect(wf[2].runningCents).toBe(1_150_00); // gross
    expect(wf[3].deltaCents).toBe(-500_00); // opex negative
    expect(wf[4].runningCents).toBe(650_00); // operating profit
    // start/end-style bars flagged as totals
    expect(wf.filter((s) => s.isTotal).map((s) => s.label)).toEqual([
      "Revenue",
      "Gross Profit",
      "Operating Profit",
    ]);
  });

  it("final running total equals operating profit and reconciles deltas", () => {
    const m = computeAggregate(fin, ops);
    const wf = computeWaterfall(m);
    const reconstructed =
      wf[0].deltaCents + wf[1].deltaCents + wf[3].deltaCents;
    expect(reconstructed).toBe(m.operatingProfitCents);
    expect(wf[wf.length - 1].runningCents).toBe(m.operatingProfitCents);
  });
});

describe("computeDeltaSummary", () => {
  it("computes day-over-day deltas between latest and prior day", () => {
    const daily = computeDailyMetrics(fin, ops);
    const delta = computeDeltaSummary(daily);
    expect(delta.today?.date).toBe("2026-01-02");
    expect(delta.prior?.date).toBe("2026-01-01");
    // op profit day1=35000, day2=30000 -> (30000-35000)/35000 = -14.3%
    expect(delta.operatingProfitDeltaPct).toBe(-14.3);
    // gross margin pts delta = day2 gm - day1 gm
    expect(delta.grossMarginDeltaPts).not.toBeNull();
  });

  it("returns null deltas when there is no prior day", () => {
    const single = computeDailyMetrics([fin[2]], [ops[2]]);
    const delta = computeDeltaSummary(single);
    expect(delta.prior).toBeNull();
    expect(delta.operatingProfitDeltaPct).toBeNull();
    expect(delta.today).not.toBeNull();
  });

  it("handles empty input without throwing", () => {
    const delta = computeDeltaSummary([]);
    expect(delta.today).toBeNull();
    expect(delta.revenueDeltaPct).toBeNull();
  });
});
