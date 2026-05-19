import type { SearchResult } from "@/types/map";

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
};

const COORDINATE_PATTERN =
  /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

export async function searchOpenPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const coordinateResult = parseCoordinateSearch(query);

  if (coordinateResult) {
    return [coordinateResult];
  }

  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=fr&q=${encodeURIComponent(
      normalizedQuery,
    )}`,
    {
      signal,
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Open search unavailable");
  }

  const places = (await response.json()) as NominatimPlace[];

  return places
    .map((place) => ({
      id: String(place.place_id),
      label: place.display_name,
      latitude: Number(place.lat),
      longitude: Number(place.lon),
      source: "nominatim" as const,
      category: place.type ?? place.class,
    }))
    .filter(
      (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
    );
}

function parseCoordinateSearch(query: string): SearchResult | null {
  const match = query.match(COORDINATE_PATTERN);

  if (!match) {
    return null;
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return {
    id: `coord-${latitude}-${longitude}`,
    label: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    latitude,
    longitude,
    source: "coordinates",
    category: "Coordonnées GPS",
  };
}
