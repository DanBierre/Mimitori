import { useEffect, useRef, useState } from "react";
import { lookupWord } from "../lib/dict";
import { ankiMode, useStore, useT, wordState } from "../lib/store";
import { anki } from "../lib/anki/useAnki";
import { addCardFromWord } from "../lib/anki/addCard";
import { listQueue } from "../lib/anki/queue";
import { isVeryCommon } from "../lib/common";
import { formatInterval } from "../lib/srs";
import { canSpeak, speak } from "../lib/speak";
import Icon from "./Icon";

// Detail for the tapped word: meaning, and the actions that move it along
// the loop (save to review / I know this).
const ADD_STATUS = {
  adding: "Adding…",
  recording: "Recording line…",
  added: "Added",
  noAudio: "Added without audio",
  duplicate: "Already in your deck",
  changed: "Your note type changed. Check the field matching.",
};

// A shortcut hint. The key itself is wired up in WordPanel: it clicks the visible
// button that carries the matching data-key.
const hot = (k) => ({ "data-key": k, "aria-keyshortcuts": k.toUpperCase() });
const Key = ({ k }) => (
  <kbd className="word-panel__key" aria-hidden="true">
    {k.toUpperCase()}
  </kbd>
);

// In Anki mode, ankiContext = { sentence, tokens, tokenIndex, translation?, fileName?,
// timeMs?, video?, cue?, offsetMs?, picture? (Blob), source? (string) } and the main button adds a card to Anki.
export default function WordPanel({ token, index, sentence, grammar = [], ankiContext, onSaved, onClose, onOpenSettings }) {
  const { state, saveWord, removeWord, knowWord, unknowWord, restoreWord, markInAnki } = useStore();
  const t = useT();
  const [add, setAdd] = useState(null); // null | key of ADD_STATUS | "queued" | { error }
  const [waiting, setWaiting] = useState(0);
  const noAudio = useRef(false);
  const current = useRef(token.base); // ignore late updates from a word we moved off
  current.current = token.base;
  const addToAnki = ankiMode(state) && Boolean(ankiContext);
  const rootRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
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

  // A, S and K act on the card; Esc closes it. Not while typing, and not
  // while the card sits on a tab that isn't showing.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (e.ctrlKey || e.metaKey || e.altKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const root = rootRef.current;
      if (!root || !root.getClientRects().length) return;
      if (e.key === "Escape") return closeRef.current();
      const btn = root.querySelector(`[data-key="${e.key.toLowerCase()}"]:not(:disabled)`);
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [sure, setSure] = useState(false); // very-common notice acknowledged
  const [justSaved, setJustSaved] = useState(false);
  const [undo, setUndo] = useState(null); // { text, word } after Remove or I know this on a saved word
  useEffect(() => {
    setAdd(null);
    setSure(false);
    setJustSaved(false);
    setUndo(null);
  }, [token.base]);

  // Remove and I know this drop the word's review history, so both can be undone.
  const dropSaved = (how, text) => {
    const word = state.words[token.base];
    if (word) setUndo({ text, word });
    how(token.base);
  };

  const mark = wordState(state, token.base);
  // "known" only because it's very common: Anki add stays reachable, behind a notice.
  const commonOnly = mark === "known" && !state.known[token.base] && !state.anki.known[token.base] && isVeryCommon(token.base);
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
    setJustSaved(true);
    setUndo(null);
    onSaved?.(token.base);
  }

  async function handleAdd() {
    const { video, cue, offsetMs, picture, ...context } = ankiContext;
    const base = token.base;
    const live = () => current.current === base;
    noAudio.current = false;
    setAdd("adding");
    const result = await addCardFromWord({
      anki,
      settings: state.settings.anki,
      word: { base: token.base, surface: token.surface, reading, glosses: entry.data?.glosses || [] },
      context,
      video,
      cue,
      picture,
      offsetMs,
      maps: state.anki,
      onProgress: (p) => {
        if (p === "noAudio") noAudio.current = true;
        else if (live()) setAdd(p);
      },
    });
    if (result === "added" || result === "duplicate" || result === "queued") markInAnki(base);
    if (result === "queued") {
      const n = await listQueue().then((q) => q.length).catch(() => 1);
      if (live()) setWaiting(n);
      window.dispatchEvent(new Event("anki-queue-changed"));
    }
    if (!live()) return;
    if (typeof result === "object") return setAdd(result);
    setAdd(result === "added" && noAudio.current ? "noAudio" : result);
  }

  const addStatus =
    add === "queued" ? t("Waiting for Anki ({n})", { n: waiting }) : typeof add === "object" && add ? t(add.error) : ADD_STATUS[add] ? t(ADD_STATUS[add]) : ADD_STATUS[add];

  return (
    <aside className="word-panel" ref={rootRef} aria-label={t("Word: {word}", { word: token.base })}>
      <button className="word-panel__close icon-btn" onClick={onClose} aria-label={t("Close word card")}>
        <Icon name="close" size={18} />
      </button>

      <div className="word-panel__head">
        {index && (
          <span className="word-panel__idx" aria-hidden="true">
            {index}
          </span>
        )}
        <span className={`word-panel__term${token.base.length > 5 ? " word-panel__term--long" : ""}`} lang="ja">
          {token.base}
        </span>
        {reading && (
          <span className="word-panel__reading" lang="ja">
            {reading}
          </span>
        )}
        {canSpeak() && (
          <button className="icon-btn word-panel__say" onClick={() => speak(token.base)} aria-label={t("Say it")} title={t("Say it")}>
            <Icon name="speak" size={18} />
          </button>
        )}
      </div>
      {entry.data?.pos.length > 0 && <p className="word-panel__pos">{entry.data.pos.join(", ")}</p>}
      {token.base !== token.surface && (
        <p className="word-panel__form">
          {t("as written:")} <span lang="ja">{token.surface}</span>
        </p>
      )}

      {entry.status === "loading" && <p className="word-panel__note">{t("Looking up…")}</p>}

      {entry.status === "ready" && (
        <ol className="word-panel__glosses">
          {entry.data.glosses.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ol>
      )}

      {(grammar.length > 0 || entry.data?.alternatives.length > 0) && (
        <div className="word-panel__notes">
          {grammar.length > 0 && (
            <p aria-label={`${token.base}: ${grammar.map((g) => t(g)).join(", ")}`}>{grammar.map((g) => t(g)).join(" · ")}</p>
          )}
          {entry.data?.alternatives.length > 0 && (
            <p>{t("Also read {list}", { list: entry.data.alternatives.map((a) => `${a.reading} (${a.glosses[0]})`).join(", ") })}</p>
          )}
        </div>
      )}

      {entry.status === "missing" && (
        <p className="word-panel__note">
          {t("Meanings aren’t installed yet. Run")} <code>npm run build:dict</code> {t("once to add the offline dictionary. You can still save this word.")}
        </p>
      )}

      <div className="word-panel__actions">
        {add && (
          <p className="word-panel__status" role="status">
            {addStatus}
            {add === "changed" && onOpenSettings && (
              <>
                {" "}
                <button className="btn btn--quiet" onClick={onOpenSettings}>
                  {t("Settings")}
                </button>
              </>
            )}
          </p>
        )}
        {mark === "inAnki" && (
          <>
            {!add && <p className="word-panel__status">{t("In your Anki deck")}</p>}
            <button className="btn" {...hot("k")} onClick={() => knowWord(token.base)}>
              <span>{t("I know this")}</span>
              <Key k="k" />
            </button>
          </>
        )}
        {(mark === "new" || (addToAnki && (mark === "saved" || mark === "due"))) && (
          <>
            <button
              className="btn btn--primary"
              {...hot(addToAnki ? "a" : "s")}
              onClick={addToAnki ? handleAdd : handleSave}
              disabled={add === "adding" || add === "recording" || (addToAnki && entry.status === "loading")}
            >
              <span>{addToAnki ? t("Add to Anki") : t("Save to review")}</span>
              <Key k={addToAnki ? "a" : "s"} />
            </button>
            <button className="btn" {...hot("k")} onClick={() => knowWord(token.base)}>
              <span>{t("I know this")}</span>
              <Key k="k" />
            </button>
            {addToAnki && entry.status === "missing" && (
              <p className="word-panel__note">{t("No meaning found — the card will have an empty meaning.")}</p>
            )}
          </>
        )}
        {!addToAnki && (mark === "saved" || mark === "due") && (
          <>
            <p className="word-panel__status">
              {justSaved
                ? t("Saved. It’ll come up in Review.")
                : mark === "due"
                  ? t("In your review queue, due now.")
                  : t("In your review queue, next in {when}.", { when: t(formatInterval(new Date(saved.card.due) - new Date())) })}
            </p>
            <button className="btn" {...hot("k")} onClick={() => dropSaved(knowWord, t("Marked as known."))}>
              <span>{t("I know this")}</span>
              <Key k="k" />
            </button>
            <button className="btn btn--quiet" onClick={() => dropSaved(removeWord, t("Removed from review."))}>
              {t("Remove")}
            </button>
          </>
        )}
        {commonOnly && (
          <>
            <p className="word-panel__status">{t("You’ve probably met this one already, so its furigana is hidden.")}</p>
            {!addToAnki ? (
              <button className="btn btn--primary" {...hot("s")} onClick={handleSave}>
                <span>{t("Save to review")}</span>
                <Key k="s" />
              </button>
            ) : !sure ? (
              <button className="btn btn--primary" {...hot("a")} onClick={() => setSure(true)}>
                <span>{t("Add to Anki")}</span>
                <Key k="a" />
              </button>
            ) : (
              <>
                <p className="word-panel__note" role="status">{t("This is a very common word.")}</p>
                <button className="btn btn--primary" {...hot("a")} autoFocus onClick={handleAdd} disabled={add === "adding" || add === "recording" || entry.status === "loading"}>
                  <span>{t("Add anyway")}</span>
                  <Key k="a" />
                </button>
              </>
            )}
          </>
        )}
        {mark === "known" && !commonOnly && (
          <>
            <p className="word-panel__status">{t("Marked as known. Furigana is hidden for it.")}</p>
            <button className="btn" onClick={() => unknowWord(token.base)}>
              {t("Mark as new")}
            </button>
          </>
        )}
        {undo && (mark === "new" || mark === "known") && (
          <p className="word-panel__status" role="status">
            {undo.text}{" "}
            <button
              className="link"
              onClick={() => {
                restoreWord(undo.word);
                setUndo(null);
              }}
            >
              {t("Undo")}
            </button>
          </p>
        )}
      </div>
    </aside>
  );
}
