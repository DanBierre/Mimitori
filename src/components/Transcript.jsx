import { useEffect, useRef } from "react";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Every line of the main subtitles. The current one is highlighted and kept in
// view (scrolling only this list, never the page); tapping a line jumps there.
export default function Transcript({ cues, current, onJump }) {
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[current];
    if (!item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - list.clientHeight / 3, behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [current]);

  return (
    <ol className="transcript" ref={listRef} aria-label="Transcript">
      {cues.map((cue, i) => (
        <li key={i}>
          <button
            className="transcript__line"
            aria-current={i === current ? "true" : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onJump(i)}
          >
            <span className="transcript__time">{clock(cue.start)}</span>
            <span className="transcript__text" lang="ja">
              {cue.text.replace(/\n/g, " ")}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
