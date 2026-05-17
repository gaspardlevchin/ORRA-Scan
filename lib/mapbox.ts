import type {
  FillExtrusionLayerSpecification,
  HillshadeLayerSpecification,
  LineLayerSpecification,
  Map,
} from "mapbox-gl";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const MAPBOX_STYLE = "mapbox://styles/mapbox/dark-v11";

export const TERRAIN_SOURCE_ID = "mapbox-dem";
export const HILLSHADE_LAYER_ID = "terrain-hillshade";
export const TOPOGRAPHY_SOURCE_ID = "mapbox-terrain-vector";
export const CONTOUR_LAYER_ID = "terrain-contours";
export const CONTOUR_GLOW_LAYER_ID = "terrain-contours-glow";
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

  addTopographicContours(map);

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

  removeTopographicContours(map);
}

export function addTopographicContours(map: Map): void {
  if (!map.getSource(TOPOGRAPHY_SOURCE_ID)) {
    map.addSource(TOPOGRAPHY_SOURCE_ID, {
      type: "vector",
      url: "mapbox://mapbox.mapbox-terrain-v2",
    });
  }

  const labelLayerId = firstLabelLayerId(map);

  if (!map.getLayer(CONTOUR_GLOW_LAYER_ID)) {
    const contourGlowLayer: LineLayerSpecification = {
      id: CONTOUR_GLOW_LAYER_ID,
      type: "line",
      source: TOPOGRAPHY_SOURCE_ID,
      "source-layer": "contour",
      paint: {
        "line-color": "#0c4f35",
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.08,
          9,
          0.16,
          14,
          0.34,
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.4,
          10,
          0.7,
          15,
          1.3,
        ],
      },
    };

    map.addLayer(contourGlowLayer, labelLayerId);
  }

  if (!map.getLayer(CONTOUR_LAYER_ID)) {
    const contourLayer: LineLayerSpecification = {
      id: CONTOUR_LAYER_ID,
      type: "line",
      source: TOPOGRAPHY_SOURCE_ID,
      "source-layer": "contour",
      paint: {
        "line-color": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          "#1a9b63",
          11,
          "#48eaa9",
          15,
          "#8af8c7",
        ],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.12,
          9,
          0.22,
          14,
          0.5,
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.2,
          10,
          0.45,
          15,
          0.9,
        ],
      },
    };

    map.addLayer(contourLayer, labelLayerId);
  }
}

export function removeTopographicContours(map: Map): void {
  if (map.getLayer(CONTOUR_LAYER_ID)) {
    map.removeLayer(CONTOUR_LAYER_ID);
  }

  if (map.getLayer(CONTOUR_GLOW_LAYER_ID)) {
    map.removeLayer(CONTOUR_GLOW_LAYER_ID);
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
