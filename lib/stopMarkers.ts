import { NEW_UNION_STOP_IDS, ST_JOHNS_STOP_IDS, STOPS } from "./stops";
import type { StopCoord } from "./stopCoords";

export interface StopMarkerStyle {
  emoji: string;
  bg: string;
  label: string;
}

const NEW_UNION_STYLE: StopMarkerStyle = {
  emoji: "🚏",
  bg: "#059669",
  label: "New Union",
};

const ST_JOHNS_STYLE: StopMarkerStyle = {
  emoji: "⛪",
  bg: "#1d4ed8",
  label: "St Johns",
};

const FAVORITE_STOP_MARKERS: Record<string, StopMarkerStyle> = {
  [STOPS.newUnionBY2]: NEW_UNION_STYLE,
  [STOPS.railStationOut]: { emoji: "🚉", bg: "#0891b2", label: "Rail Stn" },
  [STOPS.warwickUW1]: { emoji: "🎓", bg: "#7c3aed", label: "Warwick" },
};

const ST_JOHNS_BAY_LABELS = new Set(["CS1", "CS2", "CS3"]);

export function getStopMarkerStyle(
  stopId: string,
  label?: string
): StopMarkerStyle | null {
  if (label === "St Johns Church") return ST_JOHNS_STYLE;
  if ((NEW_UNION_STOP_IDS as readonly string[]).includes(stopId))
    return NEW_UNION_STYLE;
  if ((ST_JOHNS_STOP_IDS as readonly string[]).includes(stopId) && label)
    return null;
  return FAVORITE_STOP_MARKERS[stopId] ?? null;
}

export function isStJohnsBay(stop: Pick<StopCoord, "label">): boolean {
  return ST_JOHNS_BAY_LABELS.has(stop.label);
}

export function favoriteStopMarkerHtml(style: StopMarkerStyle): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;width:48px;pointer-events:auto">
    <div style="width:32px;height:32px;border-radius:8px;background:${style.bg};display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">${style.emoji}</div>
    <span style="margin-top:3px;font-size:9px;font-weight:700;color:${style.bg};letter-spacing:-0.02em;text-align:center;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff">${style.label}</span>
  </div>`;
}

function bayMarkerHtml(bay: string, color: string): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;width:40px;pointer-events:auto">
    <div style="width:26px;height:26px;border-radius:5px;background:${color};display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,.35)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M4 16c0 1.1.9 2 2 2h1v3l3-3h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v10zm2-8h12v2H6V8zm0 4h8v2H6v-2z"/></svg>
    </div>
    <span style="margin-top:2px;font-size:9px;font-weight:800;color:${color};text-shadow:0 0 2px #fff,0 0 2px #fff">${bay}</span>
  </div>`;
}

export function stJohnsBayMarkerHtml(bay: string): string {
  return bayMarkerHtml(bay, "#2563eb");
}

export function genericStopMarkerHtml(): string {
  return `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center">
    <div style="width:12px;height:12px;border-radius:50%;background:#525252;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>
  </div>`;
}

export function stopMarkerHtml(stop: StopCoord): string {
  if (isStJohnsBay(stop)) return stJohnsBayMarkerHtml(stop.label);
  const style = getStopMarkerStyle(stop.id, stop.label);
  if (style) return favoriteStopMarkerHtml(style);
  return genericStopMarkerHtml();
}

export function stopMarkerDimensions(stop: StopCoord): {
  iconSize: [number, number];
  iconAnchor: [number, number];
} {
  if (isStJohnsBay(stop))
    return { iconSize: [40, 44], iconAnchor: [20, 22] };
  const style = getStopMarkerStyle(stop.id, stop.label);
  if (style) return { iconSize: [48, 52], iconAnchor: [24, 26] };
  return { iconSize: [36, 36], iconAnchor: [18, 18] };
}
