import type {
  FillExtrusionLayerSpecification,
  Map,
  StyleSpecification,
} from "maplibre-gl";

export const OPENMAPTILES_SOURCE_ID = "openmaptiles";
export const ORRA_TERRAIN_SOURCE_ID = "orra-terrain-dem";
export const ORRA_TERRAIN_LAYER_ID = "orra-terrain-shade";
export const ORRA_BUILDING_FOOTPRINT_LAYER_ID = "orra-building-footprint";
export const ORRA_BUILDINGS_LAYER_ID = "orra-open-buildings";

const BUILDING_SOURCE_LAYER = "building";
const BUILDING_SOURCE_LAYER_NAMES = ["building", "buildings"];

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
        "hillshade-exaggeration": 0.34,
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
          "#4a352c",
          12,
          "#9a5a34",
          16,
          "#e6ddd3",
        ],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.28, 13, 0.88],
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
        "line-color": "#696057",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.22, 15, 0.7],
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
        "line-color": "#d9d5cc",
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.12, 16, 0.55],
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
          "#151618",
          35,
          "#343539",
          95,
          "#d7d0c4",
          180,
          "#f27935",
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
        "fill-extrusion-opacity": 0.86,
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
      exaggeration: 1.16,
    });
  }

  setLayerVisibility(map, ORRA_TERRAIN_LAYER_ID, true);
}

export function removeOpenTopographyOverlay(map: Map): void {
  map.setTerrain(null);
  setLayerVisibility(map, ORRA_TERRAIN_LAYER_ID, false);
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
        "#151618",
        60,
        "#6d6963",
        160,
        "#f27935",
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
      "fill-extrusion-opacity": 0.86,
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
