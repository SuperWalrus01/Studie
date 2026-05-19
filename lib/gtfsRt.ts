import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { getTfwmCredentials } from "./gtfs";

const RT_URL = "http://api.tfwm.org.uk/gtfs/trip_updates";

const CACHE_TTL_MS = 30_000;

let delayCache: {
  fetchedAt: number;
  tripDelays: Map<string, number>;
} | null = null;

function getTripId(trip: { tripId?: string | null } | null | undefined): string | null {
  if (!trip) return null;
  return trip.tripId ?? null;
}

export async function fetchTripDelays(): Promise<Map<string, number>> {
  if (delayCache && Date.now() - delayCache.fetchedAt < CACHE_TTL_MS) {
    return delayCache.tripDelays;
  }

  const creds = getTfwmCredentials();
  if (!creds) return new Map();

  const url = `${RT_URL}?app_id=${encodeURIComponent(creds.appId)}&app_key=${encodeURIComponent(creds.appKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("GTFS-RT fetch failed:", res.status);
    return delayCache?.tripDelays ?? new Map();
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    buffer
  );

  const tripDelays = new Map<string, number>();

  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu) continue;

    const tripId = getTripId(tu.trip);
    if (!tripId) continue;

    let delaySec = 0;

    if (tu.trip?.scheduleRelationship !== undefined) {
      // keep scheduled unless cancelled
    }

    if (tu.delay != null) {
      delaySec = tu.delay;
    } else if (tu.stopTimeUpdate?.length) {
      const delays = tu.stopTimeUpdate
        .map((stu) => stu.departure?.delay ?? stu.arrival?.delay)
        .filter((d): d is number => d != null);
      if (delays.length) {
        delaySec = Math.max(...delays);
      }
    }

    tripDelays.set(tripId, delaySec);
  }

  delayCache = { fetchedAt: Date.now(), tripDelays };
  return tripDelays;
}
