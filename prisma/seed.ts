/**
 * Idempotent seed: 90 days of realistic, varied daily financial + operational
 * data across 4 business units. Clears existing rows first, then inserts.
 *
 * The generator layers a base level + weekly seasonality + a slow trend +
 * bounded noise so the resulting charts have texture (peaks, dips, a few
 * loss-making days) rather than looking synthetic.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DAYS = 90;

interface UnitProfile {
  name: string;
  productLine: string;
  baseUnits: number; // typical units/day
  pricePerUnitCents: number; // average sale price
  cogsRatio: number; // COGS as a fraction of revenue (variable cost)
  fixedOpexCents: number; // daily fixed opex
  laborHoursPerUnit: number; // hours of labor per unit
  trendPerDay: number; // additive units/day trend (can be negative)
  weekendFactor: number; // 0-1 multiplier on weekends
  volatility: number; // 0-1, how noisy the unit is
}

const UNITS: UnitProfile[] = [
  {
    name: "Precision Machining",
    productLine: "Industrial Components",
    baseUnits: 320,
    pricePerUnitCents: 4200,
    cogsRatio: 0.58,
    fixedOpexCents: 180_000,
    laborHoursPerUnit: 0.22,
    trendPerDay: 0.6,
    weekendFactor: 0.35,
    volatility: 0.12,
  },
  {
    name: "Consumer Bottling",
    productLine: "Beverages",
    baseUnits: 5400,
    pricePerUnitCents: 140,
    cogsRatio: 0.64,
    fixedOpexCents: 95_000,
    laborHoursPerUnit: 0.012,
    trendPerDay: -1.2,
    weekendFactor: 0.8,
    volatility: 0.18,
  },
  {
    name: "Custom Packaging",
    productLine: "Logistics",
    baseUnits: 1200,
    pricePerUnitCents: 850,
    cogsRatio: 0.71, // thin-margin unit — will show loss days
    fixedOpexCents: 140_000,
    laborHoursPerUnit: 0.05,
    trendPerDay: 0.2,
    weekendFactor: 0.5,
    volatility: 0.22,
  },
  {
    name: "Specialty Coatings",
    productLine: "Chemicals",
    baseUnits: 760,
    pricePerUnitCents: 2600,
    cogsRatio: 0.49, // healthy-margin unit
    fixedOpexCents: 120_000,
    laborHoursPerUnit: 0.08,
    trendPerDay: 0.9,
    weekendFactor: 0.4,
    volatility: 0.15,
  },
];

// Deterministic PRNG (mulberry32) so seeds are reproducible across runs.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
  console.log("Clearing existing data…");
  await db.dailyOperations.deleteMany();
  await db.dailyFinancials.deleteMany();
  await db.businessUnit.deleteMany();

  const today = dayOnly(new Date());

  for (let u = 0; u < UNITS.length; u++) {
    const profile = UNITS[u];
    const rng = makeRng(1000 + u * 7919);

    const unit = await db.businessUnit.create({
      data: { name: profile.name, productLine: profile.productLine },
    });

    const financials: {
      date: Date;
      businessUnitId: string;
      revenueCents: number;
      cogsCents: number;
      opexCents: number;
    }[] = [];
    const operations: {
      date: Date;
      businessUnitId: string;
      unitsProduced: number;
      laborHours: number;
      utilizationPct: number;
    }[] = [];

    for (let i = DAYS - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - i);
      const dow = date.getUTCDay(); // 0 = Sunday
      const isWeekend = dow === 0 || dow === 6;
      const dayIndex = DAYS - 1 - i;

      // Weekly seasonality: mid-week peak.
      const weekly = 1 + 0.12 * Math.sin(((dow - 1) / 7) * Math.PI * 2);
      const trend = profile.trendPerDay * dayIndex;
      const noise = 1 + (rng() - 0.5) * 2 * profile.volatility;
      const weekend = isWeekend ? profile.weekendFactor : 1;

      const unitsProduced = Math.max(
        0,
        Math.round((profile.baseUnits + trend) * weekly * weekend * noise),
      );

      const revenueCents = Math.round(
        unitsProduced * profile.pricePerUnitCents * (1 + (rng() - 0.5) * 0.04),
      );

      // COGS scales with revenue (variable) plus a little noise.
      const cogsCents = Math.round(
        revenueCents * profile.cogsRatio * (1 + (rng() - 0.5) * 0.06),
      );

      // Opex = fixed + small variable component, slightly lower on weekends.
      const opexCents = Math.round(
        (profile.fixedOpexCents * (isWeekend ? 0.7 : 1) +
          revenueCents * 0.05) *
          (1 + (rng() - 0.5) * 0.05),
      );

      const laborHours =
        Math.round(unitsProduced * profile.laborHoursPerUnit * 10) / 10;

      // Utilization correlates with output vs capacity, bounded 35-99%.
      const capacity = (profile.baseUnits + trend) * 1.25;
      const utilizationPct =
        Math.round(
          Math.min(99, Math.max(35, (unitsProduced / capacity) * 100)) * 10,
        ) / 10;

      financials.push({
        date,
        businessUnitId: unit.id,
        revenueCents,
        cogsCents,
        opexCents,
      });
      operations.push({
        date,
        businessUnitId: unit.id,
        unitsProduced,
        laborHours,
        utilizationPct,
      });
    }

    await db.dailyFinancials.createMany({ data: financials });
    await db.dailyOperations.createMany({ data: operations });
    console.log(
      `Seeded ${profile.name}: ${financials.length} days of financials + operations.`,
    );
  }

  const totalFin = await db.dailyFinancials.count();
  const totalOps = await db.dailyOperations.count();
  console.log(
    `Done. ${UNITS.length} business units, ${totalFin} financial rows, ${totalOps} operations rows.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
