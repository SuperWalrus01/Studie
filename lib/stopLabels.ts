import { STOP_COORDS } from "./stopCoords";
import { STOPS } from "./stops";

const EXTRA_LABELS: Record<string, string> = {
  [STOPS.stJohnsCS1]: "St Johns Church",
  [STOPS.stJohnsCS4]: "St Johns Church",
  [STOPS.newUnionBY2]: "New Union St",
  [STOPS.newUnionBY3]: "New Union St",
  [STOPS.newUnionBY4]: "New Union St",
  [STOPS.newUnionBY5]: "New Union St",
  [STOPS.poolMeadow12X]: "Pool Meadow",
  [STOPS.poolMeadow87]: "Pool Meadow",
  [STOPS.lynchgateAfter]: "Lynchgate Rd",
  [STOPS.warwickUW2]: "Warwick Uni",
  [STOPS.warwickUW3]: "Warwick Uni",
  [STOPS.warwickUW4]: "Warwick Uni",
  [STOPS.warwickScarmanGH4]: "Scarman Rd",
};

const LABELS: Record<string, string> = { ...EXTRA_LABELS };
for (const stop of STOP_COORDS) {
  LABELS[stop.id] = stop.label;
}

export function getStopLabel(stopId: string): string {
  return LABELS[stopId] ?? "destination";
}
