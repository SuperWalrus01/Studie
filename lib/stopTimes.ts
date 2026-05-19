import {
  getActiveCalendars,
  getLondonNowSeconds,
  loadGtfsSubset,
  serviceRunsToday,
} from "./gtfs";
import { fetchTripDelays } from "./gtfsRt";
import { getStopLabel } from "./stopLabels";

const HORIZON_MIN = 120;
const MAX_DEPARTURES = 12;

export interface StopDeparture {
  route: string;
  departAt: string;
  leaveInMinutes: number;
  heading: string;
  live: boolean;
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

export async function getStopDepartures(
  stopId: string
): Promise<StopDeparture[]> {
  const subset = await loadGtfsSubset();
  const { calendars, calendarDates } = await getActiveCalendars();
  const tripDelays = await fetchTripDelays();
  const nowSec = getLondonNowSeconds();

  const candidates: StopDeparture[] = [];

  for (const edge of subset.edges) {
    if (edge.originStopId !== stopId) continue;
    if (!serviceRunsToday(edge.serviceId, calendars, calendarDates)) continue;

    const delaySec = tripDelays.get(edge.tripId) ?? 0;
    const departSec = edge.departureSec + delaySec;
    const leaveIn = minutesUntil(departSec, nowSec);

    if (leaveIn > HORIZON_MIN) continue;
    if (leaveIn < -5 && departSec < nowSec - 120) continue;

    candidates.push({
      route: edge.routeShortName,
      departAt: secToTime(departSec),
      leaveInMinutes: Math.max(0, leaveIn),
      heading: getStopLabel(edge.destStopId),
      live: delaySec !== 0,
    });
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

  return unique.slice(0, MAX_DEPARTURES);
}
