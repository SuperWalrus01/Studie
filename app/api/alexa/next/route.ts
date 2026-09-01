import { NextRequest, NextResponse } from "next/server";
import { checkProxyKey } from "@/lib/alexaProxy";
import { getTfwmCredentials } from "@/lib/gtfs";
import { getDeparturesForStops } from "@/lib/stopTimes";
import {
  filterByDirection,
  listPlacesForSpeech,
  normalizeRoute,
  placeBySlug,
  resolveDirection,
  routeFamily,
  speakDepartures,
} from "@/lib/voice";

export const dynamic = "force-dynamic";

/**
 * GET /api/alexa/next?place=stjohns[&route=11][&direction=campus|city]
 *
 * Backs both "when is the next 11 at St Johns Church" and, with no `route`,
 * "what's the next bus at St Johns Church".
 */
export async function GET(req: NextRequest) {
  const denied = checkProxyKey(req);
  if (denied) return denied;

  if (!getTfwmCredentials()) {
    return NextResponse.json(
      { speech: "The timetable service isn't set up right now.", error: "Missing TfWM credentials" },
      { status: 503 }
    );
  }

  const placeParam = req.nextUrl.searchParams.get("place");
  const routeParam = req.nextUrl.searchParams.get("route");
  const direction = resolveDirection(req.nextUrl.searchParams.get("direction"));

  if (!placeParam) {
    return NextResponse.json(
      { speech: `Which stop? You can ask about ${listPlacesForSpeech()}.`, error: "Missing place" },
      { status: 400 }
    );
  }

  const place = placeBySlug(placeParam);
  if (!place) {
    return NextResponse.json({
      speech: `I don't know a stop called ${placeParam}. Try ${listPlacesForSpeech()}.`,
      resolved: false,
    });
  }

  let routes: readonly string[] | undefined;
  let spokenRoute: string | undefined;

  if (routeParam) {
    const normalized = normalizeRoute(routeParam);
    if (!normalized) {
      return NextResponse.json({
        speech: `I don't track a route called ${routeParam} at ${place.label}.`,
        resolved: false,
        place: place.slug,
      });
    }
    routes = routeFamily(normalized);
    spokenRoute = normalized;
  }

  try {
    const all = await getDeparturesForStops(place.stopIds, {
      routes,
      /** Filtering by direction discards some, so gather a few extra first */
      limit: direction ? 10 : routes ? 4 : 5,
      collapseByTrip: true,
    });

    const departures = filterByDirection(all, direction).slice(
      0,
      routes ? 4 : 5
    );

    return NextResponse.json({
      resolved: true,
      place: place.slug,
      placeLabel: place.label,
      route: spokenRoute ?? null,
      routesQueried: routes ?? null,
      direction,
      updatedAt: new Date().toISOString(),
      speech: speakDepartures(departures, place, spokenRoute, direction),
      cardTitle: spokenRoute ? `${spokenRoute} at ${place.label}` : place.label,
      departures,
    });
  } catch (err) {
    console.error("alexa/next error:", err);
    return NextResponse.json(
      {
        speech: "I couldn't reach the timetable just now. Try again in a moment.",
        error: err instanceof Error ? err.message : "Departure lookup failed",
      },
      { status: 500 }
    );
  }
}
