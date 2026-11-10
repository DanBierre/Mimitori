import { useMemo, useState } from "react";
import { useStore, wordState } from "../lib/store";
import { downloadCsv } from "../lib/exportCsv";
import { formatInterval } from "../lib/srs";

const FILTERS = [
  ["all", "All"],
  ["due", "Due"],
  ["saved", "Learning"],
  ["known", "Known"],
];

export default function WordsView() {
  const { state, removeWord, knowWord, unknowWord } = useStore();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);

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

  return (
    <section className="sheet words" aria-label="Words">
      <div className="words__bar">
        <div className="segmented" role="group" aria-label="Filter words">
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
      </div>

      {rows.length === 0 ? (
        <p className="note words__empty">
          Your words show up here as you save them from the reading sheet. Words you mark as known
          are tracked too, so furigana can stay out of your way.
        </p>
      ) : visible.length === 0 ? (
        <p className="note words__empty">No words match.</p>
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

      <footer className="words__foot">
        <button className="btn" onClick={() => downloadCsv(savedWords)} disabled={savedWords.length === 0}>
          Export to Anki (CSV)
        </button>
        <p className="words__credit">
          Word meanings come from JMdict, © the Electronic Dictionary Research and Development Group,
          used under CC BY-SA 4.0.
        </p>
      </footer>
    </section>
  );
}
