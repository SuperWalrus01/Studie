"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pickFastest, type BusOption } from "@/lib/busOption";
import { RouteChain } from "@/components/RouteBadge";
import { TransferDetail } from "@/components/TransferDetail";
import { fetchApi } from "@/lib/fetchApi";
import {
  getTrip,
  type DestinationKey,
  type OriginKey,
  type TripId,
} from "@/lib/journeys";

const ORIGIN_LABELS: Record<OriginKey, string> = {
  cityVillage: "City Village",
  newUnion: "New Union St",
  warwick: "Warwick Uni",
};

const DEST_LABELS: Record<DestinationKey, string> = {
  cityVillage: "City Village",
  newUnion: "New Union St",
};

function defaultOrigin(tripId: TripId): OriginKey {
  if (tripId === "goingHome") return "warwick";
  return "cityVillage";
}

export default function TripPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params.id as string;
  const trip = getTrip(tripId);
  const fastestOnly = searchParams.get("fastest") === "1";

  const [origin, setOrigin] = useState<OriginKey>(() =>
    defaultOrigin(tripId as TripId)
  );
  const [destination, setDestination] = useState<DestinationKey>("cityVillage");
  const [options, setOptions] = useState<BusOption[]>([]);
  const [connectorOptions, setConnectorOptions] = useState<BusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const originKeys = trip?.origins
    ? (Object.keys(trip.origins) as OriginKey[])
    : [];
  const destKeys = trip?.destinations
    ? (Object.keys(trip.destinations) as DestinationKey[])
    : [];

  const fetchOptions = useCallback(async () => {
    if (!trip) return;

    const qs = new URLSearchParams({ trip: tripId, origin });
    if (trip.id === "goingHome") qs.set("destination", destination);

    try {
      const { res, data } = await fetchApi<{
        error?: string;
        options?: BusOption[];
        connectorOptions?: BusOption[];
      }>(`/api/options?${qs}`);
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setOptions([]);
        setConnectorOptions([]);
      } else {
        setError(null);
        setOptions(data.options ?? []);
        setConnectorOptions(data.connectorOptions ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach server");
      setOptions([]);
      setConnectorOptions([]);
    } finally {
      setLoading(false);
    }
  }, [trip, tripId, origin, destination]);

  useEffect(() => {
    /* Poll-fetch: state updates happen after await, not synchronously */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOptions();
    const interval = setInterval(fetchOptions, 30_000);
    return () => clearInterval(interval);
  }, [fetchOptions]);

  const displayOptions = useMemo(
    () => (fastestOnly ? filterFastest(options) : options),
    [fastestOnly, options]
  );
  const displayConnector = useMemo(
    () => (fastestOnly ? filterFastest(connectorOptions) : connectorOptions),
    [fastestOnly, connectorOptions]
  );

  if (!trip) {
    return (
      <main className="px-4 py-8">
        <p>Unknown trip.</p>
        <Link href="/" className="text-blue-600 underline mt-4 inline-block">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6 max-w-lg mx-auto w-full">
      <Link
        href="/"
        className="text-sm text-neutral-500 mb-4 inline-block"
      >
        ← Back
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{trip.title}</h1>
        <Link
          href={
            fastestOnly
              ? `/trip/${tripId}`
              : `/trip/${tripId}?fastest=1`
          }
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium border ${
            fastestOnly
              ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "border-neutral-300 text-neutral-600 dark:border-neutral-600 dark:text-neutral-400"
          }`}
        >
          {fastestOnly ? "Fastest only" : "All buses"}
        </Link>
      </div>

      {originKeys.length > 1 && (
        <Segmented
          label="From"
          value={origin}
          options={originKeys.map((k) => ({
            value: k,
            label: ORIGIN_LABELS[k],
          }))}
          onChange={(v) => {
            setOrigin(v as OriginKey);
            setOptions([]);
            setConnectorOptions([]);
            setLoading(true);
          }}
        />
      )}

      {destKeys.length > 1 && (
        <Segmented
          label="To"
          value={destination}
          options={destKeys.map((k) => ({
            value: k,
            label: DEST_LABELS[k],
          }))}
          onChange={(v) => {
            setDestination(v as DestinationKey);
            setOptions([]);
            setConnectorOptions([]);
            setLoading(true);
          }}
        />
      )}

      {loading && displayOptions.length === 0 && displayConnector.length === 0 && (
        <ul className="flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-32 rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse"
            />
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm mb-4 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        displayOptions.length === 0 &&
        displayConnector.length === 0 && (
          <p className="text-neutral-500 py-8 text-center">
            No buses in the next 2 hours.
          </p>
        )}

      {displayOptions.length > 0 && (
        <>
          {trip.id === "goingHome" && destination === "cityVillage" && (
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2 mt-2">
              To City Village
            </p>
          )}
          {trip.id === "goingHome" && destination === "newUnion" && (
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2 mt-2">
              To New Union St
            </p>
          )}
          {trip.id === "goingHome" && destination === "cityVillage" && (
            <p className="text-xs text-neutral-400 mb-3">
              14/87 go direct to St Johns. 11/12X end at New Union St — options
              below already include the cross-street change to a 17/21 (or the
              10 min walk when that&apos;s quicker), so just pick the earliest
              arrival.
            </p>
          )}
          <OptionList options={displayOptions} />
        </>
      )}

      {displayConnector.length > 0 && (
        <>
          <p className="text-xs text-neutral-500 uppercase tracking-wide mt-6 mb-2">
            Cross street · then to St Johns
          </p>
          <p className="text-xs text-neutral-400 mb-2">
            After the 11 or 12X, cross New Union St and board 17 / 21 on the
            opposite side (BY1 / BY5).
          </p>
          <OptionList options={displayConnector} />
        </>
      )}

      {trip.id === "goingHome" && origin === "warwick" && (
        <p className="text-xs text-neutral-400 mt-4">
          Route <strong>12X</strong> boards at Scarman Rd (not the main uni
          stops) — same stop as route 11 towards the city.
        </p>
      )}

      <button
        type="button"
        onClick={() => fetchOptions()}
        className="mt-6 text-sm text-neutral-500 underline self-center"
      >
        Refresh now
      </button>
    </main>
  );
}

function filterFastest(options: BusOption[]): BusOption[] {
  const pick = pickFastest(options);
  return pick ? [pick] : [];
}

function OptionList({ options }: { options: BusOption[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {options.map((opt, i) => (
        <li
          key={`${opt.route}-${opt.departAt}-${opt.boardStopLabel}-${i}`}
          className={`rounded-xl border px-4 py-4 ${
            opt.fastest
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-600"
              : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <RouteChain route={opt.route} size="lg" />
            {opt.fastest && (
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Fastest
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-1.5">
            {opt.boardStopLabel}
            {opt.walkMinutes != null && opt.walkMinutes > 0 && (
              <span> · {opt.walkMinutes} min walk</span>
            )}
            {opt.live && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {" "}
                · live
              </span>
            )}
          </p>
          <p className="mt-2 text-base">
            {opt.leaveInMinutes === 0 ? (
              <strong>Leave now</strong>
            ) : (
              <>
                Leaves in <strong>{opt.leaveInMinutes} min</strong>
              </>
            )}
            <span className="text-neutral-500"> ({opt.departAt})</span>
          </p>
          <p className="text-lg font-semibold mt-1">
            Arrive {opt.arriveAt}
            {opt.arriveLabel && (
              <span className="text-sm font-normal text-neutral-500 ml-1">
                · {opt.arriveLabel}
              </span>
            )}
            <span className="text-sm font-normal text-neutral-500 ml-2 block sm:inline">
              {opt.durationMinutes} min trip
            </span>
          </p>
          <TransferDetail option={opt} />
        </li>
      ))}
    </ul>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs text-neutral-500 mb-2 uppercase tracking-wide">
        {label}
      </p>
      <div className="flex rounded-lg border border-neutral-200 overflow-hidden dark:border-neutral-700">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              value === opt.value
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-white text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
