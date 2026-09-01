/**
 * Voice glue for the Alexa skill: maps spoken place/route names onto the
 * NaPTAN stop groups and GTFS route short names the app already tracks,
 * and phrases answers as speech.
 *
 * Nothing here queries GTFS — it only resolves words to identifiers and
 * turns `StopDeparture[]` into sentences. See `app/api/alexa/*`.
 */
import { NEW_UNION_TO_CITY_VILLAGE_WALK_MIN } from "./journeys";
import { ROUTE_NAMES, CITY_CONNECTOR_ROUTES, STOPS } from "./stops";
import type { StopDeparture } from "./stopTimes";
import type { BusOption } from "./busOption";

/** Every route in the timetable subset, campus routes first */
export const ALL_TRACKED_ROUTES: readonly string[] = [
  ...ROUTE_NAMES,
  ...CITY_CONNECTOR_ROUTES,
];

/**
 * A place a user can name out loud. `stopIds` are expanded to their full bay
 * group by `getDeparturesForStops`, so listing one id per physical bay is enough.
 */
export interface VoicePlace {
  slug: string;
  /** Spoken back to the user */
  label: string;
  stopIds: readonly string[];
  /** Lowercase forms callers might say; matched after normalization */
  synonyms: readonly string[];
}

export const VOICE_PLACES: readonly VoicePlace[] = [
  {
    slug: "stjohns",
    label: "St Johns Church",
    stopIds: [STOPS.stJohnsCS1, STOPS.stJohnsCS2, STOPS.stJohnsCS3, STOPS.stJohnsCS4],
    synonyms: [
      "st johns church",
      "st johns",
      "saint johns church",
      "saint johns",
      "st johns church coventry",
      "the church",
      "city village",
      "corporation street",
    ],
  },
  {
    slug: "newunion",
    label: "New Union Street",
    stopIds: [
      STOPS.newUnionBY1,
      STOPS.newUnionBY2,
      STOPS.newUnionBY3,
      STOPS.newUnionBY4,
      STOPS.newUnionBY5,
    ],
    synonyms: ["new union street", "new union", "new union st", "union street"],
  },
  {
    slug: "railstation",
    label: "Rail Station Bridge",
    stopIds: [STOPS.railStationOut, STOPS.railStationIn],
    synonyms: [
      "rail station bridge",
      "rail station",
      "railstation bridge",
      "railstation",
      "the rail station",
      "train station",
      "the train station",
      "coventry station",
      "coventry rail station",
      "the station",
      "station bridge",
    ],
  },
  {
    slug: "poolmeadow",
    label: "Pool Meadow",
    stopIds: [STOPS.poolMeadow11, STOPS.poolMeadow12X, STOPS.poolMeadow87],
    synonyms: [
      "pool meadow",
      "pool meadow bus station",
      "poolmeadow",
      "the bus station",
    ],
  },
  {
    slug: "warwick",
    label: "Warwick Uni Interchange",
    stopIds: [
      STOPS.warwickUW1,
      STOPS.warwickUW2,
      STOPS.warwickUW3,
      STOPS.warwickUW4,
    ],
    synonyms: [
      "warwick uni",
      "warwick university",
      "the university",
      "uni",
      "campus",
      "uni interchange",
      "interchange",
      "university of warwick",
    ],
  },
  {
    slug: "scarman",
    label: "Scarman Road",
    stopIds: [STOPS.warwickScarmanGH3, STOPS.warwickScarmanGH4],
    synonyms: ["scarman road", "scarman", "scarman rd", "gibbet hill"],
  },
];

/**
 * Saying "the 9" should also surface a 9B — the letter variants run the same
 * corridor. Saying "9B" stays exact.
 */
const ROUTE_FAMILIES: Record<string, readonly string[]> = {
  "9": ["9", "9B"],
  "14": ["14", "14A"],
  "17": ["17", "17A"],
  "21": ["21", "21A", "21S"],
};

