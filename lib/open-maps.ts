import type {
  FillExtrusionLayerSpecification,
  Map,
  StyleSpecification,
} from "maplibre-gl";
import type { LngLatTuple } from "@/types/map";

type StyleSourceSpecification = NonNullable<StyleSpecification["sources"]>[string];

export const OPENMAPTILES_SOURCE_ID = "openmaptiles";
export const ORRA_TERRAIN_SOURCE_ID = "orra-terrain-dem";
export const ORRA_TERRAIN_LAYER_ID = "orra-terrain-shade";
export const ORRA_BUILDING_FOOTPRINT_LAYER_ID = "orra-building-footprint";
export const ORRA_BUILDINGS_LAYER_ID = "orra-open-buildings";
export const ORRA_TOPO_GRID_SOURCE_ID = "orra-topography-grid";
export const ORRA_TOPO_GRID_NEAR_LAYER_ID = "orra-topography-grid-near";
export const ORRA_TOPO_GRID_FAR_LAYER_ID = "orra-topography-grid-far";
export const ORRA_USER_POSITION_SOURCE_ID = "orra-user-position";
export const ORRA_USER_POSITION_HALO_LAYER_ID = "orra-user-position-halo";
export const ORRA_USER_POSITION_DOT_LAYER_ID = "orra-user-position-dot";
export const ORRA_DESTINATION_SOURCE_ID = "orra-destination-position";
export const ORRA_DESTINATION_DOT_LAYER_ID = "orra-destination-position-dot";
export const ORRA_ROUTE_SOURCE_ID = "orra-route";
export const ORRA_ROUTE_TRAVELED_LAYER_ID = "orra-route-traveled";
export const ORRA_ROUTE_AHEAD_LAYER_ID = "orra-route-ahead";

const BUILDING_SOURCE_LAYER = "building";
const BUILDING_SOURCE_LAYER_NAMES = ["building", "buildings"];
const ORRA_LAYER_PREFIX = "orra-";

export const OPENFREE_MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/dark";

export function addOpenTopographyOverlay(map: Map): void {
  ensureOpenTerrainOverlay(map);

  if (map.getSource(ORRA_TERRAIN_SOURCE_ID)) {
    map.setTerrain({
      source: ORRA_TERRAIN_SOURCE_ID,
      exaggeration: 1.85,
    });
  }

  setLayerVisibility(map, ORRA_TERRAIN_LAYER_ID, true);
  setTopographyGridVisibility(map, true);
}

export function removeOpenTopographyOverlay(map: Map): void {
  map.setTerrain(null);
  setLayerVisibility(map, ORRA_TERRAIN_LAYER_ID, false);
  setTopographyGridVisibility(map, false);
}

export function setOpenStreetVisibility(map: Map, visible: boolean): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (isOrraLayer(layer.id) || !isStreetLikeLayer(layer.id)) {
      continue;
    }

    setLayerVisibility(map, layer.id, visible);
  }
}

export function applyOrraBaseStyle(map: Map): void {
  ensureOpenTerrainOverlay(map);

  for (const layer of map.getStyle().layers ?? []) {
    if (isOrraLayer(layer.id)) {
      continue;
    }

    if (layer.type === "symbol") {
      setLayerVisibility(map, layer.id, false);
      setPaintProperty(map, layer.id, "text-opacity", 0);
      setPaintProperty(map, layer.id, "icon-opacity", 0);
      continue;
    }

    if (layer.type === "line" && isStreetLikeLayer(layer.id)) {
      setPaintProperty(map, layer.id, "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        6,
        "#171819",
        12,
        "#343536",
        17,
        "#686868",
      ]);
      setPaintProperty(map, layer.id, "line-opacity", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.14,
        13,
        0.58,
        18,
        0.74,
      ]);
    }

    if (layer.type === "background") {
      setPaintProperty(map, layer.id, "background-color", "#030303");
    }

    if (layer.type === "fill" && layer.id.toLowerCase().includes("water")) {
      setPaintProperty(map, layer.id, "fill-color", "#050607");
      setPaintProperty(map, layer.id, "fill-opacity", 0.88);
    }
  }
}

