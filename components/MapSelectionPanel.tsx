"use client";

import type { LiveVehicle } from "@/lib/bods";
import type { StopCoord } from "@/lib/stopCoords";
import type { StopDeparture } from "@/lib/stopTimes";
import { RouteBadge } from "@/components/RouteBadge";

/** Falls back to a clock time for stale reports (e.g. last night's parking spot) */
function positionAge(recordedAt: string): string | null {
  const ms = Date.now() - new Date(recordedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min <= 60) return `${min} min ago`;
  return null;
}

export function MapSelectionPanel({
  bus,
  stop,
  departures,
  departuresLoading,
  departuresError,
  onClose,
}: {
  bus: LiveVehicle | null;
  stop: StopCoord | null;
  departures: StopDeparture[];
  departuresLoading: boolean;
  departuresError: string | null;
  onClose: () => void;
}) {
  if (!bus && !stop) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1001] pointer-events-auto max-h-[50vh] overflow-y-auto rounded-t-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-2xl">
      <div className="sticky top-0 bg-white dark:bg-neutral-950 px-4 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-800 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {bus ? (
            <>
              <p className="text-xs text-neutral-500 uppercase tracking-wide">
                Live bus
              </p>
              <p className="text-lg font-bold flex items-center gap-2">
                <RouteBadge route={bus.route} size="lg" />
                {bus.destination && (
                  <span className="text-sm font-normal text-neutral-500 truncate">
                    → {bus.destination}
                  </span>
                )}
              </p>
            </>
          ) : stop ? (
            <>
              <p className="text-xs text-neutral-500 uppercase tracking-wide">
                Bus stop
              </p>
              <p className="text-lg font-semibold">{stop.label}</p>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-neutral-500 px-2 py-1 text-sm touch-manipulation"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        {bus && (
          <div className="space-y-2 text-sm">
            {bus.origin && (
              <p className="text-neutral-600 dark:text-neutral-400">
                From {bus.origin}
              </p>
            )}
            {bus.direction && (
              <p className="text-neutral-500 text-xs capitalize">
                Direction: {bus.direction}
              </p>
            )}
            {bus.recordedAt && (
              <p className="text-xs text-neutral-500">
                Position updated {positionAge(bus.recordedAt) ?? new Date(bus.recordedAt).toLocaleTimeString()}
              </p>
            )}
            {!bus.destination && (
              <p className="text-neutral-500">
                Destination not reported for this vehicle.
              </p>
            )}
          </div>
        )}

        {stop && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Next departures
            </p>
            {departuresLoading && (
              <ul className="space-y-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="h-12 rounded-lg bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                  />
                ))}
              </ul>
            )}
            {!departuresLoading && departuresError && (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {departuresError}
              </p>
            )}
            {!departuresLoading &&
              !departuresError &&
              departures.length === 0 && (
                <p className="text-sm text-neutral-500">
                  No buses in the next 2 hours.
                </p>
              )}
            {!departuresLoading && !departuresError && departures.length > 0 && (
              <ul className="space-y-2">
                {departures.map((d) => (
                  <li
                    key={`${d.route}-${d.departAt}-${d.heading}`}
                    className="flex items-start gap-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 px-3 py-2"
                  >
                    <span className="shrink-0 mt-0.5">
                      <RouteBadge route={d.route} size="sm" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {d.leaveInMinutes === 0
                          ? "Due now"
                          : `In ${d.leaveInMinutes} min`}{" "}
                        <span className="text-neutral-500 font-normal">
                          ({d.departAt})
                        </span>
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        → {d.heading}
                        {d.live && " · live"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-neutral-400 text-center">
        Tap the map to dismiss
      </p>
    </div>
  );
}
