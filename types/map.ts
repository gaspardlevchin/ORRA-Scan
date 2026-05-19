export type GeolocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
  | "unsupported"
  | "error";

export type OrientationStatus =
  | "idle"
  | "requesting"
  | "active"
  | "manual"
  | "unsupported"
  | "error";

export type GeoPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export type MapCenter = {
  latitude: number;
  longitude: number;
};

export type MapTelemetry = {
  center: MapCenter;
  userLocation: GeoPoint | null;
  centerElevation: number | null;
  userElevation: number | null;
  zoom: number;
  pitch: number;
  bearing: number;
  terrainEnabled: boolean;
  buildingsEnabled: boolean;
  roadsEnabled: boolean;
  geolocationStatus: GeolocationStatus;
  orientationStatus: OrientationStatus;
  geolocationError: string | null;
};

export type SearchResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  source: "coordinates" | "nominatim";
  category?: string;
};

export type LngLatTuple = [number, number];

export type RouteMetrics = {
  routeDistanceMeters: number | null;
  linearDistanceMeters: number;
  durationSeconds: number | null;
};

export type RouteState = {
  destination: SearchResult;
  coordinates: LngLatTuple[];
  metrics: RouteMetrics;
  status: "loading" | "ready" | "error";
  message: string | null;
};