export function ensureOpenTerrainOverlay(map: Map): void {
  if (!map.getSource(ORRA_TERRAIN_SOURCE_ID)) {
    map.addSource(ORRA_TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 14,
      encoding: "terrarium",
      attribution:
        'Terrain tiles by <a href="https://github.com/tilezen/joerd">Mapzen</a>',
    } satisfies StyleSourceSpecification);
  }

  if (!map.getLayer(ORRA_TERRAIN_LAYER_ID)) {
    map.addLayer(
      {
        id: ORRA_TERRAIN_LAYER_ID,
        type: "hillshade",
        source: ORRA_TERRAIN_SOURCE_ID,
        layout: {
          visibility: "none",
        },
        paint: {
          "hillshade-shadow-color": "#000000",
          "hillshade-highlight-color": "#efe9df",
          "hillshade-accent-color": "#8f8b85",
          "hillshade-exaggeration": 1.18,
        },
      },
      firstBuildingOrSymbolLayerId(map),
    );
  }
}

export function addOpenBuildings(map: Map): void {
  if (map.getLayer(ORRA_BUILDINGS_LAYER_ID)) {
    setOpenBuildingsVisibility(map, true);
    return;
  }

  const buildingSource = findBuildingSource(map);

  if (!buildingSource) {
    showExistingBuildingLayers(map, true);
    return;
  }

  const buildingLayer: FillExtrusionLayerSpecification = {
    id: ORRA_BUILDINGS_LAYER_ID,
    type: "fill-extrusion",
    source: buildingSource.sourceId,
    "source-layer": buildingSource.sourceLayer,
    minzoom: 14.2,
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], ["get", "height"], 0],
        0,
        "#151617",
        60,
        "#666768",
        160,
        "#d7cec2",
      ],
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        15.2,
        [
          "*",
          ["coalesce", ["get", "render_height"], ["get", "height"], 12],
          0.86,
        ],
      ],
      "fill-extrusion-base": [
        "coalesce",
        ["get", "render_min_height"],
        ["get", "min_height"],
        0,
      ],
      "fill-extrusion-opacity": 0.86,
      "fill-extrusion-vertical-gradient": true,
    },
  };

  try {
    map.addLayer(buildingLayer, firstSymbolLayerId(map));
  } catch {
    showExistingBuildingLayers(map, true);
  }
}

export function setOpenBuildingsVisibility(map: Map, visible: boolean): void {
  try {
    if (!map.getLayer(ORRA_BUILDINGS_LAYER_ID) && visible) {
      addOpenBuildings(map);
    }

    setLayerVisibility(map, ORRA_BUILDING_FOOTPRINT_LAYER_ID, visible);
    setLayerVisibility(map, ORRA_BUILDINGS_LAYER_ID, visible);
    showExistingBuildingLayers(map, visible);
  } catch {
    showExistingBuildingLayers(map, visible);
  }
}

function setLayerVisibility(map: Map, layerId: string, visible: boolean): void {
  if (map.getLayer(layerId)) {
    try {
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    } catch {
      // The remote style can replace layers while its tiles are still settling.
    }
  }
}

function showExistingBuildingLayers(map: Map, visible: boolean): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (
      layer.id !== ORRA_BUILDINGS_LAYER_ID &&
      layer.id !== ORRA_BUILDING_FOOTPRINT_LAYER_ID &&
      (layer.type === "fill-extrusion" ||
        layer.id.toLowerCase().includes("building"))
    ) {
      setLayerVisibility(map, layer.id, visible);
    }
  }
}

