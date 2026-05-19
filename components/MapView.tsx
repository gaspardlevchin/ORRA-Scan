"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/ControlPanel";
import { InfoPanel } from "@/components/InfoPanel";
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
  clearDestinationPositionOverlay,
  clearRouteOverlay,
  OPENFREE_MAP_STYLE,
  setRouteOverlay,
  setDestinationPositionOverlay,
  setOpenBuildingsVisibility,
  setOpenStreetVisibility,
  setUserPositionOverlay,
  updateTopographyGrid,
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
import type { Map as MapLibreMap } from "maplibre-gl";

type MapLibreRuntime = Pick<
  typeof import("maplibre-gl"),
  "AttributionControl" | "Map"
>;

type SearchStatus = "idle" | "searching" | "error";
type ViewMode = "topo" | "gps";
type OrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};
type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

const TOPO_ZOOM = 17.45;
const TOPO_PITCH = 76;
const TOPO_MIN_PITCH = 66;
const TOPO_MAX_PITCH = 80;
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
  bearing: DEFAULT_BEARING,
  terrainEnabled: true,
  buildingsEnabled: true,
  roadsEnabled: true,
  geolocationStatus: "idle",
  geolocationError: null,
};

export function MapView() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const maplibreRef = useRef<MapLibreRuntime | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const watchPositionRef = useRef<number | null>(null);
  const centerElevationAbortRef = useRef<AbortController | null>(null);
  const userElevationAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const centerElevationTimerRef = useRef<number | null>(null);
  const initialOverlayTimerRef = useRef<number | null>(null);
  const deferredCenterTimersRef = useRef<number[]>([]);
  const routeCoordinatesRef = useRef<LngLatTuple[]>([]);
  const currentViewModeRef = useRef<ViewMode>("topo");
  const topoTrackingRef = useRef(true);
  const orientationEnabledRef = useRef(false);
  const deviceHeadingRef = useRef<number | null>(null);
  const orientationFrameRef = useRef<number | null>(null);
  const positionPulseFrameRef = useRef<number | null>(null);
  const positionPulseLastFrameRef = useRef(0);
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
      bearing: normalizeBearing(map.getBearing()),
    }));
  }, []);

  const setUserMarker = useCallback((location: GeoPoint) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    try {
      setUserPositionOverlay(map, location);
    } catch {
      // The style can still be settling while remote tiles load.
    }
  }, []);

  const setDestinationMarker = useCallback((result: SearchResult) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    try {
      setDestinationPositionOverlay(map, result);
    } catch {
      // Route selection will retry once the map finishes settling.
    }
  }, []);

  const updateRouteOverlay = useCallback(
    (coordinates: LngLatTuple[], userLocation: GeoPoint | null) => {
      const map = mapRef.current;

      if (!map || coordinates.length < 2) {
        return;
      }

      setRouteOverlay(map, splitRouteAtPoint(coordinates, userLocation));
      if (userLocation) {
        setUserPositionOverlay(map, userLocation);
      }
    },
    [],
  );

  const refreshTopographyGrid = useCallback((map: MapLibreMap) => {
    try {
      updateTopographyGrid(map, userLocationRef.current);
    } catch {
      // MapLibre may still be attaching the style; the next move/style event retries.
    }
  }, []);

  const startPositionPulse = useCallback(() => {
    if (positionPulseFrameRef.current !== null) {
      return;
    }

    const renderPulse = (timestamp: number) => {
      const map = mapRef.current;
      const location = userLocationRef.current;

      if (map && location && timestamp - positionPulseLastFrameRef.current > 80) {
        const pulse = (Math.sin(timestamp / 720) + 1) / 2;
        try {
          setUserPositionOverlay(map, location, pulse);
        } catch {
          // Wait for the next animation frame while the style is attaching.
        }
        positionPulseLastFrameRef.current = timestamp;
      }

      positionPulseFrameRef.current = window.requestAnimationFrame(renderPulse);
    };

    positionPulseFrameRef.current = window.requestAnimationFrame(renderPulse);
  }, []);

  const centerMapOn = useCallback((location: GeoPoint): boolean => {
    const map = mapRef.current;

    if (!map) {
      return false;
    }

    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: Math.max(map.getZoom(), TOPO_ZOOM),
      pitch: TOPO_PITCH,
      offset: topoCameraOffset(),
      bearing:
        deviceHeadingRef.current ??
        (typeof location.heading === "number" ? location.heading : DEFAULT_BEARING),
      duration: 1400,
      essential: true,
    });

    return true;
  }, []);

  const resetBearingNorth = useCallback(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    topoTrackingRef.current = false;
    map.easeTo({
      bearing: 0,
      duration: 520,
      essential: true,
    });
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
      startPositionPulse();
      if (routeCoordinatesRef.current.length >= 2) {
        updateRouteOverlay(routeCoordinatesRef.current, location);
      }
      void refreshElevation(location, "user");

      if (mapReadyRef.current && mapRef.current) {
        refreshTopographyGrid(mapRef.current);
      }

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
    [
      centerMapOn,
      refreshElevation,
      refreshTopographyGrid,
      setUserMarker,
      startPositionPulse,
      updateRouteOverlay,
    ],
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
          const map = mapRef.current;

          if (!map) {
            return;
          }

          map.easeTo({
            bearing: heading,
            pitch: pitchFromDeviceTilt(event.beta, map.getPitch()),
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
    let gestureChangeHandler: ((event: Event) => void) | null = null;
    let mapExperienceInitialized = false;

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
          maxPitch: TOPO_MAX_PITCH,
          maxZoom: 19.25,
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
        gestureChangeHandler = (event: Event) => {
          const gestureEvent = event as Event & { rotation?: number };

          if (typeof gestureEvent.rotation !== "number") {
            return;
          }

          event.preventDefault();
          topoTrackingRef.current = false;
          map.rotateTo(map.getBearing() + gestureEvent.rotation * 0.35, {
            duration: 0,
          });
        };
        const enableInitialOverlays = () => {
          if (mapRef.current !== map) {
            return;
          }

          refreshTopographyGrid(map);

          if (initialTelemetry.terrainEnabled) {
            addOpenTopographyOverlay(map);
            void startDeviceOrientation();
          }

          setOpenBuildingsVisibility(map, initialTelemetry.buildingsEnabled);
          setOpenStreetVisibility(map, initialTelemetry.roadsEnabled);
        };
        const centerLoadedUserLocation = () => {
          const location = userLocationRef.current;

          if (!location || centeredOnUserRef.current || mapRef.current !== map) {
            return;
          }

          setUserPositionOverlay(map, location);
          refreshTopographyGrid(map);
          centeredOnUserRef.current = centerMapOn(location);
        };
        const scheduleLoadedUserCenter = (delay: number) => {
          const timerId = window.setTimeout(() => {
            centerLoadedUserLocation();
          }, delay);

          deferredCenterTimersRef.current.push(timerId);
        };
        const initializeMapExperience = () => {
          if (mapExperienceInitialized || mapRef.current !== map) {
            return;
          }

          mapExperienceInitialized = true;
          mapReadyRef.current = true;
          setMapReady(true);
          updateTelemetryFromMap(map);
          void refreshElevation(PARIS_CENTER, "center");
          scheduleLoadedUserCenter(120);

          initialOverlayTimerRef.current = window.setTimeout(() => {
            initialOverlayTimerRef.current = null;
            enableInitialOverlays();
            scheduleLoadedUserCenter(160);
          }, 420);
        };

        map.on("styledata", initializeMapExperience);
        map.on("load", initializeMapExperience);

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
        map.getCanvasContainer().addEventListener(
          "gesturechange",
          gestureChangeHandler,
        );
        map.on("dragstart", () => {
          topoTrackingRef.current = false;
        });
        map.on("rotatestart", () => {
          topoTrackingRef.current = false;
        });
        map.on("pitchstart", () => {
          topoTrackingRef.current = false;
        });
        map.on("moveend", () => {
          if (centerElevationTimerRef.current !== null) {
            window.clearTimeout(centerElevationTimerRef.current);
          }

          const center = map.getCenter();
          refreshTopographyGrid(map);

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
      for (const timerId of deferredCenterTimersRef.current) {
        window.clearTimeout(timerId);
      }
      deferredCenterTimersRef.current = [];
      centerElevationAbortRef.current?.abort();
      userElevationAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      routeAbortRef.current?.abort();
      if (orientationFrameRef.current !== null) {
        window.cancelAnimationFrame(orientationFrameRef.current);
      }
      if (positionPulseFrameRef.current !== null) {
        window.cancelAnimationFrame(positionPulseFrameRef.current);
        positionPulseFrameRef.current = null;
      }
      if (orientationHandlerRef.current) {
        window.removeEventListener(
          "deviceorientation",
          orientationHandlerRef.current,
          true,
        );
        orientationHandlerRef.current = null;
      }
      if (activeMap && gestureChangeHandler) {
        activeMap
          .getCanvasContainer()
          .removeEventListener("gesturechange", gestureChangeHandler);
      }
      if (activeMap) {
        clearDestinationPositionOverlay(activeMap);
        clearRouteOverlay(activeMap);
      }
      activeMap?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      mapReadyRef.current = false;
      setMapReady(false);
    };
  }, [
    refreshElevation,
    refreshTopographyGrid,
    startDeviceOrientation,
    updateTelemetryFromMap,
  ]);

  useEffect(() => {
    if (
      mapReady &&
      telemetry.userLocation &&
      !centeredOnUserRef.current
    ) {
      setUserMarker(telemetry.userLocation);
      startPositionPulse();
      if (mapRef.current) {
        refreshTopographyGrid(mapRef.current);
      }
      centeredOnUserRef.current = centerMapOn(telemetry.userLocation);
    }
  }, [
    centerMapOn,
    mapReady,
    refreshTopographyGrid,
    setUserMarker,
    startPositionPulse,
    telemetry.userLocation,
  ]);

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
      setDestinationMarker(result);
      setRouteState({
        destination: result,
        coordinates: route.coordinates,
        metrics: route.metrics,
        status: route.message ? "error" : "ready",
        message: route.message,
      });

      const compactLayout = window.innerWidth < 760;

      const routeBounds = getCoordinateBounds([
        [origin.longitude, origin.latitude],
        [result.longitude, result.latitude],
        ...route.coordinates,
      ]);

      if (routeBounds) {
        map.fitBounds(routeBounds, {
          bearing: currentViewModeRef.current === "gps" ? 0 : map.getBearing(),
          padding: compactLayout
            ? { bottom: 250, left: 28, right: 28, top: 136 }
            : { bottom: 190, left: 42, right: 360, top: 110 },
          pitch:
            currentViewModeRef.current === "topo"
              ? Math.max(map.getPitch(), 58)
              : GPS_OVERVIEW_PITCH,
          duration: 1100,
        });
      }
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

    if (mapRef.current) {
      clearDestinationPositionOverlay(mapRef.current);
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

    refreshTopographyGrid(map);
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
        offset: topoCameraOffset(),
        pitch: TOPO_PITCH,
        zoom: Math.max(map.getZoom(), TOPO_ZOOM),
        duration: 900,
        essential: true,
      });
    }

    setTelemetry((current) => ({
      ...current,
      terrainEnabled: true,
    }));
  };

  const handleRoadsToggle = () => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    setTelemetry((current) => {
      const nextValue = !current.roadsEnabled;

      setOpenStreetVisibility(map, nextValue);

      return {
        ...current,
        roadsEnabled: nextValue,
      };
    });
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

      <button
        className="compass-rose"
        type="button"
        onClick={resetBearingNorth}
        aria-label="Recaler la carte au nord"
        title="Nord"
      >
        <span className="compass-rose__corner compass-rose__corner--n">N</span>
        <span className="compass-rose__corner compass-rose__corner--e">E</span>
        <span className="compass-rose__corner compass-rose__corner--s">S</span>
        <span className="compass-rose__corner compass-rose__corner--w">W</span>
        <span
          className="compass-rose__needle"
          style={{ transform: `rotate(${-telemetry.bearing}deg)` }}
        />
      </button>

      <div className="panel-stack">
        <InfoPanel telemetry={telemetry} />
        <ControlPanel
          topoModeActive={telemetry.terrainEnabled && viewMode === "topo"}
          buildingsEnabled={telemetry.buildingsEnabled}
          roadsEnabled={telemetry.roadsEnabled}
          mapReady={mapReady}
          geolocationStatus={telemetry.geolocationStatus}
          onLocate={() => void handleGpsOverview()}
          onToggleTerrain={handleTerrainToggle}
          onToggleBuildings={handleBuildingsToggle}
          onToggleRoads={handleRoadsToggle}
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

