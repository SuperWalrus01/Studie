import {
  ALL_STOP_IDS as ALL_STOP_IDS_LIST,
  CITY_CONNECTOR_ROUTES as CITY_CONNECTOR_ROUTES_LIST,
  ROUTE_NAMES as ROUTE_NAMES_LIST,
  STOPS as STOPS_MAP,
} from "./stops.constants.mjs";

/** NaPTAN/ATCO stop IDs for Coventry corridor */
export const STOPS = STOPS_MAP;

export const ROUTE_NAMES = ROUTE_NAMES_LIST;

/** City-centre routes: New Union (BY1/BY5) → St Johns Church */
export const CITY_CONNECTOR_ROUTES = CITY_CONNECTOR_ROUTES_LIST;

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

/** Rail Station Bridge — outbound (toward campus) and inbound (toward city) sides */
export const RAIL_STATION_STOP_IDS = [
  STOPS.railStationOut,
  STOPS.railStationIn,
] as const;

export type RouteName = (typeof ROUTE_NAMES)[number];

export const ALL_STOP_IDS = ALL_STOP_IDS_LIST;

/**
 * Stops at the same place use different NaPTAN bays.
 * Query all bays when showing a timetable for one pin.
 */
export const STOP_TIMETABLE_GROUPS: readonly (readonly string[])[] = [
  NEW_UNION_STOP_IDS,
  ST_JOHNS_STOP_IDS,
  RAIL_STATION_STOP_IDS,
];

export function getStopIdsForTimetable(stopId: string): string[] {
  for (const group of STOP_TIMETABLE_GROUPS) {
    if ((group as readonly string[]).includes(stopId)) return [...group];
  }
  return [stopId];
}
