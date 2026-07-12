import type { BusOption } from "@/lib/busOption";

/** Change instructions for going-home options that involve New Union St */
export function TransferDetail({ option }: { option: BusOption }) {
  if (option.chained && option.connectorRoute) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2">
        Off at New Union St {option.changeArriveAt} · cross the street ·{" "}
        <strong>{option.connectorRoute}</strong> at {option.connectorDepartAt}
        {option.transferWaitMinutes != null && (
          <span className="text-neutral-500">
            {" "}
            ({option.transferWaitMinutes} min wait)
          </span>
        )}
      </p>
    );
  }
  if (option.walkFromNewUnion) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2">
        Off at New Union St {option.changeArriveAt} · walk home (~10 min) —
        faster than waiting for a 17/21.
      </p>
    );
  }
  return null;
}
