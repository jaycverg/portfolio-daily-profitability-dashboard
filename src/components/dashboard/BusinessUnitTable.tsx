import type { BusinessUnitMetrics } from "@/lib/profitability";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { MarginBadge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatCents, formatCentsPrecise, formatNumber } from "@/lib/utils";

export function BusinessUnitTable({ units }: { units: BusinessUnitMetrics[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Business Unit</TH>
          <TH align="right">Revenue</TH>
          <TH align="right">Gross Margin</TH>
          <TH align="right">Op. Profit</TH>
          <TH align="right">Profit / Unit</TH>
          <TH align="right">Profit / Hr</TH>
          <TH align="right">Util.</TH>
          <TH align="right">Trend</TH>
        </TR>
      </THead>
      <tbody>
        {units.map((u) => (
          <TR key={u.businessUnitId}>
            <TD>
              <div className="font-medium text-gray-900">{u.businessUnitName}</div>
            </TD>
            <TD align="right">{formatCents(u.revenueCents)}</TD>
            <TD align="right">
              <MarginBadge marginPct={u.grossMarginPct} />
            </TD>
            <TD align="right">{formatCents(u.operatingProfitCents)}</TD>
            <TD align="right">{formatCentsPrecise(u.profitPerUnitCents)}</TD>
            <TD align="right">{formatCentsPrecise(u.profitPerLaborHourCents)}</TD>
            <TD align="right">{formatNumber(u.utilizationPct)}%</TD>
            <TD align="right">
              <div className="flex justify-end">
                <Sparkline data={u.operatingProfitSeries} />
              </div>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}