function findBuildingSource(
  map: Map,
): { sourceId: string; sourceLayer: string } | null {
  if (map.getSource(OPENMAPTILES_SOURCE_ID)) {
    return {
      sourceId: OPENMAPTILES_SOURCE_ID,
      sourceLayer: BUILDING_SOURCE_LAYER,
    };
  }

  const layers = map.getStyle().layers ?? [];

  for (const layer of layers) {
    const sourceLayer =
      "source-layer" in layer && typeof layer["source-layer"] === "string"
        ? layer["source-layer"]
        : null;

    const source =
      "source" in layer && typeof layer.source === "string" ? layer.source : null;

    if (
      source &&
      sourceLayer &&
      BUILDING_SOURCE_LAYER_NAMES.some((name) =>
        sourceLayer.toLowerCase().includes(name),
      )
    ) {
      return {
        sourceId: source,
        sourceLayer,
      };
    }
  }

  return null;
}

function firstSymbolLayerId(map: Map): string | undefined {
  return (map.getStyle().layers ?? []).find((layer) => layer.type === "symbol")
    ?.id;
}

function firstBuildingOrSymbolLayerId(map: Map): string | undefined {
  return (map.getStyle().layers ?? []).find(
    (layer) =>
      layer.id.toLowerCase().includes("building") || layer.type === "symbol",
  )?.id;
}

function setPaintProperty(
  map: Map,
  layerId: string,
  property: string,
  value: unknown,
): void {
  try {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, property, value);
    }
  } catch {
    // Some official style layers do not support every paint property variant.
  }
}

function isOrraLayer(layerId: string): boolean {
  return layerId.startsWith(ORRA_LAYER_PREFIX);
}

function isStreetLikeLayer(layerId: string): boolean {
  const id = layerId.toLowerCase();

  return (
    id.includes("road") ||
    id.includes("street") ||
    id.includes("highway") ||
    id.includes("transport") ||
    id.includes("path") ||
    id.includes("track") ||
    id.includes("bridge") ||
    id.includes("tunnel") ||
    id.includes("rail") ||
    id.includes("ferry") ||
    id.includes("aeroway") ||
    id.includes("waterway") ||
    id.includes("boundary")
  );
}

type TopographyGridGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      proximity: "near" | "far";
    };
    geometry: {
      type: "LineString";
      coordinates: LngLatTuple[];
    };
  }>;
};

type PositionGeoJson = {
  type: "FeatureCollection";
  features: Array<
    | {
        type: "Feature";
        properties: {
          kind: "halo";
          pulse: number;
        };
        geometry: {
          type: "Point";
          coordinates: LngLatTuple;
        };
      }
    | {
        type: "Feature";
        properties: {
          kind: "dot";
          pulse: number;
        };
        geometry: {
          type: "Polygon";
          coordinates: LngLatTuple[][];
        };
      }
  >;
};

type RouteGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      segment: "traveled" | "ahead";
    };
    geometry: {
      type: "LineString";
      coordinates: LngLatTuple[];
    };
  }>;
};

export function updateTopographyGrid(
  map: Map,
  userLocation: { latitude: number; longitude: number } | null,
): void {
  const gridData = createTopographyGrid(map, userLocation);
  const existingSource = map.getSource(ORRA_TOPO_GRID_SOURCE_ID);
  const beforeLayerId = map.getLayer(ORRA_BUILDING_FOOTPRINT_LAYER_ID)
    ? ORRA_BUILDING_FOOTPRINT_LAYER_ID
    : undefined;

  if (isGeoJsonSource<TopographyGridGeoJson>(existingSource)) {
    existingSource.setData(gridData);
  } else {
    map.addSource(ORRA_TOPO_GRID_SOURCE_ID, {
      type: "geojson",
      data: gridData,
    } satisfies StyleSourceSpecification);
  }

  if (!map.getLayer(ORRA_TOPO_GRID_FAR_LAYER_ID)) {
    map.addLayer(
      {
        id: ORRA_TOPO_GRID_FAR_LAYER_ID,
        type: "line",
        source: ORRA_TOPO_GRID_SOURCE_ID,
        filter: ["==", ["get", "proximity"], "far"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#e26f22",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.24, 14, 0.62, 18, 0.9],
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.65, 14, 1.15, 18, 2.05],
          "line-blur": 0.04,
        },
      },
      beforeLayerId,
    );
  }

  if (!map.getLayer(ORRA_TOPO_GRID_NEAR_LAYER_ID)) {
    map.addLayer(
      {
        id: ORRA_TOPO_GRID_NEAR_LAYER_ID,
        type: "line",
        source: ORRA_TOPO_GRID_SOURCE_ID,
        filter: ["==", ["get", "proximity"], "near"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#fffaf0",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.42, 18, 0.96],
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.1, 18, 3],
          "line-blur": 0.16,
        },
      },
      beforeLayerId,
    );
  }
}

