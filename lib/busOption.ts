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
  /** Main leg ends at New Union; use connector section for St Johns */
  viaNewUnion?: boolean;
  /** Combined 11/12X + 17/21 when going home to City Village */
  chained?: boolean;
}

export function pickFastest(options: BusOption[]): BusOption | null {
  const fastest = options.filter((o) => o.fastest);
  return fastest[0] ?? options[0] ?? null;
}
