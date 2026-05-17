"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { ControlPanel } from "@/components/ControlPanel";
import { InfoPanel } from "@/components/InfoPanel";
import { RadarOverlay } from "@/components/RadarOverlay";
import { getOpenElevation } from "@/lib/elevation";
import {
  clearUserPositionWatch,
  geolocationMessageFromError,
  geolocationStatusFromError,
  getCurrentUserPosition,
  PARIS_CENTER,
  positionToGeoPoint,
  watchUserPosition,
} from "@/lib/geolocation";
import {
  addOpenBuildings,
  addOpenTopographyOverlay,
  OPENFREE_MAP_STYLE,
  removeOpenTopographyOverlay,
  setOpenBuildingsVisibility,
} from "@/lib/open-maps";
import type { GeoPoint, MapTelemetry } from "@/types/map";

const DEFAULT_ZOOM = 15.25;
const DEFAULT_PITCH = 62;
const DEFAULT_BEARING = -24;

const initialTelemetry: MapTelemetry = {
  center: {
    latitude: PARIS_CENTER.latitude,
    longitude: PARIS_CENTER.longitude,
  },
  userLocation: null,
  centerElevation: null,
  userElevation: null,
  zoom: DEFAULT_ZOOM,
  pitch: DEFAULT_PITCH,
  terrainEnabled: true,
  buildingsEnabled: true,
  geolocationStatus: "idle",
  geolocationError: null,
};

