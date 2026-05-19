import { STOP_COORDS } from "./stopCoords";
import { STOPS } from "./stops";

/** Human-readable names for every NaPTAN stop we use in GTFS */
const STOP_ID_LABELS: Record<string, string> = {
  [STOPS.stJohnsCS1]: "St Johns Church",
  [STOPS.stJohnsCS2]: "St Johns Church",
  [STOPS.stJohnsCS3]: "St Johns Church",
  [STOPS.stJohnsCS4]: "St Johns Church",
  [STOPS.newUnionBY1]: "New Union St",
  [STOPS.newUnionBY2]: "New Union St",
  [STOPS.newUnionBY3]: "New Union St",
  [STOPS.newUnionBY4]: "New Union St",
  [STOPS.newUnionBY5]: "New Union St",
  [STOPS.poolMeadow11]: "Pool Meadow",
  [STOPS.poolMeadow12X]: "Pool Meadow",
  [STOPS.poolMeadow87]: "Pool Meadow",
  [STOPS.lynchgateBefore]: "Lynchgate Rd",
  [STOPS.lynchgateAfter]: "Lynchgate Rd",
  [STOPS.warwickUW1]: "Warwick Uni",
  [STOPS.warwickUW2]: "Warwick Uni",
  [STOPS.warwickUW3]: "Warwick Uni",
  [STOPS.warwickUW4]: "Warwick Uni",
  [STOPS.warwickScarmanGH3]: "Scarman Rd",
  [STOPS.warwickScarmanGH4]: "Scarman Rd",
};

const LABELS: Record<string, string> = { ...STOP_ID_LABELS };

/** Primary map pins only — do not overwrite with bay codes (CS1, Before, etc.) */
for (const stop of STOP_COORDS) {
  if (stop.picker !== false) {
    LABELS[stop.id] = stop.label;
  }
}

export function getStopLabel(stopId: string): string {
  return LABELS[stopId] ?? "Unknown stop";
}
