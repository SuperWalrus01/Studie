import { Fragment } from "react";
import { routeColor } from "@/lib/routeColors";

const SIZES = {
  xs: "px-1.5 py-0.5 text-[11px] rounded",
  sm: "px-2 py-0.5 text-xs rounded",
  lg: "px-2.5 py-1 text-base rounded-lg",
} as const;

export function RouteBadge({
  route,
  size = "sm",
}: {
  route: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`inline-block font-bold text-white leading-none ${SIZES[size]}`}
      style={{ background: routeColor(route) }}
    >
      {route}
    </span>
  );
}

/** Renders "11 → 17" or "12X → walk" as badges joined by arrows */
export function RouteChain({
  route,
  size = "sm",
}: {
  route: string;
  size?: keyof typeof SIZES;
}) {
  const parts = route.split("→").map((p) => p.trim());
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {parts.map((part, i) => (
        <Fragment key={`${part}-${i}`}>
          {i > 0 && (
            <span aria-hidden className="text-neutral-400">
              →
            </span>
          )}
          {part.toLowerCase() === "walk" ? (
            <span
              className={`inline-block font-semibold leading-none bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200 ${SIZES[size]}`}
            >
              🚶 walk
            </span>
          ) : (
            <RouteBadge route={part} size={size} />
          )}
        </Fragment>
      ))}
    </span>
  );
}
