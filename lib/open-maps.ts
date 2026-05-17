import type {
  FillExtrusionLayerSpecification,
  Map,
  RasterLayerSpecification,
  RasterSourceSpecification,
} from "maplibre-gl";

export const OPENFREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
export const OPENTOPO_SOURCE_ID = "open-topography-raster";
export const OPENTOPO_LAYER_ID = "open-topography-overlay";
export const ORRA_BUILDINGS_LAYER_ID = "orra-open-buildings";

const BUILDING_SOURCE_LAYER_NAMES = ["building", "buildings"];

export function addOpenTopographyOverlay(map: Map): void {
  if (!map.getSource(OPENTOPO_SOURCE_ID)) {
    const source: RasterSourceSpecification = {
      type: "raster",
      tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        'Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      maxzoom: 17,
    };

    map.addSource(OPENTOPO_SOURCE_ID, source);
  }

  if (!map.getLayer(OPENTOPO_LAYER_ID)) {
    const layer: RasterLayerSpecification = {
      id: OPENTOPO_LAYER_ID,
      type: "raster",
      source: OPENTOPO_SOURCE_ID,
      paint: {
        "raster-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.42,
          12,
          0.28,
          16,
          0.16,
        ],
        "raster-contrast": 0.28,
        "raster-saturation": -0.38,
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.68,
      },
    };

    map.addLayer(layer, firstSymbolLayerId(map));
  }
}

export function removeOpenTopographyOverlay(map: Map): void {
  if (map.getLayer(OPENTOPO_LAYER_ID)) {
    map.removeLayer(OPENTOPO_LAYER_ID);
  }
}

export function addOpenBuildings(map: Map): void {
  if (map.getLayer(ORRA_BUILDINGS_LAYER_ID)) {
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
    minzoom: 14,
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], ["get", "height"], 0],
        0,
        "#123c25",
        60,
        "#33a767",
        160,
        "#b5ff6a",
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
      "fill-extrusion-opacity": 0.56,
    },
  };

  map.addLayer(buildingLayer, firstSymbolLayerId(map));
}

export function setOpenBuildingsVisibility(map: Map, visible: boolean): void {
  if (!map.getLayer(ORRA_BUILDINGS_LAYER_ID) && visible) {
    addOpenBuildings(map);
  }

  if (map.getLayer(ORRA_BUILDINGS_LAYER_ID)) {
    map.setLayoutProperty(
      ORRA_BUILDINGS_LAYER_ID,
      "visibility",
      visible ? "visible" : "none",
    );
  }

  showExistingBuildingLayers(map, visible);
}

function showExistingBuildingLayers(map: Map, visible: boolean): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (
      layer.id !== ORRA_BUILDINGS_LAYER_ID &&
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
