import { useStore, wordState } from "../lib/store";

// One line of tokenized Japanese: furigana over kanji (per the furigana
// setting) and tappable content words. Shared by Read and Watch.
export default function TokenLine({ tokens, selected, onSelect }) {
  const { state } = useStore();
  const { furigana } = state.settings;

  return tokens.map((token, i) => {
    const mark = token.isWord ? wordState(state, token.base) : "plain";
    const showRuby = token.reading && furigana !== "off" && !(furigana === "unknown" && mark === "known");
    const inner = showRuby
      ? token.segments.map((seg, j) =>
          seg.ruby ? (
            <ruby key={j}>
              {seg.text}
              <rt>{seg.ruby}</rt>
            </ruby>
          ) : (
            seg.text
          )
        )
      : token.surface;
    if (!token.isWord) return <span key={i}>{inner}</span>;
    return (
      <button
        key={i}
        className={`word mk mk--${mark}`}
        aria-pressed={selected === i}
        onClick={() => onSelect(selected === i ? null : i)}
      >
        {inner}
      </button>
    );
  });
}
