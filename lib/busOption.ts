export interface BusOption {
  route: string;
  boardStopLabel: string;
  walkMinutes?: number;
  departAt: string;
  arriveAt: string;
  /** Where you get off (e.g. New Union vs St Johns) */
  arriveLabel?: string;
  leaveInMinutes: number;
  durationMinutes: number;
  fastest: boolean;
  live: boolean;
  /** Two-leg trip: bus + connecting bus (New Union 17/21 or rail station 12X) */
  chained?: boolean;
  /** First leg arrival time at the change stop (chained or walk options) */
  changeArriveAt?: string;
  /** Where the change happens, e.g. "New Union St" or "Rail Station Bridge" */
  changeStopLabel?: string;
  /** How to make the change, e.g. "cross the street" or "same stop" */
  changeHint?: string;
  /** Second-leg route for chained options */
  connectorRoute?: string;
  connectorDepartAt?: string;
  /** Minutes between first-leg arrival and connector departure */
  transferWaitMinutes?: number;
  /** Arrival time includes walking home from New Union St */
  walkFromNewUnion?: boolean;
}

export function pickFastest(options: BusOption[]): BusOption | null {
  const fastest = options.filter((o) => o.fastest);
  return fastest[0] ?? options[0] ?? null;
}
