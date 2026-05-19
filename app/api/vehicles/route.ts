import { NextRequest, NextResponse } from "next/server";
import { fetchLiveVehicles, getBodsApiKey } from "@/lib/bods";
import { STOP_COORDS } from "@/lib/stopCoords";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getBodsApiKey()) {
    return NextResponse.json(
      { error: "Missing BODS_API_KEY in .env.local" },
      { status: 503 }
    );
  }

  const routesParam = req.nextUrl.searchParams.get("routes");
  const routes = routesParam
    ? routesParam.split(",").map((r) => r.trim()).filter(Boolean)
    : undefined;

  try {
    const vehicles = await fetchLiveVehicles(routes);
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      vehicles,
      stops: STOP_COORDS,
    });
  } catch (err) {
    console.error("vehicles error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch live vehicles",
      },
      { status: 500 }
    );
  }
}
