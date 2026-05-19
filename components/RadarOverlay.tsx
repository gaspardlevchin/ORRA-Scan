import type { CSSProperties } from "react";

const gridRows = Array.from({ length: 11 }, (_, index) => index);
const gridColumns = Array.from({ length: 9 }, (_, index) => index);

export function RadarOverlay() {
  return (
    <div className="spatial-overlay" aria-hidden="true">
      <div className="topography-grid">
        {gridRows.map((index) => (
          <span
            className="topo-grid-line topo-grid-line--row"
            key={`row-${index}`}
            style={
              {
                "--grid-position": `${(index / (gridRows.length - 1)) * 100}%`,
                "--grid-color":
                  index < 4
                    ? "rgba(226, 111, 34, 0.68)"
                    : "rgba(246, 242, 235, 0.72)",
              } as CSSProperties
            }
          />
        ))}
        {gridColumns.map((index) => (
          <span
            className="topo-grid-line topo-grid-line--column"
            key={`column-${index}`}
            style={
              {
                "--grid-position": `${(index / (gridColumns.length - 1)) * 100}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="depth-lines">
        <span className="depth-line depth-line--a" />
        <span className="depth-line depth-line--b" />
        <span className="depth-line depth-line--c" />
        <span className="depth-line depth-line--d" />
        <span className="depth-line depth-line--e" />
      </div>
      <div className="descent-arrows">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
