import {
  getActiveCalendars,
  getLondonNowSeconds,
  loadGtfsSubset,
  serviceRunsToday,
} from "./gtfs";
import { fetchTripDelays } from "./gtfsRt";
import { getStopLabel } from "./stopLabels";
import { getStopIdsForTimetable } from "./stops";

const HORIZON_MIN = 120;
const MAX_DEPARTURES = 12;

export interface StopDeparture {
  route: string;
  departAt: string;
  leaveInMinutes: number;
  heading: string;
  live: boolean;
  /** Present so callers can collapse the several edges of one physical trip */
  tripId?: string;
}

export interface DepartureQuery {
  /** Only these route short names (already normalized, e.g. ["9", "9B"]) */
  routes?: readonly string[];
  /** Look this far ahead in minutes (default 120) */
  horizonMinutes?: number;
  limit?: number;
  /**
   * One trip produces an edge per tracked destination, so an 11 out of St Johns
   * appears three times. Collapse those to a single departure headed for the
   * furthest stop. Off by default to keep the existing departure boards as-is.
   */
  collapseByTrip?: boolean;
}

function secToTime(sec: number): string {
  const normalized = ((sec % (24 * 3600)) + 24 * 3600) % (24 * 3600);
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function minutesUntil(targetSec: number, nowSec: number): number {
  let diff = targetSec - nowSec;
  while (diff < -12 * 3600) diff += 24 * 3600;
  while (diff < 0) diff += 24 * 3600;
  return Math.round(diff / 60);
}

/**
 * Departures leaving any of `stopIds`, merged and de-duplicated.
 * Each id is expanded to its bay group, so one St Johns bay pulls in all four.
 */
export async function getDeparturesForStops(
  stopIds: readonly string[],
  query: DepartureQuery = {}
): Promise<StopDeparture[]> {
  const subset = await loadGtfsSubset();
  const { calendars, calendarDates } = await getActiveCalendars();
  const tripDelays = await fetchTripDelays();
  const nowSec = getLondonNowSeconds();

  const horizon = query.horizonMinutes ?? HORIZON_MIN;
  const limit = query.limit ?? MAX_DEPARTURES;
  const routeFilter = query.routes?.length ? new Set(query.routes) : null;

  const originStopIds = new Set<string>();
  for (const id of stopIds) {
    for (const grouped of getStopIdsForTimetable(id)) originStopIds.add(grouped);
  }

  const candidates: StopDeparture[] = [];
  /** tripId → the kept candidate and how far along the trip it reaches */
  const bestPerTrip = new Map<string, { arrivalSec: number; departure: StopDeparture }>();

  for (const edge of subset.edges) {
    if (!originStopIds.has(edge.originStopId)) continue;
    if (routeFilter && !routeFilter.has(edge.routeShortName)) continue;
    if (!serviceRunsToday(edge.serviceId, calendars, calendarDates)) continue;

    const delaySec = tripDelays.get(edge.tripId) ?? 0;
    const departSec = edge.departureSec + delaySec;
    const leaveIn = minutesUntil(departSec, nowSec);

    if (leaveIn > horizon) continue;
    if (leaveIn < -5 && departSec < nowSec - 120) continue;

    const departure: StopDeparture = {
      route: edge.routeShortName,
      departAt: secToTime(departSec),
      leaveInMinutes: Math.max(0, leaveIn),
      heading: getStopLabel(edge.destStopId),
      live: delaySec !== 0,
      tripId: edge.tripId,
    };

    if (query.collapseByTrip) {
      const held = bestPerTrip.get(edge.tripId);
      if (!held || edge.arrivalSec > held.arrivalSec) {
        bestPerTrip.set(edge.tripId, { arrivalSec: edge.arrivalSec, departure });
      }
    } else {
      candidates.push(departure);
    }
  }

  if (query.collapseByTrip) {
    for (const { departure } of bestPerTrip.values()) candidates.push(departure);
  }

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = `${c.route}|${c.departAt}|${c.heading}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const [ah, am] = a.departAt.split(":").map(Number);
    const [bh, bm] = b.departAt.split(":").map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });

  return unique.slice(0, limit);
}

export async function getStopDepartures(
  stopId: string
): Promise<StopDeparture[]> {
  return getDeparturesForStops([stopId]);
}
