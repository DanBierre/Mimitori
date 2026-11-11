import { stoppedLabel } from "../lib/recents";
import { noFocus } from "./WatchControls";

// Under the empty stage: the last few videos, so the learner can pick up where they stopped.
// Browsers can't reopen a file by themselves, so Carry on opens the file picker.
export default function WatchRecents({ recents, onCarryOn, onSample, sampleLoading }) {
  const rows = recents.slice(0, 6);
  const showSample = rows.length < 2;
  return (
    <section className="recents" aria-labelledby="recents-title">
      <h2 id="recents-title" className="recents__title">
        Recent
      </h2>
      <ul className="recents__list">
        {rows.map((r) => (
          <li key={r.key} className="recents__row">
            <span className="recents__name" title={r.name}>
              {r.name}
            </span>
            {r.coverage !== null && <span className="recents__pct">{r.coverage}% known</span>}
            <span className="recents__stop">{stoppedLabel(r)}</span>
            <button
              className="btn btn--quiet recents__go"
              aria-label={`Carry on with ${r.name}`}
              onMouseDown={noFocus}
              onClick={() => onCarryOn(r)}
            >
              Carry on
            </button>
          </li>
        ))}
        {showSample && (
          <li className="recents__row recents__row--sample">
            <span className="recents__name">Sample clip</span>
            <span className="recents__stop">30 s</span>
            <button className="btn btn--quiet recents__go" onMouseDown={noFocus} onClick={onSample} disabled={sampleLoading}>
              {sampleLoading ? "Loading…" : "Try it"}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
