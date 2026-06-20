import { Suspense } from "react";
import { getDrillDown, listBusinessUnits, defaultRange } from "@/lib/metrics";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { Waterfall } from "@/components/charts/Waterfall";
import { DrillDownControls } from "@/components/dashboard/DrillDownControls";
import { DailyBreakdownTable } from "@/components/dashboard/DailyBreakdownTable";
import { formatCents, formatCentsPrecise, formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SearchParams {
  from?: string;
  to?: string;
  unit?: string;
}

export default async function DrillDownPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const fallback = defaultRange(90);
  const from = sp.from ?? fallback.from;
  const to = sp.to ?? fallback.to;
  const businessUnitId = sp.unit ?? "";

  const [units, { daily, aggregate, waterfall }] = await Promise.all([
    listBusinessUnits(),
    getDrillDown({ from, to }, businessUnitId || undefined),
  ]);

  const series = daily.map((d) => ({
    date: d.date,
    value: d.operatingProfitCents,
  }));

  const selectedUnitName =
    units.find((u) => u.id === businessUnitId)?.name ?? "All business units";

  return (
    <>
      <PageHeader
        title="Drill-down"
        description="Recompute the P&L and waterfall for any date range and business unit."
      />

      <Card className="mb-6">
        <CardBody>
          <Suspense fallback={<div className="text-sm text-gray-400">Loading controls…</div>}>
            <DrillDownControls
              units={units}
              from={from}
              to={to}
              businessUnitId={businessUnitId}
            />
          </Suspense>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatCents(aggregate.revenueCents)} />
        <StatCard label="Gross Margin" value={formatPct(aggregate.grossMarginPct)} />
        <StatCard
          label="Operating Profit"
          value={formatCents(aggregate.operatingProfitCents)}
        />
        <StatCard
          label="Profit / Labor Hr"
          value={formatCentsPrecise(aggregate.profitPerLaborHourCents)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Operating Profit"
            subtitle={`${selectedUnitName} · ${daily.length} days`}
          />
          <CardBody>
            <AreaChart data={series} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Profit Waterfall" subtitle="For the selected range" />
          <CardBody>
            <Waterfall steps={waterfall} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Daily Breakdown"
            subtitle={`${selectedUnitName} · newest first`}
          />
          <CardBody className="p-0 sm:p-2">
            <DailyBreakdownTable daily={daily} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
