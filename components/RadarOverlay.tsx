export function RadarOverlay() {
  return (
    <div className="radar-overlay" aria-hidden="true">
      <div className="radar-sweep" />
      <div className="radar-ring radar-ring--outer" />
      <div className="radar-ring radar-ring--mid" />
      <div className="radar-ring radar-ring--inner" />
      <div className="radar-axis" />
      <div className="radar-core" />
    </div>
  );
}