export function MapView() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const watchPositionRef = useRef<number | null>(null);
  const centerElevationAbortRef = useRef<AbortController | null>(null);
  const userElevationAbortRef = useRef<AbortController | null>(null);
  const centeredOnUserRef = useRef(false);
  const initialLocationRequestRef = useRef(false);
  const [telemetry, setTelemetry] = useState<MapTelemetry>(initialTelemetry);
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateTelemetryFromMap = useCallback((map: maplibregl.Map) => {
    const center = map.getCenter();

    setTelemetry((current) => ({
      ...current,
      center: {
        latitude: center.lat,
        longitude: center.lng,
      },
      zoom: map.getZoom(),
      pitch: map.getPitch(),
    }));
  }, []);

  const setUserMarker = useCallback((location: GeoPoint) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!markerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.className = "user-marker";

      const pulseElement = document.createElement("span");
      pulseElement.className = "user-marker__pulse";
      markerElement.appendChild(pulseElement);

      markerRef.current = new maplibregl.Marker({
        anchor: "center",
        element: markerElement,
      }).addTo(map);
    }

    markerRef.current.setLngLat([location.longitude, location.latitude]);
  }, []);

  const centerMapOn = useCallback((location: GeoPoint): boolean => {
    const map = mapRef.current;

    if (!map) {
      return false;
    }

    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: Math.max(map.getZoom(), DEFAULT_ZOOM),
      pitch: DEFAULT_PITCH,
      bearing:
        typeof location.heading === "number" ? location.heading : DEFAULT_BEARING,
      duration: 1400,
      essential: true,
    });

    return true;
  }, []);

  const refreshElevation = useCallback(
    async (point: GeoPoint | { latitude: number; longitude: number }, target: "center" | "user") => {
      const abortRef =
        target === "center" ? centerElevationAbortRef : userElevationAbortRef;

      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const elevation = await getOpenElevation(point, abortController.signal);

        setTelemetry((current) => ({
          ...current,
          [target === "center" ? "centerElevation" : "userElevation"]:
            elevation,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    },
    [],
  );

  const applyUserLocation = useCallback(
    (location: GeoPoint, centerAfterResolve: boolean) => {
      setTelemetry((current) => ({
        ...current,
        userLocation: location,
        geolocationStatus: "granted",
        geolocationError: null,
      }));
      setUserMarker(location);
      void refreshElevation(location, "user");

      if (centerAfterResolve) {
        centeredOnUserRef.current = centerMapOn(location);
      }
    },
    [centerMapOn, refreshElevation, setUserMarker],
  );

  const startLivePositionWatch = useCallback(() => {
    if (watchPositionRef.current !== null) {
      return;
    }

    const watchId = watchUserPosition(
      (position) => {
        const location = positionToGeoPoint(position);

        applyUserLocation(location, !centeredOnUserRef.current);
      },
      (error) => {
        setTelemetry((current) => ({
          ...current,
          geolocationStatus: geolocationStatusFromError(error),
          geolocationError: geolocationMessageFromError(error),
        }));
      },
    );

    if (watchId === null) {
      setTelemetry((current) => ({
        ...current,
        geolocationStatus: "unsupported",
        geolocationError:
          "La géolocalisation n'est pas prise en charge par ce navigateur.",
      }));
      return;
    }

    watchPositionRef.current = watchId;
  }, [applyUserLocation]);

  const requestLocation = useCallback(
    async (centerAfterResolve = true) => {
      setTelemetry((current) => ({
        ...current,
        geolocationStatus: "requesting",
        geolocationError: null,
      }));

      try {
        const position = await getCurrentUserPosition();
        const location = positionToGeoPoint(position);

        applyUserLocation(location, centerAfterResolve);
        startLivePositionWatch();
      } catch (error) {
        setTelemetry((current) => ({
          ...current,
          geolocationStatus: geolocationStatusFromError(error),
          geolocationError: geolocationMessageFromError(error),
        }));

        if (centerAfterResolve) {
          centerMapOn(PARIS_CENTER);
        }
      }
    },
    [applyUserLocation, centerMapOn, startLivePositionWatch],
  );

  useEffect(() => {
    if (initialLocationRequestRef.current) {
      return;
    }

    initialLocationRequestRef.current = true;
    void requestLocation(true);
  }, [requestLocation]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      antialias: true,
      attributionControl: false,
      bearing: DEFAULT_BEARING,
      center: [PARIS_CENTER.longitude, PARIS_CENTER.latitude],
      container: mapContainerRef.current,
      pitch: DEFAULT_PITCH,
      style: OPENFREE_MAP_STYLE,
      zoom: DEFAULT_ZOOM,
    });

    mapRef.current = map;
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      "bottom-right",
    );

    const handleMapUpdate = () => updateTelemetryFromMap(map);

    map.on("load", () => {
      addOpenTopographyOverlay(map);
      addOpenBuildings(map);
      setMapReady(true);
      updateTelemetryFromMap(map);
      void refreshElevation(PARIS_CENTER, "center");
    });

    map.on("move", handleMapUpdate);
    map.on("moveend", () => {
      const center = map.getCenter();
      void refreshElevation(
        {
          latitude: center.lat,
          longitude: center.lng,
        },
        "center",
      );
    });

    return () => {
      centerElevationAbortRef.current?.abort();
      userElevationAbortRef.current?.abort();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [refreshElevation, updateTelemetryFromMap]);

  useEffect(() => {
    if (
      mapReady &&
      telemetry.userLocation &&
      !centeredOnUserRef.current
    ) {
      centeredOnUserRef.current = true;
      setUserMarker(telemetry.userLocation);
      centerMapOn(telemetry.userLocation);
    }
  }, [centerMapOn, mapReady, setUserMarker, telemetry.userLocation]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
      window.setTimeout(() => mapRef.current?.resize(), 80);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearUserPositionWatch(watchPositionRef.current);
      watchPositionRef.current = null;
    };
  }, []);

  const handleTerrainToggle = () => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    setTelemetry((current) => {
      const nextValue = !current.terrainEnabled;

      if (nextValue) {
        addOpenTopographyOverlay(map);
      } else {
        removeOpenTopographyOverlay(map);
      }

      return {
        ...current,
        terrainEnabled: nextValue,
      };
    });
  };

  const handleBuildingsToggle = () => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    setTelemetry((current) => {
      const nextValue = !current.buildingsEnabled;
      setOpenBuildingsVisibility(map, nextValue);

      return {
        ...current,
        buildingsEnabled: nextValue,
      };
    });
  };

  const handleFullscreenToggle = async () => {
    const shell = shellRef.current;

    if (!shell) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await shell.requestFullscreen();
      }

      mapRef.current?.resize();
    } catch {
      setTelemetry((current) => ({
        ...current,
        geolocationError: "Le mode plein écran est indisponible.",
      }));
    }
  };

  return (
    <main className="scan-app" ref={shellRef}>
      <section className="map-stage" aria-label="Carte topographique 3D">
        <div className="map-container" ref={mapContainerRef} />
        <div className="scan-vignette" />
        <RadarOverlay />
        <div className="scanner-frame" aria-hidden="true">
          <span className="scanner-frame__corner scanner-frame__corner--tl" />
          <span className="scanner-frame__corner scanner-frame__corner--tr" />
          <span className="scanner-frame__corner scanner-frame__corner--br" />
          <span className="scanner-frame__corner scanner-frame__corner--bl" />
          <span className="scanner-frame__rail scanner-frame__rail--left" />
          <span className="scanner-frame__rail scanner-frame__rail--right" />
        </div>
      </section>

      <header className="scan-topbar">
        <div className="scan-topbar__mark">OR</div>
        <div className="scan-topbar__title">
          <h1>ORRA Scan</h1>
          <p>GPS topographique mondial • relief 3D live</p>
        </div>
      </header>

      <div className="panel-stack">
        <InfoPanel telemetry={telemetry} />
        <ControlPanel
          terrainEnabled={telemetry.terrainEnabled}
          buildingsEnabled={telemetry.buildingsEnabled}
          isFullscreen={isFullscreen}
          mapReady={mapReady}
          geolocationStatus={telemetry.geolocationStatus}
          onLocate={() => void requestLocation(true)}
          onToggleTerrain={handleTerrainToggle}
          onToggleBuildings={handleBuildingsToggle}
          onToggleFullscreen={() => void handleFullscreenToggle()}
        />
      </div>
    </main>
  );
}
