export function RadarOverlay() {
  return (
    <div className="spatial-overlay" aria-hidden="true">
      <div className="topography-grid">
        <span className="contour-line contour-line--a" />
        <span className="contour-line contour-line--b" />
        <span className="contour-line contour-line--c" />
        <span className="contour-line contour-line--d" />
        <span className="contour-line contour-line--e" />
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
