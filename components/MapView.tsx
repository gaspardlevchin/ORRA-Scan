"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/ControlPanel";
import { InfoPanel } from "@/components/InfoPanel";
import { RadarOverlay } from "@/components/RadarOverlay";
import { SearchPanel } from "@/components/SearchPanel";
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
  clearRouteOverlay,
  OPENFREE_MAP_STYLE,
  removeOpenTopographyOverlay,
  setRouteOverlay,
  setOpenBuildingsVisibility,
} from "@/lib/open-maps";
import { getOpenRoute, splitRouteAtPoint } from "@/lib/routing";
import { searchOpenPlaces } from "@/lib/search";
import type {
  GeoPoint,
  LngLatTuple,
  MapTelemetry,
  RouteState,
  SearchResult,
} from "@/types/map";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

type MapLibreRuntime = Pick<
  typeof import("maplibre-gl"),
  "AttributionControl" | "Map" | "Marker"
>;

type SearchStatus = "idle" | "searching" | "error";
type ViewMode = "topo" | "gps";
type OrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};
type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

const TOPO_ZOOM = 17.25;
const TOPO_PITCH = 76;
const GPS_OVERVIEW_ZOOM = 15.1;
const GPS_OVERVIEW_PITCH = 28;
const DEFAULT_BEARING = -28;
const INITIAL_ZOOM = 15.75;
const INITIAL_PITCH = 64;

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
  buildingsEnabled: true,
  geolocationStatus: "idle",
  geolocationError: null,
};