export function setUserPositionOverlay(
  map: Map,
  location: { latitude: number; longitude: number },
  pulse = 0,
): void {
  setPositionOverlay({
    color: "#fffaf0",
    haloColor: "#e26f22",
    layerId: ORRA_USER_POSITION_DOT_LAYER_ID,
    haloLayerId: ORRA_USER_POSITION_HALO_LAYER_ID,
    map,
    radiusMeters: 4.2,
    sourceId: ORRA_USER_POSITION_SOURCE_ID,
    extrusionHeight: 2.8,
    location,
    pulse,
  });
}

export function setDestinationPositionOverlay(
  map: Map,
  location: { latitude: number; longitude: number },
): void {
  setPositionOverlay({
    color: "#e26f22",
    haloColor: "#fffaf0",
    layerId: ORRA_DESTINATION_DOT_LAYER_ID,
    map,
    radiusMeters: 5.4,
    sourceId: ORRA_DESTINATION_SOURCE_ID,
    extrusionHeight: 3.2,
    location,
    pulse: 0.28,
  });
}

export function clearDestinationPositionOverlay(map: Map): void {
  if (map.getLayer(ORRA_DESTINATION_DOT_LAYER_ID)) {
    map.removeLayer(ORRA_DESTINATION_DOT_LAYER_ID);
  }

  if (map.getSource(ORRA_DESTINATION_SOURCE_ID)) {
    map.removeSource(ORRA_DESTINATION_SOURCE_ID);
  }
}

export function setRouteOverlay(
  map: Map,
  route: { traveled: LngLatTuple[]; ahead: LngLatTuple[] },
): void {
  const routeData = createRouteFeatureCollection(route);
  const existingSource = map.getSource(ORRA_ROUTE_SOURCE_ID);

  if (isGeoJsonSource<RouteGeoJson>(existingSource)) {
    existingSource.setData(routeData);
  } else {
    map.addSource(ORRA_ROUTE_SOURCE_ID, {
      type: "geojson",
      data: routeData,
    } satisfies StyleSourceSpecification);
  }

  if (!map.getLayer(ORRA_ROUTE_TRAVELED_LAYER_ID)) {
    map.addLayer({
      id: ORRA_ROUTE_TRAVELED_LAYER_ID,
      type: "line",
      source: ORRA_ROUTE_SOURCE_ID,
      filter: ["==", ["get", "segment"], "traveled"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#fffaf0",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 17, 12],
        "line-opacity": 0.96,
        "line-blur": 0.35,
      },
    });
  }

  if (!map.getLayer(ORRA_ROUTE_AHEAD_LAYER_ID)) {
    map.addLayer({
      id: ORRA_ROUTE_AHEAD_LAYER_ID,
      type: "line",
      source: ORRA_ROUTE_SOURCE_ID,
      filter: ["==", ["get", "segment"], "ahead"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 17, 12],
        "line-opacity": 0.9,
        "line-dasharray": [0.4, 1.15],
        "line-blur": 0.2,
      },
    });
  }
}

export function clearRouteOverlay(map: Map): void {
  for (const layerId of [
    ORRA_ROUTE_TRAVELED_LAYER_ID,
    ORRA_ROUTE_AHEAD_LAYER_ID,
  ]) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }

  if (map.getSource(ORRA_ROUTE_SOURCE_ID)) {
    map.removeSource(ORRA_ROUTE_SOURCE_ID);
  }
}

