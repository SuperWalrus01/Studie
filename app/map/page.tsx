"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { BusOption } from "@/lib/busOption";
import type { LiveVehicle } from "@/lib/bods";
import { MAP_CENTER, MAP_ZOOM, type StopCoord } from "@/lib/stopCoords";
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
  const [stops, setStops] = useState<StopCoord[]>([]);
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
  const [lynchgate11, setLynchgate11] = useState<BusOption | null>(null);
  const [connectorBuses, setConnectorBuses] = useState<BusOption[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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
        setStops(data.stops ?? []);
        setUpdatedAt(data.updatedAt ?? null);
      } catch {
        setError("Could not reach server");
      }
    },
    [routesParam]
  );

  const loadLynchgateTimes = useCallback(async (force = false) => {
    try {
      const res = await fetch(
        bustUrl("/api/options?trip=toLynchgate&origin=cityVillage", force),
        fetchOpts(force)
      );
      const data = await res.json();
      if (!res.ok) return;
      const opts: BusOption[] = data.options ?? [];
      const eleven = opts.find((o) => o.route === "11") ?? opts[0] ?? null;
      setLynchgate11(eleven);
      setConnectorBuses((data.connectorOptions ?? []).slice(0, 4));
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(
    async (force = false) => {
      await Promise.all([loadVehicles(force), loadLynchgateTimes(force)]);
      setLastRefresh(new Date());
    },
    [loadVehicles, loadLynchgateTimes]
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
        else if (result.state === "denied") setLocStatus("denied");
      })
      .catch(() => {});
  }, [requestLocation]);

  useEffect(() => () => stopWatching(), [stopWatching]);

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

      stopLayerRef.current = L.layerGroup().addTo(map);
      busLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);
      leafletMap.current = map;
      setMapReady(true);
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

      const stopIcon = L.divIcon({
        className: "",
        html: `<div style="width:10px;height:10px;border-radius:50%;background:#171717;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      for (const stop of stops) {
        L.marker([stop.lat, stop.lon], { icon: stopIcon })
          .bindPopup(stop.label)
          .addTo(stopLayerRef.current!);
      }
    })();
  }, [mapReady, stops]);

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

        L.marker([v.lat, v.lon], { icon })
          .bindPopup(
            `<strong>Route ${v.route}</strong><br/>Vehicle ${v.id}${
              v.recordedAt
                ? `<br/><small>${new Date(v.recordedAt).toLocaleTimeString()}</small>`
                : ""
            }`
          )
          .addTo(busLayerRef.current!);
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

        {locStatus !== "active" && (
          <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-auto">
            <div className="rounded-xl border border-blue-200 bg-white/95 dark:bg-neutral-900/95 backdrop-blur px-4 py-3 shadow-lg dark:border-blue-900">
              {locStatus === "unsupported" ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Location is not supported in this browser.
                </p>
              ) : locStatus === "denied" ? (
                <>
                  <p className="text-sm font-medium">Location blocked</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Enable location for this site in your browser settings, then
                    tap below.
                  </p>
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="mt-3 w-full rounded-lg bg-blue-600 text-white text-sm font-medium py-2.5 touch-manipulation"
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Show where you are</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    We&apos;ll ask to use your live location and show a blue dot
                    on the map.
                  </p>
                  <button
                    type="button"
                    onClick={requestLocation}
                    disabled={locStatus === "requesting"}
                    className="mt-3 w-full rounded-lg bg-blue-600 text-white text-sm font-medium py-2.5 disabled:opacity-60 touch-manipulation flex items-center justify-center gap-2"
                  >
                    {locStatus === "requesting" ? (
                      "Getting location…"
                    ) : (
                      <>
                        <span aria-hidden>📍</span> Use my location
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {locStatus === "active" && userPos && (
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
      </div>

      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-950 max-h-[40vh] overflow-y-auto">
        <p className="text-xs text-neutral-500">
          {vehicles.length} bus{vehicles.length === 1 ? "" : "es"} · auto-refresh
          every 5s
          {lastRefresh && (
            <span> · refreshed {lastRefresh.toLocaleTimeString()}</span>
          )}
        </p>

        <div className="mt-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
            To Lynchgate Rd
          </p>
          {lynchgate11 ? (
            <p className="text-sm mt-1">
              <strong>Route 11</strong> — leaves in {lynchgate11.leaveInMinutes}{" "}
              min ({lynchgate11.departAt}) · arrive {lynchgate11.arriveAt}
            </p>
          ) : (
            <p className="text-sm text-neutral-500 mt-1">No route 11 soon</p>
          )}
          {connectorBuses.length > 0 && (
            <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              <p className="text-xs mb-1">17 / 21 · New Union (opposite side):</p>
              <ul className="space-y-0.5">
                {connectorBuses.map((b) => (
                  <li key={`${b.route}-${b.departAt}`}>
                    <strong>{b.route}</strong> in {b.leaveInMinutes}m (
                    {b.departAt})
                  </li>
                ))}
              </ul>
            </div>
          )}
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
