import { STOPS } from "./stops";

export interface StopMarkerStyle {
  emoji: string;
  bg: string;
  label: string;
}

/** Distinct map markers for your regular stops */
const FAVORITE_STOP_MARKERS: Record<string, StopMarkerStyle> = {
  [STOPS.stJohnsCS2]: { emoji: "⛪", bg: "#1d4ed8", label: "St Johns" },
  [STOPS.newUnionBY1]: { emoji: "🚏", bg: "#059669", label: "New Union" },
  [STOPS.warwickUW1]: { emoji: "🎓", bg: "#7c3aed", label: "Warwick" },
  [STOPS.lynchgateBefore]: { emoji: "🏠", bg: "#ea580c", label: "Lynchgate" },
};

export function getStopMarkerStyle(stopId: string): StopMarkerStyle | null {
  return FAVORITE_STOP_MARKERS[stopId] ?? null;
}

export function favoriteStopMarkerHtml(style: StopMarkerStyle): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;width:48px;pointer-events:auto">
    <div style="width:32px;height:32px;border-radius:8px;background:${style.bg};display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">${style.emoji}</div>
    <span style="margin-top:3px;font-size:9px;font-weight:700;color:${style.bg};letter-spacing:-0.02em;text-align:center;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff">${style.label}</span>
  </div>`;
}

export function genericStopMarkerHtml(): string {
  return `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center">
    <div style="width:12px;height:12px;border-radius:50%;background:#525252;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>
  </div>`;
}
