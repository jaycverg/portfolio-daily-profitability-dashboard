import { NextResponse } from "next/server";
import { z } from "zod";
import { getOverview } from "@/lib/metrics";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});

/** GET /api/overview?days=90 — aggregated overview metrics for the dashboard. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    days: searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = await getOverview(parsed.data.days);
  return NextResponse.json(data);
}
