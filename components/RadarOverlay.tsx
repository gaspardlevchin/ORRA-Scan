export function RadarOverlay() {
  return (
    <>
      <div className="scanner-grid" aria-hidden="true" />
      <div className="radar-overlay" aria-hidden="true">
        <div className="radar-sweep" />
        <div className="radar-ring radar-ring--outer" />
        <div className="radar-ring radar-ring--mid" />
        <div className="radar-ring radar-ring--inner" />
        <div className="radar-axis" />
        <div className="radar-horizon">
          <span className="radar-dots" />
        </div>
        <div className="radar-target radar-target--left" />
        <div className="radar-target radar-target--center" />
        <div className="radar-target radar-target--right" />
        <div className="radar-range radar-range--left">250 m</div>
        <div className="radar-range radar-range--center">SCAN</div>
        <div className="radar-range radar-range--right">500 m</div>
        <div className="radar-core" />
      </div>
    </>
  );
}
