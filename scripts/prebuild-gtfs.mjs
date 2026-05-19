/**
 * Bundle GTFS timetable data into data/ at build time.
 * Vercel serverless has no persistent cache — without this, every cold start
 * re-downloads the full TfWM zip and often times out.
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
const outSubset = join(dataDir, "gtfs-subset.json");
const outCalendar = join(dataDir, "calendar.json");

function copyFromCache(cacheDir) {
  const subset = join(cacheDir, "gtfs-subset.json");
  const calendar = join(cacheDir, "calendar.json");
  if (!existsSync(subset) || !existsSync(calendar)) {
    throw new Error(`Missing cache files in ${cacheDir}`);
  }
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(outSubset, readFileSync(subset));
  writeFileSync(outCalendar, readFileSync(calendar));
  const edges = JSON.parse(readFileSync(outSubset, "utf-8")).edges?.length ?? 0;
  console.log(`Bundled GTFS data (${edges} edges) → data/`);
}

async function main() {
  const hasCreds =
    process.env.TFWM_APP_ID?.trim() && process.env.TFWM_APP_KEY?.trim();

  if (hasCreds) {
    console.log("Downloading GTFS from TfWM for production bundle…");
    const { loadGtfsSubset } = await import("../lib/gtfs.ts");
    await loadGtfsSubset(true);

    const cacheDir = process.env.VERCEL
      ? join("/tmp", "busapp-cache")
      : join(root, ".cache");
    copyFromCache(cacheDir);
    return;
  }

  const localCache = join(root, ".cache");
  if (existsSync(join(localCache, "gtfs-subset.json"))) {
    console.log("Using local .cache for production bundle (no TfWM creds in build env)");
    copyFromCache(localCache);
    return;
  }

  console.warn(
    "\n⚠️  GTFS prebuild skipped: no TFWM_APP_ID / TFWM_APP_KEY during build.\n" +
      "   Timetables will NOT work on Vercel until you:\n" +
      "   1. Add TFWM_APP_ID and TFWM_APP_KEY in Vercel → Settings → Environment Variables\n" +
      "   2. Redeploy (build must download GTFS once)\n" +
      "   Or run `npm run rebuild-cache` locally and redeploy.\n"
  );
}

main().catch((err) => {
  console.error("GTFS prebuild failed:", err);
  process.exit(1);
});
