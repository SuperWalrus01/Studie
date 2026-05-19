import { NextRequest, NextResponse } from "next/server";
import { getOptionsForTrip } from "@/lib/compare";
import { getTfwmCredentials } from "@/lib/gtfs";
import { getTrip } from "@/lib/journeys";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const creds = getTfwmCredentials();
  if (!creds) {
    return NextResponse.json(
      {
        error:
          "Missing API credentials. Add TFWM_APP_ID and TFWM_APP_KEY to .env.local",
      },
      { status: 503 }
    );
  }

  const tripId = request.nextUrl.searchParams.get("trip");
  const origin = request.nextUrl.searchParams.get("origin");
  const destination = request.nextUrl.searchParams.get("destination") ?? undefined;

  if (!tripId || !origin) {
    return NextResponse.json(
      { error: "Missing trip or origin parameter" },
      { status: 400 }
    );
  }

  const trip = getTrip(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Unknown trip" }, { status: 400 });
  }

  if (trip.id === "goingHome" && !destination) {
    return NextResponse.json(
      { error: "Missing destination for going home" },
      { status: 400 }
    );
  }

  try {
    const { options, connectorOptions } = await getOptionsForTrip(
      trip,
      origin,
      destination
    );
    return NextResponse.json({
      trip: tripId,
      origin,
      destination: destination ?? null,
      updatedAt: new Date().toISOString(),
      options,
      connectorOptions: connectorOptions ?? null,
    });
  } catch (err) {
    console.error("options error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load bus options",
      },
      { status: 500 }
    );
  }
}
