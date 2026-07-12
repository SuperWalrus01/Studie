/** NaPTAN/ATCO stop IDs and route filters — plain ESM for Node build scripts + TypeScript re-exports */

export const STOPS = {
  stJohnsCS1: "43000003201",
  stJohnsCS2: "43000003202",
  stJohnsCS3: "43000003203",
  stJohnsCS4: "43000003206",
  newUnionBY1: "43000002101",
  newUnionBY2: "43000002102",
  newUnionBY3: "43000002105",
  newUnionBY4: "43000002103",
  newUnionBY5: "43000002104",
  poolMeadow12X: "43000005020",
  poolMeadow11: "43000005010",
  warwickUW1: "43000065301",
  warwickUW2: "43000065302",
  warwickUW3: "43000065303",
  warwickUW4: "43000065304",
  warwickScarmanGH3: "43001317101",
  warwickScarmanGH4: "43001317102",
  poolMeadow87: "43000005005",
};

/** @type {readonly ["11", "12X", "14", "14A", "87"]} */
export const ROUTE_NAMES = ["11", "12X", "14", "14A", "87"];

/** @type {readonly ["17", "17A", "21", "21A", "21S"]} */
export const CITY_CONNECTOR_ROUTES = ["17", "17A", "21", "21A", "21S"];

export const ALL_STOP_IDS = Object.values(STOPS);
