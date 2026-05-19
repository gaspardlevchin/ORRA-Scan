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
export const ORRA_ROUTE_SOURCE_ID = "orra-route";
export const ORRA_ROUTE_TRAVELED_LAYER_ID = "orra-route-traveled";
export const ORRA_ROUTE_AHEAD_LAYER_ID = "orra-route-ahead";

const BUILDING_SOURCE_LAYER = "building";
const BUILDING_SOURCE_LAYER_NAMES = ["building", "buildings"];
const STREET_LAYER_IDS = [
  "waterway",
  "road-major",
  "road-secondary",
  "road-minor",
  "rail",
  "boundary",
];

export const OPENFREE_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "ORRA minimal dark",
  sources: {
    [OPENMAPTILES_SOURCE_ID]: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, tiles by <a href="https://openfreemap.org">OpenFreeMap</a>',
    },
    [ORRA_TERRAIN_SOURCE_ID]: {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 14,
      encoding: "terrarium",
      attribution:
        'Terrain tiles by <a href="https://github.com/tilezen/joerd">Mapzen</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#030303",
      },
    },
    {
      id: "landcover",
      type: "fill",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "ice",
          "#151719",
          "wood",
          "#090d0b",
          "grass",
          "#080a08",
          "sand",
          "#11100d",
          "#070707",
        ],
        "fill-opacity": 0.5,
      },
    },
    {
      id: "landuse-soft",
      type: "fill",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "landuse",
      minzoom: 9,
      paint: {
        "fill-color": "#080808",
        "fill-opacity": 0.42,
      },
    },
    {
      id: "water",
      type: "fill",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "water",
      paint: {
        "fill-color": "#05080a",
        "fill-opacity": 0.92,
      },
    },
    {
      id: ORRA_TERRAIN_LAYER_ID,
      type: "hillshade",
      source: ORRA_TERRAIN_SOURCE_ID,
      layout: {
        visibility: "none",
      },
      paint: {
        "hillshade-shadow-color": "#000000",
        "hillshade-highlight-color": "#ece7dd",
        "hillshade-accent-color": "#f06b2f",
        "hillshade-exaggeration": 0.68,
      },
    },
    {
      id: "waterway",
      type: "line",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "waterway",
      minzoom: 10,
      filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
      paint: {
        "line-color": "#2f3f43",
        "line-opacity": 0.55,
        "line-width": ["interpolate", ["exponential", 1.25], ["zoom"], 10, 0.35, 18, 3],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "transportation",
      filter: [
        "all",
        ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          "#292a2c",
          12,
          "#4b4b4a",
          16,
          "#8a8680",
        ],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.22, 13, 0.76],
        "line-width": ["interpolate", ["exponential", 1.25], ["zoom"], 5, 0.35, 12, 1.2, 18, 8],
      },
    },
    {
      id: "road-secondary",
      type: "line",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "transportation",
      minzoom: 10,
      filter: [
        "all",
        ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        ["match", ["get", "class"], ["secondary", "tertiary"], true, false],
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#464849",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.18, 15, 0.58],
        "line-width": ["interpolate", ["exponential", 1.22], ["zoom"], 10, 0.35, 15, 1.4, 18, 5],
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "transportation",
      minzoom: 13,
      filter: [
        "all",
        ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        ["match", ["get", "class"], ["minor", "service", "track", "path"], true, false],
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#747474",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.1, 16, 0.42],
        "line-width": ["interpolate", ["exponential", 1.25], ["zoom"], 13, 0.2, 16, 0.9, 18, 3],
      },
    },
    {
      id: "rail",
      type: "line",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["==", ["get", "class"], "rail"],
      paint: {
        "line-color": "#757575",
        "line-opacity": 0.38,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.25, 18, 1.4],
      },
    },
    {
      id: ORRA_BUILDING_FOOTPRINT_LAYER_ID,
      type: "fill",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": BUILDING_SOURCE_LAYER,
      minzoom: 13,
      layout: {
        visibility: "none",
      },
      paint: {
        "fill-color": "#111214",
        "fill-outline-color": "#2c2d2f",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.18, 15, 0.46],
      },
    },
    {
      id: ORRA_BUILDINGS_LAYER_ID,
      type: "fill-extrusion",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": BUILDING_SOURCE_LAYER,
      minzoom: 14.2,
      layout: {
        visibility: "none",
      },
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], ["get", "height"], 12],
          0,
          "#151617",
          35,
          "#353637",
          95,
          "#a7a39b",
          180,
          "#d7cec2",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15.2,
          ["coalesce", ["get", "render_height"], ["get", "height"], 12],
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": 0.92,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    {
      id: "boundary",
      type: "line",
      source: OPENMAPTILES_SOURCE_ID,
      "source-layer": "boundary",
      minzoom: 4,
      paint: {
        "line-color": "#353535",
        "line-opacity": 0.34,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.25, 10, 0.8],
      },
    },
  ],
};

