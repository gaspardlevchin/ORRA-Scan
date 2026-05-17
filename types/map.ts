export type GeolocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
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
  zoom: number;
  pitch: number;
  terrainEnabled: boolean;
  buildingsEnabled: boolean;
  geolocationStatus: GeolocationStatus;
  geolocationError: string | null;
};
