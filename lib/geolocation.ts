import type { GeoPoint, GeolocationStatus } from "@/types/map";

export const PARIS_CENTER: GeoPoint = {
  latitude: 48.8566,
  longitude: 2.3522,
  altitude: null,
  accuracy: null,
};

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 30000,
};

export function getCurrentUserPosition(
  options: PositionOptions = GEOLOCATION_OPTIONS,
): Promise<GeolocationPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Geolocation unsupported"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function positionToGeoPoint(position: GeolocationPosition): GeoPoint {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude,
    accuracy: position.coords.accuracy,
  };
}

export function geolocationStatusFromError(
  error: unknown,
): GeolocationStatus {
  const geolocationError = normalizeGeolocationError(error);

  if (geolocationError) {
    if (geolocationError.code === geolocationError.permissionDenied) {
      return "denied";
    }

    if (geolocationError.code === geolocationError.positionUnavailable) {
      return "unavailable";
    }

    return "error";
  }

  if (error instanceof Error && error.message === "Geolocation unsupported") {
    return "unsupported";
  }

  return "error";
}

export function geolocationMessageFromError(error: unknown): string {
  const geolocationError = normalizeGeolocationError(error);

  if (geolocationError) {
    if (geolocationError.code === geolocationError.permissionDenied) {
      return "Autorisation de géolocalisation refusée.";
    }

    if (geolocationError.code === geolocationError.positionUnavailable) {
      return "Position indisponible sur cet appareil.";
    }

    if (geolocationError.code === geolocationError.timeout) {
      return "La demande de géolocalisation a expiré.";
    }
  }

  if (error instanceof Error && error.message === "Geolocation unsupported") {
    return "La géolocalisation n'est pas prise en charge par ce navigateur.";
  }

  return "Impossible de récupérer la position.";
}

function normalizeGeolocationError(error: unknown):
  | {
      code: number;
      permissionDenied: number;
      positionUnavailable: number;
      timeout: number;
    }
  | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  ) {
    return {
      code: error.code,
      permissionDenied: 1,
      positionUnavailable: 2,
      timeout: 3,
    };
  }

  return null;
}
