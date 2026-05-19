import { pickFastest, type BusOption } from "./busOption";
import { getOptionsForTrip } from "./compare";
import { getTrip } from "./journeys";

export interface FastestPick {
  label: string;
  option: BusOption;
  tripId: string;
}

const SCENARIOS: {
  tripId: string;
  origin: string;
  destination?: string;
  label: string;
}[] = [
  { tripId: "toWarwick", origin: "cityVillage", label: "To Warwick · City Village" },
  { tripId: "toWarwick", origin: "newUnion", label: "To Warwick · New Union St" },
  { tripId: "toLynchgate", origin: "cityVillage", label: "To Lynchgate · City Village" },
  {
    tripId: "goingHome",
    origin: "warwick",
    destination: "cityVillage",
    label: "Home · Warwick → City Village",
  },
  {
    tripId: "goingHome",
    origin: "warwick",
    destination: "newUnion",
    label: "Home · Warwick → New Union St",
  },
  {
    tripId: "goingHome",
    origin: "lynchgate",
    destination: "cityVillage",
    label: "Home · Lynchgate → City Village",
  },
];

function parseArriveMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export async function getFastestNow(): Promise<FastestPick | null> {
  const candidates: FastestPick[] = [];

  for (const scenario of SCENARIOS) {
    const trip = getTrip(scenario.tripId);
    if (!trip) continue;

    const { options, connectorOptions } = await getOptionsForTrip(
      trip,
      scenario.origin,
      scenario.destination
    );

    const main = pickFastest(options);
    if (main) {
      candidates.push({
        label: scenario.label,
        option: main,
        tripId: scenario.tripId,
      });
    }

    if (connectorOptions?.length && scenario.destination === "newUnion") {
      const conn = pickFastest(connectorOptions);
      if (conn) {
        candidates.push({
          label: `${scenario.label} → St Johns (from New Union)`,
          option: conn,
          tripId: scenario.tripId,
        });
      }
    }
  }

  if (!candidates.length) return null;

  candidates.sort(
    (a, b) =>
      parseArriveMinutes(a.option.arriveAt) -
      parseArriveMinutes(b.option.arriveAt)
  );

  return candidates[0];
}
