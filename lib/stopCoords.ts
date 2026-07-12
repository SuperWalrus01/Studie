import { STOPS } from "./stops";

export interface StopCoord {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** Show in the map bottom stop picker (default true) */
  picker?: boolean;
}

/**
 * Map pins — NaPTAN coords from bustimes.org (Corporation St).
 * St Johns: church west of the street; CS1–CS3 bays along Corporation St.
 */
export const STOP_COORDS: StopCoord[] = [
  {
    id: STOPS.stJohnsCS2,
    label: "St Johns Church",
    lat: 52.40917,
    lon: -1.51472,
  },
  {
    id: STOPS.stJohnsCS1,
    label: "CS1",
    lat: 52.40914,
    lon: -1.51425,
    picker: false,
  },
  {
    id: STOPS.stJohnsCS2,
    label: "CS2",
    lat: 52.409042,
    lon: -1.514413,
    picker: false,
  },
  {
    id: STOPS.stJohnsCS3,
    label: "CS3",
    lat: 52.408935,
    lon: -1.514561,
    picker: false,
  },
  /** BY2 — main boarding side for 11 / 12X (BY1 is opposite side for 17/21) */
  { id: STOPS.newUnionBY2, label: "New Union St", lat: 52.4061, lon: -1.5108 },
  { id: STOPS.poolMeadow11, label: "Pool Meadow", lat: 52.4074, lon: -1.5089 },
  { id: STOPS.warwickUW1, label: "Warwick Uni", lat: 52.3793, lon: -1.5615 },
  { id: STOPS.warwickScarmanGH3, label: "Scarman Rd", lat: 52.3788, lon: -1.5598 },
];

/** Stops shown in the map bottom picker (excludes individual bays) */
export const MAP_PICKER_STOPS = STOP_COORDS.filter((s) => s.picker !== false);

/** Centre map on St Johns / city corridor */
export const MAP_CENTER = { lat: 52.4085, lon: -1.5145 };
export const MAP_ZOOM = 16;