function setTopographyGridVisibility(map: Map, visible: boolean): void {
  setLayerVisibility(map, ORRA_TOPO_GRID_NEAR_LAYER_ID, visible);
  setLayerVisibility(map, ORRA_TOPO_GRID_FAR_LAYER_ID, visible);
}

function createTopographyGrid(
  map: Map,
  userLocation: { latitude: number; longitude: number } | null,
): TopographyGridGeoJson {
  const bounds = map.getBounds();
  const center = map.getCenter();
  const west = normalizeLongitude(bounds.getWest());
  const east = normalizeLongitude(bounds.getEast());
  const south = clampLatitude(bounds.getSouth());
  const north = clampLatitude(bounds.getNorth());
  const longitudeRange = normalizeLongitudeSpan(west, east);
  const baseSpacingMeters = gridSpacingMeters(map.getZoom());
  const spacingMeters = constrainedGridSpacing(
    baseSpacingMeters,
    Math.max(north - south, metersToLatitude(baseSpacingMeters * 8)),
    Math.max(longitudeRange, metersToLongitude(baseSpacingMeters * 8, center.lat)),
    center.lat,
  );
  const latitudeStep = metersToLatitude(spacingMeters);
  const longitudeStep = metersToLongitude(spacingMeters, center.lat);
  const userRadiusMeters = Math.max(spacingMeters * 2.25, 160);
  const latitudePadding = Math.max((north - south) * 0.32, latitudeStep * 5);
  const longitudePadding = Math.max(longitudeRange * 0.32, longitudeStep * 5);
  let minLatitude = clampLatitude(south - latitudePadding);
  let maxLatitude = clampLatitude(north + latitudePadding);
  let minLongitude = west - longitudePadding;
  let maxLongitude = west + longitudeRange + longitudePadding;

  if (userLocation) {
    const userCoverageMeters = Math.max(spacingMeters * 14, 1200);
    const userLatitudeCoverage = metersToLatitude(userCoverageMeters);
    const userLongitudeCoverage = metersToLongitude(
      userCoverageMeters,
      userLocation.latitude,
    );

    minLatitude = clampLatitude(
      Math.min(minLatitude, userLocation.latitude - userLatitudeCoverage),
    );
    maxLatitude = clampLatitude(
      Math.max(maxLatitude, userLocation.latitude + userLatitudeCoverage),
    );
    minLongitude = Math.min(
      minLongitude,
      userLocation.longitude - userLongitudeCoverage,
    );
    maxLongitude = Math.max(
      maxLongitude,
      userLocation.longitude + userLongitudeCoverage,
    );
  }
  const startLatitude = snapDown(minLatitude, latitudeStep);
  const startLongitude = snapDown(minLongitude, longitudeStep);
  const features: TopographyGridGeoJson["features"] = [];

  for (
    let latitude = startLatitude;
    latitude <= maxLatitude + latitudeStep;
    latitude += latitudeStep
  ) {
    for (
      let longitude = startLongitude;
      longitude <= maxLongitude + longitudeStep;
      longitude += longitudeStep
    ) {
      const from = normalizeLngLat([longitude, latitude]);
      const to = normalizeLngLat([
        Math.min(longitude + longitudeStep, maxLongitude),
        latitude,
      ]);
      const midpoint = normalizeLngLat([
        (longitude + Math.min(longitude + longitudeStep, maxLongitude)) / 2,
        latitude,
      ]);

      features.push(
        createGridSegment(from, to, midpoint, userLocation, userRadiusMeters),
      );
    }
  }

  for (
    let longitude = startLongitude;
    longitude <= maxLongitude + longitudeStep;
    longitude += longitudeStep
  ) {
    for (
      let latitude = startLatitude;
      latitude <= maxLatitude + latitudeStep;
      latitude += latitudeStep
    ) {
      const from = normalizeLngLat([longitude, latitude]);
      const to = normalizeLngLat([
        longitude,
        Math.min(latitude + latitudeStep, maxLatitude),
      ]);
      const midpoint = normalizeLngLat([
        longitude,
        (latitude + Math.min(latitude + latitudeStep, maxLatitude)) / 2,
      ]);

      features.push(
        createGridSegment(from, to, midpoint, userLocation, userRadiusMeters),
      );
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function gridSpacingMeters(zoom: number): number {
  if (zoom >= 17) {
    return 80;
  }

  if (zoom >= 15) {
    return 160;
  }

  if (zoom >= 13) {
    return 420;
  }

  if (zoom >= 11) {
    return 1200;
  }

  if (zoom >= 9) {
    return 4500;
  }

  if (zoom >= 7) {
    return 16000;
  }

  return 64000;
}

function constrainedGridSpacing(
  baseSpacingMeters: number,
  latitudeRangeDegrees: number,
  longitudeRangeDegrees: number,
  latitude: number,
): number {
  let spacingMeters = baseSpacingMeters;
  const maxSegments = 1800;

  while (
    estimatedGridSegments(
      spacingMeters,
      latitudeRangeDegrees,
      longitudeRangeDegrees,
      latitude,
    ) > maxSegments
  ) {
    spacingMeters *= 2;
  }

  return spacingMeters;
}

function estimatedGridSegments(
  spacingMeters: number,
  latitudeRangeDegrees: number,
  longitudeRangeDegrees: number,
  latitude: number,
): number {
  const latitudeMeters = latitudeRangeDegrees * 111320;
  const longitudeMeters =
    longitudeRangeDegrees *
    111320 *
    Math.max(Math.cos((latitude * Math.PI) / 180), 0.18);
  const rows = Math.ceil(latitudeMeters / spacingMeters) + 1;
  const columns = Math.ceil(longitudeMeters / spacingMeters) + 1;

  return rows * columns * 2;
}

function createGridSegment(
  from: LngLatTuple,
  to: LngLatTuple,
  midpoint: LngLatTuple,
  userLocation: { latitude: number; longitude: number } | null,
  userRadiusMeters: number,
): TopographyGridGeoJson["features"][number] {
  const proximity =
    userLocation &&
    distanceMeters(midpoint, [userLocation.longitude, userLocation.latitude]) <=
      userRadiusMeters
      ? "near"
      : "far";

  return {
    type: "Feature",
    properties: { proximity },
    geometry: {
      type: "LineString",
      coordinates: interpolateLine(from, to),
    },
  };
}

function interpolateLine(from: LngLatTuple, to: LngLatTuple): LngLatTuple[] {
  const steps = 48;

  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;

    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
    ];
  });
}

