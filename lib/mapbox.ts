import type {
  FillExtrusionLayerSpecification,
  HillshadeLayerSpecification,
  Map,
} from "mapbox-gl";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const MAPBOX_STYLE = "mapbox://styles/mapbox/dark-v11";

export const TERRAIN_SOURCE_ID = "mapbox-dem";
export const HILLSHADE_LAYER_ID = "terrain-hillshade";
export const BUILDINGS_LAYER_ID = "3d-buildings";

export function hasMapboxToken(token = MAPBOX_TOKEN): boolean {
  const normalizedToken = token.trim();

  return (
    normalizedToken.length > 0 &&
    normalizedToken !== "your_mapbox_token_here"
  );
}

export function addTerrain(map: Map): void {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }

  if (!map.getLayer(HILLSHADE_LAYER_ID)) {
    const hillshadeLayer: HillshadeLayerSpecification = {
      id: HILLSHADE_LAYER_ID,
      type: "hillshade",
      source: TERRAIN_SOURCE_ID,
      paint: {
        "hillshade-exaggeration": 0.34,
        "hillshade-shadow-color": "#04110e",
        "hillshade-highlight-color": "#58f0bd",
        "hillshade-accent-color": "#0b6d54",
      },
    };

    map.addLayer(hillshadeLayer, firstLabelLayerId(map));
  }

  map.setTerrain({
    source: TERRAIN_SOURCE_ID,
    exaggeration: 1.35,
  });
}

export function removeTerrain(map: Map): void {
  map.setTerrain(null);

  if (map.getLayer(HILLSHADE_LAYER_ID)) {
    map.removeLayer(HILLSHADE_LAYER_ID);
  }
}

export function addBuildings(map: Map): void {
  if (!map.getSource("composite") || map.getLayer(BUILDINGS_LAYER_ID)) {
    return;
  }

  const buildingsLayer: FillExtrusionLayerSpecification = {
    id: BUILDINGS_LAYER_ID,
    source: "composite",
    "source-layer": "building",
    filter: ["==", ["get", "extrude"], "true"],
    type: "fill-extrusion",
    minzoom: 14,
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["get", "height"],
        0,
        "#0f3a31",
        80,
        "#1f8d70",
        180,
        "#70e4ff",
      ],
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        15.05,
        ["get", "height"],
      ],
      "fill-extrusion-base": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        0,
        15.05,
        ["get", "min_height"],
      ],
      "fill-extrusion-opacity": 0.58,
      "fill-extrusion-vertical-gradient": true,
    },
  };

  map.addLayer(buildingsLayer, firstLabelLayerId(map));
}

export function setBuildingsVisibility(map: Map, visible: boolean): void {
  if (!map.getLayer(BUILDINGS_LAYER_ID)) {
    if (visible) {
      addBuildings(map);
    }

    return;
  }

  map.setLayoutProperty(
    BUILDINGS_LAYER_ID,
    "visibility",
    visible ? "visible" : "none",
  );
}

function firstLabelLayerId(map: Map): string | undefined {
  const layers = map.getStyle().layers;

  return layers?.find(
    (layer) =>
      layer.type === "symbol" &&
      typeof layer.layout?.["text-field"] !== "undefined",
  )?.id;
}
