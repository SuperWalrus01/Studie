/**
 * Ensure data/gtfs-subset.json exists before next build.
 * Uses committed bundle when present; otherwise downloads via tsx.
 */
import { execSync } from "child_process";
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

function bundledDataReady() {
  if (!existsSync(outSubset) || !existsSync(outCalendar)) return false;
  try {
    const subset = JSON.parse(readFileSync(outSubset, "utf-8"));
    return Array.isArray(subset.edges) && subset.edges.length > 0;
  } catch {
    return false;
  }
}

function copyFromCache(cacheDir) {
  const subset = join(cacheDir, "gtfs-subset.json");
  const calendar = join(cacheDir, "calendar.json");
  if (!existsSync(subset) || !existsSync(calendar)) {
    throw new Error(`Missing cache in ${cacheDir}`);
  }
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(outSubset, readFileSync(subset));
  writeFileSync(outCalendar, readFileSync(calendar));
  const edges = JSON.parse(readFileSync(outSubset, "utf-8")).edges?.length ?? 0;
  console.log(`Bundled GTFS from ${cacheDir} (${edges} edges)`);
}

function main() {
  if (bundledDataReady()) {
    const edges =
      JSON.parse(readFileSync(outSubset, "utf-8")).edges?.length ?? 0;
    console.log(`Using committed GTFS bundle (${edges} edges)`);
    return;
  }

  const hasCreds =
    process.env.TFWM_APP_ID?.trim() && process.env.TFWM_APP_KEY?.trim();

  const localCache = join(root, ".cache");
  if (existsSync(join(localCache, "gtfs-subset.json"))) {
    console.log("Copying GTFS from .cache to data/");
    copyFromCache(localCache);
    return;
  }

  if (hasCreds) {
    console.log("Downloading GTFS via tsx…");
    execSync("npx tsx scripts/prebuild-gtfs-download.mjs", {
      stdio: "inherit",
      cwd: root,
      env: process.env,
    });
    return;
  }

  console.error(
    "\nGTFS bundle missing in data/ and no TFWM credentials at build time.\n" +
      "Either commit data/gtfs-subset.json or set TFWM_APP_ID + TFWM_APP_KEY on Vercel.\n"
  );
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error("GTFS prebuild failed:", err);
  process.exit(1);
}