function metersToLatitude(meters: number): number {
  return meters / 111320;
}

function metersToLongitude(meters: number, latitude: number): number {
  const latitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.18);

  return meters / (111320 * latitudeScale);
}

function setPositionOverlay({
  color,
  extrusionHeight,
  haloColor,
  haloLayerId,
  layerId,
  location,
  map,
  pulse,
  radiusMeters,
  sourceId,
}: {
  color: string;
  extrusionHeight: number;
  haloColor: string;
  haloLayerId?: string;
  layerId: string;
  location: { latitude: number; longitude: number };
  map: Map;
  pulse: number;
  radiusMeters: number;
  sourceId: string;
}): void {
  const positionData = createPositionFeatureCollection(
    location,
    radiusMeters,
    pulse,
  );
  const existingSource = map.getSource(sourceId);

  if (isGeoJsonSource<PositionGeoJson>(existingSource)) {
    existingSource.setData(positionData);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data: positionData,
    } satisfies StyleSourceSpecification);
  }

  let shouldLiftLayers = pulse === 0;

  if (haloLayerId && !map.getLayer(haloLayerId)) {
    shouldLiftLayers = true;
    map.addLayer({
      id: haloLayerId,
      type: "circle",
      source: sourceId,
      filter: ["==", ["get", "kind"], "halo"],
      layout: {
        visibility: "visible",
      },
      paint: {
        "circle-color": haloColor,
        "circle-opacity": ["-", 0.3, ["*", ["get", "pulse"], 0.22]],
        "circle-pitch-alignment": "map",
        "circle-radius": [
          "+",
          ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 34],
          ["*", ["get", "pulse"], 22],
        ],
        "circle-stroke-color": haloColor,
        "circle-stroke-opacity": ["-", 0.42, ["*", ["get", "pulse"], 0.28]],
        "circle-stroke-width": 1.1,
      },
    });
  }

  if (!map.getLayer(layerId)) {
    shouldLiftLayers = true;
    map.addLayer({
      id: layerId,
      type: "fill-extrusion",
      source: sourceId,
      filter: ["==", ["get", "kind"], "dot"],
      paint: {
        "fill-extrusion-base": 0,
        "fill-extrusion-color": color,
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13,
          extrusionHeight * 0.38,
          18,
          extrusionHeight,
        ],
        "fill-extrusion-opacity": 0.96,
        "fill-extrusion-vertical-gradient": true,
      },
    });
  }

  if (shouldLiftLayers) {
    moveLayerToTop(map, haloLayerId);
    moveLayerToTop(map, layerId);
  }
}

