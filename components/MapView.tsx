"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  addOpenTopographyOverlay,
  OPENFREE_MAP_STYLE,
  removeOpenTopographyOverlay,
  setOpenBuildingsVisibility,
} from "@/lib/open-maps";
import type { GeoPoint, MapTelemetry } from "@/types/map";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

const USER_ZOOM = 16.35;
const USER_PITCH = 64;
const DEFAULT_BEARING = -24;
const INITIAL_ZOOM = 12.65;
const INITIAL_PITCH = 48;

const initialTelemetry: MapTelemetry = {
  center: {
    latitude: PARIS_CENTER.latitude,
    longitude: PARIS_CENTER.longitude,
  },
  userLocation: null,
  centerElevation: null,
  userElevation: null,
  zoom: INITIAL_ZOOM,
  pitch: INITIAL_PITCH,
  terrainEnabled: true,
  buildingsEnabled: false,
  geolocationStatus: "idle",
  geolocationError: null,
};

export function MapView() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const watchPositionRef = useRef<number | null>(null);
  const centerElevationAbortRef = useRef<AbortController | null>(null);
  const userElevationAbortRef = useRef<AbortController | null>(null);
  const centerElevationTimerRef = useRef<number | null>(null);
  const centeredOnUserRef = useRef(false);
  const initialLocationRequestRef = useRef(false);
  const mapReadyRef = useRef(false);
  const userLocationRef = useRef<GeoPoint | null>(null);
  const [telemetry, setTelemetry] = useState<MapTelemetry>(initialTelemetry);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateTelemetryFromMap = useCallback((map: MapLibreMap) => {
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
    const maplibre = maplibreRef.current;

    if (!map || !maplibre) {
      return;
    }

    if (!markerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.className = "user-marker";

      const pulseElement = document.createElement("span");
      pulseElement.className = "user-marker__pulse";
      markerElement.appendChild(pulseElement);

      markerRef.current = new maplibre.Marker({
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
      zoom: Math.max(map.getZoom(), USER_ZOOM),
      pitch: USER_PITCH,
      bearing:
        typeof location.heading === "number" ? location.heading : DEFAULT_BEARING,
      duration: 1400,
      essential: true,
    });

    return true;
  }, []);

  const centerFallbackMapOn = useCallback((location: GeoPoint): boolean => {
    const map = mapRef.current;

    if (!map) {
      return false;
    }

    map.easeTo({
      center: [location.longitude, location.latitude],
      zoom: INITIAL_ZOOM,
      pitch: INITIAL_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 900,
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
      userLocationRef.current = location;
      setTelemetry((current) => ({
        ...current,
        userLocation: location,
        geolocationStatus: "granted",
        geolocationError: null,
      }));
      setUserMarker(location);
      void refreshElevation(location, "user");

      if (centerAfterResolve) {
        centeredOnUserRef.current = mapReadyRef.current
          ? centerMapOn(location)
          : false;
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
        const nextStatus = geolocationStatusFromError(error);
        const nextMessage = geolocationMessageFromError(error);

        setTelemetry((current) => ({
          ...current,
          geolocationStatus:
            current.userLocation && nextStatus !== "denied"
              ? "granted"
              : nextStatus,
          geolocationError:
            current.userLocation && nextStatus !== "denied"
              ? `Dernière position conservée. ${nextMessage}`
              : nextMessage,
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
        startLivePositionWatch();
        const position = await getCurrentUserPosition();
        const location = positionToGeoPoint(position);

        applyUserLocation(location, centerAfterResolve);
      } catch (error) {
        const nextStatus = geolocationStatusFromError(error);
        const nextMessage = geolocationMessageFromError(error);
        const hasCachedLocation = userLocationRef.current !== null;

        setTelemetry((current) => ({
          ...current,
          geolocationStatus:
            current.userLocation && nextStatus !== "denied"
              ? "granted"
              : nextStatus,
          geolocationError:
            current.userLocation && nextStatus !== "denied"
              ? `Dernière position conservée. ${nextMessage}`
              : nextMessage,
        }));

        if (centerAfterResolve && !hasCachedLocation) {
          centerFallbackMapOn(PARIS_CENTER);
        }
      }
    },
    [applyUserLocation, centerFallbackMapOn, startLivePositionWatch],
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

    let cancelled = false;
    let activeMap: MapLibreMap | null = null;

    const loadMap = async () => {
      setMapError(null);

      try {
        const maplibre = await import("maplibre-gl");

        if (cancelled || !mapContainerRef.current) {
          return;
        }

        maplibreRef.current = maplibre;

        if (!maplibre.supported()) {
          setMapError("WebGL indisponible sur ce navigateur.");
          return;
        }

        const map = new maplibre.Map({
          attributionControl: false,
          bearing: DEFAULT_BEARING,
          center: [PARIS_CENTER.longitude, PARIS_CENTER.latitude],
          container: mapContainerRef.current,
          fadeDuration: 0,
          maxPitch: 72,
          maxZoom: 18.5,
          minZoom: 2,
          pitch: INITIAL_PITCH,
          style: OPENFREE_MAP_STYLE,
          zoom: INITIAL_ZOOM,
        });

        activeMap = map;
        mapRef.current = map;
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
        map.keyboard.enable();

        map.addControl(
          new maplibre.AttributionControl({
            compact: true,
          }),
          "bottom-right",
        );

        const handleMapUpdate = () => updateTelemetryFromMap(map);

        map.on("load", () => {
          if (initialTelemetry.terrainEnabled) {
            addOpenTopographyOverlay(map);
          }

          setOpenBuildingsVisibility(map, initialTelemetry.buildingsEnabled);
          mapReadyRef.current = true;
          setMapReady(true);
          updateTelemetryFromMap(map);
          void refreshElevation(PARIS_CENTER, "center");
        });

        map.on("error", (event) => {
          const mapErrorEvent = event as { error?: { message?: string } };
          const message = mapErrorEvent.error?.message ?? "";

          if (
            !mapReadyRef.current &&
            (message.includes("Failed to fetch") ||
              message.includes("NetworkError"))
          ) {
            setMapError("Source cartographique temporairement indisponible.");
          }
        });

        map.on("move", handleMapUpdate);
        map.on("moveend", () => {
          if (centerElevationTimerRef.current !== null) {
            window.clearTimeout(centerElevationTimerRef.current);
          }

          const center = map.getCenter();

          centerElevationTimerRef.current = window.setTimeout(() => {
            void refreshElevation(
              {
                latitude: center.lat,
                longitude: center.lng,
              },
              "center",
            );
          }, 700);
        });
      } catch {
        setMapError("Impossible de charger la carte.");
        setMapReady(false);
      }
    };

    void loadMap();

    return () => {
      cancelled = true;
      if (centerElevationTimerRef.current !== null) {
        window.clearTimeout(centerElevationTimerRef.current);
      }
      centerElevationAbortRef.current?.abort();
      userElevationAbortRef.current?.abort();
      markerRef.current?.remove();
      markerRef.current = null;
      activeMap?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      mapReadyRef.current = false;
      setMapReady(false);
    };
  }, [refreshElevation, updateTelemetryFromMap]);

  useEffect(() => {
    if (
      mapReady &&
      telemetry.userLocation &&
      !centeredOnUserRef.current
    ) {
      setUserMarker(telemetry.userLocation);
      centeredOnUserRef.current = centerMapOn(telemetry.userLocation);
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
        {mapError ? (
          <div className="map-fallback" role="status">
            <span>{mapError}</span>
          </div>
        ) : null}
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
        <div className="scan-topbar__mark">ORRA</div>
        <span
          className="scan-topbar__status"
          data-status={telemetry.geolocationStatus}
        >
          {telemetry.geolocationStatus === "granted" ? "GPS" : "IDLE"}
        </span>
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
