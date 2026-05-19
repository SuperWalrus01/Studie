import Link from "next/link";
import { TRIP_LIST, TRIPS } from "@/lib/journeys";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 max-w-lg mx-auto w-full">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Bus Compare</h1>
        <p className="text-neutral-500 mt-1 text-sm">
          Coventry · Warwick · Lynchgate
        </p>
      </header>

      <nav className="flex flex-col gap-3">
        <Link
          href="/map"
          className="block w-full rounded-xl border border-neutral-200 bg-white px-5 py-5 text-lg font-medium shadow-sm active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
        >
          Live bus map
        </Link>
        <Link
          href="/fastest"
          className="block w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-5 text-lg font-semibold shadow-sm active:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/50 dark:active:bg-emerald-900/50"
        >
          Fastest right now
        </Link>
        {TRIP_LIST.map((id) => (
          <Link
            key={id}
            href={`/trip/${id}`}
            className="block w-full rounded-xl border border-neutral-200 bg-white px-5 py-5 text-lg font-medium shadow-sm active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
          >
            {TRIPS[id].title}
          </Link>
        ))}
      </nav>
    </main>
  );
}
