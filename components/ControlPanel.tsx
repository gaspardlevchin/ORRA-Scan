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
      >
        {isLocating ? "Localisation..." : "Me localiser"}
      </button>
      <button
        className="control-button"
        type="button"
        data-active={terrainEnabled}
        onClick={onToggleTerrain}
        disabled={!mapReady}
      >
        {terrainEnabled ? "Topo active" : "Topo inactive"}
      </button>
      <button
        className="control-button"
        type="button"
        data-active={buildingsEnabled}
        onClick={onToggleBuildings}
        disabled={!mapReady}
      >
        {buildingsEnabled ? "Bâtiments 3D" : "Sans bâtiments"}
      </button>
      <button
        className="control-button"
        type="button"
        data-active={isFullscreen}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? "Quitter plein écran" : "Plein écran"}
      </button>
    </div>
  );
}
