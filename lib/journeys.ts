import {
  CITY_CONNECTOR_ROUTES,
  LYNCHGATE_STOP_IDS,
  ST_JOHNS_STOP_IDS,
  STOPS,
} from "./stops";

export type TripDestination = {
  stopId: string;
  /** Treat arrivals at any of these stops as the destination */
  alsoStopIds?: readonly string[];
  altByRoute?: Record<string, string>;
};

export type TripId = "toWarwick" | "toLynchgate" | "goingHome";

export type OriginKey = "cityVillage" | "newUnion" | "warwick" | "lynchgate";
export type DestinationKey = "cityVillage" | "newUnion";

export interface BoardingStop {
  stopId: string;
  routes: string[];
  label: string;
  walkMinutes?: number;
}

export interface TripConfig {
  id: TripId;
  title: string;
  origins?: Partial<Record<OriginKey, BoardingStop[]>>;
  destinations?: Partial<Record<DestinationKey, BoardingStop[]>>;
  destination?: TripDestination | Partial<Record<DestinationKey, TripDestination>>;
}

export const TRIPS: Record<TripId, TripConfig> = {
  toWarwick: {
    id: "toWarwick",
    title: "To Warwick",
    origins: {
      cityVillage: [
        {
          stopId: STOPS.stJohnsCS2,
          routes: ["11"],
          label: "St Johns Church",
        },
        {
          stopId: STOPS.stJohnsCS1,
          routes: ["14", "14A"],
          label: "St Johns Church",
        },
        {
          stopId: STOPS.stJohnsCS3,
          routes: ["87"],
          label: "St Johns Church",
        },
        {
          stopId: STOPS.poolMeadow87,
          routes: ["87"],
          label: "Pool Meadow",
          walkMinutes: 12,
        },
        {
          stopId: STOPS.newUnionBY4,
          routes: ["12X"],
          label: "New Union St",
          walkMinutes: 10,
        },
        {
          stopId: STOPS.poolMeadow12X,
          routes: ["12X"],
          label: "Pool Meadow",
          walkMinutes: 12,
        },
      ],
      newUnion: [
        {
          stopId: STOPS.newUnionBY2,
          routes: ["11"],
          label: "New Union St",
        },
        {
          stopId: STOPS.newUnionBY4,
          routes: ["12X"],
          label: "New Union St",
        },
      ],
    },
    destination: {
      stopId: STOPS.warwickScarmanGH3,
      altByRoute: {
        "12X": STOPS.warwickUW3,
        "14": STOPS.warwickUW1,
        "14A": STOPS.warwickUW1,
      },
    },
  },
  toLynchgate: {
    id: "toLynchgate",
    title: "To Lynchgate",
    origins: {
      cityVillage: [
        {
          stopId: STOPS.stJohnsCS2,
          routes: ["11"],
          label: "St Johns Church",
        },
        {
          stopId: STOPS.stJohnsCS1,
          routes: ["14", "14A"],
          label: "St Johns Church",
        },
        {
          stopId: STOPS.stJohnsCS3,
          routes: ["87"],
          label: "St Johns Church",
        },
      ],
    },
    destination: {
      stopId: STOPS.lynchgateBefore,
      alsoStopIds: LYNCHGATE_STOP_IDS,
    },
  },
  goingHome: {
    id: "goingHome",
    title: "Going home",
    origins: {
      warwick: [
        {
          stopId: STOPS.warwickScarmanGH4,
          routes: ["11"],
          label: "Warwick Uni",
        },
        {
          stopId: STOPS.warwickUW1,
          routes: ["14", "14A"],
          label: "Warwick Uni",
        },
        {
          stopId: STOPS.warwickScarmanGH3,
          routes: ["12X"],
          label: "Warwick Uni (12X · Scarman Rd)",
        },
        {
          stopId: STOPS.warwickUW4,
          routes: ["87"],
          label: "Warwick Uni",
        },
        {
          stopId: STOPS.warwickScarmanGH4,
          routes: ["87"],
          label: "Warwick Uni",
        },
      ],
      lynchgate: [
        {
          stopId: STOPS.lynchgateBefore,
          routes: ["11", "87"],
          label: "Lynchgate Rd",
        },
        {
          stopId: STOPS.lynchgateAfter,
          routes: ["11", "87"],
          label: "Lynchgate Rd",
        },
      ],
    },
    destinations: {
      cityVillage: [
        /** 11 / 12X alight New Union; cross street for 17/21 to St Johns */
        {
          stopId: STOPS.newUnionBY2,
          routes: ["11", "12X"],
          label: "New Union St",
        },
        {
          stopId: STOPS.newUnionBY4,
          routes: ["12X"],
          label: "New Union St",
        },
        {
          stopId: STOPS.stJohnsCS1,
          routes: ["14", "14A"],
          label: "St Johns Church",
        },
        {
          stopId: STOPS.stJohnsCS3,
          routes: ["87"],
          label: "St Johns Church",
        },
      ],
      newUnion: [
        {
          stopId: STOPS.newUnionBY2,
          routes: ["11"],
          label: "New Union St",
        },
        {
          stopId: STOPS.newUnionBY4,
          routes: ["12X"],
          label: "New Union St",
        },
      ],
    },
  },
};

export function getTrip(id: string): TripConfig | undefined {
  return TRIPS[id as TripId];
}

export const TRIP_LIST: TripId[] = ["toWarwick", "toLynchgate", "goingHome"];

/** Opposite side of New Union St after crossing from route 11 / 12X (BY2/BY4) */
export const NEW_UNION_TO_ST_JOHNS_BOARDS: BoardingStop[] = [
  {
    stopId: STOPS.newUnionBY1,
    routes: [...CITY_CONNECTOR_ROUTES],
    label: "New Union St (opposite side)",
    walkMinutes: 2,
  },
  {
    stopId: STOPS.newUnionBY5,
    routes: [...CITY_CONNECTOR_ROUTES],
    label: "New Union St (opposite side)",
    walkMinutes: 2,
  },
];

/** Routes that end at New Union; need connector to reach St Johns / City Village */
export const NEW_UNION_TRANSFER_ROUTES = ["11", "12X"] as const;
