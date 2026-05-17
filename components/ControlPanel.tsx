import type { GeolocationStatus } from "@/types/map";

type ControlPanelProps = {
  terrainEnabled: boolean;
  buildingsEnabled: boolean;
  isFullscreen: boolean;
  mapReady: boolean;
  geolocationStatus: GeolocationStatus;
  onLocate: () => void;
  onToggleTerrain: () => void;
  onToggleBuildings: () => void;
  onToggleFullscreen: () => void;
};

export function ControlPanel({
  terrainEnabled,
  buildingsEnabled,
  isFullscreen,
  mapReady,
  geolocationStatus,
  onLocate,
  onToggleTerrain,
  onToggleBuildings,
  onToggleFullscreen,
}: ControlPanelProps) {
  const isLocating = geolocationStatus === "requesting";

  return (
    <div className="control-panel" aria-label="Contrôles de la carte">
      <button
        className="control-button"
        type="button"
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
        data-active={terrainEnabled}
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
        data-active={isFullscreen}
        onClick={onToggleFullscreen}
        aria-label="Plein écran"
        title="Plein écran"
      >
        FULL
      </button>
    </div>
  );
}
