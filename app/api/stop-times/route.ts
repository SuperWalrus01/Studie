import { NextRequest, NextResponse } from "next/server";
import { getStopDepartures } from "@/lib/stopTimes";
import { getTfwmCredentials } from "@/lib/gtfs";
import { getStopLabel } from "@/lib/stopLabels";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!getTfwmCredentials()) {
    return NextResponse.json(
      { error: "Missing TFWM_APP_ID or TFWM_APP_KEY in .env.local" },
      { status: 503 }
    );
  }

  const stopId = req.nextUrl.searchParams.get("stopId");
  if (!stopId) {
    return NextResponse.json({ error: "Missing stopId" }, { status: 400 });
  }

  try {
    const departures = await getStopDepartures(stopId);
    return NextResponse.json({
      stopId,
      label: getStopLabel(stopId),
      updatedAt: new Date().toISOString(),
      departures,
    });
  } catch (err) {
    console.error("stop-times error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load stop timetable",
      },
      { status: 500 }
    );
  }
}
