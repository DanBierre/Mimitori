import { useEffect, useRef, useState } from "react";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Inline editor for one auto line: Enter or blur saves, Escape cancels.
function LineEditor({ text, onSave, onCancel }) {
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => ref.current?.focus(), []);
  const finish = (save) => {
    if (done.current) return;
    done.current = true;
    if (save) onSave(ref.current.value);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      className="transcript__edit"
      lang="ja"
      aria-label="Fix this line"
      defaultValue={text}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}

// Every line of the main subtitles. The current one is highlighted and kept in
// view (scrolling only this list, never the page); tapping a line jumps there.
// Auto (transcribed) lines can be fixed by hand with the pencil.
export default function Transcript({ cues, current, onJump, newCounts = [], auto = false, edited = [], onEdit }) {
  const listRef = useRef(null);
  const [editing, setEditing] = useState(-1);

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
          {auto && editing === i ? (
            <div className="transcript__line transcript__line--editing">
              <span className="transcript__time">{clock(cue.start)}</span>
              <LineEditor
                text={cue.text.replace(/\n/g, " ")}
                onSave={(text) => {
                  setEditing(-1);
                  if (text !== cue.text.replace(/\n/g, " ")) onEdit(i, text);
                }}
                onCancel={() => setEditing(-1)}
              />
            </div>
          ) : (
            <>
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
                {auto && !edited.includes(i) && <span className="transcript__auto">auto</span>}
                {newCounts[i] > 0 && (
                  <span className="transcript__new" role="img" aria-label={`${newCounts[i]} new ${newCounts[i] === 1 ? "word" : "words"}`}>
                    {"•".repeat(Math.min(newCounts[i], 3))}
                  </span>
                )}
              </button>
              {auto && (
                <button className="transcript__fix" aria-label="Fix this line" onClick={() => setEditing(i)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
              )}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
