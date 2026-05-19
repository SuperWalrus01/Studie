/** NaPTAN/ATCO stop IDs for Coventry corridor */
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
  lynchgateBefore: "43000063602",
  lynchgateAfter: "43000063601",
  warwickUW1: "43000065301",
  warwickUW2: "43000065302",
  warwickUW3: "43000065303",
  warwickUW4: "43000065304",
  warwickScarmanGH3: "43001317101",
  warwickScarmanGH4: "43001317102",
  poolMeadow87: "43000005005",
} as const;

export const ROUTE_NAMES = ["11", "12X", "14", "14A", "87"] as const;

/** City-centre routes: New Union (BY1/BY5) → St Johns Church */
export const CITY_CONNECTOR_ROUTES = [
  "17",
  "17A",
  "21",
  "21A",
  "21S",
] as const;

export const NEW_UNION_TO_ST_JOHNS_STOPS = [
  STOPS.newUnionBY1,
  STOPS.newUnionBY5,
] as const;

export const NEW_UNION_STOP_IDS = [
  STOPS.newUnionBY1,
  STOPS.newUnionBY2,
  STOPS.newUnionBY3,
  STOPS.newUnionBY4,
  STOPS.newUnionBY5,
] as const;

export const ST_JOHNS_STOP_IDS = [
  STOPS.stJohnsCS1,
  STOPS.stJohnsCS2,
  STOPS.stJohnsCS3,
  STOPS.stJohnsCS4,
] as const;

/** Both Lynchgate Rd stops on Kirby Corner Rd (before / after the junction) */
export const LYNCHGATE_STOP_IDS = [
  STOPS.lynchgateBefore,
  STOPS.lynchgateAfter,
] as const;
export type RouteName = (typeof ROUTE_NAMES)[number];

export const ALL_STOP_IDS = Object.values(STOPS);