export function addOpenTopographyOverlay(map: Map): void {
  if (map.getSource(ORRA_TERRAIN_SOURCE_ID)) {
    map.setTerrain({
      source: ORRA_TERRAIN_SOURCE_ID,
      exaggeration: 1.55,
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
  for (const layerId of STREET_LAYER_IDS) {
    setLayerVisibility(map, layerId, visible);
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
        ["coalesce", ["get", "render_height"], ["get", "height"], 12],
      ],
      "fill-extrusion-base": [
        "coalesce",
        ["get", "render_min_height"],
        ["get", "min_height"],
        0,
      ],
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-vertical-gradient": true,
    },
  };

  map.addLayer(buildingLayer, firstSymbolLayerId(map));
}

export function setOpenBuildingsVisibility(map: Map, visible: boolean): void {
  if (!map.getLayer(ORRA_BUILDINGS_LAYER_ID) && visible) {
    addOpenBuildings(map);
  }

  setLayerVisibility(map, ORRA_BUILDING_FOOTPRINT_LAYER_ID, visible);
  setLayerVisibility(map, ORRA_BUILDINGS_LAYER_ID, visible);
  showExistingBuildingLayers(map, visible);
}

function setLayerVisibility(map: Map, layerId: string, visible: boolean): void {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
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
      map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
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
  center: { latitude: number; longitude: number },
  zoom: number,
): void {
  const gridData = createTopographyGrid(center, zoom);
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
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.2, 17, 0.72],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 18, 2.2],
          "line-blur": 0.14,
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
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.34, 17, 0.92],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.85, 18, 2.55],
          "line-blur": 0.1,
        },
      },
      beforeLayerId,
    );
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
  center: { latitude: number; longitude: number },
  zoom: number,
): TopographyGridGeoJson {
  const spacingMeters = gridSpacingMeters(zoom);
  const halfCount = 7;
  const lineHalfLengthMeters = spacingMeters * halfCount;
  const latitudeStep = metersToLatitude(spacingMeters);
  const longitudeStep = metersToLongitude(spacingMeters, center.latitude);
  const latitudeSpan = metersToLatitude(lineHalfLengthMeters);
  const longitudeSpan = metersToLongitude(lineHalfLengthMeters, center.latitude);
  const features: TopographyGridGeoJson["features"] = [];

  for (let index = -halfCount; index <= halfCount; index += 1) {
    const proximity = Math.abs(index) <= 1 ? "near" : "far";
    const latitude = center.latitude + latitudeStep * index;
    const longitude = center.longitude + longitudeStep * index;

    features.push({
      type: "Feature",
      properties: { proximity },
      geometry: {
        type: "LineString",
        coordinates: interpolateLine(
          [center.longitude - longitudeSpan, latitude],
          [center.longitude + longitudeSpan, latitude],
        ),
      },
    });

    features.push({
      type: "Feature",
      properties: { proximity },
      geometry: {
        type: "LineString",
        coordinates: interpolateLine(
          [longitude, center.latitude - latitudeSpan],
          [longitude, center.latitude + latitudeSpan],
        ),
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function gridSpacingMeters(zoom: number): number {
  if (zoom >= 17.5) {
    return 24;
  }

  if (zoom >= 16) {
    return 42;
  }

  if (zoom >= 14) {
    return 95;
  }

  return 220;
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

function isGeoJsonSource<TData extends TopographyGridGeoJson | RouteGeoJson>(
  source: unknown,
): source is { setData: (data: TData) => void } {
  return (
    typeof source === "object" &&
    source !== null &&
    "setData" in source &&
    typeof source.setData === "function"
  );
}
