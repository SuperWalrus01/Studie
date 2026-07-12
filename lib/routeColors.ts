/** Single source of truth for route badge/marker colors */
export const ROUTE_COLORS: Record<string, string> = {
  "9": "#0891b2",
  "9B": "#0e7490",
  "11": "#2563eb",
  "12X": "#7c3aed",
  "14": "#059669",
  "14A": "#0d9488",
  "87": "#d97706",
  "17": "#dc2626",
  "17A": "#ea580c",
  "21": "#db2777",
  "21A": "#c026d3",
  "21S": "#9333ea",
};

export function routeColor(route: string): string {
  return ROUTE_COLORS[route] ?? "#525252";
}
