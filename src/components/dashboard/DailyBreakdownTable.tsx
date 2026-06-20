import type { DailyMetrics } from "@/lib/profitability";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { MarginBadge } from "@/components/ui/Badge";
import {
  cn,
  formatCents,
  formatCentsPrecise,
  formatDateLong,
  formatNumber,
} from "@/lib/utils";

export function DailyBreakdownTable({ daily }: { daily: DailyMetrics[] }) {
  // Newest first for the drill-down table.
  const rows = [...daily].reverse();
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH align="right">Revenue</TH>
          <TH align="right">COGS</TH>
          <TH align="right">Gross</TH>
          <TH align="right">Margin</TH>
          <TH align="right">Opex</TH>
          <TH align="right">Op. Profit</TH>
          <TH align="right">Units</TH>
          <TH align="right">Profit / Unit</TH>
        </TR>
      </THead>
      <tbody>
        {rows.map((d) => (
          <TR key={d.date}>
            <TD>{formatDateLong(d.date)}</TD>
            <TD align="right">{formatCents(d.revenueCents)}</TD>
            <TD align="right">{formatCents(d.cogsCents)}</TD>
            <TD align="right">{formatCents(d.grossProfitCents)}</TD>
            <TD align="right">
              <MarginBadge marginPct={d.grossMarginPct} />
            </TD>
            <TD align="right">{formatCents(d.opexCents)}</TD>
            <TD
              align="right"
              className={cn(
                "font-medium",
                d.operatingProfitCents < 0 ? "text-red-600" : "text-gray-900",
              )}
            >
              {formatCents(d.operatingProfitCents)}
            </TD>
            <TD align="right">{formatNumber(d.unitsProduced)}</TD>
            <TD align="right">{formatCentsPrecise(d.profitPerUnitCents)}</TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}
