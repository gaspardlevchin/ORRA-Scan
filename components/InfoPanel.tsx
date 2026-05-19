"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { GeoPoint, GeolocationStatus, MapTelemetry } from "@/types/map";

type InfoPanelProps = {
  telemetry: MapTelemetry;
};

const statusLabels: Record<GeolocationStatus, string> = {
  idle: "idle",
  requesting: "...",
  granted: "on",
  denied: "off",
  unavailable: "n/a",
  unsupported: "n/a",
  error: "err",
};

export function InfoPanel({ telemetry }: InfoPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="info-panel"
      data-collapsed={collapsed}
      aria-label="Informations de lecture"
    >
      <button
        className="info-panel__toggle"
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
        aria-label="Afficher ou masquer les paramètres"
      >
        <span>Données</span>
        <span className="info-panel__arrow" />
      </button>

      {!collapsed ? (
        <div className="info-panel__grid">
          <DataRow
            label="Centre"
            value={`${formatCoordinate(telemetry.center.latitude)}, ${formatCoordinate(
              telemetry.center.longitude,
            )}`}
          />
          <DataRow label="Position" value={formatUserLocation(telemetry.userLocation)} />
          <DataRow
            label="Altitude"
            value={`${formatAltitude(telemetry.centerElevation)} / ${formatAltitude(
              telemetry.userElevation,
            )}`}
          />
          <DataRow
            label="Vue"
            value={`${telemetry.zoom.toFixed(1)}z / ${Math.round(
              telemetry.pitch,
            )}deg`}
          />
          <DataRow label="Cap" value={`${Math.round(telemetry.bearing)}deg`} />
          <DataRow
            label="GPS"
            value={
              <span
                className="status-value"
                data-status={telemetry.geolocationStatus}
                title={geolocationDetails(telemetry)}
              >
                {statusLabels[telemetry.geolocationStatus]}
              </span>
            }
          />
        </div>
      ) : null}
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
    return "n/a";
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
    return "n/a";
  }

  return `${Math.round(value)} m`;
}

function geolocationDetails(telemetry: MapTelemetry): string | undefined {
  const details = [
    telemetry.geolocationError,
    typeof telemetry.userLocation?.accuracy === "number"
      ? `Précision GPS : +/- ${Math.round(telemetry.userLocation.accuracy)} m`
      : null,
    typeof telemetry.userLocation?.speed === "number"
      ? `Vitesse : ${Math.round(telemetry.userLocation.speed * 3.6)} km/h`
      : null,
    typeof telemetry.userLocation?.heading === "number"
      ? `Cap : ${Math.round(telemetry.userLocation.heading)} deg`
      : null,
    typeof telemetry.userLocation?.altitude === "number"
      ? `Altitude appareil : ${Math.round(telemetry.userLocation.altitude)} m`
      : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join(" | ") : undefined;
}
