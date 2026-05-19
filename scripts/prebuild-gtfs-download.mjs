/**
 * Download GTFS and write to data/ — run via tsx (resolves lib/*.ts imports).
 * Called from prebuild-gtfs.mjs when bundled data is missing.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";

const root = process.cwd();
const dataDir = join(root, "data");

const { loadGtfsSubset } = await import("../lib/gtfs.ts");

console.log("Downloading GTFS from TfWM…");
const subset = await loadGtfsSubset(true);

const cacheDir = process.env.VERCEL
  ? join("/tmp", "busapp-cache")
  : join(root, ".cache");

const subsetPath = join(cacheDir, "gtfs-subset.json");
const calendarPath = join(cacheDir, "calendar.json");

if (!existsSync(subsetPath) || !existsSync(calendarPath)) {
  throw new Error(`GTFS cache not found in ${cacheDir} after download`);
}

mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, "gtfs-subset.json"), readFileSync(subsetPath));
writeFileSync(join(dataDir, "calendar.json"), readFileSync(calendarPath));

console.log(`Bundled ${subset.edges.length} GTFS edges → data/`);
