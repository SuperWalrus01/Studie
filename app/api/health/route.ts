import { NextResponse } from "next/server";
import { getBodsApiKey } from "@/lib/bods";
import { getTfwmCredentials, loadGtfsSubset } from "@/lib/gtfs";
import { existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const bundledSubset = existsSync(
    join(process.cwd(), "data", "gtfs-subset.json")
  );
  const tfwm = !!getTfwmCredentials();
  const bods = !!getBodsApiKey();

  let gtfsEdges: number | null = null;
  let gtfsError: string | null = null;

  if (tfwm) {
    try {
      const subset = await loadGtfsSubset();
      gtfsEdges = subset.edges.length;
    } catch (err) {
      gtfsError = err instanceof Error ? err.message : "GTFS load failed";
    }
  }

  const ok = tfwm && bods && gtfsEdges != null && gtfsEdges > 0;

  return NextResponse.json({
    ok,
    bundledSubset,
    env: { tfwm, bods },
    gtfs: { edges: gtfsEdges, error: gtfsError },
    vercel: !!process.env.VERCEL,
  });
}
