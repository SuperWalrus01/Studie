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
  /** Combined 11/12X + 17/21 when going home to City Village */
  chained?: boolean;
  /** First leg arrival at New Union St (chained or walk options) */
  changeArriveAt?: string;
  /** Second-leg 17/21 route for chained options */
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
