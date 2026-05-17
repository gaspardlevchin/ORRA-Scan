import type { ReactNode } from "react";
import type { GeoPoint, GeolocationStatus, MapTelemetry } from "@/types/map";

type InfoPanelProps = {
  telemetry: MapTelemetry;
};

const statusLabels: Record<GeolocationStatus, string> = {
  idle: "En attente",
  requesting: "Demande en cours",
  granted: "Active",
  denied: "Refusée",
  unavailable: "Indisponible",
  unsupported: "Non supportée",
  error: "Erreur",
};

export function InfoPanel({ telemetry }: InfoPanelProps) {
  return (
    <aside className="info-panel" aria-label="Informations de lecture">
      <p className="panel-kicker">Lecture topographique</p>
      <div className="info-panel__grid">
        <DataRow
          label="Centre GPS"
          value={`${formatCoordinate(telemetry.center.latitude)}, ${formatCoordinate(
            telemetry.center.longitude,
          )}`}
        />
        <DataRow
          label="Position GPS"
          value={formatUserLocation(telemetry.userLocation)}
        />
        <DataRow label="Zoom" value={telemetry.zoom.toFixed(2)} />
        <DataRow label="Pitch" value={`${Math.round(telemetry.pitch)} deg`} />
        <DataRow
          label="Cap GPS"
          value={formatHeading(telemetry.userLocation?.heading)}
        />
        <DataRow
          label="Vitesse"
          value={formatSpeed(telemetry.userLocation?.speed)}
        />
        <DataRow
          label="Précision"
          value={formatAccuracy(telemetry.userLocation?.accuracy)}
        />
        <DataRow
          label="Altitude"
          value={formatAltitude(telemetry.userLocation?.altitude)}
        />
        <DataRow
          label="Géoloc."
          value={
            <span
              className="status-value"
              data-status={telemetry.geolocationStatus}
              title={telemetry.geolocationError ?? undefined}
            >
              {statusLabels[telemetry.geolocationStatus]}
            </span>
          }
        />
      </div>
    </aside>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <span className="data-value">{value}</span>
    </div>
  );
}

function formatUserLocation(location: GeoPoint | null): string {
  if (!location) {
    return "Non disponible";
  }

  return `${formatCoordinate(location.latitude)}, ${formatCoordinate(
    location.longitude,
  )}`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function formatAltitude(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Non disponible";
  }

  return `${Math.round(value)} m`;
}

function formatAccuracy(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Non disponible";
  }

  return `+/- ${Math.round(value)} m`;
}

function formatHeading(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Non disponible";
  }

  return `${Math.round(value)} deg`;
}

function formatSpeed(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Non disponible";
  }

  return `${Math.round(value * 3.6)} km/h`;
}
