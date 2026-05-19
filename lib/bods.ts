import {
  CITY_CONNECTOR_ROUTES,
  ROUTE_NAMES,
} from "./stops";

const BODS_DATAFEED =
  "https://data.bus-data.dft.gov.uk/api/v1/datafeed/";

/** Coventry + Warwick corridor */
const BOUNDING_BOX = "-1.58,52.36,-1.42,52.46";

const TRACKED_ROUTES = new Set<string>([
  ...ROUTE_NAMES,
  ...CITY_CONNECTOR_ROUTES,
]);

const CACHE_TTL_MS = 10_000;

let vehicleCache: {
  fetchedAt: number;
  vehicles: LiveVehicle[];
} | null = null;

export interface LiveVehicle {
  id: string;
  route: string;
  lat: number;
  lon: number;
  bearing?: number;
  recordedAt?: string;
  destination?: string;
  origin?: string;
  direction?: string;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function getBodsApiKey(): string | null {
  const key = process.env.BODS_API_KEY?.trim();
  return key || null;
}

function parseVehicleActivities(xml: string): LiveVehicle[] {
  const vehicles: LiveVehicle[] = [];
  const blockRe = /<VehicleActivity>([\s\S]*?)<\/VehicleActivity>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(xml)) !== null) {
    const block = match[1];
    const line = block.match(/<LineRef>([^<]+)/)?.[1]?.trim();
    const lat = block.match(/<Latitude>([^<]+)/)?.[1];
    const lon = block.match(/<Longitude>([^<]+)/)?.[1];
    if (!line || !lat || !lon) continue;
    if (!TRACKED_ROUTES.has(line)) continue;

    const vehicleRef =
      block.match(/<VehicleRef>([^<]+)/)?.[1]?.trim() ??
      block.match(/<VehicleMonitoringRef>([^<]+)/)?.[1]?.trim() ??
      `${line}-${lat}-${lon}`;

    const bearingRaw = block.match(/<Bearing>([^<]+)/)?.[1];
    const recordedAt =
      block.match(/<RecordedAtTime>([^<]+)/)?.[1]?.trim() ??
      block.match(/<ValidUntilTime>([^<]+)/)?.[1]?.trim();

    const destination = block.match(/<DestinationName>([^<]+)/)?.[1];
    const origin = block.match(/<OriginName>([^<]+)/)?.[1];
    const direction = block.match(/<DirectionRef>([^<]+)/)?.[1];

    vehicles.push({
      id: vehicleRef,
      route: line,
      lat: Number(lat),
      lon: Number(lon),
      bearing: bearingRaw ? Number(bearingRaw) : undefined,
      recordedAt,
      destination: destination ? decodeXmlText(destination) : undefined,
      origin: origin ? decodeXmlText(origin) : undefined,
      direction: direction?.trim(),
    });
  }

  return vehicles;
}

export async function fetchLiveVehicles(
  routeFilter?: string[]
): Promise<LiveVehicle[]> {
  const apiKey = getBodsApiKey();
  if (!apiKey) return [];

  const allowed =
    routeFilter?.length ? new Set(routeFilter) : null;

  if (
    vehicleCache &&
    Date.now() - vehicleCache.fetchedAt < CACHE_TTL_MS
  ) {
    return filterByRoutes(vehicleCache.vehicles, allowed);
  }

  const url = new URL(BODS_DATAFEED);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("boundingBox", BOUNDING_BOX);

  const res = await fetch(url.toString(), {
    next: { revalidate: 10 },
  });

  if (!res.ok) {
    console.error("BODS datafeed failed:", res.status);
    return vehicleCache ? filterByRoutes(vehicleCache.vehicles, allowed) : [];
  }

  const xml = await res.text();
  const vehicles = parseVehicleActivities(xml);
  vehicleCache = { fetchedAt: Date.now(), vehicles };
  return filterByRoutes(vehicles, allowed);
}

function filterByRoutes(
  vehicles: LiveVehicle[],
  allowed: Set<string> | null
): LiveVehicle[] {
  if (!allowed) return vehicles;
  return vehicles.filter((v) => allowed.has(v.route));
}
