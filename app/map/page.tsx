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
import { fetchApi } from "@/lib/fetchApi";
import { ROUTE_COLORS, routeColor } from "@/lib/routeColors";
import type { StopDeparture } from "@/lib/stopTimes";
import {
  getStopMarkerStyle,
  stopMarkerDimensions,
  stopMarkerHtml,
} from "@/lib/stopMarkers";
import "leaflet/dist/leaflet.css";

const REFRESH_MS = 5_000;

function tileUrl(dark: boolean): string {
  return `https://{s}.basemaps.cartocdn.com/${
    dark ? "dark_all" : "light_all"
  }/{z}/{x}/{y}{r}.png`;
}

function busMarkerHtml(v: LiveVehicle, selected: boolean): string {
  const color = routeColor(v.route);
  const arrow =
    v.bearing != null && !Number.isNaN(v.bearing)
      ? `<div style="position:absolute;left:50%;top:50%;width:46px;height:46px;transform:translate(-50%,-50%) rotate(${Math.round(
          v.bearing
        )}deg);pointer-events:none">
          <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${color};filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))"></div>
        </div>`
      : "";
  const glow = selected
    ? `0 0 0 3px ${color}66, 0 2px 8px rgba(0,0,0,.45)`
    : "0 2px 6px rgba(0,0,0,.35)";
  return `<div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center">
    ${arrow}
    <div style="display:flex;align-items:center;justify-content:center;min-width:28px;height:22px;padding:0 6px;border-radius:6px;background:${color};color:white;font:bold 11px/1 system-ui,sans-serif;border:2px solid white;box-shadow:${glow}">${v.route}</div>
  </div>`;
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
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const vehiclesByIdRef = useRef<Map<string, LiveVehicle>>(new Map());
  const stopLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const disposersRef = useRef<(() => void)[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const centeredOnUserRef = useRef(false);
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeRoutes, setActiveRoutes] = useState<string[]>(() =>
    routesParam
      ? routesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  );
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
  const [stopDeparturesError, setStopDeparturesError] = useState<string | null>(
    null
  );
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
    suppressMapClickRef.current = true;
    setSelectedBus(null);
    setSelectedStop(s);
    leafletMap.current?.setView(
      [s.lat, s.lon],
      Math.max(leafletMap.current.getZoom(), 15),
      { animate: true }
    );
  }, []);

  /** Latest-ref pattern: keep marker click handlers pointing at fresh callbacks */
  useEffect(() => {
    selectBusRef.current = selectBus;
    selectStopRef.current = selectStop;
    clearSelectionRef.current = clearSelection;
  });

  const fetchOpts = (force: boolean): RequestInit =>
    force ? { cache: "no-store" } : {};

  const bustUrl = (path: string, force: boolean) => {
    if (!force) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}_t=${Date.now()}`;
  };

  const routesKey = activeRoutes.join(",");

  const loadVehicles = useCallback(
    async (force = false) => {
      const params = new URLSearchParams();
      if (routesKey) params.set("routes", routesKey);
      const qs = params.toString() ? `?${params}` : "";
      try {
        const { res, data } = await fetchApi<{
          error?: string;
          vehicles?: LiveVehicle[];
        }>(bustUrl(`/api/vehicles${qs}`, force), fetchOpts(force));
        if (!res.ok) {
          setError(data.error ?? "Could not load buses");
          return;
        }
        const fresh = data.vehicles ?? [];
        setError(null);
        setVehicles(fresh);
        vehiclesByIdRef.current = new Map(fresh.map((v) => [v.id, v]));
        /** Keep the open bus panel tracking the latest position report */
        setSelectedBus((prev) =>
          prev ? (fresh.find((v) => v.id === prev.id) ?? prev) : prev
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not reach server"
        );
      }
    },
    [routesKey]
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

  const toggleRoute = useCallback((route: string) => {
    setActiveRoutes((prev) =>
      prev.includes(route) ? prev.filter((r) => r !== route) : [...prev, route]
    );
  }, []);

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
    /* Poll-fetch: state updates happen after await, not synchronously */
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      /* Reset panel state when selection is cleared from any code path */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStopDepartures([]);
      setStopDeparturesError(null);
      setStopDeparturesLoading(false);
      return;
    }

    const stopId = selectedStop.id;
    const controller = new AbortController();
    setStopDeparturesLoading(true);
    setStopDeparturesError(null);
    setStopDepartures([]);

    fetchApi<{ error?: string; departures?: StopDeparture[] }>(
      `/api/stop-times?stopId=${encodeURIComponent(stopId)}`,
      { cache: "no-store", signal: controller.signal }
    )
      .then(({ res, data }) => {
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load timetable");
        }
        setStopDepartures(data.departures ?? []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setStopDepartures([]);
        setStopDeparturesError(
          err instanceof Error ? err.message : "Could not load timetable"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setStopDeparturesLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedStop]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    let cancelled = false;
    const disposers = disposersRef.current;
    const busMarkers = busMarkersRef.current;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current).setView(
        [MAP_CENTER.lat, MAP_CENTER.lon],
        MAP_ZOOM
      );

      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const tiles = L.tileLayer(tileUrl(mq.matches), {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);
      const onThemeChange = (e: MediaQueryListEvent) =>
        tiles.setUrl(tileUrl(e.matches));
      mq.addEventListener("change", onThemeChange);
      disposers.push(() => mq.removeEventListener("change", onThemeChange));

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
      disposers.forEach((dispose) => dispose());
      disposers.length = 0;
      busMarkers.clear();
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
          stop.label.startsWith("CS");

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

  /** Update bus markers in place so positions animate instead of flickering */
  useEffect(() => {
    if (!mapReady || !busLayerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !busLayerRef.current) return;

      const layer = busLayerRef.current;
      const markers = busMarkersRef.current;
      const seen = new Set<string>();

      for (const v of vehicles) {
        seen.add(v.id);
        const selected = v.id === selectedBus?.id;
        const html = busMarkerHtml(v, selected);
        const existing = markers.get(v.id);

        if (existing) {
          existing.setLatLng([v.lat, v.lon]);
          existing.setZIndexOffset(selected ? 500 : 400);
          const el = existing.getElement();
          if (el) el.innerHTML = html;
        } else {
          const icon = L.divIcon({
            className: "bus-marker",
            html,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          const marker = L.marker([v.lat, v.lon], {
            icon,
            pane: "busPane",
            zIndexOffset: selected ? 500 : 400,
          }).addTo(layer);
          const id = v.id;
          bindMarkerSelect(L, marker, suppressMapClickRef, () => {
            const current = vehiclesByIdRef.current.get(id);
            if (current) selectBusRef.current(current);
          });
          markers.set(id, marker);
        }
      }

      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          layer.removeLayer(marker);
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady, vehicles, selectedBus?.id]);

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
          departuresError={stopDeparturesError}
          onClose={clearSelection}
        />
      </div>

      <div className="px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-950 max-h-[40vh] overflow-y-auto">
        <p className="text-xs text-neutral-500">
          {vehicles.length} live bus{vehicles.length === 1 ? "" : "es"}
          {activeRoutes.length > 0 && ` on ${activeRoutes.join(", ")}`} ·
          updates every 5s
          {lastRefresh && <span> · {lastRefresh.toLocaleTimeString()}</span>}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-2">
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

        <p className="text-[11px] text-neutral-400 mt-3 mb-1.5">
          Routes · tap to filter
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(ROUTE_COLORS).map(([route, color]) => {
            const active =
              activeRoutes.length === 0 || activeRoutes.includes(route);
            return (
              <button
                key={route}
                type="button"
                onClick={() => toggleRoute(route)}
                className={`text-xs font-bold px-2 py-1 rounded touch-manipulation border ${
                  active
                    ? "text-white border-transparent"
                    : "text-neutral-400 border-neutral-300 dark:border-neutral-700 dark:text-neutral-500"
                }`}
                style={active ? { background: color } : undefined}
                aria-pressed={activeRoutes.includes(route)}
              >
                {route}
              </button>
            );
          })}
          {activeRoutes.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveRoutes([])}
              className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 touch-manipulation"
            >
              Show all
            </button>
          )}
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
