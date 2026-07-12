import {
  getActiveCalendars,
  getLondonNowSeconds,
  loadGtfsSubset,
  serviceRunsToday,
  type TripEdge,
} from "./gtfs";
import { fetchTripDelays } from "./gtfsRt";
import type { BoardingStop, TripConfig, TripDestination } from "./journeys";
import {
  NEW_UNION_TO_CITY_VILLAGE_WALK_MIN,
  NEW_UNION_TO_ST_JOHNS_BOARDS,
  NEW_UNION_TRANSFER_ROUTES,
  VIA_RAIL_STATION,
} from "./journeys";
import { ST_JOHNS_STOP_IDS } from "./stops";
import { type BusOption } from "./busOption";

export type { BusOption } from "./busOption";

const HORIZON_MIN = 120;
const MAX_OPTIONS = 8;

export interface TripOptionsResult {
  options: BusOption[];
  /** Cross street · 17/21 to St Johns after 11 / 12X */
  connectorOptions?: BusOption[];
}

/** Beyond this, waiting for a connection never beats the alternatives */
const MAX_TRANSFER_WAIT_MIN = 30;

interface ChainSpec {
  arriveLabel: string;
  changeStopLabel: string;
  changeHint: string;
  minTransferMin: number;
}

/** Hop off 11/12X at New Union, cross the street, 17/21 to St Johns */
const NEW_UNION_CHAIN: ChainSpec = {
  arriveLabel: "St Johns Church",
  changeStopLabel: "New Union St",
  changeHint: "cross the street",
  minTransferMin: 3,
};

/** Feeder bus to Rail Station Bridge, 12X to campus from the same stop */
const RAIL_STATION_CHAIN: ChainSpec = {
  arriveLabel: "Warwick Uni",
  changeStopLabel: "Rail Station Bridge",
  changeHint: "same stop",
  minTransferMin: 2,
};

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

function routeMatches(routeShortName: string, allowed: string[]): boolean {
  const upper = routeShortName.toUpperCase();
  return allowed.some((r) => r.toUpperCase() === upper);
}

function resolveDestStopIds(route: string, dest: TripDestination): string[] {
  const primary = dest.altByRoute?.[route] ?? dest.stopId;
  const ids = new Set<string>([primary, dest.stopId, ...(dest.alsoStopIds ?? [])]);
  return [...ids];
}

function edgeToOption(
  edge: TripEdge,
  board: BoardingStop,
  delaySec: number,
  nowSec: number
): Omit<BusOption, "fastest"> | null {
  const walkSec = (board.walkMinutes ?? 0) * 60;
  const departSec = edge.departureSec + delaySec;
  const arriveSec = edge.arrivalSec + delaySec;
  const leaveAccommodationSec = departSec - walkSec;

  const leaveIn = minutesUntil(leaveAccommodationSec, nowSec);
  if (leaveIn > HORIZON_MIN) return null;
  if (leaveIn < -5 && departSec + delaySec < nowSec - 120) return null;

  return {
    route: edge.routeShortName,
    boardStopLabel: board.label,
    walkMinutes: board.walkMinutes,
    departAt: secToTime(departSec),
    arriveAt: secToTime(arriveSec),
    leaveInMinutes: Math.max(0, leaveIn),
    durationMinutes: Math.max(1, Math.round((arriveSec - departSec) / 60)),
    live: delaySec !== 0,
  };
}

