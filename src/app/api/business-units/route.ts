import { NextResponse } from "next/server";
import { listBusinessUnits } from "@/lib/metrics";

/** GET /api/business-units — list of business units for filters. */
export async function GET() {
  const units = await listBusinessUnits();
  return NextResponse.json({ units });
}
