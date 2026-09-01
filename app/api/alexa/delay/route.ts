import { NextRequest, NextResponse } from "next/server";
import { checkProxyKey } from "@/lib/alexaProxy";
import { getTfwmCredentials } from "@/lib/gtfs";
import { getRouteStatus, speakRouteStatus } from "@/lib/routeStatus";
import { normalizeRoute, routeFamily, speakRoute } from "@/lib/voice";

export const dynamic = "force-dynamic";

/** GET /api/alexa/delay?route=11 — "is the 11 running late?" */
export async function GET(req: NextRequest) {
  const denied = checkProxyKey(req);
  if (denied) return denied;

  if (!getTfwmCredentials()) {
    return NextResponse.json(
      { speech: "The live bus feed isn't set up right now.", error: "Missing TfWM credentials" },
      { status: 503 }
    );
  }

  const routeParam = req.nextUrl.searchParams.get("route");
  if (!routeParam) {
    return NextResponse.json(
      { speech: "Which route do you want the status of?", error: "Missing route" },
      { status: 400 }
    );
  }

  const normalized = normalizeRoute(routeParam);
  if (!normalized) {
    return NextResponse.json({
      speech: `I don't track a route called ${routeParam}.`,
      resolved: false,
    });
  }

  try {
    const statuses = await getRouteStatus(routeFamily(normalized));
    return NextResponse.json({
      resolved: true,
      route: normalized,
      updatedAt: new Date().toISOString(),
      speech: speakRouteStatus(statuses, speakRoute(normalized)),
      cardTitle: `${normalized} status`,
      statuses,
    });
  } catch (err) {
    console.error("alexa/delay error:", err);
    return NextResponse.json(
      {
        speech: "I couldn't read the live bus feed just now.",
        error: err instanceof Error ? err.message : "Route status failed",
      },
      { status: 500 }
    );
  }
}
