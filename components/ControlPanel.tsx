import type { GeolocationStatus } from "@/types/map";

type ControlPanelProps = {
  gpsModeActive: boolean;
  topoModeActive: boolean;
  buildingsEnabled: boolean;
  roadsEnabled: boolean;
  mapReady: boolean;
  geolocationStatus: GeolocationStatus;
  onLocate: () => void;
  onToggleTerrain: () => void;
  onToggleBuildings: () => void;
  onToggleRoads: () => void;
};

export function ControlPanel({
  gpsModeActive,
  topoModeActive,
  buildingsEnabled,
  roadsEnabled,
  mapReady,
  geolocationStatus,
  onLocate,
  onToggleTerrain,
  onToggleBuildings,
  onToggleRoads,
}: ControlPanelProps) {
  const isLocating = geolocationStatus === "requesting";

  return (
    <div className="control-panel" aria-label="Contrôles de la carte">
      <button
        className="control-button"
        type="button"
        data-active={gpsModeActive}
        onClick={onLocate}
        disabled={isLocating}
        aria-label="Me localiser"
        title="Me localiser"
      >
        {isLocating ? "..." : "GPS"}
      </button>
      <button
        className="control-button"
        type="button"
        data-active={topoModeActive}
        onClick={onToggleTerrain}
        disabled={!mapReady}
        aria-label="Activer ou désactiver le relief"
        title="Relief"
      >
        TOPO
      </button>
      <button
        className="control-button"
        type="button"
        data-active={buildingsEnabled}
        onClick={onToggleBuildings}
        disabled={!mapReady}
        aria-label="Activer ou désactiver les bâtiments 3D"
        title="Bâtiments 3D"
      >
        3D
      </button>
      <button
        className="control-button"
        type="button"
        data-active={roadsEnabled}
        onClick={onToggleRoads}
        disabled={!mapReady}
        aria-label="Activer ou désactiver les rues"
        title="Rues"
      >
        RUES
      </button>
    </div>
  );
}
