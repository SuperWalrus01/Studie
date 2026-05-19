import { loadGtfsSubset } from "../lib/gtfs.ts";
import { STOPS } from "../lib/stops.ts";

const s = await loadGtfsSubset();
const lg = [STOPS.lynchgateBefore, STOPS.lynchgateAfter];

const conn = ["17", "21", "17A", "21A", "21S"];
const lgFrom17 = s.edges.filter(
  (e) => conn.includes(e.routeShortName) && lg.includes(e.destStopId)
);
console.log("17/21 -> Lynchgate edges:", lgFrom17.length);
if (lgFrom17.length)
  console.log("origins:", [...new Set(lgFrom17.map((e) => e.originStopId))]);

for (const o of [STOPS.stJohnsCS1, STOPS.stJohnsCS2, STOPS.newUnionBY1]) {
  const n = s.edges.filter(
    (e) => e.originStopId === o && conn.includes(e.routeShortName) && lg.includes(e.destStopId)
  ).length;
  console.log(o, "-> lynchgate on 17/21:", n);
}

for (const origin of [
  STOPS.warwickUW3,
  STOPS.warwickUW4,
  STOPS.warwickScarmanGH4,
  STOPS.warwickScarmanGH3,
]) {
  const dests = [
    ...new Set(
      s.edges
        .filter((e) => e.originStopId === origin && e.routeShortName === "12X")
        .map((e) => e.destStopId)
    ),
  ].sort();
  console.log("12X from", origin, "->", dests);
}

const toLg11 = s.edges.filter(
  (e) =>
    e.routeShortName === "11" &&
    lg.includes(e.destStopId) &&
    [STOPS.stJohnsCS2, STOPS.newUnionBY1].includes(e.originStopId)
);
console.log("11 to Lynchgate from st johns/new union:", toLg11.length);

const gh3city = s.edges.filter(
  (e) =>
    e.originStopId === STOPS.warwickScarmanGH3 &&
    ["11", "12X"].includes(e.routeShortName) &&
    [STOPS.newUnionBY2, STOPS.newUnionBY4].includes(e.destStopId)
);
console.log("11/12X GH3 -> new union:", gh3city.length, [...new Set(gh3city.map(e=>e.routeShortName))]);
const gh3all = [...new Set(s.edges.filter(e=>e.originStopId===STOPS.warwickScarmanGH3 && e.routeShortName==='12X').map(e=>e.destStopId))];
console.log("12X GH3 all dests in subset:", gh3all);

for (const o of [STOPS.stJohnsCS1, STOPS.stJohnsCS2, STOPS.stJohnsCS3]) {
  const hasLg = s.edges.some(
    (e) => e.originStopId === o && conn.includes(e.routeShortName) && lg.includes(e.destStopId)
  );
  const destCount = new Set(
    s.edges.filter((e) => e.originStopId === o && conn.includes(e.routeShortName)).map((e) => e.destStopId)
  ).size;
  console.log(o, "17/21 dests:", destCount, "lynchgate:", hasLg);
}

for (const o of [STOPS.newUnionBY1, STOPS.newUnionBY5]) {
  const dests = [
    ...new Set(
      s.edges
        .filter((e) => e.originStopId === o && conn.includes(e.routeShortName))
        .map((e) => e.destStopId)
    ),
  ];
  console.log(o, "17/21 dests count:", dests.length, dests.filter((d) => lg.includes(d)).length, "lynchgate");
}
