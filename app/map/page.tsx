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
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [stops, setStops] = useState<StopCoord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [locError, setLocError] = useState<string | null>(null);
  const [lynchgate11, setLynchgate11] = useState<BusOption | null>(null);
  const [connectorBuses, setConnectorBuses] = useState<BusOption[]>([]);

  const loadVehicles = useCallback(async () => {
    const qs = routesParam ? `?routes=${encodeURIComponent(routesParam)}` : "";
    try {
      const res = await fetch(`/api/vehicles${qs}`);
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
  }, [routesParam]);

  const loadLynchgateTimes = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/options?trip=toLynchgate&origin=cityVillage"
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

  const load = useCallback(async () => {
    await Promise.all([loadVehicles(), loadLynchgateTimes()]);
  }, [loadVehicles, loadLynchgateTimes]);

  const locateMe = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Location not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setLocError("Could not get location — check permissions"),
      { enableHighAccuracy: true, timeout: 12_000 }
    );
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    locateMe();
  }, [locateMe]);

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
      userLayerRef.current!.clearLayers();

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([userPos.lat, userPos.lon], { icon })
        .bindPopup("You are here")
        .addTo(userLayerRef.current!);

      if (leafletMap.current) {
        leafletMap.current.panTo([userPos.lat, userPos.lon], { animate: true });
      }
    })();
  }, [mapReady, userPos]);

  return (
    <main className="flex flex-1 flex-col h-[100dvh] max-w-lg mx-auto w-full">
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <Link href="/" className="text-sm text-neutral-500 shrink-0">
          ← Back
        </Link>
        <h1 className="text-base font-semibold">Live buses</h1>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={locateMe}
            className="text-sm text-neutral-500 underline"
          >
            Me
          </button>
          <button
            type="button"
            onClick={load}
            className="text-sm text-neutral-500 underline"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="px-4 py-2 text-sm text-amber-800 bg-amber-50 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </p>
      )}
      {locError && (
        <p className="px-4 py-1 text-xs text-neutral-500">{locError}</p>
      )}

      <div ref={mapRef} className="flex-1 min-h-0 w-full z-0" />

      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-950 max-h-[40vh] overflow-y-auto">
        <p className="text-xs text-neutral-500">
          {vehicles.length} bus{vehicles.length === 1 ? "" : "es"} · auto-refresh
          every 5s
          {updatedAt && (
            <span> · {new Date(updatedAt).toLocaleTimeString()}</span>
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
