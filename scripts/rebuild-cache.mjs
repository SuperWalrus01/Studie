async function main() {
  const { loadGtfsSubset } = await import("../lib/gtfs.ts");
  const { getNewUnionToStJohnsOptions } = await import("../lib/compare.ts");

  const subset = await loadGtfsSubset(true);
  console.log("edges:", subset.edges.length);

  const nu = ["43000002101", "43000002104"]; // BY1, BY5 — city-centre side
  const sj = ["43000003201", "43000003202", "43000003203", "43000003206"];
  const connector = subset.edges.filter(
    (e) => nu.includes(e.originStopId) && sj.includes(e.destStopId)
  );
  console.log("connector edges:", connector.length);
  console.log("routes:", [...new Set(connector.map((e) => e.routeShortName))].sort());

  const opts = await getNewUnionToStJohnsOptions();
  console.log("connector options:", opts.length);
  opts.slice(0, 5).forEach((o) =>
    console.log(`  ${o.route} leave ${o.leaveInMinutes}m arrive ${o.arriveAt}`)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
