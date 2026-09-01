import {
  getActiveCalendars,
  getLondonNowSeconds,
  loadGtfsSubset,
  serviceRunsToday,
} from "./gtfs";
import { fetchTripDelays } from "./gtfsRt";

/** How far ahead a trip counts as "running now" for a punctuality read */
const WINDOW_AHEAD_MIN = 90;
const WINDOW_BEHIND_MIN = 15;

export interface RouteStatus {
  route: string;
  /** Distinct trips of this route scheduled inside the window */
  upcomingTrips: number;
  /** How many of those have a non-zero live adjustment in GTFS-RT */
  liveTrips: number;
  averageDelayMinutes: number;
  maxDelayMinutes: number;
}

/**
 * Punctuality for one or more routes, read off the same GTFS-RT trip updates
 * the departure boards already use. Only trips touching a tracked stop count.
 */
export async function getRouteStatus(
  routes: readonly string[]
): Promise<RouteStatus[]> {
  const subset = await loadGtfsSubset();
  const { calendars, calendarDates } = await getActiveCalendars();
  const tripDelays = await fetchTripDelays();
  const nowSec = getLondonNowSeconds();

  const wanted = new Set(routes);
  /** route → tripId → delay seconds (a trip has many edges; count it once) */
  const perRoute = new Map<string, Map<string, number>>();

  for (const edge of subset.edges) {
    if (!wanted.has(edge.routeShortName)) continue;
    if (!serviceRunsToday(edge.serviceId, calendars, calendarDates)) continue;

    const minutesAway = (edge.departureSec - nowSec) / 60;
    if (minutesAway > WINDOW_AHEAD_MIN || minutesAway < -WINDOW_BEHIND_MIN) {
      continue;
    }

    let trips = perRoute.get(edge.routeShortName);
    if (!trips) {
      trips = new Map();
      perRoute.set(edge.routeShortName, trips);
    }
    trips.set(edge.tripId, tripDelays.get(edge.tripId) ?? 0);
  }

  return routes.map((route) => {
    const trips = perRoute.get(route);
    if (!trips || trips.size === 0) {
      return {
        route,
        upcomingTrips: 0,
        liveTrips: 0,
        averageDelayMinutes: 0,
        maxDelayMinutes: 0,
      };
    }

    const delays = [...trips.values()];
    const live = delays.filter((d) => d !== 0);
    const sum = live.reduce((acc, d) => acc + d, 0);
    /** Furthest from on-time, keeping its sign (negative = early) */
    const worstSec = live.reduce((a, d) => (Math.abs(d) > Math.abs(a) ? d : a), 0);

    return {
      route,
      upcomingTrips: trips.size,
      liveTrips: live.length,
      averageDelayMinutes: live.length ? Math.round(sum / live.length / 60) : 0,
      maxDelayMinutes: Math.round(worstSec / 60),
    };
  });
}

export function speakRouteStatus(
  statuses: readonly RouteStatus[],
  spokenRoute: string
): string {
  const active = statuses.filter((s) => s.upcomingTrips > 0);

  if (!active.length) {
    return `I don't see any ${spokenRoute} services running in the next hour and a half, so there's nothing to report.`;
  }

  const live = active.filter((s) => s.liveTrips > 0);
  if (!live.length) {
    const trips = active.reduce((n, s) => n + s.upcomingTrips, 0);
    return `The ${spokenRoute} has ${trips} ${
      trips === 1 ? "service" : "services"
    } coming up and none of them are reporting a delay right now, so it's running to schedule.`;
  }

  const worst = live.reduce((a, b) =>
    Math.abs(b.averageDelayMinutes) > Math.abs(a.averageDelayMinutes) ? b : a
  );

  if (worst.averageDelayMinutes < 0) {
    return `The ${spokenRoute} is running about ${Math.abs(
      worst.averageDelayMinutes
    )} minutes early on ${worst.liveTrips} of ${worst.upcomingTrips} upcoming services. Don't cut it fine.`;
  }

  if (worst.averageDelayMinutes === 0) {
    return `The ${spokenRoute} is tracking live and is essentially on time.`;
  }

  const detail =
    worst.maxDelayMinutes > worst.averageDelayMinutes + 2
      ? ` The worst one is ${worst.maxDelayMinutes} minutes behind.`
      : "";

  return `The ${spokenRoute} is running about ${worst.averageDelayMinutes} ${
    worst.averageDelayMinutes === 1 ? "minute" : "minutes"
  } late, based on ${worst.liveTrips} of ${worst.upcomingTrips} upcoming services reporting live.${detail}`;
}