function normalizeBearing(value: number): number {
  return ((value % 360) + 360) % 360;
}

function topoCameraOffset(): [number, number] {
  if (typeof window === "undefined") {
    return [0, 0];
  }

  return [0, Math.round(window.innerHeight * 0.12)];
}

function pitchFromDeviceTilt(
  beta: number | null | undefined,
  currentPitch: number,
): number {
  if (typeof beta !== "number") {
    return currentPitch;
  }

  const normalizedTilt = Math.min(Math.max((Math.abs(beta) - 20) / 56, 0), 1);

  return TOPO_MIN_PITCH + normalizedTilt * (TOPO_MAX_PITCH - TOPO_MIN_PITCH);
}

function getCoordinateBounds(
  coordinates: LngLatTuple[],
): [LngLatTuple, LngLatTuple] | null {
  if (coordinates.length === 0) {
    return null;
  }

  const bounds = coordinates.reduce(
    (current, coordinate) => ({
      west: Math.min(current.west, coordinate[0]),
      south: Math.min(current.south, coordinate[1]),
      east: Math.max(current.east, coordinate[0]),
      north: Math.max(current.north, coordinate[1]),
    }),
    {
      west: Number.POSITIVE_INFINITY,
      south: Number.POSITIVE_INFINITY,
      east: Number.NEGATIVE_INFINITY,
      north: Number.NEGATIVE_INFINITY,
    },
  );

  if (
    !Number.isFinite(bounds.west) ||
    !Number.isFinite(bounds.south) ||
    !Number.isFinite(bounds.east) ||
    !Number.isFinite(bounds.north)
  ) {
    return null;
  }

  const longitudePadding = Math.max((bounds.east - bounds.west) * 0.08, 0.001);
  const latitudePadding = Math.max((bounds.north - bounds.south) * 0.08, 0.001);

  return [
    [bounds.west - longitudePadding, bounds.south - latitudePadding],
    [bounds.east + longitudePadding, bounds.north + latitudePadding],
  ];
}
