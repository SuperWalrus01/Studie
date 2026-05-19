import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import {
  ALL_STOP_IDS,
  CITY_CONNECTOR_ROUTES,
  ROUTE_NAMES,
} from "./stops.constants.mjs";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Vercel/Lambda only allow writes under /tmp */
function getCacheDir(): string {
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  ) {
    return path.join("/tmp", "busapp-cache");
  }
  return path.join(process.cwd(), ".cache");
}

function cachePath(name: string): string {
  return path.join(getCacheDir(), name);
}

async function ensureCacheDir(): Promise<string> {
  const dir = getCacheDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

const GTFS_URL = "http://api.tfwm.org.uk/gtfs/tfwm_gtfs.zip";

const ROUTE_SET = new Set<string>([...ROUTE_NAMES, ...CITY_CONNECTOR_ROUTES]);
const STOP_SET = new Set<string>(ALL_STOP_IDS);

/** route short name → GTFS agency_id */
const ROUTE_AGENCY: Record<string, string> = {
  "11": "OP4",
  "12X": "OP4",
  "14": "OP4",
  "14A": "OP4",
  "87": "OP17",
  "17": "OP4",
  "17A": "OP4",
  "21": "OP4",
  "21A": "OP4",
  "21S": "OP4",
};
const gtfsZipCachePath = () => cachePath("tfwm.zip");
const gtfsSubsetCachePath = () => cachePath("gtfs-subset.json");
const calendarCachePath = () => cachePath("calendar.json");

/** Shipped with the app from `npm run build` (see scripts/prebuild-gtfs.mjs) */
const bundledSubsetPath = () =>
  path.join(process.cwd(), "data", "gtfs-subset.json");
const bundledCalendarPath = () =>
  path.join(process.cwd(), "data", "calendar.json");

export interface TripEdge {
  tripId: string;
  routeShortName: string;
  serviceId: string;
  originStopId: string;
  destStopId: string;
  departureSec: number;
  arrivalSec: number;
}

export interface GtfsSubset {
  builtAt: string;
  edges: TripEdge[];
}

interface CalendarRow {
  serviceId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startDate: string;
  endDate: string;
}

interface CalendarDateRow {
  serviceId: string;
  date: string;
  exceptionType: number;
}

let memoryCache: GtfsSubset | null = null;
/** Reload from disk when .cache/gtfs-subset.json is replaced (e.g. after rebuild-cache) */
let memoryCacheMtimeMs: number | null = null;
let calendarRows: CalendarRow[] | null = null;
let calendarDateRows: CalendarDateRow[] | null = null;

export function getTfwmCredentials(): { appId: string; appKey: string } | null {
  const appId = process.env.TFWM_APP_ID?.trim();
  const appKey = process.env.TFWM_APP_KEY?.trim();
  if (!appId || !appKey) return null;
  return { appId, appKey };
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** GTFS time as seconds since midnight (supports times past 24:00) */
export function parseGtfsTime(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseInt(parts[2] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}

function readZipEntry(zip: AdmZip, name: string): string | null {
  const entry =
    zip.getEntry(name) ??
    zip
      .getEntries()
      .find((e) => e.entryName.endsWith(`/${name}`) || e.entryName === name);
  if (!entry) return null;
  return zip.readAsText(entry);
}

async function downloadGtfsZip(appId: string, appKey: string): Promise<AdmZip> {
  try {
    const zipPath = gtfsZipCachePath();
    const stat = await fs.stat(zipPath);
    if (Date.now() - stat.mtimeMs < CACHE_TTL_MS) {
      return new AdmZip(await fs.readFile(zipPath));
    }
  } catch {
    // download fresh
  }

  const url = `${GTFS_URL}?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 403) {
      throw new Error(
        "TfWM authentication failed. Check TFWM_APP_ID and TFWM_APP_KEY in .env.local, and confirm your app is subscribed to GTFS feeds at api-portal.tfwm.org.uk."
      );
    }
    throw new Error(
      `GTFS download failed: ${res.status} ${body || res.statusText}`
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await ensureCacheDir();
  await fs.writeFile(gtfsZipCachePath(), buf);
  return new AdmZip(buf);
}

function buildEdgesFromZip(zip: AdmZip): {
  edges: TripEdge[];
  calendars: CalendarRow[];
  calendarDates: CalendarDateRow[];
} {
  const routesTxt = readZipEntry(zip, "routes.txt");
  const tripsTxt = readZipEntry(zip, "trips.txt");
  const stopTimesTxt = readZipEntry(zip, "stop_times.txt");
  const calendarTxt = readZipEntry(zip, "calendar.txt");
  const calendarDatesTxt = readZipEntry(zip, "calendar_dates.txt");

  if (!routesTxt || !tripsTxt || !stopTimesTxt) {
    throw new Error("GTFS zip missing required files");
  }

  const routeIdToShort = new Map<string, string>();
  for (const row of parseCsv(routesTxt)) {
    const shortName = row.route_short_name?.trim();
    if (!shortName || !ROUTE_SET.has(shortName)) continue;
    if (ROUTE_AGENCY[shortName] !== row.agency_id) continue;
    routeIdToShort.set(row.route_id, shortName);
  }

  const tripMeta = new Map<
    string,
    { routeShortName: string; serviceId: string }
  >();
  for (const row of parseCsv(tripsTxt)) {
    const routeShort = routeIdToShort.get(row.route_id);
    if (!routeShort) continue;
    tripMeta.set(row.trip_id, {
      routeShortName: routeShort,
      serviceId: row.service_id,
    });
  }

  const tripStops = new Map<
    string,
    { stopId: string; departureSec: number; arrivalSec: number; sequence: number }[]
  >();

  for (const row of parseCsv(stopTimesTxt)) {
    const tripId = row.trip_id;
    if (!tripMeta.has(tripId)) continue;
    const stopId = row.stop_id;
    if (!STOP_SET.has(stopId)) continue;

    const departureSec = parseGtfsTime(row.departure_time || row.arrival_time);
    const arrivalSec = parseGtfsTime(row.arrival_time || row.departure_time);
    const sequence = parseInt(row.stop_sequence, 10);

    if (!tripStops.has(tripId)) tripStops.set(tripId, []);
    tripStops.get(tripId)!.push({
      stopId,
      departureSec,
      arrivalSec,
      sequence,
    });
  }

  const edges: TripEdge[] = [];

  for (const [tripId, stops] of tripStops) {
    const meta = tripMeta.get(tripId)!;
    stops.sort((a, b) => a.sequence - b.sequence);

    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const origin = stops[i];
        const dest = stops[j];
        edges.push({
          tripId,
          routeShortName: meta.routeShortName,
          serviceId: meta.serviceId,
          originStopId: origin.stopId,
          destStopId: dest.stopId,
          departureSec: origin.departureSec,
          arrivalSec: dest.arrivalSec,
        });
      }
    }
  }

  const calendars: CalendarRow[] = calendarTxt
    ? parseCsv(calendarTxt).map((row) => ({
        serviceId: row.service_id,
        monday: row.monday === "1",
        tuesday: row.tuesday === "1",
        wednesday: row.wednesday === "1",
        thursday: row.thursday === "1",
        friday: row.friday === "1",
        saturday: row.saturday === "1",
        sunday: row.sunday === "1",
        startDate: row.start_date,
        endDate: row.end_date,
      }))
    : [];

  const calendarDates: CalendarDateRow[] = calendarDatesTxt
    ? parseCsv(calendarDatesTxt).map((row) => ({
        serviceId: row.service_id,
        date: row.date,
        exceptionType: parseInt(row.exception_type, 10),
      }))
    : [];

  return { edges, calendars, calendarDates };
}

async function saveCalendarData(
  calendars: CalendarRow[],
  calendarDates: CalendarDateRow[]
) {
  await ensureCacheDir();
  await fs.writeFile(
    calendarCachePath(),
    JSON.stringify({ calendars, calendarDates })
  );
  calendarRows = calendars;
  calendarDateRows = calendarDates;
}

async function loadCalendarData() {
  if (calendarRows) return;
  for (const filePath of [calendarCachePath(), bundledCalendarPath()]) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw);
      calendarRows = data.calendars;
      calendarDateRows = data.calendarDates;
      return;
    } catch {
      // try next path
    }
  }
  calendarRows = [];
  calendarDateRows = [];
}

async function loadBundledSubset(): Promise<GtfsSubset | null> {
  try {
    const raw = await fs.readFile(bundledSubsetPath(), "utf-8");
    return JSON.parse(raw) as GtfsSubset;
  } catch {
    return null;
  }
}

function getLondonDateParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  const ymd = `${parts.year}${parts.month}${parts.day}`;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[parts.weekday] ?? now.getDay();
  const secondsSinceMidnight =
    parseInt(parts.hour, 10) * 3600 +
    parseInt(parts.minute, 10) * 60 +
    parseInt(parts.second, 10);
  return { ymd, dayOfWeek, secondsSinceMidnight };
}

export function serviceRunsToday(
  serviceId: string,
  calendars: CalendarRow[],
  calendarDates: CalendarDateRow[],
  now = new Date()
): boolean {
  const { ymd, dayOfWeek } = getLondonDateParts(now);

  const exceptions = calendarDates.filter(
    (c) => c.serviceId === serviceId && c.date === ymd
  );
  const removed = exceptions.some((e) => e.exceptionType === 2);
  if (removed) return false;
  const added = exceptions.some((e) => e.exceptionType === 1);
  if (added) return true;

  const cal = calendars.find((c) => c.serviceId === serviceId);
  if (!cal) return true;

  if (ymd < cal.startDate || ymd > cal.endDate) return false;

  const dayFlags = [
    cal.sunday,
    cal.monday,
    cal.tuesday,
    cal.wednesday,
    cal.thursday,
    cal.friday,
    cal.saturday,
  ];
  return dayFlags[dayOfWeek] ?? false;
}

export function getLondonNowSeconds(): number {
  return getLondonDateParts().secondsSinceMidnight;
}

async function buildAndCacheSubset(): Promise<GtfsSubset> {
  const creds = getTfwmCredentials();
  if (!creds) {
    throw new Error(
      "Missing TFWM_APP_ID or TFWM_APP_KEY in environment"
    );
  }

  const zip = await downloadGtfsZip(creds.appId, creds.appKey);
  const { edges, calendars, calendarDates } = buildEdgesFromZip(zip);

  const subset: GtfsSubset = {
    builtAt: new Date().toISOString(),
    edges,
  };

  await ensureCacheDir();
  const subsetPath = gtfsSubsetCachePath();
  await fs.writeFile(subsetPath, JSON.stringify(subset));
  await saveCalendarData(calendars, calendarDates);

  memoryCache = subset;
  try {
    const stat = await fs.stat(subsetPath);
    memoryCacheMtimeMs = stat.mtimeMs;
  } catch {
    memoryCacheMtimeMs = null;
  }
  return subset;
}

export async function loadGtfsSubset(forceRefresh = false): Promise<GtfsSubset> {
  if (!forceRefresh) {
    const bundled = await loadBundledSubset();
    if (bundled) {
      memoryCache = bundled;
      memoryCacheMtimeMs = null;
      await loadCalendarData();
      return bundled;
    }

    try {
      const subsetPath = gtfsSubsetCachePath();
      const stat = await fs.stat(subsetPath);
      const freshOnDisk = Date.now() - stat.mtimeMs < CACHE_TTL_MS;
      const memoryStale =
        !memoryCache ||
        memoryCacheMtimeMs == null ||
        memoryCacheMtimeMs !== stat.mtimeMs;

      if (freshOnDisk && !memoryStale && memoryCache) {
        return memoryCache;
      }

      if (freshOnDisk) {
        const raw = await fs.readFile(subsetPath, "utf-8");
        memoryCache = JSON.parse(raw) as GtfsSubset;
        memoryCacheMtimeMs = stat.mtimeMs;
        await loadCalendarData();
        return memoryCache;
      }
    } catch {
      // cache miss
    }
  }

  return buildAndCacheSubset();
}

export async function getActiveCalendars(): Promise<{
  calendars: CalendarRow[];
  calendarDates: CalendarDateRow[];
}> {
  await loadCalendarData();
  if (!calendarRows?.length) {
    await loadGtfsSubset();
  }
  return {
    calendars: calendarRows ?? [],
    calendarDates: calendarDateRows ?? [],
  };
}
