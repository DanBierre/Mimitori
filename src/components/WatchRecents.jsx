import { useEffect, useState } from "react";
import { posterKey, stoppedLabel } from "../lib/recents";
import { getImageUrl } from "../lib/images";
import { noFocus } from "./WatchControls";

// Poster frame, loaded after the row shows so it never holds the list up.
function Thumb({ id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null;
    let off = false;
    getImageUrl(posterKey(id)).then((u) => {
      url = u;
      if (off && u) URL.revokeObjectURL(u);
      else if (u) setSrc(u);
    });
    return () => {
      off = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return (
    <span className="recents__thumb">
      {src && <img src={src} alt="" loading="lazy" decoding="async" />}
    </span>
  );
}

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
            <Thumb id={r.key} />
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
            <span className="recents__thumb" aria-hidden="true" />
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