async function collectOptions(
  boards: BoardingStop[],
  getDestStopIds: (route: string) => string[],
  nowSec: number
): Promise<Omit<BusOption, "fastest">[]> {
  const subset = await loadGtfsSubset();
  const { calendars, calendarDates } = await getActiveCalendars();
  const tripDelays = await fetchTripDelays();

  const candidates: Omit<BusOption, "fastest">[] = [];

  for (const board of boards) {
    for (const edge of subset.edges) {
      if (edge.originStopId !== board.stopId) continue;
      if (!routeMatches(edge.routeShortName, board.routes)) continue;

      const destIds = getDestStopIds(edge.routeShortName);
      if (!destIds.includes(edge.destStopId)) continue;
      if (!serviceRunsToday(edge.serviceId, calendars, calendarDates)) continue;

      const delaySec = tripDelays.get(edge.tripId) ?? 0;
      const opt = edgeToOption(edge, board, delaySec, nowSec);
      if (opt) candidates.push(opt);
    }
  }

  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.route}|${c.departAt}|${c.arriveAt}|${c.boardStopLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseTimeToComparable(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesBetween(earlier: string, later: string): number {
  let diff = parseTimeToComparable(later) - parseTimeToComparable(earlier);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

function isTransferRoute(route: string): boolean {
  return NEW_UNION_TRANSFER_ROUTES.some(
    (r) => r.toUpperCase() === route.toUpperCase()
  );
}

/** Best two-leg option: main leg + earliest-arriving valid connector */
function chainLegs(
  main: Omit<BusOption, "fastest">,
  connectors: Omit<BusOption, "fastest">[],
  spec: ChainSpec
): Omit<BusOption, "fastest"> | null {
  let best: Omit<BusOption, "fastest"> | null = null;

  for (const conn of connectors) {
    /** minutesBetween wraps midnight, so a connector departing before the
     *  main leg arrives shows up as a ~24h wait — the max cap rejects it */
    const wait = minutesBetween(main.arriveAt, conn.departAt);
    if (wait < spec.minTransferMin || wait > MAX_TRANSFER_WAIT_MIN) continue;

    const chained: Omit<BusOption, "fastest"> = {
      route: `${main.route} → ${conn.route}`,
      boardStopLabel: main.boardStopLabel,
      walkMinutes: main.walkMinutes,
      departAt: main.departAt,
      arriveAt: conn.arriveAt,
      arriveLabel: spec.arriveLabel,
      leaveInMinutes: main.leaveInMinutes,
      durationMinutes: main.durationMinutes + wait + conn.durationMinutes,
      live: main.live || conn.live,
      chained: true,
      changeArriveAt: main.arriveAt,
      changeStopLabel: spec.changeStopLabel,
      changeHint: spec.changeHint,
      connectorRoute: conn.route,
      connectorDepartAt: conn.departAt,
      transferWaitMinutes: wait,
    };

    const better =
      !best ||
      parseTimeToComparable(chained.arriveAt) <
        parseTimeToComparable(best.arriveAt) ||
      (parseTimeToComparable(chained.arriveAt) ===
        parseTimeToComparable(best.arriveAt) &&
        wait < (best.transferWaitMinutes ?? Infinity));
    if (better) best = chained;
  }

  return best;
}

/** Take the 11/12X to New Union, then walk home instead of changing buses */
function walkHomeOption(
  leg: Omit<BusOption, "fastest">
): Omit<BusOption, "fastest"> {
  return {
    ...leg,
    route: `${leg.route} → walk`,
    arriveAt: addMinutesToTime(leg.arriveAt, NEW_UNION_TO_CITY_VILLAGE_WALK_MIN),
    arriveLabel: "City Village",
    durationMinutes: leg.durationMinutes + NEW_UNION_TO_CITY_VILLAGE_WALK_MIN,
    changeArriveAt: leg.arriveAt,
    changeStopLabel: "New Union St",
    walkFromNewUnion: true,
  };
}

function buildGoingHomeCityVillageOptions(
  raw: Omit<BusOption, "fastest">[],
  connectors: Omit<BusOption, "fastest">[]
): Omit<BusOption, "fastest">[] {
  const direct = raw.filter((o) => !isTransferRoute(o.route));
  const viaNewUnion: Omit<BusOption, "fastest">[] = [];

  for (const leg of raw.filter((o) => isTransferRoute(o.route))) {
    const combo = chainLegs(leg, connectors, NEW_UNION_CHAIN);
    const walk = walkHomeOption(leg);
    if (
      combo &&
      parseTimeToComparable(combo.arriveAt) <=
        parseTimeToComparable(walk.arriveAt)
    ) {
      viaNewUnion.push(combo);
    } else {
      viaNewUnion.push(walk);
    }
  }

  return [...direct, ...viaNewUnion];
}

function rankOptions(raw: Omit<BusOption, "fastest">[]): BusOption[] {
  const sorted = [...raw].sort((a, b) => {
    const arriveA = parseTimeToComparable(a.arriveAt);
    const arriveB = parseTimeToComparable(b.arriveAt);
    if (arriveA !== arriveB) return arriveA - arriveB;
    return a.leaveInMinutes - b.leaveInMinutes;
  });

  const sliced = sorted.slice(0, MAX_OPTIONS);
  if (!sliced.length) return [];

  const fastestArrive = parseTimeToComparable(sliced[0].arriveAt);
  return sliced.map((o, i) => ({
    ...o,
    fastest:
      i === 0 || parseTimeToComparable(o.arriveAt) === fastestArrive,
  }));
}

export async function getOptionsForTrip(
  trip: TripConfig,
  originKey: string,
  destinationKey?: string
): Promise<TripOptionsResult> {
  const nowSec = getLondonNowSeconds();

  if (trip.id === "goingHome") {
    const boards = trip.origins?.[originKey as keyof typeof trip.origins];
    const destBoards =
      trip.destinations?.[destinationKey as keyof typeof trip.destinations];
    if (!boards?.length || !destBoards?.length) return { options: [] };

    const all: Omit<BusOption, "fastest">[] = [];

    for (const board of boards) {
      for (const destBoard of destBoards) {
        const sharedRoutes = board.routes.filter((r) =>
          destBoard.routes.some((dr) => dr.toUpperCase() === r.toUpperCase())
        );
        if (!sharedRoutes.length) continue;

        const boardFiltered: BoardingStop = {
          ...board,
          routes: sharedRoutes,
        };

        const opts = await collectOptions(
          [boardFiltered],
          () => [destBoard.stopId],
          nowSec
        );
        all.push(...opts);
      }
    }

    /** Unranked: chaining needs every connector in the horizon, not the top 8 */
    const connectorRaw = await collectNewUnionToStJohnsRaw();

    const merged =
      destinationKey === "cityVillage"
        ? buildGoingHomeCityVillageOptions(all, connectorRaw)
        : all;

    return {
      options: rankOptions(merged),
      connectorOptions: rankOptions(connectorRaw),
    };
  }

  const boards = trip.origins?.[originKey as keyof typeof trip.origins];
  if (!boards?.length || !trip.destination || !("stopId" in trip.destination)) {
    return { options: [] };
  }

  const dest = trip.destination;
  const raw = await collectOptions(
    boards,
    (route) => resolveDestStopIds(route, dest),
    nowSec
  );

  /** From City Village a 9/9B/11/87 to the rail station can catch the 12X */
  if (trip.id === "toWarwick" && originKey === "cityVillage") {
    const feeders = await collectOptions(
      VIA_RAIL_STATION.feederBoards,
      () => [VIA_RAIL_STATION.stationStopId],
      nowSec
    );
    const connectors = await collectOptions(
      [VIA_RAIL_STATION.connectorBoard],
      (route) => resolveDestStopIds(route, dest),
      nowSec
    );
    for (const feeder of feeders) {
      const combo = chainLegs(feeder, connectors, RAIL_STATION_CHAIN);
      if (combo) raw.push(combo);
    }
  }

  return { options: rankOptions(raw) };
}

/** 17 / 21 etc. from New Union BY1 or BY5 → St Johns Church */
async function collectNewUnionToStJohnsRaw(): Promise<
  Omit<BusOption, "fastest">[]
> {
  const nowSec = getLondonNowSeconds();
  const dests = ST_JOHNS_STOP_IDS as readonly string[];
  return collectOptions(NEW_UNION_TO_ST_JOHNS_BOARDS, () => [...dests], nowSec);
}

export async function getNewUnionToStJohnsOptions(): Promise<BusOption[]> {
  return rankOptions(await collectNewUnionToStJohnsRaw());
}

export { pickFastest } from "./busOption";
