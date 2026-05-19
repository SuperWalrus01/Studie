"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { MapSelectionPanel } from "@/components/MapSelectionPanel";
import type { LiveVehicle } from "@/lib/bods";
import {
  MAP_CENTER,
  MAP_ZOOM,
  MAP_PICKER_STOPS,
  STOP_COORDS,
  type StopCoord,
} from "@/lib/stopCoords";
import type { StopDeparture } from "@/lib/stopTimes";
import {
  getStopMarkerStyle,
  stopMarkerDimensions,
  stopMarkerHtml,
} from "@/lib/stopMarkers";
import "leaflet/dist/leaflet.css";

const REFRESH_MS = 5_000;

const ROUTE_COLORS: Record<string, string> = {
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

function routeColor(route: string): string {
  return ROUTE_COLORS[route] ?? "#525252";
}

function bindMarkerSelect(
  L: typeof import("leaflet"),
  marker: import("leaflet").Marker,
  suppressMapClick: MutableRefObject<boolean>,
  onSelect: () => void
) {
  const handler = (e: import("leaflet").LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    suppressMapClick.current = true;
    onSelect();
  };
  marker.on("click", handler);
}

function MapContent() {
  const searchParams = useSearchParams();
  const routesParam = searchParams.get("routes");
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const busLayerRef = useRef<L.LayerGroup | null>(null);
  const stopLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const centeredOnUserRef = useRef(false);
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userPos, setUserPos] = useState<{
    lat: number;
    lon: number;
    accuracy?: number;
  } | null>(null);
  const [locStatus, setLocStatus] = useState<
    "idle" | "requesting" | "active" | "denied" | "unsupported"
  >("idle");
  const [locPromptDismissed, setLocPromptDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedBus, setSelectedBus] = useState<LiveVehicle | null>(null);
  const [selectedStop, setSelectedStop] = useState<StopCoord | null>(null);
  const [stopDepartures, setStopDepartures] = useState<StopDeparture[]>([]);
  const [stopDeparturesLoading, setStopDeparturesLoading] = useState(false);
  const selectBusRef = useRef<(v: LiveVehicle) => void>(() => {});
  const selectStopRef = useRef<(s: StopCoord) => void>(() => {});
  const clearSelectionRef = useRef(() => {});
  const suppressMapClickRef = useRef(false);

  const clearSelection = useCallback(() => {
    setSelectedBus(null);
    setSelectedStop(null);
  }, []);

  const selectBus = useCallback((v: LiveVehicle) => {
    setSelectedStop(null);
    setSelectedBus(v);
  }, []);

  const selectStop = useCallback((s: StopCoord) => {
    setSelectedBus(null);
    setSelectedStop(s);
    leafletMap.current?.setView(
      [s.lat, s.lon],
      Math.max(leafletMap.current.getZoom(), 15),
      { animate: true }
    );
  }, []);

  selectBusRef.current = selectBus;
  selectStopRef.current = selectStop;
  clearSelectionRef.current = clearSelection;

  const fetchOpts = (force: boolean): RequestInit =>
    force ? { cache: "no-store" } : {};

  const bustUrl = (path: string, force: boolean) => {
    if (!force) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}_t=${Date.now()}`;
  };

  const loadVehicles = useCallback(
    async (force = false) => {
      const params = new URLSearchParams();
      if (routesParam) params.set("routes", routesParam);
      const qs = params.toString() ? `?${params}` : "";
      try {
        const res = await fetch(
          bustUrl(`/api/vehicles${qs}`, force),
          fetchOpts(force)
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not load buses");
          return;
        }
        setError(null);
        setVehicles(data.vehicles ?? []);
        setUpdatedAt(data.updatedAt ?? null);
      } catch {
        setError("Could not reach server");
      }
    },
    [routesParam]
  );

  const load = useCallback(
    async (force = false) => {
      await loadVehicles(force);
      setLastRefresh(new Date());
    },
    [loadVehicles]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const applyPosition = useCallback((pos: GeolocationPosition) => {
    setUserPos({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
    setLocStatus("active");
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocStatus("unsupported");
      return;
    }
    if (locStatus === "active" && userPos && leafletMap.current) {
      leafletMap.current.setView([userPos.lat, userPos.lon], 15, {
        animate: true,
      });
      return;
    }
    setLocStatus("requesting");
    stopWatching();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyPosition(pos);
        watchIdRef.current = navigator.geolocation.watchPosition(
          applyPosition,
          () => {
            /* keep last known position */
          },
          { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
        );
      },
      (err) => {
        setLocStatus(err.code === err.PERMISSION_DENIED ? "denied" : "denied");
        setUserPos(null);
        setLocPromptDismissed(true);
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }, [applyPosition, stopWatching, locStatus, userPos]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") requestLocation();
        else if (result.state === "denied") {
          setLocStatus("denied");
          setLocPromptDismissed(true);
        }
      })
      .catch(() => {});
  }, [requestLocation]);

  useEffect(() => () => stopWatching(), [stopWatching]);

  useEffect(() => {
    if (!selectedStop) {
      setStopDepartures([]);
      return;
    }
    setStopDeparturesLoading(true);
    fetch(`/api/stop-times?stopId=${encodeURIComponent(selectedStop.id)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => setStopDepartures(data.departures ?? []))
      .catch(() => setStopDepartures([]))
      .finally(() => setStopDeparturesLoading(false));
  }, [selectedStop]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current).setView(
        [MAP_CENTER.lat, MAP_CENTER.lon],
        MAP_ZOOM
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      map.createPane("busPane");
      map.getPane("busPane")!.style.zIndex = "640";
      map.createPane("stopPane");
      map.getPane("stopPane")!.style.zIndex = "680";

      stopLayerRef.current = L.layerGroup().addTo(map);
      busLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);

      map.on("click", () => {
        requestAnimationFrame(() => {
          if (suppressMapClickRef.current) {
            suppressMapClickRef.current = false;
            return;
          }
          clearSelectionRef.current();
        });
      });

      leafletMap.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      leafletMap.current?.remove();
      leafletMap.current = null;
      busLayerRef.current = null;
      stopLayerRef.current = null;
      userLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !stopLayerRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      stopLayerRef.current!.clearLayers();

      for (const stop of STOP_COORDS) {
        const { iconSize, iconAnchor } = stopMarkerDimensions(stop);
        const isPriority =
          getStopMarkerStyle(stop.id, stop.label) != null ||
          stop.label.startsWith("CS") ||
          stop.label === "Before" ||
          stop.label === "After";

        const stopIcon = L.divIcon({
          className: "bus-stop-hit",
          html: stopMarkerHtml(stop),
          iconSize,
          iconAnchor,
        });

        const marker = L.marker([stop.lat, stop.lon], {
          icon: stopIcon,
          pane: "stopPane",
          zIndexOffset: isPriority ? 1100 : 1000,
        }).addTo(stopLayerRef.current!);
        bindMarkerSelect(L, marker, suppressMapClickRef, () =>
          selectStopRef.current(stop)
        );
      }
    })();
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !busLayerRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      busLayerRef.current!.clearLayers();

      for (const v of vehicles) {
        const color = routeColor(v.route);
        const icon = L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;min-width:28px;height:22px;padding:0 6px;border-radius:4px;background:${color};color:white;font:bold 11px/1 system-ui,sans-serif;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">${v.route}</div>`,
          iconAnchor: [14, 11],
        });

        const marker = L.marker([v.lat, v.lon], {
          icon,
          pane: "busPane",
          zIndexOffset: 400,
        }).addTo(busLayerRef.current!);
        bindMarkerSelect(L, marker, suppressMapClickRef, () =>
          selectBusRef.current(v)
        );
      }
    })();
  }, [mapReady, vehicles]);

  useEffect(() => {
    if (!mapReady || !userLayerRef.current || !userPos) return;

    (async () => {
      const L = (await import("leaflet")).default;
      const layer = userLayerRef.current!;
      layer.clearLayers();

      if (userPos.accuracy && userPos.accuracy > 0) {
        L.circle([userPos.lat, userPos.lon], {
          radius: userPos.accuracy,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(layer);
      }

      const icon = L.divIcon({
        className: "user-location-marker",
        html: `<div style="position:relative;width:32px;height:32px">
          <div style="position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:rgba(59,130,246,0.25);border:2px solid rgba(59,130,246,0.5)"></div>
          <div style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.45)"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([userPos.lat, userPos.lon], { icon, zIndexOffset: 1000 })
        .bindPopup("<strong>You are here</strong>")
        .addTo(layer);

      if (leafletMap.current && !centeredOnUserRef.current) {
        centeredOnUserRef.current = true;
        leafletMap.current.setView([userPos.lat, userPos.lon], 15, {
          animate: true,
        });
      }
    })();
  }, [mapReady, userPos]);

  return (
    <main className="flex flex-1 flex-col h-[100dvh] max-w-lg mx-auto w-full">
      <div className="relative z-20 px-4 py-3 flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-950">
        <Link href="/" className="text-sm text-neutral-500 shrink-0">
          ← Back
        </Link>
        <h1 className="text-base font-semibold">Live buses</h1>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={requestLocation}
            className={`text-sm px-3 py-2 rounded-lg touch-manipulation ${
              locStatus === "active"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                : "text-neutral-700 dark:text-neutral-300 active:bg-neutral-100 dark:active:bg-neutral-800"
            }`}
            aria-label="Show my location"
          >
            📍
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 px-3 py-2 rounded-lg disabled:opacity-50 touch-manipulation min-w-[4.5rem]"
          >
            {refreshing ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="px-4 py-2 text-sm text-amber-800 bg-amber-50 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </p>
      )}
      <div className="relative z-0 flex-1 min-h-0 w-full isolate">
        <div ref={mapRef} className="absolute inset-0" />

        {!locPromptDismissed && locStatus === "idle" && (
          <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-auto max-w-sm">
            <div className="rounded-xl border border-blue-200 bg-white dark:bg-neutral-900 px-4 py-3 shadow-lg dark:border-blue-800">
              <p className="text-sm font-medium">Show where you are?</p>
              <p className="text-xs text-neutral-500 mt-1">
                Optional — the map works without it. Tap 📍 anytime.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setLocPromptDismissed(true)}
                  className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-600 text-sm py-2.5 touch-manipulation"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="flex-1 rounded-lg bg-blue-600 text-white text-sm font-medium py-2.5 touch-manipulation"
                >
                  Allow
                </button>
              </div>
            </div>
          </div>
        )}

        {locStatus === "requesting" && (
          <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-none">
            <div className="rounded-full bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm shadow">
              Getting location…
            </div>
          </div>
        )}

        {locStatus === "denied" && !locPromptDismissed && (
          <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-auto">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm flex items-center justify-between gap-2">
              <span className="text-amber-900 dark:text-amber-100 text-xs">
                Location blocked — enable in Settings, or use map without it
              </span>
              <button
                type="button"
                onClick={() => setLocPromptDismissed(true)}
                className="shrink-0 text-xs font-medium underline touch-manipulation"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {locStatus === "unsupported" && !locPromptDismissed && (
          <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-auto">
            <div className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-xs flex justify-between gap-2">
              <span>Location not supported in this browser</span>
              <button
                type="button"
                onClick={() => setLocPromptDismissed(true)}
                className="underline touch-manipulation"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {locStatus === "active" && userPos && !selectedBus && !selectedStop && (
          <div className="absolute bottom-3 left-3 z-[1000] rounded-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 shadow border border-blue-200 dark:border-blue-800 pointer-events-none">
            📍 You are here
            {userPos.accuracy != null && userPos.accuracy < 500 && (
              <span className="text-neutral-500">
                {" "}
                · ±{Math.round(userPos.accuracy)}m
              </span>
            )}
          </div>
        )}

        {!selectedBus && !selectedStop && (
          <div className="absolute top-3 right-3 z-[999] rounded-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-400 shadow pointer-events-none">
            Tap a bus or stop
          </div>
        )}

        <MapSelectionPanel
          bus={selectedBus}
          stop={selectedStop}
          departures={stopDepartures}
          departuresLoading={stopDeparturesLoading}
          onClose={clearSelection}
        />
      </div>

      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-950 max-h-[40vh] overflow-y-auto">
        <p className="text-xs text-neutral-500">
          {vehicles.length} bus{vehicles.length === 1 ? "" : "es"} · auto-refresh
          every 5s
          {lastRefresh && (
            <span> · refreshed {lastRefresh.toLocaleTimeString()}</span>
          )}
        </p>


        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Stops
          </p>
          <div className="flex flex-wrap gap-2">
            {MAP_PICKER_STOPS.map((stop) => {
              const style = getStopMarkerStyle(stop.id, stop.label);
              return (
                <button
                  key={`${stop.id}-${stop.label}`}
                  type="button"
                  onClick={() => selectStop(stop)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border touch-manipulation flex items-center gap-1 ${
                    selectedStop?.id === stop.id
                      ? "text-white border-transparent"
                      : "border-neutral-300 dark:border-neutral-600"
                  }`}
                  style={
                    selectedStop?.id === stop.id
                      ? { background: style?.bg ?? "#171717" }
                      : style
                        ? { borderColor: style.bg, color: style.bg }
                        : undefined
                  }
                >
                  {style && <span aria-hidden>{style.emoji}</span>}
                  {stop.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(ROUTE_COLORS).map(([route, color]) => (
            <span
              key={route}
              className="text-xs px-2 py-0.5 rounded text-white"
              style={{ background: color }}
            >
              {route}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-center text-neutral-500">Loading map…</main>
      }
    >
      <MapContent />
    </Suspense>
  );
}
