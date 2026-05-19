"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FastestPick } from "@/lib/fastest";
import type { BusOption } from "@/lib/busOption";
import { fetchApi } from "@/lib/fetchApi";

export default function FastestPage() {
  const [pick, setPick] = useState<FastestPick | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, data } = await fetchApi<{
        error?: string;
        pick?: FastestPick | null;
      }>("/api/fastest");
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setPick(null);
      } else {
        setPick(data.pick ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach server");
      setPick(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <main className="flex flex-1 flex-col px-4 py-6 max-w-lg mx-auto w-full">
      <Link href="/" className="text-sm text-neutral-500 mb-4 inline-block">
        ← Back
      </Link>

      <h1 className="text-2xl font-semibold mb-2">Fastest right now</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Best arrival across your usual trips
      </p>

      {loading && !pick && (
        <p className="text-neutral-500 py-12 text-center">Finding buses…</p>
      )}

      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm mb-4 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100">
          {error}
        </div>
      )}

      {!loading && !error && !pick && (
        <p className="text-neutral-500 py-12 text-center">
          No buses in the next 2 hours.
        </p>
      )}

      {pick && <FastestCard pick={pick} />}

      <button
        type="button"
        onClick={load}
        className="mt-8 text-sm text-neutral-500 underline self-center"
      >
        Refresh now
      </button>
    </main>
  );
}

function FastestCard({ pick }: { pick: FastestPick }) {
  const o: BusOption = { ...pick.option, fastest: true };
  return (
    <div>
      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
        {pick.label}
      </p>
      <div className="rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-5 dark:bg-emerald-950/40 dark:border-emerald-600">
        <div className="flex items-center justify-between gap-2">
          <span className="text-3xl font-bold">{o.route}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Fastest
          </span>
        </div>
        <p className="text-sm text-neutral-500 mt-2">{o.boardStopLabel}</p>
        <p className="mt-3 text-base">
          Leaves in <strong>{o.leaveInMinutes} min</strong>
          <span className="text-neutral-500"> ({o.departAt})</span>
        </p>
        <p className="text-2xl font-semibold mt-2">Arrive {o.arriveAt}</p>
        <p className="text-sm text-neutral-500 mt-1">
          {o.durationMinutes} min on the bus
          {o.walkMinutes != null && o.walkMinutes > 0 && (
            <span> · {o.walkMinutes} min walk before</span>
          )}
        </p>
      </div>
      <Link
        href={`/trip/${pick.tripId}`}
        className="block mt-4 text-center text-sm text-neutral-600 underline dark:text-neutral-400"
      >
        See all options for this trip
      </Link>
    </div>
  );
}
