/**
 * Run: node --env-file=.env.local scripts/verify-stops.mjs
 * Verifies configured journey stop pairs exist in GTFS subset.
 */
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const STOPS = {
  stJohnsCS1: "43000003201",
  stJohnsCS2: "43000003202",
  stJohnsCS3: "43000003203",
  stJohnsCS4: "43000003206",
  newUnionBY2: "43000002102",
  newUnionBY4: "43000002103",
  newUnionBY5: "43000002104",
  poolMeadow12X: "43000005020",
  railStationOut: "43000008201",
  warwickUW1: "43000065301",
  warwickUW3: "43000065303",
  warwickScarmanGH3: "43001317101",
  warwickScarmanGH4: "43001317102",
};

const ST_JOHNS = [STOPS.stJohnsCS1, STOPS.stJohnsCS2, STOPS.stJohnsCS3, STOPS.stJohnsCS4];
const CONNECTORS = ["17", "17A", "21", "21A", "21S"];

/** [trip, label, origin, dests[], routes[]] — mirrors lib/journeys.ts config */
const PAIRS = [
  ["toWarwick", "CS2→GH3 (11)", STOPS.stJohnsCS2, [STOPS.warwickScarmanGH3], ["11"]],
  ["toWarwick", "CS1→UW1 (14)", STOPS.stJohnsCS1, [STOPS.warwickUW1], ["14", "14A"]],
  ["toWarwick", "CS3→GH3 (87)", STOPS.stJohnsCS3, [STOPS.warwickScarmanGH3], ["87"]],
  ["toWarwick", "BY4→UW3 (12X)", STOPS.newUnionBY4, [STOPS.warwickUW3], ["12X"]],
  ["toWarwick", "Pool→UW3 (12X)", STOPS.poolMeadow12X, [STOPS.warwickUW3], ["12X"]],
  ["viaStation", "CS2→Station (9/9B/11)", STOPS.stJohnsCS2, [STOPS.railStationOut], ["9", "9B", "11"]],
  ["viaStation", "CS3→Station (87)", STOPS.stJohnsCS3, [STOPS.railStationOut], ["87"]],
  ["viaStation", "Station→UW3 (12X)", STOPS.railStationOut, [STOPS.warwickUW3], ["12X"]],
  ["goingHome", "UW1→BY2 (11)", STOPS.warwickUW1, [STOPS.newUnionBY2], ["11"]],
  ["goingHome", "GH4→BY2 (11)", STOPS.warwickScarmanGH4, [STOPS.newUnionBY2], ["11"]],
  ["goingHome", "UW1→CS4 (14)", STOPS.warwickUW1, [STOPS.stJohnsCS4], ["14", "14A"]],
  ["goingHome", "GH3→BY2 (12X)", STOPS.warwickScarmanGH3, [STOPS.newUnionBY2], ["12X"]],
  ["connector", "BY5→St Johns (17/21)", STOPS.newUnionBY5, ST_JOHNS, CONNECTORS],
];

async function main() {
  const cacheFile = path.join(root, ".cache", "gtfs-subset.json");
  let subset;
  try {
    subset = JSON.parse(await readFile(cacheFile, "utf-8"));
  } catch {
    console.error(
      "No GTFS cache. Run the app once with TFWM_APP_ID/KEY set to download data."
    );
    process.exit(1);
  }

  console.log(`GTFS built: ${subset.builtAt}`);
  console.log(`Edges: ${subset.edges.length}\n`);

  let ok = 0;
  let fail = 0;

  for (const [trip, label, origin, dests, routes] of PAIRS) {
    const count = subset.edges.filter(
      (e) =>
        e.originStopId === origin &&
        dests.includes(e.destStopId) &&
        routes.some((r) => r.toUpperCase() === e.routeShortName.toUpperCase())
    ).length;

    if (count > 0) {
      console.log(`✓ ${trip} ${label}: ${count} trips`);
      ok++;
    } else {
      console.log(`✗ ${trip} ${label}: NO TRIPS`);
      fail++;
    }
  }

  console.log(`\n${ok} ok, ${fail} missing`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