export function MapView() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const maplibreRef = useRef<MapLibreRuntime | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const destinationMarkerRef = useRef<MapLibreMarker | null>(null);
  const watchPositionRef = useRef<number | null>(null);
  const centerElevationAbortRef = useRef<AbortController | null>(null);
  const userElevationAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const centerElevationTimerRef = useRef<number | null>(null);
  const initialOverlayTimerRef = useRef<number | null>(null);
  const routeCoordinatesRef = useRef<LngLatTuple[]>([]);
  const currentViewModeRef = useRef<ViewMode>("topo");
  const topoTrackingRef = useRef(true);
  const orientationEnabledRef = useRef(false);
  const deviceHeadingRef = useRef<number | null>(null);
  const orientationFrameRef = useRef<number | null>(null);
  const orientationHandlerRef = useRef<
    ((event: DeviceOrientationEvent) => void) | null
  >(null);
  const centeredOnUserRef = useRef(false);
  const initialLocationRequestRef = useRef(false);
  const mapReadyRef = useRef(false);
  const userLocationRef = useRef<GeoPoint | null>(null);
  const [telemetry, setTelemetry] = useState<MapTelemetry>(initialTelemetry);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("topo");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [routeState, setRouteState] = useState<RouteState | null>(null);

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
      })
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);
      return;
    }

    markerRef.current.setLngLat([location.longitude, location.latitude]);
  }, []);

  const setDestinationMarker = useCallback((result: SearchResult) => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;

    if (!map || !maplibre) {
      return;
    }

    if (!destinationMarkerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.className = "destination-marker";

      destinationMarkerRef.current = new maplibre.Marker({
        anchor: "center",
        element: markerElement,
      })
        .setLngLat([result.longitude, result.latitude])
        .addTo(map);
      return;
    }

    destinationMarkerRef.current.setLngLat([result.longitude, result.latitude]);
  }, []);

  const updateRouteOverlay = useCallback(
    (coordinates: LngLatTuple[], userLocation: GeoPoint | null) => {
      const map = mapRef.current;

      if (!map || coordinates.length < 2) {
        return;
      }

      setRouteOverlay(map, splitRouteAtPoint(coordinates, userLocation));
    },
    [],
  );

  const centerMapOn = useCallback((location: GeoPoint): boolean => {
    const map = mapRef.current;

    if (!map) {
      return false;
    }

    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: Math.max(map.getZoom(), TOPO_ZOOM),
      pitch: TOPO_PITCH,
      bearing:
        deviceHeadingRef.current ??
        (typeof location.heading === "number" ? location.heading : DEFAULT_BEARING),
      duration: 1400,
      essential: true,
    });

    return true;
  }, []);

  const centerGpsOverviewOn = useCallback((location: GeoPoint): boolean => {
    const map = mapRef.current;

    if (!map) {
      return false;
    }

    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: GPS_OVERVIEW_ZOOM,
      pitch: GPS_OVERVIEW_PITCH,
      bearing: 0,
      duration: 1100,
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
      if (routeCoordinatesRef.current.length >= 2) {
        updateRouteOverlay(routeCoordinatesRef.current, location);
      }
      void refreshElevation(location, "user");

      if (
        topoTrackingRef.current &&
        mapReadyRef.current &&
        currentViewModeRef.current === "topo"
      ) {
        centeredOnUserRef.current = centerMapOn(location);
      } else if (centerAfterResolve) {
        centeredOnUserRef.current = mapReadyRef.current
          ? centerMapOn(location)
          : false;
      }
    },
    [centerMapOn, refreshElevation, setUserMarker, updateRouteOverlay],
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
    async (centerAfterResolve = true): Promise<GeoPoint | null> => {
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
        return location;
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

        return userLocationRef.current;
      }
    },
    [applyUserLocation, centerFallbackMapOn, startLivePositionWatch],
  );

  const startDeviceOrientation = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("DeviceOrientationEvent" in window) ||
      orientationEnabledRef.current
    ) {
      return;
    }

    try {
      const OrientationEventConstructor =
        (window as unknown as {
          DeviceOrientationEvent: DeviceOrientationEventConstructor;
        }).DeviceOrientationEvent;

      if (OrientationEventConstructor.requestPermission) {
        const permission = await OrientationEventConstructor.requestPermission();

        if (permission !== "granted") {
          setTelemetry((current) => ({
            ...current,
            geolocationError:
              "Orientation appareil indisponible. Navigation topo en mode manuel.",
          }));
          return;
        }
      }

      const handleOrientation = (event: DeviceOrientationEvent) => {
        const compassEvent = event as OrientationEventWithCompass;
        const heading =
          typeof compassEvent.webkitCompassHeading === "number"
            ? compassEvent.webkitCompassHeading
            : typeof compassEvent.alpha === "number"
              ? 360 - compassEvent.alpha
              : null;

        if (heading === null) {
          return;
        }

        deviceHeadingRef.current = heading;

        if (
          !topoTrackingRef.current ||
          currentViewModeRef.current !== "topo" ||
          orientationFrameRef.current !== null
        ) {
          return;
        }

        orientationFrameRef.current = window.requestAnimationFrame(() => {
          orientationFrameRef.current = null;
          mapRef.current?.easeTo({
            bearing: heading,
            duration: 120,
            essential: true,
          });
        });
      };

      window.addEventListener("deviceorientation", handleOrientation, true);
      orientationHandlerRef.current = handleOrientation;
      orientationEnabledRef.current = true;
    } catch {
      setTelemetry((current) => ({
        ...current,
        geolocationError:
          "Orientation appareil indisponible. Navigation topo en mode manuel.",
      }));
    }
  }, []);

  useEffect(() => {
    currentViewModeRef.current = viewMode;
  }, [viewMode]);

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
        if (!browserSupportsWebGL()) {
          setMapError("WebGL indisponible sur ce navigateur.");
          return;
        }

        const maplibre: MapLibreRuntime = await import("maplibre-gl");

        if (cancelled || !mapContainerRef.current) {
          return;
        }

        maplibreRef.current = maplibre;

        const map = new maplibre.Map({
          attributionControl: false,
          bearing: DEFAULT_BEARING,
          center: [PARIS_CENTER.longitude, PARIS_CENTER.latitude],
          container: mapContainerRef.current,
          fadeDuration: 0,
          maxPitch: 85,
          maxZoom: 18.5,
          minZoom: 2,
          pitch: INITIAL_PITCH,
          style: OPENFREE_MAP_STYLE,
          zoom: INITIAL_ZOOM,
        });

        activeMap = map;
        mapRef.current = map;
        map.boxZoom.enable();
        map.dragPan.enable();
        map.dragRotate.enable();
        map.doubleClickZoom.enable();
        map.scrollZoom.enable();
        map.touchZoomRotate.enableRotation();
        map.keyboard.enable();

        map.addControl(
          new maplibre.AttributionControl({
            compact: true,
          }),
          "bottom-right",
        );

        const handleMapUpdate = () => updateTelemetryFromMap(map);
        const enableInitialOverlays = () => {
          if (mapRef.current !== map) {
            return;
          }

          if (initialTelemetry.terrainEnabled) {
            addOpenTopographyOverlay(map);
          }

          setOpenBuildingsVisibility(map, initialTelemetry.buildingsEnabled);
        };

        map.on("load", () => {
          mapReadyRef.current = true;
          setMapReady(true);
          updateTelemetryFromMap(map);
          void refreshElevation(PARIS_CENTER, "center");

          initialOverlayTimerRef.current = window.setTimeout(() => {
            initialOverlayTimerRef.current = null;
            enableInitialOverlays();
          }, 500);
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
        map.on("dragstart", () => {
          topoTrackingRef.current = false;
        });
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
      if (initialOverlayTimerRef.current !== null) {
        window.clearTimeout(initialOverlayTimerRef.current);
        initialOverlayTimerRef.current = null;
      }
      centerElevationAbortRef.current?.abort();
      userElevationAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      routeAbortRef.current?.abort();
      if (orientationFrameRef.current !== null) {
        window.cancelAnimationFrame(orientationFrameRef.current);
      }
      if (orientationHandlerRef.current) {
        window.removeEventListener(
          "deviceorientation",
          orientationHandlerRef.current,
          true,
        );
        orientationHandlerRef.current = null;
      }
      if (activeMap) {
        clearRouteOverlay(activeMap);
      }
      markerRef.current?.remove();
      markerRef.current = null;
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
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

  const handleGpsOverview = async () => {
    topoTrackingRef.current = false;
    currentViewModeRef.current = "gps";
    setViewMode("gps");

    const location = userLocationRef.current ?? (await requestLocation(false));

    if (location) {
      setUserMarker(location);
      centeredOnUserRef.current = centerGpsOverviewOn(location);
      return;
    }

    centerFallbackMapOn(PARIS_CENTER);
  };

  const handleSearchSubmit = async () => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      return;
    }

    searchAbortRef.current?.abort();
    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    setSearchStatus("searching");

    try {
      const results = await searchOpenPlaces(query, abortController.signal);

      setSearchResults(results);
      setSearchStatus("idle");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setSearchStatus("error");
    }
  };

  const handleSearchResultSelect = async (result: SearchResult) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    routeAbortRef.current?.abort();
    const abortController = new AbortController();
    routeAbortRef.current = abortController;
    setSearchResults([]);
    setSearchQuery(result.label);
    setDestinationMarker(result);

    const center = map.getCenter();
    const origin =
      userLocationRef.current ??
      ({
        latitude: center.lat,
        longitude: center.lng,
      } satisfies { latitude: number; longitude: number });

    setRouteState({
      destination: result,
      coordinates: [],
      metrics: {
        routeDistanceMeters: null,
        linearDistanceMeters: 0,
        durationSeconds: null,
      },
      status: "loading",
      message: null,
    });

    try {
      const route = await getOpenRoute(origin, result, abortController.signal);

      routeCoordinatesRef.current = route.coordinates;
      updateRouteOverlay(route.coordinates, userLocationRef.current);
      setRouteState({
        destination: result,
        coordinates: route.coordinates,
        metrics: route.metrics,
        status: route.message ? "error" : "ready",
        message: route.message,
      });

      const compactLayout = window.innerWidth < 760;

      map.fitBounds(
        [
          [origin.longitude, origin.latitude],
          [result.longitude, result.latitude],
        ],
        {
          bearing: currentViewModeRef.current === "gps" ? 0 : map.getBearing(),
          padding: compactLayout
            ? { bottom: 250, left: 28, right: 28, top: 136 }
            : { bottom: 190, left: 42, right: 360, top: 110 },
          pitch:
            currentViewModeRef.current === "topo"
              ? Math.max(map.getPitch(), 58)
              : GPS_OVERVIEW_PITCH,
          duration: 1100,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setRouteState((current) =>
        current
          ? {
              ...current,
              status: "error",
              message: "Impossible de calculer le trajet.",
            }
          : null,
      );
    }
  };

  const handleClearRoute = () => {
    routeAbortRef.current?.abort();
    routeCoordinatesRef.current = [];
    setRouteState(null);
    destinationMarkerRef.current?.remove();
    destinationMarkerRef.current = null;

    if (mapRef.current) {
      clearRouteOverlay(mapRef.current);
    }
  };

  const handleTerrainToggle = () => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    if (initialOverlayTimerRef.current !== null) {
      window.clearTimeout(initialOverlayTimerRef.current);
      initialOverlayTimerRef.current = null;
    }

    const shouldEnterTopo =
      !telemetry.terrainEnabled || currentViewModeRef.current !== "topo";

    if (shouldEnterTopo) {
      addOpenTopographyOverlay(map);
      topoTrackingRef.current = true;
      currentViewModeRef.current = "topo";
      setViewMode("topo");
      void startDeviceOrientation();

      if (userLocationRef.current) {
        centeredOnUserRef.current = centerMapOn(userLocationRef.current);
      } else {
        map.easeTo({
          bearing: deviceHeadingRef.current ?? map.getBearing() ?? DEFAULT_BEARING,
          pitch: TOPO_PITCH,
          zoom: Math.max(map.getZoom(), TOPO_ZOOM),
          duration: 900,
          essential: true,
        });
      }
    } else {
      topoTrackingRef.current = false;
      currentViewModeRef.current = "gps";
      setViewMode("gps");
      removeOpenTopographyOverlay(map);
    }

    setTelemetry((current) => ({
      ...current,
      terrainEnabled: shouldEnterTopo,
    }));
  };

  const handleBuildingsToggle = () => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    if (initialOverlayTimerRef.current !== null) {
      window.clearTimeout(initialOverlayTimerRef.current);
      initialOverlayTimerRef.current = null;
    }

    setTelemetry((current) => {
      const nextValue = !current.buildingsEnabled;
      setOpenBuildingsVisibility(map, nextValue);

      if (nextValue) {
        map.easeTo({
          bearing: map.getBearing() || DEFAULT_BEARING,
          pitch:
            currentViewModeRef.current === "topo"
              ? TOPO_PITCH
              : GPS_OVERVIEW_PITCH,
          zoom: Math.max(map.getZoom(), GPS_OVERVIEW_ZOOM),
          duration: 900,
          essential: true,
        });
      }

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
      </section>

      <SearchPanel
        query={searchQuery}
        results={searchResults}
        status={searchStatus}
        route={routeState}
        onQueryChange={setSearchQuery}
        onSubmit={() => void handleSearchSubmit()}
        onSelect={(result) => void handleSearchResultSelect(result)}
        onClearRoute={handleClearRoute}
      />

      <header className="scan-topbar" data-view-mode={viewMode}>
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
          topoModeActive={telemetry.terrainEnabled && viewMode === "topo"}
          buildingsEnabled={telemetry.buildingsEnabled}
          isFullscreen={isFullscreen}
          mapReady={mapReady}
          geolocationStatus={telemetry.geolocationStatus}
          onLocate={() => void handleGpsOverview()}
          onToggleTerrain={handleTerrainToggle}
          onToggleBuildings={handleBuildingsToggle}
          onToggleFullscreen={() => void handleFullscreenToggle()}
        />
      </div>

      <img className="orra-logo-fixed" src="ORRA_logo.svg" alt="ORRA" />
      <div className="splash-screen" aria-hidden="true">
        <img src="ORRA_logo.svg" alt="" />
      </div>
    </main>
  );
}

function browserSupportsWebGL(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");

    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}
