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
  newUnionBY2: "43000002102",
  poolMeadow12X: "43000005020",
  lynchgateBefore: "43000063602",
  lynchgateAfter: "43000063601",
  warwickUW1: "43000065301",
  warwickUW2: "43000065302",
  warwickUW3: "43000065303",
};

const PAIRS = [
  ["toWarwick", "CS2→UW1 (11)", STOPS.stJohnsCS2, STOPS.warwickUW1, ["11"]],
  ["toWarwick", "CS1→UW1 (14)", STOPS.stJohnsCS1, STOPS.warwickUW1, ["14", "14A"]],
  ["toWarwick", "BY4→UW3 (12X)", STOPS.newUnionBY4, STOPS.warwickUW3, ["12X"]],
  ["toWarwick", "Pool→UW3 (12X)", STOPS.poolMeadow12X, STOPS.warwickUW3, ["12X"]],
  ["toLynchgate", "CS2→Lynchgate (11)", STOPS.stJohnsCS2, STOPS.lynchgateBefore, ["11"]],
  ["toLynchgate", "CS1→Lynchgate (14)", STOPS.stJohnsCS1, STOPS.lynchgateBefore, ["14", "14A"]],
  ["goingHome", "UW1→CS2 (11)", STOPS.warwickUW1, STOPS.stJohnsCS2, ["11"]],
  ["goingHome", "UW1→CS1 (14)", STOPS.warwickUW1, STOPS.stJohnsCS1, ["14", "14A"]],
  ["goingHome", "UW1→BY2 (11)", STOPS.warwickUW1, STOPS.newUnionBY2, ["11"]],
  ["goingHome", "UW3→BY4 (12X)", STOPS.warwickUW3, STOPS.newUnionBY4, ["12X"]],
  ["goingHome", "Lynchgate→CS2 (11)", STOPS.lynchgateAfter, STOPS.stJohnsCS2, ["11"]],
  ["goingHome", "Lynchgate→BY2 (11)", STOPS.lynchgateAfter, STOPS.newUnionBY2, ["11"]],
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

  for (const [trip, label, origin, dest, routes] of PAIRS) {
    const count = subset.edges.filter(
      (e) =>
        e.originStopId === origin &&
        e.destStopId === dest &&
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
