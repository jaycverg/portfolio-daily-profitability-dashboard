import { NextResponse } from "next/server";
import { z } from "zod";
import { getDrillDown, defaultRange } from "@/lib/metrics";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd");

const querySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    unit: z.string().min(1).optional(),
  })
  .refine(
    (q) => !q.from || !q.to || q.from <= q.to,
    { message: "`from` must be on or before `to`", path: ["from"] },
  );

/**
 * GET /api/drill-down?from=YYYY-MM-DD&to=YYYY-MM-DD&unit=<id>
 * Recomputes per-day metrics, aggregate, and waterfall for the selection.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    unit: searchParams.get("unit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const fallback = defaultRange(90);
  const range = {
    from: parsed.data.from ?? fallback.from,
    to: parsed.data.to ?? fallback.to,
  };

  const data = await getDrillDown(range, parsed.data.unit);
  return NextResponse.json({ range, businessUnitId: parsed.data.unit ?? null, ...data });
}
