import { NextRequest, NextResponse } from "next/server";
import { checkProxyKey } from "@/lib/alexaProxy";
import { pickFastest } from "@/lib/busOption";
import { getOptionsForTrip } from "@/lib/compare";
import { getTfwmCredentials } from "@/lib/gtfs";
import { getTrip } from "@/lib/journeys";
import { speakOption } from "@/lib/voice";

export const dynamic = "force-dynamic";

/** Spoken direction → the trip/origin/destination triple `compare.ts` expects */
const DIRECTIONS = {
  towarwick: {
    tripId: "toWarwick",
    origin: "cityVillage",
    destination: undefined as string | undefined,
    prefix: "Fastest way to campus:",
    destinationLabel: "Warwick Uni",
    nothing: "I can't find a bus to Warwick in the next two hours.",
  },
  home: {
    tripId: "goingHome",
    origin: "warwick",
    destination: "cityVillage",
    prefix: "Fastest way home:",
    destinationLabel: "City Village",
    nothing: "I can't find a bus home from campus in the next two hours.",
  },
} as const;

type DirectionKey = keyof typeof DIRECTIONS;

function resolveDirection(raw: string | null): DirectionKey {
  const text = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (["home", "goinghome", "back", "city", "cityvillage"].includes(text)) {
    return "home";
  }
  return "towarwick";
}

/** GET /api/alexa/fastest?direction=towarwick|home */
export async function GET(req: NextRequest) {
  const denied = checkProxyKey(req);
  if (denied) return denied;

  if (!getTfwmCredentials()) {
    return NextResponse.json(
      { speech: "The timetable service isn't set up right now.", error: "Missing TfWM credentials" },
      { status: 503 }
    );
  }

  const key = resolveDirection(req.nextUrl.searchParams.get("direction"));
  const spec = DIRECTIONS[key];
  const trip = getTrip(spec.tripId);

  if (!trip) {
    return NextResponse.json(
      { speech: "That journey isn't configured.", error: "Unknown trip" },
      { status: 500 }
    );
  }

  try {
    const { options } = await getOptionsForTrip(
      trip,
      spec.origin,
      spec.destination
    );
    const best = pickFastest(options);

    if (!best) {
      return NextResponse.json({
        resolved: true,
        direction: key,
        speech: spec.nothing,
        option: null,
      });
    }

    return NextResponse.json({
      resolved: true,
      direction: key,
      updatedAt: new Date().toISOString(),
      speech: speakOption(best, spec.prefix, spec.destinationLabel),
      cardTitle: trip.title,
      option: best,
      /** Next-best two, for a "what else" follow-up */
      alternatives: options.filter((o) => o !== best).slice(0, 2),
    });
  } catch (err) {
    console.error("alexa/fastest error:", err);
    return NextResponse.json(
      {
        speech: "I couldn't work out the fastest bus just now.",
        error: err instanceof Error ? err.message : "Fastest lookup failed",
      },
      { status: 500 }
    );
  }
}
