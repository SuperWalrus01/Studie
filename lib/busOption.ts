export interface BusOption {
  route: string;
  boardStopLabel: string;
  walkMinutes?: number;
  departAt: string;
  arriveAt: string;
  leaveInMinutes: number;
  durationMinutes: number;
  fastest: boolean;
  live: boolean;
}

export function pickFastest(options: BusOption[]): BusOption | null {
  const fastest = options.filter((o) => o.fastest);
  return fastest[0] ?? options[0] ?? null;
}