function createPositionFeatureCollection(
  location: { latitude: number; longitude: number },
  radiusMeters: number,
  pulse: number,
): PositionGeoJson {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          kind: "halo",
          pulse,
        },
        geometry: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
      },
      {
        type: "Feature",
        properties: {
          kind: "dot",
          pulse,
        },
        geometry: {
          type: "Polygon",
          coordinates: [createCirclePolygon(location, radiusMeters)],
        },
      },
    ],
  };
}

function createCirclePolygon(
  center: { latitude: number; longitude: number },
  radiusMeters: number,
): LngLatTuple[] {
  const points: LngLatTuple[] = [];
  const steps = 36;

  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const latitudeOffset = metersToLatitude(Math.sin(angle) * radiusMeters);
    const longitudeOffset = metersToLongitude(
      Math.cos(angle) * radiusMeters,
      center.latitude,
    );

    points.push([
      center.longitude + longitudeOffset,
      center.latitude + latitudeOffset,
    ]);
  }

  return points;
}

function moveLayerToTop(map: Map, layerId: string | undefined): void {
  if (!layerId || !map.getLayer(layerId)) {
    return;
  }

  map.moveLayer(layerId);
}

function normalizeLngLat(coordinate: LngLatTuple): LngLatTuple {
  return [normalizeLongitude(coordinate[0]), clampLatitude(coordinate[1])];
}

function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function normalizeLongitudeSpan(west: number, east: number): number {
  return east >= west ? east - west : east + 360 - west;
}

function clampLatitude(latitude: number): number {
  return Math.max(Math.min(latitude, 84.5), -84.5);
}

function snapDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function distanceMeters(from: LngLatTuple, to: LngLatTuple): number {
  const meanLatitude = ((from[1] + to[1]) / 2) * (Math.PI / 180);
  const latitudeMeters = (to[1] - from[1]) * 111320;
  const longitudeMeters =
    normalizeLongitude(to[0] - from[0]) * 111320 * Math.cos(meanLatitude);

  return Math.hypot(latitudeMeters, longitudeMeters);
}

function createRouteFeatureCollection(route: {
  traveled: LngLatTuple[];
  ahead: LngLatTuple[];
}): RouteGeoJson {
  const features: RouteGeoJson["features"] = [];

  if (route.traveled.length >= 2) {
    features.push(createRouteFeature("traveled", route.traveled));
  }

  if (route.ahead.length >= 2) {
    features.push(createRouteFeature("ahead", route.ahead));
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function createRouteFeature(
  segment: "traveled" | "ahead",
  coordinates: LngLatTuple[],
): RouteGeoJson["features"][number] {
  return {
    type: "Feature",
    properties: {
      segment,
    },
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

function isGeoJsonSource<
  TData extends PositionGeoJson | RouteGeoJson | TopographyGridGeoJson,
>(
  source: unknown,
): source is { setData: (data: TData) => void } {
  return (
    typeof source === "object" &&
    source !== null &&
    "setData" in source &&
    typeof source.setData === "function"
  );
}
