import Link from "next/link";
import { RouteBadge } from "@/components/RouteBadge";
import { TRIP_LIST, TRIPS, type TripId } from "@/lib/journeys";

const TRIP_META: Record<TripId, { icon: string; desc: string; routes: string[] }> = {
  toWarwick: {
    icon: "🎓",
    desc: "City Village or New Union St → campus",
    routes: ["11", "12X", "14", "87"],
  },
  goingHome: {
    icon: "🏠",
    desc: "Warwick → City Village or New Union St",
    routes: ["11", "12X", "14", "87"],
  },
};

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 max-w-lg mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bus Compare</h1>
        <p className="text-neutral-500 mt-1 text-sm">
          City Village ↔ Warwick · Coventry
        </p>
      </header>

      <nav className="flex flex-col gap-3">
        <Link
          href="/fastest"
          className="block w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 shadow-sm active:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/50 dark:active:bg-emerald-900/50"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden className="text-2xl">
              ⚡
            </span>
            <span>
              <span className="block text-lg font-semibold">
                Fastest right now
              </span>
              <span className="block text-xs text-neutral-500 mt-0.5">
                Best arrival across your usual trips
              </span>
            </span>
          </span>
        </Link>

        {TRIP_LIST.map((id) => {
          const meta = TRIP_META[id];
          return (
            <Link
              key={id}
              href={`/trip/${id}`}
              className="block w-full rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
            >
              <span className="flex items-center gap-3">
                <span aria-hidden className="text-2xl">
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-medium">
                    {TRIPS[id].title}
                  </span>
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    {meta.desc}
                  </span>
                </span>
              </span>
              <span className="mt-2.5 flex gap-1.5 pl-9">
                {meta.routes.map((r) => (
                  <RouteBadge key={r} route={r} size="xs" />
                ))}
              </span>
            </Link>
          );
        })}

        <Link
          href="/map"
          className="block w-full rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:active:bg-neutral-800"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden className="text-2xl">
              🗺️
            </span>
            <span>
              <span className="block text-lg font-medium">Live bus map</span>
              <span className="block text-xs text-neutral-500 mt-0.5">
                Real-time positions · updates every 5s
              </span>
            </span>
          </span>
        </Link>
      </nav>
    </main>
  );
}
