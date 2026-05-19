import type { FormEvent } from "react";
import type { RouteState, SearchResult } from "@/types/map";

type SearchPanelProps = {
  query: string;
  results: SearchResult[];
  status: "idle" | "searching" | "error";
  route: RouteState | null;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onSelect: (result: SearchResult) => void;
  onClearRoute: () => void;
};

export function SearchPanel({
  query,
  results,
  status,
  route,
  onQueryChange,
  onSubmit,
  onSelect,
  onClearRoute,
}: SearchPanelProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section className="search-panel" aria-label="Recherche de lieu">
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          className="search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Lieu ou coordonnées"
          aria-label="Lieu ou coordonnées GPS"
          autoComplete="off"
        />
        <button className="search-button" type="submit">
          {status === "searching" ? "..." : "GO"}
        </button>
      </form>

      {status === "error" ? (
        <div className="search-message" role="status">
          Recherche indisponible
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="search-results">
          {results.map((result) => (
            <button
              className="search-result"
              key={result.id}
              type="button"
              onClick={() => onSelect(result)}
            >
              <span>{result.label}</span>
              {result.category ? <small>{result.category}</small> : null}
            </button>
          ))}
        </div>
      ) : null}

      {route ? (
        <div className="route-card" data-status={route.status}>
          <div className="route-card__main">
            <span>{route.destination.label}</span>
            <button type="button" onClick={onClearRoute} aria-label="Effacer le trajet">
              X
            </button>
          </div>
          <div className="route-card__metrics">
            <span>Route {formatDistance(route.metrics.routeDistanceMeters)}</span>
            <span>Direct {formatDistance(route.metrics.linearDistanceMeters)}</span>
          </div>
          {route.message ? <p>{route.message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function formatDistance(distance: number | null): string {
  if (typeof distance !== "number") {
    return "n/a";
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1)} km`;
  }

  return `${Math.round(distance)} m`;
}
