"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { ControlPanel } from "@/components/ControlPanel";
import { InfoPanel } from "@/components/InfoPanel";
import { RadarOverlay } from "@/components/RadarOverlay";
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
  addBuildings,
  addTerrain,
  hasMapboxToken,
  MAPBOX_STYLE,
  MAPBOX_TOKEN,
  removeTerrain,
  setBuildingsVisibility,
} from "@/lib/mapbox";
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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const watchPositionRef = useRef<number | null>(null);
  const centeredOnUserRef = useRef(false);
  const initialLocationRequestRef = useRef(false);
  const [telemetry, setTelemetry] = useState<MapTelemetry>(initialTelemetry);
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const tokenReady = useMemo(() => hasMapboxToken(), []);

  const updateTelemetryFromMap = useCallback((map: mapboxgl.Map) => {
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

      markerRef.current = new mapboxgl.Marker({
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

  const applyUserLocation = useCallback(
    (location: GeoPoint, centerAfterResolve: boolean) => {
      setTelemetry((current) => ({
        ...current,
        userLocation: location,
        geolocationStatus: "granted",
        geolocationError: null,
      }));
      setUserMarker(location);

      if (centerAfterResolve) {
        centeredOnUserRef.current = centerMapOn(location);
      }
    },
    [centerMapOn, setUserMarker],
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
    if (!tokenReady || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      antialias: true,
      attributionControl: false,
      bearing: DEFAULT_BEARING,
      center: [PARIS_CENTER.longitude, PARIS_CENTER.latitude],
      container: mapContainerRef.current,
      pitch: DEFAULT_PITCH,
      style: MAPBOX_STYLE,
      zoom: DEFAULT_ZOOM,
    });

    mapRef.current = map;
    map.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
      }),
      "bottom-right",
    );

    const handleMapUpdate = () => updateTelemetryFromMap(map);

    map.on("load", () => {
      addTerrain(map);
      addBuildings(map);
      setMapReady(true);
      updateTelemetryFromMap(map);
    });

    map.on("move", handleMapUpdate);

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [tokenReady, updateTelemetryFromMap]);

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
        addTerrain(map);
      } else {
        removeTerrain(map);
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
      setBuildingsVisibility(map, nextValue);

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
        {tokenReady ? (
          <div className="map-container" ref={mapContainerRef} />
        ) : (
          <div className="token-fallback" role="alert">
            <div className="token-fallback__panel">
              <p className="token-fallback__label">Configuration requise</p>
              <h1>Token Mapbox manquant</h1>
              <p>
                Ajoutez <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> dans un fichier{" "}
                <code>.env.local</code>, puis relancez <code>npm run dev</code>.
              </p>
            </div>
          </div>
        )}
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
