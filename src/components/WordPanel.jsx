import { useEffect, useState } from "react";
import { lookupWord } from "../lib/dict";
import { useStore, wordState } from "../lib/store";
import { formatInterval } from "../lib/srs";
import { canSpeak, speak } from "../lib/speak";
import Icon from "./Icon";

// Detail for the tapped word: meaning, and the actions that move it along
// the loop (save to review / I know this).
export default function WordPanel({ token, sentence, grammar = [], onSaved, onClose }) {
  const { state, saveWord, removeWord, knowWord, unknowWord } = useStore();
  const [entry, setEntry] = useState({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;
    setEntry({ status: "loading", data: null });
    lookupWord({ base: token.base, surface: token.surface, reading: token.reading }).then((data) => {
      if (!cancelled) setEntry({ status: data ? "ready" : "missing", data });
    });
    return () => {
      cancelled = true;
    };
  }, [token.base, token.surface, token.reading]);

  const mark = wordState(state, token.base);
  const saved = state.words[token.base];
  const reading = entry.data?.reading || token.reading || "";

  function handleSave() {
    saveWord({
      base: token.base,
      surface: token.surface,
      reading,
      glosses: entry.data?.glosses || [],
      pos: entry.data?.pos || [],
      sentence,
    });
    onSaved?.(token.base);
  }

  return (
    <aside className="word-panel" aria-label={`Word: ${token.base}`}>
      <button className="word-panel__close icon-btn" onClick={onClose} aria-label="Close word card">
        <Icon name="close" size={18} />
      </button>

      <div className="word-panel__head">
        <span className={`word-panel__term mk mk--${mark}`}>{token.base}</span>
        {reading && <span className="word-panel__reading">{reading}</span>}
        {token.base !== token.surface && (
          <span className="word-panel__form">as written: {token.surface}</span>
        )}
        {canSpeak() && (
          <button className="icon-btn word-panel__say" onClick={() => speak(token.base)} aria-label="Say it" title="Say it">
            <Icon name="speak" size={18} />
          </button>
        )}
      </div>

      {grammar.length > 0 && (
        <p className="word-panel__grammar" aria-label={`${token.base}: ${grammar.join(", ")}`}>
          {grammar.map((g) => (
            <span key={g}>{g}</span>
          ))}
        </p>
      )}

      {entry.status === "loading" && <p className="word-panel__note">Looking up…</p>}

      {entry.status === "ready" && (
        <div className="word-panel__body">
          {entry.data.pos.length > 0 && <p className="word-panel__pos">{entry.data.pos.join(" · ")}</p>}
          <ol className="word-panel__glosses">
            {entry.data.glosses.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ol>
          {entry.data.alternatives.length > 0 && (
            <p className="word-panel__alt">
              Also read {entry.data.alternatives.map((a) => `${a.reading} (${a.glosses[0]})`).join(", ")}
            </p>
          )}
        </div>
      )}

      {entry.status === "missing" && (
        <p className="word-panel__note">
          Meanings aren’t installed yet. Run <code>npm run build:dict</code> once to add the offline
          dictionary. You can still save this word.
        </p>
      )}

      <div className="word-panel__actions">
        {mark === "new" && (
          <>
            <button className="btn btn--primary" onClick={handleSave}>
              Save to review
            </button>
            <button className="btn" onClick={() => knowWord(token.base)}>
              I know this
            </button>
          </>
        )}
        {(mark === "saved" || mark === "due") && (
          <>
            <p className="word-panel__status">
              {mark === "due"
                ? "In your review queue, due now."
                : `In your review queue, next in ${formatInterval(new Date(saved.card.due) - new Date())}.`}
            </p>
            <button className="btn" onClick={() => knowWord(token.base)}>
              I know this
            </button>
            <button className="btn btn--quiet" onClick={() => removeWord(token.base)}>
              Remove
            </button>
          </>
        )}
        {mark === "known" && (
          <>
            <p className="word-panel__status">Marked as known. Furigana is hidden for it.</p>
            <button className="btn" onClick={() => unknowWord(token.base)}>
              Not yet
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
