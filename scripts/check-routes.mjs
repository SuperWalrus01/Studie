/**
 * Diagnostic: which routes/edges exist for the City Village ↔ Warwick corridor.
 * Run: npx tsx --env-file=.env.local scripts/check-routes.mjs
 */
import { loadGtfsSubset } from "../lib/gtfs.ts";
import { STOPS, ST_JOHNS_STOP_IDS } from "../lib/stops.ts";

const s = await loadGtfsSubset();
const conn = ["17", "17A", "21", "21A", "21S"];

for (const origin of [
  STOPS.warwickUW1,
  STOPS.warwickUW4,
  STOPS.warwickScarmanGH3,
  STOPS.warwickScarmanGH4,
]) {
  const byRoute = new Map();
  for (const e of s.edges) {
    if (e.originStopId !== origin) continue;
    if (!byRoute.has(e.routeShortName)) byRoute.set(e.routeShortName, new Set());
    byRoute.get(e.routeShortName).add(e.destStopId);
  }
  console.log(
    "from", origin, ":",
    [...byRoute.entries()].map(([r, d]) => `${r}(${d.size} dests)`).join(" ")
  );
}

const toNewUnion = s.edges.filter(
  (e) =>
    ["11", "12X"].includes(e.routeShortName) &&
    [STOPS.newUnionBY2, STOPS.newUnionBY4].includes(e.destStopId) &&
    [STOPS.warwickScarmanGH3, STOPS.warwickScarmanGH4, STOPS.warwickUW1].includes(e.originStopId)
);
console.log("\n11/12X Warwick -> New Union edges:", toNewUnion.length);

for (const o of [STOPS.newUnionBY1, STOPS.newUnionBY5]) {
  const edges = s.edges.filter(
    (e) =>
      e.originStopId === o &&
      conn.includes(e.routeShortName) &&
      ST_JOHNS_STOP_IDS.includes(e.destStopId)
  );
  console.log(
    o, "17/21 -> St Johns edges:", edges.length,
    "routes:", [...new Set(edges.map((e) => e.routeShortName))].join(",")
  );
}
