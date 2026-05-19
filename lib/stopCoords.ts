import { STOPS } from "./stops";

export interface StopCoord {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

/** Approximate NaPTAN stop coordinates (Coventry corridor) */
export const STOP_COORDS: StopCoord[] = [
  { id: STOPS.stJohnsCS2, label: "St Johns Church", lat: 52.4068, lon: -1.5076 },
  /** BY2 — main boarding side for 11 / 12X (BY1 is opposite side for 17/21) */
  { id: STOPS.newUnionBY2, label: "New Union St", lat: 52.4061, lon: -1.5108 },
  { id: STOPS.poolMeadow11, label: "Pool Meadow", lat: 52.4074, lon: -1.5089 },
  { id: STOPS.lynchgateBefore, label: "Lynchgate Rd", lat: 52.3816, lon: -1.5282 },
  { id: STOPS.warwickUW1, label: "Warwick Uni", lat: 52.3793, lon: -1.5615 },
  { id: STOPS.warwickScarmanGH3, label: "Scarman Rd", lat: 52.3788, lon: -1.5598 },
];

export const MAP_CENTER = { lat: 52.393, lon: -1.52 };
export const MAP_ZOOM = 13;
