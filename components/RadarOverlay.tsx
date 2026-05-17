export function RadarOverlay() {
  return (
    <div className="spatial-overlay" aria-hidden="true">
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