const SPOKEN_NUMBERS: Record<string, string> = {
  nine: "9",
  eleven: "11",
  twelve: "12",
  fourteen: "14",
  seventeen: "17",
  twenty: "20",
  "twenty one": "21",
  "twenty-one": "21",
  eighty: "80",
  "eighty seven": "87",
  "eighty-seven": "87",
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,'’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "twelve x" / "12 x" / "12ex" → "12X"; "eleven" → "11".
 * Returns null when the words don't name a route we track.
 */
export function normalizeRoute(spoken: string): string | null {
  let text = normalizeText(spoken)
    .replace(/\b(bus|service|route|number|the|no)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Longest first, so "eighty seven" wins over "eighty" and "twenty one" over "twenty"
  const spokenByLength = Object.entries(SPOKEN_NUMBERS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [word, digits] of spokenByLength) {
    text = text.replace(new RegExp(`\\b${word}\\b`, "g"), digits);
  }

  // "12 x", "12 ex", "12 express" → "12x"; "9 bee" → "9b"
  text = text
    .replace(/\b(ex|express|x-ray|xray)\b/g, "x")
    .replace(/\b(bee|be)\b/g, "b")
    .replace(/\b(ay|aye|alpha)\b/g, "a")
    .replace(/\b(ess|es|sierra)\b/g, "s")
    .replace(/\s+/g, "");

  const candidate = text.toUpperCase();
  const match = ALL_TRACKED_ROUTES.find((r) => r === candidate);
  return match ?? null;
}

/** Route short names to query for a spoken route (includes letter variants) */
export function routeFamily(route: string): readonly string[] {
  return ROUTE_FAMILIES[route] ?? [route];
}

export function resolvePlace(spoken: string): VoicePlace | null {
  const text = normalizeText(spoken).replace(/\b(stop|bus stop|at)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  for (const place of VOICE_PLACES) {
    if (place.slug === text) return place;
    if (place.synonyms.includes(text)) return place;
  }
  // Loose fallback: longest synonym contained in the utterance
  let best: { place: VoicePlace; length: number } | null = null;
  for (const place of VOICE_PLACES) {
    for (const syn of place.synonyms) {
      if (text.includes(syn) && (!best || syn.length > best.length)) {
        best = { place, length: syn.length };
      }
    }
  }
  return best?.place ?? null;
}

/**
 * Bay groups deliberately span both sides of a road, so "the next 12X at Rail
 * Station Bridge" can surface the city-bound one when the caller means campus.
 * An optional direction filters on the destination the app already labels.
 */
export type TravelDirection = "campus" | "city";

const DIRECTION_HEADINGS: Record<TravelDirection, readonly string[]> = {
  campus: ["Warwick Uni", "Scarman Rd"],
  city: ["St Johns Church", "New Union St", "Pool Meadow", "Rail Station"],
};

const DIRECTION_WORDS: Record<TravelDirection, readonly string[]> = {
  campus: [
    "campus", "warwick", "university", "uni", "scarman", "class",
    "outbound", "out",
  ],
  city: [
    "city", "town", "home", "st johns", "saint johns", "city village",
    "coventry", "back", "inbound", "in",
  ],
};

/**
 * Short tokens ("in", "out") must match a whole word — a substring test makes
 * "south" mean outbound. Longer ones may appear anywhere in the phrase.
 */
function mentions(text: string, words: readonly string[]): boolean {
  const spokenWords = new Set(text.split(" "));
  return words.some((w) =>
    w.length <= 4 && !w.includes(" ") ? spokenWords.has(w) : text.includes(w)
  );
}

export function resolveDirection(spoken: string | null): TravelDirection | null {
  if (!spoken) return null;
  const text = normalizeText(spoken).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  if (mentions(text, DIRECTION_WORDS.campus)) return "campus";
  if (mentions(text, DIRECTION_WORDS.city)) return "city";
  return null;
}

export function filterByDirection<T extends { heading: string }>(
  departures: readonly T[],
  direction: TravelDirection | null
): readonly T[] {
  if (!direction) return departures;
  const allowed = new Set(DIRECTION_HEADINGS[direction]);
  const filtered = departures.filter((d) => allowed.has(d.heading));
  /** Never answer with silence because a heading was unexpected */
  return filtered.length ? filtered : departures;
}

export function speakDirection(direction: TravelDirection): string {
  return direction === "campus" ? "towards campus" : "towards the city";
}

export function placeBySlug(slug: string): VoicePlace | null {
  const wanted = normalizeText(slug);
  return VOICE_PLACES.find((p) => p.slug === wanted) ?? resolvePlace(slug);
}

/** "14:32" → "2:32 PM" — Alexa reads 12-hour clock far more naturally */
export function speakClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export function speakMinutes(minutes: number): string {
  if (minutes <= 0) return "right now";
  if (minutes === 1) return "in 1 minute";
  return `in ${minutes} minutes`;
}

/**
 * "12X" → "12 X" so Alexa says "twelve X" rather than "twelvex".
 * `compare.ts` decorates some routes for display ("11 → walk"); the walk is
 * narrated separately, so drop anything after the arrow.
 */
export function speakRoute(route: string): string {
  return route.split("→")[0].trim().replace(/([0-9]+)([A-Z]+)/, "$1 $2");
}

export function speakDepartures(
  departures: readonly StopDeparture[],
  place: VoicePlace,
  route?: string,
  direction?: TravelDirection | null
): string {
  const what = route ? `the ${speakRoute(route)}` : "a bus";
  const where = direction ? ` ${speakDirection(direction)}` : "";

  if (!departures.length) {
    return `I can't find ${what} leaving ${place.label}${where} in the next two hours.`;
  }

  const [first, ...rest] = departures;
  const liveNote = first.live ? ", using live times" : "";
  const head = route
    ? `The next ${speakRoute(first.route)} from ${place.label} leaves ${speakMinutes(
        first.leaveInMinutes
      )}, at ${speakClock(first.departAt)}${liveNote}, heading to ${first.heading}.`
    : `The next bus from ${place.label} is the ${speakRoute(
        first.route
      )} ${speakMinutes(first.leaveInMinutes)}, at ${speakClock(
        first.departAt
      )}${liveNote}, heading to ${first.heading}.`;

  if (!rest.length) return head;

  const follow = rest
    .slice(0, 2)
    .map((d) =>
      route
        ? `${speakClock(d.departAt)}`
        : `the ${speakRoute(d.route)} at ${speakClock(d.departAt)}`
    );

  const tail =
    follow.length === 1
      ? `Then ${follow[0]}.`
      : `Then ${follow[0]}, and ${follow[1]}.`;

  return `${head} ${tail}`;
}

export function speakOption(
  option: BusOption,
  prefix: string,
  destinationLabel: string
): string {
  const board = `Take the ${speakRoute(option.route)} from ${
    option.boardStopLabel
  }, leaving ${speakMinutes(option.leaveInMinutes)} at ${speakClock(
    option.departAt
  )}`;

  const walk = option.walkMinutes
    ? ` — that's a ${option.walkMinutes} minute walk to the stop`
    : "";

  if (option.chained && option.connectorRoute && option.connectorDepartAt) {
    return (
      `${prefix} ${board}${walk}. Get off at ${option.changeStopLabel} at ${speakClock(
        option.changeArriveAt ?? option.departAt
      )}, ${option.changeHint ?? "then change"}, and take the ${speakRoute(
        option.connectorRoute
      )} at ${speakClock(option.connectorDepartAt)}. ` +
      `You reach ${option.arriveLabel ?? destinationLabel} around ${speakClock(
        option.arriveAt
      )}, ${option.durationMinutes} minutes door to door.`
    );
  }

  if (option.walkFromNewUnion) {
    return `${prefix} ${board}${walk}, then walk the last ${NEW_UNION_TO_CITY_VILLAGE_WALK_MIN} minutes from ${
      option.changeStopLabel ?? "New Union Street"
    }. You get to ${option.arriveLabel ?? destinationLabel} around ${speakClock(
      option.arriveAt
    )}, ${option.durationMinutes} minutes door to door.`;
  }

  return `${prefix} ${board}${walk}. It gets to ${
    option.arriveLabel ?? destinationLabel
  } around ${speakClock(option.arriveAt)}, ${option.durationMinutes} minutes in total.`;
}

export function listPlacesForSpeech(): string {
  const names = VOICE_PLACES.map((p) => p.label);
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}
