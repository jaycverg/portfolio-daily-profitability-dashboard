import { DollarSign, Percent, TrendingUp, Boxes } from "lucide-react";
import { getOverview } from "@/lib/metrics";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { AreaChart } from "@/components/charts/AreaChart";
import { Waterfall } from "@/components/charts/Waterfall";
import { BusinessUnitTable } from "@/components/dashboard/BusinessUnitTable";
import {
  formatCents,
  formatCentsPrecise,
  formatDateLong,
  formatPct,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { daily, businessUnits, delta, waterfall } = await getOverview(90);
  const today = delta.today;

  const series = daily.map((d) => ({
    date: d.date,
    value: d.operatingProfitCents,
  }));

  return (
    <>
      <PageHeader
        title="Profitability Overview"
        description={
          today
            ? `Most recent business day: ${formatDateLong(today.date)} · all business units`
            : "No data yet — run the seed."
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue (today)"
          value={today ? formatCents(today.revenueCents) : "—"}
          delta={delta.revenueDeltaPct}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Gross Margin"
          value={today ? formatPct(today.grossMarginPct) : "—"}
          delta={delta.grossMarginDeltaPts}
          deltaSuffix="pts"
          icon={<Percent className="h-4 w-4" />}
        />
        <StatCard
          label="Operating Profit"
          value={today ? formatCents(today.operatingProfitCents) : "—"}
          delta={delta.operatingProfitDeltaPct}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Profit / Unit"
          value={today ? formatCentsPrecise(today.profitPerUnitCents) : "—"}
          delta={delta.profitPerUnitDeltaPct}
          icon={<Boxes className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Daily Operating Profit"
            subtitle="Last 90 days · all business units combined"
          />
          <CardBody>
            <AreaChart data={series} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Profit Waterfall"
            subtitle={
              today ? `For ${formatDateLong(today.date)}` : "Most recent day"
            }
          />
          <CardBody>
            <Waterfall steps={waterfall} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Profitability by Business Unit"
            subtitle="Aggregated across the full 90-day window · sorted by operating profit"
          />
          <CardBody className="p-0 sm:p-2">
            <BusinessUnitTable units={businessUnits} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
