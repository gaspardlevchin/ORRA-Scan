import type { GeoPoint, LngLatTuple, RouteMetrics, SearchResult } from "@/types/map";

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: LngLatTuple[];
      type: "LineString";
    };
  }>;
};

type RouteResult = {
  coordinates: LngLatTuple[];
  metrics: RouteMetrics;
  message: string | null;
};

export async function getOpenRoute(
  origin: GeoPoint | { latitude: number; longitude: number },
  destination: SearchResult,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const linearDistanceMeters = haversineDistanceMeters(origin, destination);
  const originPair: LngLatTuple = [origin.longitude, origin.latitude];
  const destinationPair: LngLatTuple = [
    destination.longitude,
    destination.latitude,
  ];

  for (const profile of ["foot", "driving"]) {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${originPair.join(
          ",",
        )};${destinationPair.join(
          ",",
        )}?overview=full&geometries=geojson&steps=false`,
        { signal },
      );

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as OsrmRouteResponse;
      const route = data.routes?.[0];

      if (data.code === "Ok" && route?.geometry.coordinates.length) {
        return {
          coordinates: route.geometry.coordinates,
          metrics: {
            routeDistanceMeters: route.distance,
            linearDistanceMeters,
            durationSeconds: route.duration,
          },
          message: null,
        };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  return {
    coordinates: [originPair, destinationPair],
    metrics: {
      routeDistanceMeters: null,
      linearDistanceMeters,
      durationSeconds: null,
    },
    message:
      "Route réseau indisponible. Affichage d'une ligne directe vers la cible.",
  };
}

export function splitRouteAtPoint(
  routeCoordinates: LngLatTuple[],
  point: GeoPoint | null,
): { traveled: LngLatTuple[]; ahead: LngLatTuple[] } {
  if (!point || routeCoordinates.length < 2) {
    return {
      traveled: [],
      ahead: routeCoordinates,
    };
  }

  const closestIndex = routeCoordinates.reduce(
    (closest, coordinate, index) => {
      const distance = haversineDistanceMeters(
        { latitude: coordinate[1], longitude: coordinate[0] },
        point,
      );

      return distance < closest.distance ? { distance, index } : closest;
    },
    { distance: Number.POSITIVE_INFINITY, index: 0 },
  ).index;

  const traveled = routeCoordinates.slice(0, closestIndex + 1);
  const ahead = routeCoordinates.slice(Math.max(closestIndex, 0));

  return {
    traveled: traveled.length >= 2 ? traveled : [],
    ahead: ahead.length >= 2 ? ahead : routeCoordinates,
  };
}

export function haversineDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
