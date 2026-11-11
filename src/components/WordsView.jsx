import { useMemo, useState } from "react";
import { ankiMode, knownTotal, useStore, wordState } from "../lib/store";
import { anki } from "../lib/anki/useAnki";
import { addCardFromWord } from "../lib/anki/addCard";
import { planBatch, sendBatch } from "../lib/anki/batch";
import { downloadCsv } from "../lib/exportCsv";
import { formatInterval } from "../lib/srs";
import SceneStill from "./SceneStill";
import { useMarker } from "../lib/useMarker";

const FILTERS = [
  ["all", "All"],
  ["due", "Due"],
  ["saved", "Learning"],
  ["known", "Known"],
];

let batchRunning = false; // survives a tab switch, so a second Send all can't start mid-run

export default function WordsView({ onGoWatch, onGoRead }) {
  const { state, removeWord, knowWord, unknowWord, markInAnki } = useStore();
  const [filter, setFilter] = useState("all");
  const filterRef = useMarker('[aria-pressed="true"]');
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);
  const [batch, setBatch] = useState(null); // null | { running, step, total } | { done: message }

  const rows = useMemo(() => {
    const now = new Date();
    const learning = Object.values(state.words).map((w) => ({
      base: w.base,
      reading: w.reading,
      glosses: w.glosses || [],
      sentence: w.sentence,
      due: new Date(w.card.due),
      mark: wordState(state, w.base, now),
    }));
    const known = Object.keys(state.known).map((base) => ({
      base,
      reading: "",
      glosses: [],
      sentence: "",
      due: null,
      mark: "known",
    }));
    return [...learning, ...known].sort((a, b) => a.base.localeCompare(b.base, "ja"));
  }, [state]);

  const counts = useMemo(() => {
    const c = { all: rows.length, due: 0, saved: 0, known: 0 };
    rows.forEach((r) => {
      c[r.mark] = (c[r.mark] || 0) + 1;
    });
    return c;
  }, [rows]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.mark === filter) &&
      (!q || r.base.includes(q) || r.reading.includes(q) || r.glosses.join(" ").toLowerCase().includes(q))
  );

  const savedWords = Object.values(state.words);
  const toSend = planBatch(savedWords, state).send;

  async function sendAll() {
    if (batchRunning) return;
    batchRunning = true;
    setBatch({ running: true, step: 0, total: 0 });
    try {
      await runBatch();
    } finally {
      batchRunning = false;
    }
  }

  async function runBatch() {
    const { send: words, skip } = planBatch(savedWords, state);
    setBatch({ running: true, step: 0, total: words.length });
    const r = await sendBatch({
      words,
      maps: state.anki,
      onStep: (step, total) => setBatch({ running: true, step, total }),
      send: async (word, maps) => {
        const result = await addCardFromWord({
          anki,
          settings: state.settings.anki,
          word: { base: word.base, surface: word.surface, reading: word.reading, glosses: word.glosses || [] },
          context: { sentence: word.sentence },
          maps,
        });
        if (result === "added" || result === "queued") markInAnki(word.base);
        return result;
      },
    });
    if (r.queued) window.dispatchEvent(new Event("anki-queue-changed"));
    const skipped = skip.length + r.skipped;
    setBatch({
      done:
        r.stopped === "changed"
          ? "Your note type changed. Check the field matching."
          : `Added ${r.added + r.queued}. Skipped ${skipped} (already in Anki or very common).` +
            (r.queued ? ` ${r.queued} will go in when Anki's open.` : "") +
            (r.failed ? ` ${r.failed} couldn't be added.` : ""),
    });
  }

  return (
    <section className="sheet words" aria-label="Words">
      <p className="words__count">{knownTotal(state)} words known · {savedWords.length} learning</p>
      <div className="words__bar">
        <div className="segmented" role="group" aria-label="Filter words" ref={filterRef}>
          <span className="marker" aria-hidden="true" />
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              className="segmented__btn"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label} <span className="segmented__count">{counts[value] || 0}</span>
            </button>
          ))}
        </div>
        <input
          className="words__search"
          type="search"
          placeholder="Search words or meanings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search words"
        />
        <div className="words__actions-bar">
          <button className="btn" onClick={() => downloadCsv(savedWords)} disabled={savedWords.length === 0}>
            Export to Anki (CSV)
          </button>
          {ankiMode(state) && (
            <button className="btn" onClick={sendAll} disabled={batch?.running || batchRunning || toSend.length === 0}>
              Send all to Anki
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="words__empty">
          <h2 className="words__empty-title">Your words live here</h2>
          <p>
            They appear when you tap a word in Read or Watch and press Save to review or Add to Anki. Words you mark
            as known are tracked too, so furigana stays out of your way.
          </p>
          <div className="words__empty-actions">
            <button className="btn btn--primary" onClick={onGoWatch}>Open Watch</button>
            <button className="btn btn--quiet" onClick={onGoRead}>Open Read</button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="note words__nomatch">No words match.</p>
      ) : (
        <ul className="words__list">
          {visible.map((r) => (
            <li key={r.base} className="words__row">
              <button
                className="words__summary"
                aria-expanded={open === r.base}
                onClick={() => setOpen(open === r.base ? null : r.base)}
              >
                <span className={`words__term mk mk--${r.mark}`} lang="ja">
                  {r.base}
                </span>
                <span className="words__reading" lang="ja">
                  {r.reading}
                </span>
                <span className="words__meaning">{r.glosses.slice(0, 2).join("; ")}</span>
                <span className="words__state">
                  {r.mark === "due" && "due now"}
                  {r.mark === "saved" && `in ${formatInterval(r.due - new Date())}`}
                  {r.mark === "known" && "known"}
                </span>
              </button>
              {open === r.base && (
                <div className="words__detail">
                  <SceneStill base={r.base} />
                  {r.sentence && (
                    <p className="words__sentence" lang="ja">
                      {r.sentence}
                    </p>
                  )}
                  <div className="words__actions">
                    {r.mark !== "known" && (
                      <button className="btn" onClick={() => knowWord(r.base)}>
                        I know this
                      </button>
                    )}
                    {r.mark === "known" && (
                      <button className="btn" onClick={() => unknowWord(r.base)}>
                        Not yet
                      </button>
                    )}
                    {r.mark !== "known" && (
                      <button className="btn btn--quiet" onClick={() => removeWord(r.base)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(batch?.running || batch?.done) && (
        <p className="note" role="status">
          {batch.running ? `Sending ${batch.step} of ${batch.total}…` : batch.done}
        </p>
      )}
      <p className="words__credit">
        Word meanings come from JMdict, © the Electronic Dictionary Research and Development Group,
        used under CC BY-SA 4.0.
      </p>
    </section>
  );
}
