import { useEffect, useRef, useState } from "react";
import { useStore, wordState } from "../lib/store";

// One line of tokenized Japanese: furigana over kanji (per the furigana
// setting) and tappable content words. Shared by Read and Watch.
const SAVED = new Set(["saved", "inAnki", "due"]);

// `numbered` (Watch): token indexes that carry a small 1–9, matching the readout rows.
export default function TokenLine({ tokens, selected, onSelect, numbered }) {
  const { state } = useStore();
  const { furigana } = state.settings;

  // A word that just went from new/known to saved gets its underline drawn on, once.
  const marks = {};
  for (const t of tokens) if (t.isWord) marks[t.base] = wordState(state, t.base);
  const seen = useRef(null);
  const [fresh, setFresh] = useState(null);
  useEffect(() => {
    const prev = seen.current;
    seen.current = marks;
    if (!prev) return;
    const added = Object.keys(marks).filter((b) => (prev[b] === "new" || prev[b] === "known") && SAVED.has(marks[b]));
    if (!added.length) return;
    setFresh(new Set(added));
    setTimeout(() => setFresh(null), 600);
  });

  return tokens.map((token, i) => {
    const mark = token.isWord ? wordState(state, token.base) : "plain";
    const showRuby = token.reading && furigana !== "off";
    // Known words keep their reading in the DOM but fade it out, so marking a word known is visible.
    const fade = furigana === "unknown" && mark === "known" ? "rt--known" : undefined;
    const inner = showRuby
      ? token.segments.map((seg, j) =>
          seg.ruby ? (
            <ruby key={j}>
              {seg.text}
              <rt className={fade}>{seg.ruby}</rt>
            </ruby>
          ) : (
            seg.text
          )
        )
      : token.surface;
    if (!token.isWord) return <span key={i}>{inner}</span>;
    const n = numbered ? numbered.indexOf(i) + 1 : 0;
    return (
      <button
        key={i}
        className={`word mk mk--${mark}${fresh?.has(token.base) ? " mk--draw" : ""}${n ? " word--idx" : ""}`}
        aria-pressed={selected === i}
        // Ruby splits the word for screen readers; give them the word, then its reading.
        aria-label={token.reading && token.reading !== token.surface ? `${token.surface}, ${token.reading}` : token.surface}
        onClick={() => onSelect(selected === i ? null : i)}
        // Yomitan-style: hold Shift and move the mouse over words to look them up.
        onPointerMove={(e) => {
          if (e.shiftKey && e.pointerType === "mouse" && selected !== i) onSelect(i);
        }}
      >
        {inner}
        {n > 0 && (
          <span className="word__idx" aria-hidden="true">
            {n}
          </span>
        )}
      </button>
    );
  });
}
